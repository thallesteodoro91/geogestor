const fs = require('fs');
const path = require('path');

const filesToFix = [
  'apps/web/src/components/GlobalSearch.tsx',
  'apps/web/src/components/ModalAdicionarNota.tsx',
  'apps/web/src/pages/Configuracoes.tsx',
  'apps/web/src/pages/Dashboard.tsx',
  'apps/web/src/pages/Planejamento.tsx'
];

for (const file of filesToFix) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // GlobalSearch.tsx
  if (file.includes('GlobalSearch')) {
    content = content.replace(/fetch\(`http:\/\/localhost:3001\/api\/search\?q=\$\{encodeURIComponent\(query\)\}`, \{[\s\S]*?headers: \{ 'x-api-token': token \}[\s\S]*?\}\)/, "apiClient.get<any[]>(`/api/search?q=${encodeURIComponent(query)}`)");
    changed = true;
  }
  
  // ModalAdicionarNota.tsx
  if (file.includes('ModalAdicionarNota')) {
    content = content.replace(/const res = await fetch\(`http:\/\/localhost:3001\/api\/clientes\/\$\{clienteId\}\/historico`, \{[\s\S]*?method: 'POST',[\s\S]*?body: JSON\.stringify\(([\s\S]*?)\)[\s\S]*?\}\);[\s\S]*?if \(!res\.ok\) throw new Error\('Erro ao adicionar nota'\);/, "await apiClient.post(`/api/clientes/${clienteId}/historico`, $1);");
    changed = true;
  }

  // Dashboard e Planejamento
  if (file.includes('Dashboard') || file.includes('Planejamento')) {
    content = content.replace(/fetch\('http:\/\/localhost:3001(\/api\/[^\']+)'\)\.then\(res => \n?\s*res\.json\(\)\)/g, "apiClient.get<any>('$1')");
    content = content.replace(/fetch\('http:\/\/localhost:3001(\/api\/[^\']+)'\)\.then\(res => res\.json\(\)\)/g, "apiClient.get<any>('$1')");
    changed = true;
  }

  // Configuracoes.tsx
  if (file.includes('Configuracoes.tsx')) {
    content = content.replace(/const res = await fetch\('http:\/\/localhost:3001(\/api\/sistema\/info)'\);/g, "const res = await apiClient.get<any>('$1');");
    content = content.replace(/const res = await fetch\('http:\/\/localhost:3001(\/api\/sistema\/reset)', \{[\s\S]*?method: 'DELETE'[\s\S]*?\}\);/g, "await apiClient.delete('$1');");
    content = content.replace(/const res = await fetch\('http:\/\/localhost:3001(\/api\/sistema\/backup-completo\/preflight)'\);/g, "const res = await apiClient.get<any>('$1');");
    
    // As rotas de download precisam de fetch nativo ou apiClient configurado para blob.
    // Mas o apiClient já tem suporte básico, embora geralmente downloads sejam feitos via window.open ou res.blob().
    // Em Configuracoes, backup e backup-completo usam res.blob() no fetch original.
    // O apiClient retorna JSON ou texto se não configurado, mas vamos verificar como Configuracoes lida.
    // Por enquanto, Configuracoes.tsx para backups a gente substitui para usar url absoluta no a.href se possível?
    // Vamos olhar Configuracoes.tsx mais a fundo antes de substituir os downloads.
  }

  if (changed) {
    if (!content.includes('apiClient')) {
      // Find a good place to inject the import
      const importStatement = "import { apiClient } from '../services/apiClient';\n";
      // Determine if it needs ../ or ../../
      const depth = file.split('/').length - 3; // 'apps/web/src' is depth 0
      const relativePath = depth === 2 ? '../../services/apiClient' : '../services/apiClient';
      const exactImport = `import { apiClient } from '${relativePath}';\n`;
      
      content = exactImport + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', file);
  }
}
