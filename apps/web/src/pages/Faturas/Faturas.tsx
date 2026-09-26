import { toast } from 'sonner';
import { DatePickerField, FormSelect } from '../../components/Form';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ArrowCounterClockwise, Check, Printer, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { apiFetch, apiClient } from '../../services/apiClient';
import type { PaginatedResponse } from '../../services/apiClient';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
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

interface Parcela {
  id: string;
  orcamentoId: string;
  orcamentoDescricao?: string;
  clienteNome: string;
  clienteId: string;
  projetoId?: string | null;
  numeroParcela: number;
  totalParcelas: number;
  valor: number; // in cents
  valorPago?: number | null;
  recebidoCaixa?: number | null;
  dataVencimento: string;
  statusPagamento: string;
}

interface InstallmentPage extends PaginatedResponse<Parcela> {
  summary: { faturamentoTotal: number; totalRecebido: number; totalPendente: number; totalAtrasado: number };
}

interface ReceiptDocument {
  id: string;
  nome: string;
  extensao: string;
  projetoId?: string | null;
  tamanhoBytes: number;
}

interface Receipt {
  id: string;
  parcelaId: string;
  valorPrincipal: number;
  juros: number;
  multa: number;
  desconto: number;
  taxas: number;
  valorRecebido: number;
  dataRecebimento: string;
  meioPagamento?: string | null;
  observacoes?: string | null;
  comprovanteDocumentoId?: string | null;
  estornadoEm?: string | null;
  motivoEstorno?: string | null;
}

interface BudgetOption {
  id: string;
  number?: string | null;
  description: string;
  status: string;
  totalCents: number;
  clientId: string;
  clientName: string;
  projectId?: string | null;
  projectName?: string | null;
}

interface ProjectContextOption {
  id: string;
  nome: string;
  clienteId: string;
  clienteNome?: string | null;
}

function PageFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

export function Faturas({
  embedded = false,
  openCreateOnMount = false,
  initialProjectId = '',
  initialClientId = '',
  focusParcelaId,
  onFocusHandled
}: {
  embedded?: boolean;
  openCreateOnMount?: boolean;
  initialProjectId?: string;
  initialClientId?: string;
  focusParcelaId?: string;
  onFocusHandled?: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pendentes' | 'recebidas'>('pendentes');
  const [selectedFatura, setSelectedFatura] = useState<Parcela | null>(null);
  const [receivingFatura, setReceivingFatura] = useState<Parcela | null>(null);
  const [receiptForm, setReceiptForm] = useState({
    valorPrincipal: '',
    juros: '0',
    multa: '0',
    desconto: '0',
    taxas: '0',
    dataRecebimento: localDateKey(),
    meioPagamento: '',
    comprovanteDocumentoId: '',
    observacoes: ''
  });
  const [receiptDocuments, setReceiptDocuments] = useState<ReceiptDocument[]>([]);
  const [receiptHistory, setReceiptHistory] = useState<Receipt[]>([]);
  const [loadingReceiptHistory, setLoadingReceiptHistory] = useState(false);
  const [reversingReceipt, setReversingReceipt] = useState<Receipt | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalDate, setReversalDate] = useState(localDateKey());
  const [savingReversal, setSavingReversal] = useState(false);
  const [loadingReceiptDocuments, setLoadingReceiptDocuments] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(openCreateOnMount);
  const [installmentForm, setInstallmentForm] = useState({
    orcamentoId: '', valor: '', dataVencimento: localDateKey(), statusPagamento: 'Pendente'
  });
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');
  const installmentFilterKey = [activeTab, search, dataInicioFilter, dataFimFilter].join('\u001f');
  const [installmentPagination, setInstallmentPagination] = useState({ filterKey: '', page: 1 });
  const page = installmentPagination.filterKey === installmentFilterKey ? installmentPagination.page : 1;
  const handledReceivableIdRef = useRef<string | null>(null);

  const installmentQueryString = useMemo(() => {
    const params = new URLSearchParams({ mode: 'page', page: String(page), limit: '25', status: activeTab });
    if (focusParcelaId) {
      params.set('selectedId', focusParcelaId);
    } else {
      if (search.trim()) params.set('q', search.trim());
      if (dataInicioFilter) params.set('dataInicio', dataInicioFilter);
      if (dataFimFilter) params.set('dataFim', dataFimFilter);
    }
    return params.toString();
  }, [activeTab, dataFimFilter, dataInicioFilter, focusParcelaId, page, search]);
  const { data: installmentPage, isLoading: loading, isError: failed, refetch } = useQuery<InstallmentPage>({
    queryKey: ['parcelas', installmentQueryString],
    queryFn: () => apiClient.get<InstallmentPage>(`/api/financeiro/parcelas?${installmentQueryString}`),
    placeholderData: (previous) => previous
  });
  const parcelas = useMemo(() => installmentPage?.items ?? [], [installmentPage?.items]);
  const fetchDados = () => { void refetch(); };
  const { data: projectContextOptions = [] } = useQuery<ProjectContextOption[]>({
    queryKey: ['receivable-project-context', initialProjectId],
    queryFn: () => apiClient.get<ProjectContextOption[]>(`/api/projetos/options?selectedId=${encodeURIComponent(initialProjectId)}&limit=1`),
    enabled: Boolean(initialProjectId)
  });
  const projectContext = projectContextOptions.find((item) => item.id === initialProjectId);
  const effectiveClientId = projectContext?.clienteId || initialClientId;
  const budgetQueryString = useMemo(() => {
    const params = new URLSearchParams({ mode: 'legacy', limit: '100' });
    if (initialProjectId) params.set('projectId', initialProjectId);
    else if (effectiveClientId) params.set('clientId', effectiveClientId);
    return params.toString();
  }, [effectiveClientId, initialProjectId]);
  const { data: budgetOptions = [] } = useQuery<BudgetOption[]>({
    queryKey: ['receivable-budget-options', budgetQueryString],
    queryFn: () => apiClient.get<BudgetOption[]>(`/api/orcamentos?${budgetQueryString}`),
    enabled: showCreateModal
  });
  const approvedBudgets = budgetOptions.filter((budget) => budget.status === 'aprovado');
  const selectedBudgetId = installmentForm.orcamentoId || approvedBudgets[0]?.id || '';

  const createInstallmentMutation = useMutation({
    mutationFn: () => apiClient.post<Parcela>('/api/financeiro/parcelas', {
      orcamentoId: selectedBudgetId,
      valor: parseCurrencyToCents(installmentForm.valor),
      dataVencimento: installmentForm.dataVencimento,
      statusPagamento: installmentForm.statusPagamento
    }),
    onSuccess: async () => {
      setShowCreateModal(false);
      setInstallmentForm({ orcamentoId: '', valor: '', dataVencimento: localDateKey(), statusPagamento: 'Pendente' });
      await Promise.all([
        invalidateFinancialQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['projeto-contexto-financeiro', initialProjectId] }),
        queryClient.invalidateQueries({ queryKey: ['cliente-financeiro', effectiveClientId] })
      ]);
      toast.success('Parcela configurada. Ela já aparece no projeto e no consolidado do cliente.');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Não foi possível criar a parcela.')
  });

  const fetchReceiptHistory = useCallback(async (parcelaId: string) => {
    setLoadingReceiptHistory(true);
    try {
      setReceiptHistory(await apiClient.get<Receipt[]>(`/api/financeiro/parcelas/${parcelaId}/recebimentos`));
    } catch {
      setReceiptHistory([]);
    } finally {
      setLoadingReceiptHistory(false);
    }
  }, []);

  const openDetails = useCallback((item: Parcela) => {
    setSelectedFatura(item);
    void fetchReceiptHistory(item.id);
  }, [fetchReceiptHistory]);

  useEffect(() => {
    if (!focusParcelaId) {
      handledReceivableIdRef.current = null;
      return;
    }
    if (loading || handledReceivableIdRef.current === focusParcelaId) return;

    handledReceivableIdRef.current = focusParcelaId;
    queueMicrotask(() => {
      const focusedParcela = parcelas.find((item) => item.id === focusParcelaId);
      if (focusedParcela) {
        setActiveTab(focusedParcela.statusPagamento === 'Pago' ? 'recebidas' : 'pendentes');
        openDetails(focusedParcela);
      } else {
        toast.info('A conta a receber indicada pelo alerta não foi encontrada.');
      }
      onFocusHandled?.();
    });
  }, [focusParcelaId, loading, onFocusHandled, openDetails, parcelas]);

  const parseCurrencyToCents = (value: string) => {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  };

  const openReceiptForm = (item: Parcela) => {
    const outstanding = Math.max(0, item.valor - (item.valorPago || 0));
    setReceivingFatura(item);
    setReceiptForm({
      valorPrincipal: (outstanding / 100).toFixed(2).replace('.', ','),
      juros: '0',
      multa: '0',
      desconto: '0',
      taxas: '0',
      dataRecebimento: localDateKey(),
      meioPagamento: '',
      comprovanteDocumentoId: '',
      observacoes: ''
    });
    setReceiptDocuments([]);
    setLoadingReceiptDocuments(true);
    const params = new URLSearchParams({ clienteId: item.clienteId });
    if (item.projetoId) params.set('projetoId', item.projetoId);
    apiClient.get<ReceiptDocument[]>(`/api/financeiro/comprovantes?${params.toString()}`)
      .then(setReceiptDocuments)
      .catch(() => setReceiptDocuments([]))
      .finally(() => setLoadingReceiptDocuments(false));
  };

  const handleRegisterReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!receivingFatura) return;
    const payload = {
      valorPrincipal: parseCurrencyToCents(receiptForm.valorPrincipal),
      juros: parseCurrencyToCents(receiptForm.juros),
      multa: parseCurrencyToCents(receiptForm.multa),
      desconto: parseCurrencyToCents(receiptForm.desconto),
      taxas: parseCurrencyToCents(receiptForm.taxas),
      dataRecebimento: receiptForm.dataRecebimento,
      meioPagamento: receiptForm.meioPagamento.trim() || null,
      comprovanteDocumentoId: receiptForm.comprovanteDocumentoId || null,
      observacoes: receiptForm.observacoes.trim() || null
    };
    if (payload.valorPrincipal <= 0) {
      toast.error('Informe um valor principal maior que zero.');
      return;
    }
    setSavingReceipt(true);
    try {
      const response = await apiFetch(`/api/financeiro/parcelas/${receivingFatura.id}/recebimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível registrar o recebimento.');
      }
      setReceivingFatura(null);
      setSelectedFatura(null);
      setReceiptHistory([]);
      fetchDados();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o recebimento.');
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleReverseReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!reversingReceipt || reversalReason.trim().length < 5) return;
    setSavingReversal(true);
    try {
      await apiClient.post(`/api/financeiro/recebimentos/${reversingReceipt.id}/estorno`, {
        motivo: reversalReason.trim(),
        dataEstorno: reversalDate
      });
      setReversingReceipt(null);
      setReversalReason('');
      setSelectedFatura(null);
      setReceiptHistory([]);
      fetchDados();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível estornar o recebimento.');
    } finally {
      setSavingReversal(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getFaturaStatus = (item: Parcela) => {
    if (item.statusPagamento === 'Pago') return 'Pago';
    if ((item.valorPago || 0) > 0) return 'Parcial';
    return item.dataVencimento.slice(0, 10) < localDateKey() ? 'Atrasado' : 'Pendente';
  };

  // Calcular estatísticas
  const summary = installmentPage?.summary ?? { faturamentoTotal: 0, totalRecebido: 0, totalPendente: 0, totalAtrasado: 0 };
  const { faturamentoTotal, totalRecebido, totalPendente, totalAtrasado } = summary;

  // Filtrar parcelas
  const filteredParcelas = parcelas;
  const hasInvoiceFilters = Boolean(search || dataInicioFilter || dataFimFilter);

  return (
    <PageFrame embedded={embedded}>
      {/* Esconder layout principal durante a impressão */}
      <div className="print:hidden">
        {!embedded && <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
              Financeiro
            </span>
            <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
              Contas a receber
            </h1>
            <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
              Gerencie cobranças, parcelas e recebimentos dos clientes.
            </p>
          </div>
        </div>}

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sky-950 dark:border-sky-400/20 dark:bg-sky-400/[0.08] dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold">Parcelas compartilhadas</p>
            <p className="mt-1 text-xs leading-relaxed text-sky-800 dark:text-sky-200/80">
              {initialProjectId
                ? `Você está configurando cobranças de ${projectContext?.nome || 'um projeto selecionado'} para ${projectContext?.clienteNome || 'o cliente vinculado'}. A parcela será um único registro, visível aqui, no projeto e no cliente.`
                : 'Cada parcela pertence a um orçamento aprovado e aparece automaticamente no projeto e no cliente vinculados.'}
            </p>
          </div>
          <button type="button" onClick={() => setShowCreateModal(true)} className={secondarySmallActionButtonClass}>
            <Plus aria-hidden="true" /> Configurar parcela
          </button>
        </div>

        {/* Stats Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className={cn(geoGreenSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total previsto</span>
            <p className={cn('mt-2 text-3xl font-bold', geoGreenValueClass)}>{formatCurrency(faturamentoTotal)}</p>
          </div>
          <div className={cn(geoGreenSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total Recebido</span>
            <p className={cn('mt-2 text-3xl font-bold', geoGreenValueClass)}>{formatCurrency(totalRecebido)}</p>
          </div>
          <div className={cn(geoOrangeSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-orange-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Pendente (A Vencer)</span>
            <p className={cn('mt-2 text-3xl font-bold', geoOrangeValueClass)}>{formatCurrency(totalPendente)}</p>
          </div>
          <div className={cn(geoPurpleSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-violet-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoPurpleLabelClass)}>Total Atrasado</span>
            <p className={cn('mt-2 text-3xl font-bold', geoPurpleValueClass)}>{formatCurrency(totalAtrasado)}</p>
          </div>
        </div>

        {/* Filtros Globais (Acima das abas) */}
        <div className="mb-6 rounded-[1.5rem] border border-zinc-200/70 bg-white/85 py-3 px-5 shadow-sm ring-1 ring-zinc-950/[0.03] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/75">
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.7fr))_auto] items-center">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                aria-label="Buscar contas a receber"
                placeholder="Buscar por cliente ou orçamento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-xs font-semibold text-zinc-700 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <DatePickerField
              value={dataInicioFilter}
              onChange={(event) => setDataInicioFilter(event.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 outline-none transition-[border-color,box-shadow] focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              aria-label="Vencimento inicial"
            />
            <DatePickerField
              value={dataFimFilter}
              onChange={(event) => setDataFimFilter(event.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 outline-none transition-[border-color,box-shadow] focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              aria-label="Vencimento final"
            />
            {hasInvoiceFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDataInicioFilter('');
                  setDataFimFilter('');
                }}
                className="h-9 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {filteredParcelas.length} de {installmentPage?.total ?? 0} parcela(s) exibidas
          </p>
        </div>

        {/* Abas de Navegação (Abaixo dos filtros) */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-8 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('pendentes')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-[border-color,color] whitespace-nowrap ${
              activeTab === 'pendentes' 
                ? 'border-zinc-950 text-zinc-950 dark:text-white' 
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
              Parcelas em aberto
          </button>
          <button 
            onClick={() => setActiveTab('recebidas')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-[border-color,color] whitespace-nowrap ${
              activeTab === 'recebidas' 
                ? 'border-zinc-950 text-zinc-950 dark:text-white' 
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Histórico Recebido
          </button>
        </div>

        {/* Contas a receber */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm">
          {loading ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Carregando contas a receber…</p>
          ) : failed ? (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                <p className="font-semibold">Não foi possível carregar as contas a receber.</p>
                <p className="mt-1 text-xs">Verifique a conexão e tente novamente.</p>
                <button type="button" onClick={() => void refetch()} className="mt-3 min-h-10 rounded-xl border border-rose-300 px-3 font-semibold hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:border-rose-500/40 dark:hover:bg-rose-500/20">Tentar novamente</button>
              </div>
          ) : filteredParcelas.length === 0 ? (
              <p className="text-zinc-400 text-sm">Nenhuma conta a receber encontrada.</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {filteredParcelas.map(item => {
                const status = getFaturaStatus(item);
                return (
                  <div key={item.id} className="py-5 flex items-center justify-between gap-6 hover:bg-zinc-50/50 dark:bg-zinc-900/50 px-4 rounded-2xl transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          status === 'Pago' ? 'bg-emerald-50 text-emerald-700' :
                          status === 'Atrasado' ? 'bg-red-50 text-red-700 animate-pulse' :
                          status === 'Parcial' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {status}
                        </span>
                        <span className="text-xs text-zinc-400">Vencimento: {formatDateKey(item.dataVencimento)}</span>
                      </div>
                      <p className="font-semibold text-zinc-950 dark:text-white truncate">{item.clienteNome}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.orcamentoDescricao || 'Sem descrição do orçamento'}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{formatCurrency(item.valor)}</p>
                        {(item.valorPago || 0) > 0 && item.statusPagamento !== 'Pago' && (
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            Saldo {formatCurrency(Math.max(0, item.valor - (item.valorPago || 0)))}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openDetails(item)}
                          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 active:scale-[0.97]"
                        >
                            {status === 'Pago' ? 'Ver recibo' : 'Ver cobrança'}
                        </button>
                        {status !== 'Pago' && (
                          <button 
                            onClick={() => openReceiptForm(item)}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                            title="Registrar recebimento integral ou parcial"
                          >
                            <Check weight="bold" className="w-4 h-4" />
                            Receber
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(installmentPage?.totalPages ?? 1) > 1 && (
            <nav aria-label="Paginação de contas a receber" className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
              <button type="button" disabled={page <= 1} onClick={() => setInstallmentPagination({ filterKey: installmentFilterKey, page: Math.max(1, page - 1) })} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Anterior</button>
              <span className="font-mono tabular-nums">Página {page} de {installmentPage?.totalPages}</span>
              <button type="button" disabled={page >= (installmentPage?.totalPages ?? 1)} onClick={() => setInstallmentPagination({ filterKey: installmentFilterKey, page: page + 1 })} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Próxima</button>
            </nav>
          )}
        </div>
      </div>

      <Modal isOpen={showCreateModal} onClose={() => { if (!createInstallmentMutation.isPending) setShowCreateModal(false); }} closeDisabled={createInstallmentMutation.isPending} title="Configurar conta a receber" maxWidth="max-w-xl" initialFocusId="installment-budget">
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!selectedBudgetId) { toast.error('Selecione um orçamento aprovado.'); return; }
          if (parseCurrencyToCents(installmentForm.valor) <= 0) { toast.error('Informe um valor maior que zero.'); return; }
          createInstallmentMutation.mutate();
        }} className="space-y-5">
          {initialProjectId && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100">
              <strong>Contexto predefinido:</strong> {projectContext?.clienteNome || 'Cliente vinculado'} → {projectContext?.nome || 'Projeto selecionado'}. Para evitar vínculos incorretos, somente orçamentos aprovados deste contexto são exibidos.
            </div>
          )}
          <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200" htmlFor="installment-budget">Orçamento aprovado *
            <FormSelect id="installment-budget" name="orcamentoId" required value={selectedBudgetId} onChange={(event) => setInstallmentForm({ ...installmentForm, orcamentoId: event.target.value })} className="mt-1.5 w-full">
              <option value="">Selecione…</option>
              {approvedBudgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.number || 'Sem número'} · {budget.description} · {formatCurrency(budget.totalCents)}</option>)}
            </FormSelect>
          </label>
          {approvedBudgets.length === 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">Nenhum orçamento aprovado foi encontrado neste contexto. Aprove um orçamento antes de criar parcelas.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200" htmlFor="installment-value">Valor (R$) *
              <input id="installment-value" name="valor" required inputMode="decimal" autoComplete="off" value={installmentForm.valor} onChange={(event) => setInstallmentForm({ ...installmentForm, valor: event.target.value })} placeholder="0,00" className="geo-field mt-1.5 w-full tabular-nums" />
            </label>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200" htmlFor="installment-due-date">Vencimento *
              <DatePickerField id="installment-due-date" name="dataVencimento" required autoComplete="off" value={installmentForm.dataVencimento} onChange={(event) => setInstallmentForm({ ...installmentForm, dataVencimento: event.target.value })} className="mt-1.5 w-full" />
            </label>
          </div>
          <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200" htmlFor="installment-status">Situação inicial
            <FormSelect id="installment-status" name="statusPagamento" value={installmentForm.statusPagamento} onChange={(event) => setInstallmentForm({ ...installmentForm, statusPagamento: event.target.value })} className="mt-1.5 w-full"><option value="Pendente">Pendente</option><option value="Pago">Pago</option></FormSelect>
          </label>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">O sistema bloqueia uma segunda parcela do mesmo orçamento quando valor e vencimento forem idênticos.</p>
          <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button type="button" onClick={() => setShowCreateModal(false)} disabled={createInstallmentMutation.isPending} className={secondarySmallActionButtonClass}>Cancelar</button>
            <button type="submit" disabled={createInstallmentMutation.isPending || approvedBudgets.length === 0} className={primarySubmitButtonClass}>{createInstallmentMutation.isPending ? 'Salvando…' : 'Criar parcela'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedFatura}
        onClose={() => setSelectedFatura(null)}
        title={selectedFatura?.statusPagamento === 'Pago' ? 'GeoGestor • Recibo' : 'GeoGestor • Demonstrativo de cobrança'}
        maxWidth="max-w-2xl"
      >
        {selectedFatura && (
          <div className="flex flex-col justify-between h-full">
            {/* Cabeçalho da Fatura - Emitido data */}
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6 mb-6">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Emitido em: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Info Cliente */}
            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
              <div>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Destinatário</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{selectedFatura.clienteNome}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">ID do Cliente: {selectedFatura.clienteId}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Vencimento</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{formatDateKey(selectedFatura.dataVencimento)}</p>
                <span className={`inline-block mt-2 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedFatura.statusPagamento === 'Pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {selectedFatura.statusPagamento}
                </span>
              </div>
            </div>

            {/* Detalhes do Serviço */}
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 mb-8 print:bg-white dark:bg-zinc-900 print:border print:border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Descrição dos Serviços</span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{selectedFatura.orcamentoDescricao || 'Serviços topográficos e consultoria de licenciamento ambiental'}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-zinc-200/60 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Parcela de Orçamento (Ref: #{selectedFatura.orcamentoId.substring(0, 8)})</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(
                      selectedFatura.statusPagamento === 'Pago'
                        ? selectedFatura.recebidoCaixa || selectedFatura.valorPago || selectedFatura.valor
                        : selectedFatura.valor
                    )}
                  </span>
              </div>
            </div>

            <p className="mb-5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {selectedFatura.statusPagamento === 'Pago'
                ? 'Este recibo confirma o recebimento financeiro e não substitui documento fiscal quando ele for exigido.'
                : 'Este demonstrativo é uma cobrança interna. Ele não é nota fiscal nem comprova pagamento.'}
            </p>

            <section aria-labelledby="receipt-history-title" className="mb-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 id="receipt-history-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Histórico de recebimentos</h3>
              {loadingReceiptHistory ? (
                <p className="mt-3 text-xs text-zinc-500">Carregando histórico…</p>
              ) : receiptHistory.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-500">Nenhum recebimento registrado para esta parcela.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {receiptHistory.map((receipt) => (
                    <article key={receipt.id} className="flex flex-col justify-between gap-3 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(receipt.valorRecebido)} em {formatDateKey(receipt.dataRecebimento)}
                        </p>
                        <p className="mt-1 text-zinc-500">
                          Principal {formatCurrency(receipt.valorPrincipal)}
                          {receipt.meioPagamento ? ` · ${receipt.meioPagamento}` : ''}
                          {receipt.estornadoEm ? ` · Estornado em ${new Date(receipt.estornadoEm).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                        {receipt.motivoEstorno && <p className="mt-1 text-red-600">Motivo: {receipt.motivoEstorno}</p>}
                      </div>
                      {!receipt.estornadoEm && (
                        <button
                          type="button"
                          onClick={() => {
                            setReversingReceipt(receipt);
                            setReversalReason('');
                            setReversalDate(localDateKey());
                          }}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 font-semibold text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                        >
                          <ArrowCounterClockwise aria-hidden="true" /> Estornar
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Botões / Rodapé */}
            <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-zinc-900 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-zinc-800"
              >
                <Printer className="w-4 h-4" /> {selectedFatura.statusPagamento === 'Pago' ? 'Imprimir recibo' : 'Imprimir cobrança'}
              </button>
              
              {selectedFatura.statusPagamento !== 'Pago' && (
                <button 
                  onClick={() => openReceiptForm(selectedFatura)}
                  className="bg-emerald-600 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-emerald-500"
                >
                  Registrar recebimento
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(reversingReceipt)}
        onClose={() => !savingReversal && setReversingReceipt(null)}
        title="Estornar recebimento"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleReverseReceipt} className="space-y-4">
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-100">
            O estorno reabrirá o saldo principal da parcela e preservará o recebimento no histórico.
          </p>
          <label className="block space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <span>Motivo do estorno</span>
            <textarea
              name="motivoEstorno"
              required
              minLength={5}
              rows={4}
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <span>Data do estorno</span>
            <DatePickerField
              name="dataEstorno"
              required
              value={reversalDate}
              onChange={(event) => setReversalDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setReversingReceipt(null)} disabled={savingReversal} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold dark:border-zinc-800">Cancelar</button>
            <button type="submit" disabled={savingReversal || reversalReason.trim().length < 5} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">
              {savingReversal ? 'Estornando…' : 'Confirmar estorno'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!receivingFatura}
        onClose={() => !savingReceipt && setReceivingFatura(null)}
        title="Registrar recebimento"
        maxWidth="max-w-xl"
      >
        {receivingFatura && (
          <form onSubmit={handleRegisterReceipt} className="space-y-5">
            <div className="rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-950">
              <p className="font-semibold text-zinc-950 dark:text-white">{receivingFatura.clienteNome}</p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                Saldo principal: {formatCurrency(Math.max(0, receivingFatura.valor - (receivingFatura.valorPago || 0)))}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ['valorPrincipal', 'Principal recebido'],
                ['juros', 'Juros'],
                ['multa', 'Multa'],
                ['desconto', 'Desconto'],
                ['taxas', 'Taxas bancárias']
              ].map(([name, label]) => (
                <label key={name} className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <span>{label} (R$)</span>
                  <input
                    name={name}
                    inputMode="decimal"
                    value={receiptForm[name as keyof typeof receiptForm]}
                    onChange={(event) => setReceiptForm((current) => ({ ...current, [name]: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm tabular-nums text-zinc-950 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    required={name === 'valorPrincipal'}
                  />
                </label>
              ))}
              <label className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                <span>Data do recebimento</span>
                <DatePickerField
                  name="dataRecebimento"
                  value={receiptForm.dataRecebimento}
                  onChange={(event) => setReceiptForm((current) => ({ ...current, dataRecebimento: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  required
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                <span>Meio de pagamento</span>
                <input
                  name="meioPagamento"
                  value={receiptForm.meioPagamento}
                  onChange={(event) => setReceiptForm((current) => ({ ...current, meioPagamento: event.target.value }))}
                  placeholder="PIX, transferência, boleto…"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </label>
              <div className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                <label htmlFor="receipt-document">Comprovante vinculado</label>
                <FormSelect
                  id="receipt-document"
                  name="comprovanteDocumentoId"
                  aria-label="Comprovante vinculado"
                  value={receiptForm.comprovanteDocumentoId}
                  onChange={(event) => setReceiptForm((current) => ({ ...current, comprovanteDocumentoId: event.target.value }))}
                  disabled={loadingReceiptDocuments}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">{loadingReceiptDocuments ? 'Carregando documentos…' : 'Sem comprovante vinculado'}</option>
                  {receiptDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.nome}{document.projetoId ? ' · documento do projeto' : ' · documento geral do cliente'}
                    </option>
                  ))}
                </FormSelect>
                {!loadingReceiptDocuments && receiptDocuments.length === 0 && (
                  <span className="block font-normal text-zinc-500">Envie o comprovante na área de documentos do cliente ou projeto para selecioná-lo aqui.</span>
                )}
              </div>
            </div>
            <label className="block space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <span>Observações</span>
              <textarea
                name="observacoes"
                value={receiptForm.observacoes}
                onChange={(event) => setReceiptForm((current) => ({ ...current, observacoes: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              O principal reduz o saldo da parcela. Juros, multa, desconto e taxas alteram apenas o valor efetivamente recebido no caixa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReceivingFatura(null)}
                disabled={savingReceipt}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingReceipt}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {savingReceipt ? 'Registrando…' : 'Confirmar recebimento'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </PageFrame>
  );
}
