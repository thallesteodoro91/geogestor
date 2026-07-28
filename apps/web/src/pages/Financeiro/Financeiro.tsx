import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useEffect, useMemo, useState } from 'react';
import { CheckboxField, DatePickerField, FormError, FormField, FormFooter, FormSection, FormSelect } from '../../components/Form';
import { motion, AnimatePresence } from 'framer-motion';
import { CurrencyDollar, Plus, TrendUp, TrendDown, Wallet, PencilSimple, Trash, ChartBar, Receipt, Calendar, Check, MagnifyingGlass, Printer, Briefcase } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  chartTextColor, chartBorder, chartLegendStyle, chartCursor, responsiveChartProps 
} from '../../utils/chartHelpers';
import { chartColors } from '../../data/chart-colors';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { buildFinancialAnalytics, type FinancialFilters } from '../../utils/financialAnalytics';
import { cn } from '../../utils/cn';
import { expenseActionButtonClass, primaryActionIconClass, primarySubmitButtonClass, revenueActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { apiFetch, apiClient } from '../../services/apiClient';
import { geoFieldClass, geoGreenAccentClass, geoGreenIconClass, geoGreenLabelClass, geoGreenSurfaceClass, geoGreenSurfaceWithAccentClass, geoGreenValueClass, geoKickerClass, geoOrangeAccentClass, geoOrangeIconClass, geoOrangeLabelClass, geoOrangeSurfaceClass, geoOrangeValueClass, geoPurpleAccentClass, geoPurpleIconClass, geoPurpleLabelClass, geoPurpleSurfaceClass, geoPurpleSurfaceWithAccentClass, geoPurpleValueClass, geoTabButtonClass, geoTabIconClass, geoTabListClass } from '../../utils/geoTheme';
import {
  filterBarClass,
  filterClearButtonClass,
  filterControlClass
} from '../../utils/filterStyles';
import {
  buildPayablePayload,
  buildRevenuePayload,
  payableFormFingerprint,
  revenueFormFingerprint,
  validatePayableForm,
  validateRevenueForm,
  type PayableFormValues,
  type RevenueFormValues
} from './financeForm';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { notifications } from '../../services/notifications';

export interface Orcamento {
  id: string;
  clienteId: string;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  status: string;
  valorTotal: number;
  dataOrcamento?: string | null;
  dataCompetencia?: string | null;
  dataPagamento?: string | null;
  createdAt?: string | null;
  descricao?: string | null;
  anotacoes?: string | null;
  formaDePagamento?: string | null;
  desconto?: number | null;
  codigoOrcamento?: string | null;
  possuiImposto?: boolean | number | null;
  impostoPorcentagem?: number | null;
  impostoValor?: number | null;
  impostoRetido?: boolean | number | null;
  centroCusto?: string | null;
}

export interface Despesa {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  descricao?: string | null;
  valor: number;
  data?: string | null;
  dataCompetencia?: string | null;
  dataPagamento?: string | null;
  categoria?: string | null;
  observacoes?: string | null;
  status: string;
  formaPagamento?: string | null;
  tipoCusto?: string | null;
  centroCusto?: string | null;
  reembolsavel?: boolean | number | null;
  fornecedor?: string | null;
  numeroDocumento?: string | null;
  comprovanteDocumentoId?: string | null;
}

export interface Cliente {
  id: string;
  nome: string;
}

export interface Projeto {
  id: string;
  nome: string;
  clienteId?: string | null;
  clienteNome?: string | null;
}

export interface MonthlyCashFlowItem {
  mes: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

export interface Parcela {
  id: string;
  orcamentoId: string;
  orcamentoDescricao?: string;
  clienteNome: string;
  clienteId: string;
  numeroParcela?: number;
  totalParcelas?: number;
  valor: number; // in cents
  valorPago?: number | null;
  recebidoCaixa?: number | null;
  dataVencimento: string;
  dataPagamento?: string | null;
  statusPagamento: string;
}

export interface ProjetoStatusStat {
  status: string;
  count: number;
}

export interface OrcamentoStat {
  status: string;
  count: number;
  total: number;
}

export interface DespesaCategoriaStat {
  categoria: string;
  total: number;
}

export interface RelatorioStats {
  projetosPorStatus?: ProjetoStatusStat[];
  projetosPorTipo?: Array<{ tipo: string; count: number }>;
  areaTotal?: number;
  orcamentosStats?: OrcamentoStat[];
  despesasPorCategoria?: DespesaCategoriaStat[];
}

const financeFieldClass = cn(geoFieldClass, 'w-full px-4 py-3 text-sm font-medium text-text-primary');
const financeCompactFieldClass = cn(geoFieldClass, 'h-11 w-full px-3 text-sm font-semibold text-text-primary');
const financeTextareaClass = cn(geoFieldClass, 'w-full resize-none px-4 py-3 text-sm font-medium leading-relaxed text-text-primary');
const financeIconButtonClass =
  'geo-focus-ring flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-[background-color,color,border-color,transform] active:scale-95';
const financeMetricCardClass =
  'geo-card relative flex min-h-[140px] flex-col justify-between overflow-hidden p-8 transition-[box-shadow,transform] hover:-translate-y-1 hover:shadow-brand';
const financeRevenueMetricClass =
  geoGreenSurfaceWithAccentClass;
const financeExpenseMetricClass =
  geoPurpleSurfaceWithAccentClass;
const financeMarginMetricClass =
  geoGreenSurfaceWithAccentClass;
const financeProfitMetricClass =
  geoGreenSurfaceWithAccentClass;

function financePillButtonClass(active: boolean) {
  return cn(
    'geo-focus-ring inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-[background-color,color,box-shadow,border-color,transform] active:scale-[0.98]',
    active
      ? 'bg-gradient-to-r from-brand-green-600 via-brand-turquoise-600 to-brand-blue-500 text-white shadow-sm ring-1 ring-brand-green-300/25'
      : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-brand-surface hover:text-zinc-950 dark:border-zinc-800 dark:bg-brand-surface-muted dark:text-zinc-300 dark:hover:text-white'
  );
}

export function Financeiro() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'visao' | 'receber' | 'pagar' | 'faturas' | 'relatorios'>('visao');
  const [comparison, setComparison] = useState<'none' | 'year' | 'month'>('none');
  const [financeDataInicio, setFinanceDataInicio] = useState('');
  const [financeDataFim, setFinanceDataFim] = useState('');
  const [financeClienteId, setFinanceClienteId] = useState('Todos');
  const [financeCategoria, setFinanceCategoria] = useState('Todas');
  const [financeTipoCusto, setFinanceTipoCusto] = useState('Todos');
  const [financeCentroCusto, setFinanceCentroCusto] = useState('Todos');
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'orcamento'; item: Orcamento }
    | { type: 'despesa'; item: Despesa }
    | null
  >(null);

  // Orcamento Modal States
  const [showOrcamentoModal, setShowOrcamentoModal] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [orcClienteId, setOrcClienteId] = useState('');
  const [orcProjetoId, setOrcProjetoId] = useState('');
  const [orcValorTotal, setOrcValorTotal] = useState('');
  const [orcStatus, setOrcStatus] = useState('Em Análise');
  const [orcDescricao, setOrcDescricao] = useState('');
  const [orcAnotacoes, setOrcAnotacoes] = useState('');
  const [orcFormaPagamento, setOrcFormaPagamento] = useState('Pix');
  const [orcDesconto, setOrcDesconto] = useState('');
  const [orcCodigo, setOrcCodigo] = useState('');
  const [orcDataCompetencia, setOrcDataCompetencia] = useState('');
  const [orcDataPagamento, setOrcDataPagamento] = useState('');
  const [orcImpostoValor, setOrcImpostoValor] = useState('');
  const [orcImpostoRetido, setOrcImpostoRetido] = useState(false);
  const [orcCentroCusto, setOrcCentroCusto] = useState('Serviços');
  const [orcFormErrors, setOrcFormErrors] = useState<Partial<Record<'clienteId' | 'descricao' | 'valorTotal' | 'dataCompetencia' | 'dataPagamento', string>>>({});
  const [orcFormError, setOrcFormError] = useState('');
  const [orcInitialFingerprint, setOrcInitialFingerprint] = useState('');

  // Despesa Modal States
  const [showDespesaModal, setShowDespesaModal] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);
  const [despClienteId, setDespClienteId] = useState('');
  const [despProjetoId, setDespProjetoId] = useState('');
  const [despDescricao, setDespDescricao] = useState('');
  const [despFornecedor, setDespFornecedor] = useState('');
  const [despNumeroDocumento, setDespNumeroDocumento] = useState('');
  const [despValor, setDespValor] = useState('');
  const [despData, setDespData] = useState('');
  const [despDataCompetencia, setDespDataCompetencia] = useState('');
  const [despDataPagamento, setDespDataPagamento] = useState('');
  const [despCategoria, setDespCategoria] = useState('Combustível');
  const [despTipoCusto, setDespTipoCusto] = useState('Variável de campo');
  const [despCentroCusto, setDespCentroCusto] = useState('Campo');
  const [despReembolsavel, setDespReembolsavel] = useState(false);
  const [despObservacoes, setDespObservacoes] = useState('');
  const [despStatus, setDespStatus] = useState('Pendente');
  const [despFormaPagamento, setDespFormaPagamento] = useState('Pix');
  const [despFormErrors, setDespFormErrors] = useState<Partial<Record<'descricao' | 'valor' | 'data' | 'dataCompetencia' | 'dataPagamento', string>>>({});
  const [despFormError, setDespFormError] = useState('');
  const [despInitialFingerprint, setDespInitialFingerprint] = useState('');
  const [discardTarget, setDiscardTarget] = useState<'receita' | 'despesa' | null>(null);

  // Faturas sub-tab States
  const [faturasSearch, setFaturasSearch] = useState('');
  const [faturasDataInicio, setFaturasDataInicio] = useState('');
  const [faturasDataFim, setFaturasDataFim] = useState('');
  const [faturasActiveTab, setFaturasActiveTab] = useState<'pendentes' | 'recebidas'>('pendentes');
  const [selectedFatura, setSelectedFatura] = useState<Parcela | null>(null);

  // Relatorios sub-tab States
  const [reportType, setReportType] = useState<'financeiro' | 'projetos'>('financeiro');

  // Queries
  const { data: orcamentosData, isLoading: orcamentosLoading, isError: orcamentosError } = useQuery<Orcamento[]>({
    queryKey: ['orcamentos-financeiro'],
    queryFn: () => apiClient.get<Orcamento[]>('/api/financeiro/orcamentos')
  });

  const { data: despesasData, isLoading: despesasLoading, isError: despesasError } = useQuery<Despesa[]>({
    queryKey: ['despesas-financeiro'],
    queryFn: () => apiClient.get<Despesa[]>('/api/financeiro/despesas')
  });

  const { data: clientesData, isLoading: clientesLoading, isError: clientesError } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<Cliente[]>('/api/clientes')
  });

  const { data: projetosData, isLoading: projetosLoading, isError: projetosError } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<Projeto[]>('/api/projetos')
  });

  const { data: monthlyCashFlowData, isLoading: monthlyCashFlowLoading, isError: monthlyCashFlowError } = useQuery<MonthlyCashFlowItem[]>({
    queryKey: ['resumo-mensal-financeiro'],
    queryFn: () => apiClient.get<MonthlyCashFlowItem[]>('/api/financeiro/resumo-mensal')
  });

  const { data: parcelasData, isLoading: parcelasLoading, isError: parcelasError } = useQuery<Parcela[]>({
    queryKey: ['parcelas-financeiro'],
    queryFn: () => apiClient.get<Parcela[]>('/api/financeiro/parcelas')
  });

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<RelatorioStats>({
    queryKey: ['relatorio-geral'],
    queryFn: () => apiClient.get<RelatorioStats>('/api/relatorios/geral'),
    enabled: activeTab === 'relatorios'
  });
  const orcamentos = useMemo(() => orcamentosData ?? [], [orcamentosData]);
  const despesas = useMemo(() => despesasData ?? [], [despesasData]);
  const clientes = useMemo(() => clientesData ?? [], [clientesData]);
  const projetos = useMemo(() => projetosData ?? [], [projetosData]);
  const parcelas = useMemo(() => parcelasData ?? [], [parcelasData]);

  const loading = orcamentosLoading || despesasLoading || clientesLoading || projetosLoading || monthlyCashFlowLoading || parcelasLoading;
  const projetosDoCliente = projetos.filter((projeto) => projeto.clienteId === orcClienteId);
  const projetosDaDespesa = despClienteId ? projetos.filter((projeto) => projeto.clienteId === despClienteId) : projetos;
  const financialFilters: FinancialFilters = {
    dataInicio: financeDataInicio || undefined,
    dataFim: financeDataFim || undefined,
    clienteId: financeClienteId !== 'Todos' ? financeClienteId : undefined,
    categoria: financeCategoria !== 'Todas' ? financeCategoria : undefined,
    tipoCusto: financeTipoCusto !== 'Todos' ? financeTipoCusto : undefined,
    centroCusto: financeCentroCusto !== 'Todos' ? financeCentroCusto : undefined,
  };
  const analytics = buildFinancialAnalytics({
    orcamentos,
    despesas,
    parcelas,
    clientes,
    projetos,
    filters: financialFilters,
  });
  const categoriasDespesas = Array.from(new Set(despesas.map((despesa) => despesa.categoria).filter((categoria): categoria is string => Boolean(categoria)))).sort();
  const tiposCusto = ['Fixo', 'Variável de campo', 'Cartório e taxas', 'Tributário', 'Operacional', 'Reembolsável'];
  const centrosCusto = ['Administrativo', 'Campo', 'Cartório', 'Tributos', 'Software', 'Equipamentos', 'Serviços'];
  const centrosCustoDisponiveis = Array.from(new Set([...centrosCusto, ...despesas.map((despesa) => despesa.centroCusto || '').filter(Boolean), ...orcamentos.map((orcamento) => orcamento.centroCusto || '').filter(Boolean)])).sort();
  const revenueFormValues: RevenueFormValues = {
    clienteId: orcClienteId,
    projetoId: orcProjetoId,
    valorTotal: orcValorTotal,
    status: orcStatus,
    descricao: orcDescricao,
    anotacoes: orcAnotacoes,
    formaDePagamento: orcFormaPagamento,
    desconto: orcDesconto,
    codigoOrcamento: orcCodigo,
    dataCompetencia: orcDataCompetencia,
    dataPagamento: orcDataPagamento,
    impostoValor: orcImpostoValor,
    impostoRetido: orcImpostoRetido,
    centroCusto: orcCentroCusto
  };
  const payableFormValues: PayableFormValues = {
    clienteId: despClienteId,
    projetoId: despProjetoId,
    descricao: despDescricao,
    fornecedor: despFornecedor,
    numeroDocumento: despNumeroDocumento,
    valor: despValor,
    data: despData,
    dataCompetencia: despDataCompetencia,
    dataPagamento: despDataPagamento,
    categoria: despCategoria,
    tipoCusto: despTipoCusto,
    centroCusto: despCentroCusto,
    reembolsavel: despReembolsavel,
    observacoes: despObservacoes,
    status: despStatus,
    formaPagamento: despFormaPagamento
  };
  const revenueDirty = showOrcamentoModal
    && revenueFormFingerprint(revenueFormValues) !== orcInitialFingerprint;
  const payableDirty = showDespesaModal
    && payableFormFingerprint(payableFormValues) !== despInitialFingerprint;

  useEffect(() => {
    if (!revenueDirty && !payableDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [payableDirty, revenueDirty]);

  useEffect(() => {
    if (!orcProjetoId) return;
    const stillBelongsToClient = projetos.some((projeto) => projeto.id === orcProjetoId && projeto.clienteId === orcClienteId);
    if (!stillBelongsToClient) {
      setTimeout(() => {
        setOrcProjetoId('');
      }, 0);
    }
  }, [orcClienteId, orcProjetoId, projetos]);

  useEffect(() => {
    if (!despProjetoId || !despClienteId) return;
    const stillBelongsToClient = projetos.some((projeto) => projeto.id === despProjetoId && projeto.clienteId === despClienteId);
    if (!stillBelongsToClient) {
      setTimeout(() => {
        setDespProjetoId('');
      }, 0);
    }
  }, [despClienteId, despProjetoId, projetos]);

  useEffect(() => {
    if (orcStatus === 'Pago' && !orcDataPagamento) {
      setTimeout(() => setOrcDataPagamento(new Date().toISOString().split('T')[0]), 0);
    }
  }, [orcStatus, orcDataPagamento]);

  useEffect(() => {
    if (despStatus === 'Pago' && !despDataPagamento) {
      setTimeout(() => setDespDataPagamento(new Date().toISOString().split('T')[0]), 0);
    }
  }, [despStatus, despDataPagamento]);

  // Processa os dados mensais do fluxo de caixa para comparação.
  const mainPeriod = analytics.monthly.slice(-6); // last 6 months
  const dreChartData = mainPeriod.map((item) => {
    const [yearStr, monthStr] = item.mes.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const date = new Date(year, month - 1);
    const name = date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();

    const result: Record<string, string | number> = {
      name,
      mes: item.mes,
      Recebido: item.receitaRecebida / 100,
      Contratado: item.receitaContratada / 100,
      Despesas: item.despesasPagas / 100,
      Lucro: item.resultadoCaixa / 100
    };

    if (comparison === 'year') {
      const prevYearKey = `${year - 1}-${monthStr}`;
      const prevItem = analytics.monthly.find(d => d.mes === prevYearKey);
      result['Recebido (Ano Ant.)'] = prevItem ? prevItem.receitaRecebida / 100 : 0;
      result['Despesas (Ano Ant.)'] = prevItem ? prevItem.despesasPagas / 100 : 0;
    } else if (comparison === 'month') {
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
      }
      const prevMonthStr = String(prevMonth).padStart(2, '0');
      const prevMonthKey = `${prevYear}-${prevMonthStr}`;
      const prevItem = analytics.monthly.find(d => d.mes === prevMonthKey);
      result['Recebido (Mês Ant.)'] = prevItem ? prevItem.receitaRecebida / 100 : 0;
      result['Despesas (Mês Ant.)'] = prevItem ? prevItem.despesasPagas / 100 : 0;
    }

    return result;
  });

  const kpiFaturamentoAprovado = analytics.kpis.receitaContratada;
  const kpiReceitasRecebidas = analytics.kpis.receitaRecebida;
  const kpiCustosPagos = analytics.kpis.despesasPagas;
  const kpiCustosPrevistos = analytics.kpis.despesasAbertas;
  const kpiLucroLiquidoReal = analytics.kpis.resultadoCaixa;
  const kpiMargemLucroReal = analytics.kpis.margemCaixa.toFixed(1);

  // Mutations
  const updateParcelaMutation = useMutation({
    mutationFn: async ({ id, statusPagamento }: { id: string; statusPagamento: string }) => {
      const res = await apiFetch(`/api/financeiro/parcelas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusPagamento })
      });
      if (!res.ok) throw new Error('Erro ao atualizar status da parcela');
      return res.json();
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
    },
    onError: () => {
      notifications.error('Não foi possível atualizar o status do pagamento.');
    }
  });

  const deleteOrcamentoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/financeiro/orcamentos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir orçamento');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateFinancialQueries(queryClient);
    },
    onError: () => {
      notifications.error('Não foi possível excluir o orçamento.');
    }
  });

  const submitOrcamentoMutation = useMutation({
    mutationFn: async (payload: Omit<Orcamento, 'id'>) => {
      const url = selectedOrcamento 
        ? `/api/financeiro/orcamentos/${selectedOrcamento.id}` 
        : '/api/financeiro/orcamentos';
      const method = selectedOrcamento ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao salvar orçamento');
      return res.json();
    },
    onSuccess: () => {
      setShowOrcamentoModal(false);
      invalidateFinancialQueries(queryClient);
    },
    onError: (error: unknown) => {
      setOrcFormError(error instanceof Error ? error.message : 'Não foi possível salvar o recebimento.');
    }
  });

  const deleteDespesaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/financeiro/despesas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir despesa');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateFinancialQueries(queryClient);
    },
    onError: () => {
      notifications.error('Não foi possível excluir a despesa.');
    }
  });

  const submitDespesaMutation = useMutation({
    mutationFn: async (payload: Omit<Despesa, 'id'>) => {
      const url = selectedDespesa 
        ? `/api/financeiro/despesas/${selectedDespesa.id}` 
        : '/api/financeiro/despesas';
      const method = selectedDespesa ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao salvar despesa');
      return res.json();
    },
    onSuccess: () => {
      setShowDespesaModal(false);
      invalidateFinancialQueries(queryClient);
    },
    onError: (error: unknown) => {
      setDespFormError(error instanceof Error ? error.message : 'Não foi possível salvar a conta a pagar.');
    }
  });

  // Action methods
  const openCreateOrcamento = () => {
    const initialValues: RevenueFormValues = {
      clienteId: '',
      projetoId: '',
      valorTotal: '',
      status: 'Em Análise',
      descricao: '',
      anotacoes: '',
      formaDePagamento: 'Pix',
      desconto: '',
      codigoOrcamento: '',
      dataCompetencia: new Date().toISOString().split('T')[0],
      dataPagamento: '',
      impostoValor: '',
      impostoRetido: false,
      centroCusto: 'Serviços'
    };
    setSelectedOrcamento(null);
    setOrcClienteId(initialValues.clienteId);
    setOrcProjetoId('');
    setOrcValorTotal('');
    setOrcStatus('Em Análise');
    setOrcDescricao('');
    setOrcAnotacoes('');
    setOrcFormaPagamento('Pix');
    setOrcDesconto('');
    setOrcCodigo('');
    setOrcDataCompetencia(initialValues.dataCompetencia);
    setOrcDataPagamento('');
    setOrcImpostoValor('');
    setOrcImpostoRetido(false);
    setOrcCentroCusto('Serviços');
    setOrcFormErrors({});
    setOrcFormError('');
    setOrcInitialFingerprint(revenueFormFingerprint(initialValues));
    setShowOrcamentoModal(true);
  };

  const openEditOrcamento = (orc: Orcamento) => {
    const initialValues: RevenueFormValues = {
      clienteId: orc.clienteId || '',
      projetoId: orc.projetoId || '',
      valorTotal: (orc.valorTotal / 100).toString(),
      status: orc.status || 'Em Análise',
      descricao: orc.descricao || '',
      anotacoes: orc.anotacoes || '',
      formaDePagamento: orc.formaDePagamento || 'Pix',
      desconto: orc.desconto ? (orc.desconto / 100).toString() : '',
      codigoOrcamento: orc.codigoOrcamento || '',
      dataCompetencia: orc.dataCompetencia || orc.dataOrcamento || '',
      dataPagamento: orc.dataPagamento || '',
      impostoValor: orc.impostoValor ? (orc.impostoValor / 100).toString() : '',
      impostoRetido: Boolean(orc.impostoRetido),
      centroCusto: orc.centroCusto || 'Serviços'
    };
    setSelectedOrcamento(orc);
    setOrcClienteId(orc.clienteId || '');
    setOrcProjetoId(orc.projetoId || '');
    setOrcValorTotal((orc.valorTotal / 100).toString());
    setOrcStatus(orc.status || 'Em Análise');
    setOrcDescricao(orc.descricao || '');
    setOrcAnotacoes(orc.anotacoes || '');
    setOrcFormaPagamento(orc.formaDePagamento || 'Pix');
    setOrcDesconto(orc.desconto ? (orc.desconto / 100).toString() : '');
    setOrcCodigo(orc.codigoOrcamento || '');
    setOrcDataCompetencia(orc.dataCompetencia || orc.dataOrcamento || '');
    setOrcDataPagamento(orc.dataPagamento || '');
    setOrcImpostoValor(orc.impostoValor ? (orc.impostoValor / 100).toString() : '');
    setOrcImpostoRetido(Boolean(orc.impostoRetido));
    setOrcCentroCusto(orc.centroCusto || 'Serviços');
    setOrcFormErrors({});
    setOrcFormError('');
    setOrcInitialFingerprint(revenueFormFingerprint(initialValues));
    setShowOrcamentoModal(true);
  };

  const handleDeleteOrcamento = (id: string) => {
    const item = orcamentos.find((orcamento) => orcamento.id === id);
    if (item) setDeleteTarget({ type: 'orcamento', item });
  };

  const handleOrcamentoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateRevenueForm(revenueFormValues);
    if (Object.keys(nextErrors).length > 0) {
      setOrcFormErrors(nextErrors);
      setOrcFormError('Revise os campos destacados antes de salvar.');
      const firstField = Object.keys(nextErrors)[0];
      const fieldId = firstField === 'clienteId'
        ? 'orcClienteId'
        : firstField === 'descricao'
          ? 'orcDescricao'
          : firstField === 'dataCompetencia'
            ? 'orcDataCompetencia'
            : firstField === 'dataPagamento'
              ? 'orcDataPagamento'
              : 'orcValorTotal';
      window.setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
      return;
    }

    setOrcFormErrors({});
    setOrcFormError('');
    submitOrcamentoMutation.mutate(buildRevenuePayload(revenueFormValues));
  };

  const openCreateDespesa = () => {
    const today = new Date().toISOString().split('T')[0];
    const initialValues: PayableFormValues = {
      clienteId: '',
      projetoId: '',
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
    };
    setSelectedDespesa(null);
    setDespClienteId('');
    setDespProjetoId('');
    setDespDescricao('');
    setDespFornecedor('');
    setDespNumeroDocumento('');
    setDespValor('');
    setDespData(today);
    setDespDataCompetencia(today);
    setDespDataPagamento('');
    setDespCategoria('Combustível');
    setDespTipoCusto('Variável de campo');
    setDespCentroCusto('Campo');
    setDespReembolsavel(false);
    setDespObservacoes('');
    setDespStatus('Pendente');
    setDespFormaPagamento('Pix');
    setDespFormErrors({});
    setDespFormError('');
    setDespInitialFingerprint(payableFormFingerprint(initialValues));
    setShowDespesaModal(true);
  };

  const openEditDespesa = (desp: Despesa) => {
    const initialValues: PayableFormValues = {
      clienteId: desp.clienteId || '',
      projetoId: desp.projetoId || '',
      descricao: desp.descricao || '',
      fornecedor: desp.fornecedor || '',
      numeroDocumento: desp.numeroDocumento || '',
      valor: (desp.valor / 100).toString(),
      data: desp.data || '',
      dataCompetencia: desp.dataCompetencia || desp.data || '',
      dataPagamento: desp.dataPagamento || '',
      categoria: desp.categoria || 'Combustível',
      tipoCusto: desp.tipoCusto || 'Operacional',
      centroCusto: desp.centroCusto || 'Administrativo',
      reembolsavel: Boolean(desp.reembolsavel),
      observacoes: desp.observacoes || '',
      status: desp.status || 'Pendente',
      formaPagamento: desp.formaPagamento || 'Pix'
    };
    setSelectedDespesa(desp);
    setDespClienteId(desp.clienteId || '');
    setDespProjetoId(desp.projetoId || '');
    setDespDescricao(desp.descricao || '');
    setDespFornecedor(desp.fornecedor || '');
    setDespNumeroDocumento(desp.numeroDocumento || '');
    setDespValor((desp.valor / 100).toString());
    setDespData(desp.data || '');
    setDespDataCompetencia(desp.dataCompetencia || desp.data || '');
    setDespDataPagamento(desp.dataPagamento || '');
    setDespCategoria(desp.categoria || 'Combustível');
    setDespTipoCusto(desp.tipoCusto || 'Operacional');
    setDespCentroCusto(desp.centroCusto || 'Administrativo');
    setDespReembolsavel(Boolean(desp.reembolsavel));
    setDespObservacoes(desp.observacoes || '');
    setDespStatus(desp.status || 'Pendente');
    setDespFormaPagamento(desp.formaPagamento || 'Pix');
    setDespFormErrors({});
    setDespFormError('');
    setDespInitialFingerprint(payableFormFingerprint(initialValues));
    setShowDespesaModal(true);
  };

  const handleDeleteDespesa = (id: string) => {
    const item = despesas.find((despesa) => despesa.id === id);
    if (item) setDeleteTarget({ type: 'despesa', item });
  };

  const handleDespesaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validatePayableForm(payableFormValues);
    if (Object.keys(nextErrors).length > 0) {
      setDespFormErrors(nextErrors);
      setDespFormError('Revise os campos destacados antes de salvar.');
      const firstField = Object.keys(nextErrors)[0];
      const fieldId = firstField === 'descricao'
        ? 'despDescricao'
        : firstField === 'valor'
          ? 'despValor'
          : firstField === 'dataCompetencia'
            ? 'despDataCompetencia'
            : firstField === 'dataPagamento'
              ? 'despDataPagamento'
              : 'despData';
      window.setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
      return;
    }

    setDespFormErrors({});
    setDespFormError('');
    submitDespesaMutation.mutate(buildPayablePayload(payableFormValues));
  };

  const requestCloseRevenue = () => {
    if (submitOrcamentoMutation.isPending) return;
    if (revenueDirty) {
      setDiscardTarget('receita');
      return;
    }
    setShowOrcamentoModal(false);
  };

  const requestClosePayable = () => {
    if (submitDespesaMutation.isPending) return;
    if (payableDirty) {
      setDiscardTarget('despesa');
      return;
    }
    setShowDespesaModal(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Aprovado':
        return 'bg-brand-green-50 text-brand-green-700 ring-1 ring-brand-green-600/10 dark:bg-brand-green-400/10 dark:text-brand-green-100 dark:ring-brand-green-300/20';
      case 'Em Análise':
      case 'Pendente':
        return 'bg-brand-rajah-50 text-brand-rajah-900 ring-1 ring-brand-rajah-600/10 dark:bg-brand-rajah-400/10 dark:text-brand-rajah-100 dark:ring-brand-rajah-300/20';
      case 'Rejeitado':
      case 'Cancelado':
      case 'Atrasado':
        return 'bg-brand-red-50 text-brand-red-700 ring-1 ring-brand-red-600/10 dark:bg-brand-red-400/10 dark:text-brand-red-100 dark:ring-brand-red-300/20';
      default:
        return 'bg-brand-surface text-zinc-600 ring-1 ring-black/5 dark:bg-brand-surface-muted dark:text-zinc-300 dark:ring-white/10';
    }
  };

  const getFaturaStatus = (item: Parcela) => {
    if (item.statusPagamento === 'Pago') return 'Pago';
    const venc = new Date(item.dataVencimento);
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    return venc < hoje ? 'Atrasado' : 'Pendente';
  };

  const filteredParcelas = parcelas.filter(p => {
    const status = getFaturaStatus(p);
    const matchesTab = faturasActiveTab === 'pendentes' ? status !== 'Pago' : status === 'Pago';
    const matchesSearch = p.clienteNome.toLowerCase().includes(faturasSearch.toLowerCase()) || 
                          (p.orcamentoDescricao && p.orcamentoDescricao.toLowerCase().includes(faturasSearch.toLowerCase()));
    const matchesStart = !faturasDataInicio || p.dataVencimento >= faturasDataInicio;
    const matchesEnd = !faturasDataFim || p.dataVencimento <= faturasDataFim;
    return matchesTab && matchesSearch && matchesStart && matchesEnd;
  });

  const handleMarcarComoPago = (id: string) => {
    updateParcelaMutation.mutate({ id, statusPagamento: 'Pago' });
  };

  const failedWithoutData = (orcamentosError && !orcamentosData)
    || (despesasError && !despesasData)
    || (clientesError && !clientesData)
    || (projetosError && !projetosData)
    || (monthlyCashFlowError && !monthlyCashFlowData)
    || (parcelasError && !parcelasData)
    || (activeTab === 'relatorios' && statsError && !stats);

  if (failedWithoutData) {
    return (
      <Layout>
        <section role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <h1 className="text-2xl font-bold">Dados financeiros indisponíveis</h1>
          <p className="mt-2 text-sm leading-6">
            Nenhum saldo, receita ou despesa foi substituído por zero. Restabeleça a conexão com o serviço local e tente novamente.
          </p>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <span className={cn(geoKickerClass, 'mb-4')}>
            Módulo Financeiro
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Gestão financeira 360
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Acompanhe contratos, contas a receber, despesas e resultado gerencial.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={openCreateOrcamento}
            className={revenueActionButtonClass}
          >
            <span>Nova Receita</span>
            <div className={primaryActionIconClass}>
              <Plus weight="bold" className="w-4 h-4" />
            </div>
          </button>
          <button 
            onClick={openCreateDespesa}
            className={expenseActionButtonClass}
          >
            <span>Nova Despesa</span>
            <div className={primaryActionIconClass}>
              <Plus weight="bold" className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* Filtros Globais */}
      <div className={cn('mb-6', filterBarClass)}>
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[repeat(6,minmax(140px,1fr))_auto] items-end">
          <div>
            <label htmlFor="finance-date-start" className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Data inicial</label>
            <DatePickerField
              id="finance-date-start"
              name="financeDataInicio"
              aria-label="Data inicial"
              value={financeDataInicio}
              onChange={(event) => setFinanceDataInicio(event.target.value)}
              className={cn(filterControlClass, 'w-full')}
            />
          </div>
          <div>
            <label htmlFor="finance-date-end" className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Data final</label>
            <DatePickerField
              id="finance-date-end"
              name="financeDataFim"
              aria-label="Data final"
              value={financeDataFim}
              onChange={(event) => setFinanceDataFim(event.target.value)}
              className={cn(filterControlClass, 'w-full')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Cliente</label>
            <CustomSelect
              value={financeClienteId}
              onChange={setFinanceClienteId}
              placeholder="Todos os clientes"
              ariaLabel="Filtrar por cliente"
              className="min-w-0"
              options={[{ label: 'Todos os clientes', value: 'Todos' }, ...clientes.map((cliente) => ({ label: cliente.nome, value: cliente.id }))]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Categoria</label>
            <CustomSelect
              value={financeCategoria}
              onChange={setFinanceCategoria}
              placeholder="Todas as categorias"
              ariaLabel="Filtrar por categoria"
              className="min-w-0"
              options={[{ label: 'Todas as categorias', value: 'Todas' }, ...categoriasDespesas.map((value) => ({ label: value, value }))]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Tipo de custo</label>
            <CustomSelect
              value={financeTipoCusto}
              onChange={setFinanceTipoCusto}
              placeholder="Todos os tipos"
              ariaLabel="Filtrar por tipo de custo"
              className="min-w-0"
              options={[{ label: 'Todos os tipos', value: 'Todos' }, ...tiposCusto.map((value) => ({ label: value, value }))]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Centro de custo</label>
            <CustomSelect
              value={financeCentroCusto}
              onChange={setFinanceCentroCusto}
              placeholder="Todos os centros"
              ariaLabel="Filtrar por centro de custo"
              className="min-w-0"
              options={[{ label: 'Todos os centros', value: 'Todos' }, ...centrosCustoDisponiveis.map((value) => ({ label: value, value }))]}
            />
          </div>
          {(financeDataInicio || financeDataFim || financeClienteId !== 'Todos' || financeCategoria !== 'Todas' || financeTipoCusto !== 'Todos' || financeCentroCusto !== 'Todos') && (
            <button
              type="button"
              onClick={() => {
                setFinanceDataInicio('');
                setFinanceDataFim('');
                setFinanceClienteId('Todos');
                setFinanceCategoria('Todas');
                setFinanceTipoCusto('Todos');
                setFinanceCentroCusto('Todos');
              }}
              className={filterClearButtonClass}
            >
              Limpar
            </button>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Recorte atual: {analytics.orcamentos.length} orçamento(s), {analytics.parcelas.length} parcela(s), {analytics.despesas.length} despesa(s).
        </p>
      </div>

      {/* Tabs Navigation */}
      <div role="tablist" aria-label="Abas financeiras" className={cn('mb-8 flex gap-2 overflow-x-auto hide-scrollbar', geoTabListClass)}>
        <button 
          role="tab"
          aria-selected={activeTab === 'visao'}
          onClick={() => setActiveTab('visao')}
          className={geoTabButtonClass(activeTab === 'visao', 'finance')}
        >
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'visao', 'system')}><ChartBar weight={activeTab === 'visao' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Visão financeira
        </button>
        <button 
          role="tab"
          aria-selected={activeTab === 'receber'}
          onClick={() => setActiveTab('receber')}
          className={geoTabButtonClass(activeTab === 'receber', 'finance')}
        >
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'receber', 'success')}><CurrencyDollar weight={activeTab === 'receber' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Contas a Receber
        </button>
        <button 
          role="tab"
          aria-selected={activeTab === 'pagar'}
          onClick={() => setActiveTab('pagar')}
          className={geoTabButtonClass(activeTab === 'pagar', 'finance')}
        >
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'pagar', 'danger')}><Receipt weight={activeTab === 'pagar' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Contas a Pagar
        </button>
        <button 
          role="tab"
          aria-selected={activeTab === 'faturas'}
          onClick={() => setActiveTab('faturas')}
          className={geoTabButtonClass(activeTab === 'faturas', 'finance')}
        >
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'faturas', 'warning')}><Receipt weight={activeTab === 'faturas' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Contas a receber
        </button>
        <button 
          role="tab"
          aria-selected={activeTab === 'relatorios'}
          onClick={() => setActiveTab('relatorios')}
          className={geoTabButtonClass(activeTab === 'relatorios', 'finance')}
        >
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'relatorios', 'system')}><Printer weight={activeTab === 'relatorios' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Relatórios Corporativos
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green-100 border-t-brand-turquoise-600 dark:border-brand-green-300/20 dark:border-t-brand-turquoise-300" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'visao' && (
            <motion.div key="visao" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <motion.div whileHover={{ y: -4 }} className={cn(financeMetricCardClass, financeRevenueMetricClass)}>
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={cn(geoGreenIconClass, 'flex h-10 w-10 items-center justify-center rounded-full')}>
                        <TrendUp weight="duotone" className="h-5 w-5" />
                      </div>
                      <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Recebido (Caixa)</span>
                    </div>
                    <span className={cn('block text-3xl font-semibold tracking-tight', geoGreenValueClass)}>{formatCurrency(kpiReceitasRecebidas)}</span>
                  </div>
                  <span className="mt-2 text-xs font-medium text-emerald-100/70">Contratado: {formatCurrency(kpiFaturamentoAprovado)}</span>
                </motion.div>

                <motion.div whileHover={{ y: -4 }} className={cn(financeMetricCardClass, financeExpenseMetricClass)}>
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={cn(geoPurpleIconClass, 'flex h-10 w-10 items-center justify-center rounded-full')}>
                        <TrendDown weight="duotone" className="h-5 w-5" />
                      </div>
                      <span className={cn('text-xs font-bold uppercase tracking-wider', geoPurpleLabelClass)}>Custos Pagos</span>
                    </div>
                    <span className={cn('block text-3xl font-semibold tracking-tight', geoPurpleValueClass)}>{formatCurrency(kpiCustosPagos)}</span>
                  </div>
                  <span className="mt-2 text-xs font-medium text-violet-100/70">A pagar: {formatCurrency(kpiCustosPrevistos)}</span>
                </motion.div>

                <motion.div whileHover={{ y: -4 }} className={cn(financeMetricCardClass, financeMarginMetricClass)}>
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={cn(geoGreenIconClass, 'flex h-10 w-10 items-center justify-center rounded-full')}>
                        <ChartBar weight="duotone" className="h-5 w-5" />
                      </div>
                      <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Margem de caixa</span>
                    </div>
                    <span className={cn('block text-3xl font-semibold tracking-tight', geoGreenValueClass)}>{kpiMargemLucroReal}%</span>
                  </div>
                  <span className="mt-2 text-xs font-medium text-emerald-100/70">Baseado em receitas reais</span>
                </motion.div>

                <motion.div whileHover={{ y: -4 }} className={cn(financeMetricCardClass, financeProfitMetricClass)}>
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={cn(geoGreenIconClass, 'flex h-10 w-10 items-center justify-center rounded-full')}>
                        <Wallet weight="duotone" className="w-5 h-5" />
                      </div>
                      <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Resultado de caixa</span>
                    </div>
                    <span className="text-3xl font-semibold tracking-tight text-white block">{formatCurrency(kpiLucroLiquidoReal)}</span>
                  </div>
                  <span className="relative z-10 mt-2 text-xs font-medium text-emerald-100/70">Regime de Caixa</span>
                </motion.div>
              </div>

              {analytics.alertas.length > 0 && (
                <div className={cn(geoOrangeSurfaceClass, 'geo-card mb-12 p-6')}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className={cn(geoOrangeIconClass, 'flex h-10 w-10 items-center justify-center rounded-2xl')}>
                      <Receipt className="h-5 w-5" weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Alertas financeiros</h3>
                      <p className="text-xs font-semibold text-orange-100/70">Pendências que podem distorcer caixa, lucro ou cobrança.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {analytics.alertas.map((alerta, index) => (
                      <div key={`${alerta.titulo}-${index}`} className="geo-card p-4">
                        <span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          alerta.tipo === 'critico'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : alerta.tipo === 'atencao'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                        }`}>
                          {alerta.tipo}
                        </span>
                        <p className="font-semibold text-zinc-950 dark:text-white">{alerta.titulo}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">{alerta.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="geo-card mb-12 p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Composição de custos</h2>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Separação fiscal para campo, cartório, tributos, fixos e reembolsos.</p>
                  </div>
                  <span className="geo-badge-base bg-brand-surface px-3 py-1 text-xs font-bold text-zinc-600 dark:bg-brand-surface-muted dark:text-zinc-300">
                    {formatCurrency(analytics.kpis.despesasLancadas)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  {[
                    {
                      label: 'Custos fixos',
                      value: analytics.kpis.custosFixos,
                      chipClass: 'bg-white/10 text-violet-50 ring-white/15',
                      cardClass: geoPurpleSurfaceClass,
                      accentClass: geoPurpleAccentClass,
                    },
                    {
                      label: 'Campo/variáveis',
                      value: analytics.kpis.custosVariaveis,
                      chipClass: 'bg-white/10 text-violet-50 ring-white/15',
                      cardClass: geoPurpleSurfaceClass,
                      accentClass: geoPurpleAccentClass,
                    },
                    {
                      label: 'Cartório e taxas',
                      value: analytics.kpis.custosCartorioTaxas,
                      chipClass: 'bg-white/10 text-violet-50 ring-white/15',
                      cardClass: geoPurpleSurfaceClass,
                      accentClass: geoPurpleAccentClass,
                    },
                    {
                      label: 'Tributário',
                      value: analytics.kpis.custosTributarios,
                      chipClass: 'bg-white/10 text-violet-50 ring-white/15',
                      cardClass: geoPurpleSurfaceClass,
                      accentClass: geoPurpleAccentClass,
                    },
                    {
                      label: 'Reembolsável',
                      value: analytics.kpis.custosReembolsaveis,
                      chipClass: 'bg-white/10 text-emerald-50 ring-white/15',
                      cardClass: geoGreenSurfaceClass,
                      accentClass: geoGreenAccentClass,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        'geo-card relative overflow-hidden p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-brand',
                        item.cardClass
                      )}
                    >
                      <div className={cn('absolute inset-x-0 top-0 h-1', item.accentClass === geoOrangeAccentClass || item.accentClass === geoGreenAccentClass || item.accentClass === geoPurpleAccentClass ? item.accentClass : cn('bg-gradient-to-r', item.accentClass))} />
                      <span className={cn('geo-badge-base relative px-2 py-0.5 text-xs uppercase tracking-wider', item.chipClass)}>
                        {item.label}
                      </span>
                      <p className={cn('relative mt-3 text-lg font-bold', item.cardClass === geoOrangeSurfaceClass || item.cardClass === geoGreenSurfaceClass || item.cardClass === geoPurpleSurfaceClass ? 'text-white' : 'text-zinc-950 dark:text-white')}>{formatCurrency(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gráfico do fluxo de caixa mensal */}
              <div className="geo-card mb-12 p-8 md:p-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">Fluxo de caixa mensal</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-1">Fluxo de Caixa Realizado (Regime de Caixa)</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
                    <button
                      type="button"
                      onClick={() => setComparison('none')}
                      className={financePillButtonClass(comparison === 'none')}
                    >
                      Atual
                    </button>
                    <button
                      type="button"
                      onClick={() => setComparison('month')}
                      className={financePillButtonClass(comparison === 'month')}
                    >
                      vs Mês Ant.
                    </button>
                    <button
                      type="button"
                      onClick={() => setComparison('year')}
                      className={financePillButtonClass(comparison === 'year')}
                    >
                      vs Ano Ant.
                    </button>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={dreChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTextColor, fontSize: 12, fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTextColor, fontSize: 12, fontWeight: 500 }} tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR')}`} />
                      <Tooltip cursor={chartCursor} content={<RichTooltip showDifference={true} differenceLabel="Saldo de caixa" format="currency" />} />
                      <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="Recebido" fill={chartColors.positive} radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="Contratado" fill={chartColors.primary} opacity={0.35} radius={[6, 6, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="Despesas" fill={chartColors.negative} radius={[6, 6, 0, 0]} maxBarSize={40} />
                      {comparison === 'year' && (
                        <>
                          <Bar dataKey="Recebido (Ano Ant.)" fill={chartColors.positive} opacity={0.35} stroke={chartColors.positive} strokeDasharray="3 3" radius={[6, 6, 0, 0]} maxBarSize={30} />
                          <Bar dataKey="Despesas (Ano Ant.)" fill={chartColors.negative} opacity={0.35} stroke={chartColors.negative} strokeDasharray="3 3" radius={[6, 6, 0, 0]} maxBarSize={30} />
                        </>
                      )}
                      {comparison === 'month' && (
                        <>
                          <Bar dataKey="Recebido (Mês Ant.)" fill={chartColors.positive} opacity={0.35} stroke={chartColors.positive} strokeDasharray="3 3" radius={[6, 6, 0, 0]} maxBarSize={30} />
                          <Bar dataKey="Despesas (Mês Ant.)" fill={chartColors.negative} opacity={0.35} stroke={chartColors.negative} strokeDasharray="3 3" radius={[6, 6, 0, 0]} maxBarSize={30} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'receber' && (
            <motion.div key="receber" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="geo-card p-8">
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-white mb-8 flex items-center gap-3">
                  <CurrencyDollar weight="duotone" className="w-6 h-6 text-zinc-400" /> Contas a Receber (Orçamentos)
                </h2>
                <div className="space-y-4">
                  {analytics.orcamentos.length === 0 ? <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nenhum orçamento lançado.</p> : (
                    analytics.orcamentos.map((orc) => (
                      <div key={orc.id} className="geo-card-interactive group flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-zinc-950 dark:text-white truncate">{orc.clienteNome}</p>
                            {orc.codigoOrcamento && (
                              <span className="geo-badge-base bg-brand-primary-50 px-1.5 py-0.5 font-mono text-xs font-bold text-brand-primary-700 dark:bg-brand-primary-400/10 dark:text-brand-primary-100">
                                {orc.codigoOrcamento}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{orc.descricao || 'Sem descrição'}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-1">
                            {orc.projetoNome ? `Propriedade: ${orc.projetoNome}` : 'Recebimento geral do cliente'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
                            {orc.centroCusto && (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">{orc.centroCusto}</span>
                            )}
                            {orc.impostoValor ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Imposto {formatCurrency(orc.impostoValor)}</span>
                            ) : null}
                            {orc.dataPagamento && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                Pago em {new Date(orc.dataPagamento).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">{formatCurrency(orc.valorTotal)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase mt-1 ${getStatusColor(orc.status)}`}>
                              {orc.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button 
                              onClick={() => openEditOrcamento(orc)} 
                              className={cn(financeIconButtonClass, 'border-brand-primary-200/80 bg-brand-primary-50 text-brand-primary-700 hover:bg-brand-primary-100 dark:border-brand-primary-300/20 dark:bg-brand-primary-400/10 dark:text-brand-primary-100')} 
                              title="Editar"
                              aria-label="Editar recebimento"
                            >
                              <PencilSimple className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrcamento(orc.id)} 
                              className={cn(financeIconButtonClass, 'border-brand-red-200/80 bg-brand-red-50 text-brand-red-700 hover:bg-brand-red-100 dark:border-brand-red-300/20 dark:bg-brand-red-400/10 dark:text-brand-red-100')} 
                              title="Excluir"
                              aria-label="Excluir recebimento"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'pagar' && (
            <motion.div key="pagar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="geo-card p-8">
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-white mb-8 flex items-center gap-3">
                  <Receipt weight="duotone" className="w-6 h-6 text-zinc-400" /> Contas a Pagar (Despesas Operacionais)
                </h2>
                <div className="space-y-4">
                  {analytics.despesas.length === 0 ? <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nenhuma despesa lançada.</p> : (
                    analytics.despesas.map((desp) => (
                      <div key={desp.id} className="geo-card-interactive group flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-950 dark:text-white truncate">{desp.descricao}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="geo-badge-base geo-badge-info px-2 py-0.5 text-xs">{desp.categoria}</span>
                            {desp.tipoCusto && (
                              <span className="font-medium text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-md dark:bg-indigo-500/10 dark:text-indigo-300">{desp.tipoCusto}</span>
                            )}
                            {desp.centroCusto && (
                              <span className="font-medium text-sky-600 px-2 py-0.5 bg-sky-50 rounded-md dark:bg-sky-500/10 dark:text-sky-300">{desp.centroCusto}</span>
                            )}
                            {desp.reembolsavel && (
                              <span className="font-medium text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md dark:bg-emerald-500/10 dark:text-emerald-300">Reembolsável</span>
                            )}
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {desp.data ? new Date(desp.data).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                          </div>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-1">
                            {desp.clienteNome || desp.projetoNome ? `${desp.clienteNome || 'Cliente nao identificado'}${desp.projetoNome ? ` · ${desp.projetoNome}` : ''}` : 'Despesa administrativa sem cliente vinculado'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-red-600">-{formatCurrency(desp.valor)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase mt-1 ${getStatusColor(desp.status || 'Pendente')}`}>
                              {desp.status || 'Pendente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button 
                              onClick={() => openEditDespesa(desp)} 
                              className={cn(financeIconButtonClass, 'border-brand-primary-200/80 bg-brand-primary-50 text-brand-primary-700 hover:bg-brand-primary-100 dark:border-brand-primary-300/20 dark:bg-brand-primary-400/10 dark:text-brand-primary-100')} 
                              title="Editar"
                              aria-label="Editar despesa"
                            >
                              <PencilSimple className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteDespesa(desp.id)} 
                              className={cn(financeIconButtonClass, 'border-brand-red-200/80 bg-brand-red-50 text-brand-red-700 hover:bg-brand-red-100 dark:border-brand-red-300/20 dark:bg-brand-red-400/10 dark:text-brand-red-100')} 
                              title="Excluir"
                              aria-label="Excluir despesa"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'faturas' && (
            <motion.div key="faturas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="print:hidden">
              {/* Bento Grid Stats for Faturas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className={cn(geoGreenSurfaceClass, 'geo-card p-6')}>
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total previsto</span>
                  <p className={cn('mt-2 text-3xl font-bold', geoGreenValueClass)}>{formatCurrency(parcelas.reduce((acc, curr) => acc + curr.valor, 0))}</p>
                </div>
                <div className={cn(geoGreenSurfaceClass, 'geo-card p-6')}>
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total Recebido</span>
                  <p className={cn('mt-2 text-3xl font-bold', geoGreenValueClass)}>{formatCurrency(parcelas.filter(p => p.statusPagamento === 'Pago').reduce((acc, curr) => acc + curr.valor, 0))}</p>
                </div>
                <div className={cn(geoOrangeSurfaceClass, 'geo-card p-6')}>
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Pendente (A Vencer)</span>
                  <p className={cn('mt-2 text-3xl font-bold', geoOrangeValueClass)}>{formatCurrency(parcelas.filter(p => p.statusPagamento === 'Pendente' && new Date(p.dataVencimento) >= new Date()).reduce((acc, curr) => acc + curr.valor, 0))}</p>
                </div>
                <div className={cn(geoPurpleSurfaceClass, 'geo-card p-6')}>
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', geoPurpleLabelClass)}>Total Atrasado</span>
                  <p className={cn('mt-2 text-3xl font-bold', geoPurpleValueClass)}>{formatCurrency(parcelas.filter(p => p.statusPagamento === 'Pendente' && new Date(p.dataVencimento) < new Date()).reduce((acc, curr) => acc + curr.valor, 0))}</p>
                </div>
              </div>

              {/* Filters and Subtabs */}
              <div className="flex flex-col gap-4 mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setFaturasActiveTab('pendentes')}
                    className={financePillButtonClass(faturasActiveTab === 'pendentes')}
                  >
                    Parcelas em aberto
                  </button>
                  <button 
                    onClick={() => setFaturasActiveTab('recebidas')}
                    className={financePillButtonClass(faturasActiveTab === 'recebidas')}
                  >
                    Histórico Recebido
                  </button>
                </div>

                <div className="geo-card p-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.7fr))_auto]">
                    <div className="relative">
                      <MagnifyingGlass className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar por cliente..."
                        value={faturasSearch}
                        onChange={e => setFaturasSearch(e.target.value)}
                        className={cn(financeCompactFieldClass, 'pl-10 pr-4')}
                      />
                    </div>
                    <DatePickerField
                      value={faturasDataInicio}
                      onChange={(event) => setFaturasDataInicio(event.target.value)}
                      className={financeCompactFieldClass}
                      aria-label="Vencimento inicial"
                    />
                    <DatePickerField
                      value={faturasDataFim}
                      onChange={(event) => setFaturasDataFim(event.target.value)}
                      className={financeCompactFieldClass}
                      aria-label="Vencimento final"
                    />
                    {(faturasSearch || faturasDataInicio || faturasDataFim) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFaturasSearch('');
                          setFaturasDataInicio('');
                          setFaturasDataFim('');
                        }}
                        className={cn(secondarySmallActionButtonClass, 'h-11 px-4 text-sm')}
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Faturas list */}
              <div className="geo-card p-8">
                {filteredParcelas.length === 0 ? (
                  <p className="text-zinc-400 text-sm">Nenhuma fatura encontrada.</p>
                ) : (
                  <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {filteredParcelas.map(item => {
                      const status = getFaturaStatus(item);
                      return (
                        <div key={item.id} className="geo-card-interactive flex items-center justify-between gap-6 p-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                status === 'Pago' ? 'bg-emerald-50 text-emerald-700' :
                                status === 'Atrasado' ? 'bg-red-50 text-red-700 animate-pulse' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {status}
                              </span>
                              <span className="text-xs text-zinc-400">Vencimento: {new Date(item.dataVencimento).toLocaleDateString()}</span>
                            </div>
                            <p className="font-semibold text-zinc-950 dark:text-white truncate">{item.clienteNome}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.orcamentoDescricao || 'Sem descrição do orçamento'}</p>
                          </div>

                          <div className="flex items-center gap-4">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{formatCurrency(item.valor)}</p>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setSelectedFatura(item)}
                                className={cn(secondarySmallActionButtonClass, 'min-h-9 px-3 py-2')}
                              >
                                {status === 'Pago' ? 'Ver recibo' : 'Ver cobrança'}
                              </button>
                              {status !== 'Pago' && (
                                <button 
                                  onClick={() => handleMarcarComoPago(item.id)}
                                  className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green-50 text-brand-green-700 transition-[background-color,transform] hover:bg-brand-green-100 active:scale-[0.97] dark:bg-brand-green-400/10 dark:text-brand-green-100"
                                  title="Confirmar Recebimento"
                                >
                                  <Check weight="bold" className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'relatorios' && (
            <motion.div key="relatorios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex items-center gap-4 mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6 print:hidden">
                <button 
                  onClick={() => setReportType('financeiro')}
                  className={cn(financePillButtonClass(reportType === 'financeiro'), 'text-sm')}
                >
                  <CurrencyDollar className="w-4 h-4" /> Relatório Financeiro Geral
                </button>
                <button 
                  onClick={() => setReportType('projetos')}
                  className={cn(financePillButtonClass(reportType === 'projetos'), 'text-sm')}
                >
                  <Briefcase className="w-4 h-4" /> Relatório Operacional de Projetos
                </button>
                <button 
                  onClick={() => window.print()}
                  className="geo-button-base geo-button-primary geo-focus-ring ml-auto flex items-center gap-2 px-6 py-3 text-sm"
                >
                  <Printer className="w-4 h-4" /> Imprimir / PDF
                </button>
              </div>

              {/* Printable Area */}
              <div className="geo-card mx-auto max-w-4xl p-12 print:p-0 print:shadow-none print:ring-0">
                <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-8 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">GeoGestor • Relatório Corporativo</h2>
                    <p className="text-sm text-zinc-400 mt-1 uppercase tracking-wider">Emitido em {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold tracking-widest text-zinc-400 block">Tipo do Documento</span>
                    <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {reportType === 'financeiro' ? 'Demonstração Financeira' : 'Status Operacional'}
                    </span>
                  </div>
                </div>

                {statsLoading ? (
                  <p className="text-zinc-500 dark:text-zinc-400 py-12 text-center">Carregando dados consolidados...</p>
                ) : (
                  <div>
                    {reportType === 'financeiro' ? (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">1. Resumo de Receitas (Orçamentos)</h3>
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-400 uppercase">
                                <th className="pb-3">Status</th>
                                <th className="pb-3 text-right">Qtd</th>
                                <th className="pb-3 text-right">Total Acumulado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
                              {stats?.orcamentosStats?.map((item) => (
                                <tr key={item.status}>
                                  <td className="py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.status}</td>
                                  <td className="py-4 text-right">{item.count}</td>
                                  <td className="py-4 text-right">{formatCurrency(item.total)}</td>
                                </tr>
                              ))}
                              {(!stats?.orcamentosStats || stats.orcamentosStats.length === 0) && (
                                <tr>
                                  <td colSpan={3} className="py-4 text-center text-zinc-400">Nenhum dado lançado.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">2. Resumo de Despesas por Categoria</h3>
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-400 uppercase">
                                <th className="pb-3">Categoria</th>
                                <th className="pb-3 text-right">Total Acumulado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
                              {stats?.despesasPorCategoria?.map((item) => (
                                <tr key={item.categoria}>
                                  <td className="py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.categoria}</td>
                                  <td className="py-4 text-right">{formatCurrency(item.total)}</td>
                                </tr>
                              ))}
                              {(!stats?.despesasPorCategoria || stats.despesasPorCategoria.length === 0) && (
                                <tr>
                                  <td colSpan={2} className="py-4 text-center text-zinc-400">Nenhum custo lançado.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">1. Status dos Projetos Locais</h3>
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-400 uppercase">
                                <th className="pb-3">Status</th>
                                <th className="pb-3 text-right">Qtd</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
                              {stats?.projetosPorStatus?.map((item) => (
                                <tr key={item.status}>
                                  <td className="py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.status}</td>
                                  <td className="py-4 text-right">{item.count}</td>
                                </tr>
                              ))}
                              {(!stats?.projetosPorStatus || stats.projetosPorStatus.length === 0) && (
                                <tr>
                                  <td colSpan={2} className="py-4 text-center text-zinc-400">Nenhum projeto cadastrado.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                          <div>
                            <span className="text-xs font-bold text-zinc-400 uppercase block">Área Total sob Gestão</span>
                            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 block">{stats?.areaTotal?.toFixed(1) || '0.0'} ha</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Recibo Modal (Faturas) */}
      <Modal
        isOpen={!!selectedFatura}
        onClose={() => setSelectedFatura(null)}
        title={selectedFatura?.statusPagamento === 'Pago' ? 'GeoGestor • Recibo' : 'GeoGestor • Demonstrativo de cobrança'}
        maxWidth="max-w-2xl"
      >
        {selectedFatura && (
          <div className="flex flex-col justify-between h-full">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6 mb-6">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Emitido em: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
              <div>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Destinatário</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{selectedFatura.clienteNome}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">ID do Cliente: {selectedFatura.clienteId}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Vencimento</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{new Date(selectedFatura.dataVencimento).toLocaleDateString()}</p>
                <span className={`inline-block mt-2 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700`}>
                  {selectedFatura.statusPagamento}
                </span>
              </div>
            </div>

            <div className="geo-card mb-8 p-6 print:border print:border-zinc-200 print:bg-white">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Descrição dos Serviços</span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">{selectedFatura.orcamentoDescricao || 'Serviços topográficos e consultoria de licenciamento ambiental'}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-zinc-200/60 dark:border-zinc-800 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Parcela de Orçamento (Ref: #{selectedFatura.orcamentoId.substring(0, 8)})</span>
                <span className="font-bold text-zinc-900 dark:text-white">
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

            <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-zinc-900 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-zinc-800"
              >
                <Printer className="w-4 h-4" /> {selectedFatura.statusPagamento === 'Pago' ? 'Imprimir recibo' : 'Imprimir cobrança'}
              </button>
              
              {selectedFatura.statusPagamento !== 'Pago' && (
                <button 
                  onClick={() => {
                    handleMarcarComoPago(selectedFatura.id);
                    setSelectedFatura(null);
                  }}
                  className="bg-emerald-600 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-emerald-500"
                >
                  Marcar como Pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Orçamento */}
      <Modal
        isOpen={showOrcamentoModal}
        onClose={requestCloseRevenue}
        closeDisabled={submitOrcamentoMutation.isPending || discardTarget === 'receita'}
        title={<span className="flex flex-wrap items-center gap-2"><span>{selectedOrcamento ? 'Editar Recebimento' : 'Novo Recebimento'}</span>{revenueDirty && <span className="geo-badge-base geo-badge-unsaved px-2 py-1 text-[11px]">Alterações não salvas</span>}</span>}
        maxWidth="max-w-3xl"
        initialFocusId="orcCodigo"
      >
        <form onSubmit={handleOrcamentoSubmit} className="space-y-5" noValidate>
          <FormError message={orcFormError} />

          <FormSection sectionId="revenue-identification" title="Identificação e vínculo" description="Defina o cliente, o projeto e a origem do recebimento." icon={<Receipt className="h-5 w-5" weight="duotone" />} tone="emerald">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField htmlFor="orcCodigo" label="Código interno">
                <input id="orcCodigo" name="codigoOrcamento" type="text" autoComplete="off" spellCheck={false} value={orcCodigo} onChange={e => setOrcCodigo(e.target.value)} placeholder="Ex.: ORC-2026-001" className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="orcClienteId" label="Cliente vinculado" required error={orcFormErrors.clienteId}>
                <FormSelect id="orcClienteId" name="clienteId" autoComplete="off" value={orcClienteId} onChange={e => { setOrcClienteId(e.target.value); setOrcFormErrors(current => ({ ...current, clienteId: undefined })); setOrcFormError(''); }} aria-invalid={Boolean(orcFormErrors.clienteId)} aria-describedby={orcFormErrors.clienteId ? 'orcClienteId-error' : undefined} className={cn(financeFieldClass, 'appearance-none')}>
                  <option value="">Selecione um cliente…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </FormSelect>
              </FormField>
              <FormField htmlFor="orcProjetoId" label="Propriedade ou projeto">
                <FormSelect id="orcProjetoId" name="projetoId" autoComplete="off" value={orcProjetoId} onChange={e => setOrcProjetoId(e.target.value)} disabled={!orcClienteId} className={cn(financeFieldClass, 'appearance-none disabled:cursor-not-allowed disabled:opacity-60')}>
                  <option value="">Recebimento geral do cliente</option>
                  {projetosDoCliente.map((projeto) => <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>)}
                </FormSelect>
              </FormField>
              <FormField htmlFor="orcDescricao" label="Descrição ou serviço" required error={orcFormErrors.descricao}>
                <input id="orcDescricao" name="descricao" type="text" autoComplete="off" value={orcDescricao} onChange={e => { setOrcDescricao(e.target.value); setOrcFormErrors(current => ({ ...current, descricao: undefined })); setOrcFormError(''); }} placeholder="Ex.: Levantamento topográfico — Fazenda Esperança" aria-invalid={Boolean(orcFormErrors.descricao)} aria-describedby={orcFormErrors.descricao ? 'orcDescricao-error' : undefined} className={financeFieldClass} />
              </FormField>
            </div>
          </FormSection>

          <FormSection sectionId="revenue-values" title="Valores e classificação" description="Informe o valor contratado, os ajustes e a classificação gerencial." icon={<CurrencyDollar className="h-5 w-5" weight="duotone" />} tone="emerald">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField htmlFor="orcValorTotal" label="Valor total (R$)" required error={orcFormErrors.valorTotal}>
                <input id="orcValorTotal" name="valorTotal" type="number" inputMode="decimal" min="0.01" step="0.01" value={orcValorTotal} onChange={e => { setOrcValorTotal(e.target.value); setOrcFormErrors(current => ({ ...current, valorTotal: undefined })); setOrcFormError(''); }} placeholder="0,00" aria-invalid={Boolean(orcFormErrors.valorTotal)} aria-describedby={orcFormErrors.valorTotal ? 'orcValorTotal-error' : undefined} className={cn(financeFieldClass, 'font-mono text-lg font-bold tabular-nums text-brand-green-700')} />
              </FormField>
              <FormField htmlFor="orcDesconto" label="Desconto (R$)">
                <input id="orcDesconto" name="desconto" type="number" inputMode="decimal" min="0" step="0.01" value={orcDesconto} onChange={e => setOrcDesconto(e.target.value)} placeholder="0,00" className={cn(financeFieldClass, 'font-mono tabular-nums')} />
              </FormField>
              <FormField htmlFor="orcImpostoValor" label="Imposto ou retenção (R$)">
                <input id="orcImpostoValor" name="impostoValor" type="number" inputMode="decimal" min="0" step="0.01" value={orcImpostoValor} onChange={e => setOrcImpostoValor(e.target.value)} placeholder="0,00" className={cn(financeFieldClass, 'font-mono tabular-nums')} />
              </FormField>
              <FormField htmlFor="orcCentroCusto" label="Centro de custo" className="md:col-span-2 lg:col-span-1">
                <FormSelect id="orcCentroCusto" name="centroCusto" autoComplete="off" value={orcCentroCusto} onChange={e => setOrcCentroCusto(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  {centrosCustoDisponiveis.map((centro) => <option key={centro} value={centro}>{centro}</option>)}
                </FormSelect>
              </FormField>
              <div className="flex items-end md:col-span-2">
                <CheckboxField id="financeiro-imposto-retido" name="impostoRetido" label="Imposto retido na fonte" checked={orcImpostoRetido} onChange={setOrcImpostoRetido} className="rounded-lg border border-brand-border bg-brand-surface-subtle/35 px-2" />
              </div>
            </div>
          </FormSection>

          <FormSection sectionId="revenue-settlement" title="Competência e recebimento" description="Controle a situação, as condições e as datas financeiras." icon={<Calendar className="h-5 w-5" weight="duotone" />} tone="emerald">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField htmlFor="orcStatus" label="Situação">
                <FormSelect id="orcStatus" name="status" autoComplete="off" value={orcStatus} onChange={e => setOrcStatus(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  <option value="Em Análise">Em Análise</option><option value="Aprovado">Aprovado</option><option value="Rejeitado">Rejeitado</option><option value="Pago">Pago</option>
                </FormSelect>
              </FormField>
              <FormField htmlFor="orcFormaPagamento" label="Forma e condições de pagamento">
                <input id="orcFormaPagamento" name="formaDePagamento" type="text" autoComplete="off" value={orcFormaPagamento} onChange={e => setOrcFormaPagamento(e.target.value)} placeholder="Ex.: Pix ou entrada de 50% + 2 boletos" className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="orcDataCompetencia" label="Competência" error={orcFormErrors.dataCompetencia}>
                <DatePickerField id="orcDataCompetencia" name="dataCompetencia" autoComplete="off" value={orcDataCompetencia} onChange={e => { setOrcDataCompetencia(e.target.value); setOrcFormErrors(current => ({ ...current, dataCompetencia: undefined })); }} aria-invalid={Boolean(orcFormErrors.dataCompetencia)} aria-describedby={orcFormErrors.dataCompetencia ? 'orcDataCompetencia-error' : undefined} className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="orcDataPagamento" label="Data de pagamento" error={orcFormErrors.dataPagamento}>
                <DatePickerField id="orcDataPagamento" name="dataPagamento" autoComplete="off" value={orcDataPagamento} onChange={e => { setOrcDataPagamento(e.target.value); setOrcFormErrors(current => ({ ...current, dataPagamento: undefined })); }} aria-invalid={Boolean(orcFormErrors.dataPagamento)} aria-describedby={orcFormErrors.dataPagamento ? 'orcDataPagamento-error' : undefined} className={financeFieldClass} />
              </FormField>
            </div>
          </FormSection>

          <FormSection sectionId="revenue-notes" title="Observações" description="Registre informações adicionais para cobrança ou conferência." icon={<PencilSimple className="h-5 w-5" weight="duotone" />} tone="emerald" optional>
            <FormField htmlFor="orcAnotacoes" label="Notas internas">
              <textarea id="orcAnotacoes" name="anotacoes" value={orcAnotacoes} onChange={e => setOrcAnotacoes(e.target.value)} placeholder="Detalhes para cobrança…" rows={3} className={financeTextareaClass} />
            </FormField>
          </FormSection>

          <FormFooter>
            <button type="button" onClick={requestCloseRevenue} disabled={submitOrcamentoMutation.isPending} className={cn(secondarySmallActionButtonClass, 'px-6 py-3 font-semibold')}>Cancelar</button>
            <button type="submit" disabled={submitOrcamentoMutation.isPending} aria-busy={submitOrcamentoMutation.isPending} className={cn(primarySubmitButtonClass, 'px-6 py-3')}>{submitOrcamentoMutation.isPending ? 'Salvando…' : 'Salvar recebimento'}</button>
          </FormFooter>
        </form>
      </Modal>

      {/* Modal Despesa */}
      <Modal
        isOpen={showDespesaModal}
        onClose={requestClosePayable}
        closeDisabled={submitDespesaMutation.isPending || discardTarget === 'despesa'}
        title={<span className="flex flex-wrap items-center gap-2"><span>{selectedDespesa ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</span>{payableDirty && <span className="geo-badge-base geo-badge-unsaved px-2 py-1 text-[11px]">Alterações não salvas</span>}</span>}
        maxWidth="max-w-3xl"
        initialFocusId="despDescricao"
      >
        <form onSubmit={handleDespesaSubmit} className="space-y-5" noValidate>
          <FormError message={despFormError} />

          <FormSection sectionId="payable-identification" title="Identificação e documento" description="Descreva a obrigação e registre o fornecedor ou comprovante relacionado." icon={<Receipt className="h-5 w-5" weight="duotone" />} tone="amber">
            <FormField htmlFor="despDescricao" label="Descrição" required error={despFormErrors.descricao}>
              <input id="despDescricao" name="descricao" type="text" autoComplete="off" value={despDescricao} onChange={e => { setDespDescricao(e.target.value); setDespFormErrors(current => ({ ...current, descricao: undefined })); setDespFormError(''); }} placeholder="Ex.: Combustível para viagem de campo" aria-invalid={Boolean(despFormErrors.descricao)} aria-describedby={despFormErrors.descricao ? 'despDescricao-error' : undefined} className={financeFieldClass} />
            </FormField>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField htmlFor="despFornecedor" label="Fornecedor">
                <input id="despFornecedor" name="fornecedor" type="text" autoComplete="organization" value={despFornecedor} onChange={e => setDespFornecedor(e.target.value)} placeholder="Ex.: Cartório, prefeitura ou posto" className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="despNumeroDocumento" label="Documento ou comprovante">
                <input id="despNumeroDocumento" name="numeroDocumento" type="text" autoComplete="off" spellCheck={false} value={despNumeroDocumento} onChange={e => setDespNumeroDocumento(e.target.value)} placeholder="NF, recibo, guia ou protocolo" className={financeFieldClass} />
              </FormField>
            </div>
          </FormSection>

          <FormSection sectionId="payable-classification" title="Classificação e vínculo" description="Associe a despesa à estrutura gerencial, ao cliente e ao projeto corretos." icon={<Briefcase className="h-5 w-5" weight="duotone" />} tone="amber">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField htmlFor="despClienteId" label="Cliente vinculado">
                <FormSelect id="despClienteId" name="clienteId" autoComplete="off" value={despClienteId} onChange={e => setDespClienteId(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  <option value="">Administrativo ou sem cliente</option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </FormSelect>
              </FormField>
              <FormField htmlFor="despProjetoId" label="Projeto vinculado">
                <FormSelect id="despProjetoId" name="projetoId" autoComplete="off" value={despProjetoId} onChange={e => setDespProjetoId(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  <option value="">Nenhum ou custo geral</option>
                  {projetosDaDespesa.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </FormSelect>
              </FormField>
              <FormField htmlFor="despCategoria" label="Categoria gerencial">
                <FormSelect id="despCategoria" name="categoria" autoComplete="off" value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  <option value="Combustível">Combustível</option><option value="Pedágio">Pedágio</option><option value="Hospedagem">Hospedagem</option><option value="Alimentação">Alimentação</option><option value="Viagem e transporte">Viagem e transporte</option><option value="Cartório e taxas">Cartório e taxas</option><option value="Documentos">Documentos</option><option value="Equipamentos">Equipamentos</option><option value="Tributos">Tributos</option><option value="Software e licenças">Software e licenças</option><option value="Outros">Outros</option>
                </FormSelect>
              </FormField>
              <FormField htmlFor="despTipoCusto" label="Tipo de custo">
                <FormSelect id="despTipoCusto" name="tipoCusto" autoComplete="off" value={despTipoCusto} onChange={e => setDespTipoCusto(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  {tiposCusto.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </FormSelect>
              </FormField>
              <FormField htmlFor="despCentroCusto" label="Centro de custo" className="md:col-span-2">
                <FormSelect id="despCentroCusto" name="centroCusto" autoComplete="off" value={despCentroCusto} onChange={e => setDespCentroCusto(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  {centrosCustoDisponiveis.map((centro) => <option key={centro} value={centro}>{centro}</option>)}
                </FormSelect>
              </FormField>
            </div>
          </FormSection>

          <FormSection sectionId="payable-values" title="Valor, datas e pagamento" description="Controle o valor, a competência, o vencimento e a baixa financeira." icon={<Calendar className="h-5 w-5" weight="duotone" />} tone="amber">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField htmlFor="despValor" label="Valor (R$)" required error={despFormErrors.valor}>
                <input id="despValor" name="valor" type="number" inputMode="decimal" min="0.01" step="0.01" value={despValor} onChange={e => { setDespValor(e.target.value); setDespFormErrors(current => ({ ...current, valor: undefined })); setDespFormError(''); }} placeholder="0,00" aria-invalid={Boolean(despFormErrors.valor)} aria-describedby={despFormErrors.valor ? 'despValor-error' : undefined} className={cn(financeFieldClass, 'font-mono text-lg font-bold tabular-nums text-brand-red-700')} />
              </FormField>
              <FormField htmlFor="despData" label="Data de vencimento" required error={despFormErrors.data}>
                <DatePickerField id="despData" name="data" autoComplete="off" value={despData} onChange={e => { setDespData(e.target.value); setDespFormErrors(current => ({ ...current, data: undefined })); setDespFormError(''); }} aria-invalid={Boolean(despFormErrors.data)} aria-describedby={despFormErrors.data ? 'despData-error' : undefined} className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="despDataCompetencia" label="Competência" error={despFormErrors.dataCompetencia}>
                <DatePickerField id="despDataCompetencia" name="dataCompetencia" autoComplete="off" value={despDataCompetencia} onChange={e => { setDespDataCompetencia(e.target.value); setDespFormErrors(current => ({ ...current, dataCompetencia: undefined })); }} aria-invalid={Boolean(despFormErrors.dataCompetencia)} aria-describedby={despFormErrors.dataCompetencia ? 'despDataCompetencia-error' : undefined} className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="despStatus" label="Situação">
                <FormSelect id="despStatus" name="status" autoComplete="off" value={despStatus} onChange={e => setDespStatus(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                  <option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Atrasado">Atrasado</option>
                </FormSelect>
              </FormField>
              <FormField htmlFor="despFormaPagamento" label="Forma de pagamento">
                <input id="despFormaPagamento" name="formaPagamento" type="text" autoComplete="off" value={despFormaPagamento} onChange={e => setDespFormaPagamento(e.target.value)} placeholder="Pix, boleto, cartão ou dinheiro" className={financeFieldClass} />
              </FormField>
              <FormField htmlFor="despDataPagamento" label="Data de pagamento" error={despFormErrors.dataPagamento}>
                <DatePickerField id="despDataPagamento" name="dataPagamento" autoComplete="off" value={despDataPagamento} onChange={e => { setDespDataPagamento(e.target.value); setDespFormErrors(current => ({ ...current, dataPagamento: undefined })); }} aria-invalid={Boolean(despFormErrors.dataPagamento)} aria-describedby={despFormErrors.dataPagamento ? 'despDataPagamento-error' : undefined} className={financeFieldClass} />
              </FormField>
            </div>
          </FormSection>

          <FormSection sectionId="payable-notes" title="Reembolso e observações" description="Indique se o valor será reembolsado e registre informações de conferência." icon={<PencilSimple className="h-5 w-5" weight="duotone" />} tone="amber" optional>
            <CheckboxField id="financeiro-despesa-reembolsavel" name="reembolsavel" label="Despesa reembolsável pelo cliente" checked={despReembolsavel} onChange={setDespReembolsavel} className="rounded-lg border border-brand-border bg-brand-surface-subtle/35 px-2" />
            <FormField htmlFor="despObservacoes" label="Observações">
              <textarea id="despObservacoes" name="observacoes" value={despObservacoes} onChange={e => setDespObservacoes(e.target.value)} placeholder="Detalhes para conferência, reembolso ou prestação de contas…" rows={3} className={financeTextareaClass} />
            </FormField>
          </FormSection>

          <FormFooter>
            <button type="button" onClick={requestClosePayable} disabled={submitDespesaMutation.isPending} className={cn(secondarySmallActionButtonClass, 'px-6 py-3 font-semibold')}>Cancelar</button>
            <button type="submit" disabled={submitDespesaMutation.isPending} aria-busy={submitDespesaMutation.isPending} className={cn(primarySubmitButtonClass, 'px-6 py-3')}>{submitDespesaMutation.isPending ? 'Salvando…' : 'Salvar conta a pagar'}</button>
          </FormFooter>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(discardTarget)}
        onClose={() => setDiscardTarget(null)}
        onConfirm={() => {
          if (discardTarget === 'receita') setShowOrcamentoModal(false);
          if (discardTarget === 'despesa') setShowDespesaModal(false);
          setDiscardTarget(null);
        }}
        title="Descartar alterações?"
        description="Os dados preenchidos desde a abertura deste formulário serão perdidos."
        confirmText="Descartar alterações"
        cancelText="Continuar editando"
        variant="warning"
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'orcamento') deleteOrcamentoMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'despesa') deleteDespesaMutation.mutate(deleteTarget.item.id);
        }}
        title={deleteTarget?.type === 'orcamento'
          ? `Excluir orçamento${deleteTarget.item.codigoOrcamento ? ` ${deleteTarget.item.codigoOrcamento}` : ''}?`
          : `Excluir despesa${deleteTarget?.item.descricao ? ` “${deleteTarget.item.descricao}”` : ''}?`}
        description={deleteTarget?.type === 'orcamento'
          ? 'O orçamento em rascunho e suas parcelas serão removidos. Os indicadores financeiros serão recalculados.'
          : 'Somente despesas sem pagamento podem ser excluídas. Despesas pagas exigem estorno para preservar o histórico.'}
        confirmText={deleteTarget?.type === 'orcamento' ? 'Excluir orçamento' : 'Excluir despesa'}
        loading={deleteOrcamentoMutation.isPending || deleteDespesaMutation.isPending}
      />
    </Layout>
  );
}
