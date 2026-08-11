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
      className="flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              'geo-focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold transition-[background-color,color] motion-reduce:transition-none sm:px-4 sm:text-sm',
              selected
                ? 'bg-indigo-500/20 text-indigo-100'
                : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
            )}
          >
            <span className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
              selected ? 'bg-indigo-500/30 text-indigo-100' : 'bg-zinc-800 text-zinc-400'
            )}>
              <Icon aria-hidden="true" className="h-4 w-4" weight={selected ? 'fill' : 'regular'} />
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
