import { CalendarBlank, CaretDown, Check } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { DatePickerField } from '../../components/Form';
import { PopoverSurface } from '../../components/form-controls/PopoverSurface';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import type { ReportPeriodPreset } from './reportPeriodPresets';

type PeriodOption = { id: ReportPeriodPreset | 'custom'; label: string };

interface ReportPeriodMenuProps {
  options: PeriodOption[];
  activeOption: ReportPeriodPreset | 'custom' | null;
  customSelected: boolean;
  startDate: string;
  endDate: string;
  invalidRange: boolean;
  guidance: string | null;
  onSelectPreset: (preset: ReportPeriodPreset) => void;
  onSelectCustom: () => void;
  onUpdateCustomDate: (name: 'inicio' | 'fim', value: string) => void;
  onClearCustomPeriod: () => void;
}

export function ReportPeriodMenu({
  options,
  activeOption,
  customSelected,
  startDate,
  endDate,
  invalidRange,
  guidance,
  onSelectPreset,
  onSelectCustom,
  onUpdateCustomDate,
  onClearCustomPeriod
}: ReportPeriodMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const activeLabel = options.find((option) => option.id === activeOption)?.label ?? 'Todo o histórico';

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectOption = (id: PeriodOption['id']) => {
    if (id === 'custom') {
      onSelectCustom();
      return;
    }
    onSelectPreset(id);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Selecionar período de análise. Atual: ${activeLabel}`}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-zinc-100 transition-[background-color,border-color,color] hover:border-indigo-400/50 hover:bg-zinc-800 hover:text-white"
      >
        <CalendarBlank aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-300" weight="duotone" />
        <span className="whitespace-nowrap">Período: {activeLabel}</span>
        <CaretDown aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} weight="bold" />
      </button>

      <PopoverSurface
        ref={popoverRef}
        open={open}
        anchorRef={triggerRef}
        id={popoverId}
        role="dialog"
        ariaLabel="Selecionar período de análise"
        minWidth={288}
        maxWidth={360}
        maxHeight={520}
        className="p-2"
      >
        <div className="px-2 pb-2 pt-1">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Período de análise</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">O recorte atualiza indicadores, comparações, tabelas e o PDF.</p>
        </div>
        <div role="group" aria-label="Atalhos de período" className="grid gap-1">
          {options.map((option) => {
            const selected = activeOption === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectOption(option.id)}
                className={cn(
                  'geo-focus-ring flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium transition-[background-color,color] motion-reduce:transition-none',
                  selected
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                )}
              >
                <span>{option.label}</span>
                {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" weight="bold" /> : null}
              </button>
            );
          })}
        </div>

        {customSelected ? (
          <div className="mt-2 border-t border-zinc-200 px-2 pt-3 dark:border-zinc-800">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Data inicial
                <DatePickerField name="report-start-date" autoComplete="off" value={startDate} max={endDate || undefined} onChange={(event) => onUpdateCustomDate('inicio', event.target.value)} className={cn(geoFieldClass, 'mt-1 h-11 min-h-11 w-full')} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'report-period-error' : undefined} />
              </label>
              <label className="min-w-0 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Data final
                <DatePickerField name="report-end-date" autoComplete="off" value={endDate} min={startDate || undefined} onChange={(event) => onUpdateCustomDate('fim', event.target.value)} className={cn(geoFieldClass, 'mt-1 h-11 min-h-11 w-full')} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'report-period-error' : undefined} />
              </label>
            </div>
            {startDate || endDate ? <button type="button" onClick={onClearCustomPeriod} className="geo-focus-ring mt-2 min-h-10 rounded-lg px-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">Limpar período</button> : null}
            {invalidRange ? <p id="report-period-error" role="alert" className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">A data inicial deve ser anterior ou igual à data final.</p> : null}
            {!invalidRange && guidance ? <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{guidance}</p> : null}
          </div>
        ) : null}
      </PopoverSurface>
    </div>
  );
}
