import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { BUDGET_STATUS_LABELS, calculateBudget, type AdjustmentType, type BudgetStatus } from '@geogestor/contracts/src/budgets';
import { formatCurrency, formatDate, formatQuantity } from './budgetForm';
import { commercialRows, installmentTexts, scopeDescription } from './budgetPresentation';
import type { BudgetDetail } from './types';
import { loadPdfMake } from '../../utils/loadPdfMake';
import { getCachedCompanyTemplate, loadCompanyTemplate, type CompanyTemplate } from '../../services/companyTemplate';
import { apiClient } from '../../services/apiClient';
import { accessibleAccentOnWhite, documentTextColorForBackground } from '../../utils/documentContrast';

export type { CompanyTemplate } from '../../services/companyTemplate';

export function budgetPdfErrorMessage(error: unknown, operation: 'save' | 'open' = 'save') {
  const message = error instanceof Error ? error.message : '';
  // Electron may prefix a safe native message with IPC implementation details.
  const safeMessage = message.match(/(?:Não foi possível salvar o orçamento\.|O PDF foi salvo, mas não pôde ser aberto\.|Selecione um destino válido para o orçamento\.|Salve o orçamento com a extensão \.pdf\.|O arquivo do orçamento é inválido\.)[^\n]*/)?.[0];
  return safeMessage || (operation === 'open'
    ? 'O PDF foi salvo, mas não pôde ser aberto. Confira se você possui um leitor de PDF instalado e tente novamente.'
    : 'Não foi possível gerar o PDF. Reabra o orçamento e tente novamente. Se o problema continuar, confira as configurações da empresa.');
}

const DOCUMENT_WATERMARKS: Partial<Record<BudgetStatus, string>> = {
  rascunho: 'RASCUNHO — NÃO ENVIAR',
  rejeitado: 'REJEITADO',
  expirado: 'EXPIRADO',
  cancelado: 'CANCELADO',
  substituido: 'SUBSTITUÍDO'
};

function section(title: string): Content {
  return { id: `section-${title}`, text: title, style: 'sectionHeader', headlineLevel: 1, margin: [0, 15, 0, 7] };
}

function safe(value?: string | number | null) {
  return value === null || value === undefined || value === '' ? 'Não informado' : String(value);
}

function formatPercent(value: string | number) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(Number.isFinite(numeric) ? numeric : 0)}%`;
}

function formatAdjustmentLine(label: string, type: AdjustmentType, configuredValue: string, amountCents: number, sign: '−' | '+') {
  const configured = type === 'percentual' ? ` (${formatPercent(configuredValue)})` : '';
  return `${label}: ${sign} ${formatCurrency(Math.abs(amountCents))}${configured}`;
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
  const detailTableLayout: CustomTableLayout = {
    hLineWidth: (index, node) => index === 0 || index === node.table.body.length ? 0 : 0.5,
    vLineWidth: () => 0,
    hLineColor: () => '#a1a1aa',
    paddingTop: () => 3,
    paddingBottom: () => 3
  };
  const itemTableLayout: CustomTableLayout = {
    // The caption is page furniture, not a cell in the ruled grid.
    hLineWidth: (index) => index < 2 ? 0 : index === 2 ? 0.75 : 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => '#71717a',
    // Gray rules disappear against some corporate header colors.
    vLineColor: (_index, _node, row) => row === 1 ? accentText : '#71717a',
    paddingTop: () => 6,
    paddingBottom: () => 6,
    paddingLeft: () => 5,
    paddingRight: () => 5
  };
  // Keep ordinary rows together. Large or multiline descriptions must be
  // allowed to flow, because pdfmake discards an unbreakable oversized row.
  const hasLongRows = (optional: boolean) => calculation.items.some((item) => Boolean(item.optional) === optional
    && (item.description.length > 500 || item.description.split('\n').length > 12));
  const itemRows: TableCell[][] = [[
    { text: 'ITENS E INVESTIMENTO', colSpan: 5, style: 'sectionHeader', border: [false, false, false, false], margin: [0, 5, 0, 1] }, {}, {}, {}, {}
  ], [
    tableHeader('Descrição'),
    tableHeader('Qtd. / unidade', 'right'),
    tableHeader('Subtotal', 'right'),
    tableHeader('Ajustes', 'right'),
    tableHeader('Total', 'right')
  ]];
  const optionalRows: TableCell[][] = [
    [
      { text: 'ITENS OPCIONAIS — NÃO INCLUÍDOS NO INVESTIMENTO TOTAL', colSpan: 5, bold: true, color: accessibleAccent, border: [false, false, false, false], margin: [0, 4, 0, 4] },
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
      { text: `${formatQuantity(item.quantity)} ${item.unit}\n${formatCurrency(item.unitPriceCents)}/un.`, alignment: 'right', color: '#52525b', fontSize: 8.5 },
      { text: formatCurrency(item.subtotalCents), alignment: 'right', color: '#52525b' },
      { text: adjustments, alignment: 'right', color: '#52525b', fontSize: 8 },
      { text: formatCurrency(item.totalCents), alignment: 'right', bold: true, color: '#27272a' }
    ];
    (item.optional ? optionalRows : itemRows).push(row);
  });

  const taxes = budget.taxes.length
    ? budget.taxes.map((tax) => `${tax.acronym} (${formatPercent(tax.ratePercent)}): ${formatCurrency(tax.amountCents)}${tax.includedInPrice ? ' — incluso no preço' : ' — cobrado por fora'}`).join('\n')
    : 'Sem tributos destacados nesta proposta.';
  const characterization = budget.characterization || {};
  const billableSubtotal = (budget.subtotalServicos ?? calculation.subtotalServicesCents)
    + (budget.subtotalDespesas ?? calculation.subtotalExpensesCents)
    + (budget.subtotalTaxas ?? calculation.subtotalFeesCents);
  const globalDiscountCents = budget.desconto ?? calculation.globalDiscountCents;
  const summaryRows: TableCell[][] = [[
    { text: 'Subtotal faturável', alignment: 'right', color: '#52525b' },
    { text: formatCurrency(billableSubtotal), alignment: 'right' }
  ]];
  if (calculation.reimbursableCents > 0) summaryRows.push([
    { text: 'Despesas reembolsáveis incluídas', alignment: 'right', color: '#71717a', fontSize: 8 },
    { text: formatCurrency(calculation.reimbursableCents), alignment: 'right', color: '#71717a', fontSize: 8 }
  ]);
  if (calculation.subtotalFeesCents > 0) summaryRows.push([
    { text: 'Taxas repassadas incluídas', alignment: 'right', color: '#71717a', fontSize: 8 },
    { text: formatCurrency(calculation.subtotalFeesCents), alignment: 'right', color: '#71717a', fontSize: 8 }
  ]);
  if (globalDiscountCents > 0) summaryRows.push([
    { text: 'Desconto global', alignment: 'right', color: '#52525b' },
    { text: `− ${formatCurrency(globalDiscountCents)}`, alignment: 'right' }
  ]);
  if (calculation.globalAdditionCents > 0) summaryRows.push([
    { text: 'Acréscimo global', alignment: 'right', color: '#52525b' },
    { text: `+ ${formatCurrency(calculation.globalAdditionCents)}`, alignment: 'right' }
  ]);
  const outsideTaxesCents = budget.taxes.filter((tax) => !tax.includedInPrice).reduce((sum, tax) => sum + tax.amountCents, 0);
  if (outsideTaxesCents > 0) summaryRows.push([
    { text: 'Impostos cobrados por fora', alignment: 'right', color: '#52525b' },
    { text: `+ ${formatCurrency(outsideTaxesCents)}`, alignment: 'right' }
  ]);
  summaryRows.push([
    { text: 'Total da composição', alignment: 'right', bold: true, fontSize: 11 },
    { text: formatCurrency(budget.valorTotal), alignment: 'right', bold: true, fontSize: 12, color: accessibleAccent }
  ]);

  const professionalRegistration = [company.conselhoProfissional, company.registroProfissional].filter(Boolean).join(' ');
  const optionalPropertyRows: TableCell[][] = [
    ['Área estimada', characterization.estimatedArea != null && String(characterization.estimatedArea).trim() !== '' ? [characterization.estimatedArea, characterization.areaUnit].filter(value => value != null && value !== '').join(' ').replace(/(\d)\.(?=\d)/g, '$1,') : ''],
    ['Matrícula', characterization.record],
    ['Método', characterization.surveyMethod],
    ['Pontos de apoio / marcos físicos', characterization.physicalGroundControl],
    ['Estação base eletrônica GNSS', characterization.gnssElectronicBase]
  ].filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([label, value]) => [{ text: String(label), bold: true }, String(value)]);
  const technicalGroups: { rows: TableCell[][]; headerRows: number; long: boolean }[] = [];
  const technicalCaption: TableCell = { text: 'DETALHAMENTO TÉCNICO', bold: true, color: '#27272a', characterSpacing: 0.7, fontSize: 9 };
  const technicalAccent = accessibleAccentOnWhite(accent, 5);
  const technicalSection = (title: string, body: Content, sourceText: string) => {
    const long = sourceText.length > 500 || sourceText.split('\n').length > 12;
    if (long) {
      // A long subsection repeats its own title with the frame caption.
      // Its text remains breakable, without guessing heights or truncating it.
      technicalGroups.push({ rows: [[{ ...technicalCaption }], [{ text: title, style: 'sectionHeader', color: technicalAccent }], [body as TableCell]], headerRows: 2, long: true });
      return;
    }
    let group = technicalGroups.at(-1);
    if (!group || group.long) {
      group = { rows: [[{ ...technicalCaption }]], headerRows: 1, long: false };
      technicalGroups.push(group);
    }
    group.rows.push([{
      stack: [{ text: title, style: 'sectionHeader', color: technicalAccent, margin: [0, 0, 0, 6] }, body]
    }]);
  };
  const scope = scopeDescription(budget);
  if (scope) technicalSection('DESCRIÇÃO DO ESCOPO', { text: scope, color: '#27272a' }, scope);
  if (optionalPropertyRows.length) technicalSection('CARACTERIZAÇÃO TÉCNICA', {
    table: { widths: [120, '*'], body: optionalPropertyRows }, layout: detailTableLayout
  }, JSON.stringify(optionalPropertyRows));
  if (budget.metodologia?.trim()) technicalSection('METODOLOGIA', { text: budget.metodologia, color: '#52525b' }, budget.metodologia);
  if (budget.entregaveis?.trim()) technicalSection('ENTREGÁVEIS', { text: budget.entregaveis, color: '#52525b' }, budget.entregaveis);
  const technicalTableLayout: CustomTableLayout = {
    // pdfmake uses the next row's rule to close a fragment at a page break.
    // Zero-width inner rules also suppressed the bottom border of fragments.
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => '#a1a1aa',
    vLineColor: () => '#a1a1aa',
    fillColor: (row, node) => row === 0 && node.table.headerRows ? '#f4f4f5' : '#fafafa',
    paddingTop: (row) => row === 0 ? 8 : 5,
    paddingBottom: (row) => row === 0 ? 8 : 5,
    paddingLeft: () => 10,
    paddingRight: () => 10
  };
  const content: Content[] = [
    {
      columnGap: 20,
      columns: [
        {
          width: '*',
          stack: [
            { text: 'PROPOSTA COMERCIAL', fontSize: 16, bold: true, color: accessibleAccent },
            { text: `${budget.codigoOrcamento || 'Rascunho'} • versão ${budget.versao}`, bold: true, margin: [0, 6, 0, 0] },
            { text: `Emissão: ${formatDate(budget.dataEmissao)}`, fontSize: 9, color: '#52525b', margin: [0, 4, 0, 0] },
            { text: BUDGET_STATUS_LABELS[budget.status], fontSize: 8, bold: true, color: accentText, background: accent, margin: [0, 6, 0, 0] }
          ]
        },
        {
          width: 210,
          alignment: 'right',
          stack: [
            { text: company.razao || 'GeoGestor — Serviços técnicos', fontSize: 12, bold: true, color: '#18181b' },
            ...(company.logo ? [{ image: company.logo, fit: [120, 56], alignment: 'right', margin: [0, 6, 0, 0] } as Content] : []),
            { text: [company.cnpj, company.telefone, company.email, company.endereco].filter(Boolean).join(' • '), fontSize: 8, color: '#52525b', margin: [0, 5, 0, 0] }
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
          ...(budget.clientDocument?.trim() ? [[{ text: 'CPF / CNPJ', bold: true }, budget.clientDocument]] : []),
          ...([budget.clientPhone, budget.clientEmail].some(value => value?.trim()) ? [[{ text: 'Contato', bold: true }, [budget.clientPhone, budget.clientEmail].filter(Boolean).join(' • ')]] : [])
        ]
      },
      layout: detailTableLayout
    },
    section('OBJETO DA PROPOSTA'),
    {
      table: {
        widths: [120, '*'],
        body: [
          ...(budget.descricao?.trim() ? [[{ text: 'Título', bold: true }, budget.descricao]] : []),
          [{ text: 'Tipo de serviço', bold: true }, safe(budget.servicoTipo)],
          ...(budget.imovelNome?.trim() ? [[{ text: 'Imóvel', bold: true }, [budget.imovelNome, budget.imovelTipo === 'rural' ? 'Rural' : budget.imovelTipo === 'urbano' ? 'Urbano' : ''].filter(Boolean).join(' • ')]] : []),
          ...([budget.municipio, budget.uf].some(value => value?.trim()) ? [[{ text: 'Localização', bold: true }, [budget.municipio, budget.uf].filter(Boolean).join(' / ')]] : [])
        ]
      },
      layout: detailTableLayout
    },
    section('RESUMO COMERCIAL'),
    {
      table: { widths: [120, '*'], body: commercialRows(budget).map(([label, value]) => [
        { text: label, bold: true },
        { text: value, ...(label === 'Investimento total' ? { bold: true, fontSize: 12, color: accessibleAccent } : {}) }
      ]) },
      layout: detailTableLayout
    },
    ...(budget.payment?.installments?.length ? [{ stack: [
      { text: 'Parcelas e vencimentos', bold: true, margin: [0, 0, 0, 4] },
      { text: installmentTexts(budget.valorTotal, budget.payment.installments).join('\n'), color: '#52525b' }
    ], margin: [0, 8, 0, 0] } as Content] : []),
    ...(budget.payment?.description?.trim() ? [{ text: `Condição complementar: ${budget.payment.description}`, color: '#52525b', margin: [0, 6, 0, 0] } as Content] : []),
    ...technicalGroups.map((group, index): Content => ({
      table: {
        // Later subsections use their own title, without duplicating the
        // general caption when several technical frames share one page.
        headerRows: group.headerRows - (index === 0 ? 0 : 1),
        // Only ordinary subsections stay together; long content flows freely.
        dontBreakRows: !group.long,
        keepWithHeaderRows: group.long || index > 0 ? 0 : 1,
        widths: ['*'],
        body: index === 0 ? group.rows : group.rows.slice(1)
      },
      layout: technicalTableLayout,
      margin: [0, index === 0 ? 15 : 8, 0, 0]
    })),

    {
      table: { headerRows: 2, keepWithHeaderRows: hasLongRows(false) ? 0 : 1, dontBreakRows: !hasLongRows(false), widths: ['*', 68, 72, 88, 76], body: itemRows },
      margin: [0, 10, 0, 0],
      layout: itemTableLayout
    },
    ...(optionalRows.length > 2 ? [
      {
        table: { headerRows: 2, keepWithHeaderRows: hasLongRows(true) ? 0 : 1, dontBreakRows: !hasLongRows(true), widths: ['*', 68, 72, 88, 76], body: optionalRows },
        layout: itemTableLayout,
        margin: [0, 8, 0, 0]
      } as Content
    ] : []),
    { table: { widths: ['*', 150], body: summaryRows }, unbreakable: true, layout: {
      ...detailTableLayout,
      hLineWidth: (index, node) => index === node.table.body.length - 1 ? 0.75 : 0,
      hLineColor: () => '#71717a'
    }, margin: [0, 8, 0, 0] },
    { stack: [section('TRIBUTOS'), { text: taxes, color: '#52525b' }] },
    ...(budget.observacoesCliente?.trim() ? [{ stack: [section('OBSERVAÇÕES AO CLIENTE'), { text: budget.observacoesCliente, color: '#52525b' }] } as Content] : []),
    ...(budget.termosCondicoes?.trim() ? [{ stack: [section('TERMOS E CONDIÇÕES'), { text: budget.termosCondicoes, color: '#52525b' }] } as Content] : []),
    {
      stack: [
        { stack: [section('ACEITE DA PROPOSTA'), { text: `${budget.codigoOrcamento || 'Rascunho'} • versão ${budget.versao}`, bold: true }, { text: 'Ao assinar, as partes declaram ciência e concordância com o escopo, o investimento e as condições apresentados neste documento.', color: '#52525b', margin: [0, 6, 0, 0] }], unbreakable: true },
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
          // Reserve about 40 mm above the lines for handwritten signatures.
          margin: [0, 114, 0, 0]
        }
      ],
      // Keep ordinary acceptance data with its signatures. Oversized user text
      // must remain breakable or pdfmake can discard the entire block.
      unbreakable: [budget.clientName, budget.responsavelTecnico, professionalRegistration]
        .every(value => !value || (value.length <= 500 && value.split('\n').length <= 12))
    }
  ];

  const linkSectionBodies = (nodes: Content[]) => {
    nodes.forEach((node, index) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const tagged = node as { id?: string; headlineLevel?: number; stack?: Content[]; table?: { body: TableCell[][] } };
      if (tagged.headlineLevel === 1) {
        const body = nodes[index + 1];
        if (body && typeof body === 'object' && !Array.isArray(body)) (body as { id?: string }).id = `${tagged.id}-body`;
      }
      if (tagged.stack) linkSectionBodies(tagged.stack);
      if (tagged.table) tagged.table.body.forEach(row => row.forEach(cell => linkSectionBodies([cell as Content])));
    });
  };
  linkSectionBodies(content);

  return {
    pageSize: 'A4',
    info: { title: `Orçamento ${budget.codigoOrcamento || 'rascunho'} — versão ${budget.versao}`, author: company.razao || 'GeoGestor' },
    pageMargins: [40, 42, 40, 55],
    content,
    watermark: buildStatusWatermark(budget.status),
    footer: (currentPage, pageCount) => ({ text: `${budget.codigoOrcamento || 'Rascunho'} v${budget.versao} • página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [40, 18, 40, 0], fontSize: 8, color: '#71717a' }),
    styles: { sectionHeader: { fontSize: 9, bold: true, color: accessibleAccent, characterSpacing: 0.7 } },
    defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.3 },
    pageBreakBefore: (node, queries) => node.headlineLevel === 1
      && !queries.getFollowingNodesOnPage().some(following => following.id === `${node.id}-body`)
  };
}

export function professionalBudgetPdfFileName(budget: BudgetDetail) {
  const fileName = `${budget.codigoOrcamento || 'Orcamento'}_v${budget.versao}_${budget.clientName || 'Cliente'}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 160);
  return `${fileName}.pdf`;
}

export async function generateProfessionalBudgetPdf(budget: BudgetDetail) {
  // Export the current persisted version and authoritative company settings;
  // the details modal can remain mounted while another operation updates them.
  const [currentBudget, company] = await Promise.all([
    apiClient.get<BudgetDetail>(`/api/orcamentos/${budget.id}`),
    loadCompanyTemplate()
  ]);
  const make = await loadPdfMake();
  const destination = await downloadProfessionalBudgetPdf(
    make,
    createProfessionalBudgetPdfDefinition(currentBudget, company),
    professionalBudgetPdfFileName(currentBudget)
  );
  return destination;
}

export async function downloadProfessionalBudgetPdf(
  make: { createPdf: (definition: TDocumentDefinitions) => { download: (fileName?: string) => void | Promise<void>; getBuffer?: () => Promise<Uint8Array> } },
  definition: TDocumentDefinitions,
  fileName: string
) {
  const pdf = make.createPdf(definition);
  if (typeof window !== 'undefined' && window.electronAPI?.saveBudgetPdf) {
    if (!pdf.getBuffer) throw new Error('O gerador de PDF não disponibilizou o arquivo. Tente novamente.');
    return window.electronAPI.saveBudgetPdf({ fileName, bytes: await pdf.getBuffer() });
  }
  await pdf.download(fileName);
  return undefined;
}
