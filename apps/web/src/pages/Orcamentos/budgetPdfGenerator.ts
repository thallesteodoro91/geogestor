import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { BUDGET_STATUS_LABELS } from '@geogestor/contracts/src/budgets';
import { formatCurrency, formatDate } from './budgetForm';
import type { BudgetDetail } from './types';
import { loadPdfMake } from '../../utils/loadPdfMake';

export interface CompanyTemplate {
  logo?: string;
  razao?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cor?: string;
}

function companyTemplate(): CompanyTemplate {
  try {
    return JSON.parse(localStorage.getItem('geogestor_empresa_template') || '{}') as CompanyTemplate;
  } catch {
    return {};
  }
}

function section(title: string): Content {
  return { text: title, style: 'sectionHeader', margin: [0, 16, 0, 7] };
}

function safe(value?: string | number | null) {
  return value === null || value === undefined || value === '' ? 'Não informado' : String(value);
}

export function createProfessionalBudgetPdfDefinition(budget: BudgetDetail, company: CompanyTemplate = companyTemplate()): TDocumentDefinitions {
  const accent = company.cor || '#4f46e5';
  const itemRows: TableCell[][] = [[
    { text: 'Descrição', bold: true, color: '#ffffff', fillColor: accent },
    { text: 'Unidade', bold: true, color: '#ffffff', fillColor: accent },
    { text: 'Qtd.', bold: true, color: '#ffffff', fillColor: accent, alignment: 'right' },
    { text: 'Preço unit.', bold: true, color: '#ffffff', fillColor: accent, alignment: 'right' },
    { text: 'Total', bold: true, color: '#ffffff', fillColor: accent, alignment: 'right' }
  ]];

  budget.items.filter((item) => !item.optional).forEach((item) => {
    itemRows.push([
      { text: item.description, color: '#27272a' },
      { text: item.unit, color: '#52525b' },
      { text: item.quantity, alignment: 'right', color: '#52525b' },
      { text: formatCurrency(item.unitPriceCents), alignment: 'right', color: '#52525b' },
      { text: formatCurrency(item.totalCents), alignment: 'right', bold: true, color: '#27272a' }
    ]);
  });
  const optionalRows: TableCell[][] = [[
    { text: 'Item opcional', bold: true, color: '#ffffff', fillColor: accent },
    { text: 'Unidade', bold: true, color: '#ffffff', fillColor: accent },
    { text: 'Qtd.', bold: true, color: '#ffffff', fillColor: accent, alignment: 'right' },
    { text: 'Preço unit.', bold: true, color: '#ffffff', fillColor: accent, alignment: 'right' },
    { text: 'Adicional', bold: true, color: '#ffffff', fillColor: accent, alignment: 'right' }
  ]];
  budget.items.filter((item) => item.optional).forEach((item) => {
    optionalRows.push([
      { text: item.description, color: '#27272a' },
      { text: item.unit, color: '#52525b' },
      { text: item.quantity, alignment: 'right', color: '#52525b' },
      { text: formatCurrency(item.unitPriceCents), alignment: 'right', color: '#52525b' },
      { text: formatCurrency(item.totalCents), alignment: 'right', bold: true, color: '#27272a' }
    ]);
  });

  const taxes = budget.taxes.length
    ? budget.taxes.map((tax) => `${tax.acronym} (${tax.ratePercent}%): ${formatCurrency(tax.amountCents)}${tax.includedInPrice ? ' — incluso no preço' : ' — adicionado por fora'}`).join('\n')
    : 'Sem tributos destacados nesta proposta.';
  const installments = budget.payment?.installments?.length
    ? budget.payment.installments.map((installment, index) => {
        const due = installment.dueDate
          ? `vencimento em ${formatDate(installment.dueDate)}`
          : `${installment.daysAfterApproval || 0} dia(s) após a aprovação`;
        const amount = installment.percentage ? `${installment.percentage}%` : formatCurrency(installment.valueCents || 0);
        return `${index + 1}. ${installment.label || `Parcela ${index + 1}`}: ${amount}, ${due}`;
      }).join('\n')
    : 'Condição de pagamento não informada.';
  const characterization = budget.characterization || {};

  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            ...(company.logo ? [{ image: company.logo, width: 105, margin: [0, 0, 0, 8] } as Content] : []),
            { text: company.razao || 'GeoGestor — Serviços técnicos', fontSize: 15, bold: true, color: '#18181b' },
            { text: [company.cnpj, company.telefone, company.email, company.endereco].filter(Boolean).join(' • '), fontSize: 8, color: '#71717a', margin: [0, 3, 0, 0] }
          ]
        },
        {
          width: 180,
          alignment: 'right',
          stack: [
            { text: 'PROPOSTA COMERCIAL', fontSize: 14, bold: true, color: accent },
            { text: `${budget.codigoOrcamento || 'Rascunho'} • versão ${budget.versao}`, bold: true, margin: [0, 5, 0, 0] },
            { text: `Emissão: ${formatDate(budget.dataEmissao)}`, fontSize: 9, color: '#52525b', margin: [0, 2, 0, 0] },
            { text: `Validade: ${formatDate(budget.validadeAte)}`, fontSize: 9, color: '#52525b' },
            { text: BUDGET_STATUS_LABELS[budget.status], fontSize: 8, bold: true, color: '#ffffff', background: accent, margin: [0, 6, 0, 0] }
          ]
        }
      ]
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: accent }], margin: [0, 14, 0, 10] },
    section('CLIENTE'),
    {
      table: {
        widths: [120, '*'],
        body: [
          [{ text: 'Nome / razão social', bold: true }, safe(budget.clientName)],
          [{ text: 'CPF / CNPJ', bold: true }, safe(budget.clientDocument)],
          [{ text: 'Contato', bold: true }, [budget.clientPhone, budget.clientEmail].filter(Boolean).join(' • ') || 'Não informado']
        ]
      },
      layout: 'lightHorizontalLines'
    },
    section('IMÓVEL E SERVIÇO'),
    {
      table: {
        widths: [120, '*'],
        body: [
          [{ text: 'Serviço', bold: true }, safe(budget.servicoTipo)],
          [{ text: 'Imóvel', bold: true }, `${safe(budget.imovelNome)} • ${budget.imovelTipo === 'rural' ? 'Rural' : budget.imovelTipo === 'urbano' ? 'Urbano' : 'Não classificado'}`],
          [{ text: 'Localização', bold: true }, [budget.municipio, budget.uf].filter(Boolean).join(' / ') || 'Não informada'],
          [{ text: 'Área estimada', bold: true }, `${safe(characterization.estimatedArea as string)} ${safe(characterization.areaUnit as string)}`],
          [{ text: 'Matrícula', bold: true }, safe(characterization.record as string)],
          [{ text: 'Método', bold: true }, safe(characterization.surveyMethod as string)],
          [{ text: 'Pontos de apoio / marcos físicos', bold: true }, safe(characterization.physicalGroundControl as string)],
          [{ text: 'Estação base eletrônica GNSS', bold: true }, safe(characterization.gnssElectronicBase as string)]
        ]
      },
      layout: 'lightHorizontalLines'
    },
    section('ESCOPO, METODOLOGIA E ENTREGÁVEIS'),
    { text: budget.descricao || 'Escopo não informado.', bold: true, color: '#27272a' },
    { text: budget.metodologia || 'Metodologia a detalhar conforme as condições técnicas do serviço.', color: '#52525b', margin: [0, 5, 0, 0] },
    { text: budget.entregaveis || 'Entregáveis conforme itens desta proposta.', color: '#52525b', margin: [0, 5, 0, 0] },
    { text: `Prazo previsto: ${budget.prazoExecucaoDias ?? 'não informado'} dia(s), contado conforme as condições comerciais.`, color: '#52525b', margin: [0, 5, 0, 0] },
    section('ITENS E INVESTIMENTO'),
    {
      table: { headerRows: 1, widths: ['*', 70, 42, 82, 82], body: itemRows },
      layout: {
        hLineColor: () => '#e4e4e7',
        vLineColor: () => '#e4e4e7',
        paddingTop: () => 6,
        paddingBottom: () => 6
      }
    },
    ...(optionalRows.length > 1 ? [
      section('ITENS OPCIONAIS — NÃO INCLUÍDOS NO INVESTIMENTO TOTAL'),
      {
        table: { headerRows: 1, widths: ['*', 70, 42, 82, 82], body: optionalRows },
        layout: 'lightHorizontalLines'
      } as Content
    ] : []),
    {
      table: {
        widths: ['*', 150],
        body: [
          [{ text: 'Despesas reembolsáveis', alignment: 'right', color: '#52525b' }, { text: formatCurrency(budget.valorReembolsavel), alignment: 'right' }],
          [{ text: 'Taxas repassadas', alignment: 'right', color: '#52525b' }, { text: formatCurrency(budget.subtotalTaxas), alignment: 'right' }],
          [{ text: 'Impostos previstos', alignment: 'right', color: '#52525b' }, { text: formatCurrency(budget.impostosPrevistos), alignment: 'right' }],
          [{ text: 'INVESTIMENTO TOTAL', alignment: 'right', bold: true, fontSize: 11 }, { text: formatCurrency(budget.valorTotal), alignment: 'right', bold: true, fontSize: 12, color: accent }]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 8, 0, 0]
    },
    {
      stack: [section('TRIBUTOS'), { text: taxes, color: '#52525b' }],
      unbreakable: true
    },
    {
      stack: [
        section('CONDIÇÕES DE PAGAMENTO'),
        { text: budget.payment?.description || budget.payment?.type || 'Não informada', bold: true },
        { text: installments, color: '#52525b', margin: [0, 4, 0, 0] }
      ],
      unbreakable: true
    },
    {
      stack: [
        section('OBSERVAÇÕES E TERMOS'),
        { text: budget.observacoesCliente || 'Sem observações adicionais.', color: '#52525b' }
      ],
      unbreakable: true
    },
    { text: budget.termosCondicoes || 'Termos não informados.', color: '#52525b', margin: [0, 8, 0, 0] },
    {
      columns: [
        { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 1 }] }, { text: safe(budget.responsavelTecnico), alignment: 'center', margin: [0, 7, 0, 0], bold: true }, { text: 'Responsável técnico', alignment: 'center', fontSize: 8, color: '#71717a' }] },
        { width: 40, text: '' },
        { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 1 }] }, { text: safe(budget.clientName), alignment: 'center', margin: [0, 7, 0, 0], bold: true }, { text: 'De acordo — cliente', alignment: 'center', fontSize: 8, color: '#71717a' }] }
      ],
      margin: [0, 42, 0, 0],
      unbreakable: true
    }
  ];

  const definition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 42, 40, 55],
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: company.razao || 'GeoGestor', margin: [40, 18, 0, 0], fontSize: 8, color: '#a1a1aa' },
        { text: `${budget.codigoOrcamento || 'Rascunho'} v${budget.versao} • página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 18, 40, 0], fontSize: 8, color: '#a1a1aa' }
      ]
    }),
    styles: {
      sectionHeader: { fontSize: 9, bold: true, color: accent, characterSpacing: 0.7 }
    },
    defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.3 }
  };

  return definition;
}

export function professionalBudgetPdfFileName(budget: BudgetDetail) {
  const fileName = `${budget.codigoOrcamento || 'Orcamento'}_v${budget.versao}_${budget.clientName || 'Cliente'}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${fileName}.pdf`;
}

export async function generateProfessionalBudgetPdf(budget: BudgetDetail) {
  const make = await loadPdfMake();
  make.createPdf(createProfessionalBudgetPdfDefinition(budget)).download(professionalBudgetPdfFileName(budget));
}
