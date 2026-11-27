import { FormSelect } from '../../../components/Form';
import { secondarySmallActionButtonClass } from '../../../utils/actionStyles';
import { geoFieldClass } from '../../../utils/geoTheme';
import { CLIENT_RECORD_PAGE_SIZE } from './clientTabRecords';

import { useClientTabList } from './useClientTabList';

export function ClientTabListTools<T>({ list, noun, searchHint, searchExample }: { list: ReturnType<typeof useClientTabList<T>>; noun: string; searchHint: string; searchExample: string }) {
  if (!list.total) return null;
  const countNoun = list.total === 1 ? ({ propriedades: 'propriedade', serviços: 'serviço', orçamentos: 'orçamento', 'demandas ambientais': 'demanda ambiental' }[noun] || noun) : noun;
  return <><div className="client-list-tools space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
    <div className="client-list-controls">
      <div><label htmlFor={`${list.prefix}-search`} className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">Buscar {noun}</label><input id={`${list.prefix}-search`} name={`${list.prefix}Busca`} type="search" autoComplete="off" aria-describedby={`${list.prefix}-search-hint`} value={list.query} onChange={event=>list.setQuery(event.target.value)} placeholder={searchExample} className={geoFieldClass + ' min-h-11 w-full'} /><p id={`${list.prefix}-search-hint`} className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{searchHint}</p></div>
      <div><label htmlFor={`${list.prefix}-status`} className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">Situação de {noun}</label><FormSelect id={`${list.prefix}-status`} name={`${list.prefix}Situacao`} value={list.selectedStatus} onChange={event=>list.setStatus(event.target.value)} className={geoFieldClass + ' min-h-11 w-full'}><option value="">Todas as situações</option>{list.statuses.map(value=><option key={value} value={value}>{value}</option>)}</FormSelect></div>
      <div><label htmlFor={`${list.prefix}-order`} className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">Ordenar {noun}</label><FormSelect id={`${list.prefix}-order`} name={`${list.prefix}Ordem`} value={list.order} onChange={event=>list.setOrder(event.target.value)} className={geoFieldClass + ' min-h-11 w-full'}>{list.orders.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</FormSelect></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">{list.found} de {list.total} {countNoun}{list.hasFilters ? ' neste filtro' : ''}</p>{list.hasFilters && <button type="button" onClick={list.clearFilters} className={secondarySmallActionButtonClass}>Limpar filtros</button>}</div>
  </div><ClientListStart page={list.page} pageCount={list.pageCount} found={list.found} resultsAnchor={list.resultsAnchor} noun={noun} /></>;
}
export type ClientPagination = { page: number; pageCount: number; found: number; setPage: (page: number) => void; resultsAnchor: (element: HTMLParagraphElement | null) => void };
const pageSummary = (page: number, pageCount: number, found: number) => `Página ${page} de ${pageCount} · Mostrando ${found ? (page-1)*CLIENT_RECORD_PAGE_SIZE+1 : 0}–${Math.min(page*CLIENT_RECORD_PAGE_SIZE,found)} de ${found}`;
export function ClientListStart({ page, pageCount, found, resultsAnchor, noun }: Pick<ClientPagination, 'page' | 'pageCount' | 'found' | 'resultsAnchor'> & { noun: string }) {
  const summary = pageSummary(page, pageCount, found);
  return <p ref={resultsAnchor} role="group" tabIndex={-1} aria-label={`Resultados de ${noun}. ${summary}`} className="client-list-start geo-focus-ring rounded text-sm text-zinc-600 dark:text-zinc-300"><span aria-live="polite" aria-atomic="true">{summary}</span></p>;
}
export function ClientListPagination({ list, noun }: { list: ClientPagination; noun: string }) {
  if (list.pageCount <= 1) return null;
  return <nav aria-label={`Paginação de ${noun}`} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
    <p className="text-sm text-zinc-600 dark:text-zinc-300">{CLIENT_RECORD_PAGE_SIZE} registros por página</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={list.page===1} onClick={()=>list.setPage(list.page-1)} className={secondarySmallActionButtonClass}>Anterior</button><button type="button" disabled={list.page===list.pageCount} onClick={()=>list.setPage(list.page+1)} className={secondarySmallActionButtonClass}>Próxima</button></div>
  </nav>;
}
export function ClientListNoResults({ onClear }: { onClear: () => void }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700"><p className="text-sm text-zinc-700 dark:text-zinc-200">Nenhum registro corresponde à busca ou aos filtros.</p><button type="button" onClick={onClear} className={secondarySmallActionButtonClass + ' mt-3'}>Mostrar todos os registros</button></div>;
}
