import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pdfMake from 'pdfmake/build/pdfmake';
import {
  createProfessionalBudgetPdfDefinition,
  professionalBudgetPdfFileName
} from '../../apps/web/src/pages/Orcamentos/budgetPdfGenerator';
import type { BudgetDetail } from '../../apps/web/src/pages/Orcamentos/types';

const outputDirectory = resolve(process.argv[2] || 'scratch/pdf-orcamentos');

const items = Array.from({ length: 34 }, (_, index) => {
  const number = index + 1;
  const optional = number % 6 === 0;
  const unitPriceCents = optional ? 42_500 : 18_750 + number * 1_250;
  return {
    id: `pdf-item-${number}`,
    description: `${number.toString().padStart(2, '0')} — ${optional ? 'Serviço opcional' : 'Etapa técnica'} de levantamento, processamento e controle de qualidade com descrição extensa para validar a quebra segura das linhas da tabela`,
    unit: optional ? 'opção' : 'etapa',
    quantity: '1',
    unitCostCents: 0,
    unitPriceCents,
    discount: { type: 'fixo' as const, value: '0' },
    addition: { type: 'fixo' as const, value: '0' },
    taxable: false,
    component: 'servico' as const,
    optional,
    totalCents: unitPriceCents
  };
});

const requiredTotal = items
  .filter((item) => !item.optional)
  .reduce((total, item) => total + item.totalCents, 0);

const budget = {
  id: 'pdf-long-budget',
  grupoId: 'pdf-long-group',
  versao: 3,
  codigoOrcamento: 'ORC-2026-TESTE-LONGO',
  status: 'emitido',
  descricao: 'Levantamento planialtimétrico cadastral completo para regularização fundiária, definição de limites, apoio ao projeto executivo e composição de base cartográfica.',
  anotacoes: 'CONTEUDO_INTERNO_NAO_DEVE_APARECER',
  observacoesCliente: 'O acesso às áreas deverá ser previamente autorizado. Interferências, vegetação densa e condições meteorológicas poderão exigir reprogramação justificada das atividades de campo.',
  termosCondicoes: `${'Esta proposta considera mobilização, levantamento, processamento, controle de qualidade e entrega digital. Alterações de escopo serão formalizadas antes da execução. '.repeat(18)}Fim dos termos comerciais.`,
  dataEmissao: '2026-07-19',
  validadeAte: '2026-08-18',
  responsavelTecnico: 'Thalles Wesley Teodoro',
  servicoTipo: 'Levantamento planialtimétrico cadastral',
  imovelTipo: 'rural',
  imovelNome: 'Fazenda Horizonte — Gleba de validação extensa',
  municipio: 'Florianópolis',
  uf: 'SC',
  metodologia: `${'Levantamento executado com receptores GNSS RTK, implantação de pontos de apoio físico no solo e estação base eletrônica independente, seguido de ajustamento, conferência e controle de qualidade. '.repeat(12)}Encerramento metodológico.`,
  entregaveis: `${'Planta técnica, memorial descritivo, relatório de processamento, arquivos vetoriais e relatório fotográfico. '.repeat(10)}Pacote final assinado digitalmente.`,
  prazoExecucaoDias: 35,
  clienteId: 'pdf-client',
  clientId: 'pdf-client',
  clientName: 'Cliente de Validação PDF — Conteúdo Extenso',
  clientDocument: '12.345.678/0001-90',
  clientEmail: 'cliente.pdf@skygeo.local',
  clientPhone: '(48) 99999-0000',
  characterization: {
    estimatedArea: '248,75',
    areaUnit: 'ha',
    record: 'Matrícula 12.345',
    surveyMethod: 'GNSS RTK e estação total',
    physicalGroundControl: 'Marcos M-01 a M-08 materializados no terreno',
    gnssElectronicBase: 'Receptor GNSS base instalado em ponto estável independente'
  },
  subtotalServicos: requiredTotal,
  subtotalDespesas: 0,
  subtotalTaxas: 0,
  impostosPrevistos: 0,
  valorReembolsavel: 0,
  valorTotal: requiredTotal,
  items,
  costs: [{
    id: 'internal-cost',
    category: 'Interno',
    description: 'CUSTO_INTERNO_NAO_DEVE_APARECER',
    amountCents: 100_000,
    classification: 'custo_proprio',
    taxable: false
  }],
  taxes: [],
  payment: {
    type: 'parcelas',
    description: 'Entrada, mobilização, conclusão de campo e entrega final',
    installments: [
      { percentage: '25', daysAfterApproval: 0, label: 'Entrada' },
      { percentage: '25', daysAfterApproval: 10, label: 'Mobilização' },
      { percentage: '25', daysAfterApproval: 25, label: 'Conclusão de campo' },
      { percentage: '25', daysAfterApproval: 35, label: 'Entrega final' }
    ],
    interestBasisPoints: 0,
    fineBasisPoints: 0,
    earlyDiscountBasisPoints: 0
  },
  history: [],
  versions: [],
  installments: []
} as BudgetDetail;

mkdirSync(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, professionalBudgetPdfFileName(budget));
const definition = createProfessionalBudgetPdfDefinition(budget, {
  razao: 'SkyGeo Topografia e Cartografia',
  cnpj: '12.345.678/0001-90',
  telefone: '(48) 3333-0000',
  email: 'contato@skygeo.local',
  endereco: 'Florianópolis — SC',
  cor: '#0891b2'
});

async function main() {
  const buffer = await pdfMake.createPdf(definition).getBuffer();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(buffer));

  process.stdout.write(`${outputPath}\n`);
}

void main();
