import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CLIENT_RECORD_PAGE_SIZE, normalizeClientSearch } from './clientTabRecords';
import { useClientListNavigation } from './useClientListNavigation';

export type ClientListOrder<T> = { value: string; label: string; compare?: (a: T, b: T) => number };
type ClientListOptions<T> = { prefix: string; items: T[]; fields: (item: T) => Array<string | null | undefined>; status: (item: T) => string; orders: ClientListOrder<T>[]; focusId?: string | null; recordId?: (item: T) => string };
export function useClientTabList<T>({ prefix, items, fields, status, orders, focusId, recordId }: ClientListOptions<T>) {
  const [params, setParams] = useSearchParams();
  const query = params.get(`${prefix}Busca`) || '';
  const selectedStatus = params.get(`${prefix}Situacao`) || '';
  const order = orders.find(option => option.value === params.get(`${prefix}Ordem`)) || orders[0];
  const statuses = useMemo(() => [...new Set(items.map(status))].sort((a,b) => a.localeCompare(b, 'pt-BR')), [items, status]);
  const filtered = useMemo(() => {
    const needle = normalizeClientSearch(query);
    const rows = items.filter(item => (!selectedStatus || status(item) === selectedStatus) && (!needle || fields(item).some(value => value && normalizeClientSearch(value).includes(needle))));
    return order.compare ? rows.sort(order.compare) : rows;
  }, [items, fields, status, query, selectedStatus, order]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / CLIENT_RECORD_PAGE_SIZE));
  const requestedPage = Number(params.get(`${prefix}Pagina`));
  const initialPage = focusId && recordId ? Math.max(1, Math.ceil((filtered.findIndex(item => recordId(item) === focusId)+1)/CLIENT_RECORD_PAGE_SIZE)) : 1;
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : initialPage);
  const navigation = useClientListNavigation(page);
  const update = (values: Record<string, string | number>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) {
      if (value === '' || (key === 'Pagina' && value === 1 && !focusId) || (key === 'Ordem' && value === orders[0].value)) next.delete(`${prefix}${key}`);
      else next.set(`${prefix}${key}`, String(value));
    }
    return next;
  }, { replace: true, preventScrollReset: true });
  return {
    prefix, query, selectedStatus, statuses, order: order.value, orders, resultsAnchor: navigation.resultsAnchor,
    total: items.length, found: filtered.length, page, pageCount,
    rows: filtered.slice((page-1)*CLIENT_RECORD_PAGE_SIZE, page*CLIENT_RECORD_PAGE_SIZE),
    hasFilters: Boolean(query || selectedStatus),
    setQuery: (value: string) => update({ Busca: value, Pagina: 1 }),
    setStatus: (value: string) => update({ Situacao: value, Pagina: 1 }),
    setOrder: (value: string) => update({ Ordem: value, Pagina: 1 }),
    setPage: (value: number) => { navigation.preparePage(value); update({ Pagina: value }); },
    clearFilters: () => update({ Busca: '', Situacao: '', Pagina: 1 })
  };
}
