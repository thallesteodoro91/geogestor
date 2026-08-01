import type { ManagerialReport, ReportFinancialComparison } from '@geogestor/contracts';

export type ReportType = 'financeiro' | 'projetos' | 'executivo';
export const REPORT_TYPES: ReportType[] = ['financeiro', 'projetos', 'executivo'];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`));
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

export function executiveSummary(report: ManagerialReport) {
  const { financial, operational } = report;
  const result = financial.kpis.cashResult;
  const cashMessage = result > 0
    ? `O caixa encerrou o período positivo em ${formatCurrency(result)}.`
    : result < 0
      ? `O caixa encerrou o período negativo em ${formatCurrency(Math.abs(result))}.`
      : 'Entradas e saídas de caixa ficaram equilibradas no período.';
  const deliveryMessage = operational.kpis.overdueProjects > 0
    ? `${operational.kpis.overdueProjects} projeto(s) ativo(s) estão com prazo vencido.`
    : 'Não há projetos ativos com prazo vencido no recorte.';
  const receivablesMessage = financial.kpis.overdueRevenue > 0
    ? `A carteira vencida soma ${formatCurrency(financial.kpis.overdueRevenue)}.`
    : 'Não há recebíveis vencidos no recorte.';
  return [cashMessage, receivablesMessage, deliveryMessage];
}
