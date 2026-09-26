import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { BUDGET_STATUS_LABELS, calculateBudget, type AdjustmentType, type BudgetStatus } from '@geogestor/contracts/src/budgets';
import { formatBasisPoints, formatCurrency, formatDate } from './budgetForm';
import type { BudgetDetail } from './types';
import { loadPdfMake } from '../../utils/loadPdfMake';
import { getCachedCompanyTemplate, type CompanyTemplate } from '../../services/companyTemplate';
import { accessibleAccentOnWhite, documentTextColorForBackground } from '../../utils/documentContrast';

export type { CompanyTemplate } from '../../services/companyTemplate';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  avista: 'À vista',
  entrada_saldo: 'Entrada + saldo',
  etapas: 'Por etapas',
  parcelas: 'Parcelado'
};

const DOCUMENT_WATERMARKS: Partial<Record<BudgetStatus, string>> = {
  rascunho: 'RASCUNHO — NÃO ENVIAR',
  rejeitado: 'REJEITADO',
  expirado: 'EXPIRADO',
  cancelado: 'CANCELADO',
  substituido: 'SUBSTITUÍDO'
};

function section(title: string): Content {
  return { text: title, style: 'sectionHeader', margin: [0, 15, 0, 7] };
}

function safe(value?: string | number | null) {
  return value === null || value === undefined || value === '' ? 'Não informado' : String(value);
}

function formatPercent(value: string | number) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0)}%`;
}

function formatAdjustmentLine(label: string, type: AdjustmentType, configuredValue: string, amountCents: number, sign: '−' | '+') {
  const configured = type === 'percentual' ? ` (${formatPercent(configuredValue)})` : '';
  return `${label}: ${sign} ${formatCurrency(Math.abs(amountCents))}${configured}`;
}

function paymentTypeLabel(type?: string | null) {
  if (!type) return 'Não informada';
  return PAYMENT_TYPE_LABELS[type] || type.replaceAll('_', ' ').replace(/^./, (character) => character.toLocaleUpperCase('pt-BR'));
}

function buildStatusWatermark(status: BudgetStatus) {
  const text = DOCUMENT_WATERMARKS[status];
  return text ? { text, color: '#475569', opacity: 0.09, bold: true, angle: -35, fontSize: 64 } : undefined;
}

export function createProfessionalBudgetPdfDefinition(budget: BudgetDetail, company: Partial<CompanyTemplate> = getCachedCompanyTemplate()): TDocumentDefinitions {
  const accent = company.cor || '#4f46e5';
  const accentText = documentTextColorForBackground(accent);
  const accessibleAccent = accessibleAccentOnWhite(accent);
  const calculation = calculateBudget({
    items: budget.items,
    costs: budget.costs,
    taxes: budget.taxes,
    globalDiscount: { type: budget.descontoGlobalTipo || 'fixo', value: budget.descontoGlobalValor || '0' },
    globalAddition: { type: budget.acrescimoGlobalTipo || 'fixo', value: budget.acrescimoGlobalValor || '0' }
  });

  const tableHeader = (label: string, alignment?: 'left' | 'right') => ({
    text: label,
    bold: true,
    color: accentText,
    fillColor: accent,
    alignment
  } satisfies TableCell);
  const itemRows: TableCell[][] = [[
    tableHeader('Descrição'),
    tableHeader('Qtd. / unidade', 'right'),
    tableHeader('Subtotal', 'right'),
    tableHeader('Ajustes', 'right'),
    tableHeader('Total', 'right')
  ]];
  const optionalRows: TableCell[][] = [
    [
      { text: 'ITENS OPCIONAIS — NÃO INCLUÍDOS NO INVESTIMENTO TOTAL', colSpan: 5, bold: true, color: accessibleAccent, margin: [0, 4, 0, 4] },
      {}, {}, {}, {}
    ],
    [
      tableHeader('Item opcional'),
      tableHeader('Qtd. / unidade', 'right'),
      tableHeader('Subtotal', 'right'),
      tableHeader('Ajustes', 'right'),
      tableHeader('Adicional', 'right')
    ]
  ];

  calculation.items.forEach((item) => {
    const adjustments = [
      item.discountCents > 0 ? formatAdjustmentLine('Desconto', item.discount.type, item.discount.value, item.discountCents, '−') : '',
      item.additionCents > 0 ? formatAdjustmentLine('Acréscimo', item.addition.type, item.addition.value, item.additionCents, '+') : ''
    ].filter(Boolean).join('\n') || '—';
    const row: TableCell[] = [
      { text: item.description, color: '#27272a' },
      { text: `${item.quantity} ${item.unit}\n${formatCurrency(item.unitPriceCents)}/un.`, alignment: 'right', color: '#52525b', fontSize: 8.5 },
      { text: formatCurrency(item.subtotalCents), alignment: 'right', color: '#52525b' },
      { text: adjustments, alignment: 'right', color: '#52525b', fontSize: 8 },
      { text: formatCurrency(item.totalCents), alignment: 'right', bold: true, color: '#27272a' }
    ];
    (item.optional ? optionalRows : itemRows).push(row);
  });

  const taxes = budget.taxes.length
    ? budget.taxes.map((tax) => `${tax.acronym} (${formatPercent(tax.ratePercent)}): ${formatCurrency(tax.amountCents)}${tax.includedInPrice ? ' — incluso no preço' : ' — cobrado por fora'}`).join('\n')
    : 'Sem tributos destacados nesta proposta.';
  const installments = budget.payment?.installments?.length
    ? budget.payment.installments.map((installment, index) => {
        const due = installment.dueDate ? `vencimento em ${formatDate(installment.dueDate)}` : `${installment.daysAfterApproval || 0} dia(s) após a aprovação`;
        const amount = installment.percentage ? formatPercent(installment.percentage) : formatCurrency(installment.valueCents || 0);
        return `${index + 1}. ${installment.label || `Parcela ${index + 1}`}: ${amount}, ${due}`;
      }).join('\n')
    : 'Condição de pagamento não informada.';
  const paymentConditions = [
    `Forma: ${paymentTypeLabel(budget.payment?.type)}`,
    budget.payment?.paymentMethod ? `Meio de pagamento: ${budget.payment.paymentMethod}` : '',
    budget.payment?.description ? `Condição: ${budget.payment.description}` : '',
    (budget.payment?.interestBasisPoints || 0) > 0 ? `Juros: ${formatBasisPoints(budget.payment?.interestBasisPoints)}` : '',
    (budget.payment?.fineBasisPoints || 0) > 0 ? `Multa: ${formatBasisPoints(budget.payment?.fineBasisPoints)}` : '',
    (budget.payment?.earlyDiscountBasisPoints || 0) > 0 ? `Desconto por antecipação: ${formatBasisPoints(budget.payment?.earlyDiscountBasisPoints)}` : ''
  ].filter(Boolean).join('\n');
  const characterization = budget.characterization || {};
  const billableSubtotal = calculation.subtotalServicesCents + calculation.subtotalExpensesCents + calculation.subtotalFeesCents;
  const summaryRows: TableCell[][] = [[
    { text: 'Subtotal faturável', alignment: 'right', color: '#52525b' },
    { text: formatCurrency(billableSubtotal), alignment: 'right' }
  ]];
  if (calculation.reimbursableCents > 0) summaryRows.push([
    { text: '↳ Despesas reembolsáveis incluídas', alignment: 'right', color: '#71717a', fontSize: 8 },
    { text: formatCurrency(calculation.reimbursableCents), alignment: 'right', color: '#71717a', fontSize: 8 }
  ]);
  if (calculation.subtotalFeesCents > 0) summaryRows.push([
    { text: '↳ Taxas repassadas incluídas', alignment: 'right', color: '#71717a', fontSize: 8 },
    { text: formatCurrency(calculation.subtotalFeesCents), alignment: 'right', color: '#71717a', fontSize: 8 }
  ]);
  if (calculation.globalDiscountCents > 0) summaryRows.push([
    { text: 'Desconto global', alignment: 'right', color: '#52525b' },
    { text: `− ${formatCurrency(calculation.globalDiscountCents)}`, alignment: 'right' }
  ]);
  if (calculation.globalAdditionCents > 0) summaryRows.push([
    { text: 'Acréscimo global', alignment: 'right', color: '#52525b' },
    { text: `+ ${formatCurrency(calculation.globalAdditionCents)}`, alignment: 'right' }
  ]);
  if (calculation.outsideTaxesCents > 0) summaryRows.push([
    { text: 'Impostos cobrados por fora', alignment: 'right', color: '#52525b' },
    { text: `+ ${formatCurrency(calculation.outsideTaxesCents)}`, alignment: 'right' }
  ]);
  summaryRows.push([
    { text: 'INVESTIMENTO TOTAL', alignment: 'right', bold: true, fontSize: 11 },
    { text: formatCurrency(budget.valorTotal), alignment: 'right', bold: true, fontSize: 12, color: accessibleAccent }
  ]);

  const professionalRegistration = [company.conselhoProfissional, company.registroProfissional].filter(Boolean).join(' ');
  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            ...(company.logo ? [{ image: company.logo, width: 105, margin: [0, 0, 0, 8] } as Content] : []),
            { text: company.razao || 'GeoGestor — Serviços técnicos', fontSize: 15, bold: true, color: '#18181b' },
            { text: [company.cnpj, company.telefone, company.email, company.endereco].filter(Boolean).join(' • '), fontSize: 8, color: '#52525b', margin: [0, 3, 0, 0] }
          ]
        },
        {
          width: 180,
          alignment: 'right',
          stack: [
            { text: 'PROPOSTA COMERCIAL', fontSize: 14, bold: true, color: accessibleAccent },
            { text: `${budget.codigoOrcamento || 'Rascunho'} • versão ${budget.versao}`, bold: true, margin: [0, 5, 0, 0] },
            { text: `Emissão: ${formatDate(budget.dataEmissao)}`, fontSize: 9, color: '#52525b', margin: [0, 2, 0, 0] },
            { text: `Validade: ${formatDate(budget.validadeAte)}`, fontSize: 9, color: '#52525b' },
            { text: BUDGET_STATUS_LABELS[budget.status], fontSize: 8, bold: true, color: accentText, background: accent, margin: [0, 6, 0, 0] }
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
      table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: ['*', 68, 72, 88, 76], body: itemRows },
      layout: {
        hLineColor: () => '#e4e4e7',
        vLineColor: () => '#e4e4e7',
        paddingTop: () => 6,
        paddingBottom: () => 6,
        paddingLeft: () => 5,
        paddingRight: () => 5
      }
    },
    ...(optionalRows.length > 2 ? [
      {
        table: { headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, widths: ['*', 68, 72, 88, 76], body: optionalRows },
        layout: 'lightHorizontalLines',
        margin: [0, 8, 0, 0]
      } as Content
    ] : []),
    { table: { widths: ['*', 150], body: summaryRows }, layout: 'lightHorizontalLines', margin: [0, 8, 0, 0] },
    { stack: [section('TRIBUTOS'), { text: taxes, color: '#52525b' }], unbreakable: true },
    {
      stack: [
        section('CONDIÇÕES DE PAGAMENTO'),
        { text: paymentConditions, bold: true },
        { text: installments, color: '#52525b', margin: [0, 4, 0, 0] }
      ],
      unbreakable: true
    },
    { stack: [section('OBSERVAÇÕES AO CLIENTE'), { text: budget.observacoesCliente || 'Sem observações adicionais.', color: '#52525b' }], unbreakable: true },
    section('TERMOS E CONDIÇÕES'),
    { text: budget.termosCondicoes || 'Termos não informados.', color: '#52525b' },
    {
      stack: [
        section('ACEITE DA PROPOSTA'),
        { text: 'Ao assinar, as partes declaram ciência e concordância com o escopo, o investimento e as condições apresentados neste documento.', color: '#52525b' },
        {
          table: {
            widths: [92, '*'],
            body: [
              [{ text: 'Proposta', bold: true }, `${budget.codigoOrcamento || 'Rascunho'} • versão ${budget.versao}`],
              [{ text: 'Cliente', bold: true }, safe(budget.clientName)],
              [{ text: 'Objeto', bold: true }, safe(budget.servicoTipo || budget.descricao)],
              [{ text: 'Investimento', bold: true }, { text: formatCurrency(budget.valorTotal), bold: true, color: accessibleAccent }],
              [{ text: 'Validade', bold: true }, formatDate(budget.validadeAte)]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 12, 0, 0]
        },
        { text: 'Local e data: _______________________________________________________________', color: '#52525b', margin: [0, 18, 0, 0] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 1 }] },
                { text: safe(budget.responsavelTecnico), alignment: 'center', margin: [0, 7, 0, 0], bold: true },
                { text: professionalRegistration || 'Responsável técnico', alignment: 'center', fontSize: 8, color: '#52525b' },
                ...(professionalRegistration ? [{ text: 'Responsável técnico', alignment: 'center', fontSize: 8, color: '#71717a' } as Content] : [])
              ]
            },
            { width: 40, text: '' },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 1 }] }, { text: safe(budget.clientName), alignment: 'center', margin: [0, 7, 0, 0], bold: true }, { text: 'De acordo — cliente', alignment: 'center', fontSize: 8, color: '#71717a' }] }
          ],
          margin: [0, 26, 0, 0]
        }
      ],
      unbreakable: true
    }
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 42, 40, 55],
    content,
    watermark: buildStatusWatermark(budget.status),
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: company.razao || 'GeoGestor', margin: [40, 18, 0, 0], fontSize: 8, color: '#71717a' },
        { text: `${budget.codigoOrcamento || 'Rascunho'} v${budget.versao} • ${BUDGET_STATUS_LABELS[budget.status]} • página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 18, 40, 0], fontSize: 8, color: '#71717a' }
      ]
    }),
    styles: { sectionHeader: { fontSize: 9, bold: true, color: accessibleAccent, characterSpacing: 0.7 } },
    defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.3 }
  };
}

export function professionalBudgetPdfFileName(budget: BudgetDetail) {
  const fileName = `${budget.codigoOrcamento || 'Orcamento'}_v${budget.versao}_${budget.clientName || 'Cliente'}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${fileName}.pdf`;
}

export async function generateProfessionalBudgetPdf(budget: BudgetDetail) {
  const make = await loadPdfMake();
  await downloadProfessionalBudgetPdf(
    make,
    createProfessionalBudgetPdfDefinition(budget),
    professionalBudgetPdfFileName(budget)
  );
}

export async function downloadProfessionalBudgetPdf(
  make: { createPdf: (definition: TDocumentDefinitions) => { download: (fileName?: string) => void | Promise<void> } },
  definition: TDocumentDefinitions,
  fileName: string
) {
  await make.createPdf(definition).download(fileName);
}
