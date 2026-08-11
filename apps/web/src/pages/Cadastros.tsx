import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowCounterClockwise,
  CurrencyDollar,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SquaresFour,
  Tag,
  Prohibit,
  Wrench
} from '@phosphor-icons/react';
import {
  DEFAULT_EXPENSE_CATALOG,
  DEFAULT_SERVICE_CATALOG,
  normalizeCatalogLabel,
  type ExpenseCatalogItem,
  type ServiceCatalogItem
} from '@geogestor/contracts/src/auxiliary-catalogs';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError, FormField, FormFooter, FormSection, FormSelect, NumericInput } from '../components/Form';
import { cn } from '../utils/cn';
import { filterSearchInputClass } from '../utils/filterStyles';
import {
  headerPrimaryActionButtonClass,
  headerPrimaryActionIconClass,
  primarySubmitButtonClass
} from '../utils/actionStyles';
import { notifications } from '../services/notifications';
import { saveExpenseCatalog, saveServiceCatalog } from '../services/auxiliaryCatalogs';
import { auxiliaryCatalogQueryKey, useAuxiliaryCatalogs } from '../hooks/useAuxiliaryCatalogs';
import { useDebounce } from '../hooks/useDebounce';

type CatalogTab = 'servicos' | 'despesas';
type CatalogStatus = 'ativos' | 'inativos' | 'todos';
type StatusTarget = { id: string; name: string; type: CatalogTab; nextActive: boolean };

const SERVICE_CATEGORY_PRESETS = ['Topografia', 'Georreferenciamento', 'Regularização', 'Consultoria', 'Licenciamento'];
const EXPENSE_CATEGORY_PRESETS = DEFAULT_EXPENSE_CATALOG.map((item) => item.categoria).filter((item) => item !== 'Outros');

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function parseCurrencyToCents(value: string) {
  const compact = value.trim().replace(/\s/g, '');
  const sanitized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
    : compact.replace(/[^\d.]/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${new Intl.NumberFormat('pt-BR').format(count)} ${count === 1 ? singular : pluralForm}`;
}

function sortServices(items: ServiceCatalogItem[]) {
  return [...items].sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR', { sensitivity: 'base' }));
}

function sortExpenses(items: ExpenseCatalogItem[]) {
  return [...items].sort((left, right) => left.categoria.localeCompare(right.categoria, 'pt-BR', { sensitivity: 'base' }));
}

export function Cadastros() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogsQuery = useAuxiliaryCatalogs();
  const services = catalogsQuery.data?.services ?? DEFAULT_SERVICE_CATALOG;
  const expenses = catalogsQuery.data?.expenses ?? DEFAULT_EXPENSE_CATALOG;
  const activeTab: CatalogTab = searchParams.get('aba') === 'despesas' ? 'despesas' : 'servicos';
  const status: CatalogStatus = ['ativos', 'inativos', 'todos'].includes(searchParams.get('status') || '')
    ? searchParams.get('status') as CatalogStatus
    : 'ativos';
  const [search, setSearch] = useState(searchParams.get('busca') || '');
  const debouncedSearch = useDebounce(search, 300);
  const lastUrlSearchRef = useRef(searchParams.get('busca') || '');
  const [showModal, setShowModal] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [initialFingerprint, setInitialFingerprint] = useState('');
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [catalogActionError, setCatalogActionError] = useState('');
  const serviceTabRef = useRef<HTMLButtonElement>(null);
  const expenseTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const urlSearch = searchParams.get('busca') || '';
    if (urlSearch === lastUrlSearchRef.current) return;
    lastUrlSearchRef.current = urlSearch;
    setSearch(urlSearch);
  }, [searchParams]);

  useEffect(() => {
    const urlSearch = searchParams.get('busca') || '';
    if (debouncedSearch === urlSearch) return;
    lastUrlSearchRef.current = debouncedSearch;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (debouncedSearch) next.set('busca', debouncedSearch);
      else next.delete('busca');
      return next;
    }, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const [servNome, setServNome] = useState('');
  const [servCategoria, setServCategoria] = useState('Topografia');
  const [servCategoriaCustom, setServCategoriaCustom] = useState('');
  const [servValor, setServValor] = useState('');
  const [despCategoria, setDespCategoria] = useState('Combustível');
  const [despCategoriaCustom, setDespCategoriaCustom] = useState('');
  const [despDescricao, setDespDescricao] = useState('');

  const currentServiceCategory = servCategoria === 'Outro' ? servCategoriaCustom : servCategoria;
  const currentExpenseCategory = despCategoria === 'Outro' ? despCategoriaCustom : despCategoria;
  const editorFingerprint = JSON.stringify(activeTab === 'servicos'
    ? { servNome, categoria: currentServiceCategory, servValor }
    : { categoria: currentExpenseCategory, despDescricao });
  const hasUnsavedChanges = showModal && Boolean(initialFingerprint) && editorFingerprint !== initialFingerprint;

  const persistMutation = useMutation({
    mutationFn: async (input: { type: CatalogTab; services?: ServiceCatalogItem[]; expenses?: ExpenseCatalogItem[] }) => {
      if (input.type === 'servicos') return { type: input.type, services: await saveServiceCatalog(input.services || []) } as const;
      return { type: input.type, expenses: await saveExpenseCatalog(input.expenses || []) } as const;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(auxiliaryCatalogQueryKey, (current: typeof catalogsQuery.data) => ({
        services: result.type === 'servicos' ? result.services : current?.services ?? services,
        expenses: result.type === 'despesas' ? result.expenses : current?.expenses ?? expenses,
        source: 'database' as const,
        degraded: false
      }));
      setInitialFingerprint('');
      setShowModal(false);
      setFormError('');
      notifications.success(selectedId ? 'Cadastro atualizado.' : 'Cadastro criado.');
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar. Revise os dados e tente novamente.');
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (target: StatusTarget) => {
      if (target.type === 'servicos') return { type: target.type, services: await saveServiceCatalog(services.map((item) => item.id === target.id ? { ...item, ativo: target.nextActive } : item)) } as const;
      return { type: target.type, expenses: await saveExpenseCatalog(expenses.map((item) => item.id === target.id ? { ...item, ativo: target.nextActive } : item)) } as const;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(auxiliaryCatalogQueryKey, (current: typeof catalogsQuery.data) => ({
        services: result.type === 'servicos' ? result.services : current?.services ?? services,
        expenses: result.type === 'despesas' ? result.expenses : current?.expenses ?? expenses,
        source: 'database' as const,
        degraded: false
      }));
      const reactivated = statusTarget?.nextActive;
      setStatusTarget(null);
      setCatalogActionError('');
      notifications.success(reactivated ? 'Cadastro reativado.' : 'Cadastro inativado. Registros históricos foram preservados.');
    },
    onError: (error) => {
      const action = statusTarget?.nextActive ? 'reativação' : 'inativação';
      const detail = error instanceof Error ? error.message : 'O banco local não confirmou a alteração.';
      setCatalogActionError(`A ${action} não foi concluída. ${detail} Tente novamente.`);
    }
  });

  const resetServiceForm = (item?: ServiceCatalogItem) => {
    const category = item?.categoria || 'Topografia';
    const isPreset = SERVICE_CATEGORY_PRESETS.includes(category);
    setServNome(item?.nome || '');
    setServCategoria(isPreset ? category : 'Outro');
    setServCategoriaCustom(isPreset ? '' : category);
    const suggestedValue = item ? (item.valorSugerido / 100).toFixed(2) : '';
    setServValor(suggestedValue);
    return JSON.stringify({ servNome: item?.nome || '', categoria: category, servValor: suggestedValue });
  };

  const resetExpenseForm = (item?: ExpenseCatalogItem) => {
    const category = item?.categoria || 'Combustível';
    const isPreset = EXPENSE_CATEGORY_PRESETS.includes(category);
    setDespCategoria(isPreset ? category : 'Outro');
    setDespCategoriaCustom(isPreset ? '' : category);
    setDespDescricao(item?.descricao || '');
    return JSON.stringify({ categoria: category, despDescricao: item?.descricao || '' });
  };

  const openCreateModal = () => {
    setSelectedId(null);
    setFormError('');
    setInitialFingerprint(activeTab === 'servicos' ? resetServiceForm() : resetExpenseForm());
    setShowModal(true);
  };

  const openEditModal = (item: ServiceCatalogItem | ExpenseCatalogItem) => {
    setSelectedId(item.id);
    setFormError('');
    setInitialFingerprint(activeTab === 'servicos' ? resetServiceForm(item as ServiceCatalogItem) : resetExpenseForm(item as ExpenseCatalogItem));
    setShowModal(true);
  };

  const closeEditor = () => {
    if (persistMutation.isPending) return;
    if (hasUnsavedChanges) setShowDiscardDialog(true);
    else setShowModal(false);
  };

  const showFieldError = (message: string, fieldId: string) => {
    setFormError(message);
    window.requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (activeTab === 'servicos') {
      const nome = servNome.trim().replace(/\s+/g, ' ');
      const categoria = currentServiceCategory.trim().replace(/\s+/g, ' ');
      const valorSugerido = parseCurrencyToCents(servValor);
      if (!nome) return showFieldError('Informe o nome do serviço.', 'cadastro-serv-nome');
      if (!categoria) return showFieldError('Informe o nome da categoria.', 'cadastro-serv-cat-custom');
      if (!valorSugerido || valorSugerido <= 0) return showFieldError('Informe um valor sugerido maior que zero.', 'cadastro-serv-valor');
      if (services.some((item) => item.id !== selectedId && normalizeCatalogLabel(item.nome) === normalizeCatalogLabel(nome))) {
        return showFieldError('Já existe um tipo de serviço com este nome.', 'cadastro-serv-nome');
      }
      const item: ServiceCatalogItem = { id: selectedId || crypto.randomUUID(), nome, categoria, valorSugerido, ativo: services.find((current) => current.id === selectedId)?.ativo ?? true };
      persistMutation.mutate({
        type: 'servicos',
        services: sortServices(selectedId ? services.map((current) => current.id === selectedId ? item : current) : [...services, item])
      });
      return;
    }
    const categoria = currentExpenseCategory.trim().replace(/\s+/g, ' ');
    const descricao = despDescricao.trim().replace(/\s+/g, ' ');
    if (!categoria) return showFieldError('Informe o nome da categoria.', 'cadastro-desp-cat-custom');
    if (!descricao) return showFieldError('Informe uma descrição para a categoria.', 'cadastro-desp-desc');
    if (expenses.some((item) => item.id !== selectedId && normalizeCatalogLabel(item.categoria) === normalizeCatalogLabel(categoria))) {
      return showFieldError('Já existe uma categoria de despesa com este nome.', 'cadastro-desp-cat');
    }
    const item: ExpenseCatalogItem = { id: selectedId || crypto.randomUUID(), categoria, descricao, ativo: expenses.find((current) => current.id === selectedId)?.ativo ?? true };
    persistMutation.mutate({
      type: 'despesas',
      expenses: sortExpenses(selectedId ? expenses.map((current) => current.id === selectedId ? item : current) : [...expenses, item])
    });
  };

  const changeTab = (tab: CatalogTab, focus = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('aba', tab);
      return next;
    });
    if (focus) window.requestAnimationFrame(() => (tab === 'servicos' ? serviceTabRef : expenseTabRef).current?.focus());
  };

  const changeStatus = (nextStatus: CatalogStatus) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('status', nextStatus);
      return next;
    });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent, tab: CatalogTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'servicos' : event.key === 'End' ? 'despesas' : tab === 'servicos' ? 'despesas' : 'servicos';
    changeTab(next, true);
  };

  const filteredServices = useMemo(() => {
    const query = normalizeCatalogLabel(search);
    const byStatus = services.filter((item) => status === 'todos' || (status === 'ativos' ? item.ativo : !item.ativo));
    return query ? byStatus.filter((item) => normalizeCatalogLabel(`${item.nome} ${item.categoria}`).includes(query)) : byStatus;
  }, [search, services, status]);
  const filteredExpenses = useMemo(() => {
    const query = normalizeCatalogLabel(search);
    const byStatus = expenses.filter((item) => status === 'todos' || (status === 'ativos' ? item.ativo : !item.ativo));
    return query ? byStatus.filter((item) => normalizeCatalogLabel(`${item.categoria} ${item.descricao}`).includes(query)) : byStatus;
  }, [expenses, search, status]);
  const currentSearch = search;
  const activeItems = activeTab === 'servicos' ? filteredServices : filteredExpenses;
  const currentCatalog = activeTab === 'servicos' ? services : expenses;
  const totalItems = currentCatalog.length;
  const activeCount = currentCatalog.filter((item) => item.ativo).length;
  const inactiveCount = totalItems - activeCount;
  const categoryCount = activeTab === 'servicos' ? new Set(services.map((item) => item.categoria)).size : expenses.length;
  const createLabel = activeTab === 'servicos' ? 'Novo tipo de serviço' : 'Nova categoria de despesa';
  const editorTitle = selectedId
    ? activeTab === 'servicos' ? 'Editar tipo de serviço' : 'Editar categoria de despesa'
    : createLabel;

  return (
    <Layout>
      <PageHeader
        eyebrow="Parâmetros do sistema"
        title="Cadastros Auxiliares"
        description="Gerencie os tipos de serviço usados em orçamentos e as categorias disponíveis em despesas."
        action={<button type="button" onClick={openCreateModal} className={headerPrimaryActionButtonClass}><span>{createLabel}</span><span className={headerPrimaryActionIconClass} aria-hidden="true"><Plus weight="bold" className="h-4 w-4" /></span></button>}
      />

      {catalogsQuery.data?.degraded && (
        <p role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Os catálogos estão sendo exibidos pelo cache local. Reconecte o serviço local antes de fazer alterações.
        </p>
      )}

      <div role="tablist" aria-label="Tipos de cadastro auxiliar" className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 p-2 shadow-sm ring-1 ring-zinc-950/[0.03] dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:ring-white/[0.03]">
        <button ref={serviceTabRef} id="catalog-tab-services" type="button" role="tab" aria-selected={activeTab === 'servicos'} aria-controls="catalog-panel-services" tabIndex={activeTab === 'servicos' ? 0 : -1} onClick={() => changeTab('servicos')} onKeyDown={(event) => handleTabKeyDown(event, 'servicos')} className={cn('geo-focus-ring flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] motion-reduce:transition-none', activeTab === 'servicos' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200/70 dark:bg-zinc-800 dark:text-indigo-200 dark:ring-indigo-400/20' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100')}><Wrench aria-hidden="true" weight={activeTab === 'servicos' ? 'fill' : 'regular'} className="h-5 w-5 shrink-0" /><span className="min-w-0 truncate"><span className="sm:hidden">Serviços</span><span className="hidden sm:inline">Tipos de serviço</span> ({services.filter((item) => item.ativo).length})</span></button>
        <button ref={expenseTabRef} id="catalog-tab-expenses" type="button" role="tab" aria-selected={activeTab === 'despesas'} aria-controls="catalog-panel-expenses" tabIndex={activeTab === 'despesas' ? 0 : -1} onClick={() => changeTab('despesas')} onKeyDown={(event) => handleTabKeyDown(event, 'despesas')} className={cn('geo-focus-ring flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] motion-reduce:transition-none', activeTab === 'despesas' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200/70 dark:bg-zinc-800 dark:text-indigo-200 dark:ring-indigo-400/20' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100')}><CurrencyDollar aria-hidden="true" weight={activeTab === 'despesas' ? 'fill' : 'regular'} className="h-5 w-5 shrink-0" /><span className="min-w-0 truncate"><span className="sm:hidden">Despesas</span><span className="hidden sm:inline">Categorias de despesa</span> ({expenses.filter((item) => item.ativo).length})</span></button>
      </div>

      <section className="mb-5 rounded-2xl border border-zinc-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-zinc-950/[0.03] dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:ring-white/[0.03]" aria-labelledby="catalog-summary-title">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 id="catalog-summary-title" className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">{activeTab === 'servicos' ? 'Catálogo de serviços' : 'Catálogo financeiro'}</h2><p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">{activeTab === 'servicos' ? 'Preenche tipos e valores iniciais dos orçamentos.' : 'Padroniza categorias, filtros e relatórios de despesas.'}</p></div>
          <div className="flex flex-wrap gap-2"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{plural(activeCount, 'ativo', 'ativos')}</span>{inactiveCount > 0 && <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{plural(inactiveCount, 'inativo', 'inativos')}</span>}<span className="rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">{plural(categoryCount, 'categoria', 'categorias')}</span></div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative"><MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input aria-label={activeTab === 'servicos' ? 'Buscar tipos de serviço' : 'Buscar categorias de despesa'} name="auxiliaryRegistrationSearch" type="search" autoComplete="off" value={currentSearch} onChange={(event) => setSearch(event.target.value)} placeholder={activeTab === 'servicos' ? 'Buscar por nome ou categoria…' : 'Buscar por categoria ou descrição…'} className={cn(filterSearchInputClass, currentSearch && 'pr-24')} />{currentSearch && <button type="button" onClick={() => setSearch('')} className="geo-focus-ring absolute right-2 top-1/2 min-h-9 -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100">Limpar</button>}</div>
          <div role="group" aria-label="Filtrar cadastros por situação" className="grid grid-cols-3 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/70">{(['ativos', 'inativos', 'todos'] as const).map((option) => <button key={option} type="button" aria-pressed={status === option} onClick={() => changeStatus(option)} className={cn('geo-focus-ring min-h-11 rounded-lg px-3 text-xs font-semibold capitalize transition-[background-color,color,box-shadow] motion-reduce:transition-none', status === option ? 'bg-white text-indigo-700 shadow-sm dark:bg-zinc-700 dark:text-indigo-200' : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white')}>{option}</button>)}</div>
        </div>
        <p className="mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300" role="status" aria-live="polite">{plural(activeItems.length, activeTab === 'servicos' ? 'tipo de serviço exibido' : 'categoria exibida', activeTab === 'servicos' ? 'tipos de serviço exibidos' : 'categorias exibidas')} de {totalItems}</p>
      </section>

      <div id={activeTab === 'servicos' ? 'catalog-panel-services' : 'catalog-panel-expenses'} role="tabpanel" aria-labelledby={activeTab === 'servicos' ? 'catalog-tab-services' : 'catalog-tab-expenses'} tabIndex={0} className="geo-focus-ring space-y-3 rounded-2xl">
        {catalogsQuery.isLoading ? <p className="py-12 text-center text-sm font-medium text-zinc-600" role="status">Carregando cadastros…</p>
          : activeItems.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-5 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/60"><p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{currentSearch ? 'Nenhum resultado encontrado' : status === 'inativos' ? 'Nenhum cadastro inativo' : 'Nenhum cadastro disponível'}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentSearch ? 'Tente outro termo ou limpe a pesquisa.' : status === 'inativos' ? 'Os cadastros inativados aparecerão aqui e poderão ser reativados.' : `Use “${createLabel}” para começar.`}</p>{currentSearch && <button type="button" onClick={() => setSearch('')} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-11 px-4">Limpar pesquisa</button>}</div>
          : activeTab === 'servicos' ? filteredServices.map((item) => (
            <article key={item.id} className="grid min-w-0 gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm [content-visibility:auto] dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5">
              <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"><Tag weight="duotone" className="h-6 w-6" /></div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold leading-snug text-zinc-950 dark:text-white">{item.nome}</h2>{!item.ativo && <span className="rounded-full bg-zinc-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Inativo</span>}</div><div className="mt-2 flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"><span className="break-words">{item.categoria}</span><span aria-hidden="true" className="hidden sm:inline">•</span><span className="whitespace-nowrap font-bold tabular-nums text-zinc-900 dark:text-zinc-100">Sugerido: {formatCurrency(item.valorSugerido)}</span></div></div>
              <div className="flex shrink-0 justify-end gap-2"><button type="button" onClick={() => openEditModal(item)} aria-label={`Editar ${item.nome}`} className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50 text-indigo-700 transition-[background-color,border-color,color] hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"><PencilSimple aria-hidden="true" className="h-4 w-4" /></button><button type="button" onClick={() => { setCatalogActionError(''); setStatusTarget({ id: item.id, name: item.nome, type: 'servicos', nextActive: !item.ativo }); }} aria-label={`${item.ativo ? 'Inativar' : 'Reativar'} ${item.nome}`} className={cn('geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border transition-[background-color,border-color,color]', item.ativo ? 'border-amber-200/80 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20' : 'border-emerald-200/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20')}>
                {item.ativo ? <Prohibit aria-hidden="true" className="h-4 w-4" /> : <ArrowCounterClockwise aria-hidden="true" className="h-4 w-4" />}
              </button></div>
            </article>
          )) : filteredExpenses.map((item) => (
            <article key={item.id} className="grid min-w-0 gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm [content-visibility:auto] dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5">
              <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200"><SquaresFour weight="duotone" className="h-6 w-6" /></div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold leading-snug text-zinc-950 dark:text-white">{item.categoria}</h2>{!item.ativo && <span className="rounded-full bg-zinc-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Inativo</span>}</div><p className="mt-1 break-words text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{item.descricao}</p></div>
              <div className="flex shrink-0 justify-end gap-2"><button type="button" onClick={() => openEditModal(item)} aria-label={`Editar ${item.categoria}`} className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50 text-indigo-700 transition-[background-color,border-color,color] hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"><PencilSimple aria-hidden="true" className="h-4 w-4" /></button><button type="button" onClick={() => { setCatalogActionError(''); setStatusTarget({ id: item.id, name: item.categoria, type: 'despesas', nextActive: !item.ativo }); }} aria-label={`${item.ativo ? 'Inativar' : 'Reativar'} ${item.categoria}`} className={cn('geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border transition-[background-color,border-color,color]', item.ativo ? 'border-amber-200/80 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20' : 'border-emerald-200/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20')}>
                {item.ativo ? <Prohibit aria-hidden="true" className="h-4 w-4" /> : <ArrowCounterClockwise aria-hidden="true" className="h-4 w-4" />}
              </button></div>
            </article>
          ))}
      </div>

      {!showDiscardDialog && <Modal isOpen={showModal} onClose={closeEditor} closeDisabled={persistMutation.isPending} title={editorTitle} initialFocusId={activeTab === 'servicos' ? 'cadastro-serv-nome' : 'cadastro-desp-cat'}>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormError message={formError} />
          <FormSection title={activeTab === 'servicos' ? 'Tipo de serviço' : 'Categoria de despesa'} description={activeTab === 'servicos' ? 'Defina o serviço e o valor inicial sugerido para novos orçamentos.' : 'Defina como a categoria aparecerá nos lançamentos e relatórios.'} className="bg-white/70 dark:border-zinc-700/80 dark:bg-zinc-800/35">
            {activeTab === 'servicos' ? <>
              <FormField htmlFor="cadastro-serv-nome" label="Nome do serviço" required><input id="cadastro-serv-nome" name="serviceName" type="text" required autoComplete="off" value={servNome} onChange={(event) => setServNome(event.target.value)} placeholder="Ex.: Demarcação topográfica" className="geo-field" /></FormField>
              <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="cadastro-serv-cat" label="Categoria" required><FormSelect id="cadastro-serv-cat" name="serviceCategory" value={servCategoria} onChange={(event) => setServCategoria(event.target.value)} required>{SERVICE_CATEGORY_PRESETS.map((category) => <option key={category}>{category}</option>)}<option value="Outro">Outra categoria…</option></FormSelect></FormField><FormField htmlFor="cadastro-serv-valor" label="Valor sugerido (R$)" required><NumericInput id="cadastro-serv-valor" name="suggestedValue" inputMode="decimal" min="0.01" step="0.01" required autoComplete="off" value={servValor} onChange={(event) => setServValor(event.target.value)} placeholder="0,00" className="tabular-nums" /></FormField></div>
              {servCategoria === 'Outro' && <FormField htmlFor="cadastro-serv-cat-custom" label="Nome da categoria" required><input id="cadastro-serv-cat-custom" name="customServiceCategory" required autoComplete="off" value={servCategoriaCustom} onChange={(event) => setServCategoriaCustom(event.target.value)} className="geo-field" /></FormField>}
              <p className="rounded-xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-xs font-medium leading-relaxed text-indigo-900 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-100">O valor será sugerido ao iniciar um item vazio no orçamento e continuará editável.</p>
            </> : <>
              <FormField htmlFor="cadastro-desp-cat" label="Categoria da despesa" required><FormSelect id="cadastro-desp-cat" name="expenseCategory" value={despCategoria} onChange={(event) => setDespCategoria(event.target.value)} required>{EXPENSE_CATEGORY_PRESETS.map((category) => <option key={category}>{category}</option>)}<option value="Outro">Outra categoria…</option></FormSelect></FormField>
              {despCategoria === 'Outro' && <FormField htmlFor="cadastro-desp-cat-custom" label="Nome da categoria" required><input id="cadastro-desp-cat-custom" name="customExpenseCategory" required autoComplete="off" value={despCategoriaCustom} onChange={(event) => setDespCategoriaCustom(event.target.value)} className="geo-field" /></FormField>}
              <FormField htmlFor="cadastro-desp-desc" label="Descrição" required><textarea id="cadastro-desp-desc" name="expenseCategoryDescription" value={despDescricao} onChange={(event) => setDespDescricao(event.target.value)} rows={3} required autoComplete="off" placeholder="Ex.: Abastecimento e combustível para atividades operacionais." className="geo-field resize-y" /></FormField>
              <p className="rounded-xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-xs font-medium leading-relaxed text-indigo-900 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-100">Uma descrição clara mantém filtros e relatórios financeiros consistentes.</p>
            </>}
          </FormSection>
          <FormFooter><button type="button" onClick={closeEditor} disabled={persistMutation.isPending} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5 disabled:opacity-50">Cancelar</button><button type="submit" disabled={persistMutation.isPending || catalogsQuery.data?.degraded} aria-busy={persistMutation.isPending} className={cn(primarySubmitButtonClass, 'min-h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50')}>{persistMutation.isPending ? 'Salvando…' : selectedId ? 'Salvar alterações' : 'Criar cadastro'}</button></FormFooter>
        </form>
      </Modal>}

      <ConfirmDialog isOpen={Boolean(statusTarget)} onClose={() => { if (!statusMutation.isPending) { setStatusTarget(null); setCatalogActionError(''); } }} onConfirm={() => { if (statusTarget) statusMutation.mutate(statusTarget); }} loading={statusMutation.isPending} loadingText={statusTarget?.nextActive ? 'Reativando…' : 'Inativando…'} variant={statusTarget?.nextActive ? 'info' : 'warning'} title={`${statusTarget?.nextActive ? 'Reativar' : 'Inativar'} ${statusTarget?.type === 'servicos' ? 'tipo de serviço' : 'categoria de despesa'}${statusTarget?.name ? ` “${statusTarget.name}”` : ''}?`} description={statusTarget?.nextActive ? 'O cadastro voltará a aparecer nas novas seleções.' : 'O cadastro deixará de aparecer em novas seleções, mas continuará disponível no filtro de inativos. Registros históricos e seu identificador serão preservados.'} confirmText={statusTarget?.nextActive ? 'Reativar cadastro' : 'Inativar cadastro'} error={catalogActionError} />
      <ConfirmDialog isOpen={showDiscardDialog} onClose={() => setShowDiscardDialog(false)} onConfirm={() => { setShowDiscardDialog(false); setInitialFingerprint(''); setShowModal(false); }} variant="warning" title="Descartar alterações?" description="As informações preenchidas neste formulário ainda não foram salvas." confirmText="Descartar alterações" />
    </Layout>
  );
}
