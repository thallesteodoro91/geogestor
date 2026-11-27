import { apiClient } from '../../services/apiClient';

export const CLIENT_TIMELINE_LIMIT = 4;
export function clientToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function formatClientDate(value?: string | null, withTime = false) {
  if (!value) return 'Não informada';
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value.includes('T') ? value : `${value}T12:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'Data a revisar' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...(withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as const : {}) }).format(date);
}
export function clientDeadline(value?: string | null, completed = false) {
  if (!value) return 'Prazo não definido';
  if (completed) return `Prazo registrado: ${formatClientDate(value)}`;
  return `${value.slice(0, 10) < clientToday() ? 'Prazo vencido:' : 'Prazo:'} ${formatClientDate(value)}`;
}
export function clientOpenBalance(kpis: Record<string, unknown>) {
  const amount = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const due = amount(kpis.valorPendente), overdue = amount(kpis.valorVencido);
  return { due, overdue, total: due + overdue };
}
export async function listAllClientProperties<T>(clientId: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await apiClient.get<{ items: T[]; total: number }>(`/api/dados-operacionais/propriedades?clienteId=${clientId}&page=${page}&limit=100`);
    items.push(...result.items);
    if (items.length >= result.total) return items;
    if (!result.items.length) throw new Error('A lista de propriedades está incompleta. Tente novamente.');
  }
}
