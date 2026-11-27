import { getWorkStatusPresentation } from '../../../utils/workStatus';

export const CLIENT_RECORD_PAGE_SIZE = 24;
export const normalizeClientSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
export type ClientWorkGroup = 'active' | 'paused' | 'cancelled' | 'completed' | 'other';
const statusAliases: Record<string, string> = {
  planejamento: 'Planejamento', 'em analise': 'Em Análise', 'em andamento': 'Em Andamento', ativo: 'Em Andamento',
  'aguardando cliente': 'Aguardando Cliente', 'aguardando documentacao': 'Aguardando Documentação', 'aguardando orgao': 'Aguardando Órgão',
  'em analise no orgao': 'Em Análise no Órgão', 'com pendencia': 'Com Pendência', suspenso: 'Suspenso', pausado: 'Suspenso',
  finalizado: 'Finalizado', concluido: 'Concluído', cancelado: 'Cancelado', arquivado: 'Arquivado', atrasado: 'Atrasado'
};
export function clientWorkStatus(value?: string | null) {
  const canonical = statusAliases[normalizeClientSearch(value || '')];
  const presentation = getWorkStatusPresentation(canonical || value);
  const group: ClientWorkGroup = canonical === 'Em Andamento' ? 'active' : canonical === 'Suspenso' ? 'paused' : canonical === 'Cancelado' ? 'cancelled' : canonical === 'Finalizado' || canonical === 'Concluído' ? 'completed' : 'other';
  const label = !value?.trim() ? 'Situação não informada' : normalizeClientSearch(value) === 'pausado' ? 'Pausado' : presentation.label;
  const hasActiveDeadline = Boolean(canonical && !['Suspenso', 'Finalizado', 'Concluído', 'Cancelado', 'Arquivado'].includes(canonical));
  return { ...presentation, label, group, hasActiveDeadline };
}
export function clientWorkCounts(items: ReadonlyArray<{ status?: string | null }>) {
  const counts: Record<ClientWorkGroup, number> = { active: 0, paused: 0, cancelled: 0, completed: 0, other: 0 };
  items.forEach(item => counts[clientWorkStatus(item.status).group]++);
  return counts;
}
export function compareClientNumbers(a?: number | null, b?: number | null, descending = false) {
  const missingA = a == null || !Number.isFinite(a), missingB = b == null || !Number.isFinite(b);
  if (missingA || missingB) return missingA === missingB ? 0 : missingA ? 1 : -1;
  return descending ? b! - a! : a! - b!;
}
export function compareClientDates(a?: string | null, b?: string | null, descending = false) {
  const date = (value?: string | null) => {
    if (!value) return NaN;
    const normalized = value.length === 10 ? `${value}T12:00:00Z` : value.replace(' ', 'T');
    return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? normalized + 'Z' : normalized);
  };
  return compareClientNumbers(date(a), date(b), descending);
}
