import { ArrowCounterClockwise, CurrencyDollar, FolderSimple, MagnifyingGlass, PencilSimple, Plus, Receipt, Tag, Trash, XCircle } from '@phosphor-icons/react';
import { appLinks } from '@geogestor/contracts';
import { cn } from '../../utils/cn';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { useListPageNavigation, useListUrlState } from '../../hooks/useListPageNavigation';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { motion } from 'framer-motion';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckboxField, DatePickerField, FormSection, FormSelect, NumericInput } from '../../components/Form';
import { apiFetch, apiClient, ApiError, type PaginatedResponse } from '../../services/apiClient';
import { notifications } from '../../services/notifications';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { useAuxiliaryCatalogs } from '../../hooks/useAuxiliaryCatalogs';
import { mergeCatalogAndHistoricalValues } from '../../services/catalogOptions';
import {
  filterBarClass,
  filterClearButtonClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';
import {
  geoGreenLabelClass,
  geoGreenSurfaceClass,
  geoGreenValueClass,
  geoOrangeLabelClass,
  geoOrangeSurfaceClass,
  geoOrangeValueClass,
  geoPurpleLabelClass,
  geoPurpleSurfaceClass,
  geoPurpleValueClass
} from '../../utils/geoTheme';
import { formatDateKey, localDateKey } from '../../utils/localDate';
import { geoFieldClass } from '../../utils/geoTheme';
import { FinanceDueWidget } from '../Financeiro/FinanceDueWidget';
import './expense-modal.css';

const TIPOS_CUSTO = ['Fixo', 'Variável de campo', 'Cartório e taxas', 'Tributário', 'Operacional', 'Reembolsável'];
const CENTROS_CUSTO = ['Administrativo', 'Campo', 'Cartório', 'Tributos', 'Software', 'Equipamentos', 'Serviços'];
const expenseSections = [
  ['expense-identification', 'Dados principais'],
  ['expense-links', 'Vínculos'],
  ['expense-classification', 'Classificação'],
  ['expense-payment', 'Pagamento'],
  ['expense-notes', 'Observações']
] as const;

const expenseFieldClass = cn(geoFieldClass, 'h-11 w-full min-w-0 px-3 text-sm font-medium');
const expenseLabelClass = 'mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200';
const expenseHelpClass = 'mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300';
const optionalLabel = <span className="font-normal text-zinc-500 dark:text-zinc-400"> — opcional</span>;
const expenseSelectProps = { density: 'form', wrapperClassName: 'w-full min-w-0', matchTriggerWidth: true, popoverMaxWidth: 1024, popoverClassName: 'geo-expense-options' } as const;
type ExpenseRequiredField = 'descricao' | 'valor' | 'data';
type ExpenseSectionId = (typeof expenseSections)[number][0];

export interface DespesaItem {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string;
  viagemId?: string | null;
  descricao: string;
  fornecedor?: string | null;
  numeroDocumento?: string | null;
  valor: number;
  data: string;
  dataCompetencia?: string | null;
  dataPagamento?: string | null;
  categoria: string;
  subcategoria?: string | null;
  tipoCusto?: string | null;
  centroCusto?: string | null;
  reembolsavel?: boolean | number | null;
  observacoes?: string | null;
  comprovanteDocumentoId?: string | null;
  status: string;
  formaPagamento: string;
  canceladaEm?: string | null;
  motivoCancelamento?: string | null;
  estornadaEm?: string | null;
  motivoEstorno?: string | null;
}

interface ExpensePage extends PaginatedResponse<DespesaItem> {
  summary: { totalPrevisto: number; totalPago: number; totalPendente: number; totalAtrasado: number };
}

export interface ProjetoMin {
  id: string;
  nome: string;
  clienteId?: string | null;
  clienteNome?: string | null;
}

interface ClienteMin { id: string; nome: string }

interface ViagemMin {
  id: string;
  finalidade: string;
  destino: string;
  projetoId?: string | null;
  status: string;
}

interface DocumentoMin {
  id: string;
  nome: string;
  projetoId?: string | null;
}

function PageFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

function newExpenseFingerprint(initialProjectId = '') {
  const today = localDateKey();
  return JSON.stringify({
    projetoId: initialProjectId,
    clienteId: '',
    viagemId: '',
    descricao: '',
    fornecedor: '',
    numeroDocumento: '',
    comprovanteDocumentoId: '',
    valor: '',
    data: today,
    dataCompetencia: today,
    dataPagamento: '',
    categoria: 'Combustível',
    subcategoria: '',
    tipoCusto: 'Variável de campo',
    centroCusto: 'Campo',
    reembolsavel: false,
    observacoes: '',
    status: 'Pendente',
    formaPagamento: 'Pix'
  });
}

export function Despesas({
  embedded = false,
  openCreateOnMount = false,
  initialProjectId = '',
  focusDespesaId,
  onFocusHandled
}: {
  embedded?: boolean;
  openCreateOnMount?: boolean;
  initialProjectId?: string;
  focusDespesaId?: string;
  onFocusHandled?: () => void;
}) {
  const queryClient = useQueryClient();
  const listUrl = useListUrlState();
  const expenseFormId = useId();
  const expenseHintId = useId();
  const expenseSubmitLock = useRef(false);
  const [expenseSubmitError, setExpenseSubmitError] = useState('');
  const catalogsQuery = useAuxiliaryCatalogs();
  const [showModal, setShowModal] = useState(openCreateOnMount);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [initialFormFingerprint, setInitialFormFingerprint] = useState(() => openCreateOnMount ? newExpenseFingerprint(initialProjectId) : '');
  const [formErrors, setFormErrors] = useState<Partial<Record<ExpenseRequiredField, string>>>({});
  const [activeExpenseSection, setActiveExpenseSection] = useState<ExpenseSectionId>('expense-identification');
  const expenseNavRef = useRef<HTMLElement>(null);
  const [selectedDespesa, setSelectedDespesa] = useState<DespesaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DespesaItem | null>(null);
  const [financialAction, setFinancialAction] = useState<{ type: 'cancelamento' | 'estorno'; item: DespesaItem } | null>(null);
  const [financialActionReason, setFinancialActionReason] = useState('');
  const [financialActionDate, setFinancialActionDate] = useState(localDateKey());

  // Form states
  const [projetoId, setProjetoId] = useState(initialProjectId);
  const [clienteId, setClienteId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [viagemId, setViagemId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [comprovanteDocumentoId, setComprovanteDocumentoId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(localDateKey());
  const [dataCompetencia, setDataCompetencia] = useState(localDateKey());
  const [dataPagamento, setDataPagamento] = useState('');
  const [categoria, setCategoria] = useState('Combustível');
  const [subcategoria, setSubcategoria] = useState('');
  const [tipoCusto, setTipoCusto] = useState('Variável de campo');
  const [centroCusto, setCentroCusto] = useState('Campo');
  const [reembolsavel, setReembolsavel] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('Pendente');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const searchTerm = listUrl.params.get('pagarBusca') || '';
  const setSearchTerm = (value: string) => listUrl.update({ pagarBusca: value === '' ? null : value, pagarPagina: null });
  const categoriaFilter = listUrl.params.get('pagarCategoria') || 'Todos';
  const setCategoriaFilter = (value: string) => listUrl.update({ pagarCategoria: value === 'Todos' ? null : value, pagarPagina: null });
  const subcategoriaFilter = listUrl.params.get('pagarSubcategoria') || 'Todos';
  const setSubcategoriaFilter = (value: string) => listUrl.update({ pagarSubcategoria: value === 'Todos' ? null : value, pagarPagina: null });
  const statusFilter = listUrl.params.get('pagarSituacao') || 'Todos';
  const setStatusFilter = (value: string) => listUrl.update({ pagarSituacao: value === 'Todos' ? null : value, pagarPagina: null });
  const tipoCustoFilter = listUrl.params.get('pagarTipo') || 'Todos';
  const setTipoCustoFilter = (value: string) => listUrl.update({ pagarTipo: value === 'Todos' ? null : value, pagarPagina: null });
  const centroCustoFilter = listUrl.params.get('pagarCentro') || 'Todos';
  const setCentroCustoFilter = (value: string) => listUrl.update({ pagarCentro: value === 'Todos' ? null : value, pagarPagina: null });
  const reembolsavelFilter = listUrl.params.get('pagarReembolso') || 'Todos';
  const setReembolsavelFilter = (value: string) => listUrl.update({ pagarReembolso: value === 'Todos' ? null : value, pagarPagina: null });
  const dataInicioFilter = listUrl.params.get('pagarInicio') || '';
  const setDataInicioFilter = (value: string) => listUrl.update({ pagarInicio: value === '' ? null : value, pagarPagina: null });
  const dataFimFilter = listUrl.params.get('pagarFim') || '';
  const setDataFimFilter = (value: string) => listUrl.update({ pagarFim: value === '' ? null : value, pagarPagina: null });
  const expenseFilterKey = [searchTerm, categoriaFilter, subcategoriaFilter, statusFilter, tipoCustoFilter, centroCustoFilter, reembolsavelFilter, dataInicioFilter, dataFimFilter].join('\u001f');
  const requestedPage = Number(listUrl.params.get('pagarPagina') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Queries
  const expenseQueryString = useMemo(() => {
    const params = new URLSearchParams({ mode: 'page', page: String(page), limit: '25' });
    if (focusDespesaId) {
      params.set('selectedId', focusDespesaId);
    } else {
      if (searchTerm.trim()) params.set('q', searchTerm.trim());
      if (categoriaFilter !== 'Todos') params.set('categoria', categoriaFilter);
      if (subcategoriaFilter !== 'Todos') params.set('subcategoria', subcategoriaFilter);
      if (statusFilter !== 'Todos') params.set('status', statusFilter);
      if (tipoCustoFilter !== 'Todos') params.set('tipoCusto', tipoCustoFilter);
      if (centroCustoFilter !== 'Todos') params.set('centroCusto', centroCustoFilter);
      if (reembolsavelFilter !== 'Todos') params.set('reembolsavel', reembolsavelFilter === 'Sim' ? 'sim' : 'nao');
      if (dataInicioFilter) params.set('dataInicio', dataInicioFilter);
      if (dataFimFilter) params.set('dataFim', dataFimFilter);
    }
    return params.toString();
  }, [categoriaFilter, centroCustoFilter, dataFimFilter, dataInicioFilter, focusDespesaId, page, reembolsavelFilter, searchTerm, statusFilter, subcategoriaFilter, tipoCustoFilter]);
  const { data: expensePage, isLoading: despesasLoading, isError: despesasFailed, refetch: refetchDespesas, isFetching: fetchingExpenses, isPlaceholderData: placeholderExpenses } = useQuery<ExpensePage>({
    queryKey: ['despesas', expenseQueryString],
    queryFn: () => apiClient.get<ExpensePage>(`/api/financeiro/despesas?${expenseQueryString}`),
    placeholderData: (previous) => previous
  });
  const { preparePage, adjustPage, resultsAnchor } = useListPageNavigation({ page, resolvedPage: expensePage?.page, ready: !fetchingExpenses && !placeholderExpenses, failed: despesasFailed, scope: expenseFilterKey });
  const changePage = (next: number) => { preparePage(next); listUrl.update({ pagarPagina: next <= 1 ? null : String(next) }); };
  useEffect(() => { if (!expensePage || fetchingExpenses || placeholderExpenses || despesasFailed || page <= expensePage.totalPages) return; adjustPage(expensePage.totalPages); listUrl.update({ pagarPagina: expensePage.totalPages <= 1 ? null : String(expensePage.totalPages) }); }, [expensePage, fetchingExpenses, placeholderExpenses, despesasFailed, page, listUrl.update]);
  const despesas = useMemo(() => expensePage?.items ?? [], [expensePage?.items]);

  const { data: viagens = [], isLoading: viagensLoading } = useQuery<ViagemMin[]>({
    queryKey: ['viagens'],
    queryFn: () => apiClient.get<ViagemMin[]>('/api/financeiro/viagens')
  });
  const { data: selectedProjectOptions = [] } = useQuery<ProjetoMin[]>({
    queryKey: ['expense-project-context', projetoId],
    queryFn: () => apiClient.get<ProjetoMin[]>(`/api/projetos/options?selectedId=${encodeURIComponent(projetoId)}&limit=1`),
    enabled: showModal && Boolean(projetoId)
  });

  const selectedProjectContext = selectedProjectOptions.find((item) => item.id === projetoId);
  const effectiveExpenseClientId = selectedProjectContext?.clienteId || clienteId;
  const effectiveExpenseClientName = selectedProjectContext?.clienteNome || clienteNome;
  const { data: comprovantes = [] } = useQuery<DocumentoMin[]>({
    queryKey: ['financeiro-comprovantes-despesa', effectiveExpenseClientId, projetoId],
    queryFn: () => {
      const params = new URLSearchParams({ clienteId: effectiveExpenseClientId });
      if (projetoId) params.set('projetoId', projetoId);
      return apiClient.get<DocumentoMin[]>(`/api/financeiro/comprovantes?${params.toString()}`);
    },
    enabled: showModal && Boolean(effectiveExpenseClientId)
  });

  const configuredExpenseCategories = useMemo(
    () => catalogsQuery.data?.expenses.filter((item) => item.ativo).map((item) => item.categoria) ?? [],
    [catalogsQuery.data?.expenses]
  );
  const formExpenseCategories = useMemo(
    () => mergeCatalogAndHistoricalValues(configuredExpenseCategories, [categoria]),
    [categoria, configuredExpenseCategories]
  );
  const filterExpenseCategories = useMemo(
    () => mergeCatalogAndHistoricalValues(configuredExpenseCategories, despesas.map((item) => item.categoria)),
    [configuredExpenseCategories, despesas]
  );
  const configuredSubcategories = useMemo(
    () => catalogsQuery.data?.expenses.find((item) => item.categoria === categoria)?.subcategorias ?? [],
    [catalogsQuery.data?.expenses, categoria]
  );
  const formExpenseSubcategories = useMemo(
    () => mergeCatalogAndHistoricalValues(configuredSubcategories, [subcategoria]),
    [configuredSubcategories, subcategoria]
  );
  const filterExpenseSubcategories = useMemo(
    () => mergeCatalogAndHistoricalValues(
      catalogsQuery.data?.expenses.flatMap((item) => item.subcategorias) ?? [],
      despesas.map((item) => item.subcategoria || '')
    ),
    [catalogsQuery.data?.expenses, despesas]
  );

  const loading = despesasLoading || viagensLoading;
  const formFingerprint = JSON.stringify({
    projetoId,
    clienteId: projetoId ? '' : clienteId,
    viagemId,
    descricao,
    fornecedor,
    numeroDocumento,
    comprovanteDocumentoId,
    valor,
    data,
    dataCompetencia,
    dataPagamento,
    categoria,
    subcategoria,
    tipoCusto,
    centroCusto,
    reembolsavel,
    observacoes,
    status,
    formaPagamento
  });
  const hasUnsavedExpense = showModal && Boolean(initialFormFingerprint) && formFingerprint !== initialFormFingerprint;

  useEffect(() => {
    if (!hasUnsavedExpense) return undefined;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [hasUnsavedExpense]);

  const filteredDespesas = despesas;
  const today = localDateKey();
  const priorityExpense = !loading && !despesasFailed && !placeholderExpenses
    ? filteredDespesas
        .filter(item => item.data && !item.dataPagamento && !item.canceladaEm && !item.estornadaEm && (item.status || '').toLowerCase() !== 'pago')
        .sort((left, right) => left.data.localeCompare(right.data))[0]
    : undefined;
  const hasExpenseFilters = Boolean(
    searchTerm ||
    categoriaFilter !== 'Todos' ||
    subcategoriaFilter !== 'Todos' ||
    statusFilter !== 'Todos' ||
    tipoCustoFilter !== 'Todos' ||
    centroCustoFilter !== 'Todos' ||
    reembolsavelFilter !== 'Todos' ||
    dataInicioFilter ||
    dataFimFilter
  );

  // Stats calculation
  const { totalPrevisto = 0, totalPago = 0, totalPendente = 0, totalAtrasado = 0 } = expensePage?.summary ?? {};

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/financeiro/despesas/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Erro ao excluir despesa');
      }
    },
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateFinancialQueries(queryClient);
    },
    onError: (error) => {
      notifications.error(error instanceof Error ? error.message : 'Erro ao excluir despesa');
    }
  });

  const financialActionMutation = useMutation({
    mutationFn: async () => {
      if (!financialAction) throw new Error('Selecione uma despesa.');
      const dateField = financialAction.type === 'estorno' ? 'dataEstorno' : 'dataCancelamento';
      return apiClient.post(`/api/financeiro/despesas/${financialAction.item.id}/${financialAction.type}`, {
        motivo: financialActionReason.trim(),
        [dateField]: financialActionDate
      });
    },
    onSuccess: async () => {
      const action = financialAction?.type;
      setFinancialAction(null);
      setFinancialActionReason('');
      await invalidateFinancialQueries(queryClient);
      notifications.success(action === 'estorno' ? 'Despesa estornada.' : 'Despesa cancelada.');
    },
    onError: (error) => notifications.error(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: Omit<DespesaItem, 'id'>) => {
      const url = selectedDespesa
        ? `/api/financeiro/despesas/${selectedDespesa.id}`
        : '/api/financeiro/despesas';
      const method = selectedDespesa ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new ApiError(errorData?.error || 'Erro ao salvar despesa', res.status);
      }
      return res.json();
    },
    onSuccess: () => {
      setShowModal(false);
      setInitialFormFingerprint('');
      invalidateFinancialQueries(queryClient);
      notifications.success(selectedDespesa ? 'Despesa salva.' : 'Despesa cadastrada.');
    },
    onError: (err) => {
      if (!(err instanceof ApiError) || err.status === 0) {
        setExpenseSubmitError('Não foi possível confirmar o salvamento. Confira a lista de despesas antes de tentar novamente para evitar um registro duplicado.');
      } else {
        const detail = err.status === 400 || err.status === 409 ? `${err.message} ` : '';
        setExpenseSubmitError(`${detail}Não foi possível salvar a despesa. Revise os dados e tente novamente.`);
      }
    },
    onSettled: () => { expenseSubmitLock.current = false; }
  });

  // Actions
  const handledExpenseIdRef = useRef<string | null>(null);

  const openCreateModal = (preferredProjectId = initialProjectId) => {
    setExpenseSubmitError('');
    const today = localDateKey();
    const initialValues = {
      projetoId: preferredProjectId,
      clienteId: '',
      viagemId: '',
      descricao: '',
      fornecedor: '',
      numeroDocumento: '',
      comprovanteDocumentoId: '',
      valor: '',
      data: today,
      dataCompetencia: today,
      dataPagamento: '',
      categoria: 'Combustível',
      subcategoria: '',
      tipoCusto: 'Variável de campo',
      centroCusto: 'Campo',
      reembolsavel: false,
      observacoes: '',
      status: 'Pendente',
      formaPagamento: 'Pix'
    };
    setSelectedDespesa(null);
    setFormErrors({});
    setProjetoId(preferredProjectId);
    setClienteId('');
    setClienteNome('');
    setViagemId('');
    setDescricao('');
    setFornecedor('');
    setNumeroDocumento('');
    setComprovanteDocumentoId('');
    setValor('');
    setData(today);
    setDataCompetencia(today);
    setDataPagamento('');
    setCategoria('Combustível');
    setSubcategoria('');
    setTipoCusto('Variável de campo');
    setCentroCusto('Campo');
    setReembolsavel(false);
    setObservacoes('');
    setStatus('Pendente');
    setFormaPagamento('Pix');
    setInitialFormFingerprint(JSON.stringify(initialValues));
    setShowModal(true);
  };

  const openEditModal = useCallback((desp: DespesaItem) => {
    setExpenseSubmitError('');
    const initialValues = {
      projetoId: desp.projetoId || '',
      clienteId: desp.projetoId ? '' : desp.clienteId || '',
      viagemId: desp.viagemId || '',
      descricao: desp.descricao || '',
      fornecedor: desp.fornecedor || '',
      numeroDocumento: desp.numeroDocumento || '',
      comprovanteDocumentoId: desp.comprovanteDocumentoId || '',
      valor: (desp.valor / 100).toString(),
      data: desp.data || '',
      dataCompetencia: desp.dataCompetencia || desp.data || '',
      dataPagamento: desp.dataPagamento || '',
      categoria: desp.categoria || 'Combustível',
      subcategoria: desp.subcategoria || '',
      tipoCusto: desp.tipoCusto || 'Operacional',
      centroCusto: desp.centroCusto || 'Administrativo',
      reembolsavel: Boolean(desp.reembolsavel),
      observacoes: desp.observacoes || '',
      status: desp.status || 'Pendente',
      formaPagamento: desp.formaPagamento || 'Pix'
    };
    setSelectedDespesa(desp);
    setFormErrors({});
    setProjetoId(desp.projetoId || '');
    setClienteId(desp.clienteId || '');
    setClienteNome(desp.clienteNome || '');
    setViagemId(desp.viagemId || '');
    setDescricao(desp.descricao || '');
    setFornecedor(desp.fornecedor || '');
    setNumeroDocumento(desp.numeroDocumento || '');
    setComprovanteDocumentoId(desp.comprovanteDocumentoId || '');
    setValor((desp.valor / 100).toString());
    setData(desp.data || '');
    setDataCompetencia(desp.dataCompetencia || desp.data || '');
    setDataPagamento(desp.dataPagamento || '');
    setCategoria(desp.categoria || 'Combustível');
    setSubcategoria(desp.subcategoria || '');
    setTipoCusto(desp.tipoCusto || 'Operacional');
    setCentroCusto(desp.centroCusto || 'Administrativo');
    setReembolsavel(Boolean(desp.reembolsavel));
    setObservacoes(desp.observacoes || '');
    setStatus(desp.status || 'Pendente');
    setFormaPagamento(desp.formaPagamento || 'Pix');
    setInitialFormFingerprint(JSON.stringify(initialValues));
    setShowModal(true);
  }, []);

  useEffect(() => {
    if (!focusDespesaId) {
      handledExpenseIdRef.current = null;
      return;
    }
    if (despesasLoading || handledExpenseIdRef.current === focusDespesaId) return;

    handledExpenseIdRef.current = focusDespesaId;
    queueMicrotask(() => {
      const focusedDespesa = despesas.find((item) => item.id === focusDespesaId);
      if (focusedDespesa) openEditModal(focusedDespesa);
      else notifications.info('A conta a pagar indicada pelo alerta não foi encontrada.');
      onFocusHandled?.();
    });
  }, [focusDespesaId, despesasLoading, despesas, onFocusHandled, openEditModal]);

  const closeExpenseModal = () => {
    setShowModal(false);
    setInitialFormFingerprint('');
    setFormErrors({});
  };

  const requestCloseExpenseModal = () => {
    if (expenseSubmitLock.current || submitMutation.isPending) return;
    if (hasUnsavedExpense) {
      setShowDiscardDialog(true);
      return;
    }
    closeExpenseModal();
  };

  const clearFormError = (field: ExpenseRequiredField) => {
    setFormErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
  };

  const jumpToExpenseSection = (sectionId: string) => {
    setActiveExpenseSection(sectionId as ExpenseSectionId);
    const heading = document.querySelector<HTMLElement>(`#${sectionId} h3`);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    document.getElementById(sectionId)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  useEffect(() => {
    if (!showModal) return;
    const nav = expenseNavRef.current;
    const scroller = nav?.closest('form')?.parentElement;
    if (!nav || !scroller) return;

    const updateActiveSection = () => {
      const navBounds = nav.getBoundingClientRect();
      const form = nav.closest('form');
      const navHeight = `${Math.ceil(navBounds.height)}px`;
      if (form?.style.getPropertyValue('--expense-nav-height') !== navHeight) form?.style.setProperty('--expense-nav-height', navHeight);
      const marker = navBounds.bottom + 72;
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;
      let current: ExpenseSectionId = expenseSections[0][0];
      for (const [sectionId] of expenseSections) {
        const section = document.getElementById(sectionId);
        if (section && section.getBoundingClientRect().top <= marker) current = sectionId;
      }
      if (atBottom) current = expenseSections[expenseSections.length - 1][0];
      setActiveExpenseSection((previous) => previous === current ? previous : current);
    };

    const frame = window.requestAnimationFrame(updateActiveSection);
    scroller.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [showModal, formErrors]);

  const handleDelete = (id: string) => {
    setDeleteTarget(despesas.find((despesa) => despesa.id === id) ?? null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseSubmitLock.current || submitMutation.isPending) return;
    setExpenseSubmitError('');
    const payload = {
      clienteId: effectiveExpenseClientId || null,
      projetoId: projetoId || null,
      viagemId: viagemId || null,
      descricao,
      fornecedor: fornecedor || null,
      numeroDocumento: numeroDocumento || null,
      comprovanteDocumentoId: comprovanteDocumentoId || null,
      valor: Math.round((parseFloat(valor || "0") || 0) * 100),
      data,
      dataCompetencia: dataCompetencia || data,
      dataPagamento: dataPagamento || null,
      categoria,
      subcategoria: subcategoria || null,
      tipoCusto,
      centroCusto,
      reembolsavel,
      observacoes: observacoes || null,
      status,
      formaPagamento
    };

    // Validation
    const schema = z.object({
      descricao: z.string().trim().min(1, 'Descrição é obrigatória'),
      valor: z.number().min(1, 'Valor inválido'),
      data: z.string().min(1, 'Selecione uma data')
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      const errors: Partial<Record<ExpenseRequiredField, string>> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if ((field === 'descricao' || field === 'valor' || field === 'data') && !errors[field]) errors[field] = issue.message;
      }
      setFormErrors(errors);
      const firstField = validation.error.issues[0]?.path[0];
      if (firstField === 'descricao' || firstField === 'valor' || firstField === 'data') {
        const firstId = firstField === 'descricao' ? 'despesa-desc' : `despesa-${firstField}`;
        window.requestAnimationFrame(() => document.getElementById(firstId)?.focus());
      }
      notifications.warning('Revise os campos obrigatórios destacados.');
      return;
    }

    setFormErrors({});
    expenseSubmitLock.current = true;
    submitMutation.mutate(payload);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    return status === 'Pago'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10';
  };

  return (
    <PageFrame embedded={embedded}>
      <PageHeader
        title="Contas a pagar"
        headingLevel={embedded ? 2 : 1}
        description="Controle de despesas, custos operacionais e reembolsos vinculados."
        className={embedded ? 'mb-8' : 'mb-12'}
        action={(
          <button id={`${expenseFormId}-create`} type="button" onClick={() => openCreateModal()} className={cn(primarySubmitButtonClass, 'w-full sm:w-auto')}>
            <Plus aria-hidden="true" className="h-4 w-4" weight="bold" />
            Nova despesa
          </button>
        )}
      />

      {/* Bento Grid Cards stats */}
      <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cn(geoGreenSurfaceClass, 'rounded-[2rem] p-6 shadow-sm ring-1 ring-emerald-300/15')}>
          <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total previsto</span>
          <p className={cn('mt-2 text-3xl font-bold tabular-nums', geoGreenValueClass)}>{formatCurrency(totalPrevisto)}</p>
        </div>
        <div className={cn(geoGreenSurfaceClass, 'rounded-[2rem] p-6 shadow-sm ring-1 ring-emerald-300/15')}>
          <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total pago</span>
          <p className={cn('mt-2 text-3xl font-bold tabular-nums', geoGreenValueClass)}>{formatCurrency(totalPago)}</p>
        </div>
        <div className={cn(geoOrangeSurfaceClass, 'rounded-[2rem] p-6 shadow-sm ring-1 ring-orange-300/15')}>
          <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Pendente (a vencer)</span>
          <p className={cn('mt-2 text-3xl font-bold tabular-nums', geoOrangeValueClass)}>{formatCurrency(totalPendente)}</p>
        </div>
        <div className={cn(geoPurpleSurfaceClass, 'rounded-[2rem] p-6 shadow-sm ring-1 ring-violet-300/15')}>
          <span className={cn('text-xs font-semibold uppercase tracking-wider', geoPurpleLabelClass)}>Total atrasado</span>
          <p className={cn('mt-2 text-3xl font-bold tabular-nums', geoPurpleValueClass)}>{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      <div className={cn('mb-6', filterBarClass)}>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.3fr)_repeat(8,minmax(120px,0.7fr))_auto] items-center">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              aria-label="Buscar contas a pagar"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por descrição, fornecedor, documento, projeto ou forma..."
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={categoriaFilter}
            onChange={setCategoriaFilter}
            placeholder="Todas as categorias"
            className="min-w-0"
            options={[{ label: 'Todas as categorias', value: 'Todos' }, ...filterExpenseCategories.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={subcategoriaFilter}
            onChange={setSubcategoriaFilter}
            placeholder="Todas as subcategorias"
            className="min-w-0"
            options={[{ label: 'Todas as subcategorias', value: 'Todos' }, ...filterExpenseSubcategories.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos os status"
            className="min-w-0"
            options={['Todos', 'Pendente', 'Pago', 'Atrasado'].map((value) => ({ label: value === 'Todos' ? 'Todos os status' : value, value }))}
          />
          <CustomSelect
            value={tipoCustoFilter}
            onChange={setTipoCustoFilter}
            placeholder="Todos os tipos"
            className="min-w-0"
            options={[{ label: 'Todos os tipos', value: 'Todos' }, ...TIPOS_CUSTO.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={centroCustoFilter}
            onChange={setCentroCustoFilter}
            placeholder="Todos os centros"
            className="min-w-0"
            options={[{ label: 'Todos os centros', value: 'Todos' }, ...CENTROS_CUSTO.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={reembolsavelFilter}
            onChange={setReembolsavelFilter}
            placeholder="Reembolso"
            className="min-w-0"
            options={[
              { label: 'Reembolso', value: 'Todos' },
              { label: 'Reembolsável', value: 'Sim' },
              { label: 'Não reembolsável', value: 'Nao' }
            ]}
          />
          <DatePickerField
            value={dataInicioFilter}
            onChange={(event) => setDataInicioFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Data inicial"
          />
          <DatePickerField
            value={dataFimFilter}
            onChange={(event) => setDataFimFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Data final"
          />
          {hasExpenseFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCategoriaFilter('Todos');
                setSubcategoriaFilter('Todos');
                setStatusFilter('Todos');
                setTipoCustoFilter('Todos');
                setCentroCustoFilter('Todos');
                setReembolsavelFilter('Todos');
                setDataInicioFilter('');
                setDataFimFilter('');
              }}
              className={filterClearButtonClass}
            >
              Limpar
            </button>
          )}
        </div>
        <p ref={resultsAnchor} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="geo-focus-ring scroll-mt-28 mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {filteredDespesas.length} de {expensePage?.total ?? 0} despesa(s) exibidas · Página {expensePage?.page ?? page} de {expensePage?.totalPages ?? 1} · Intervalo {filteredDespesas.length ? ((expensePage?.page ?? page) - 1) * 25 + 1 : 0}–{filteredDespesas.length ? ((expensePage?.page ?? page) - 1) * 25 + filteredDespesas.length : 0}
        </p>
      </div>

      <div className="space-y-4">
        {priorityExpense && (
          <FinanceDueWidget
            label={priorityExpense.data.slice(0, 10) < today ? 'Despesa vencida' : 'Próxima despesa'}
            amount={priorityExpense.valor}
            date={priorityExpense.data}
            title={priorityExpense.descricao}
            actionLabel="Ver despesa"
            onOpen={() => openEditModal(priorityExpense)}
          />
        )}
        {loading ? (
          <div className="py-24 flex justify-center">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
          </div>
        ) : despesasFailed ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
            <p className="font-semibold">Não foi possível carregar as contas a pagar.</p>
            <p className="mt-1 text-xs">Verifique a conexão e tente novamente.</p>
            <button type="button" onClick={() => void refetchDespesas()} className="mt-3 min-h-10 rounded-xl border border-rose-300 px-3 font-semibold hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:border-rose-500/40 dark:hover:bg-rose-500/20">Tentar novamente</button>
          </div>
        ) : despesas.length === 0 ? (
          <div className="bg-transparent border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center">
            <Receipt weight="duotone" className="w-16 h-16 text-zinc-300 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">Nenhuma despesa cadastrada ainda.</p>
          </div>
        ) : filteredDespesas.length === 0 ? (
          <div className="bg-transparent border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center">
            <MagnifyingGlass className="w-12 h-12 text-zinc-300 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">Nenhuma despesa encontrada com os filtros atuais.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.01)] ring-1 ring-zinc-900/5 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">Descrição</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">Categoria</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">Projeto</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">Valor</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDespesas.map((desp) => {
                  return (
                    <tr key={desp.id} className="hover:bg-zinc-50/40 transition-colors">
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatDateKey(desp.data)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{desp.descricao}</div>
                        {desp.observacoes && <div className="text-xs text-zinc-400 truncate max-w-[200px]" title={desp.observacoes}>{desp.observacoes}</div>}
                        {desp.clienteId && (
                          <Link to={appLinks.clientSection(desp.clienteId, 'financeiro')} className="geo-focus-ring mt-1 inline-flex rounded text-xs font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300">
                            Cliente: {desp.clienteNome || 'ver consolidado'}
                          </Link>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Tag weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
                          {desp.categoria}{desp.subcategoria ? ` · ${desp.subcategoria}` : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {desp.projetoNome && desp.projetoId ? (
                          <Link to={appLinks.projectSection(desp.projetoId, 'financeiro')} className="geo-focus-ring flex items-center gap-1.5 rounded text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-indigo-700 dark:text-zinc-200 dark:hover:text-indigo-300">
                            <FolderSimple aria-hidden="true" weight="bold" className="w-4 h-4 text-zinc-400" />
                            {desp.projetoNome}
                          </Link>
                        ) : desp.projetoNome ?? '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wider uppercase ${getStatusColor(desp.status)}`}>
                          {desp.status || 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-950 dark:text-white">
                        {formatCurrency(desp.valor)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!desp.canceladaEm && !desp.estornadaEm && (
                            <>
                              <button
                                id={`${expenseFormId}-edit-${desp.id}`}
                                onClick={() => openEditModal(desp)}
                                className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition-[background-color,color,border-color,transform] shadow-sm"
                                title="Editar despesa"
                                aria-label={`Editar despesa ${desp.descricao}`}
                              >
                                <PencilSimple aria-hidden="true" className="w-4 h-4" />
                              </button>
                              {(desp.status || '').toLowerCase() === 'pago' || desp.dataPagamento ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFinancialAction({ type: 'estorno', item: desp });
                                    setFinancialActionReason('');
                                    setFinancialActionDate(localDateKey());
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                                  aria-label={`Estornar despesa ${desp.descricao}`}
                                  title="Estornar despesa paga"
                                >
                                  <ArrowCounterClockwise aria-hidden="true" className="h-4 w-4" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFinancialAction({ type: 'cancelamento', item: desp });
                                      setFinancialActionReason('');
                                      setFinancialActionDate(localDateKey());
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                                    aria-label={`Cancelar despesa ${desp.descricao}`}
                                    title="Cancelar despesa"
                                  >
                                    <XCircle aria-hidden="true" className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(desp.id)}
                                    className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 transition-[background-color,color,border-color,transform] shadow-sm"
                                    title="Excluir despesa"
                                    aria-label={`Excluir despesa ${desp.descricao}`}
                                  >
                                    <Trash aria-hidden="true" className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(expensePage?.totalPages ?? 1) > 1 && (
              <nav aria-label="Paginação de despesas" className="flex items-center justify-between border-t border-zinc-100 px-6 py-4 text-xs dark:border-zinc-800">
                <button type="button" disabled={page <= 1} onClick={() => changePage(Math.max(1, page - 1))} className={secondarySmallActionButtonClass}>Anterior</button>
                <span className="font-mono tabular-nums">Página {page} de {expensePage?.totalPages}</span>
                <button type="button" disabled={page >= (expensePage?.totalPages ?? 1)} onClick={() => changePage(page + 1)} className={secondarySmallActionButtonClass}>Próxima</button>
              </nav>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={requestCloseExpenseModal}
        closeDisabled={submitMutation.isPending}
        title={selectedDespesa ? 'Editar despesa' : 'Nova despesa'}
        maxWidth="max-w-4xl"
        panelClassName="geo-expense-dialog"
        initialFocusId="despesa-desc"
        initialFocusPreventScroll
        returnFocusSelector={`[id="${expenseFormId}-${selectedDespesa ? `edit-${selectedDespesa.id}` : 'create'}"]`}
        ariaDescribedBy={expenseHintId}
        footer={<div className="space-y-3">
          {expenseSubmitError && <p role="alert" className="break-words text-sm font-medium text-red-700 dark:text-red-300">{expenseSubmitError}</p>}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] gap-2 sm:flex sm:justify-end sm:gap-3">
            <button type="button" disabled={submitMutation.isPending} onClick={requestCloseExpenseModal} className={cn(secondarySmallActionButtonClass, 'h-12 min-w-0 justify-center px-3 py-0 text-sm sm:w-32')}>Cancelar</button>
            <button type="submit" form={expenseFormId} disabled={submitMutation.isPending} aria-busy={submitMutation.isPending} className={cn(primarySubmitButtonClass, 'h-12 min-w-0 px-3 py-0 sm:w-52')}>
              <span aria-live="polite">{submitMutation.isPending ? 'Salvando…' : selectedDespesa ? 'Salvar despesa' : 'Cadastrar despesa'}</span>
            </button>
          </div>
        </div>}
      >
        <form id={expenseFormId} onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p id={expenseHintId} className="text-xs text-zinc-600 dark:text-zinc-300">Campos com * são obrigatórios. Os demais são opcionais.</p>
          <nav ref={expenseNavRef} aria-label="Seções da despesa" className="sticky top-0 z-20 flex flex-wrap gap-1 rounded-lg border border-brand-border bg-brand-surface p-1">
            {expenseSections.map(([sectionId, label]) => {
              const errorCount = sectionId === 'expense-identification' ? Object.values(formErrors).filter(Boolean).length : 0;
              return <button key={sectionId} type="button" disabled={submitMutation.isPending} aria-controls={sectionId} aria-current={activeExpenseSection === sectionId ? 'location' : undefined}
                aria-label={errorCount ? `${label}, ${errorCount} ${errorCount === 1 ? 'erro' : 'erros'}` : label}
                onClick={() => jumpToExpenseSection(sectionId)}
                className={cn('geo-focus-ring flex min-h-11 min-w-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold transition-[background-color,color,box-shadow] hover:bg-brand-surface-subtle hover:text-zinc-950 disabled:opacity-60 dark:hover:text-white', activeExpenseSection === sectionId ? 'bg-brand-surface-subtle text-zinc-950 shadow-sm ring-1 ring-brand-border dark:text-white' : 'text-zinc-600 dark:text-zinc-300')}>
                {label}{errorCount > 0 && <span aria-hidden="true" className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">{errorCount}</span>}
              </button>;
            })}
          </nav>
          <fieldset disabled={submitMutation.isPending} className="min-w-0 space-y-4">
            <FormSection sectionId="expense-identification" headingLevel={3} title="Dados principais" icon={<CurrencyDollar className="h-5 w-5" weight="duotone" />} tone="indigo">
              <div>
                <label htmlFor="despesa-desc" className={expenseLabelClass}>Descrição <span aria-hidden="true">*</span></label>
                <input id="despesa-desc" name="descricao" type="text" required autoComplete="off" value={descricao} onChange={e => { setDescricao(e.target.value); clearFormError('descricao'); }} aria-invalid={Boolean(formErrors.descricao)} aria-describedby={formErrors.descricao ? 'despesa-desc-error' : undefined} placeholder="Ex.: Combustível para visita de campo" className={expenseFieldClass} />
                {formErrors.descricao && <p id="despesa-desc-error" role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">{formErrors.descricao}</p>}
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="despesa-valor" className={expenseLabelClass}>Valor (R$) <span aria-hidden="true">*</span></label>
                  <NumericInput id="despesa-valor" name="valor" inputMode="decimal" step="0.01" required autoComplete="off" value={valor} onChange={e => { setValor(e.target.value); clearFormError('valor'); }} aria-invalid={Boolean(formErrors.valor)} aria-describedby={formErrors.valor ? 'despesa-valor-error' : undefined} placeholder="0,00" wrapperClassName="max-w-[18rem]" className={cn(expenseFieldClass, 'tabular-nums')} />
                  {formErrors.valor && <p id="despesa-valor-error" role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">{formErrors.valor}</p>}
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-data" className={expenseLabelClass}>Vencimento <span aria-hidden="true">*</span></label>
                  <DatePickerField id="despesa-data" name="data" required value={data} onChange={e => { setData(e.target.value); clearFormError('data'); }} aria-invalid={Boolean(formErrors.data)} aria-describedby={formErrors.data ? 'despesa-data-help despesa-data-error' : 'despesa-data-help'} className={expenseFieldClass} popoverClassName="geo-expense-calendar" />
                  <p id="despesa-data-help" className={expenseHelpClass}>Data usada para acompanhar o vencimento e calcular atrasos.</p>
                  {formErrors.data && <p id="despesa-data-error" role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">{formErrors.data}</p>}
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-competencia" className={expenseLabelClass}>Competência{optionalLabel}</label>
                  <DatePickerField id="despesa-competencia" name="dataCompetencia" value={dataCompetencia} onChange={e => setDataCompetencia(e.target.value)} aria-describedby="despesa-competencia-help" className={expenseFieldClass} popoverClassName="geo-expense-calendar" />
                  <p id="despesa-competencia-help" className={expenseHelpClass}>Data de referência da despesa, independente do pagamento. Se não informada, será usado o vencimento.</p>
                </div>
              </div>
            </FormSection>

            <FormSection sectionId="expense-links" headingLevel={3} title="Vínculos e comprovante" icon={<FolderSimple className="h-5 w-5" weight="duotone" />} tone="indigo" optional>
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="despesa-cliente" className={expenseLabelClass}>Cliente</label>
                  <RemoteCombobox<ClienteMin> id="despesa-cliente" name="clienteId" endpoint="/api/clientes/options" fill inModal density="form" className={expenseFieldClass} value={effectiveExpenseClientId || ''} selectedLabel={effectiveExpenseClientName || ''} disabled={Boolean(projetoId) || submitMutation.isPending} aria-describedby="despesa-cliente-help" onChange={(nextClientId, option) => { setClienteId(nextClientId); setClienteNome(option?.nome || ''); }} emptyLabel="Administrativo / sem cliente" placeholder="Pesquisar cliente…" listLabel="Clientes da despesa" />
                  <p id="despesa-cliente-help" className={expenseHelpClass}>{projetoId ? 'Definido automaticamente pelo projeto selecionado.' : 'Pode ficar sem vínculo em despesas administrativas ou gerais.'}</p>
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-projeto" className={expenseLabelClass}>Projeto</label>
                  <RemoteCombobox<ProjetoMin> id="despesa-projeto" name="projetoId" endpoint="/api/projetos/options" fill inModal density="form" className={expenseFieldClass} disabled={submitMutation.isPending} value={projetoId} onChange={(nextProjectId, option) => {
                    if (comprovanteDocumentoId) notifications.info('O comprovante foi desvinculado porque o projeto mudou. Selecione um arquivo compatível.');
                    setProjetoId(nextProjectId); setComprovanteDocumentoId(''); setViagemId('');
                    if (option?.clienteId) { setClienteId(option.clienteId); setClienteNome(option.clienteNome || ''); }
                  }} emptyLabel="Nenhum" placeholder="Pesquisar projeto…" listLabel="Projetos da despesa" />
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-fornecedor" className={expenseLabelClass}>Fornecedor</label>
                  <input id="despesa-fornecedor" name="fornecedor" type="text" autoComplete="organization" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Ex.: Posto ou cartório" className={expenseFieldClass} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-numero-documento" className={expenseLabelClass}>Número do documento</label>
                  <input id="despesa-numero-documento" name="numeroDocumento" type="text" autoComplete="off" spellCheck={false} value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="Ex.: NF 1234 ou recibo 56" className={expenseFieldClass} />
                </div>
                <div className="min-w-0 md:col-span-2">
                  <label htmlFor="despesa-comprovante-vinculado" className={expenseLabelClass}>Arquivo de comprovante</label>
                  <FormSelect {...expenseSelectProps} id="despesa-comprovante-vinculado" name="comprovanteDocumentoId" value={comprovanteDocumentoId} onChange={e => setComprovanteDocumentoId(e.target.value)} disabled={!projetoId || submitMutation.isPending} aria-describedby="despesa-comprovante-help" className={expenseFieldClass}>
                    <option value="">{projetoId ? 'Nenhum arquivo vinculado' : 'Selecione primeiro um projeto'}</option>
                    {comprovantes.map(documento => <option key={documento.id} value={documento.id}>{documento.projetoId ? 'Projeto' : 'Cliente'} — {documento.nome}</option>)}
                  </FormSelect>
                  <p id="despesa-comprovante-help" className={expenseHelpClass}>{!projetoId ? 'Selecione um projeto para consultar os comprovantes compatíveis. ' : ''}O arquivo permanece em sua pasta original; apenas o vínculo é registrado.</p>
                </div>
                <div className="min-w-0 md:col-span-2">
                  <label htmlFor="despesa-viagem" className={expenseLabelClass}>Viagem / prestação de contas</label>
                  <FormSelect {...expenseSelectProps} id="despesa-viagem" name="viagemId" value={viagemId} onChange={e => setViagemId(e.target.value)} disabled={submitMutation.isPending} className={expenseFieldClass}>
                    <option value="">Nenhuma</option>
                    {viagens.filter(viagem => viagem.status !== 'encerrada' && (!projetoId || !viagem.projetoId || viagem.projetoId === projetoId)).map(viagem => <option key={viagem.id} value={viagem.id}>{viagem.finalidade} · {viagem.destino}</option>)}
                  </FormSelect>
                </div>
              </div>
            </FormSection>

            <FormSection sectionId="expense-classification" headingLevel={3} title="Classificação" icon={<Tag className="h-5 w-5" weight="duotone" />} tone="indigo">
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="despesa-categoria" className={expenseLabelClass}>Categoria <span aria-hidden="true">*</span></label>
                  <FormSelect {...expenseSelectProps} id="despesa-categoria" name="categoria" required value={categoria} onChange={e => { setCategoria(e.target.value); setSubcategoria(''); }} disabled={submitMutation.isPending} className={expenseFieldClass}>{formExpenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</FormSelect>
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-subcategoria" className={expenseLabelClass}>Subcategoria{optionalLabel}</label>
                  <FormSelect {...expenseSelectProps} id="despesa-subcategoria" name="subcategoria" value={subcategoria} onChange={e => setSubcategoria(e.target.value)} disabled={submitMutation.isPending} className={expenseFieldClass}>
                    <option value="">Sem subcategoria</option>{formExpenseSubcategories.map(value => <option key={value} value={value}>{value}</option>)}
                  </FormSelect>
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-tipo-custo" className={expenseLabelClass}>Tipo de custo{optionalLabel}</label>
                  <FormSelect {...expenseSelectProps} id="despesa-tipo-custo" name="tipoCusto" value={tipoCusto} onChange={e => setTipoCusto(e.target.value)} disabled={submitMutation.isPending} className={expenseFieldClass}>{TIPOS_CUSTO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}</FormSelect>
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-centro-custo" className={expenseLabelClass}>Centro de custo{optionalLabel}</label>
                  <FormSelect {...expenseSelectProps} id="despesa-centro-custo" name="centroCusto" value={centroCusto} onChange={e => setCentroCusto(e.target.value)} disabled={submitMutation.isPending} className={expenseFieldClass}>{CENTROS_CUSTO.map(centro => <option key={centro} value={centro}>{centro}</option>)}</FormSelect>
                </div>
              </div>
            </FormSection>

            <FormSection sectionId="expense-payment" headingLevel={3} title="Pagamento e reembolso" icon={<Receipt className="h-5 w-5" weight="duotone" />} tone="indigo" optional>
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="despesa-status" className={expenseLabelClass}>Situação do pagamento</label>
                  <FormSelect {...expenseSelectProps} id="despesa-status" name="status" value={status} onChange={e => setStatus(e.target.value)} disabled={submitMutation.isPending} className={expenseFieldClass}><option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Atrasado">Atrasado</option></FormSelect>
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-forma" className={expenseLabelClass}>Forma de pagamento</label>
                  <FormSelect {...expenseSelectProps} id="despesa-forma" name="formaPagamento" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} disabled={submitMutation.isPending} className={expenseFieldClass}><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão de Crédito">Cartão de crédito</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência bancária</option></FormSelect>
                </div>
                <div className="min-w-0">
                  <label htmlFor="despesa-data-pagamento" className={expenseLabelClass}>Data de pagamento</label>
                  <DatePickerField id="despesa-data-pagamento" name="dataPagamento" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} aria-describedby="despesa-pagamento-help" className={expenseFieldClass} popoverClassName="geo-expense-calendar" />
                </div>
                <p id="despesa-pagamento-help" className={cn(expenseHelpClass, 'self-center')}>Informe a data efetiva somente para despesas com situação Pago. Na criação, se estiver como Pago e sem data informada, o serviço registra a data atual.</p>
              </div>
              <CheckboxField id="despesa-reembolsavel" label="Despesa reembolsável pelo cliente" checked={reembolsavel} onChange={setReembolsavel} className="rounded-lg border border-brand-border bg-brand-surface-subtle p-3 text-zinc-800 dark:text-zinc-200" />
            </FormSection>

            <FormSection sectionId="expense-notes" headingLevel={3} title="Observações" icon={<Receipt className="h-5 w-5" weight="duotone" />} tone="indigo" optional>
              <label htmlFor="despesa-obs" className="sr-only">Observações</label>
              <textarea id="despesa-obs" name="observacoes" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: Detalhes para conferência ou prestação de contas…" rows={4} className={cn(geoFieldClass, 'min-h-28 w-full resize-none px-3 py-2.5 text-sm leading-relaxed')} />
            </FormSection>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          setShowDiscardDialog(false);
          // Release the confirmation's focus ownership before closing its editor.
          window.requestAnimationFrame(closeExpenseModal);
        }}
        title="Descartar alterações?"
        returnFocusSelector={`[id="${expenseFormId}-${selectedDespesa ? `edit-${selectedDespesa.id}` : 'create'}"]`}
        description="As informações preenchidas nesta despesa ainda não foram salvas."
        confirmText="Descartar alterações"
        cancelText="Continuar editando"
        variant="warning"
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title={`Excluir despesa${deleteTarget?.descricao ? ` “${deleteTarget.descricao}”` : ''}?`}
        description="Somente despesas ainda não pagas podem ser excluídas. Para uma despesa paga, registre um estorno e preserve o histórico financeiro."
        confirmText="Excluir despesa"
        loading={deleteMutation.isPending}
      />
      <Modal
        isOpen={Boolean(financialAction)}
        onClose={() => !financialActionMutation.isPending && setFinancialAction(null)}
        title={financialAction?.type === 'estorno' ? 'Estornar despesa paga' : 'Cancelar despesa'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={(event) => { event.preventDefault(); financialActionMutation.mutate(); }} className="space-y-4">
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            O registro permanecerá no histórico financeiro e na trilha de auditoria.
          </p>
          <label className="block space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <span>Motivo</span>
            <textarea
              name="motivo"
              required
              minLength={5}
              rows={4}
              value={financialActionReason}
              onChange={(event) => setFinancialActionReason(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <span>{financialAction?.type === 'estorno' ? 'Data do estorno' : 'Data do cancelamento'}</span>
            <DatePickerField
              name="dataAcaoFinanceira"
              required
              value={financialActionDate}
              onChange={(event) => setFinancialActionDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setFinancialAction(null)} disabled={financialActionMutation.isPending} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold dark:border-zinc-800">Voltar</button>
            <button type="submit" disabled={financialActionMutation.isPending || financialActionReason.trim().length < 5} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">
              {financialActionMutation.isPending ? 'Salvando…' : financialAction?.type === 'estorno' ? 'Confirmar estorno' : 'Confirmar cancelamento'}
            </button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
