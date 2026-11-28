import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createLaudoPdfDefinition, type LaudoOptions } from '../../apps/web/src/utils/laudoPdfGenerator';
import { withPdfAccessibilityMetadata } from '../../apps/web/src/utils/pdfAccessibility';

const output = path.resolve(process.argv[2]);
const requireWeb = createRequire(path.resolve('apps/web/package.json'));
const make = requireWeb('pdfmake/build/pdfmake');
const fonts = requireWeb('pdfmake/build/vfs_fonts');
make.addVirtualFileSystem(fonts.pdfMake?.vfs || fonts.vfs || fonts);
const base: LaudoOptions = {
  projetoNome: 'Cadastro Ambiental Rural (CAR) — acompanhamento documental de uma propriedade com identificação extensa e dados cadastrados retroativamente',
  clienteNome: 'Cliente fictício CAR com nome longo para avaliação da interface', tipoLaudo: 'acompanhamento',
  tipoDemanda: 'CAR', dataVistoria: '2026-10-12', tecnicoResponsavel: 'Responsável fictício — exemplo de apresentação', observacoes: ''
};
const scenarios: Record<string, LaudoOptions> = {
  'Relatorio_CAR_Exemplo': { ...base,
    observacoes: 'EXEMPLO FICTÍCIO — Os documentos recebidos foram organizados para acompanhamento. Os registros deste exemplo ilustram a comunicação com o cliente e não representam uma avaliação de propriedade real.',
    documentosConsiderados: 'EXEMPLO FICTÍCIO — Relação de documentos encaminhados pelo cliente para organização do registro.',
    proximosPassos: 'EXEMPLO FICTÍCIO — Confirmar com o cliente os documentos ainda necessários e registrar o próximo encaminhamento.'
  },
  'Relatorio_CAR_Sem_Registros': { ...base, situacaoTrabalho: 'Concluído' },
  'Relatorio_CAR_Extenso': { ...base,
    clienteNome: 'Cliente fictício — Associação de proprietários '.repeat(5).slice(0, 200),
    tecnicoResponsavel: 'Responsável fictício com identificação extensa '.repeat(4).slice(0, 200),
    protocolo: 'PROTOCOLOFICTICIO'.repeat(12).slice(0, 200),
    propriedadeNome: 'Propriedade fictícia com identificação extensa '.repeat(4).slice(0, 200),
    documentosConsiderados: 'EXEMPLO FICTÍCIO — Documento de referência, origem e data informadas para este ensaio.\n'.repeat(32) + 'FIM-DOCUMENTOS',
    observacoes: 'EXEMPLO FICTÍCIO — Registro do acompanhamento documental com acentuação, identificação e encaminhamento para conferência do cliente.\n'.repeat(36) + 'FIM-REGISTROS',
    proximosPassos: 'EXEMPLO FICTÍCIO — Ação prevista e encaminhamento para consulta do cliente.\n'.repeat(36) + 'FIM-PROXIMOS-PASSOS'
  },
  'Laudo_Vistoria_Compatibilidade': { ...base, tipoLaudo: 'vistoria', observacoes: 'EXEMPLO FICTÍCIO — Constatação fornecida para testar o tipo de documento selecionado.' }
};
async function main() {
  await fs.mkdir(output, { recursive: true });
  const logoBuffer = await fs.readFile(path.join(output, 'logo-ficticio.png')).catch(() => null);
  const logo = logoBuffer ? 'data:image/png;base64,' + logoBuffer.toString('base64') : undefined;
  const compact = { ...base, projetoNome: 'CAR — registro documental fictício', clienteNome: 'Cliente fictício', tecnicoResponsavel: 'Responsável fictício' };
  scenarios.Relatorio_CAR_Com_Empresa_E_Sintese = {
    ...compact, empresa: { razao: 'Empresa fictícia — Cartografia', logo, email: 'contato@example.invalid', telefone: '(48) 0000-0000' },
    sintese: 'EXEMPLO FICTÍCIO — Documentos organizados; próximo encaminhamento a confirmar com o cliente.',
    observacoes: 'EXEMPLO FICTÍCIO — Registro documental organizado para consulta do cliente.',
    documentosConsiderados: 'EXEMPLO FICTÍCIO — Relação de documentos fornecidos para este ensaio.',
    proximosPassos: 'EXEMPLO FICTÍCIO — Confirmar o próximo encaminhamento com o cliente.',
    emissao: { codigo: 'DOC-2026-FICTICIO000000001', revisao: 1 }
  };
  scenarios.Relatorio_CAR_Empresa_Sem_Logo = { ...compact, empresa: { razao: 'Empresa fictícia sem logotipo', email: 'contato@example.invalid' }, observacoes: 'EXEMPLO FICTÍCIO — Registro sem logotipo e sem síntese.', emissao: { codigo: 'DOC-2026-FICTICIO000000002', revisao: 2 } };
  scenarios.Relatorio_CAR_Extenso.empresa = { razao: 'Empresa fictícia — Cartografia', logo };
  scenarios.Relatorio_CAR_Extenso.emissao = { codigo: 'DOC-2026-FICTICIO000000003', revisao: 1 };
  for (const [name, options] of Object.entries(scenarios)) {
    const definition = withPdfAccessibilityMetadata(createLaudoPdfDefinition(options, new Date('2026-10-12T17:10:10Z')));
    const buffer = await make.createPdf(definition).getBuffer();
    await fs.writeFile(path.join(output, `${name}.pdf`), buffer);
    console.log(`${name}: ${buffer.length} bytes`);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
