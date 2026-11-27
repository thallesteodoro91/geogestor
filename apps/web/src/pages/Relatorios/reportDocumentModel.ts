import type { ManagerialReport } from '@geogestor/contracts';
import {
  executiveSummary,
  executiveAlerts,
  executiveCriteria,
  formatCurrency,
  formatDate,
  formatGeneratedAt,
  formatNumber,
  formatPeriod,
  reportTitle,
  type ReportType
} from './reportPresentation';
import { reportAlertCopy } from './reportAlertCopy';

export interface ReportDocumentModel {
  title: string;
  period: string;
  issuedAt: string;
  summary: string[];
  alerts: Array<{ title: string; description: string }>;
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
  const monthlyRows = report.financial.monthly.map((item) => ({
    label: item.month,
    value: `Recebido ${formatCurrency(item.receivedRevenue)} · Pago ${formatCurrency(item.paidExpenses)} · Resultado ${formatCurrency(item.cashResult)}`
  }));
  const categoryRows = report.financial.expensesByCategory.map((item) => ({
    label: item.category,
    value: `${formatCurrency(item.paidTotal)} · ${item.count} lançamento(s) pago(s)`
  }));
  const statusRows = report.operational.byStatus.map((item) => ({ label: item.label, value: String(item.count) }));
  const deadlineRows = report.operational.deadlines.map((item) => ({
    label: item.name,
    value: `${formatDate(item.dueDate)} · ${item.status}`
  }));
  const financialSections = [
    { title: 'Indicadores financeiros', rows: financialRows },
    ...(monthlyRows.length ? [{ title: 'Evolução do caixa', rows: monthlyRows }] : []),
    ...(categoryRows.length ? [{ title: 'Despesas pagas por categoria', rows: categoryRows }] : [])
  ];
  const operationalSections = [
    { title: 'Indicadores operacionais', rows: operationalRows },
    ...(statusRows.length ? [{ title: 'Distribuição por status', rows: statusRows }] : []),
    ...(deadlineRows.length ? [{ title: 'Agenda crítica de entregas', rows: deadlineRows }] : [])
  ];
  const sections = type === 'financeiro'
    ? financialSections
    : type === 'projetos'
      ? operationalSections
      : [...financialSections.slice(0, 1), ...operationalSections.slice(0, 1)];
  const alerts = (type === 'financeiro'
    ? report.financial.alerts
    : type === 'projetos'
      ? report.operational.alerts
      : executiveAlerts(report))
    .map(reportAlertCopy);
  const criteria = type === 'financeiro'
    ? [
        report.period.rules.contractedRevenue,
        report.period.rules.receivedRevenue,
        report.period.rules.pendingRevenue,
        report.period.rules.paidExpenses
      ]
    : type === 'projetos'
      ? [report.period.rules.projects, report.period.rules.activeArea]
      : executiveCriteria(report);

  return {
    title: reportTitle(type),
    period: formatPeriod(report),
    issuedAt: formatGeneratedAt(report.generatedAt),
    summary: type === 'executivo' ? executiveSummary(report) : [],
    alerts,
    criteria,
    sections
  };
}
