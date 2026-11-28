import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  ChartBar,
  CheckCircle,
  CurrencyDollar,
  DownloadSimple,
  FileText,
  Funnel,
  Plus,
  Receipt,
  SuitcaseRolling,
  TrendDown,
  TrendUp,
  WarningCircle,
  X
} from '@phosphor-icons/react';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { WidgetSection } from '../../components/WidgetSection';
import { DatePickerField } from '../../components/Form';
import { PopoverSurface } from '../../components/form-controls/PopoverSurface';
import { CustomSelect } from '../../components/CustomSelect';
import { ClientProfitabilityChart } from '../../components/charts/ClientProfitabilityChart';
import { prepareExpenseCategoryData } from '../../components/charts/chartBreakdowns';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { CashResultCurve } from '../../components/charts/CashResultCurve';
import { apiClient } from '../../services/apiClient';
import {
  buildFinancialAnalytics,
  cashBalancePresentation,
  formatCurrencyFromCents,
  type FinancialAnalytics
} from '../../utils/financialAnalytics';
import { chartActiveBar, chartActiveDot, chartResultLineZIndex, responsiveChartProps } from '../../utils/chartHelpers';
import { chartColors } from '../../data/chart-colors';
import { cn } from '../../utils/cn';
import { filterControlClass } from '../../utils/filterStyles';
import { headerPrimaryActionButtonClass } from '../../utils/actionStyles';
import { buildBudgetEditorPath } from '../Orcamentos/budgetNavigation';
import {
  localNavigationBarClass,
  localNavigationButtonClass,
  localNavigationIconClass,
  localNavigationItemsClass,
} from '../../utils/localNavigationStyles';
import { AuraAttentionWidget, AuraMediumMetric, AuraNumericValue, AuraReceivedWidget, AuraSmallBalance, AuraWidget } from '../../components/AuraWidget';
import './finance-aura.css';
import './finance-overview.css';
import { Faturas } from '../Faturas/Faturas';
import { Despesas } from '../Despesas/Despesas';
import { GestaoFinanceira } from './GestaoFinanceira';
import overviewTabIcon from '../../assets/magnific-icons/analysis_5706212.png';
import receivablesTabIcon from '../../assets/magnific-icons/crisis_6283991.png';
import payablesTabIcon from '../../assets/magnific-icons/dollar_9510014.png';
import travelAndInvoicesTabIcon from '../../assets/magnific-icons/travel_5595118.png';
import { APP_QUERY_KEYS } from '@geogestor/contracts';

type FinanceTab = 'visao' | 'faturas' | 'pagar' | 'auxiliares';
const financeTabIds: FinanceTab[] = ['visao', 'faturas', 'pagar', 'auxiliares'];
type PeriodKey = 'month' | '3m' | '6m' | '12m' | 'year' | 'custom';
type EmbeddedFinanceAction = {
  type: 'despesa' | 'parcela' | 'recebimento' | 'viagem' | 'fiscal';
  requestId: number;
};
type RecentFinancialEntry = {
  id: string;
  type: 'receita' | 'despesa';
  title: string;
  context: string;
  date: string;
  status: string;
  amount: number;
  tab: Extract<FinanceTab, 'faturas' | 'pagar'>;
};
type DraftFilters = {
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  categoria: string;
  tipoCusto: string;
  centroCusto: string;
};
type FinancialOverviewData = {
  analytics: Omit<FinancialAnalytics, 'orcamentos' | 'despesas' | 'parcelas'>;
  recentEntries: RecentFinancialEntry[];
  meta: {
    launchCount: number;
    expenseCount: number;
    hasSourceData: boolean;
    hasFilteredData: boolean;
    nextDueDate: string;
    openAccountCount: number;
  };
  options: {
    clientes: Array<{ id: string; nome: string }>;
    categorias: string[];
    tiposCusto: string[];
    centrosCusto: string[];
  };
};

const periodOptions: Array<{ label: string; value: PeriodKey }> = [
  { label: 'Este mês', value: 'month' },
  { label: 'Últimos 3 meses', value: '3m' },
  { label: 'Últimos 6 meses', value: '6m' },
  { label: 'Últimos 12 meses', value: '12m' },
  { label: 'Este ano', value: 'year' },
  { label: 'Período personalizado', value: 'custom' }
];
const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const compactAxisNumberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1
});

function formatCompactCurrencyAxisValue(value: number) {
  const normalizedValue = Number(value) || 0;
  const absoluteValue = Math.abs(normalizedValue);
  if (absoluteValue < 0.5) return '0';
  if (absoluteValue >= 1_000_000) return `${compactAxisNumberFormatter.format(normalizedValue / 1_000_000)}\u00a0mi`;
  if (absoluteValue >= 1_000) return `${compactAxisNumberFormatter.format(normalizedValue / 1_000)}\u00a0mil`;
  return compactAxisNumberFormatter.format(normalizedValue);
}

function buildCashFlowAxisScale(points: Array<{ Recebido: number; Despesas: number; 'Resultado mensal': number }>) {
  const values = points.flatMap((item) => [item.Recebido, item.Despesas, item['Resultado mensal']]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const targetStep = Math.max(1, maximum - minimum) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const normalizedStep = targetStep / magnitude;
  const niceMultiplier = [1, 1.5, 2, 2.5, 5, 10].find((candidate) => normalizedStep <= candidate) ?? 10;
  const step = niceMultiplier * magnitude;
  const domainMinimum = Math.floor(minimum / step) * step;
  const domainMaximum = Math.max(step, Math.ceil(maximum / step) * step);
  const tickCount = Math.round((domainMaximum - domainMinimum) / step) + 1;

  return {
    domain: [domainMinimum, domainMaximum] as [number, number],
    ticks: Array.from({ length: tickCount }, (_, index) => Number((domainMinimum + (index * step)).toPrecision(12)))
  };
}

const cashReceivedColor = `var(--finance-cash-received, ${chartColors.positive})`;
const cashExpensesColor = `var(--finance-cash-expenses, ${chartColors.negative})`;
const cashResultColor = `var(--finance-cash-result, ${chartColors.primary})`;
const cashResultOutline = 'var(--finance-cash-result-outline)';
const cashAxisColor = 'var(--finance-cash-axis)';

function CashFlowLegend() {
  return (
    <ul className="finance-aura-cash__legend">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cashReceivedColor }} />
        Recebido
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cashExpensesColor }} />
        Despesas
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-[3px] w-4 rounded-full" style={{ backgroundColor: cashResultColor }} />
        Resultado mensal
      </li>
    </ul>
  );
}

const dashboardCardClass = 'min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6';

function resolveTab(value: string | null): FinanceTab {
  return value === 'faturas' || value === 'pagar' || value === 'auxiliares' ? value : 'visao';
}

function resolvePeriod(value: string | null, hasCustomDates: boolean): PeriodKey {
  if (value === 'month' || value === '3m' || value === '6m' || value === '12m' || value === 'year' || value === 'custom') {
    return value;
  }
  return hasCustomDates ? 'custom' : '12m';
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getPeriodRange(period: PeriodKey) {
  const today = new Date();
  const end = toDateKey(today);
  if (period === 'custom') return { start: '', end: '' };
  if (period === 'year') return { start: toDateKey(new Date(today.getFullYear(), 0, 1)), end };
  const monthsBack = period === 'month' ? 0 : period === '3m' ? 2 : period === '6m' ? 5 : 11;
  return { start: toDateKey(new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)), end };
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function formatDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function financialStatusClass(status: string) {
  if (status === 'Pago') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
  if (status === 'Atrasado') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200';
  if (status === 'Parcialmente pago') return 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200';
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
}

const cashFlowPeriods = [
  { value: 'month', label: 'Mês' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' }
] as const;

function FinancialSkeleton() {
  return (
    <div aria-label="Carregando indicadores financeiros" aria-busy="true" className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[148px] animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 motion-reduce:animate-none" />
    </div>
  );
}

export function Financeiro() {
  const cashChartId = useId();
  const receivedPattern = `${cashChartId}-received`;
  const expensesPattern = `${cashChartId}-expenses`;
  const [cashTooltipAbovePlot, setCashTooltipAbovePlot] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));
  const focusedReceivableId = searchParams.get(APP_QUERY_KEYS.receivable) || undefined;
  const focusedPayableId = searchParams.get(APP_QUERY_KEYS.payable) || undefined;
  const initialExpenseProjectId = searchParams.get('projeto') || '';
  const initialFinanceClientId = searchParams.get('cliente') || '';
  const overviewEnabled = activeTab === 'visao';
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const actionPopupRef = useRef<HTMLDivElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [embeddedAction, setEmbeddedAction] = useState<EmbeddedFinanceAction | null>(() => (
    searchParams.get('acao') === 'despesa' || searchParams.get('acao') === 'parcela'
      ? { type: searchParams.get('acao') as 'despesa' | 'parcela', requestId: Date.now() }
      : null
  ));

  const dataInicio = searchParams.get('inicio') || '';
  const dataFim = searchParams.get('fim') || '';
  const clienteId = searchParams.get('cliente') || 'Todos';
  const categoria = searchParams.get('categoria') || 'Todas';
  const tipoCusto = searchParams.get('tipoCusto') || 'Todos';
  const centroCusto = searchParams.get('centroCusto') || 'Todos';
  const selectedPeriod = resolvePeriod(searchParams.get('periodo'), Boolean(dataInicio || dataFim));
  const periodRange = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod]);
  const effectiveDataInicio = selectedPeriod === 'custom' ? dataInicio : periodRange.start;
  const effectiveDataFim = selectedPeriod === 'custom' ? dataFim : periodRange.end;
  const [draftFilters, setDraftFilters] = useState<DraftFilters>({
    dataInicio,
    dataFim,
    clienteId,
    categoria,
    tipoCusto,
    centroCusto
  });

  const setActiveTab = (tab: FinanceTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'visao') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next);
  };

  const handleFinanceTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: FinanceTab) => {
    const currentIndex = financeTabIds.indexOf(tab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % financeTabIds.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + financeTabIds.length) % financeTabIds.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = financeTabIds.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = financeTabIds[nextIndex];
    setEmbeddedAction(null);
    setActiveTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`finance-tab-${nextTab}`)?.focus());
  };

  const clearFocusedRecord = (key: typeof APP_QUERY_KEYS.receivable | typeof APP_QUERY_KEYS.payable, receivableTab?: 'pendentes' | 'recebidas') => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    if (receivableTab) next.set('receberSituacao', receivableTab);
    setSearchParams(next, { replace: true });
  };

  const openEmbeddedAction = (type: EmbeddedFinanceAction['type']) => {
    setEmbeddedAction({ type, requestId: Date.now() });
    setActiveTab(type === 'despesa' ? 'pagar' : type === 'parcela' || type === 'recebimento' ? 'faturas' : 'auxiliares');
  };

  useEffect(() => {
    const action = searchParams.get('acao');
    if (action !== 'despesa' && action !== 'parcela') return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', action === 'despesa' ? 'pagar' : 'faturas');
    next.delete('acao');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!actionMenuOpen) return undefined;
    const dismiss = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node) && !actionPopupRef.current?.contains(event.target as Node)) setActionMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionMenuOpen(false);
        document.getElementById('finance-primary-action')?.focus();
      }
    };
    const frame = window.requestAnimationFrame(() => actionPopupRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [actionMenuOpen]);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [filtersOpen]);

  const overviewQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (effectiveDataInicio) params.set('inicio', effectiveDataInicio);
    if (effectiveDataFim) params.set('fim', effectiveDataFim);
    if (clienteId !== 'Todos') params.set('clienteId', clienteId);
    if (categoria !== 'Todas') params.set('categoria', categoria);
    if (tipoCusto !== 'Todos') params.set('tipoCusto', tipoCusto);
    if (centroCusto !== 'Todos') params.set('centroCusto', centroCusto);
    return params.toString();
  }, [categoria, centroCusto, clienteId, effectiveDataFim, effectiveDataInicio, tipoCusto]);
  const overviewQuery = useQuery<FinancialOverviewData>({
    queryKey: ['financeiro-overview', overviewQueryString],
    queryFn: () => apiClient.get(`/api/financeiro/overview${overviewQueryString ? `?${overviewQueryString}` : ''}`),
    enabled: overviewEnabled
  });
  const emptyAnalytics = useMemo(() => buildFinancialAnalytics({ orcamentos: [], despesas: [], parcelas: [] }), []);
  const analytics: FinancialAnalytics = overviewQuery.data?.analytics
    ? { ...overviewQuery.data.analytics, orcamentos: [], despesas: [], parcelas: [] }
    : emptyAnalytics;
  const clientes = overviewQuery.data?.options.clientes ?? [];

  const loading = overviewEnabled && overviewQuery.isLoading;
  const failed = overviewEnabled && overviewQuery.isError;

  const categories = overviewQuery.data?.options.categorias ?? [];
  const costTypes = overviewQuery.data?.options.tiposCusto ?? [];
  const costCenters = overviewQuery.data?.options.centrosCusto ?? [];

  const periodLabel = periodOptions.find((option) => option.value === selectedPeriod)?.label || 'Últimos 12 meses';
  const hasAdvancedFilters = Boolean(
    dataInicio ||
    dataFim ||
    clienteId !== 'Todos' ||
    categoria !== 'Todas' ||
    tipoCusto !== 'Todos' ||
    centroCusto !== 'Todos'
  );
  const hasFilters = selectedPeriod !== '12m' || hasAdvancedFilters;
  const activeFilterCount = [
    clienteId !== 'Todos',
    categoria !== 'Todas',
    tipoCusto !== 'Todos',
    centroCusto !== 'Todos',
    selectedPeriod === 'custom' && Boolean(dataInicio || dataFim)
  ].filter(Boolean).length;

  const openFilters = () => {
    setDraftFilters({ dataInicio, dataFim, clienteId, categoria, tipoCusto, centroCusto });
    setFiltersOpen(true);
  };

  const updatePeriod = (period: PeriodKey) => {
    if (period === 'custom') {
      openFilters();
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (period === '12m') next.delete('periodo');
    else next.set('periodo', period);
    next.delete('inicio');
    next.delete('fim');
    setSearchParams(next);
  };

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams);
    const entries: Array<[string, string, string]> = [
      ['cliente', draftFilters.clienteId, 'Todos'],
      ['categoria', draftFilters.categoria, 'Todas'],
      ['tipoCusto', draftFilters.tipoCusto, 'Todos'],
      ['centroCusto', draftFilters.centroCusto, 'Todos']
    ];
    entries.forEach(([key, value, defaultValue]) => {
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
    });
    if (draftFilters.dataInicio) next.set('inicio', draftFilters.dataInicio);
    else next.delete('inicio');
    if (draftFilters.dataFim) next.set('fim', draftFilters.dataFim);
    else next.delete('fim');
    if (draftFilters.dataInicio || draftFilters.dataFim) next.set('periodo', 'custom');
    else if (selectedPeriod === 'custom') next.delete('periodo');
    setSearchParams(next);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['periodo', 'inicio', 'fim', 'cliente', 'categoria', 'tipoCusto', 'centroCusto'].forEach((key) => next.delete(key));
    setSearchParams(next);
    setDraftFilters({
      dataInicio: '',
      dataFim: '',
      clienteId: 'Todos',
      categoria: 'Todas',
      tipoCusto: 'Todos',
      centroCusto: 'Todos'
    });
  };

  const removeFilter = (key: 'dates' | 'cliente' | 'categoria' | 'tipoCusto' | 'centroCusto') => {
    const next = new URLSearchParams(searchParams);
    if (key === 'dates') {
      next.delete('inicio');
      next.delete('fim');
      next.delete('periodo');
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const monthlyData = analytics.monthly
    .filter((item) => {
      if (!effectiveDataInicio && !effectiveDataFim) return true;
      return (!effectiveDataInicio || item.mes >= monthKey(effectiveDataInicio)) &&
        (!effectiveDataFim || item.mes <= monthKey(effectiveDataFim));
    })
    .map((item) => ({
      name: item.label,
      Recebido: item.receitaRecebida / 100,
      Despesas: item.despesasPagas / 100,
      'Resultado mensal': item.resultadoCaixa / 100
    }));
  const cashFlowAxisScale = buildCashFlowAxisScale(monthlyData);
  const cashBalance = cashBalancePresentation(analytics.kpis.resultadoCaixa);
  const hasChartData = monthlyData.some((item) => item.Recebido !== 0 || item.Despesas !== 0);
  const expenseBreakdown = prepareExpenseCategoryData(analytics.categorias.map((item) => ({
    name: item.categoria, value: item.total, count: item.count
  })));
  const expenseCategorySummary = expenseBreakdown.length <= 3 ? expenseBreakdown : [
    ...expenseBreakdown.slice(0, 2),
    expenseBreakdown.slice(2).reduce(
      (total, item) => ({ ...total, value: total.value + item.value, percentage: total.percentage + item.percentage }),
      { name: 'Outras categorias', value: 0, percentage: 0 }
    )
  ];
  const launchCount = overviewQuery.data?.meta.launchCount ?? 0;
  const expenseCount = overviewQuery.data?.meta.expenseCount ?? 0;
  const hasSourceData = overviewQuery.data?.meta.hasSourceData ?? false;
  const hasFilteredData = overviewQuery.data?.meta.hasFilteredData ?? false;
  const recentEntries = overviewQuery.data?.recentEntries ?? [];
  const nextDueDate = overviewQuery.data?.meta.nextDueDate ?? '';
  const openAccountCount = overviewQuery.data?.meta.openAccountCount ?? 0;

  const exportOverview = () => {
    const header = ['Período', 'Recebido', 'Despesas', 'Resultado'];
    const rows = monthlyData.map((item) => [
      item.name,
      item.Recebido.toFixed(2).replace('.', ','),
      item.Despesas.toFixed(2).replace('.', ','),
      item['Resultado mensal'].toFixed(2).replace('.', ',')
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fluxo-caixa-${toDateKey(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const attentionItems = [
    ...analytics.alertas,
    ...(analytics.kpis.resultadoCaixa < 0 && !analytics.alertas.some((item) => item.titulo === 'Resultado de caixa negativo')
      ? [{
          tipo: 'critico' as const,
          titulo: 'Resultado de caixa negativo',
          descricao: `As despesas superaram os recebimentos em ${formatCurrencyFromCents(Math.abs(analytics.kpis.resultadoCaixa))} no período.`
        }]
      : [])
  ];
  const attentionPriority = { critico: 0, atencao: 1, info: 2 } as const;
  const orderedAttentionItems = [...attentionItems].sort((a, b) => attentionPriority[a.tipo] - attentionPriority[b.tipo]);
  const priorityAttention = orderedAttentionItems[0];

  const attentionAction = (title: string) => {
    const normalizedTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalizedTitle.includes('recebimento')) return { label: 'Ver contas a receber', action: () => setActiveTab('faturas') };
    if (normalizedTitle.includes('orcamento')) return { label: 'Revisar orçamentos', action: () => navigate('/orcamentos') };
    return { label: normalizedTitle.includes('sem cliente') ? 'Revisar lançamentos' : 'Ver contas a pagar', action: () => setActiveTab('pagar') };
  };
  const priorityAttentionAction = priorityAttention ? attentionAction(priorityAttention.titulo) : null;

  const openFirstLaunch = () => {
    setActionMenuOpen(true);
    window.requestAnimationFrame(() => document.getElementById('finance-primary-action')?.focus());
  };

  return (
    <Layout>
      <PageHeader
        eyebrow="Gestão financeira"
        title="Financeiro"
        description="Acompanhe receitas, despesas, vencimentos e o resultado financeiro dos seus projetos."
        action={
          <div ref={actionMenuRef} className="relative shrink-0">
          <button
            id="finance-primary-action"
            ref={actionTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={actionMenuOpen}
            aria-controls="finance-new-entry-menu"
            onClick={() => setActionMenuOpen((current) => !current)}
            className={cn(headerPrimaryActionButtonClass, 'w-full justify-center sm:w-auto')}
          >
            <Plus aria-hidden="true" size={18} weight="bold" />
            <span>Novo lançamento</span>
            <CaretDown aria-hidden="true" size={15} weight="bold" className={cn('transition-transform duration-150 motion-reduce:transition-none', actionMenuOpen && 'rotate-180')} />
          </button>
          {actionMenuOpen && (
            <PopoverSurface open anchorRef={actionTriggerRef} minWidth={352} maxWidth={352} maxHeight={360} className="overflow-y-auto rounded-2xl p-2 shadow-xl shadow-zinc-950/10">
            <div
              ref={actionPopupRef}
              id="finance-new-entry-menu"
              role="menu"
              aria-label="Novo lançamento"
              onBlur={event => { if (!actionMenuRef.current?.contains(event.relatedTarget as Node | null) && !actionPopupRef.current?.contains(event.relatedTarget as Node | null)) setActionMenuOpen(false); }}
              onKeyDown={event => {
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
                const current = items.indexOf(document.activeElement as HTMLButtonElement);
                let next: number | null = null;
                if (event.key === 'ArrowDown') next = (current + 1) % items.length;
                if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = items.length - 1;
                if (next !== null) { event.preventDefault(); items[next]?.focus(); }
              }}
              className="min-w-0"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuOpen(false);
                  navigate(buildBudgetEditorPath({ returnTo: `/financeiro${searchParams.size ? `?${searchParams}` : ''}`, clientId: initialFinanceClientId }));
                }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"><CurrencyDollar aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Novo orçamento</span><span className="block text-xs text-zinc-500">Criar proposta e definir condições de pagamento</span></span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setActionMenuOpen(false); openEmbeddedAction('recebimento'); }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Registrar recebimento</span><span className="block text-xs text-zinc-500">Selecionar uma conta a receber existente</span></span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuOpen(false);
                  openEmbeddedAction('despesa');
                }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"><Receipt aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Nova despesa</span><span className="block truncate text-xs text-zinc-500">Registrar custo, pagamento ou reembolso</span></span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuOpen(false);
                  openEmbeddedAction('viagem');
                }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200"><SuitcaseRolling aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Nova viagem</span><span className="block truncate text-xs text-zinc-500">Registrar deslocamento e prestação de contas</span></span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuOpen(false);
                  openEmbeddedAction('fiscal');
                }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200"><FileText aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Informar documento fiscal</span><span className="block truncate text-xs text-zinc-500">Vincular nota fiscal ao cliente ou projeto</span></span>
              </button>
            </div>
            </PopoverSurface>
          )}
          </div>
        }
      />

      <nav aria-label="Áreas do Financeiro" className={cn(localNavigationBarClass, 'mb-7')}>
        <div role="tablist" className={localNavigationItemsClass}>
          {([
            ['visao', 'Visão geral', overviewTabIcon, 'system'],
            ['faturas', 'Contas a receber', receivablesTabIcon, 'finance'],
            ['pagar', 'Contas a pagar', payablesTabIcon, 'warning'],
            ['auxiliares', 'Viagens e notas fiscais', travelAndInvoicesTabIcon, 'field']
          ] as const).map(([id, label, icon, tone]) => (
            <button
              key={id}
              id={`finance-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`finance-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onKeyDown={(event) => handleFinanceTabKeyDown(event, id)}
              onClick={() => {
                setEmbeddedAction(null);
                setActiveTab(id);
              }}
              className={localNavigationButtonClass(activeTab === id, tone)}
            >
              <span
                aria-hidden="true"
                className={localNavigationIconClass(activeTab === id, tone, 'overflow-hidden bg-transparent p-0 dark:bg-transparent')}
              >
                <img src={icon} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'visao' && (
        <section id="finance-panel-visao" role="tabpanel" aria-labelledby={`finance-tab-${activeTab}`} tabIndex={0}>
          {(loading || failed || hasSourceData) && (
            <section aria-label="Período e filtros financeiros" className="relative mb-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm sm:w-fit sm:max-w-full dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-[280px]">
                  <CalendarBlank aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-400" />
                  <CustomSelect
                    ariaLabel="Selecionar período financeiro"
                    placeholder="Selecionar período"
                    value={selectedPeriod}
                    onChange={(value) => updatePeriod(value as PeriodKey)}
                    options={periodOptions}
                    className="min-w-0 flex-1"
                    buttonClassName="min-h-10"
                  />
                </div>
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  aria-controls="financial-filter-panel"
                  onClick={openFilters}
                  className="geo-button-base geo-button-secondary geo-focus-ring inline-flex min-h-10 items-center gap-2 px-3 text-sm"
                >
                  <Funnel aria-hidden="true" size={16} weight="bold" />
                  Filtros
                  {activeFilterCount > 0 && <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-950">{activeFilterCount}</span>}
                </button>
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="geo-focus-ring min-h-10 rounded-xl px-3 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white">
                    Limpar
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={exportOverview}
                disabled={!hasChartData}
                className="geo-button-base geo-button-secondary geo-focus-ring inline-flex min-h-10 items-center justify-center gap-2 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                <DownloadSimple aria-hidden="true" size={17} />
                Exportar
              </button>
            </div>

            {hasAdvancedFilters && (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtros ativos">
                {selectedPeriod === 'custom' && (dataInicio || dataFim) && (
                  <button type="button" onClick={() => removeFilter('dates')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    Período: {dataInicio ? formatDate(dataInicio) : 'início'}–{dataFim ? formatDate(dataFim) : 'hoje'} <X aria-hidden="true" size={13} />
                  </button>
                )}
                {clienteId !== 'Todos' && (
                  <button type="button" onClick={() => removeFilter('cliente')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    Cliente: {clientes.find((item) => item.id === clienteId)?.nome || 'Selecionado'} <X aria-hidden="true" size={13} />
                  </button>
                )}
                {categoria !== 'Todas' && (
                  <button type="button" onClick={() => removeFilter('categoria')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    Categoria: {categoria} <X aria-hidden="true" size={13} />
                  </button>
                )}
                {tipoCusto !== 'Todos' && (
                  <button type="button" onClick={() => removeFilter('tipoCusto')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    Tipo: {tipoCusto} <X aria-hidden="true" size={13} />
                  </button>
                )}
                {centroCusto !== 'Todos' && (
                  <button type="button" onClick={() => removeFilter('centroCusto')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    Centro: {centroCusto} <X aria-hidden="true" size={13} />
                  </button>
                )}
              </div>
            )}

            <p aria-live="polite" className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Exibindo {countLabel(launchCount, 'lançamento', 'lançamentos')} e {countLabel(expenseCount, 'despesa', 'despesas')} no período selecionado.
            </p>

            {filtersOpen && (
              <>
                <button type="button" aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} className="fixed inset-0 z-30 bg-zinc-950/50 backdrop-blur-[2px] md:hidden" />
                <div
                  id="financial-filter-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="financial-filter-title"
                  className="fixed inset-x-3 bottom-3 top-16 z-40 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 md:static md:mt-4 md:max-h-none md:overflow-visible md:shadow-sm"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 id="financial-filter-title" className="text-base font-semibold text-zinc-950 dark:text-white">Refinar análise</h2>
                      <p className="mt-1 text-sm text-zinc-500">Combine período, cliente e classificação financeira.</p>
                    </div>
                    <button type="button" aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} className="geo-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <X aria-hidden="true" size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      <span>Data inicial</span>
                      <DatePickerField name="inicio" value={draftFilters.dataInicio} onChange={(event) => setDraftFilters((current) => ({ ...current, dataInicio: event.target.value }))} className={cn(filterControlClass, 'w-full')} />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      <span>Data final</span>
                      <DatePickerField name="fim" value={draftFilters.dataFim} onChange={(event) => setDraftFilters((current) => ({ ...current, dataFim: event.target.value }))} className={cn(filterControlClass, 'w-full')} />
                    </label>
                    <div className="space-y-1.5">
                      <label htmlFor="financial-client-filter" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Cliente</label>
                      <CustomSelect id="financial-client-filter" name="cliente" ariaLabel="Filtrar por cliente" placeholder="Todos os clientes" value={draftFilters.clienteId} onChange={(value) => setDraftFilters((current) => ({ ...current, clienteId: value }))} options={[{ label: 'Todos os clientes', value: 'Todos' }, ...clientes.map((item) => ({ label: item.nome, value: item.id }))]} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="financial-category-filter" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Categoria</label>
                      <CustomSelect id="financial-category-filter" name="categoria" ariaLabel="Filtrar por categoria" placeholder="Todas as categorias" value={draftFilters.categoria} onChange={(value) => setDraftFilters((current) => ({ ...current, categoria: value }))} options={[{ label: 'Todas as categorias', value: 'Todas' }, ...categories.map((value) => ({ label: value, value }))]} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="financial-cost-type-filter" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Tipo de custo</label>
                      <CustomSelect id="financial-cost-type-filter" name="tipoCusto" ariaLabel="Filtrar por tipo de custo" placeholder="Todos os tipos" value={draftFilters.tipoCusto} onChange={(value) => setDraftFilters((current) => ({ ...current, tipoCusto: value }))} options={[{ label: 'Todos os tipos', value: 'Todos' }, ...costTypes.map((value) => ({ label: value, value }))]} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="financial-cost-center-filter" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Centro de custo</label>
                      <CustomSelect id="financial-cost-center-filter" name="centroCusto" ariaLabel="Filtrar por centro de custo" placeholder="Todos os centros" value={draftFilters.centroCusto} onChange={(value) => setDraftFilters((current) => ({ ...current, centroCusto: value }))} options={[{ label: 'Todos os centros', value: 'Todos' }, ...costCenters.map((value) => ({ label: value, value }))]} />
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setDraftFilters({ dataInicio: '', dataFim: '', clienteId: 'Todos', categoria: 'Todas', tipoCusto: 'Todos', centroCusto: 'Todos' })} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-sm">
                      Limpar filtros
                    </button>
                    <button type="button" onClick={applyFilters} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 text-sm">
                      Aplicar filtros
                    </button>
                  </div>
                </div>
              </>
            )}
            </section>
          )}

          {loading ? (
            <FinancialSkeleton />
          ) : failed ? (
            <section role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
              <h2 className="text-lg font-semibold">Dados financeiros indisponíveis</h2>
              <p className="mt-2 text-sm">Nenhum saldo foi substituído por zero. Restabeleça a conexão local e tente novamente.</p>
            </section>
          ) : !hasSourceData ? (
            <AuraWidget tone="violet" className="px-6 py-12 text-center sm:px-10 sm:py-16" aria-labelledby="financial-first-use-title">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20">
                <ChartBar aria-hidden="true" size={28} weight="duotone" />
              </span>
              <h2 id="financial-first-use-title" className="mt-5 text-xl font-semibold">
                Comece pelo primeiro lançamento
              </h2>
              <p className="aura-widget__muted mx-auto mt-2 max-w-xl text-sm leading-6">
                Registre uma receita ou despesa. Depois disso, o GeoGestor apresentará fluxo de caixa, pendências, rentabilidade por cliente e despesas por categoria.
              </p>
              <button type="button" onClick={openFirstLaunch} className="geo-button-base geo-button-primary geo-focus-ring mt-6 min-h-11 px-5 text-sm">
                <Plus aria-hidden="true" size={17} />
                Criar primeiro lançamento
              </button>
            </AuraWidget>
          ) : !hasFilteredData ? (
            <section className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700" aria-labelledby="financial-filter-empty-title">
              <Receipt aria-hidden="true" size={30} className="mx-auto text-zinc-400" />
              <h2 id="financial-filter-empty-title" className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">
                Nenhum lançamento neste período
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Existem dados financeiros, mas nenhum corresponde ao período e aos filtros selecionados.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-sm">
                    Limpar filtros
                  </button>
                )}
                <button type="button" onClick={openFirstLaunch} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 text-sm">
                  <Plus aria-hidden="true" size={17} />
                  Novo lançamento
                </button>
              </div>
            </section>
          ) : (
            <div className="finance-overview">
              <WidgetSection id="finance-priority-title" title="Resultado e pendências" className="finance-overview-panel" contentClassName="finance-overview-priority-grid">
                <AuraSmallBalance
                  className="finance-aura-metric"
                  label="Resultado de caixa"
                  value={analytics.kpis.resultadoCaixa}
                  currency
                  status={cashBalance}
                  detail={cashBalance.detail}
                  icon={<ChartBar size={17} />}
                />
                <div className="min-w-0">
                  <AuraAttentionWidget
                    as="section"
                    headingId="financial-alerts-title"
                    className="finance-aura-attention"
                    label="Pendências"
                    value={<AuraNumericValue value={orderedAttentionItems.length} />}
                    detail={priorityAttention?.titulo ?? 'Tudo em dia.'}
                    action={priorityAttentionAction && <button type="button" onClick={priorityAttentionAction.action} className="aura-attention__action geo-focus-ring">
                      {priorityAttentionAction.label} <ArrowRight aria-hidden="true" size={13} />
                    </button>}
                  />
                  {priorityAttention && (
                    <details className="mt-2 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <summary className="geo-focus-ring cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        {orderedAttentionItems.length === 1 ? 'Ver detalhes da pendência' : 'Ver todas as pendências'}
                      </summary>
                      <ul className="divide-y divide-zinc-200 px-3 dark:divide-zinc-700">
                        {orderedAttentionItems.map((alerta) => {
                          const action = attentionAction(alerta.titulo);
                          return (
                            <li key={`${alerta.tipo}-${alerta.titulo}`} className="flex min-w-0 gap-2 py-3">
                              <WarningCircle aria-hidden="true" size={17} weight="fill" className={cn('mt-0.5 shrink-0', alerta.tipo === 'critico' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-200')} />
                              <div className="min-w-0 [overflow-wrap:anywhere]">
                                <p className="text-sm font-semibold">{alerta.titulo}</p>
                                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{alerta.descricao}</p>
                                <button type="button" onClick={action.action} className="geo-focus-ring mt-1 inline-flex min-h-8 items-center gap-1 rounded-md text-left text-xs font-semibold hover:underline">
                                  <span>{action.label}</span> <ArrowRight aria-hidden="true" size={13} className="shrink-0" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                </div>
              </WidgetSection>

              <WidgetSection id="finance-movements-title" title="Movimentações" className="finance-overview-panel" contentClassName="min-w-0">
                <section aria-labelledby="recent-financial-title" className="min-w-0">
                  <h3 id="recent-financial-title" className="mb-3 text-base font-semibold">Últimos lançamentos</h3>
                  {recentEntries.length > 0 ? (
                    <ul className="finance-overview-movement-grid">
                      {recentEntries.map((entry) => (
                        <li key={entry.id} className="min-w-0">
                          <AuraWidget tone="plum" size="medium" as="article" className={cn("finance-aura-recent", `finance-overview-entry--${entry.type}`)}>
                            <h4>{entry.type === 'receita' ? 'Receita' : 'Despesa'}</h4>
                            <button type="button" onClick={() => setActiveTab(entry.tab)} className="finance-aura-entry finance-aura-action geo-focus-ring">
                              <span className="finance-aura-entry__main">
                                <span className="finance-aura-entry__icon" aria-hidden="true">
                                  {entry.type === 'receita' ? <TrendUp size={20} /> : <TrendDown size={20} />}
                                </span>
                                <span className="finance-aura-entry__description">
                                  <span className="font-semibold">{entry.title}</span>
                                  <span className="aura-widget__muted text-xs">{entry.context}</span>
                                </span>
                                <span className="finance-aura-entry__amount">
                                  {entry.type === 'receita' ? '+' : '−'} {formatCurrencyFromCents(entry.amount)}
                                </span>
                              </span>
                              <span className="finance-aura-entry__foot">
                                {entry.date ? <time dateTime={entry.date}>{formatDate(entry.date)}</time> : <span>Sem data</span>}
                                <span className={cn('rounded-full px-2 py-0.5 font-semibold', financialStatusClass(entry.status))}>{entry.status}</span>
                              </span>
                            </button>
                          </AuraWidget>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <AuraWidget tone="plum" className="finance-aura-recent">
                      <p className="aura-widget__muted py-4 text-center text-sm">Nenhum lançamento recente neste recorte.</p>
                    </AuraWidget>
                  )}
                  <div className="finance-overview-movement-actions">
                    <button type="button" onClick={() => setActiveTab('faturas')} className="geo-button-base geo-button-secondary geo-focus-ring min-h-8 px-2.5 text-xs">Ver recebimentos</button>
                    <button type="button" onClick={() => setActiveTab('pagar')} className="geo-button-base geo-button-secondary geo-focus-ring min-h-8 px-2.5 text-xs">Ver despesas</button>
                  </div>
                </section>
              </WidgetSection>

              <div className="finance-overview-indicators">
                <details className="group rounded-xl border border-brand-border">
                  <summary className="geo-focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-base font-semibold text-text-primary hover:bg-brand-surface-subtle [&::-webkit-details-marker]:hidden">
                    Indicadores complementares
                    <CaretDown aria-hidden="true" size={16} className="shrink-0 group-open:rotate-180" />
                  </summary>
                  <div className="finance-overview-indicator-grid">
                    <AuraReceivedWidget
                      className="finance-aura-metric"
                      value={analytics.kpis.receitaRecebida}
                      context={periodLabel}
                      action={{ label: 'Ver recebimentos', onClick: () => setActiveTab('faturas') }}
                    />
                    <AuraSmallBalance
                      className="finance-aura-metric"
                      label="A receber"
                      value={analytics.kpis.receitaPendente}
                      currency
                      context={countLabel(analytics.kpis.contasReceberCount, 'conta em aberto', 'contas em aberto')}
                      icon={<TrendUp size={17} />}
                    />
                    <AuraMediumMetric
                      className="finance-aura-metric"
                      label="Despesas pagas"
                      value={analytics.kpis.despesasPagas}
                      currency
                      context={countLabel(expenseCount, 'despesa no período', 'despesas no período')}
                      icon={<TrendDown size={17} />}
                    />
                  </div>
                </details>
              </div>

              <WidgetSection id="finance-cash-section-title" title="Evolução" className="finance-overview-panel" contentClassName="min-w-0">
                <AuraWidget tone="violet" size="large" aria-labelledby="cash-flow-title" aria-describedby={hasChartData ? 'cash-flow-description' : undefined} className="finance-aura-cash">
                  <div className="finance-aura-heading finance-aura-cash__heading">
                    <h3 id="cash-flow-title">Evolução do fluxo de caixa</h3>
                    <button type="button" className="finance-aura-plus geo-focus-ring" aria-label="Novo lançamento pelo fluxo de caixa" onClick={openFirstLaunch}>
                      <Plus aria-hidden="true" size={18} />
                    </button>
                  </div>
                  <div className="finance-aura-periods" role="group" aria-label="Períodos rápidos do fluxo de caixa">
                    {cashFlowPeriods.map(({ value, label }) => (
                      <button key={value} type="button" className="geo-focus-ring" aria-pressed={selectedPeriod === value} onClick={() => updatePeriod(value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="finance-aura-cash__reading">
                    <p className="aura-widget__muted text-xs font-medium">Resultado de caixa · {periodLabel}</p>
                    <AuraNumericValue value={analytics.kpis.resultadoCaixa} currency />
                  </div>
                  {hasChartData ? (
                    <>
                      <div className="finance-aura-plot flex w-full min-w-0 flex-col" aria-hidden="true">
                        <p className="aura-widget__muted shrink-0 text-[10px] font-medium leading-3">Valores em <span translate="no">R$</span></p>
                        <div className="min-h-0 min-w-0 flex-1">
                          <ResponsiveContainer {...responsiveChartProps} onResize={(width) => setCashTooltipAbovePlot(width < 700)}>
                            <ComposedChart accessibilityLayer={false} data={monthlyData} margin={{ top: 9, right: 8, left: 0, bottom: 0 }}>
                              <defs>
                                {[[receivedPattern, cashReceivedColor], [expensesPattern, cashExpensesColor]].map(([id, fill]) => (
                                  <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="3.65" height="1">
                                    <rect width="3.65" height="1" fill={fill} />
                                    <rect width="1.83" height="1" fill="#fff" fillOpacity="var(--finance-cash-stripe-opacity, 0)" />
                                  </pattern>
                                ))}
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--finance-cash-grid)" />
                              <ReferenceLine y={0} stroke={cashAxisColor} strokeWidth={1.5} />
                              <XAxis dataKey="name" height={22} axisLine={cashFlowAxisScale.domain[0] < 0 && { stroke: cashAxisColor }} tickLine={false} tick={{ fill: 'var(--aura-muted)', fontSize: 11 }} minTickGap={14} />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--aura-muted)', fontSize: 11 }}
                                tickFormatter={formatCompactCurrencyAxisValue}
                                width={53}
                                domain={cashFlowAxisScale.domain}
                                ticks={cashFlowAxisScale.ticks}
                                padding={{ top: 6, bottom: 6 }}
                                allowDataOverflow
                                interval={0}
                              />
                              <Tooltip
                                cursor={{ stroke: cashAxisColor, strokeWidth: 2 }}
                                offset={{ x: 60, y: 10 }}
                                isAnimationActive={false}
                                position={cashTooltipAbovePlot ? { x: 0, y: -6 } : undefined}
                                wrapperStyle={cashTooltipAbovePlot ? { translate: '0 -100%' } : undefined}
                                content={<RichTooltip format="currency" className={cashTooltipAbovePlot ? 'max-w-[calc(100vw-5.5rem)]' : undefined} />}
                              />
                              {/* Keep both series types on the current scales during resizing and period changes. */}
                              <Bar
                                dataKey="Recebido"
                                fill={cashReceivedColor}
                                shape={{ fill: `url(#${receivedPattern})` }}
                                radius={[6, 6, 0, 0]}
                                maxBarSize={36}
                                activeBar={{ ...chartActiveBar(cashReceivedColor), fill: `url(#${receivedPattern})` }}
                                isAnimationActive={false}
                              />
                              <Bar
                                dataKey="Despesas"
                                fill={cashExpensesColor}
                                shape={{ fill: `url(#${expensesPattern})` }}
                                radius={[6, 6, 0, 0]}
                                maxBarSize={36}
                                activeBar={{ ...chartActiveBar(cashExpensesColor), fill: `url(#${expensesPattern})` }}
                                isAnimationActive={false}
                              />
                              <Line
                                type="linear"
                                dataKey="Resultado mensal"
                                zIndex={chartResultLineZIndex}
                                stroke={cashResultColor}
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                shape={(curve) => <CashResultCurve {...curve} outline={cashResultOutline} />}
                                dot={{ r: 3, fill: cashResultColor, stroke: cashResultOutline, strokeWidth: 1.5, clipDot: true }}
                                activeDot={chartActiveDot(cashResultColor)}
                                isAnimationActive={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="mt-1" aria-hidden="true">
                        <CashFlowLegend />
                      </div>
                      <p id="cash-flow-description" className="aura-widget__muted text-center text-xs">
                        A linha mostra o resultado mensal, calculado pelo valor recebido menos as despesas pagas.
                      </p>
                      <table className="sr-only">
                        <caption>Fluxo de caixa mensal em reais para o período {periodLabel}.</caption>
                        <thead>
                          <tr>
                            <th scope="col">Mês</th>
                            <th scope="col">Recebido</th>
                            <th scope="col">Despesas</th>
                            <th scope="col">Resultado mensal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyData.map((item) => (
                            <tr key={item.name}>
                              <th scope="row">{item.name}</th>
                              <td>{formatCurrencyFromCents(Math.round(item.Recebido * 100))}</td>
                              <td>{formatCurrencyFromCents(Math.round(item.Despesas * 100))}</td>
                              <td>{formatCurrencyFromCents(Math.round(item['Resultado mensal'] * 100))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="aura-widget__well flex min-h-72 flex-col items-center justify-center px-6 py-5 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"><Receipt aria-hidden="true" size={24} /></span>
                      <p className="mt-4 font-semibold">Ainda não existem lançamentos neste período</p>
                      <p className="aura-widget__muted mt-1 max-w-md text-sm leading-6">Registre uma receita ou despesa para acompanhar a evolução do caixa.</p>
                      <button type="button" onClick={openFirstLaunch} className="geo-button-base geo-button-primary geo-focus-ring mt-5 min-h-11 px-5 text-sm">
                        <Plus aria-hidden="true" size={17} /> Criar primeiro lançamento
                      </button>
                    </div>
                  )}
                </AuraWidget>
              </WidgetSection>

              <WidgetSection id="finance-analysis-section-title" title="Análises" className="finance-overview-panel" contentClassName="grid gap-3">
                <details className="group rounded-xl border border-brand-border">
                  <summary className="geo-focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-base font-semibold text-text-primary hover:bg-brand-surface-subtle [&::-webkit-details-marker]:hidden">
                    Despesas por categoria
                    <CaretDown aria-hidden="true" size={16} className="shrink-0 group-open:rotate-180" />
                  </summary>
                  <div className="min-w-0 p-3 finance-overview-analysis">
                    <AuraWidget tone="magenta" size="medium" aria-labelledby="expense-category-title" className="finance-aura-categories">
                      <div className="finance-aura-heading">
                        <h3 id="expense-category-title">Despesas por categoria</h3>
                      </div>
                      {expenseCategorySummary.length > 0 ? (
                        <>
                          <div className="finance-aura-category-strip" aria-hidden="true">
                            {expenseCategorySummary.map((item, index) => (
                              <span key={index} data-category-color={index} title={item.name} style={{ flex: item.percentage }} />
                            ))}
                          </div>
                          <ul className="finance-overview-category-legend">
                            {expenseCategorySummary.map((item, index) => (
                              <li key={index} data-category-color={index} tabIndex={0}>
                                {item.name}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="aura-widget__muted text-sm">Nenhuma despesa paga neste recorte.</p>
                      )}
                      <button type="button" className="finance-aura-cta geo-focus-ring w-full" onClick={() => setActiveTab('pagar')}>Ver despesas</button>
                    </AuraWidget>
                    {expenseBreakdown.length > 0 && (
                      <section className="finance-overview-category-breakdown" aria-labelledby="finance-category-breakdown-title">
                        <h3 id="finance-category-breakdown-title">Detalhamento por categoria</h3>
                        {expenseBreakdown.length > expenseCategorySummary.length && (
                          <p className="text-xs text-text-secondary">As linhas em azul compõem o segmento Outras categorias.</p>
                        )}
                        <dl className="finance-overview-category-details">
                          {expenseBreakdown.map((item, index) => (
                            <div key={item.name} data-category-color={Math.min(index, expenseCategorySummary.length - 1)} tabIndex={0}>
                              <dt className="text-sm font-medium">{item.name}</dt>
                              <dd className="text-sm tabular-nums">{formatCurrencyFromCents(item.value)}</dd>
                              <dd className="text-xs text-zinc-600 dark:text-zinc-300">{percentageFormatter.format(item.percentage)}% do total · {countLabel(item.count ?? 0, 'lançamento', 'lançamentos')}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}
                  </div>
                </details>
                <details className="group rounded-xl border border-brand-border">
                  <summary className="geo-focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-base font-semibold text-text-primary hover:bg-brand-surface-subtle [&::-webkit-details-marker]:hidden">
                    Rentabilidade e resumo financeiro
                    <CaretDown aria-hidden="true" size={16} className="shrink-0 group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
                    <section aria-labelledby="client-profit-title" className={cn(dashboardCardClass, 'xl:col-span-8')}>
                      <h3 id="client-profit-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Rentabilidade por cliente</h3>
                      <p className="mt-1 text-sm text-text-secondary">Cinco maiores resultados realizados.</p>
                      {analytics.clientes.length === 0 ? (
                        <p className="mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">Sem dados suficientes.</p>
                      ) : (
                        <>
                          <ClientProfitabilityChart
                            items={analytics.clientes.map((item) => ({
                              name: item.cliente,
                              result: item.resultado / 100,
                              margin: item.margem
                            }))}
                          />
                          <div className="mt-4 overflow-x-auto border-t border-zinc-200 pt-3 dark:border-zinc-800">
                            <table className="w-full min-w-[420px] text-left text-sm">
                              <caption className="sr-only">Detalhamento da rentabilidade por cliente</caption>
                              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                                <tr><th className="py-3">Cliente</th><th className="py-3 text-right">Resultado</th><th className="py-3 text-right">Margem</th></tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {analytics.clientes.slice(0, 5).map((item) => (
                                  <tr key={item.clienteId}>
                                    <th scope="row" className="max-w-72 break-words py-3 pr-3 text-left font-semibold">{item.cliente}</th>
                                    <td className={cn('py-3 text-right font-mono font-bold tabular-nums', item.resultado >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>{formatCurrencyFromCents(item.resultado)}</td>
                                    <td className="py-3 text-right font-mono tabular-nums">{percentageFormatter.format(item.margem)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </section>

                    <section aria-labelledby="financial-summary-title" className={cn(dashboardCardClass, 'xl:col-span-4')}>
                      <h3 id="financial-summary-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Resumo financeiro</h3>
                      <p className="mt-1 text-sm text-text-secondary">Pendências e próximos passos do período.</p>
                      <dl className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-800">
                        <div className="flex items-start justify-between gap-4 py-3 first:pt-0">
                          <dt className="text-sm text-zinc-500">Total vencido</dt>
                          <dd className={cn('text-right text-sm font-semibold tabular-nums', analytics.kpis.receitaAtrasada + analytics.kpis.despesasAtrasadas > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-950 dark:text-white')}>{formatCurrencyFromCents(analytics.kpis.receitaAtrasada + analytics.kpis.despesasAtrasadas)}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 py-3">
                          <dt className="text-sm text-zinc-500">Contas abertas</dt>
                          <dd className="text-right text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{openAccountCount}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 py-3">
                          <dt className="text-sm text-zinc-500">Próximo vencimento</dt>
                          <dd className="max-w-40 text-right text-sm font-semibold text-zinc-950 dark:text-white">{nextDueDate ? formatDate(nextDueDate) : 'Sem vencimentos futuros'}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 py-3">
                          <dt className="text-sm text-zinc-500">Aprovados sem parcelas</dt>
                          <dd className="text-right text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{analytics.kpis.orcamentosSemParcelas}</dd>
                        </div>
                      </dl>
                      <div className="mt-5 grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                        <Link to="/relatorios?tipo=financeiro" className="geo-focus-ring inline-flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                          Relatório financeiro <ArrowRight aria-hidden="true" size={15} />
                        </Link>
                        <Link to="/orcamentos" className="geo-focus-ring inline-flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                          Gerenciar orçamentos <ArrowRight aria-hidden="true" size={15} />
                        </Link>
                      </div>
                    </section>
                  </div>
                </details>
              </WidgetSection>
            </div>
          )}
        </section>
      )}

      {activeTab === 'faturas' && (
        <section id="finance-panel-faturas" role="tabpanel" aria-labelledby={`finance-tab-${activeTab}`} tabIndex={0}>
          <Faturas
            key={embeddedAction?.type === 'parcela' ? embeddedAction.requestId : 'financial-receivables'}
            embedded
            openCreateOnMount={embeddedAction?.type === 'parcela'}
            receiptSelectionRequest={embeddedAction?.type === 'recebimento' ? embeddedAction.requestId : undefined}
            persistListState
            initialProjectId={initialExpenseProjectId}
            initialClientId={initialFinanceClientId}
            focusParcelaId={focusedReceivableId}
            onFocusHandled={tab => clearFocusedRecord(APP_QUERY_KEYS.receivable, tab)}
          />
        </section>
      )}
      {activeTab === 'pagar' && (
        <section id="finance-panel-pagar" role="tabpanel" aria-labelledby={`finance-tab-${activeTab}`} tabIndex={0}>
          <Despesas
            key={embeddedAction?.type === 'despesa' ? embeddedAction.requestId : 'financial-expenses'}
            embedded
            openCreateOnMount={embeddedAction?.type === 'despesa'}
            initialProjectId={initialExpenseProjectId}
            focusDespesaId={focusedPayableId}
            onFocusHandled={() => clearFocusedRecord(APP_QUERY_KEYS.payable)}
          />
        </section>
      )}
      {activeTab === 'auxiliares' && (
        <section id="finance-panel-auxiliares" role="tabpanel" aria-labelledby={`finance-tab-${activeTab}`} tabIndex={0}>
          <GestaoFinanceira
            key={embeddedAction && embeddedAction.type !== 'despesa' ? embeddedAction.requestId : 'financial-auxiliary'}
            embedded
            initialTab={embeddedAction?.type === 'fiscal' ? 'fiscal' : 'viagens'}
            openCreateOnMount={embeddedAction?.type === 'viagem' || embeddedAction?.type === 'fiscal'}
          />
        </section>
      )}
    </Layout>
  );
}
