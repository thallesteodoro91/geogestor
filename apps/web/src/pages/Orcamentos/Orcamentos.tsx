import { DatePickerField, FormSelect, NumericInput } from '../../components/Form';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowsLeftRight,
  ChartLineUp,
  Copy,
  Eye,
  FilePdf,
  FileText,
  Funnel,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X
} from '@phosphor-icons/react';
import { BUDGET_STATUSES, BUDGET_STATUS_LABELS, type BudgetStatus } from '@geogestor/contracts';
import { Layout } from '../../components/Layout';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { PageFilterBar } from '../../components/PageFilterBar';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';
import { apiClient, type PaginatedResponse } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { headerPrimaryActionButtonClass, headerPrimaryActionIconClass } from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import { commercialContentClass } from '../../utils/commercialLayout';
import { filterBarClass, filterClearButtonClass, filterControlClass } from '../../utils/filterStyles';
import { BudgetDetails } from './BudgetDetails';
import { BudgetMoreActions } from './BudgetMoreActions';
import { buildBudgetEditorPath, getBudgetListPath, isSafeEntityId, loadBudgetListPosition, saveBudgetListPosition } from './budgetNavigation';
import { currencyInputToCents, formatBasisPoints, formatCurrency, formatDate } from './budgetForm';
import { budgetPdfErrorMessage, generateProfessionalBudgetPdf } from './budgetPdfGenerator';
import type { BudgetDetail, BudgetKpis, BudgetListItem, BudgetOptions } from './types';
import { useAuxiliaryCatalogs } from '../../hooks/useAuxiliaryCatalogs';
import { mergeCatalogAndHistoricalValues } from '../../services/catalogOptions';
import { useDebounce } from '../../hooks/useDebounce';
import { budgetFilterParams, budgetRange } from './budgetListState';
import './budget-workspace.css';
import { BudgetAnalysisWidgets, BudgetPulseWidgets } from './BudgetAuraWidgets';

const fieldClass = cn(geoFieldClass, 'h-10 min-h-10 w-full px-3 text-xs font-semibold');
const iconButtonClass = 'geo-focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,color,transform] duration-150 hover:bg-brand-surface-subtle hover:text-zinc-950 active:scale-[0.97] dark:text-zinc-300 dark:hover:text-white';

const emptyKpis: BudgetKpis = {
  total: 0,
  counts: Object.fromEntries(BUDGET_STATUSES.map((status) => [status, 0])) as Record<BudgetStatus, number>,
  viewed: 0,
  totalBudgetedCents: 0,
  totalApprovedCents: 0,
  averageApprovedTicketCents: 0,
  conversionBasisPoints: 0,
  estimatedTaxesCents: 0,
  estimatedNetFeesCents: 0,
  accountsReceivableCents: 0,
  receivedCents: 0,
  conversionByService: []
};

const emptyOptions: BudgetOptions = {
  clients: [], projects: [], properties: [], taxProfiles: [], templates: [], pricingParameters: []
};

const BUDGET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const statusTone: Record<BudgetStatus, string> = {
  rascunho: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  emitido: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200',
  enviado: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200',
  em_negociacao: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100',
  aprovado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-100',
  rejeitado: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-100',
  expirado: 'bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-100',
  cancelado: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  substituido: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-100'
};

function budgetQuery(searchParams: URLSearchParams) {
  const params = budgetFilterParams(searchParams);
  params.delete('budgetId');
  params.delete('highlightId');
  params.delete('page');
  return params.toString();
}

function budgetListQuery(searchParams: URLSearchParams) {
  const params = budgetFilterParams(searchParams);
  if (searchParams.has('sort')) params.set('sort', searchParams.get('sort')!);
  params.delete('budgetId');
  params.delete('highlightId');
  params.set('mode', 'page');
  params.set('limit', '25');
  params.set('page', searchParams.get('page') || '1');
  return params.toString();
}

function budgetStatusQuery(searchParams: URLSearchParams) {
  const params = budgetFilterParams(searchParams);
  params.delete('budgetId');
  params.delete('highlightId');
  params.delete('status');
  params.delete('page');
  return params.toString();
}

function centsParamToReais(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return '';
  const cents = BigInt(value);
  const fraction = String(cents % 100n).padStart(2, '0').replace(/0+$/, '');
  return `${cents / 100n}${fraction ? `.${fraction}` : ''}`;
}

function detailToListItem(detail: BudgetDetail): BudgetListItem {
  return {
    id: detail.id,
    groupId: detail.grupoId,
    version: detail.versao,
    number: detail.codigoOrcamento,
    status: detail.status,
    description: detail.descricao,
    serviceType: detail.servicoTipo,
    propertyType: detail.imovelTipo,
    propertyName: detail.imovelNome,
    municipality: detail.municipio,
    state: detail.uf,
    technicalLead: detail.responsavelTecnico,
    issueDate: detail.dataEmissao,
    validUntil: detail.validadeAte,
    totalCents: detail.valorTotal,
    estimatedTaxesCents: detail.impostosPrevistos,
    netFeesCents: detail.honorariosLiquidos,
    estimatedProfitCents: detail.lucroEstimado,
    marginBasisPoints: detail.margemPontosBase,
    clientId: detail.clienteId,
    clientName: detail.clientName,
    projectId: detail.projetoId,
    projectName: detail.projectName,
    viewedAt: detail.visualizadoEm
  };
}

export function Orcamentos() {
  const queryClient = useQueryClient();
  const catalogsQuery = useAuxiliaryCatalogs();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputQuery = searchParams.get('query') || '';
  const [immediateQuery, setImmediateQuery] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [compositionQuery, setCompositionQuery] = useState(inputQuery);
  const debouncedQuery = useDebounce(composing ? compositionQuery : inputQuery, 300);
  const remoteQuery = !inputQuery ? '' : immediateQuery === inputQuery ? inputQuery : debouncedQuery;
  const remoteParams = new URLSearchParams(searchParams);
  if (remoteQuery) remoteParams.set('query', remoteQuery); else remoteParams.delete('query');
  const queryString = budgetQuery(remoteParams);
  const listQueryString = budgetListQuery(remoteParams);
  const statusQueryString = budgetStatusQuery(remoteParams);
  const selectedIdParam = searchParams.get('budgetId');
  const selectedId = isSafeEntityId(selectedIdParam) && BUDGET_ID_PATTERN.test(selectedIdParam) ? selectedIdParam : null;
  const highlightIdParam = searchParams.get('highlightId');
  const highlightId = isSafeEntityId(highlightIdParam) ? highlightIdParam : null;
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const [deleteTarget, setDeleteTarget] = useState<BudgetListItem | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const pdfInProgress = useRef(false);
  const tableRegionRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLParagraphElement | null>(null);
  const pendingPage = useRef<number | null>(null);
  const returnTo = useMemo(() => getBudgetListPath(searchParams), [searchParams]);

  const { data: budgetPage, isLoading: budgetsLoading, isFetching, isPlaceholderData, isError: budgetsError, error: budgetsErrorDetail, refetch: refetchBudgets } = useQuery<PaginatedResponse<BudgetListItem>>({
    queryKey: ['budgets', listQueryString],
    queryFn: ({ signal }) => apiClient.get(`/api/orcamentos?${listQueryString}`, { signal }),
    placeholderData: (previous) => previous
  });
  const budgets = useMemo(() => budgetPage?.items ?? [], [budgetPage?.items]);
  const serviceTypeOptions = useMemo(() => mergeCatalogAndHistoricalValues(
    catalogsQuery.data?.services.filter((item) => item.ativo).map((item) => item.nome) ?? [],
    [...budgets.map((budget) => budget.serviceType), searchParams.get('serviceType')]
  ), [budgets, catalogsQuery.data?.services, searchParams]);
  const { data: kpis = emptyKpis, isLoading: kpisLoading, isError: kpisError, error: kpisErrorDetail, refetch: refetchKpis } = useQuery<BudgetKpis>({
    queryKey: ['budget-kpis', queryString],
    queryFn: ({ signal }) => apiClient.get(`/api/orcamentos/kpis${queryString ? `?${queryString}` : ''}`, { signal })
  });
  const { data: statusKpis, isLoading: statusLoading, isError: statusError, refetch: refetchStatuses } = useQuery<BudgetKpis>({
    // A mesma chave evita duas chamadas quando os filtros geral e por status coincidem.
    queryKey: ['budget-kpis', statusQueryString],
    queryFn: ({ signal }) => apiClient.get(`/api/orcamentos/kpis${statusQueryString ? `?${statusQueryString}` : ''}`, { signal })
  });
  const { data: filterOptions } = useQuery<Pick<BudgetOptions, 'clients' | 'projects'>>({
    queryKey: ['budget-filter-options'],
    queryFn: () => apiClient.get('/api/orcamentos/filter-options')
  });
  const options = useMemo<BudgetOptions>(() => ({
    ...emptyOptions,
    clients: filterOptions?.clients ?? [],
    projects: filterOptions?.projects ?? []
  }), [filterOptions?.clients, filterOptions?.projects]);
  const selectedDetailQuery = useQuery<BudgetDetail | null>({
    queryKey: ['budget-detail', selectedId],
    queryFn: () => selectedId ? apiClient.get(`/api/orcamentos/${selectedId}`) : Promise.resolve(null),
    enabled: Boolean(selectedId)
  });
  const selectedDetail = selectedDetailQuery.data ?? null;
  const highlightInFilteredList = Boolean(highlightId && budgets.some((budget) => budget.id === highlightId));
  const { data: highlightedDetail = null } = useQuery<BudgetDetail | null>({
    queryKey: ['budget-detail', highlightId],
    queryFn: () => highlightId ? apiClient.get(`/api/orcamentos/${highlightId}`) : Promise.resolve(null),
    enabled: Boolean(highlightId) && !budgetsLoading && !highlightInFilteredList
  });
  const displayedBudgets = useMemo(() => (
    highlightedDetail && !highlightInFilteredList
      ? [detailToListItem(highlightedDetail), ...budgets]
      : budgets
  ), [budgets, highlightInFilteredList, highlightedDetail]);

  const updateFilter = (key: string, value: string) => {
    pendingPage.current = null;
    setImmediateQuery(key === 'query' ? null : inputQuery);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      next.delete('budgetId');
      return next;
    }, { replace: true });
  };

  const updatePage = (page: number, focus = true) => {
    pendingPage.current = focus ? page : null;
    setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (page <= 1) next.delete('page');
    else next.set('page', String(page));
    next.delete('budgetId');
    return next;
    }, { replace: true });
  };

  const correctingPage = Boolean(budgetPage && !isPlaceholderData && !budgetsError && currentPage > budgetPage.totalPages);
  const updating = isFetching || composing || remoteQuery !== inputQuery || correctingPage;
  const rangeText = budgetRange(currentPage, budgets.length, budgetPage?.total || 0);
  useEffect(() => {
    if (isFetching || isPlaceholderData || budgetsError || !budgetPage) return;
    if (currentPage > budgetPage.totalPages) {
      const nextPage = budgetPage.totalPages;
      const focus = pendingPage.current !== null;
      pendingPage.current = focus ? nextPage : null;
      setSearchParams(current => { const next = new URLSearchParams(current); if (nextPage === 1) next.delete('page'); else next.set('page', String(nextPage)); return next; }, { replace: true });
      return;
    }
    if (pendingPage.current !== currentPage || budgetPage.page !== currentPage || updating) return;
    pendingPage.current = null;
    if (tableRegionRef.current) { tableRegionRef.current.scrollTop = 0; tableRegionRef.current.scrollLeft = 0; }
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [budgetPage, budgetsError, currentPage, isFetching, isPlaceholderData, setSearchParams, updating]);

  const clearFilters = () => {
    pendingPage.current = null;
    setImmediateQuery('');
    setSearchParams(current => { const next = new URLSearchParams(current); budgetFilterParams(current).forEach((_, key) => next.delete(key)); next.delete('page'); return next; }, { replace: true });
  };
  const openDetail = (budget: { id: string }) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('budgetId', budget.id);
    return next;
  });
  const closeDetail = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.delete('budgetId');
    return next;
  }, { replace: true });

  const openBudgetEditor = (budgetId?: string) => {
    saveBudgetListPosition({
      returnTo,
      windowY: window.scrollY,
      tableTop: tableRegionRef.current?.scrollTop || 0,
      tableLeft: tableRegionRef.current?.scrollLeft || 0
    });
    navigate(buildBudgetEditorPath({ budgetId, returnTo }));
  };

  useEffect(() => {
    if (budgetsLoading || highlightId) return;
    const savedPosition = loadBudgetListPosition(returnTo);
    if (!savedPosition) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedPosition.windowY, behavior: 'auto' });
      if (tableRegionRef.current) {
        tableRegionRef.current.scrollTop = savedPosition.tableTop;
        tableRegionRef.current.scrollLeft = savedPosition.tableLeft;
      }
    });
  }, [budgetsLoading, highlightId, returnTo]);

  useEffect(() => {
    if (budgetsLoading || !highlightId) return;
    loadBudgetListPosition(returnTo);
    const row = Array.from(document.querySelectorAll<HTMLElement>(`[data-budget-id="${CSS.escape(highlightId)}"]`)).find(element => element.getClientRects().length);
    if (!row) return;
    window.requestAnimationFrame(() => row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' }));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('highlightId');
        return next;
      }, { replace: true });
    }, reduceMotion ? 1200 : 3200);
    return () => window.clearTimeout(timeout);
  }, [budgetsLoading, highlightId, highlightedDetail, returnTo, setSearchParams]);

  const deleteLock = useRef(false);
  const duplicateLock = useRef(false);
  const [actionError, setActionError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const duplicateBudget = (id: string) => {
    if (duplicateLock.current) return;
    duplicateLock.current = true;
    setActionError('');
    duplicateMutation.mutate(id);
  };
  const deleteBudget = () => {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteError('');
    deleteMutation.mutate(deleteTarget.id);
  };
  const deleteMutation = useMutation({
    retry: false,
    onSettled: () => { deleteLock.current = false; },
    mutationFn: (id: string) => apiClient.delete(`/api/orcamentos/${id}`),
    onSuccess: async () => {
      pendingPage.current = budgets.length === 1 && currentPage > 1 ? currentPage : null;
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-status-kpis'] })
      ]);
      toast.success('Rascunho exclu\u00eddo.');
    },
    onError: (error) => setDeleteError(`${error instanceof Error ? error.message : 'Não foi possível excluir o rascunho.'} Confira a lista antes de tentar novamente se a comunicação foi interrompida.`)
  });

  const duplicateMutation = useMutation({
    retry: false,
    onSettled: () => { duplicateLock.current = false; },
    mutationFn: (id: string) => apiClient.post<BudgetDetail>(`/api/orcamentos/${id}/duplicate`),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-status-kpis'] })
      ]);
      openDetail(created);
      toast.success('C\u00f3pia criada em rascunho.');
    },
    onError: (error) => setActionError(`${error instanceof Error ? error.message : 'Não foi possível duplicar o orçamento.'} Confira a lista antes de tentar novamente se a comunicação foi interrompida.`)
  });

  const generatePdf = async (id: string) => {
    if (pdfInProgress.current) return;
    pdfInProgress.current = true;
    setGeneratingPdfId(id);
    const loadingToast = toast.loading('Gerando PDF…');
    try {
      const detail = await apiClient.get<BudgetDetail>(`/api/orcamentos/${id}`);
      const destination = await generateProfessionalBudgetPdf(detail);
      if (destination) toast.success('Orçamento salvo em PDF.', {
        duration: 10_000,
        action: { label: 'Abrir arquivo', onClick: () => {
          void window.electronAPI?.openBudgetPdf?.(destination).catch((error: unknown) => {
            toast.error(budgetPdfErrorMessage(error, 'open'));
          });
        } }
      });
      else if (destination === undefined) toast.success('PDF gerado. Confira o arquivo nos downloads.');
      else toast.info('Exportação cancelada. Nenhum arquivo foi salvo.');
    } catch (error) {
      toast.error(budgetPdfErrorMessage(error));
    } finally {
      toast.dismiss(loadingToast);
      pdfInProgress.current = false;
      setGeneratingPdfId(null);
    }
  };

  const hasFilters = budgetFilterParams(searchParams).size > 0;
  const activeFilters = useMemo(() => {
    const labels: Record<string, string> = {
      query: 'Busca',
      clientId: 'Cliente',
      projectId: 'Projeto',
      serviceType: 'Servi\u00e7o',
      municipality: 'Munic\u00edpio',
      property: 'Im\u00f3vel',
      technicalLead: 'Respons\u00e1vel',
      propertyType: 'Tipo de im\u00f3vel',
      linkedProject: 'Projeto',
      issueFrom: 'Emiss\u00e3o desde',
      issueTo: 'Emiss\u00e3o at\u00e9',
      validFrom: 'Validade desde',
      validTo: 'Validade at\u00e9',
      minValueCents: 'Valor m\u00ednimo',
      maxValueCents: 'Valor m\u00e1ximo'
    };

    return Array.from(searchParams.entries())
      .filter(([key]) => key !== 'status' && Boolean(labels[key]))
      .map(([key, rawValue]) => {
        let value = rawValue;
        if (key === 'clientId') value = options.clients.find((client) => client.id === rawValue)?.name || rawValue;
        if (key === 'projectId') value = options.projects.find((project) => project.id === rawValue)?.name || rawValue;
        if (key === 'propertyType') value = rawValue === 'rural' ? 'Rural' : rawValue === 'urbano' ? 'Urbano' : rawValue;
        if (key === 'linkedProject') value = rawValue === 'sim' ? 'Vinculado' : rawValue === 'nao' ? 'Sem projeto' : rawValue;
        if (key === 'minValueCents' || key === 'maxValueCents') value = formatCurrency(Number(rawValue));
        if (['issueFrom', 'issueTo', 'validFrom', 'validTo'].includes(key)) value = formatDate(rawValue);
        return { key, label: labels[key] || key, value };
      });
  }, [options.clients, options.projects, searchParams]);

  const selectedStatus = searchParams.get('status') || '';
  const renderBudgetActions = (budget: BudgetListItem) => <div className="flex items-center justify-end gap-2">
    <button type="button" disabled={duplicateMutation.isPending || deleteMutation.isPending} onClick={() => openDetail(budget)} className={iconButtonClass} aria-label={`Visualizar ${budget.number || 'orçamento'} de ${budget.clientName}`} title="Visualizar orçamento"><Eye aria-hidden="true" size={17} /></button>
    <BudgetMoreActions disabled={duplicateMutation.isPending || deleteMutation.isPending} ariaLabel={`Mais ações de ${budget.description || budget.number || 'orçamento'}`} actions={[
      ...(budget.status === 'rascunho' ? [{ label: 'Editar rascunho', icon: <PencilSimple aria-hidden="true" size={17} />, onClick: () => openBudgetEditor(budget.id) }] : []),
      { label: duplicateMutation.isPending ? 'Duplicando…' : 'Duplicar orçamento', icon: <Copy aria-hidden="true" size={17} />, onClick: () => { duplicateBudget(budget.id); }, disabled: duplicateMutation.isPending },
      { label: generatingPdfId === budget.id ? 'Gerando PDF…' : 'Gerar PDF', icon: <FilePdf aria-hidden="true" size={17} />, onClick: () => void generatePdf(budget.id), disabled: generatingPdfId !== null },
      ...(budget.status === 'rascunho' ? [{ label: 'Excluir rascunho', icon: <Trash aria-hidden="true" size={17} />, onClick: () => setDeleteTarget(budget) }] : [])
    ]} />
  </div>;

  return (
    <Layout contentClassName={commercialContentClass}>
      <div className="geo-budget-workspace flex min-w-0 max-w-full flex-col gap-4">
        <PageHeader
          eyebrow="Propostas comerciais"
          title="Orçamentos"
          description="Crie propostas técnicas, preserve versões e transforme aprovações em projetos e contas a receber rastreáveis."
          action={(
            <button
              type="button"
              onClick={() => openBudgetEditor()}
              className={cn(headerPrimaryActionButtonClass, 'w-full sm:w-auto')}
            >
              <span aria-hidden="true" className={headerPrimaryActionIconClass}>
                <Plus size={15} weight="bold" />
              </span>
              Novo orçamento
            </button>
          )}
          navigation={(
            <ModuleNavigation
              module="commercial"
              className="mb-0"
              trailingLayout="responsive"
              trailing={(
                <div className={cn(filterBarClass, 'flex min-w-0 flex-col gap-2 sm:w-fit sm:max-w-full sm:flex-row sm:items-center')}>
                  <div className="relative block w-full min-w-0 sm:w-[32rem] sm:max-w-[55vw] 2xl:w-[26rem] 2xl:max-w-none">
                    <label htmlFor="budget-query" className="sr-only">Buscar por número, cliente, imóvel ou descrição</label>
                    <MagnifyingGlass aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-2.5 text-text-muted" />
                    <input
                      id="budget-query"
                      name="query"
                      type="search"
                      autoComplete="off"
                      value={searchParams.get('query') || ''}
                      onChange={(event) => updateFilter('query', event.target.value)}
                      onCompositionStart={() => { setCompositionQuery(inputQuery); setComposing(true); }}
                      onCompositionEnd={() => setComposing(false)}
                      onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); setImmediateQuery(inputQuery); } }}
                      placeholder="Número, cliente, imóvel…"
                      className={cn(fieldClass, 'pl-10 pr-10')}
                    />
                    {inputQuery && <button type="button" aria-label="Limpar busca de orçamentos" onClick={(event) => { updateFilter('query', ''); event.currentTarget.parentElement?.querySelector('input')?.focus(); }} className="geo-focus-ring absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded hover:bg-brand-surface-subtle"><X aria-hidden="true" size={16} /></button>}
                  </div>
                  <button
                    type="button"
                    aria-expanded={showAdvancedFilters}
                    aria-controls="budget-filter-panel"
                    onClick={() => setShowAdvancedFilters((value) => !value)}
                    className={cn(filterControlClass, 'inline-flex shrink-0 items-center justify-center gap-2 px-4 text-zinc-700 dark:text-zinc-200')}
                  >
                    <Funnel aria-hidden="true" className="h-4 w-4" />
                    Filtros
                    {activeFilters.length + (selectedStatus ? 1 : 0) > 0 ? (
                      <span className="rounded-full bg-brand-primary-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{activeFilters.length + (selectedStatus ? 1 : 0)}</span>
                    ) : null}
                  </button>
                  {activeFilters.length + (selectedStatus ? 1 : 0) > 0 ? (
                    <button type="button" onClick={clearFilters} className={cn(filterClearButtonClass, 'inline-flex items-center justify-center gap-2')}>
                      <X aria-hidden="true" className="h-4 w-4" />
                      Limpar
                    </button>
                  ) : null}
                </div>
              )}
            />
          )}
        />

        {selectedIdParam && (!selectedId || selectedDetailQuery.isError) ? (
          <section role="alert" className="geo-card flex flex-col gap-3 border-brand-red-300 bg-brand-red-50 p-4 text-sm text-brand-red-900 dark:border-brand-red-500/30 dark:bg-brand-red-500/10 dark:text-brand-red-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Não foi possível abrir o orçamento solicitado.</p>
              <p className="mt-1 text-xs">{!selectedId ? 'O identificador informado é inválido.' : selectedDetailQuery.error instanceof Error ? selectedDetailQuery.error.message : 'O orçamento não existe ou não está acessível.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedId && <button type="button" onClick={() => void selectedDetailQuery.refetch()} className="geo-button-base geo-button-secondary geo-focus-ring min-h-10 px-4 text-xs">Tentar novamente</button>}
              <button type="button" onClick={closeDetail} className="geo-button-base geo-button-primary geo-focus-ring min-h-10 px-4 text-xs">Remover referência</button>
            </div>
          </section>
        ) : null}

        <PageFilterBar
          filtersOpen={showAdvancedFilters}
          onFiltersToggle={() => setShowAdvancedFilters((value) => !value)}
          filterPanelId="budget-filter-panel"
          activeFilterCount={activeFilters.length + (selectedStatus ? 1 : 0)}
          onClear={clearFilters}
          panelClassName="lg:grid-cols-4"
          showControls={false}
        >
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
            <span>Cliente</span>
            <FormSelect aria-label="Filtrar por cliente" value={searchParams.get('clientId') || ''} onChange={(event) => updateFilter('clientId', event.target.value)} className={fieldClass}><option value="">Todos os clientes</option>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</FormSelect>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
            <span>Tipo de serviço</span>
            <FormSelect aria-label="Filtrar por tipo de serviço" value={searchParams.get('serviceType') || ''} onChange={(event) => updateFilter('serviceType', event.target.value)} className={fieldClass}><option value="">Todos os serviços</option>{serviceTypeOptions.map((type) => <option key={type}>{type}</option>)}</FormSelect>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Município</span><input aria-label="Filtrar por município" value={searchParams.get('municipality') || ''} onChange={(event) => updateFilter('municipality', event.target.value)} placeholder="Município" className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Imóvel</span><input aria-label="Filtrar por imóvel" value={searchParams.get('property') || ''} onChange={(event) => updateFilter('property', event.target.value)} placeholder="Imóvel" className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Responsável técnico</span><input aria-label="Filtrar por responsável técnico" value={searchParams.get('technicalLead') || ''} onChange={(event) => updateFilter('technicalLead', event.target.value)} placeholder="Responsável técnico" className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Tipo de imóvel</span><FormSelect aria-label="Filtrar rural ou urbano" value={searchParams.get('propertyType') || ''} onChange={(event) => updateFilter('propertyType', event.target.value)} className={fieldClass}><option value="">Rural e urbano</option><option value="rural">Rural</option><option value="urbano">Urbano</option></FormSelect></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Vínculo com projeto</span><FormSelect aria-label="Filtrar vínculo com projeto" value={searchParams.get('linkedProject') || ''} onChange={(event) => updateFilter('linkedProject', event.target.value)} className={fieldClass}><option value="">Com ou sem projeto</option><option value="sim">Vinculado a projeto</option><option value="nao">Sem projeto</option></FormSelect></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Emissão inicial</span><DatePickerField aria-label="Emissão inicial" value={searchParams.get('issueFrom') || ''} onChange={(event) => updateFilter('issueFrom', event.target.value)} className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Emissão final</span><DatePickerField aria-label="Emissão final" value={searchParams.get('issueTo') || ''} onChange={(event) => updateFilter('issueTo', event.target.value)} className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Validade inicial</span><DatePickerField aria-label="Validade inicial" value={searchParams.get('validFrom') || ''} onChange={(event) => updateFilter('validFrom', event.target.value)} className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Validade final</span><DatePickerField aria-label="Validade final" value={searchParams.get('validTo') || ''} onChange={(event) => updateFilter('validTo', event.target.value)} className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Valor mínimo</span><NumericInput aria-label="Valor mínimo em reais" min="0" step="0.01" inputMode="decimal" value={centsParamToReais(searchParams.get('minValueCents'))} onChange={(event) => updateFilter('minValueCents', event.target.value ? String(currencyInputToCents(event.target.value)) : '')} placeholder="Valor mínimo (R$)" className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-text-secondary"><span>Valor máximo</span><NumericInput aria-label="Valor máximo em reais" min="0" step="0.01" inputMode="decimal" value={centsParamToReais(searchParams.get('maxValueCents'))} onChange={(event) => updateFilter('maxValueCents', event.target.value ? String(currencyInputToCents(event.target.value)) : '')} placeholder="Valor máximo (R$)" className={fieldClass} /></label>
        </PageFilterBar>

        {activeFilters.length > 0 && <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2" aria-label="Filtros ativos"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Filtros ativos</span>{activeFilters.map((filter) => <button key={filter.key} type="button" onClick={() => updateFilter(filter.key, '')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface-subtle px-3 text-xs font-medium text-text-secondary transition-[background-color,color,border-color] hover:border-brand-primary-300 hover:text-text-primary" aria-label={`Remover filtro ${filter.label}: ${filter.value}`}><span>{filter.label}: {filter.value}</span><X aria-hidden="true" size={13} /></button>)}</div>}

        <div>
          <section aria-labelledby="budget-pulse-title" className="rounded-2xl border border-brand-border bg-brand-surface-subtle/25">
            <div className="flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <h2 id="budget-pulse-title" className="text-lg font-semibold text-text-primary">Pulso comercial</h2>
              </div>
              <button type="button" aria-expanded={showAnalysis} aria-controls="budget-commercial-analysis" onClick={() => setShowAnalysis((value) => !value)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-9 max-w-full px-3 text-xs">
                <ChartLineUp aria-hidden="true" size={16} />
                {showAnalysis ? 'Ocultar an\u00e1lise' : 'Abrir an\u00e1lise comercial'}
              </button>
            </div>
            {kpisLoading ? <Skeleton className="mx-4 mb-4 h-20 sm:mx-5" /> : kpisError ? (
              <div role="alert" className="mx-4 mb-4 flex flex-col gap-3 border-y border-brand-red-300 bg-brand-red-50 px-4 py-4 text-sm text-brand-red-900 dark:border-brand-red-500/30 dark:bg-brand-red-500/10 dark:text-brand-red-100 sm:mx-5 sm:flex-row sm:items-center sm:justify-between">
                <span>{kpisErrorDetail instanceof Error ? kpisErrorDetail.message : 'Não foi possível calcular os indicadores.'}</span>
                <button type="button" onClick={() => void refetchKpis()} className="geo-button-base geo-button-secondary geo-focus-ring min-h-10 px-4 text-xs">Tentar novamente</button>
              </div>
            ) : (
              <BudgetPulseWidgets
                kpis={kpis}
                onShowApproved={selectedStatus === 'aprovado' ? undefined : () => updateFilter('status', 'aprovado')}
              />
            )}
          </section>

          {showAnalysis && (
            <section id="budget-commercial-analysis" aria-labelledby="budget-commercial-analysis-title" className="mt-5 rounded-2xl border border-brand-border bg-brand-surface-subtle/45 px-4 py-5 sm:px-5">
              <div className="grid gap-7 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div>
                  <h2 id="budget-commercial-analysis-title" className="text-sm font-semibold text-text-primary">An&aacute;lise comercial</h2>
                  <p className="mt-1 text-xs text-text-secondary">Leitura financeira e operacional da sele&ccedil;&atilde;o atual.</p>
                  {kpisLoading ? <Skeleton className="mt-4 h-20" /> : kpisError
                    ? <p className="mt-4 text-sm text-text-muted">Indicadores indisponíveis.</p>
                    : <BudgetAnalysisWidgets kpis={kpis} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">Convers&atilde;o por servi&ccedil;o</h3>
                  <p className="mt-1 text-xs text-text-muted">Aprovados sobre propostas eleg&iacute;veis encerradas.</p>
                  {kpis.conversionByService.length ? (
                    <div className="mt-4 overflow-x-auto overscroll-contain border-y border-brand-border">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="text-[10px] uppercase tracking-[0.14em] text-text-muted"><tr><th className="py-2.5 pr-4">Servi&ccedil;o</th><th className="px-4 py-2.5 text-right">Aprovados</th><th className="px-4 py-2.5 text-right">Encerrados</th><th className="py-2.5 pl-4 text-right">Convers&atilde;o</th></tr></thead>
                        <tbody className="divide-y divide-brand-border">{kpis.conversionByService.map((item) => <tr key={item.serviceType}><td className="max-w-80 truncate py-2.5 pr-4 font-semibold text-text-primary">{item.serviceType}</td><td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary">{item.approved}</td><td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary">{item.eligible}</td><td className="py-2.5 pl-4 text-right font-mono font-bold tabular-nums text-brand-green-700 dark:text-brand-green-100">{formatBasisPoints(item.conversionBasisPoints)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="mt-4 border-y border-dashed border-brand-border py-6 text-center text-sm text-text-muted">Ainda n&atilde;o h&aacute; propostas encerradas suficientes para esta leitura.</p>}
                </div>
              </div>
            </section>
          )}
        </div>

        <section aria-labelledby="budget-list-title" className="mt-4 border-t border-brand-border pt-5 sm:mt-6 sm:pt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="budget-list-title" className="text-lg font-semibold text-text-primary">Propostas comerciais</h2>
              <p className="mt-1 text-sm text-text-muted">Localize, compare e conduza cada proposta.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary" htmlFor="budget-sort">Ordenar por
                <FormSelect id="budget-sort" value={searchParams.get('sort') || 'recentes'} onChange={(event) => updateFilter('sort', event.target.value === 'recentes' ? '' : event.target.value)} className={cn(geoFieldClass, 'min-h-11 w-64 max-w-full px-3 text-sm')}>
                  <option value="recentes">Cadastro mais recente</option><option value="emissao">Data de emissão</option><option value="validade">Data de validade</option><option value="cliente">Nome do cliente</option><option value="valor_asc">Menor valor</option><option value="valor_desc">Maior valor</option>
                </FormSelect>
              </label>
              <p ref={resultsRef} tabIndex={-1} className="budget-results geo-focus-ring rounded-lg px-2 py-2 text-sm font-semibold tabular-nums text-text-secondary" aria-label={`Propostas comerciais. Página ${currentPage} de ${budgetPage?.totalPages ?? 1}. ${rangeText}`}>
                {updating ? 'Atualizando…' : rangeText}
              </p>
            </div>
          </div>

          <nav aria-label="Filtrar propostas por status" className="mt-4 overflow-x-auto overscroll-x-contain border-y border-brand-border">
            <div className="flex min-w-max" role="group" aria-label="Status do or&ccedil;amento">
              <button type="button" aria-pressed={!selectedStatus} onClick={() => updateFilter('status', '')} className={cn('geo-focus-ring relative flex min-h-11 items-center gap-2 px-4 text-xs font-semibold transition-[background-color,color] hover:bg-brand-surface-subtle', !selectedStatus ? 'text-brand-primary-700 dark:text-brand-primary-200' : 'text-text-muted')}><span>Todos</span><span className="font-mono tabular-nums">{statusError ? '—' : statusLoading ? '…' : statusKpis?.total ?? '—'}</span>{!selectedStatus && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-primary-500" />}</button>
              {BUDGET_STATUSES.map((status) => {
                const active = selectedStatus === status;
                return <button key={status} type="button" aria-pressed={active} onClick={() => updateFilter('status', status)} className={cn('geo-focus-ring relative flex min-h-11 items-center gap-2 px-4 text-xs font-semibold transition-[background-color,color] hover:bg-brand-surface-subtle', active ? 'text-brand-primary-700 dark:text-brand-primary-200' : 'text-text-muted')}><span>{BUDGET_STATUS_LABELS[status]}</span><span className="font-mono tabular-nums">{statusError ? '—' : statusLoading ? '…' : statusKpis?.counts[status] ?? '—'}</span>{active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-primary-500" />}</button>;
              })}
            </div>
          </nav>

          {statusError && <p role="alert" className="mt-2 text-sm text-text-secondary">Não foi possível atualizar as contagens. <button type="button" onClick={() => void refetchStatuses()} className="geo-focus-ring rounded underline">Tentar novamente</button></p>}
          {actionError && <p role="alert" className="mt-3 rounded-lg border border-brand-border p-3 text-sm text-text-secondary">{actionError}</p>}
          {highlightedDetail && !highlightInFilteredList && <p className="mt-2 text-sm text-text-secondary">1 orçamento destacado fora dos filtros. A contagem considera apenas os resultados da busca.</p>}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{!updating && !budgetsError && budgetPage ? `Página ${currentPage} de ${budgetPage.totalPages}. ${rangeText}.` : ''}</p>
          <div className="mt-4" aria-busy={updating}>
            {budgetsLoading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : budgetsError ? (
              <div role="alert" className="geo-card flex flex-col items-center px-6 py-12 text-center">
                <FileText aria-hidden="true" size={44} className="text-brand-red-600 dark:text-brand-red-200" weight="duotone" />
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Não foi possível carregar os orçamentos</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{budgetsErrorDetail instanceof Error ? budgetsErrorDetail.message : 'Verifique a conexão e tente novamente.'}</p>
                <button type="button" onClick={() => void refetchBudgets()} className="mt-5 geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5">Tentar novamente</button>
              </div>
            ) : updating && displayedBudgets.length === 0 ? <p role="status" className="p-6 text-sm">Atualizando resultados…</p> : displayedBudgets.length === 0 ? (
              <div className="geo-card flex flex-col items-center px-6 py-16 text-center"><FileText aria-hidden="true" size={44} className="text-text-muted" weight="duotone" /><h3 className="mt-4 text-lg font-semibold text-text-primary">Nenhum or&ccedil;amento encontrado</h3><p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{hasFilters ? 'Ajuste ou limpe os filtros para ampliar a busca.' : 'Crie o primeiro or\u00e7amento para iniciar seu fluxo comercial.'}</p>{!hasFilters && <button type="button" onClick={() => openBudgetEditor()} className="mt-5 geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5"><Plus aria-hidden="true" size={17} /> Novo or&ccedil;amento</button>}</div>
            ) : (
              <>
              <div className="budget-card-list gap-3">
                {displayedBudgets.map((budget) => <article key={budget.id} data-budget-id={budget.id} className={cn('geo-card min-w-0 space-y-3 p-4', highlightId === budget.id && 'ring-2 ring-emerald-500')}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => openDetail(budget)} className="geo-focus-ring rounded font-mono font-bold text-brand-primary-700 hover:underline dark:text-brand-primary-200">{budget.number || 'Rascunho'} · v{budget.version}</button><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', statusTone[budget.status])}>{BUDGET_STATUS_LABELS[budget.status]}</span></div>
                  <h3 className="break-words text-base font-semibold text-text-primary">{budget.description || 'Sem descrição'}</h3>
                  <p className="break-words text-sm text-text-secondary">{budget.clientName}</p>
                  <p className="break-words text-sm text-text-muted">{budget.propertyName || 'Imóvel não informado'} · {budget.municipality || 'Município não informado'}</p>
                  <p className="break-words text-sm text-text-secondary">{budget.serviceType || 'Serviço não informado'}</p>
                  {budget.projectId && <Link to={`/projetos/${budget.projectId}`} className="geo-focus-ring block break-words rounded text-sm font-semibold text-brand-primary-700 hover:underline dark:text-brand-primary-200">{budget.projectName || 'Abrir projeto'}</Link>}
                  <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums"><div><dt className="text-text-muted">Emissão</dt><dd>{formatDate(budget.issueDate)}</dd></div><div><dt className="text-text-muted">Validade</dt><dd>{formatDate(budget.validUntil)}</dd></div><div><dt className="text-text-muted">Valor</dt><dd className="break-words font-mono font-bold">{formatCurrency(budget.totalCents)}</dd></div><div><dt className="text-text-muted">Margem estimada</dt><dd>{formatBasisPoints(budget.marginBasisPoints)}</dd></div></dl>
                  {highlightId === budget.id && !highlightInFilteredList && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">Fora dos filtros atuais</p>}
                  {renderBudgetActions(budget)}
                </article>)}
              </div>
              <div className="budget-desktop-list geo-card max-w-full overflow-hidden">
                <div className="flex items-center justify-end gap-2 border-b border-brand-border bg-brand-surface-subtle/50 px-4 py-2 text-[11px] font-medium text-text-secondary">
                  <ArrowsLeftRight aria-hidden="true" size={15} />
                  Role para os lados para ver todas as colunas
                </div>
                <div ref={tableRegionRef} className="geo-focus-ring max-h-[70vh] overflow-auto overscroll-contain" role="region" aria-label="Tabela de propostas comerciais" tabIndex={0}>
                  <table className="w-full min-w-[1160px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-brand-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="sticky left-0 top-0 z-30 bg-brand-surface-subtle px-4 py-3 shadow-[12px_0_20px_-20px_rgba(0,0,0,0.55)]">N&uacute;mero / vers&atilde;o</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Cliente e im&oacute;vel</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Servi&ccedil;o</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Emiss&atilde;o / validade</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Status</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3 text-right">Valor</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3 text-right">Margem</th>
                        <th className="sticky right-0 top-0 z-30 bg-brand-surface-subtle px-4 py-3 text-right shadow-[-12px_0_20px_-20px_rgba(0,0,0,0.55)]">A&ccedil;&otilde;es</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {displayedBudgets.map((budget) => (
                        <tr
                          key={budget.id}
                          data-budget-id={budget.id}
                          className={cn(
                            'group transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none hover:bg-brand-surface-subtle/60',
                            highlightId === budget.id && 'bg-emerald-50/80 shadow-[inset_4px_0_0_0_rgb(16_185_129)] dark:bg-emerald-500/10'
                          )}
                        >
                          <td className={cn('sticky left-0 z-10 px-4 py-3 shadow-[12px_0_20px_-20px_rgba(0,0,0,0.55)] transition-colors duration-150 motion-reduce:transition-none group-hover:bg-brand-surface-subtle', highlightId === budget.id ? 'bg-emerald-50 dark:bg-[#14251f]' : 'bg-brand-surface')}>
                            <button type="button" onClick={() => openDetail(budget)} className="geo-focus-ring rounded-md text-left font-mono font-bold text-brand-primary-700 hover:underline dark:text-brand-primary-200">{budget.number || 'Rascunho'} <span className="text-xs text-text-muted">v{budget.version}</span></button>
                            <p title={budget.description || undefined} className="mt-1 max-w-52 truncate text-xs text-text-muted">{budget.description || 'Sem descri\u00e7\u00e3o'}</p>
                            {highlightId === budget.id && !highlightInFilteredList && <span className="mt-1.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">Fora dos filtros atuais</span>}
                          </td>
                          <td className="px-4 py-3"><p title={budget.clientName} className="max-w-52 truncate text-sm font-semibold text-text-primary">{budget.clientName}</p><p className="mt-1 max-w-52 truncate text-xs text-text-muted">{budget.propertyName || 'Im\u00f3vel n\u00e3o informado'} &bull; {budget.municipality || 'Munic\u00edpio n\u00e3o informado'}</p></td>
                          <td className="px-4 py-3"><p className="max-w-64 truncate text-sm text-text-secondary">{budget.serviceType || 'N\u00e3o informado'}</p>{budget.projectId && <Link to={`/projetos/${budget.projectId}`} className="mt-1 block max-w-64 truncate text-xs font-semibold text-brand-primary-700 hover:underline dark:text-brand-primary-200">{budget.projectName || 'Abrir projeto'}</Link>}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-text-secondary"><p>{formatDate(budget.issueDate)}</p><p className="mt-1 text-xs text-text-muted">at&eacute; {formatDate(budget.validUntil)}</p></td>
                          <td className="px-4 py-3"><span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', statusTone[budget.status])}>{BUDGET_STATUS_LABELS[budget.status]}</span>{budget.viewedAt && <p className="mt-1 text-xs text-text-muted">Visualizado</p>}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold tabular-nums text-text-primary">{formatCurrency(budget.totalCents)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-text-primary">{formatBasisPoints(budget.marginBasisPoints)}</td>
                          <td className={cn('sticky right-0 z-10 p-3 shadow-[-12px_0_20px_-20px_rgba(0,0,0,0.55)] transition-colors duration-150 motion-reduce:transition-none group-hover:bg-brand-surface-subtle', highlightId === budget.id ? 'bg-emerald-50 dark:bg-[#14251f]' : 'bg-brand-surface')}>
                            {renderBudgetActions(budget)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}
            {(budgetPage?.totalPages ?? 1) > 1 && (
              <nav aria-label="Paginação de orçamentos" className="mt-4 flex items-center justify-between text-xs text-text-secondary">
                <button type="button" disabled={updating || currentPage <= 1} onClick={() => updatePage(currentPage - 1)} className="geo-focus-ring min-h-11 rounded-lg border border-brand-border px-3 py-2 font-semibold hover:bg-brand-surface-subtle disabled:opacity-40">Anterior</button>
                <span className="font-mono tabular-nums">{updating ? 'Atualizando página…' : `Página ${currentPage} de ${budgetPage?.totalPages}`}</span>
                <button type="button" disabled={updating || currentPage >= (budgetPage?.totalPages ?? 1)} onClick={() => updatePage(currentPage + 1)} className="geo-focus-ring min-h-11 rounded-lg border border-brand-border px-3 py-2 font-semibold hover:bg-brand-surface-subtle disabled:opacity-40">Próxima</button>
              </nav>
            )}
          </div>
        </section>
      </div>

      {highlightId && <p className="sr-only" role="status" aria-live="polite">Orçamento salvo e destacado na listagem.</p>}
      {selectedDetail && <BudgetDetails key={`budget-details-${selectedDetail.id}`} detail={selectedDetail} options={options} onClose={closeDetail} onEdit={(detail) => openBudgetEditor(detail.id)} onOpenBudget={(detail) => openDetail(detail)} />}
      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => { if (!deleteLock.current) { setDeleteTarget(null); setDeleteError(''); } }} onConfirm={deleteBudget} error={deleteError} title="Excluir rascunho" description={`O rascunho de ${deleteTarget?.clientName || 'cliente n\u00e3o informado'} ser\u00e1 removido. Or\u00e7amentos emitidos ou aprovados n\u00e3o podem ser exclu\u00eddos.`} confirmText="Excluir rascunho" loading={deleteMutation.isPending} />
    </Layout>
  );
}
