export type DashboardProjectScope = 'active' | 'all';
export type TaskCompletionPeriod = 'month' | 'three_months' | 'year' | 'custom';

export type DateRange = {
  start: string;
  end: string;
};

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date | null {
  if (!dateKeyPattern.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function resolveProjectScope(value: string | null): DashboardProjectScope {
  return value === 'all' ? 'all' : 'active';
}

export function resolveTaskCompletionPeriod(value: string | null): TaskCompletionPeriod {
  if (value === 'three_months' || value === 'year' || value === 'custom') return value;
  return 'month';
}

export function validateCustomTaskRange(start: string, end: string): string | null {
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  if (!startDate || !endDate) return 'Informe as datas inicial e final.';
  if (startDate.getTime() > endDate.getTime()) return 'A data inicial não pode ser posterior à data final.';
  return null;
}

export function getTaskPeriodRange(
  period: TaskCompletionPeriod,
  customStart: string,
  customEnd: string,
  referenceDate = new Date(),
): DateRange | null {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  if (period === 'custom') {
    if (validateCustomTaskRange(customStart, customEnd)) return null;
    return { start: customStart, end: customEnd };
  }

  if (period === 'three_months') {
    return {
      start: formatDateKey(new Date(year, month - 2, 1)),
      end: formatDateKey(new Date(year, month + 1, 0)),
    };
  }

  if (period === 'year') {
    return {
      start: formatDateKey(new Date(year, 0, 1)),
      end: formatDateKey(new Date(year, 11, 31)),
    };
  }

  return {
    start: formatDateKey(new Date(year, month, 1)),
    end: formatDateKey(new Date(year, month + 1, 0)),
  };
}

const monthYearFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toLocaleUpperCase('pt-BR')}${value.slice(1)}` : value;
}

export function formatTaskPeriodLabel(period: TaskCompletionPeriod, range: DateRange): string {
  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  if (!start || !end) return 'Período inválido';

  if (period === 'month') return capitalize(monthYearFormatter.format(start));
  if (period === 'year') return String(start.getFullYear());
  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}
