import React, { useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { secondarySmallActionButtonClass } from '../../utils/actionStyles';

export function PlanningCollection<T extends { id: string }>({ items, name, label, kind, children, className, as: Tag = 'div', focusItemId }: {
  items: T[]; name: string; label: string; kind: string; children: (item: T) => ReactNode;
  className?: string; as?: 'div' | 'ul' | 'ol'; focusItemId?: string;
}) {
  const [params, setParams] = useSearchParams();
  const summary = useRef<HTMLParagraphElement>(null);
  const pageSize = 12;
  const raw = Number(params.get(name) || 1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const focused = focusItemId || (params.get('foco')?.startsWith(`${kind}-`) ? params.get('foco')!.slice(kind.length + 1) : null);
  const focusIndex = items.findIndex(item => item.id === focused);
  const page = focusIndex >= 0 ? Math.floor(focusIndex / pageSize) + 1 : Math.min(totalPages, Math.max(1, Number.isSafeInteger(raw) ? raw : 1));
  const changePage = (value: number) => {
    const next = new URLSearchParams(params);
    next.set(name, String(value));
    next.delete('foco');
    setParams(next);
    requestAnimationFrame(() => {
      summary.current?.focus();
      summary.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
  };
  return <React.Fragment>
    <Tag className={className}>{items.slice((page - 1) * pageSize, page * pageSize).map(children)}</Tag>
    {totalPages > 1 ? <nav aria-label={`Paginação de ${label}`} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p ref={summary} tabIndex={-1} role="status" className="geo-focus-ring rounded text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{label}: página {page} de {totalPages} · {items.length} registros</p>
      <div className="flex gap-2">
        <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)} className={secondarySmallActionButtonClass} aria-label={`Página anterior de ${label}`}>Anterior</button>
        <button type="button" disabled={page === totalPages} onClick={() => changePage(page + 1)} className={secondarySmallActionButtonClass} aria-label={`Próxima página de ${label}`}>Próxima</button>
      </div>
    </nav> : null}
  </React.Fragment>;
}
