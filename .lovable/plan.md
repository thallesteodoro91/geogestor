

# Refatorar PrintableReport -- Storytelling com Dados

Refatorar apenas o componente `PrintableReport.tsx` (exportação/impressão). A tela do relatório executivo permanece inalterada.

## Mudanças no `PrintableReport.tsx`

### 1. Cabeçalho Técnico (Página 1)
- Esquerda: Logo "SkyGeo" com tagline
- Direita: bloco monospace com ID do Relatório (hash curto gerado), Data de Emissão, Responsável (nome da empresa)

### 2. Seção de Contexto -- Estado de Saúde Financeira
- Abaixo do cabeçalho, uma linha com badge sutil indicando o estado:
  - "Saudável" (lucro positivo, variação >= 0)
  - "Atenção" (lucro negativo ou queda)
- Exibe a variação percentual em destaque

### 3. Banda de KPIs Simplificada
- Apenas 3 KPIs principais lado a lado: Faturamento, Gasto, Lucro Líquido
- Separados por linhas verticais finas e whitespace
- Remover Margem de Lucro e Taxa Conversão da banda principal (mover como dado secundário no sumário)

### 4. Sumário Executivo -- Design Editorial
- Ocupa o centro da primeira página
- Insights da IA com títulos em tipografia diferenciada (serif-style weight)
- Ações recomendadas em box cinza claro neutro, rotulado como "Insight de Gestão"
- Texto corrido para descrições

### 5. Gráficos (Página 2) -- Proporção Áurea
- Grid assimétrico: gráfico de barras ocupa ~60% da largura, donut ~40%
- Paleta monocromática: azul SkyGeo `#1e3a5f` como cor primária, tons de cinza/slate para secundários
- Remover cores vibrantes do donut, usar variações de opacidade do azul
- Eixos limpos, sem grid lines

### 6. Tabelas -- `table-layout: fixed`
- Extrair sub-componente `PrintTable` com `table-layout: fixed` e `word-break: break-word`
- Colunas de e-mail/telefone com largura fixa para não quebrar layout
- Empty state elegante: ícone sutil + "Nenhuma movimentação registrada no período" centralizado em box cinza claro

### 7. Rodapé
- Numeração de página implícita
- "Documento confidencial -- SkyGeo · Powered by GeoGestor"

## Arquivos alterados
- **Editar**: `src/components/relatorio/PrintableReport.tsx` -- reescrever com storytelling
- Nenhuma mudança em `RelatorioExecutivo.tsx` ou `index.css`

