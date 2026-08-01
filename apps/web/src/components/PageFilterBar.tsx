import type { ReactNode } from 'react';
import { Funnel, X } from '@phosphor-icons/react';
import { cn } from '../utils/cn';
import { filterBarClass, filterClearButtonClass, filterControlClass } from '../utils/filterStyles';

interface PageFilterBarProps {
  search?: ReactNode;
  children?: ReactNode;
  sorting?: ReactNode;
  filtersOpen?: boolean;
  onFiltersToggle?: () => void;
  onClear?: () => void;
  activeFilterCount?: number;
  filterPanelId?: string;
  filterLabel?: string;
  className?: string;
  frameClassName?: string;
  panelClassName?: string;
}

export function PageFilterBar({
  search,
  children,
  sorting,
  filtersOpen = false,
  onFiltersToggle,
  onClear,
  activeFilterCount = 0,
  filterPanelId,
  filterLabel = 'Filtros',
  className,
  frameClassName,
  panelClassName,
}: PageFilterBarProps) {
  const hasExpandableFilters = Boolean(children && onFiltersToggle);

  return (
    <section aria-label="Busca e filtros" className={cn('mb-6 min-w-0', className)}>
      <div className={cn('mx-auto w-full min-w-0 max-w-[1400px] space-y-3', frameClassName)}>
        <div className={cn(filterBarClass, 'flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center')}>
          {search ? <div className="min-w-0 flex-1 sm:max-w-xl">{search}</div> : null}
          {sorting ? <div className="min-w-0 sm:ml-auto">{sorting}</div> : null}
          {hasExpandableFilters ? (
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls={filterPanelId}
              onClick={onFiltersToggle}
              className={cn(
                filterControlClass,
                'inline-flex shrink-0 items-center justify-center gap-2 px-4 text-zinc-700 dark:text-zinc-200',
              )}
            >
              <Funnel aria-hidden="true" className="h-4 w-4" />
              {filterLabel}
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-brand-primary-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          ) : null}
          {activeFilterCount > 0 && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className={cn(filterClearButtonClass, 'inline-flex items-center justify-center gap-2')}
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Limpar
            </button>
          ) : null}
        </div>

        {hasExpandableFilters && filtersOpen ? (
          <div
            id={filterPanelId}
            className={cn(
              'grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900',
              panelClassName,
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
