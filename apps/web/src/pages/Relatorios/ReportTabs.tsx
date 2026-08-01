import { Briefcase, ChartLineUp, Coins } from '@phosphor-icons/react';
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../../utils/cn';
import { REPORT_TYPES, type ReportType } from './reportPresentation';

const TABS = [
  { type: 'financeiro' as const, label: 'Financeiro', icon: Coins },
  { type: 'projetos' as const, label: 'Projetos', icon: Briefcase },
  { type: 'executivo' as const, label: 'Executivo', icon: ChartLineUp }
];

export function ReportTabs({
  value,
  onChange
}: {
  value: ReportType;
  onChange: (type: ReportType) => void;
}) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, type: ReportType) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = REPORT_TYPES.indexOf(type);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? REPORT_TYPES.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + REPORT_TYPES.length) % REPORT_TYPES.length;
    const next = REPORT_TYPES[nextIndex];
    onChange(next);
    tabListRef.current?.querySelector<HTMLButtonElement>(`[data-report-tab="${next}"]`)?.focus();
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Tipo de relatório"
      className="grid w-full grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:w-fit"
    >
      {TABS.map(({ type, label, icon: Icon }) => {
        const selected = value === type;
        return (
          <button
            key={type}
            id={`report-tab-${type}`}
            data-report-tab={type}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="report-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(type)}
            onKeyDown={(event) => handleKeyDown(event, type)}
            className={cn(
              'geo-focus-ring inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-[background-color,color,box-shadow] motion-reduce:transition-none sm:min-w-32 sm:gap-2 sm:px-3 sm:text-sm',
              selected
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-white'
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn('h-4 w-4 shrink-0', selected ? 'text-indigo-600 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-500')}
              weight={selected ? 'fill' : 'regular'}
            />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
