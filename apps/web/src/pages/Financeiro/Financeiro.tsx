import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  Briefcase,
  CalendarBlank,
  CaretDown,
  ChartBar,
  CheckCircle,
  CurrencyDollar,
  DownloadSimple,
  Funnel,
  Plus,
  Receipt,
  TrendDown,
  TrendUp,
  Wallet,
  WarningCircle,
  X
} from '@phosphor-icons/react';
import { Layout } from '../../components/Layout';
import { DatePickerField } from '../../components/Form';
import { CustomSelect } from '../../components/CustomSelect';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { apiClient } from '../../services/apiClient';
import {
  buildFinancialAnalytics,
  formatCurrencyFromCents,
  type ClienteFinanceiro,
  type DespesaFinanceira,
  type FinancialFilters,
  type OrcamentoFinanceiro,
  type ParcelaFinanceira,
  type ProjetoFinanceiro
} from '../../utils/financialAnalytics';
import { chartBorder, chartCursor, chartLegendStyle, chartTextColor, responsiveChartProps } from '../../utils/chartHelpers';
import { chartColors } from '../../data/chart-colors';
import { cn } from '../../utils/cn';
import { geoKickerClass } from '../../utils/geoTheme';
import { filterControlClass } from '../../utils/filterStyles';
import { primaryActionButtonClass } from '../../utils/actionStyles';
import { Faturas } from '../Faturas/Faturas';
import { Despesas } from '../Despesas/Despesas';
import { GestaoFinanceira } from './GestaoFinanceira';

type FinanceTab = 'visao' | 'faturas' | 'pagar' | 'auxiliares';
type PeriodKey = 'month' | '3m' | '6m' | '12m' | 'year' | 'custom';
type DraftFilters = {
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  categoria: string;
  tipoCusto: string;
  centroCusto: string;
};

const periodOptions: Array<{ label: string; value: PeriodKey }> = [
  { label: 'Este mês', value: 'month' },
  { label: 'Últimos 3 meses', value: '3m' },
  { label: 'Últimos 6 meses', value: '6m' },
  { label: 'Últimos 12 meses', value: '12m' },
  { label: 'Este ano', value: 'year' },
  { label: 'Período personalizado', value: 'custom' }
];

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
          <p className="mt-4 truncate text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white sm:text-3xl">{value}</p>
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));
  const overviewEnabled = activeTab === 'visao';
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [embeddedAction, setEmbeddedAction] = useState<'despesa' | null>(null);

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

  const orcamentosQuery = useQuery<OrcamentoFinanceiro[]>({
    queryKey: ['orcamentos-financeiro'],
    queryFn: () => apiClient.get('/api/financeiro/orcamentos'),
    enabled: overviewEnabled
  });
  const despesasQuery = useQuery<DespesaFinanceira[]>({
    queryKey: ['despesas-financeiro'],
    queryFn: () => apiClient.get('/api/financeiro/despesas'),
    enabled: overviewEnabled
  });
  const parcelasQuery = useQuery<ParcelaFinanceira[]>({
    queryKey: ['parcelas-financeiro'],
    queryFn: () => apiClient.get('/api/financeiro/parcelas'),
    enabled: overviewEnabled
  });
  const clientesQuery = useQuery<ClienteFinanceiro[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get('/api/clientes'),
    enabled: overviewEnabled
  });
  const projetosQuery = useQuery<ProjetoFinanceiro[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get('/api/projetos'),
    enabled: overviewEnabled
  });

  const orcamentos = useMemo(() => orcamentosQuery.data ?? [], [orcamentosQuery.data]);
  const despesas = useMemo(() => despesasQuery.data ?? [], [despesasQuery.data]);
  const parcelas = useMemo(() => parcelasQuery.data ?? [], [parcelasQuery.data]);
  const clientes = useMemo(() => clientesQuery.data ?? [], [clientesQuery.data]);
  const projetos = useMemo(() => projetosQuery.data ?? [], [projetosQuery.data]);

  const filters = useMemo<FinancialFilters>(() => ({
    dataInicio: effectiveDataInicio || undefined,
    dataFim: effectiveDataFim || undefined,
    clienteId: clienteId === 'Todos' ? undefined : clienteId,
    categoria: categoria === 'Todas' ? undefined : categoria,
    tipoCusto: tipoCusto === 'Todos' ? undefined : tipoCusto,
    centroCusto: centroCusto === 'Todos' ? undefined : centroCusto
  }), [categoria, centroCusto, clienteId, effectiveDataFim, effectiveDataInicio, tipoCusto]);

  const analytics = useMemo(() => buildFinancialAnalytics({
    orcamentos,
    despesas,
    parcelas,
    clientes,
    projetos,
    filters
  }), [clientes, despesas, filters, orcamentos, parcelas, projetos]);

  const loading = overviewEnabled && [
    orcamentosQuery,
    despesasQuery,
    parcelasQuery,
    clientesQuery,
    projetosQuery
  ].some((query) => query.isLoading);
  const failed = overviewEnabled && [
    orcamentosQuery,
    despesasQuery,
    parcelasQuery,
    clientesQuery,
    projetosQuery
  ].some((query) => query.isError);

  const categories = Array.from(new Set(despesas.map((item) => item.categoria).filter((value): value is string => Boolean(value)))).sort();
  const costTypes = Array.from(new Set(despesas.map((item) => item.tipoCusto).filter((value): value is string => Boolean(value)))).sort();
  const costCenters = Array.from(new Set([
    ...despesas.map((item) => item.centroCusto),
    ...orcamentos.map((item) => item.centroCusto)
  ].filter((value): value is string => Boolean(value)))).sort();

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
      Resultado: item.resultadoCaixa / 100
    }));
  const hasChartData = monthlyData.some((item) => item.Recebido !== 0 || item.Despesas !== 0);
  const launchCount = analytics.parcelas.length + analytics.despesas.length;

  const exportOverview = () => {
    const header = ['Período', 'Recebido', 'Despesas', 'Resultado'];
    const rows = monthlyData.map((item) => [
      item.name,
      item.Recebido.toFixed(2).replace('.', ','),
      item.Despesas.toFixed(2).replace('.', ','),
      item.Resultado.toFixed(2).replace('.', ',')
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

  const attentionAction = (title: string) => {
    if (title.includes('Recebimentos')) return { label: 'Ver contas a receber', action: () => setActiveTab('faturas') };
    if (title.includes('Orçamentos')) return { label: 'Revisar orçamentos', action: () => navigate('/orcamentos') };
    return { label: title.includes('sem cliente') ? 'Revisar lançamentos' : 'Ver contas a pagar', action: () => setActiveTab('pagar') };
  };

  const openFirstLaunch = () => {
    setActionMenuOpen(true);
    window.requestAnimationFrame(() => document.getElementById('finance-primary-action')?.focus());
  };

  return (
    <Layout>
      <header className="mb-7 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <span className={cn(geoKickerClass, 'mb-4')}>Módulo Financeiro</span>
          <h1 className="text-4xl font-semibold tracking-tighter text-zinc-950 dark:text-white sm:text-5xl">Gestão financeira 360</h1>
          <p className="mt-3 max-w-3xl text-base font-medium text-zinc-500 dark:text-zinc-400 sm:text-lg">
            Acompanhe receitas, despesas, viagens e o resultado do seu negócio.
          </p>
        </div>
        <div ref={actionMenuRef} className="relative shrink-0 self-start lg:self-auto">
          <button
            id="finance-primary-action"
            type="button"
            aria-haspopup="menu"
            aria-expanded={actionMenuOpen}
            aria-controls="finance-new-entry-menu"
            onClick={() => setActionMenuOpen((current) => !current)}
            className={cn(primaryActionButtonClass, 'w-full justify-center sm:w-auto')}
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
                  navigate('/orcamentos', { state: { openCreateModal: true } });
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
                  setActiveTab('pagar');
                  setEmbeddedAction('despesa');
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
                  setActiveTab('auxiliares');
                }}
                className="geo-focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:scale-[0.99] dark:hover:bg-zinc-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200"><Briefcase aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-950 dark:text-white">Nova viagem ou nota fiscal</span><span className="block truncate text-xs text-zinc-500">Acessar os controles financeiros auxiliares</span></span>
              </button>
            </div>
          )}
        </div>
      </header>

      <nav role="tablist" aria-label="Áreas do Financeiro" className="mb-7 flex gap-6 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {([
          ['visao', 'Visão geral', ChartBar],
          ['faturas', 'Contas a receber', CurrencyDollar],
          ['pagar', 'Contas a pagar', Receipt],
          ['auxiliares', 'Viagens e notas fiscais', Briefcase]
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => {
              setEmbeddedAction(null);
              setActiveTab(id);
            }}
            className={cn(
              'geo-focus-ring inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition-[border-color,color] duration-150 motion-reduce:transition-none',
              activeTab === id
                ? 'border-emerald-500 text-zinc-950 dark:text-white'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
            )}
          >
            <Icon aria-hidden="true" weight={activeTab === id ? 'fill' : 'regular'} className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'visao' && (
        <>
          <section aria-label="Período e filtros financeiros" className="relative mb-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-[280px]">
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
                className="geo-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
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
              Exibindo {countLabel(launchCount, 'lançamento', 'lançamentos')} e {countLabel(analytics.despesas.length, 'despesa', 'despesas')} no período selecionado.
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

          {loading ? (
            <FinancialSkeleton />
          ) : failed ? (
            <section role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
              <h2 className="text-lg font-semibold">Dados financeiros indisponíveis</h2>
              <p className="mt-2 text-sm">Nenhum saldo foi substituído por zero. Restabeleça a conexão local e tente novamente.</p>
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
                  detail={countLabel(analytics.despesas.length, 'despesa no período', 'despesas no período')}
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

              <section aria-labelledby="cash-flow-title" className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-7">
                <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 id="cash-flow-title" className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">Evolução do fluxo de caixa</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Compare receitas recebidas e despesas pagas em {periodLabel.toLocaleLowerCase('pt-BR')}.</p>
                  </div>
                  <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{periodLabel}</span>
                </div>
                {hasChartData ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer {...responsiveChartProps}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTextColor, fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTextColor, fontSize: 12 }} tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                        <Tooltip cursor={chartCursor} content={<RichTooltip showDifference differenceLabel="Resultado" format="currency" />} />
                        <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
                        <Bar dataKey="Recebido" fill={chartColors.positive} radius={[6, 6, 0, 0]} maxBarSize={36} />
                        <Bar dataKey="Despesas" fill={chartColors.negative} radius={[6, 6, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 text-center dark:border-zinc-700">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"><Receipt aria-hidden="true" size={24} /></span>
                    <h3 className="mt-4 font-semibold text-zinc-950 dark:text-white">Ainda não existem lançamentos neste período</h3>
                    <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">Registre uma receita ou despesa para começar a acompanhar a evolução do caixa.</p>
                    <button type="button" onClick={openFirstLaunch} className="geo-button-base geo-button-primary geo-focus-ring mt-5 min-h-11 px-5 text-sm">
                      <Plus aria-hidden="true" size={17} /> Criar primeiro lançamento
                    </button>
                  </div>
                )}
              </section>

              <section aria-labelledby="financial-alerts-title" className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="financial-alerts-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Requer sua atenção</h2>
                    <p className="mt-1 text-sm text-zinc-500">Pendências que podem afetar a leitura do resultado financeiro.</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', attentionItems.length > 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200')}>
                    {attentionItems.length}
                  </span>
                </div>
                {attentionItems.length > 0 ? (
                  <div className="mt-5 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {attentionItems.map((alerta) => {
                      const action = attentionAction(alerta.titulo);
                      return (
                        <article key={`${alerta.tipo}-${alerta.titulo}`} className="flex flex-col gap-4 bg-white p-4 dark:bg-zinc-900/60 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', alerta.tipo === 'critico' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200')}>
                              <WarningCircle aria-hidden="true" size={19} weight="fill" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{alerta.titulo}</p>
                              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{alerta.descricao}</p>
                            </div>
                          </div>
                          <button type="button" onClick={action.action} className="geo-focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                            {action.label} <ArrowRight aria-hidden="true" size={15} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <CheckCircle aria-hidden="true" size={22} weight="fill" className="shrink-0" />
                    <p className="text-sm font-medium">Tudo em dia. Nenhuma pendência financeira requer sua atenção.</p>
                  </div>
                )}
              </section>

              <div className="grid gap-8 border-t border-zinc-200 pt-8 dark:border-zinc-800 xl:grid-cols-2">
                <section aria-labelledby="client-profit-title" className="min-w-0 xl:pr-4">
                  <h2 id="client-profit-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Rentabilidade por cliente</h2>
                  <p className="mt-1 text-sm text-zinc-500">Cinco maiores resultados realizados.</p>
                  {analytics.clientes.length === 0 ? (
                    <p className="mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">Sem dados suficientes.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                          <tr><th className="py-3">Cliente</th><th className="py-3 text-right">Resultado</th><th className="py-3 text-right">Margem</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {analytics.clientes.slice(0, 5).map((item) => (
                            <tr key={item.clienteId}>
                              <td className="py-3 pr-3 font-semibold">{item.cliente}</td>
                              <td className={cn('py-3 text-right font-mono font-bold tabular-nums', item.resultado >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrencyFromCents(item.resultado)}</td>
                              <td className="py-3 text-right font-mono tabular-nums">{item.margem.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section aria-labelledby="expense-category-title" className="min-w-0 xl:border-l xl:border-zinc-200 xl:pl-8 dark:xl:border-zinc-800">
                  <h2 id="expense-category-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Despesas por categoria</h2>
                  <p className="mt-1 text-sm text-zinc-500">Categorias com maior valor no recorte.</p>
                  {analytics.categorias.length === 0 ? (
                    <p className="mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">Nenhuma despesa encontrada.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {analytics.categorias.slice(0, 6).map((item) => (
                        <div key={item.categoria}>
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="truncate font-semibold">{item.categoria}</span>
                            <span className="font-mono tabular-nums">{formatCurrencyFromCents(item.total)}</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(2, item.percentual)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="flex justify-end">
                <Link to="/orcamentos" className="geo-button-base geo-focus-ring inline-flex min-h-11 items-center rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                  Gerenciar orçamentos
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'faturas' && <Faturas embedded />}
      {activeTab === 'pagar' && <Despesas embedded openCreateOnMount={embeddedAction === 'despesa'} />}
      {activeTab === 'auxiliares' && <GestaoFinanceira embedded />}
    </Layout>
  );
}
