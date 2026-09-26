import type { ManagerialReport } from '@geogestor/contracts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { loadPdfMake } from '../../utils/loadPdfMake';
import {
  executiveSummary,
  formatCurrency,
  formatDate,
  formatGeneratedAt,
  formatPeriod,
  reportFileName,
  reportTitle,
  type ReportType
} from './reportPresentation';
import { buildReportDocumentModel } from './reportDocumentModel';
import { getCachedCompanyTemplate, type CompanyTemplate } from '../../services/companyTemplate';
import { reportAlertCopy } from './reportAlertCopy';


function metricRows(rows: Array<[string, string]>): TableCell[][] {
  return rows.map(([label, value]) => [
    { text: label, color: '#3f3f46' },
    { text: value, bold: true, alignment: 'right', color: '#18181b' }
  ]);
}

function financialContent(report: ManagerialReport): Content[] {
  const rows = buildReportDocumentModel(report, 'financeiro').sections[0].rows;
  const categoryBody: TableCell[][] = [
    [
      { text: 'Categoria', bold: true },
      { text: 'Pago', bold: true, alignment: 'right' },
      { text: 'Itens', bold: true, alignment: 'right' }
    ],
    ...report.financial.expensesByCategory.map((item): TableCell[] => [
      item.category,
      { text: formatCurrency(item.paidTotal), alignment: 'right' },
      { text: String(item.count), alignment: 'right' }
    ])
  ];
  const monthlyBody: TableCell[][] = [
    [
      { text: 'Mês', bold: true },
      { text: 'Recebido', bold: true, alignment: 'right' },
      { text: 'Pago', bold: true, alignment: 'right' },
      { text: 'Resultado', bold: true, alignment: 'right' }
    ],
    ...report.financial.monthly.map((item): TableCell[] => [
      item.month,
      { text: formatCurrency(item.receivedRevenue), alignment: 'right' },
      { text: formatCurrency(item.paidExpenses), alignment: 'right' },
      { text: formatCurrency(item.cashResult), alignment: 'right' }
    ])
  ];
  return [
    { text: 'Indicadores financeiros', style: 'section' },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['*', 125],
        body: [
          [{ text: 'Indicador', bold: true }, { text: 'Resultado', bold: true, alignment: 'right' }],
          ...metricRows(rows.map((row) => [row.label, row.value]))
        ]
      },
      layout: 'lightHorizontalLines'
    },
    ...(report.financial.monthly.length ? [{ text: 'Evolução do caixa', style: 'section' } as Content, {
      table: { headerRows: 1, dontBreakRows: true, widths: ['*', 85, 85, 85], body: monthlyBody },
      layout: 'lightHorizontalLines'
    } as Content] : []),
    { text: 'Despesas pagas por categoria', style: 'section' },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['*', 110, 55],
        body: categoryBody
      },
      layout: 'lightHorizontalLines'
    }
  ];
}

function operationalContent(report: ManagerialReport): Content[] {
  const rows = buildReportDocumentModel(report, 'projetos').sections[0].rows;
  const statusBody: TableCell[][] = [
    [{ text: 'Status', bold: true }, { text: 'Projetos', bold: true, alignment: 'right' }],
    ...report.operational.byStatus.map((item): TableCell[] => [
      item.label,
      { text: String(item.count), alignment: 'right' }
    ])
  ];
  const deadlineBody: TableCell[][] = [
    [
      { text: 'Projeto', bold: true },
      { text: 'Entrega', bold: true },
      { text: 'Status', bold: true }
    ],
    ...report.operational.deadlines.map((item): TableCell[] => [item.name, formatDate(item.dueDate), item.status])
  ];
  return [
    { text: 'Indicadores operacionais', style: 'section' },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['*', 125],
        body: [
          [{ text: 'Indicador', bold: true }, { text: 'Resultado', bold: true, alignment: 'right' }],
          ...metricRows(rows.map((row) => [row.label, row.value]))
        ]
      },
      layout: 'lightHorizontalLines'
    },
    { text: 'Distribuição por status', style: 'section' },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['*', 80],
        body: statusBody
      },
      layout: 'lightHorizontalLines'
    },
    ...(report.operational.deadlines.length ? [{ text: 'Agenda crítica de entregas', style: 'section' } as Content, {
      table: { headerRows: 1, dontBreakRows: true, widths: ['*', 75, 90], body: deadlineBody },
      layout: 'lightHorizontalLines'
    } as Content] : [])
  ];
}

function alertsContent(report: ManagerialReport, type: ReportType): Content[] {
  const alerts = type === 'financeiro'
    ? report.financial.alerts
    : type === 'projetos'
      ? report.operational.alerts
      : [...report.financial.alerts, ...report.operational.alerts];
  if (!alerts.length) return [];
  return [
    { text: 'Pontos de atenção', style: 'section' },
    { ul: alerts.map((alert) => {
      const copy = reportAlertCopy(alert);
      return `${copy.title}: ${copy.description}`;
    }) } as Content
  ];
}

function safeLogo(logo: string) {
  return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/]+={0,2}$/i.test(logo) && logo.length >= 100 ? logo : '';
}

export function createManagerialReportPdfDefinition(
  report: ManagerialReport,
  type: ReportType,
  template: CompanyTemplate = getCachedCompanyTemplate()
): TDocumentDefinitions {
  const primary = /^#[0-9a-f]{6}$/i.test(template.cor || '') ? template.cor! : '#4338ca';
  const logo = safeLogo(template.logo || '');
  const identity = [
    template.cnpj ? `CNPJ ${template.cnpj}` : '',
    template.telefone || '',
    template.email || ''
  ].filter(Boolean).join(' · ');
  const documentModel = buildReportDocumentModel(report, type);
  const typeContent: Content[] = type === 'financeiro'
    ? financialContent(report)
    : type === 'projetos'
      ? operationalContent(report)
      : [
        { text: 'Síntese executiva', style: 'section' },
        { ul: executiveSummary(report) } as Content,
        ...financialContent(report),
        ...operationalContent(report)
      ];

  return {
    pageSize: 'A4',
    pageMargins: [42, 86, 42, 52],
    header: {
      margin: [42, 18, 42, 0],
      columns: [
        logo
          ? {
              width: '*',
              columnGap: 7,
              columns: [
                { image: logo, width: 42 },
                { text: template.razao || 'GeoGestor', bold: true, color: primary, fontSize: 10, margin: [0, 13, 0, 0] }
              ]
            }
          : { text: template.razao || 'GeoGestor', bold: true, color: primary, fontSize: 12 },
        { text: 'Relatório gerencial', width: 'auto', alignment: 'right', color: '#71717a', fontSize: 9, margin: [0, 13, 0, 0] }
      ]
    },
    footer: (currentPage, pageCount) => ({
      margin: [42, 14, 42, 0],
      columns: [
        { text: `Gerado em ${formatGeneratedAt(report.generatedAt)}`, color: '#71717a', fontSize: 8 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#71717a', fontSize: 8 }
      ]
    }),
    content: [
      { text: reportTitle(type).toLocaleUpperCase('pt-BR'), style: 'title' },
      { text: `Período: ${formatPeriod(report)}`, color: '#52525b', margin: [0, 3, 0, 0] },
      ...(identity ? [{ text: identity, color: '#71717a', fontSize: 8, margin: [0, 3, 0, 0] } as Content] : []),
      ...(template.endereco ? [{ text: template.endereco, color: '#71717a', fontSize: 8 } as Content] : []),
      { text: report.period.rules.receivedRevenue, color: '#71717a', fontSize: 8, margin: [0, 8, 0, 8] },
      ...typeContent,
      ...alertsContent(report, type),
      { text: 'Critérios e metodologia', style: 'section' },
      { ul: documentModel.criteria } as Content
    ],
    styles: {
      title: { fontSize: 18, bold: true, color: '#18181b' },
      section: { fontSize: 11, bold: true, color: primary, margin: [0, 16, 0, 7] }
    },
    defaultStyle: { fontSize: 9, color: '#27272a', lineHeight: 1.25 }
  } satisfies TDocumentDefinitions;
}

export async function createManagerialReportPdf(
  report: ManagerialReport,
  type: ReportType,
  template: CompanyTemplate = getCachedCompanyTemplate()
) {
  const definition = createManagerialReportPdfDefinition(report, type, template);
  const make = await loadPdfMake();
  await downloadManagerialReportPdf(make, definition, reportFileName(type, report));
}

export async function downloadManagerialReportPdf(
  make: { createPdf: (definition: TDocumentDefinitions) => { download: (fileName?: string) => void | Promise<void> } },
  definition: TDocumentDefinitions,
  fileName: string
) {
  await make.createPdf(definition).download(fileName);
}
