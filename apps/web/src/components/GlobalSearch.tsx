import { apiClient } from '../services/apiClient';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarBlank,
  CheckSquare,
  FileText,
  Files,
  FolderOpen,
  MagnifyingGlass,
  Receipt,
  Users,
  X
} from '@phosphor-icons/react';

type SearchResult = {
  id: string;
  type: 'Cliente' | 'Projeto' | 'Orçamento' | 'Tarefa' | 'Agenda' | 'Documento';
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  path: string;
  date?: string | null;
};

const resultIcons = {
  Cliente: Users,
  Projeto: FolderOpen,
  Orçamento: Receipt,
  Tarefa: CheckSquare,
  Agenda: CalendarBlank,
  Documento: Files
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR');

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return;
    }

    let active = true;

    const id = window.setTimeout(async () => {
      setLoading(true);

      try {
        const data = await apiClient.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`);
        if (active) {
          setResults(Array.isArray(data.results) ? data.results : []);
        }
      } catch {
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [isOpen, query]);

  const closeSearch = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const openResult = (result: SearchResult) => {
    navigate(result.path);
    closeSearch();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="geo-focus-ring hidden h-10 w-[280px] items-center justify-between rounded-full border border-brand-border bg-brand-surface/80 px-3.5 text-sm font-semibold text-zinc-600 shadow-brand backdrop-blur-md transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-brand-primary-300/55 hover:bg-brand-surface hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-brand-surface-muted dark:hover:text-white md:flex"
      >
        <span className="flex items-center gap-2">
          <MagnifyingGlass className="h-4 w-4 text-brand-primary-500 dark:text-brand-primary-200" />
          Buscar no GeoGestor
        </span>
        <kbd className="rounded-full border border-brand-border bg-brand-surface-subtle px-2 py-0.5 text-xs font-bold text-zinc-400 dark:bg-brand-surface-muted dark:text-zinc-300">
          Ctrl K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[120] bg-zinc-950/35 p-6 backdrop-blur-sm dark:bg-black/70" onMouseDown={closeSearch}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title"
            className="geo-surface-raised mx-auto mt-16 w-full max-w-2xl overflow-hidden"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-brand-border px-5 py-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary-400/25">
              <FileText aria-hidden="true" className="h-5 w-5 text-brand-primary-500 dark:text-brand-primary-200" />
              <label id="global-search-title" htmlFor="global-search-input" className="sr-only">
                Buscar no GeoGestor
              </label>
              <input
                id="global-search-input"
                ref={inputRef}
                name="global-search"
                type="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente, projeto, orçamento, tarefa, agenda ou documento…"
                className="h-10 flex-1 bg-transparent text-base font-semibold text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="geo-focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-brand-surface-subtle hover:text-zinc-900 dark:hover:bg-brand-surface-muted dark:hover:text-zinc-100"
                aria-label="Fechar busca"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[440px] overflow-y-auto p-3" aria-busy={loading}>
              {query.trim().length < 2 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Digite pelo menos 2 caracteres para pesquisar.</p>
                  <p className="mt-1 text-xs text-zinc-400">A busca cobre clientes, projetos, orçamentos, agenda, tarefas e documentos.</p>
                </div>
              ) : loading ? (
                <div className="px-5 py-12 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400" aria-live="polite">Buscando…</div>
              ) : results.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400" aria-live="polite">Nenhum resultado encontrado.</div>
              ) : (
                <div className="space-y-1.5">
                  {results.map((result) => {
                    const Icon = resultIcons[result.type];
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() => openResult(result)}
                        className="geo-focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-brand-surface-subtle focus:bg-brand-surface-subtle dark:hover:bg-brand-surface-muted dark:focus:bg-brand-surface-muted"
                      >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-surface-subtle text-zinc-600 ring-1 ring-brand-border dark:bg-brand-surface-muted dark:text-zinc-300">
                          <Icon aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-100">{result.title}</span>
                            <span className="geo-badge-base geo-badge-primary px-2 py-0.5 text-xs uppercase tracking-wide">{result.type}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {[result.subtitle, result.meta, formatDate(result.date)].filter(Boolean).join(' • ')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
