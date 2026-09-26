export type DeadlineTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface DeadlinePresentation {
  label: string;
  helper: string;
  tone: DeadlineTone;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const areaFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const coordinateFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6
});

function normalized(value?: string | null) {
  return (value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function dateOnlyUtc(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatProjectDate(value?: string | null, fallback = 'Não informado') {
  if (!value) return fallback;
  const date = dateOnlyUtc(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatProjectArea(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 'Não informada';
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? `${areaFormatter.format(parsed)} ha` : 'Não informada';
}

export function formatProjectLocation(cidade?: string | null, municipio?: string | null) {
  const city = cidade?.trim() || '';
  const municipality = municipio?.trim() || '';
  if (!city && !municipality) return 'Não informada';
  if (normalized(city) === normalized(municipality)) return city || municipality;
  if (/^[A-Za-z]{2}$/.test(city)) return municipality ? `${municipality}/${city.toUpperCase()}` : city.toUpperCase();
  return [municipality, city].filter(Boolean).join(' · ');
}

export function formatCoordinate(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${coordinateFormatter.format(value)}°`
    : 'Não informada';
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Tamanho não informado';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / 1024 ** 2)} MB`;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / 1024 ** 3)} GB`;
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isCompletedProject(status?: string | null) {
  return normalized(status).startsWith('conclu');
}

export function getDeadlinePresentation(
  status?: string | null,
  dueDate?: string | null,
  referenceDate = new Date()
): DeadlinePresentation {
  if (isCompletedProject(status)) {
    return { label: 'Concluído', helper: dueDate ? `Entrega: ${formatProjectDate(dueDate)}` : 'Projeto finalizado', tone: 'success' };
  }
  if (!dueDate) return { label: 'Sem prazo', helper: 'Defina uma data de entrega', tone: 'neutral' };

  const due = dateOnlyUtc(dueDate);
  if (!due) return { label: 'Prazo inválido', helper: 'Revise a data de entrega', tone: 'warning' };
  const todayUtc = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((dueUtc - todayUtc) / 86_400_000);

  if (days < 0) {
    const lateDays = Math.abs(days);
    return { label: `Atrasado há ${lateDays} ${lateDays === 1 ? 'dia' : 'dias'}`, helper: formatProjectDate(dueDate), tone: 'danger' };
  }
  if (days === 0) return { label: 'Entrega hoje', helper: formatProjectDate(dueDate), tone: 'warning' };
  if (days <= 14) return { label: `Entrega em ${days} ${days === 1 ? 'dia' : 'dias'}`, helper: formatProjectDate(dueDate), tone: 'warning' };
  return { label: `Entrega em ${days} dias`, helper: formatProjectDate(dueDate), tone: 'success' };
}

export function isTaskOverdue(status?: string | null, dueDate?: string | null, referenceDate = new Date()) {
  if (!dueDate || normalized(status).startsWith('conclu')) return false;
  const due = dateOnlyUtc(dueDate);
  if (!due) return false;
  const todayUtc = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  return Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) < todayUtc;
}
