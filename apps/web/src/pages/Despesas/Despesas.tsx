import { ArrowCounterClockwise, CurrencyDollar, FolderSimple, MagnifyingGlass, PencilSimple, Plus, Receipt, Tag, Trash, XCircle } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
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
import { CheckboxField, DatePickerField, FormFooter, FormSection, FormSelect, NumericInput } from '../../components/Form';
import { apiFetch, apiClient } from '../../services/apiClient';
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

const TIPOS_CUSTO = ['Fixo', 'Variável de campo', 'Cartório e taxas', 'Tributário', 'Operacional', 'Reembolsável'];
const CENTROS_CUSTO = ['Administrativo', 'Campo', 'Cartório', 'Tributos', 'Software', 'Equipamentos', 'Serviços'];

export interface DespesaItem {
  id: string;
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
  tipoCusto?: string | null;
  centroCusto?: string | null;
  reembolsavel?: boolean | number | null;
  observacoes?: string | null;
  status: string;
  formaPagamento: string;
  canceladaEm?: string | null;
  motivoCancelamento?: string | null;
  estornadaEm?: string | null;
  motivoEstorno?: string | null;
}

export interface ProjetoMin {
  id: string;
  nome: string;
}

interface ViagemMin {
  id: string;
  finalidade: string;
  destino: string;
  projetoId?: string | null;
  status: string;
}

function PageFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

function newExpenseFingerprint() {
  const today = new Date().toISOString().split('T')[0];
  return JSON.stringify({
    projetoId: '',
    viagemId: '',
    descricao: '',
    fornecedor: '',
    numeroDocumento: '',
    valor: '',
    data: today,
    dataCompetencia: today,
    dataPagamento: '',
    categoria: 'Combustível',
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
  focusDespesaId,
  onFocusHandled
}: {
  embedded?: boolean;
  openCreateOnMount?: boolean;
  focusDespesaId?: string;
  onFocusHandled?: () => void;
}) {
  const queryClient = useQueryClient();
  const catalogsQuery = useAuxiliaryCatalogs();
  const [showModal, setShowModal] = useState(openCreateOnMount);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [initialFormFingerprint, setInitialFormFingerprint] = useState(() => openCreateOnMount ? newExpenseFingerprint() : '');
  const [selectedDespesa, setSelectedDespesa] = useState<DespesaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DespesaItem | null>(null);
  const [financialAction, setFinancialAction] = useState<{ type: 'cancelamento' | 'estorno'; item: DespesaItem } | null>(null);
  const [financialActionReason, setFinancialActionReason] = useState('');
  const [financialActionDate, setFinancialActionDate] = useState(new Date().toISOString().slice(0, 10));

  // Form states
  const [projetoId, setProjetoId] = useState('');
  const [viagemId, setViagemId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toISOString().split('T')[0]);
  const [dataPagamento, setDataPagamento] = useState('');
  const [categoria, setCategoria] = useState('Combustível');
  const [tipoCusto, setTipoCusto] = useState('Variável de campo');
  const [centroCusto, setCentroCusto] = useState('Campo');
  const [reembolsavel, setReembolsavel] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('Pendente');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tipoCustoFilter, setTipoCustoFilter] = useState('Todos');
  const [centroCustoFilter, setCentroCustoFilter] = useState('Todos');
  const [reembolsavelFilter, setReembolsavelFilter] = useState('Todos');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  // Queries
  const { data: despesas = [], isLoading: despesasLoading } = useQuery<DespesaItem[]>({
    queryKey: ['despesas'],
    queryFn: () => apiClient.get<DespesaItem[]>('/api/financeiro/despesas')
  });

  const { data: viagens = [], isLoading: viagensLoading } = useQuery<ViagemMin[]>({
    queryKey: ['viagens'],
    queryFn: () => apiClient.get<ViagemMin[]>('/api/financeiro/viagens')
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

  const loading = despesasLoading || viagensLoading;
  const formFingerprint = JSON.stringify({
    projetoId,
    viagemId,
    descricao,
    fornecedor,
    numeroDocumento,
    valor,
    data,
    dataCompetencia,
    dataPagamento,
    categoria,
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

  const filteredDespesas = despesas.filter((desp) => {
    const searchable = [
      desp.descricao,
      desp.fornecedor,
      desp.numeroDocumento,
      desp.categoria,
      desp.tipoCusto,
      desp.centroCusto,
      desp.status,
      desp.formaPagamento,
      desp.observacoes,
      desp.projetoNome,
      desp.projetoNome
    ].filter(Boolean).join(' ');
    const matchesSearchTerm = matchesSearch(searchable, searchTerm);
    const matchesCategoria = categoriaFilter === 'Todos' || desp.categoria === categoriaFilter;
    const matchesStatus = statusFilter === 'Todos' || desp.status === statusFilter;
    const matchesTipoCusto = tipoCustoFilter === 'Todos' || desp.tipoCusto === tipoCustoFilter;
    const matchesCentroCusto = centroCustoFilter === 'Todos' || desp.centroCusto === centroCustoFilter;
    const isReembolsavel = Boolean(desp.reembolsavel);
    const matchesReembolsavel =
      reembolsavelFilter === 'Todos' ||
      (reembolsavelFilter === 'Sim' && isReembolsavel) ||
      (reembolsavelFilter === 'Nao' && !isReembolsavel);
    const matchesStart = !dataInicioFilter || (desp.data && desp.data >= dataInicioFilter);
    const matchesEnd = !dataFimFilter || (desp.data && desp.data <= dataFimFilter);
    return matchesSearchTerm && matchesCategoria && matchesStatus && matchesTipoCusto && matchesCentroCusto && matchesReembolsavel && matchesStart && matchesEnd;
  });
  const hasExpenseFilters = Boolean(
    searchTerm ||
    categoriaFilter !== 'Todos' ||
    statusFilter !== 'Todos' ||
    tipoCustoFilter !== 'Todos' ||
    centroCustoFilter !== 'Todos' ||
    reembolsavelFilter !== 'Todos' ||
    dataInicioFilter ||
    dataFimFilter
  );

  // Stats calculation
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const despesasValidas = filteredDespesas.filter((despesa) => !despesa.canceladaEm && !despesa.estornadaEm);
  const totalPrevisto = despesasValidas.reduce((acc, despesa) => acc + despesa.valor, 0);
  const totalPago = despesasValidas
    .filter((despesa) => despesa.status === 'Pago')
    .reduce((acc, despesa) => acc + despesa.valor, 0);
  const despesasEmAberto = despesasValidas.filter((despesa) => despesa.status !== 'Pago');
  const totalPendente = despesasEmAberto
    .filter((despesa) => {
      const dataDespesa = new Date(`${despesa.data.slice(0, 10)}T00:00:00`);
      return Number.isNaN(dataDespesa.getTime()) || dataDespesa >= hoje;
    })
    .reduce((acc, despesa) => acc + despesa.valor, 0);
  const totalAtrasado = despesasEmAberto
    .filter((despesa) => {
      const dataDespesa = new Date(`${despesa.data.slice(0, 10)}T00:00:00`);
      return !Number.isNaN(dataDespesa.getTime()) && dataDespesa < hoje;
    })
    .reduce((acc, despesa) => acc + despesa.valor, 0);

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

  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const initialValues = {
      projetoId: '',
      viagemId: '',
      descricao: '',
      fornecedor: '',
      numeroDocumento: '',
      valor: '',
      data: today,
      dataCompetencia: today,
      dataPagamento: '',
      categoria: 'CombustÃ­vel',
      tipoCusto: 'VariÃ¡vel de campo',
      centroCusto: 'Campo',
      reembolsavel: false,
      observacoes: '',
      status: 'Pendente',
      formaPagamento: 'Pix'
    };
    setSelectedDespesa(null);
    setProjetoId('');
    setViagemId('');
    setDescricao('');
    setFornecedor('');
    setNumeroDocumento('');
    setValor('');
    setData(today);
    setDataCompetencia(today);
    setDataPagamento('');
    setCategoria('Combustível');
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
      viagemId: desp.viagemId || '',
      descricao: desp.descricao || '',
      fornecedor: desp.fornecedor || '',
      numeroDocumento: desp.numeroDocumento || '',
      valor: (desp.valor / 100).toString(),
      data: desp.data || '',
      dataCompetencia: desp.dataCompetencia || desp.data || '',
      dataPagamento: desp.dataPagamento || '',
      categoria: desp.categoria || 'CombustÃ­vel',
      tipoCusto: desp.tipoCusto || 'Operacional',
      centroCusto: desp.centroCusto || 'Administrativo',
      reembolsavel: Boolean(desp.reembolsavel),
      observacoes: desp.observacoes || '',
      status: desp.status || 'Pendente',
      formaPagamento: desp.formaPagamento || 'Pix'
    };
    setSelectedDespesa(desp);
    setProjetoId(desp.projetoId || '');
    setViagemId(desp.viagemId || '');
    setDescricao(desp.descricao || '');
    setFornecedor(desp.fornecedor || '');
    setNumeroDocumento(desp.numeroDocumento || '');
    setValor((desp.valor / 100).toString());
    setData(desp.data || '');
    setDataCompetencia(desp.dataCompetencia || desp.data || '');
    setDataPagamento(desp.dataPagamento || '');
    setCategoria(desp.categoria || 'Combustível');
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
      projetoId: projetoId || null,
      viagemId: viagemId || null,
      descricao,
      fornecedor: fornecedor || null,
      numeroDocumento: numeroDocumento || null,
      valor: Math.round((parseFloat(valor || "0") || 0) * 100),
      data,
      dataCompetencia: dataCompetencia || data,
      dataPagamento: dataPagamento || null,
      categoria,
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
          <button type="button" onClick={openCreateModal} className={cn(primarySubmitButtonClass, 'w-full sm:w-auto')}>
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
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_repeat(7,minmax(126px,0.7fr))_auto] items-center">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
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
          {filteredDespesas.length} de {despesas.length} despesa(s) exibidas
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-24 flex justify-center">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
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
                        {new Date(desp.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{desp.descricao}</div>
                        {desp.observacoes && <div className="text-xs text-zinc-400 truncate max-w-[200px]" title={desp.observacoes}>{desp.observacoes}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Tag weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
                          {desp.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {desp.projetoNome ? (
                          <span className="flex items-center gap-1.5 text-zinc-700">
                            <FolderSimple weight="bold" className="w-4 h-4 text-zinc-400" />
                            {desp.projetoNome}
                          </span>
                        ) : '-'}
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
                                    setFinancialActionDate(new Date().toISOString().slice(0, 10));
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
                                      setFinancialActionDate(new Date().toISOString().slice(0, 10));
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
                <FormSelect id="despesa-categoria" name="categoria" value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,box-shadow] focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">{formExpenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</FormSelect>
              </div>
              <div>
                <label htmlFor="despesa-projeto" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Projeto vinculado</label>
                <RemoteCombobox<ProjetoMin> id="despesa-projeto" name="projetoId" endpoint="/api/projetos/options" value={projetoId} onChange={setProjetoId} emptyLabel="Nenhum" placeholder="Pesquisar projeto…" />
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
