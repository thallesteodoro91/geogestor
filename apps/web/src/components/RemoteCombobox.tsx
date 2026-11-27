import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { apiClient } from '../services/apiClient';
import { cn } from '../utils/cn';
import { geoFieldClass } from '../utils/geoTheme';
import { PopoverSurface } from './form-controls/PopoverSurface';

export type RemoteOptionRecord = {
  id: string;
  nome?: string | null;
  titulo?: string | null;
  documento?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  status?: string | null;
};

interface RemoteComboboxProps<T extends RemoteOptionRecord> {
  id: string;
  name: string;
  endpoint: string;
  value: string;
  onChange: (value: string, option: T | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  selectedLabel?: string;
  listLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  fill?: boolean;
  density?: 'compact' | 'form' | 'formLarge';
  /** Portal variant for forms inside a scrolling modal. Defaults stay inline. */
  inModal?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  getOptionLabel?: (option: T) => string;
  getOptionDescription?: (option: T) => string;
}

function defaultLabel(option: RemoteOptionRecord) {
  return String(option.nome || option.titulo || option.id);
}

function defaultDescription(option: RemoteOptionRecord) {
  return String(option.documento || option.cpf || option.cnpj || option.municipio || option.cidade || option.status || '');
}

export function RemoteCombobox<T extends RemoteOptionRecord>({
  id,
  name,
  endpoint,
  value,
  onChange,
  placeholder = 'Pesquisar…',
  emptyLabel = 'Sem vínculo',
  selectedLabel = '',
  listLabel = 'Resultados da pesquisa',
  disabled = false,
  required = false,
  className,
  fill = false,
  density = 'compact',
  inModal = false,
  getOptionLabel = defaultLabel,
  getOptionDescription = defaultDescription,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid
}: RemoteComboboxProps<T>) {
  const listboxId = useId();
  const statusId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [knownSelection, setKnownSelection] = useState<T | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setActiveIndex(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const optionsQuery = useQuery<T[]>({
    queryKey: ['remote-options', endpoint, debouncedQuery, value],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: '25' });
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (value) params.set('selectedId', value);
      return apiClient.get<T[]>(`${endpoint}${endpoint.includes('?') ? '&' : '?'}${params}`, { signal });
    },
    enabled: open || Boolean(value),
    staleTime: 30_000,
    retry: 1
  });
  const options = optionsQuery.data || [];
  const selected = options.find((option) => option.id === value) || (knownSelection?.id === value ? knownSelection : null);
  const displayValue = open ? query : selected ? getOptionLabel(selected) : selectedLabel;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [open]);

  const choose = (option: T | null) => {
    setKnownSelection(option);
    onChange(option?.id || '', option);
    setOpen(false);
    setQuery('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (options.length) setActiveIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const describedBy = useMemo(() => [ariaDescribedBy, statusId].filter(Boolean).join(' ') || undefined, [ariaDescribedBy, statusId]);

  const optionsContent = <>
          {!required && (
            <button type="button" tabIndex={inModal ? -1 : undefined} role="option" aria-selected={!value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)} className="geo-option-row geo-dropdown-item">{emptyLabel}</button>
          )}
          {optionsQuery.isError ? (
            <button type="button" onClick={() => optionsQuery.refetch()} className="geo-option-row geo-dropdown-item text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30">Não foi possível carregar. Tentar novamente</button>
          ) : !optionsQuery.isFetching && options.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500">Nenhum resultado encontrado.</p>
          ) : options.map((option, index) => {
            const description = getOptionDescription(option);
            return (
              <button
                key={option.id}
                id={`${listboxId}-${option.id}`}
                type="button"
                tabIndex={inModal ? -1 : undefined}
                role="option"
                aria-selected={option.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                title={getOptionLabel(option)}
                className={cn('geo-option-row geo-dropdown-item geo-dropdown-item-multiline flex-col', index === activeIndex && 'geo-option-row-active', option.id === value && 'geo-option-row-selected')}
              >
                <span className="line-clamp-2 w-full min-w-0 break-words text-left text-sm font-medium text-zinc-950 dark:text-white">{getOptionLabel(option)}</span>
                {description && <span className="line-clamp-2 w-full min-w-0 break-words text-left text-xs text-zinc-600 dark:text-zinc-300">{description}</span>}
              </button>
            );
          })}
  </>;

  return (
    <div ref={rootRef} className={cn('relative min-w-0', fill && 'w-full')}>
      <input type="hidden" name={name} value={value} required={required} />
      <div className={cn('relative w-48 max-w-full', fill && 'w-full')}>
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          data-state={open ? 'open' : 'closed'}
          autoComplete="off"
          value={displayValue}
          title={!open && displayValue ? displayValue : undefined}
          disabled={disabled}
          placeholder={placeholder}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[activeIndex] ? `${listboxId}-${options[activeIndex].id}` : undefined}
          aria-busy={optionsQuery.isFetching || undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget as Node | null) && !popupRef.current?.contains(event.relatedTarget as Node | null)) {
              setOpen(false);
              setQuery('');
            }
          }}
          onKeyDown={onKeyDown}
          className={cn(geoFieldClass, 'geo-dropdown-trigger w-full', density !== 'compact' && (density === 'formLarge' ? 'geo-form-select-large' : 'geo-form-select'), className)}
        />
        <button type="button" tabIndex={-1} disabled={disabled} aria-label="Abrir opções" onClick={() => setOpen((current) => !current)} className={cn('absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-r-md text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:text-white', density === 'form' && 'h-11', density === 'formLarge' && 'h-12')}>
          <CaretDown aria-hidden="true" className={cn('h-4 w-4 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </div>
      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {optionsQuery.isFetching ? 'Carregando opções…' : optionsQuery.isError ? 'Falha ao carregar opções.' : `${new Intl.NumberFormat('pt-BR').format(options.length)} ${options.length === 1 ? 'resultado' : 'resultados'}.`}
      </span>
      {open && (inModal ? (
        <PopoverSurface open anchorRef={inputRef} ref={popupRef} minWidth={0} maxWidth={1024} maxHeight={256} role="listbox" id={listboxId} ariaLabel={listLabel} className="geo-dropdown-content overflow-y-auto p-1">{optionsContent}</PopoverSurface>
      ) : (
        <div className={cn('geo-popover-surface geo-dropdown-content absolute left-0 z-50 mt-1 max-h-64 w-48 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain p-1', fill && 'w-full max-w-full')} id={listboxId} role="listbox" aria-label={listLabel}>{optionsContent}</div>
      ))}
    </div>
  );
}
