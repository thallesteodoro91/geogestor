import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CaretDown, Check, MagnifyingGlass, X } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { PopoverSurface } from './PopoverSurface';

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
}

function optionText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(optionText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return optionText(node.props.children);
  return '';
}

function readOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    if (element.type === 'option') {
      options.push({
        value: element.props.value === undefined ? optionText(element.props.children) : String(element.props.value),
        label: optionText(element.props.children),
        disabled: Boolean(element.props.disabled)
      });
    }
  });
  return options;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'> {
  wrapperClassName?: string;
  loading?: boolean;
  compactCaret?: boolean;
  searchable?: boolean | 'auto';
  searchPlaceholder?: string;
  emptyMessage?: string;
  popoverClassName?: string;
}

export function SelectField({
  children,
  className,
  wrapperClassName,
  disabled,
  loading = false,
  compactCaret = false,
  searchable = 'auto',
  searchPlaceholder = 'Pesquisar…',
  emptyMessage = 'Nenhuma opção encontrada.',
  popoverClassName,
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...nativeProps
}: SelectFieldProps) {
  const options = useMemo(() => readOptions(children), [children]);
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
  const currentValue = String(controlled ? value ?? '' : internalValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const shouldSearch = searchable === true || (searchable === 'auto' && options.length > 12);
  const selected = options.find((option) => option.value === currentValue);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return normalized ? options.filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(normalized)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    if (shouldSearch) window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, shouldSearch]);

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

  const choose = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    const native = nativeRef.current;
    if (native) {
      native.value = nextValue;
      onChange?.({ target: native, currentTarget: native } as ChangeEvent<HTMLSelectElement>);
    }
    setOpen(false);
    setQuery('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveActive = (direction: number) => {
    if (!filtered.length) return;
    setActiveIndex((current) => {
      let next = current;
      do next = (next + direction + filtered.length) % filtered.length;
      while (filtered[next]?.disabled && next !== current);
      return next;
    });
  };

  const handleNavigation = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
    }
    if (event.key === 'Home' && open) { event.preventDefault(); setActiveIndex(0); }
    if (event.key === 'End' && open) { event.preventDefault(); setActiveIndex(Math.max(0, filtered.length - 1)); }
    if ((event.key === 'Enter' || event.key === ' ') && open && filtered[activeIndex] && !filtered[activeIndex].disabled) {
      event.preventDefault();
      choose(filtered[activeIndex].value);
    }
    if (event.key === 'Tab') setOpen(false);
  };

  const toggleOpen = () => {
    setQuery('');
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === currentValue)));
    setOpen((current) => !current);
  };

  return (
    <span className={cn('relative block min-w-0 w-full', wrapperClassName)}>
      <select
        {...nativeProps}
        ref={nativeRef}
        name={name}
        value={currentValue}
        required={required}
        disabled={disabled || loading}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {children}
      </select>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
        aria-required={required || undefined}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        onClick={toggleOpen}
        onKeyDown={handleNavigation}
        className={cn(
          geoFieldClass,
          'geo-select-trigger flex w-full appearance-none items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60',
          compactCaret ? 'pr-8' : 'pr-10',
          className
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-zinc-400')}>{loading ? 'Carregando…' : selected?.label || 'Selecione…'}</span>
        <CaretDown aria-hidden="true" weight="bold" className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-150 motion-reduce:transition-none dark:text-zinc-400', open && 'rotate-180')} />
      </button>

      <PopoverSurface ref={popoverRef} open={open} anchorRef={triggerRef} id={listboxId} role="listbox" ariaLabel={ariaLabel || 'Opções'} minWidth={180} className={popoverClassName}>
        {shouldSearch && (
          <div className="border-b border-brand-border p-2">
            <label className="relative block">
              <span className="sr-only">Pesquisar opções</span>
              <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                onKeyDown={handleNavigation}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className={cn(geoFieldClass, 'h-10 w-full pl-9 pr-9 text-sm')}
              />
              {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Limpar pesquisa" className="geo-focus-ring absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-brand-surface-subtle hover:text-zinc-700 dark:hover:text-zinc-100"><X aria-hidden="true" size={15} /></button>}
            </label>
            <p className="mt-1.5 px-1 text-[11px] font-medium text-text-muted" aria-live="polite">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</p>
          </div>
        )}
        <div className="geo-option-list max-h-[min(22rem,calc(100vh-6rem))] overflow-y-auto p-1.5">
          {filtered.length ? filtered.map((option, index) => {
            const isSelected = option.value === currentValue;
            const active = index === activeIndex;
            return (
              <button
                key={`${option.value}-${index}`}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
                className={cn('geo-option-row', active && 'geo-option-row-active', isSelected && 'geo-option-row-selected')}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected && <Check aria-hidden="true" weight="bold" className="h-4 w-4 shrink-0" />}
              </button>
            );
          }) : <p className="px-3 py-8 text-center text-sm font-medium text-text-muted">{emptyMessage}</p>}
        </div>
      </PopoverSurface>
    </span>
  );
}

export const ComboboxField = SelectField;
export const FormSelect = SelectField;
