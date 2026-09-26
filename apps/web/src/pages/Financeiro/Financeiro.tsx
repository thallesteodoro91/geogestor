import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  Wallet,
  WarningCircle,
  X
} from '@phosphor-icons/react';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { DatePickerField } from '../../components/Form';
import { CustomSelect } from '../../components/CustomSelect';
import { ClientProfitabilityChart } from '../../components/charts/ClientProfitabilityChart';
import { ExpenseCategoryChart } from '../../components/charts/ExpenseCategoryChart';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { apiClient } from '../../services/apiClient';
import {
  buildFinancialAnalytics,
  formatCurrencyFromCents,
  type FinancialAnalytics
} from '../../utils/financialAnalytics';
import { chartActiveBar, chartActiveDot, chartAnimationDuration, chartBorder, chartCursor, chartLegendStyle, chartTextColor, responsiveChartProps } from '../../utils/chartHelpers';
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
  type: 'despesa' | 'parcela' | 'viagem' | 'fiscal';
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
  if (absoluteValue >= 1_000_000) return `${compactAxisNumberFormatter.format(normalizedValue / 1_000_000)} mi`;
  if (absoluteValue >= 1_000) return `${compactAxisNumberFormatter.format(normalizedValue / 1_000)} mil`;
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

function CashFlowLegend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.positive }} />
        Recebido
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.negative }} />
        Despesas
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: chartColors.primary }} />
        Resultado mensal
      </li>
    </ul>
  );
}

const metricToneClasses = {
  positive: {
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
  },
  warning: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
  },
  danger: {
    accent: 'bg-rose-500',
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
  },
  neutral: {
    accent: 'bg-zinc-400',
    icon: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
  }
} as const;
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

function FinancialMetric({
  label,
  value,
  detail,
  icon,
  tone,
  featured = false
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: keyof typeof metricToneClasses;
  featured?: boolean;
}) {
  const styles = metricToneClasses[tone];
  return (
    <article
      className={cn(
        'relative min-w-0 overflow-hidden rounded-2xl border bg-white p-5 dark:bg-zinc-900/70',
        featured
          ? 'border-emerald-300/80 ring-1 ring-emerald-200/50 dark:border-emerald-500/35 dark:ring-emerald-500/10'
          : 'border-zinc-200/80 dark:border-zinc-800'
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-5 left-0 w-1 rounded-r-full', styles.accent)} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-4 truncate text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white xl:text-[1.35rem] 2xl:text-2xl">{value}</p>
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', styles.icon)}>
          {icon}
        </span>
      </div>
      <p className="mt-3 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{detail}</p>
    </article>
  );
}

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
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));
  const focusedReceivableId = searchParams.get(APP_QUERY_KEYS.receivable) || undefined;
  const focusedPayableId = searchParams.get(APP_QUERY_KEYS.payable) || undefined;
  const initialExpenseProjectId = searchParams.get('projeto') || '';
  const initialFinanceClientId = searchParams.get('cliente') || '';
  const overviewEnabled = activeTab === 'visao';
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [embeddedAction, setEmbeddedAction] = useState<EmbeddedFinanceAction | null>(() => (
    searchParams.get('acao') === 'despesa' || searchParams.get('acao') === 'parcela'
      ? { type: searchParams.get('acao') as 'despesa' | 'parcela', requestId: Date.now() }
      : null
  ));
  const [showAllAttention, setShowAllAttention] = useState(false);

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

  const clearFocusedRecord = (key: typeof APP_QUERY_KEYS.receivable | typeof APP_QUERY_KEYS.payable) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const openEmbeddedAction = (type: EmbeddedFinanceAction['type']) => {
    setEmbeddedAction({ type, requestId: Date.now() });
    setActiveTab(type === 'despesa' ? 'pagar' : type === 'parcela' ? 'faturas' : 'auxiliares');
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
      if (!actionMenuRef.current?.contains(event.target as Node)) setActionMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionMenuOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
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
  const hasChartData = monthlyData.some((item) => item.Recebido !== 0 || item.Despesas !== 0);
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
  const collapsedAttentionItems = orderedAttentionItems.filter((item) => item.tipo === 'critico');
  orderedAttentionItems
    .filter((item) => item.tipo !== 'critico')
    .slice(0, Math.max(0, 4 - collapsedAttentionItems.length))
    .forEach((item) => collapsedAttentionItems.push(item));
  const visibleAttentionItems = showAllAttention ? orderedAttentionItems : collapsedAttentionItems;
  const hiddenAttentionCount = Math.max(0, orderedAttentionItems.length - collapsedAttentionItems.length);

  const attentionAction = (title: string) => {
    const normalizedTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalizedTitle.includes('recebimento')) return { label: 'Ver contas a receber', action: () => setActiveTab('faturas') };
    if (normalizedTitle.includes('orcamento')) return { label: 'Revisar orçamentos', action: () => navigate('/orcamentos') };
    return { label: normalizedTitle.includes('sem cliente') ? 'Revisar lançamentos' : 'Ver contas a pagar', action: () => setActiveTab('pagar') };
  };

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
            <div
              id="finance-new-entry-menu"
              role="menu"
              className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-900 lg:left-auto lg:right-0"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuOpen(false);
                  navigate(buildBudgetEditorPath());
                }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"><CurrencyDollar aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Nova receita</span><span className="block truncate text-xs text-zinc-500">Criar orçamento e cronograma de recebimento</span></span>
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
            <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-10 sm:py-16" aria-labelledby="financial-first-use-title">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20">
                <ChartBar aria-hidden="true" size={28} weight="duotone" />
              </span>
              <h2 id="financial-first-use-title" className="mt-5 text-xl font-semibold text-zinc-950 dark:text-white">
                Comece pelo primeiro lançamento
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Registre uma receita ou despesa. Depois disso, o GeoGestor apresentará fluxo de caixa, pendências, rentabilidade por cliente e despesas por categoria.
              </p>
              <button type="button" onClick={openFirstLaunch} className="geo-button-base geo-button-primary geo-focus-ring mt-6 min-h-11 px-5 text-sm">
                <Plus aria-hidden="true" size={17} />
                Criar primeiro lançamento
              </button>
              <div className="mx-auto mt-8 grid max-w-2xl gap-3 border-t border-zinc-200 pt-6 text-left text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300 sm:grid-cols-3">
                <p><strong className="block text-zinc-950 dark:text-white">1. Registre</strong> Receitas e despesas.</p>
                <p><strong className="block text-zinc-950 dark:text-white">2. Acompanhe</strong> Contas e vencimentos.</p>
                <p><strong className="block text-zinc-950 dark:text-white">3. Analise</strong> Caixa e rentabilidade.</p>
              </div>
            </section>
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
            <div className="space-y-10">
              <section aria-label="Indicadores financeiros" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FinancialMetric
                  label="Recebido"
                  value={formatCurrencyFromCents(analytics.kpis.receitaRecebida)}
                  detail="Entradas confirmadas no período"
                  tone={analytics.kpis.receitaRecebida > 0 ? 'positive' : 'neutral'}
                  icon={<Wallet aria-hidden="true" className="h-5 w-5" />}
                />
                <FinancialMetric
                  label="A receber"
                  value={formatCurrencyFromCents(analytics.kpis.receitaPendente)}
                  detail={countLabel(analytics.kpis.contasReceberCount, 'conta em aberto', 'contas em aberto')}
                  tone={analytics.kpis.receitaPendente > 0 ? 'warning' : 'neutral'}
                  icon={<TrendUp aria-hidden="true" className="h-5 w-5" />}
                />
                <FinancialMetric
                  label="Despesas pagas"
                  value={formatCurrencyFromCents(analytics.kpis.despesasPagas)}
                  detail={countLabel(expenseCount, 'despesa no período', 'despesas no período')}
                  tone={analytics.kpis.despesasPagas > 0 ? 'danger' : 'neutral'}
                  icon={<TrendDown aria-hidden="true" className="h-5 w-5" />}
                />
                <FinancialMetric
                  label="Resultado de caixa"
                  value={formatCurrencyFromCents(analytics.kpis.resultadoCaixa)}
                  detail={analytics.kpis.resultadoCaixa >= 0 ? 'Recebimentos acima das despesas' : 'Despesas acima dos recebimentos'}
                  tone={analytics.kpis.resultadoCaixa > 0 ? 'positive' : analytics.kpis.resultadoCaixa < 0 ? 'danger' : 'neutral'}
                  featured
                  icon={<ChartBar aria-hidden="true" className="h-5 w-5" />}
                />
              </section>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <section aria-labelledby="cash-flow-title" aria-describedby="cash-flow-description" className={cn(dashboardCardClass, 'xl:col-span-8')}>
                  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h2 id="cash-flow-title" className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">Evolução do fluxo de caixa</h2>
                      <p id="cash-flow-description" className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Compare recebimentos e despesas pagas; a linha indica o resultado mensal.</p>
                    </div>
                    <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{periodLabel}</span>
                  </div>
                  {hasChartData ? (
                    <>
                      <div className="flex h-72 w-full min-w-0 flex-col" aria-hidden="true">
                        <p className="h-5 shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Valores em <span translate="no">R$</span></p>
                        <div className="min-h-0 min-w-0 flex-1">
                          <ResponsiveContainer {...responsiveChartProps}>
                            <ComposedChart accessibilityLayer={false} data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                              <ReferenceLine y={0} stroke={chartTextColor} strokeOpacity={0.45} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTextColor, fontSize: 12 }} minTickGap={18} />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: chartTextColor, fontSize: 12 }}
                                tickFormatter={formatCompactCurrencyAxisValue}
                                width={58}
                                domain={cashFlowAxisScale.domain}
                                ticks={cashFlowAxisScale.ticks}
                              />
                              <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                              <Legend
                                wrapperStyle={chartLegendStyle}
                                content={<CashFlowLegend />}
                              />
                              <Bar dataKey="Recebido" fill={chartColors.positive} radius={[6, 6, 0, 0]} maxBarSize={36} activeBar={chartActiveBar(chartColors.positive)} isAnimationActive={!reduceMotion} animationDuration={chartAnimationDuration} />
                              <Bar dataKey="Despesas" fill={chartColors.negative} radius={[6, 6, 0, 0]} maxBarSize={36} activeBar={chartActiveBar(chartColors.negative)} isAnimationActive={!reduceMotion} animationDuration={chartAnimationDuration} />
                              <Line
                                type="linear"
                                dataKey="Resultado mensal"
                                stroke={chartColors.primary}
                                strokeWidth={2}
                                dot={{ r: 2.5, fill: chartColors.primary, strokeWidth: 0 }}
                                activeDot={chartActiveDot(chartColors.primary)}
                                isAnimationActive={!reduceMotion}
                                animationDuration={chartAnimationDuration}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
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
                    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 text-center dark:border-zinc-700">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"><Receipt aria-hidden="true" size={24} /></span>
                      <h3 className="mt-4 font-semibold text-zinc-950 dark:text-white">Ainda não existem lançamentos neste período</h3>
                      <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">Registre uma receita ou despesa para acompanhar a evolução do caixa.</p>
                      <button type="button" onClick={openFirstLaunch} className="geo-button-base geo-button-primary geo-focus-ring mt-5 min-h-11 px-5 text-sm">
                        <Plus aria-hidden="true" size={17} /> Criar primeiro lançamento
                      </button>
                    </div>
                  )}
                </section>

                <section aria-labelledby="financial-alerts-title" className={cn(dashboardCardClass, 'xl:col-span-4')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 id="financial-alerts-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Requer sua atenção</h2>
                      <p className="mt-1 text-sm text-zinc-500">Pendências que afetam a leitura financeira.</p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', orderedAttentionItems.length > 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200')}>
                      {orderedAttentionItems.length}
                    </span>
                  </div>
                  {orderedAttentionItems.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {visibleAttentionItems.map((alerta) => {
                        const action = attentionAction(alerta.titulo);
                        return (
                          <article key={`${alerta.tipo}-${alerta.titulo}`} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="flex min-w-0 gap-3">
                              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', alerta.tipo === 'critico' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200')}>
                                <WarningCircle aria-hidden="true" size={17} weight="fill" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{alerta.titulo}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{alerta.descricao}</p>
                                <button type="button" onClick={action.action} className="geo-focus-ring mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                                  {action.label} <ArrowRight aria-hidden="true" size={13} />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                      {hiddenAttentionCount > 0 || showAllAttention ? (
                        <button type="button" onClick={() => setShowAllAttention((current) => !current)} className="geo-focus-ring min-h-10 w-full rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
                          {showAllAttention ? 'Mostrar menos' : `Ver todas (${orderedAttentionItems.length})`}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                      <CheckCircle aria-hidden="true" size={22} weight="fill" className="shrink-0" />
                      <p className="text-sm font-medium leading-6">Tudo em dia. Nenhuma pendência financeira requer sua atenção.</p>
                    </div>
                  )}
                </section>

                <section aria-labelledby="recent-financial-title" className={cn(dashboardCardClass, 'xl:col-span-8')}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 id="recent-financial-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Últimos lançamentos</h2>
                      <p className="mt-1 text-sm text-zinc-500">Receitas e despesas mais recentes no recorte atual.</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{recentEntries.length}</span>
                  </div>
                  {recentEntries.length > 0 ? (
                    <div className="mt-4 divide-y divide-zinc-100 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                      {recentEntries.map((entry) => (
                        <button key={entry.id} type="button" onClick={() => setActiveTab(entry.tab)} className="geo-focus-ring flex min-h-[72px] w-full items-center gap-3 px-1 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', entry.type === 'receita' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200')}>
                            {entry.type === 'receita' ? <TrendUp aria-hidden="true" size={19} /> : <TrendDown aria-hidden="true" size={19} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{entry.title}</span>
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', financialStatusClass(entry.status))}>{entry.status}</span>
                            </span>
                            <span className="mt-1 block truncate text-xs text-zinc-500">{entry.date ? formatDate(entry.date) : 'Sem data'} · {entry.context}</span>
                          </span>
                          <span className={cn('shrink-0 text-right text-sm font-semibold tabular-nums', entry.type === 'receita' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                            {entry.type === 'receita' ? '+' : '−'} {formatCurrencyFromCents(entry.amount)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">Nenhum lançamento recente neste recorte.</p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setActiveTab('faturas')} className="geo-focus-ring min-h-10 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">Ver recebimentos</button>
                    <button type="button" onClick={() => setActiveTab('pagar')} className="geo-focus-ring min-h-10 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">Ver despesas</button>
                  </div>
                </section>

                <section aria-labelledby="expense-category-title" className={cn(dashboardCardClass, 'xl:col-span-4')}>
                  <h2 id="expense-category-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Despesas por categoria</h2>
                  <p className="mt-1 text-sm text-zinc-500">Categorias com maior valor no recorte.</p>
                  <ExpenseCategoryChart
                    compact
                    items={analytics.categorias.map((item) => ({
                      name: item.categoria,
                      value: item.total,
                      count: item.count
                    }))}
                  />
                </section>

                <section aria-labelledby="client-profit-title" className={cn(dashboardCardClass, 'xl:col-span-8')}>
                  <h2 id="client-profit-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Rentabilidade por cliente</h2>
                  <p className="mt-1 text-sm text-zinc-500">Cinco maiores resultados realizados.</p>
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
                  <h2 id="financial-summary-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Resumo financeiro</h2>
                  <p className="mt-1 text-sm text-zinc-500">Pendências e próximos passos do período.</p>
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
            initialProjectId={initialExpenseProjectId}
            initialClientId={initialFinanceClientId}
            focusParcelaId={focusedReceivableId}
            onFocusHandled={() => clearFocusedRecord(APP_QUERY_KEYS.receivable)}
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
