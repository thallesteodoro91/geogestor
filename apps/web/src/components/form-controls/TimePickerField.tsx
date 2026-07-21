import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Clock, X } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { PopoverSurface } from './PopoverSurface';

function normalizeTime(value: string) {
  const digits = value.replace(/\D/g, '');
  const colon = value.match(/^(\d{1,2}):(\d{1,2})$/);
  const hour = colon ? Number(colon[1]) : digits.length <= 2 ? Number(digits) : Number(digits.slice(0, -2));
  const minute = colon ? Number(colon[2]) : digits.length <= 2 ? 0 : Number(digits.slice(-2));
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface TimePickerFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  wrapperClassName?: string;
}

export function TimePickerField({ id, name, value, defaultValue, onChange, className, wrapperClassName, disabled, required, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...inputProps }: TimePickerFieldProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ''));
  const currentValue = String(controlled ? value ?? '' : internalValue);
  const [query, setQuery] = useState(currentValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const slots = useMemo(() => Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`), []);
  const filtered = useMemo(() => {
    const digits = query.replace(/\D/g, '');
    return digits ? slots.filter((slot) => slot.replace(':', '').startsWith(digits)) : slots;
  }, [query, slots]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!visibleRef.current?.parentElement?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [open]);

  const commit = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    setQuery(nextValue);
    const input = { value: nextValue, name: name || '', type: 'time' } as HTMLInputElement;
    onChange?.({ target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>);
  };
  const select = (nextValue: string) => { commit(nextValue); setOpen(false); };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(0, Math.min(filtered.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const normalized = filtered[activeIndex] || normalizeTime(query);
      if (normalized) select(normalized);
    }
    if (event.key === 'Escape') { setOpen(false); setQuery(currentValue); }
  };

  return (
    <span className={cn('relative block min-w-0 w-full', wrapperClassName)}>
      <input {...inputProps} type="hidden" name={name} value={currentValue} required={required} disabled={disabled} />
      <span className="relative block">
        <Clock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-primary-600 dark:text-brand-primary-300" />
        <input ref={visibleRef} id={id} type="text" inputMode="numeric" autoComplete="off" value={open ? query : currentValue} disabled={disabled} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} aria-expanded={open} aria-controls={listboxId} role="combobox" onFocus={() => { setQuery(currentValue); setOpen(true); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onBlur={() => { const normalized = normalizeTime(query); if (normalized) commit(normalized); }} onKeyDown={handleKeyDown} placeholder="HH:mm" className={cn(geoFieldClass, 'w-full pl-9 pr-9 font-mono tabular-nums', className)} />
        {query && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { commit(''); visibleRef.current?.focus(); }} aria-label="Limpar horário" className="geo-focus-ring absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-brand-surface-subtle"><X aria-hidden="true" size={14} /></button>}
      </span>
      <PopoverSurface ref={popoverRef} open={open} anchorRef={visibleRef} id={listboxId} role="listbox" ariaLabel={ariaLabel || 'Selecionar horário'} minWidth={180} maxWidth={240} maxHeight={320}>
        <div className="geo-option-list max-h-72 overflow-y-auto p-1.5">
          {filtered.length ? filtered.map((slot, index) => <button key={slot} type="button" role="option" aria-selected={slot === currentValue} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(slot)} className={cn('geo-option-row font-mono tabular-nums', index === activeIndex && 'geo-option-row-active', slot === currentValue && 'geo-option-row-selected')}>{slot}</button>) : <p className="p-6 text-center text-sm text-text-muted">Horário inválido.</p>}
        </div>
      </PopoverSurface>
    </span>
  );
}
