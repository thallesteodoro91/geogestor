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
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { motion } from 'framer-motion';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckboxField, DatePickerField, FormFooter, FormSection, FormSelect, NumericInput } from '../../components/Form';
import { apiFetch, apiClient, type PaginatedResponse } from '../../services/apiClient';
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

const TIPOS_CUSTO = ['Fixo', 'Variável de campo', 'Cartório e taxas', 'Tributário', 'Operacional', 'Reembolsável'];
const CENTROS_CUSTO = ['Administrativo', 'Campo', 'Cartório', 'Tributos', 'Software', 'Equipamentos', 'Serviços'];

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
  const catalogsQuery = useAuxiliaryCatalogs();
  const [showModal, setShowModal] = useState(openCreateOnMount);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [initialFormFingerprint, setInitialFormFingerprint] = useState(() => openCreateOnMount ? newExpenseFingerprint(initialProjectId) : '');
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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('Todos');
  const [subcategoriaFilter, setSubcategoriaFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tipoCustoFilter, setTipoCustoFilter] = useState('Todos');
  const [centroCustoFilter, setCentroCustoFilter] = useState('Todos');
  const [reembolsavelFilter, setReembolsavelFilter] = useState('Todos');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');
  const expenseFilterKey = [searchTerm, categoriaFilter, subcategoriaFilter, statusFilter, tipoCustoFilter, centroCustoFilter, reembolsavelFilter, dataInicioFilter, dataFimFilter].join('\u001f');
  const [expensePagination, setExpensePagination] = useState({ filterKey: '', page: 1 });
  const page = expensePagination.filterKey === expenseFilterKey ? expensePagination.page : 1;

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
  const { data: expensePage, isLoading: despesasLoading, isError: despesasFailed, refetch: refetchDespesas } = useQuery<ExpensePage>({
    queryKey: ['despesas', expenseQueryString],
    queryFn: () => apiClient.get<ExpensePage>(`/api/financeiro/despesas?${expenseQueryString}`),
    placeholderData: (previous) => previous
  });
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
        throw new Error(errorData?.error || 'Erro ao salvar despesa');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowModal(false);
      setInitialFormFingerprint('');
      invalidateFinancialQueries(queryClient);
    },
    onError: (err) => {
      notifications.error(err instanceof Error ? err.message : 'Erro ao salvar despesa.');
    }
  });

  // Actions
  const handledExpenseIdRef = useRef<string | null>(null);

  const openCreateModal = (preferredProjectId = initialProjectId) => {
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
  };

  const requestCloseExpenseModal = () => {
    if (submitMutation.isPending) return;
    if (hasUnsavedExpense) {
      setShowDiscardDialog(true);
      return;
    }
    closeExpenseModal();
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(despesas.find((despesa) => despesa.id === id) ?? null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      descricao: z.string().min(1, 'Descrição é obrigatória'),
      valor: z.number().min(1, 'Valor inválido'),
      data: z.string().min(1, 'Selecione uma data')
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      notifications.warning(validation.error.issues[0].message);
      return;
    }

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
        description="Controle de despesas, custos operacionais e reembolsos vinculados."
        className={embedded ? 'mb-8' : 'mb-12'}
        action={(
          <button type="button" onClick={() => openCreateModal()} className={cn(primarySubmitButtonClass, 'w-full sm:w-auto')}>
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
        <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {filteredDespesas.length} de {expensePage?.total ?? 0} despesa(s) exibidas
        </p>
      </div>

      <div className="space-y-4">
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
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Descrição</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Categoria</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Projeto</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Valor</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 text-right">Ações</th>
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
                <button type="button" disabled={page <= 1} onClick={() => setExpensePagination({ filterKey: expenseFilterKey, page: Math.max(1, page - 1) })} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Anterior</button>
                <span className="font-mono tabular-nums">Página {page} de {expensePage?.totalPages}</span>
                <button type="button" disabled={page >= (expensePage?.totalPages ?? 1)} onClick={() => setExpensePagination({ filterKey: expenseFilterKey, page: page + 1 })} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Próxima</button>
              </nav>
            )}
          </div>
        )}
      </div>

      {/* Modal structure */}
      <Modal
        isOpen={showModal}
        onClose={requestCloseExpenseModal}
        closeDisabled={submitMutation.isPending}
        title={selectedDespesa ? 'Editar Despesa' : 'Nova Despesa'}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection sectionId="expense-identification" title="Identificação e documento" description="Descreva a despesa e registre o fornecedor ou comprovante relacionado." icon={<Receipt className="h-5 w-5" weight="duotone" />} tone="indigo">
            <div>
              <label htmlFor="despesa-desc" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Descrição *</label>
              <input id="despesa-desc" name="descricao" type="text" required autoComplete="off" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Combustível para viagem de campo" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="despesa-fornecedor" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Fornecedor</label>
                <input id="despesa-fornecedor" name="fornecedor" type="text" autoComplete="organization" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Cartório, prefeitura, posto…" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label htmlFor="despesa-numero-documento" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Documento / comprovante</label>
                <input id="despesa-numero-documento" name="numeroDocumento" type="text" autoComplete="off" spellCheck={false} value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="NF, recibo, guia ou protocolo" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="despesa-comprovante-vinculado" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Arquivo de comprovante vinculado</label>
                <FormSelect
                  id="despesa-comprovante-vinculado"
                  name="comprovanteDocumentoId"
                  value={comprovanteDocumentoId}
                  onChange={(event) => setComprovanteDocumentoId(event.target.value)}
                  disabled={!projetoId}
                  className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">{projetoId ? 'Nenhum arquivo vinculado' : 'Selecione primeiro um projeto'}</option>
                  {comprovantes.map((documento) => (
                    <option key={documento.id} value={documento.id}>
                      {documento.projetoId ? 'Projeto' : 'Cliente'} — {documento.nome}
                    </option>
                  ))}
                </FormSelect>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">O arquivo permanece em sua pasta original e apenas o vínculo é registrado.</p>
              </div>
            </div>
          </FormSection>

          <FormSection sectionId="expense-value-dates" title="Valor e datas" description="Informe o valor, a competência e as datas efetivas da despesa." icon={<CurrencyDollar className="h-5 w-5" weight="duotone" />} tone="indigo">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="despesa-valor" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Valor (R$) *</label>
                <NumericInput id="despesa-valor" name="valor" inputMode="decimal" step="0.01" required autoComplete="off" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium tabular-nums text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label htmlFor="despesa-data" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Data *</label>
                <DatePickerField id="despesa-data" name="data" required autoComplete="off" value={data} onChange={e => setData(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label htmlFor="despesa-competencia" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Competência</label>
                <DatePickerField id="despesa-competencia" name="dataCompetencia" autoComplete="off" value={dataCompetencia} onChange={e => setDataCompetencia(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label htmlFor="despesa-data-pagamento" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Data de pagamento</label>
                <DatePickerField id="despesa-data-pagamento" name="dataPagamento" autoComplete="off" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
            </div>
          </FormSection>

          <FormSection sectionId="expense-classification" title="Classificação e vínculo" description="Associe a despesa ao projeto e à estrutura gerencial correta." icon={<FolderSimple className="h-5 w-5" weight="duotone" />} tone="indigo">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="despesa-categoria" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Categoria</label>
                <FormSelect id="despesa-categoria" name="categoria" value={categoria} onChange={e => { setCategoria(e.target.value); setSubcategoria(''); }} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">{formExpenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</FormSelect>
              </div>
              <div>
                <label htmlFor="despesa-subcategoria" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Subcategoria</label>
                <FormSelect id="despesa-subcategoria" name="subcategoria" value={subcategoria} onChange={e => setSubcategoria(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  <option value="">Sem subcategoria</option>
                  {formExpenseSubcategories.map((value) => <option key={value} value={value}>{value}</option>)}
                </FormSelect>
              </div>
              <div>
                <label htmlFor="despesa-cliente" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cliente vinculado</label>
                <RemoteCombobox<ClienteMin> id="despesa-cliente" name="clienteId" endpoint="/api/clientes/options" value={effectiveExpenseClientId || ''} selectedLabel={effectiveExpenseClientName || ''} disabled={Boolean(projetoId)} onChange={(nextClientId, option) => { setClienteId(nextClientId); setClienteNome(option?.nome || ''); }} emptyLabel="Administrativo / sem cliente" placeholder="Pesquisar cliente…" />
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{projetoId ? 'Definido automaticamente pelo projeto selecionado.' : 'Opcional para despesas administrativas ou gerais.'}</p>
              </div>
              <div>
                <label htmlFor="despesa-projeto" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Projeto vinculado</label>
                <RemoteCombobox<ProjetoMin> id="despesa-projeto" name="projetoId" endpoint="/api/projetos/options" value={projetoId} onChange={(nextProjectId, option) => {
                  if (comprovanteDocumentoId) notifications.info('O comprovante foi desvinculado porque o projeto mudou. Selecione um arquivo compatível.');
                  setProjetoId(nextProjectId);
                  setComprovanteDocumentoId('');
                  setViagemId('');
                  if (option?.clienteId) {
                    setClienteId(option.clienteId);
                    setClienteNome(option.clienteNome || '');
                  }
                }} emptyLabel="Nenhum" placeholder="Pesquisar projeto…" />
              </div>
              <div>
                <label htmlFor="despesa-viagem" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Viagem / prestação de contas</label>
                <FormSelect id="despesa-viagem" name="viagemId" value={viagemId} onChange={e => setViagemId(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  <option value="">Nenhuma</option>
                  {viagens
                    .filter((viagem) => viagem.status !== 'encerrada' && (!projetoId || !viagem.projetoId || viagem.projetoId === projetoId))
                    .map((viagem) => <option key={viagem.id} value={viagem.id}>{viagem.finalidade} · {viagem.destino}</option>)}
                </FormSelect>
              </div>
              <div>
                <label htmlFor="despesa-tipo-custo" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tipo de custo</label>
                <FormSelect id="despesa-tipo-custo" name="tipoCusto" value={tipoCusto} onChange={e => setTipoCusto(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">{TIPOS_CUSTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</FormSelect>
              </div>
              <div>
                <label htmlFor="despesa-centro-custo" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Centro de custo</label>
                <FormSelect id="despesa-centro-custo" name="centroCusto" value={centroCusto} onChange={e => setCentroCusto(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">{CENTROS_CUSTO.map((centro) => <option key={centro} value={centro}>{centro}</option>)}</FormSelect>
              </div>
            </div>
          </FormSection>

          <FormSection sectionId="expense-payment" title="Pagamento e reembolso" description="Controle a situação financeira e se o valor será reembolsado pelo cliente." icon={<Tag className="h-5 w-5" weight="duotone" />} tone="indigo">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="despesa-status" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status do pagamento</label>
                <FormSelect id="despesa-status" name="status" value={status} onChange={e => setStatus(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"><option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Atrasado">Atrasado</option></FormSelect>
              </div>
              <div>
                <label htmlFor="despesa-forma" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Forma de pagamento</label>
                <FormSelect id="despesa-forma" name="formaPagamento" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão de Crédito">Cartão de crédito</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência bancária</option></FormSelect>
              </div>
            </div>
            <CheckboxField id="despesa-reembolsavel" label="Despesa reembolsável pelo cliente" checked={reembolsavel} onChange={setReembolsavel} className="rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200" />
          </FormSection>

          <FormSection sectionId="expense-notes" title="Observações" description="Registre detalhes úteis para conferência ou prestação de contas." icon={<Receipt className="h-5 w-5" weight="duotone" />} tone="indigo" optional>
            <label htmlFor="despesa-obs" className="sr-only">Observações</label>
            <textarea id="despesa-obs" name="observacoes" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Adicione notas adicionais sobre a despesa…" rows={4} className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium leading-relaxed text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
          </FormSection>

          <FormFooter>
            <button type="button" onClick={requestCloseExpenseModal} className={cn(secondarySmallActionButtonClass, 'px-6 py-3')}>Cancelar</button>
            <button type="submit" disabled={submitMutation.isPending} aria-busy={submitMutation.isPending} className={cn(primarySubmitButtonClass, 'px-6 py-3 disabled:cursor-wait disabled:opacity-70')}>{submitMutation.isPending ? 'Salvando…' : selectedDespesa ? 'Salvar despesa' : 'Cadastrar despesa'}</button>
          </FormFooter>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          setShowDiscardDialog(false);
          closeExpenseModal();
        }}
        title="Descartar alterações?"
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
