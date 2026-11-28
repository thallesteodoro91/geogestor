import type { ManagerialReport, ReportAlert, ReportFinancialComparison } from '@geogestor/contracts';

export type ReportType = 'financeiro' | 'projetos' | 'executivo';
export const REPORT_TYPES: ReportType[] = ['financeiro', 'projetos', 'executivo'];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const instantDateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function formatGeneratedAt(value: string) {
  return instantDateFormatter.format(new Date(value));
}

export function formatMonth(value: string) {
  return monthFormatter.format(new Date(`${value}-01T12:00:00.000Z`)).replace('.', '');
}

export function formatPeriod(report: ManagerialReport) {
  const { startDate, endDate } = report.period;
  if (startDate && endDate) return `${formatDate(startDate)} a ${formatDate(endDate)}`;
  if (startDate) return `A partir de ${formatDate(startDate)}`;
  if (endDate) return `Até ${formatDate(endDate)}`;
  return 'Todo o histórico';
}

export function percentageDelta(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function comparisonText(
  current: number,
  previous: ReportFinancialComparison[keyof ReportFinancialComparison] | null | undefined
) {
  const delta = percentageDelta(current, previous);
  if (delta === null) return 'Sem base comparável';
  if (Math.abs(delta) < 0.05) return 'Estável ante o período anterior';
  return `${delta > 0 ? 'Alta' : 'Queda'} de ${Math.abs(delta).toLocaleString('pt-BR', {
    maximumFractionDigits: 1
  })}% ante o período anterior`;
}

export function reportTitle(type: ReportType) {
  if (type === 'financeiro') return 'Relatório financeiro';
  if (type === 'projetos') return 'Relatório operacional de projetos';
  return 'Relatório executivo';
}

export function reportFileName(type: ReportType, report: ManagerialReport) {
  const start = report.period.startDate || 'inicio';
  const end = report.period.endDate || 'atual';
  return `geogestor-${type}-${start}-${end}.pdf`;
}

export function canonicalReportSearch(search: string) {
  const params = new URLSearchParams(search);
  const type = params.get('tipo');
  params.delete('tipo');
  if (type && REPORT_TYPES.includes(type as ReportType) && type !== 'financeiro') params.set('tipo', type);

  for (const key of ['inicio', 'fim'] as const) {
    const value = params.get(key)?.trim() || '';
    params.delete(key);
    if (value) params.set(key, value);
  }

  const custom = params.get('periodo') === 'personalizado';
  params.delete('periodo');
  if (custom) params.set('periodo', 'personalizado');
  return params.toString();
}

export function executiveSummary(report: ManagerialReport) {
  const { financial, operational } = report;
  const cashMessage = executiveCashCopy(report);
  const deliveryMessage = operational.kpis.overdueProjects > 0
    ? `${operational.kpis.overdueProjects} ${operational.kpis.overdueProjects === 1 ? "projeto ativo está" : "projetos ativos estão"} com prazo vencido.`
    : 'Não há projetos ativos com prazo vencido no recorte.';
  const receivablesMessage = financial.kpis.overdueRevenue > 0
    ? `A carteira vencida soma ${formatCurrency(financial.kpis.overdueRevenue)}.`
    : 'Não há recebíveis vencidos no recorte.';
  return [cashMessage, receivablesMessage, deliveryMessage];
}

// Presentation only: preserve the service's amounts, classifications and dates.
export function executiveCashCopy(report: ManagerialReport) {
  const { cashResult, receivedRevenue, paidExpenses } = report.financial.kpis;
  const composition = report.financial.composition;
  const hasMovement = receivedRevenue !== 0 || paidExpenses !== 0
    || Boolean(composition && (composition.receivedEventCount > 0 || composition.paidExpenseCount > 0));
  if (!hasMovement && cashResult === 0) return 'Sem movimentação financeira no período.';
  if (cashResult === 0) return 'Entradas e saídas de caixa ficaram equilibradas no período.';
  return `O resultado de caixa foi ${cashResult > 0 ? 'positivo' : 'negativo'} em ${formatCurrency(Math.abs(cashResult))}.`;
}

export function executiveAlerts(report: ManagerialReport): ReportAlert[] {
  const rank = { critical: 0, warning: 1, info: 2 };
  return [...report.financial.alerts, ...report.operational.alerts]
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => rank[a.alert.severity] - rank[b.alert.severity] || a.index - b.index)
    .map(({ alert }) => alert);
}

export function executiveAlertAction(alert: ReportAlert) {
  switch (alert.code) {
    case 'overdue_revenue': return 'Consultar recebíveis';
    case 'negative_cash': return 'Consultar financeiro';
    case 'low_conversion': return 'Consultar orçamentos';
    case 'overdue_projects': return 'Ver projetos';
    case 'unknown_area': return 'Consultar áreas dos projetos';
    default: return 'Consultar registros';
  }
}

export function executiveCriteria(report: ManagerialReport) {
  return [report.period.rules.receivedRevenue, report.period.rules.paidExpenses,
    report.period.rules.projects, report.period.rules.activeArea,
    `Prazos vencidos e próximos 30 dias: referência na data de geração, ${formatGeneratedAt(report.generatedAt)}.`,
    'Os próximos prazos consideram os projetos pertencentes ao recorte selecionado.'];
}
