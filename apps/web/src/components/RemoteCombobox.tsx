import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { apiClient } from '../services/apiClient';
import { cn } from '../utils/cn';
import { geoFieldClass } from '../utils/geoTheme';

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
  disabled?: boolean;
  required?: boolean;
  className?: string;
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
  disabled = false,
  required = false,
  className,
  getOptionLabel = defaultLabel,
  getOptionDescription = defaultDescription,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid
}: RemoteComboboxProps<T>) {
  const listboxId = useId();
  const statusId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
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
      if (!rootRef.current?.contains(event.target as Node)) {
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
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const describedBy = useMemo(() => [ariaDescribedBy, statusId].filter(Boolean).join(' ') || undefined, [ariaDescribedBy, statusId]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input type="hidden" name={name} value={value} required={required} />
      <div className="relative">
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          value={displayValue}
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
          onKeyDown={onKeyDown}
          className={cn(geoFieldClass, 'h-12 w-full pl-10 pr-10', className)}
        />
        <button type="button" tabIndex={-1} aria-label="Abrir opções" onClick={() => setOpen((current) => !current)} className="absolute right-0 top-0 flex h-12 w-10 items-center justify-center rounded-r-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
          <CaretDown aria-hidden="true" className={cn('h-4 w-4 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </div>
      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {optionsQuery.isFetching ? 'Carregando opções…' : optionsQuery.isError ? 'Falha ao carregar opções.' : `${options.length} resultado(s).`}
      </span>
      {open && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900" id={listboxId} role="listbox">
          {!required && (
            <button type="button" role="option" aria-selected={!value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:text-zinc-300 dark:hover:bg-zinc-800">{emptyLabel}</button>
          )}
          {optionsQuery.isError ? (
            <button type="button" onClick={() => optionsQuery.refetch()} className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30">Não foi possível carregar. Tentar novamente</button>
          ) : !optionsQuery.isFetching && options.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500">Nenhum resultado encontrado.</p>
          ) : options.map((option, index) => {
            const description = getOptionDescription(option);
            return (
              <button
                key={option.id}
                id={`${listboxId}-${option.id}`}
                type="button"
                role="option"
                aria-selected={option.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={cn('flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:hover:bg-zinc-800', index === activeIndex && 'bg-zinc-100 dark:bg-zinc-800')}
              >
                <span className="truncate text-sm font-medium text-zinc-950 dark:text-white">{getOptionLabel(option)}</span>
                {description && <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{description}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
