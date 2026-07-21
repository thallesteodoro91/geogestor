import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { PopoverSurface } from '../../components/form-controls/PopoverSurface';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function usePopoverDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
  containerRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  popoverRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef?.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, open, popoverRef, setOpen, triggerRef]);
}

interface MonthYearPickerProps {
  id: string;
  value: string;
  onChange: (monthKey: string) => void;
  className?: string;
}

export function MonthYearPicker({ id, value, onChange, className }: MonthYearPickerProps) {
  const parsedValue = /^\d{4}-\d{2}$/.test(value) ? value.split('-').map(Number) : [];
  const selectedYear = parsedValue[0] || new Date().getFullYear();
  const selectedMonth = (parsedValue[1] || new Date().getMonth() + 1) - 1;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  usePopoverDismiss(open, setOpen, containerRef, triggerRef, popoverRef);

  const months = useMemo(() => Array.from({ length: 12 }, (_, month) => ({
    month,
    short: capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(2024, month, 1)).replace('.', '')),
    long: capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2024, month, 1)))
  })), []);
  const selectedLabel = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth, 1)));

  const selectMonth = (year: number, month: number) => {
    onChange(`${year}-${String(month + 1).padStart(2, '0')}`);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={`Escolher mês e ano. Atual: ${selectedLabel}`}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open) setViewYear(selectedYear);
          setOpen((current) => !current);
        }}
        className="geo-focus-ring flex min-h-11 min-w-0 items-center gap-2 rounded-[var(--control-radius)] border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-[background-color,border-color,color,box-shadow] hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-100"
      >
        <CalendarBlank aria-hidden="true" weight="duotone" className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <CaretDown aria-hidden="true" weight="bold" className={cn('ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <PopoverSurface ref={popoverRef} open={open} anchorRef={triggerRef} id={popoverId} role="dialog" ariaLabel="Escolher mês e ano" minWidth={304} maxWidth={320} maxHeight={420} className="p-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setViewYear((year) => year - 1)} aria-label="Ano anterior" className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-brand-surface-subtle hover:text-indigo-700 dark:text-zinc-300 dark:hover:text-indigo-200">
              <CaretLeft aria-hidden="true" weight="bold" className="h-4 w-4" />
            </button>
            <strong className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{viewYear}</strong>
            <button type="button" onClick={() => setViewYear((year) => year + 1)} aria-label="Próximo ano" className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-brand-surface-subtle hover:text-indigo-700 dark:text-zinc-300 dark:hover:text-indigo-200">
              <CaretRight aria-hidden="true" weight="bold" className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {months.map((item) => {
              const selected = viewYear === selectedYear && item.month === selectedMonth;
              return (
                <button
                  key={item.month}
                  type="button"
                  aria-label={`${item.long} de ${viewYear}`}
                  aria-pressed={selected}
                  onClick={() => selectMonth(viewYear, item.month)}
                  className={cn(
                    'geo-focus-ring min-h-11 rounded-lg px-2 text-xs font-semibold transition-[background-color,color,border-color] hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-100',
                    selected ? 'bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white dark:bg-indigo-400 dark:text-indigo-950' : 'text-zinc-600 dark:text-zinc-300'
                  )}
                >
                  {item.short}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => selectMonth(new Date().getFullYear(), new Date().getMonth())} className="geo-focus-ring mt-2 min-h-11 w-full rounded-lg border border-brand-border text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-400/10">
            Ir para o mês atual
          </button>
      </PopoverSurface>
    </div>
  );
}

interface CalendarDatePickerProps {
  id: string;
  name: string;
  value: string;
  onChange: (dateKey: string) => void;
  eventDates?: Set<string>;
  invalid?: boolean;
  describedBy?: string;
}

export function CalendarDatePicker({ id, name, value, onChange, eventDates = new Set(), invalid, describedBy }: CalendarDatePickerProps) {
  const selectedDate = parseDateKey(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date());
  const [showMonths, setShowMonths] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDayRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  usePopoverDismiss(open, setOpen, containerRef, triggerRef, popoverRef);

  useEffect(() => {
    if (!open || showMonths) return;
    window.requestAnimationFrame(() => selectedDayRef.current?.focus());
  }, [open, showMonths]);

  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const visibleCellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
    return Array.from({ length: visibleCellCount }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [viewMonth]);
  const monthLabel = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewMonth));
  const valueLabel = selectedDate
    ? new Intl.DateTimeFormat('pt-BR').format(selectedDate)
    : 'Selecionar data';
  const todayKey = toDateKey(new Date());

  const chooseDate = (date: Date) => {
    onChange(toDateKey(date));
    setOpen(false);
    setShowMonths(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onClick={() => {
          if (!open && selectedDate) setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(geoFieldClass, 'flex h-12 w-full items-center px-4 text-left text-sm font-semibold tabular-nums')}
      >
        <span className={cn('min-w-0 flex-1 truncate', selectedDate ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400')}>{valueLabel}</span>
        <CaretDown aria-hidden="true" weight="bold" className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <PopoverSurface ref={popoverRef} open={open} anchorRef={triggerRef} id={popoverId} role="dialog" ariaLabel="Selecionar data do compromisso" minWidth={304} maxWidth={336} maxHeight={520} className="p-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior" className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-brand-surface-subtle hover:text-indigo-700 dark:text-zinc-300 dark:hover:text-indigo-200">
              <CaretLeft aria-hidden="true" weight="bold" className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setShowMonths((current) => !current)} aria-expanded={showMonths} className="geo-focus-ring min-h-11 rounded-lg px-3 text-sm font-bold text-zinc-900 hover:bg-brand-surface-subtle dark:text-zinc-100">
              {monthLabel}
            </button>
            <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Próximo mês" className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-brand-surface-subtle hover:text-indigo-700 dark:text-zinc-300 dark:hover:text-indigo-200">
              <CaretRight aria-hidden="true" weight="bold" className="h-4 w-4" />
            </button>
          </div>

          {showMonths ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, month) => {
                const label = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(2024, month, 1)).replace('.', ''));
                return (
                  <button key={month} type="button" onClick={() => { setViewMonth(new Date(viewMonth.getFullYear(), month, 1)); setShowMonths(false); }} className={cn('geo-focus-ring min-h-11 rounded-lg text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-100', month === viewMonth.getMonth() ? 'bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white dark:bg-indigo-400 dark:text-indigo-950' : 'text-zinc-600 dark:text-zinc-300')}>
                    {label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear() - 1, month.getMonth(), 1))} className="geo-focus-ring col-span-1 min-h-11 rounded-lg border border-brand-border text-xs font-semibold text-zinc-600 hover:bg-brand-surface-subtle dark:text-zinc-300">{viewMonth.getFullYear() - 1}</button>
              <span className="flex min-h-11 items-center justify-center text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{viewMonth.getFullYear()}</span>
              <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear() + 1, month.getMonth(), 1))} className="geo-focus-ring col-span-1 min-h-11 rounded-lg border border-brand-border text-xs font-semibold text-zinc-600 hover:bg-brand-surface-subtle dark:text-zinc-300">{viewMonth.getFullYear() + 1}</button>
            </div>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
                {WEEKDAYS.map((weekday) => <span key={weekday} className="py-1 text-center text-[10px] font-bold uppercase text-zinc-400">{weekday}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((date) => {
                  const key = toDateKey(date);
                  const selected = key === value;
                  const today = key === todayKey;
                  const outside = date.getMonth() !== viewMonth.getMonth();
                  const hasEvents = eventDates.has(key);
                  return (
                    <button
                      key={key}
                      ref={selected ? selectedDayRef : undefined}
                      type="button"
                      aria-label={`${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}${hasEvents ? ', com eventos' : ''}`}
                      aria-current={today ? 'date' : undefined}
                      aria-pressed={selected}
                      onClick={() => chooseDate(date)}
                      className={cn(
                        'geo-focus-ring relative flex aspect-square min-h-10 items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition-[background-color,color,border-color]',
                        selected
                          ? 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950'
                          : today
                            ? 'border border-indigo-400 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-300/50 dark:text-indigo-200 dark:hover:bg-indigo-400/10'
                            : 'text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-zinc-200 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-100',
                        outside && !selected && 'text-zinc-400 dark:text-zinc-600'
                      )}
                    >
                      {date.getDate()}
                      {hasEvents && <span aria-hidden="true" className={cn('absolute bottom-1 h-1 w-1 rounded-full', selected ? 'bg-white dark:bg-indigo-950' : 'bg-emerald-500')} />}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => chooseDate(new Date())} className="geo-focus-ring mt-2 min-h-11 w-full rounded-lg border border-brand-border text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-400/10">
                Hoje
              </button>
            </>
          )}
      </PopoverSurface>
    </div>
  );
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function roundedTime(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return formatTime(date);
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  const digits = trimmed.replace(/\D/g, '');
  const hour = colonMatch ? Number(colonMatch[1]) : digits.length <= 2 ? Number(digits) : Number(digits.slice(0, -2));
  const minute = colonMatch ? Number(colonMatch[2]) : digits.length <= 2 ? 0 : Number(digits.slice(-2));
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface TimePickerProps {
  id: string;
  name: string;
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function TimePicker({ id, name, value, onChange, disabled, invalid, describedBy }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  usePopoverDismiss(open, setOpen, containerRef, inputRef, popoverRef);

  const slots = useMemo(() => Array.from({ length: 96 }, (_, index) => {
    const hours = Math.floor(index / 4);
    const minutes = (index % 4) * 15;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }), []);
  const filteredSlots = useMemo(() => {
    if (!typed || !value.trim()) return slots;
    const digits = value.replace(/\D/g, '');
    const query = digits.length === 1 ? `0${digits}` : digits;
    return slots.filter((slot) => slot.replace(':', '').startsWith(query));
  }, [slots, typed, value]);
  const presets = [
    { label: 'Agora', value: roundedTime() },
    { label: '+30 min', value: roundedTime(30) },
    { label: '09:00', value: '09:00' },
    { label: '13:30', value: '13:30' },
    { label: '18:00', value: '18:00' }
  ];

  const openPicker = () => {
    setTyped(false);
    const currentIndex = slots.indexOf(normalizeTime(value) ?? value);
    setActiveIndex(Math.max(0, currentIndex));
    setOpen(true);
    window.requestAnimationFrame(() => {
      const activeSlot = slots[Math.max(0, currentIndex)];
      document.getElementById(`${listboxId}-${activeSlot.replace(':', '')}`)?.scrollIntoView({ block: 'center' });
    });
  };

  const selectTime = (time: string) => {
    onChange(time);
    setTyped(false);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => Math.max(0, Math.min(filteredSlots.length - 1, current + direction)));
    }
    if (event.key === 'Enter' && open && filteredSlots[activeIndex]) {
      event.preventDefault();
      selectTime(filteredSlots[activeIndex]);
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setTyped(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && filteredSlots[activeIndex] ? `${listboxId}-${filteredSlots[activeIndex].replace(':', '')}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
        value={disabled ? 'Todo o dia' : value}
        placeholder="HH:MM"
        onFocus={openPicker}
        onClick={openPicker}
        onChange={(event) => { setTyped(true); setActiveIndex(0); onChange(event.target.value.slice(0, 5)); }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (disabled) return;
          const normalized = normalizeTime(value);
          if (normalized) onChange(normalized);
          window.setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
              setOpen(false);
              setTyped(false);
            }
          }, 0);
        }}
        className={cn(geoFieldClass, 'h-12 w-full px-4 pr-10 text-sm font-semibold tabular-nums')}
      />
      <CaretDown aria-hidden="true" weight="bold" className={cn('pointer-events-none absolute right-4 top-[1.05rem] h-3.5 w-3.5 text-zinc-400 transition-transform duration-150', open && 'rotate-180')} />

      <PopoverSurface ref={popoverRef} open={open && !disabled} anchorRef={inputRef} minWidth={280} maxWidth={352} maxHeight={360} className="p-2">
          <div className="flex flex-wrap gap-1.5 border-b border-brand-border pb-2">
            {presets.map((preset) => (
              <button key={preset.label} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectTime(preset.value)} className="geo-focus-ring min-h-9 rounded-lg border border-brand-border bg-brand-surface px-2.5 text-[11px] font-semibold text-zinc-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 dark:text-zinc-300 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-100">
                {preset.label}
              </button>
            ))}
          </div>
          <div id={listboxId} role="listbox" aria-label="Horários disponíveis" className="mt-2 max-h-52 overflow-y-auto overscroll-contain pr-1">
            {filteredSlots.length > 0 ? filteredSlots.map((slot, index) => (
              <button
                key={slot}
                id={`${listboxId}-${slot.replace(':', '')}`}
                type="button"
                role="option"
                aria-selected={slot === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectTime(slot)}
                className={cn(
                  'geo-focus-ring flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs font-semibold tabular-nums transition-[background-color,color]',
                  slot === value ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-100' : index === activeIndex ? 'bg-brand-surface-subtle text-zinc-950 dark:text-zinc-100' : 'text-zinc-600 hover:bg-brand-surface-subtle dark:text-zinc-300'
                )}
              >
                {slot}
              </button>
            )) : (
              <p className="px-3 py-4 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Nenhum horário correspondente.</p>
            )}
          </div>
      </PopoverSurface>
    </div>
  );
}

const appointmentTypes = [
  { value: 'Visita de Campo', label: 'Visita de campo' },
  { value: 'Reunião', label: 'Reunião' },
  { value: 'Ligação', label: 'Ligação' },
  { value: 'Administrativo', label: 'Administrativo' },
  { value: 'Serviço', label: 'Serviço' },
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Outro', label: 'Outro' }
];

interface AppointmentTypePickerProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}

export function AppointmentTypePicker({ id, name, value, onChange }: AppointmentTypePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  usePopoverDismiss(open, setOpen, containerRef, triggerRef, popoverRef);
  const selected = appointmentTypes.find((type) => type.value === value) ?? appointmentTypes[appointmentTypes.length - 1];

  return (
    <div ref={containerRef} className="relative min-w-0">
      <input type="hidden" name={name} value={value} />
      <button ref={triggerRef} id={id} type="button" aria-expanded={open} aria-controls={listboxId} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)} className={cn(geoFieldClass, 'flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold')}>
        <span className="min-w-0 flex-1 truncate">{selected.label}</span>
        <CaretDown aria-hidden="true" weight="bold" className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      <PopoverSurface ref={popoverRef} open={open} anchorRef={triggerRef} id={listboxId} role="listbox" ariaLabel="Tipo do compromisso" minWidth={288} maxWidth={384} maxHeight={360} className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
          {appointmentTypes.map((type) => (
            <button key={type.value} type="button" role="option" aria-selected={value === type.value} onClick={() => { onChange(type.value); setOpen(false); window.requestAnimationFrame(() => triggerRef.current?.focus()); }} className={cn('geo-focus-ring flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-semibold transition-[background-color,color]', value === type.value ? 'bg-brand-primary-50 text-brand-primary-800 dark:bg-brand-primary-400/15 dark:text-brand-primary-100' : 'text-zinc-700 hover:bg-brand-surface-subtle dark:text-zinc-200')}>
              <span className="min-w-0 truncate">{type.label}</span>
            </button>
          ))}
      </PopoverSurface>
    </div>
  );
}
