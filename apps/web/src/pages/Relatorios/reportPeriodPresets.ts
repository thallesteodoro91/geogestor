export type ReportPeriodPreset = 'current-month' | 'last-30-days' | 'current-quarter' | 'current-year' | 'all';

export const REPORT_PERIOD_PRESETS: Array<{ id: ReportPeriodPreset; label: string }> = [
  { id: 'current-month', label: 'Mês atual' },
  { id: 'last-30-days', label: 'Últimos 30 dias' },
  { id: 'current-quarter', label: 'Trimestre atual' },
  { id: 'current-year', label: 'Ano atual' },
  { id: 'all', label: 'Todo o histórico' }
];

function isoLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function reportPeriodPresetRange(preset: ReportPeriodPreset, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === 'all') return { startDate: '', endDate: '' };
  if (preset === 'last-30-days') {
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    return { startDate: isoLocal(start), endDate: isoLocal(end) };
  }
  if (preset === 'current-month') {
    return { startDate: isoLocal(new Date(end.getFullYear(), end.getMonth(), 1)), endDate: isoLocal(end) };
  }
  if (preset === 'current-quarter') {
    const quarterMonth = Math.floor(end.getMonth() / 3) * 3;
    return { startDate: isoLocal(new Date(end.getFullYear(), quarterMonth, 1)), endDate: isoLocal(end) };
  }
  return { startDate: `${end.getFullYear()}-01-01`, endDate: isoLocal(end) };
}

export function activeReportPeriodPreset(startDate: string, endDate: string, today = new Date()) {
  return REPORT_PERIOD_PRESETS.find(({ id }) => {
    const range = reportPeriodPresetRange(id, today);
    return range.startDate === startDate && range.endDate === endDate;
  })?.id ?? null;
}

export function reportPeriodGuidance(startDate: string, endDate: string) {
  if (startDate && !endDate) return 'O relatório considera dados a partir da data inicial. A comparação anterior fica indisponível.';
  if (!startDate && endDate) return 'O relatório considera dados até a data final. A comparação anterior fica indisponível.';
  return null;
}
