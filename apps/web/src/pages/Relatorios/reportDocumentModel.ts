import type { ManagerialReport } from '@geogestor/contracts';
import {
  executiveSummary,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPeriod,
  reportTitle,
  type ReportType
} from './reportPresentation';

export interface ReportDocumentModel {
  title: string;
  period: string;
  issuedAt: string;
  summary: string[];
  criteria: string[];
  sections: Array<{
    title: string;
    rows: Array<{ label: string; value: string }>;
  }>;
}

export function buildReportDocumentModel(report: ManagerialReport, type: ReportType): ReportDocumentModel {
  const financial = report.financial.kpis;
  const operational = report.operational.kpis;
  const financialRows = [
    { label: 'Receita contratada', value: formatCurrency(financial.contractedRevenue) },
    { label: 'Receita recebida', value: formatCurrency(financial.receivedRevenue) },
    { label: 'Receita pendente', value: formatCurrency(financial.pendingRevenue) },
    { label: 'Receita vencida', value: formatCurrency(financial.overdueRevenue) },
    { label: 'Despesas pagas', value: formatCurrency(financial.paidExpenses) },
    { label: 'Resultado de caixa', value: formatCurrency(financial.cashResult) },
    { label: 'Impostos previstos', value: formatCurrency(financial.estimatedTaxes) },
    {
      label: 'Conversão comercial',
      value: financial.conversionRate === null ? 'Sem base comparável' : `${formatNumber(financial.conversionRate)}%`
    }
  ];
  const operationalRows = [
    { label: 'Projetos no recorte', value: String(operational.totalProjects) },
    { label: 'Projetos ativos', value: String(operational.activeProjects) },
    { label: 'Projetos concluídos', value: String(operational.completedProjects) },
    { label: 'Projetos cancelados', value: String(operational.cancelledProjects) },
    { label: 'Prazos vencidos', value: String(operational.overdueProjects) },
    {
      label: 'Área ativa conhecida',
      value: operational.activeAreaHa === null ? 'Não informada' : `${formatNumber(operational.activeAreaHa)} ha`
    }
  ];
  const sections = type === 'financeiro'
    ? [{ title: 'Indicadores financeiros', rows: financialRows }]
    : type === 'projetos'
      ? [{ title: 'Indicadores operacionais', rows: operationalRows }]
      : [
        { title: 'Indicadores financeiros', rows: financialRows },
        { title: 'Indicadores operacionais', rows: operationalRows }
      ];

  return {
    title: reportTitle(type),
    period: formatPeriod(report),
    issuedAt: formatDate(report.generatedAt),
    summary: executiveSummary(report),
    criteria: [
      report.period.rules.receivedRevenue,
      report.period.rules.paidExpenses,
      report.period.rules.projects
    ],
    sections
  };
}
