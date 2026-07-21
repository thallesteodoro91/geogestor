import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useEffect, useState } from 'react';
import { CheckboxField, DatePickerField, FormSelect } from '../../components/Form';
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

export interface DREItem {
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
  const [orcCentroCusto, setOrcCentroCusto] = useState('Servicos');

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
  const [despTipoCusto, setDespTipoCusto] = useState('Variavel de campo');
  const [despCentroCusto, setDespCentroCusto] = useState('Campo');
  const [despReembolsavel, setDespReembolsavel] = useState(false);
  const [despObservacoes, setDespObservacoes] = useState('');
  const [despStatus, setDespStatus] = useState('Pendente');
  const [despFormaPagamento, setDespFormaPagamento] = useState('Pix');

  // Faturas sub-tab States
  const [faturasSearch, setFaturasSearch] = useState('');
  const [faturasDataInicio, setFaturasDataInicio] = useState('');
  const [faturasDataFim, setFaturasDataFim] = useState('');
  const [faturasActiveTab, setFaturasActiveTab] = useState<'pendentes' | 'recebidas'>('pendentes');
  const [selectedFatura, setSelectedFatura] = useState<Parcela | null>(null);

  // Relatorios sub-tab States
  const [reportType, setReportType] = useState<'financeiro' | 'projetos'>('financeiro');

  // Queries
  const { data: orcamentos = [], isLoading: orcamentosLoading } = useQuery<Orcamento[]>({
    queryKey: ['orcamentos-financeiro'],
    queryFn: () => apiClient.get<Orcamento[]>('/api/financeiro/orcamentos')
  });

  const { data: despesas = [], isLoading: despesasLoading } = useQuery<Despesa[]>({
    queryKey: ['despesas-financeiro'],
    queryFn: () => apiClient.get<Despesa[]>('/api/financeiro/despesas')
  });

  const { data: clientes = [], isLoading: clientesLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<Cliente[]>('/api/clientes')
  });

  const { data: projetos = [], isLoading: projetosLoading } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<Projeto[]>('/api/projetos')
  });

  const { isLoading: dreLoading } = useQuery<DREItem[]>({
    queryKey: ['dre-financeiro'],
    queryFn: () => apiClient.get<DREItem[]>('/api/financeiro/dre')
  });

  const { data: parcelas = [], isLoading: parcelasLoading } = useQuery<Parcela[]>({
    queryKey: ['parcelas-financeiro'],
    queryFn: () => apiClient.get<Parcela[]>('/api/financeiro/parcelas')
  });

  const { data: stats, isLoading: statsLoading } = useQuery<RelatorioStats>({
    queryKey: ['relatorio-geral'],
    queryFn: () => apiClient.get<RelatorioStats>('/api/relatorios/geral'),
    enabled: activeTab === 'relatorios'
  });

  const loading = orcamentosLoading || despesasLoading || clientesLoading || projetosLoading || dreLoading || parcelasLoading;
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

  // Process DRE Chart Data with comparisons
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
      queryClient.invalidateQueries({ queryKey: ['parcelas-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: () => {
      alert('Erro ao atualizar status do pagamento.');
    }
  });

  const deleteOrcamentoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/financeiro/orcamentos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir orçamento');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['orcamentos-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: () => {
      alert('Erro ao excluir orçamento');
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
      queryClient.invalidateQueries({ queryKey: ['orcamentos-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: () => {
      alert('Erro de conexão.');
    }
  });

  const deleteDespesaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/financeiro/despesas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir despesa');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['despesas-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: () => {
      alert('Erro ao excluir despesa');
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
      queryClient.invalidateQueries({ queryKey: ['despesas-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: () => {
      alert('Erro de conexão.');
    }
  });

  // Action methods
  const openCreateOrcamento = () => {
    setSelectedOrcamento(null);
    setOrcClienteId(clientes.length > 0 ? clientes[0].id : '');
    setOrcProjetoId('');
    setOrcValorTotal('');
    setOrcStatus('Em Análise');
    setOrcDescricao('');
    setOrcAnotacoes('');
    setOrcFormaPagamento('Pix');
    setOrcDesconto('');
    setOrcCodigo('');
    setOrcDataCompetencia(new Date().toISOString().split('T')[0]);
    setOrcDataPagamento('');
    setOrcImpostoValor('');
    setOrcImpostoRetido(false);
    setOrcCentroCusto('Servicos');
    setShowOrcamentoModal(true);
  };

  const openEditOrcamento = (orc: Orcamento) => {
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
    setOrcCentroCusto(orc.centroCusto || 'Servicos');
    setShowOrcamentoModal(true);
  };

  const handleDeleteOrcamento = (id: string) => {
    const item = orcamentos.find((orcamento) => orcamento.id === id);
    if (item) setDeleteTarget({ type: 'orcamento', item });
  };

  const handleOrcamentoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orcClienteId) {
      alert('Selecione um cliente para vincular ao orçamento.');
      return;
    }

    const payload = {
      clienteId: orcClienteId,
      projetoId: orcProjetoId || null,
      valorTotal: Math.round(parseFloat(orcValorTotal) * 100),
      status: orcStatus,
      descricao: orcDescricao || null,
      anotacoes: orcAnotacoes || null,
      formaDePagamento: orcFormaPagamento || null,
      desconto: orcDesconto ? Math.round(parseFloat(orcDesconto) * 100) : null,
      codigoOrcamento: orcCodigo || null,
      dataCompetencia: orcDataCompetencia || null,
      dataPagamento: orcDataPagamento || null,
      impostoValor: orcImpostoValor ? Math.round(parseFloat(orcImpostoValor) * 100) : null,
      impostoRetido: orcImpostoRetido,
      centroCusto: orcCentroCusto || null
    };

    // Zod validation
    const schema = z.object({
      clienteId: z.string().min(1, 'Selecione um cliente'),
      valorTotal: z.number().min(1, 'Valor total inválido'),
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    submitOrcamentoMutation.mutate(payload);
  };

  const openCreateDespesa = () => {
    setSelectedDespesa(null);
    setDespClienteId('');
    setDespProjetoId('');
    setDespDescricao('');
    setDespFornecedor('');
    setDespNumeroDocumento('');
    setDespValor('');
    setDespData(new Date().toISOString().split('T')[0]);
    setDespDataCompetencia(new Date().toISOString().split('T')[0]);
    setDespDataPagamento('');
    setDespCategoria('Combustível');
    setDespTipoCusto('Variavel de campo');
    setDespCentroCusto('Campo');
    setDespReembolsavel(false);
    setDespObservacoes('');
    setDespStatus('Pendente');
    setDespFormaPagamento('Pix');
    setShowDespesaModal(true);
  };

  const openEditDespesa = (desp: Despesa) => {
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
    setShowDespesaModal(true);
  };

  const handleDeleteDespesa = (id: string) => {
    const item = despesas.find((despesa) => despesa.id === id);
    if (item) setDeleteTarget({ type: 'despesa', item });
  };

  const handleDespesaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      clienteId: despClienteId || null,
      projetoId: despProjetoId || null,
      descricao: despDescricao,
      fornecedor: despFornecedor || null,
      numeroDocumento: despNumeroDocumento || null,
      valor: Math.round(parseFloat(despValor) * 100),
      data: despData,
      dataCompetencia: despDataCompetencia || despData,
      dataPagamento: despDataPagamento || null,
      categoria: despCategoria,
      tipoCusto: despTipoCusto || null,
      centroCusto: despCentroCusto || null,
      reembolsavel: despReembolsavel,
      observacoes: despObservacoes || null,
      status: despStatus,
      formaPagamento: despFormaPagamento || null
    };

    // Zod validation
    const schema = z.object({
      descricao: z.string().min(1, 'Descrição é obrigatória'),
      valor: z.number().min(1, 'Valor inválido'),
      data: z.string().min(1, 'Selecione uma data')
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    submitDespesaMutation.mutate(payload);
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

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <span className={cn(geoKickerClass, 'mb-4')}>
            Módulo Financeiro
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Contabilidade 360
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Monitoramento de rentabilidade (DRE), orçamentos e custos operacionais.
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">Data inicial</label>
            <DatePickerField
              value={financeDataInicio}
              onChange={(event) => setFinanceDataInicio(event.target.value)}
              className={cn(filterControlClass, 'w-full')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">Data final</label>
            <DatePickerField
              value={financeDataFim}
              onChange={(event) => setFinanceDataFim(event.target.value)}
              className={cn(filterControlClass, 'w-full')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">Cliente</label>
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">Categoria</label>
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">Tipo de custo</label>
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">Centro de custo</label>
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
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'visao', 'system')}><ChartBar weight={activeTab === 'visao' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Visão 360 (DRE)
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
          <span aria-hidden="true" className={geoTabIconClass(activeTab === 'faturas', 'warning')}><Receipt weight={activeTab === 'faturas' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Faturas & Parcelas
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
                      <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Margem de Lucro</span>
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
                      <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Lucro Líquido Real</span>
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
                    <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Composição de custos</h3>
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

              {/* DRE Chart */}
              <div className="geo-card mb-12 p-8 md:p-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-semibold text-zinc-950 dark:text-white">Demonstrativo de Resultados (DRE)</h3>
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
                      <Tooltip cursor={chartCursor} content={<RichTooltip showDifference={true} differenceLabel="Balanço (DRE)" format="currency" />} />
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
                <h3 className="text-xl font-semibold text-zinc-950 dark:text-white mb-8 flex items-center gap-3">
                  <CurrencyDollar weight="duotone" className="w-6 h-6 text-zinc-400" /> Contas a Receber (Orçamentos)
                </h3>
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
                <h3 className="text-xl font-semibold text-zinc-950 dark:text-white mb-8 flex items-center gap-3">
                  <Receipt weight="duotone" className="w-6 h-6 text-zinc-400" /> Contas a Pagar (Despesas Operacionais)
                </h3>
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
                              <span className="font-medium text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md dark:bg-emerald-500/10 dark:text-emerald-300">Reembolsavel</span>
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
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total Faturado</span>
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
                    Faturas em Aberto
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
                                Ver Recibo
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
        title="GeoGestor • Fatura / Recibo"
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
                <span className="font-bold text-zinc-900 dark:text-white">{formatCurrency(selectedFatura.valor)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-zinc-900 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-zinc-800"
              >
                <Printer className="w-4 h-4" /> Imprimir Recibo
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
        onClose={() => setShowOrcamentoModal(false)}
        title={selectedOrcamento ? 'Editar Recebimento' : 'Novo Recebimento'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleOrcamentoSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="orcCodigo" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Código Interno</label>
              <input id="orcCodigo" type="text" value={orcCodigo} onChange={e => setOrcCodigo(e.target.value)} placeholder="Ex: ORC-2026-001" className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="orcClienteId" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Cliente Vinculado</label>
              <FormSelect id="orcClienteId" required value={orcClienteId} onChange={e => setOrcClienteId(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                <option value="">Selecione um cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </FormSelect>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="orcProjetoId" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Propriedade / Projeto</label>
              <FormSelect
                id="orcProjetoId"
                value={orcProjetoId}
                onChange={e => setOrcProjetoId(e.target.value)}
                disabled={!orcClienteId}
                className={cn(financeFieldClass, 'appearance-none disabled:cursor-not-allowed disabled:opacity-60')}
              >
                <option value="">Recebimento geral do cliente</option>
                {projetosDoCliente.map((projeto) => (
                  <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                ))}
              </FormSelect>
            </div>
          </div>
          <div>
            <label htmlFor="orcDescricao" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Descrição / Serviço</label>
            <input id="orcDescricao" type="text" required value={orcDescricao} onChange={e => setOrcDescricao(e.target.value)} placeholder="Ex: Levantamento Topográfico Fazenda Esperança" className={financeFieldClass} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label htmlFor="orcValorTotal" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Valor Total (BRL)</label>
              <input id="orcValorTotal" type="number" step="0.01" required value={orcValorTotal} onChange={e => setOrcValorTotal(e.target.value)} placeholder="R$ 0,00" className={cn(financeFieldClass, 'text-lg font-bold text-brand-green-700')} />
            </div>
            <div>
              <label htmlFor="orcDesconto" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Desconto (BRL)</label>
              <input id="orcDesconto" type="number" step="0.01" value={orcDesconto} onChange={e => setOrcDesconto(e.target.value)} placeholder="R$ 0,00" className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="orcStatus" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Status</label>
              <FormSelect id="orcStatus" value={orcStatus} onChange={e => setOrcStatus(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                <option value="Em Análise">Em Análise</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Rejeitado">Rejeitado</option>
                <option value="Pago">Pago</option>
              </FormSelect>
            </div>
          </div>
          <div>
            <label htmlFor="orcFormaPagamento" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Forma de Pagamento / Condições</label>
            <input id="orcFormaPagamento" type="text" value={orcFormaPagamento} onChange={e => setOrcFormaPagamento(e.target.value)} placeholder="Ex: Pix, Entrada 50% + 2x Boleto" className={financeFieldClass} />
          </div>
          <div>
            <label htmlFor="orcAnotacoes" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Observações / Notas</label>
            <textarea id="orcAnotacoes" value={orcAnotacoes} onChange={e => setOrcAnotacoes(e.target.value)} placeholder="Detalhes para cobrança..." rows={3} className={financeTextareaClass} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="orcDataCompetencia" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Competencia</label>
              <DatePickerField id="orcDataCompetencia" value={orcDataCompetencia} onChange={e => setOrcDataCompetencia(e.target.value)} className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="orcDataPagamento" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Data de pagamento</label>
              <DatePickerField id="orcDataPagamento" value={orcDataPagamento} onChange={e => setOrcDataPagamento(e.target.value)} className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="orcCentroCusto" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Centro de custo</label>
              <FormSelect id="orcCentroCusto" value={orcCentroCusto} onChange={e => setOrcCentroCusto(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                {centrosCustoDisponiveis.map((centro) => <option key={centro} value={centro}>{centro}</option>)}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="orcImpostoValor" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Imposto / retencao (BRL)</label>
              <input id="orcImpostoValor" type="number" step="0.01" value={orcImpostoValor} onChange={e => setOrcImpostoValor(e.target.value)} placeholder="R$ 0,00" className={financeFieldClass} />
            </div>
          </div>
          <CheckboxField id="financeiro-imposto-retido" label="Imposto retido na fonte" checked={orcImpostoRetido} onChange={setOrcImpostoRetido} className="geo-card px-3" />
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={() => setShowOrcamentoModal(false)} className={cn(secondarySmallActionButtonClass, 'px-6 py-3 font-semibold')}>Cancelar</button>
            <button type="submit" className={cn(primarySubmitButtonClass, 'px-6 py-3')}>Salvar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Despesa */}
      <Modal
        isOpen={showDespesaModal}
        onClose={() => setShowDespesaModal(false)}
        title={selectedDespesa ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleDespesaSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="despClienteId" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Cliente vinculado</label>
              <FormSelect id="despClienteId" value={despClienteId} onChange={e => setDespClienteId(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                <option value="">Administrativo / sem cliente</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despProjetoId" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Projeto Vinculado</label>
              <FormSelect id="despProjetoId" value={despProjetoId} onChange={e => setDespProjetoId(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                <option value="">Nenhum / custo geral</option>
                {projetosDaDespesa.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despCategoria" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Plano de Contas</label>
              <FormSelect id="despCategoria" value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                <option value="Combustível">Combustível e Transporte</option>
                <option value="Cartório">Emolumentos (Cartório)</option>
                <option value="Alimentação">Alimentação e Hospedagem</option>
                <option value="Equipamento">Manutenção de Equipamento</option>
                <option value="Impostos">Impostos e Taxas</option>
                <option value="Salários">Folha de Pagamento</option>
                <option value="Software">Softwares / Licenças</option>
                <option value="Outros">Despesas Gerais</option>
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despTipoCusto" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Tipo de custo</label>
              <FormSelect id="despTipoCusto" value={despTipoCusto} onChange={e => setDespTipoCusto(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                {tiposCusto.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despCentroCusto" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Centro de custo</label>
              <FormSelect id="despCentroCusto" value={despCentroCusto} onChange={e => setDespCentroCusto(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                {centrosCustoDisponiveis.map((centro) => <option key={centro} value={centro}>{centro}</option>)}
              </FormSelect>
            </div>
          </div>
          <div>
            <label htmlFor="despDescricao" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Descrição / Fornecedor</label>
            <input id="despDescricao" type="text" required value={despDescricao} onChange={e => setDespDescricao(e.target.value)} placeholder="Ex: Posto Ipiranga ou Boleto Internet" className={financeFieldClass} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label htmlFor="despFornecedor" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Fornecedor</label>
              <input id="despFornecedor" type="text" value={despFornecedor} onChange={e => setDespFornecedor(e.target.value)} placeholder="Ex: Cartorio, prefeitura, posto" className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="despNumeroDocumento" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Documento / comprovante</label>
              <input id="despNumeroDocumento" type="text" value={despNumeroDocumento} onChange={e => setDespNumeroDocumento(e.target.value)} placeholder="NF, recibo, guia ou protocolo" className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="despValor" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Valor (BRL)</label>
              <input id="despValor" type="number" step="0.01" required value={despValor} onChange={e => setDespValor(e.target.value)} placeholder="R$ 0,00" className={cn(financeFieldClass, 'text-lg font-bold text-brand-red-700')} />
            </div>
            <div>
              <label htmlFor="despData" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Data Vencimento</label>
              <DatePickerField id="despData" required value={despData} onChange={e => setDespData(e.target.value)} className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="despDataCompetencia" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Competencia</label>
              <DatePickerField id="despDataCompetencia" value={despDataCompetencia} onChange={e => setDespDataCompetencia(e.target.value)} className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="despDataPagamento" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Data de pagamento</label>
              <DatePickerField id="despDataPagamento" value={despDataPagamento} onChange={e => setDespDataPagamento(e.target.value)} className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="despFormaPagamento" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Forma de pagamento</label>
              <input id="despFormaPagamento" type="text" value={despFormaPagamento} onChange={e => setDespFormaPagamento(e.target.value)} placeholder="Pix, boleto, cartao, dinheiro" className={financeFieldClass} />
            </div>
            <div>
              <label htmlFor="despStatus" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Status</label>
              <FormSelect id="despStatus" value={despStatus} onChange={e => setDespStatus(e.target.value)} className={cn(financeFieldClass, 'appearance-none')}>
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Atrasado">Atrasado</option>
              </FormSelect>
            </div>
          </div>
          <CheckboxField id="financeiro-despesa-reembolsavel" label="Despesa reembolsável pelo cliente" checked={despReembolsavel} onChange={setDespReembolsavel} className="geo-card border-brand-green-200 bg-brand-green-50 px-3 text-brand-green-800 dark:border-brand-green-300/20 dark:bg-brand-green-400/10 dark:text-brand-green-100" />
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setShowDespesaModal(false)} className={cn(secondarySmallActionButtonClass, 'px-6 py-3 font-semibold')}>Cancelar</button>
            <button type="submit" className={cn(primarySubmitButtonClass, 'px-6 py-3')}>Salvar</button>
          </div>
        </form>
      </Modal>
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
          ? 'O orçamento financeiro e todas as parcelas vinculadas serão removidos. Os indicadores financeiros e a DRE serão recalculados. Esta ação não pode ser desfeita.'
          : 'A despesa será removida e os totais financeiros e indicadores da DRE serão recalculados. Os cadastros de cliente e projeto vinculados serão preservados. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'orcamento' ? 'Excluir orçamento' : 'Excluir despesa'}
        loading={deleteOrcamentoMutation.isPending || deleteDespesaMutation.isPending}
      />
    </Layout>
  );
}
