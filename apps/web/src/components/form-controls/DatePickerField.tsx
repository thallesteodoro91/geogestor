import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { CalendarBlank, CaretDown, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { PopoverSurface } from './PopoverSurface';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(value: string | number | readonly string[] | undefined) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export interface DatePickerFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  wrapperClassName?: string;
  allowClear?: boolean;
}

export function DatePickerField({
  id,
  name,
  value,
  defaultValue,
  onChange,
  className,
  wrapperClassName,
  disabled,
  readOnly,
  required,
  min,
  max,
  allowClear = !required,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...inputProps
}: DatePickerFieldProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ''));
  const currentValue = String(controlled ? value ?? '' : internalValue);
  const selectedDate = parseDateKey(currentValue);
  const [open, setOpen] = useState(false);
  const [showMonths, setShowMonths] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [activeDate, setActiveDate] = useState(() => selectedDate || new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const activeDayRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const minDate = parseDateKey(typeof min === 'string' ? min : undefined);
  const maxDate = parseDateKey(typeof max === 'string' ? max : undefined);
  const today = new Date();
  const todayKey = toDateKey(today);

  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [viewMonth]);

  useEffect(() => {
    if (open && !showMonths) window.requestAnimationFrame(() => activeDayRef.current?.focus());
  }, [activeDate, open, showMonths, viewMonth]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const commit = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    const input = inputRef.current;
    if (input) {
      input.value = nextValue;
      onChange?.({ target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>);
    }
  };

  const dateDisabled = (date: Date) => Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
  const selectDate = (date: Date) => {
    if (readOnly || dateDisabled(date)) return;
    commit(toDateKey(date));
    setOpen(false);
    setShowMonths(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveActive = (days: number) => {
    const next = new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate() + days);
    setActiveDate(next);
    setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveActive(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); moveActive(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-7); }
    if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(7); }
    if (event.key === 'Home') { event.preventDefault(); moveActive(-activeDate.getDay()); }
    if (event.key === 'End') { event.preventDefault(); moveActive(6 - activeDate.getDay()); }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const direction = event.key === 'PageUp' ? -1 : 1;
      const next = new Date(activeDate.getFullYear() + (event.shiftKey ? direction : 0), activeDate.getMonth() + (event.shiftKey ? 0 : direction), activeDate.getDate());
      setActiveDate(next);
      setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectDate(activeDate); }
  };

  const openPicker = () => {
    const base = selectedDate || new Date();
    setActiveDate(base);
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setShowMonths(false);
    setOpen((current) => !current);
  };

  const valueLabel = selectedDate ? new Intl.DateTimeFormat('pt-BR').format(selectedDate) : 'Selecionar data';
  const monthLabel = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewMonth));

  return (
    <span className={cn('relative block min-w-0 w-full', wrapperClassName)}>
      <input {...inputProps} ref={inputRef} type="hidden" name={name} value={currentValue} required={required} disabled={disabled} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        aria-required={required || undefined}
        aria-readonly={readOnly || undefined}
        disabled={disabled}
        onClick={openPicker}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) openPicker(); } }}
        className={cn(geoFieldClass, 'geo-date-trigger flex w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60', className)}
      >
        <CalendarBlank aria-hidden="true" weight="duotone" className="h-4 w-4 shrink-0 text-brand-primary-600 dark:text-brand-primary-300" />
        <span className={cn('min-w-0 flex-1 truncate font-medium tabular-nums', !selectedDate && 'text-zinc-600 dark:text-zinc-300')}>{valueLabel}</span>
        <CaretDown aria-hidden="true" weight="bold" className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
      </button>

      <PopoverSurface ref={popoverRef} open={open} anchorRef={triggerRef} id={popoverId} role="dialog" ariaLabel={ariaLabel || 'Selecionar data'} minWidth={304} maxWidth={336} maxHeight={520} className="p-3">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior" className="geo-popover-icon-button"><CaretLeft aria-hidden="true" weight="bold" size={17} /></button>
          <button type="button" onClick={() => setShowMonths((current) => !current)} aria-expanded={showMonths} className="geo-focus-ring min-h-11 rounded-[var(--control-radius)] px-3 text-sm font-bold text-text-primary hover:bg-brand-surface-subtle">{monthLabel}</button>
          <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Próximo mês" className="geo-popover-icon-button"><CaretRight aria-hidden="true" weight="bold" size={17} /></button>
        </div>

        {showMonths ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, month) => {
              const label = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(2024, month, 1)).replace('.', ''));
              const selected = month === viewMonth.getMonth();
              return <button key={month} type="button" onClick={() => { setViewMonth(new Date(viewMonth.getFullYear(), month, 1)); setShowMonths(false); }} className={cn('geo-calendar-month', selected && 'geo-calendar-month-selected')}>{label}</button>;
            })}
            <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear() - 1, month.getMonth(), 1))} className="geo-calendar-year">{viewMonth.getFullYear() - 1}</button>
            <span className="flex min-h-11 items-center justify-center text-xs font-bold tabular-nums text-text-primary">{viewMonth.getFullYear()}</span>
            <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear() + 1, month.getMonth(), 1))} className="geo-calendar-year">{viewMonth.getFullYear() + 1}</button>
          </div>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">{WEEKDAYS.map((weekday, index) => <span key={`${weekday}-${index}`} className="py-1 text-center text-[10px] font-bold uppercase text-text-muted">{weekday}</span>)}</div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel}>
              {cells.map((date) => {
                const key = toDateKey(date);
                const selected = key === currentValue;
                const active = key === toDateKey(activeDate);
                const outside = date.getMonth() !== viewMonth.getMonth();
                const isToday = key === todayKey;
                const unavailable = dateDisabled(date);
                return (
                  <button
                    key={key}
                    ref={active ? activeDayRef : undefined}
                    type="button"
                    role="gridcell"
                    tabIndex={active ? 0 : -1}
                    aria-label={new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}
                    aria-current={isToday ? 'date' : undefined}
                    aria-selected={selected}
                    disabled={unavailable}
                    onClick={() => selectDate(date)}
                    onKeyDown={handleDayKeyDown}
                    className={cn('geo-calendar-day', selected && 'geo-calendar-day-selected', isToday && !selected && 'geo-calendar-day-today', outside && !selected && 'geo-calendar-day-outside')}
                  >{date.getDate()}</button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2 border-t border-brand-border pt-2">
              {allowClear && !readOnly && <button type="button" onClick={() => { commit(''); setOpen(false); triggerRef.current?.focus(); }} className="geo-calendar-footer-action text-rose-600 dark:text-rose-300">Limpar</button>}
              <button type="button" disabled={dateDisabled(today) || readOnly} onClick={() => selectDate(today)} className="geo-calendar-footer-action ml-auto text-brand-primary-700 dark:text-brand-primary-200">Hoje</button>
            </div>
          </>
        )}
      </PopoverSurface>
    </span>
  );
}
