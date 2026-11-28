import { DashboardCashWidget, DashboardCompletionWidget, DashboardDeadlineWidget, DashboardProjectDistributionWidget } from './DashboardAuraWidgets';
import { cn } from '../utils/cn';
import { DatePickerField, FormSelect } from '../components/Form';
import { appLinks, type ManagerialReport } from '@geogestor/contracts';
import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Info } from '@phosphor-icons/react';
import { apiClient } from '../services/apiClient';
import { KpiTransparency } from '../components/KpiTransparency';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { RecentActivities } from '../components/RecentActivities';
import { WidgetSection } from '../components/WidgetSection';
import { MetricCard } from '../components/MetricCard';
import { Skeleton } from '../components/Skeleton';
import { useReducedMotion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  chartActiveDot, chartTextColor, chartSecondaryTextColor,
  chartCursor, chartSegmentStyle, responsiveChartProps
} from '../utils/chartHelpers';
import { chartColors, colorblindSafeColors } from '../data/chart-colors';
import { DynamicTooltip } from '../components/charts/DynamicTooltip';
import { RichTooltip } from '../components/charts/RichTooltip';
import { DismissibleDetails } from '../components/DismissibleDetails';
import { commercialContentClass } from '../utils/commercialLayout';
import {
  formatTaskPeriodLabel,
  getTaskPeriodRange,
  resolveProjectScope,
  resolveTaskCompletionPeriod,
  validateCustomTaskRange,
  type TaskCompletionPeriod,
} from '../utils/dashboardFilters';

import valueChainIcon from '../assets/magnific-icons/value-chain_10220236.svg';
import coexistenceIcon from '../assets/magnific-icons/coexistence_10415362.svg';
import projectFolderIcon from '../assets/magnific-icons/project_folder.svg';
import mapIcon from '../assets/magnific-icons/map_3909526.svg';
import stopwatchIcon from '../assets/magnific-icons/stopwatch_9527988.svg';
import diplomaIcon from '../assets/magnific-icons/diploma_5172207.svg';
import calendarIcon from '../assets/magnific-icons/calendar_5684639.svg';
import blueprintIcon from '../assets/magnific-icons/blueprint_7504288.svg';

const getStatusColor = (status: string, index: number) => {
  switch (status) {
    case 'Concluído':
    case 'Finalizado':
      return chartColors.positive;
    case 'Em Andamento':
      return chartColors.primary;
    case 'Atrasado':
      return chartColors.negative;
    case 'Aguardando Órgão':
      return chartColors.warning;
    case 'Em Análise':
      return chartColors.secondary;
    default:
      return colorblindSafeColors[index % colorblindSafeColors.length];
  }
};

const cashFlowChartSeries = [
  {
    dataKey: 'recebimentos',
    label: 'Recebimentos',
    color: 'var(--dashboard-cash-received)',
    dash: undefined,
    gradientId: 'dashboardRecebimentosGradient',
    gradientOpacity: 0.34,
  },
  {
    dataKey: 'pagamentos',
    label: 'Pagamentos',
    color: 'var(--dashboard-cash-paid)',
    dash: '6 3',
    gradientId: 'dashboardPagamentosGradient',
    gradientOpacity: 0.3,
  },
] as const;

const compactCashAxis = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});
const dashboardCashAxisColor = 'var(--dashboard-cash-axis)';

const projectPercentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const areaNumberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function MetricDefinition({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DismissibleDetails className="relative shrink-0">
      <summary
        aria-label={label}
        className="geo-focus-ring flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-zinc-100 hover:text-text-primary dark:hover:bg-zinc-800"
      >
        <Info aria-hidden="true" className="size-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(78vw,300px)] rounded-xl border border-brand-border bg-brand-surface p-3 text-xs leading-5 text-text-secondary shadow-xl">
        {children}
      </div>
    </DismissibleDetails>
  );
}

interface TaskItem {
  id: string;
  titulo: string;
  status: string;
  dataLimite?: string | null;
  projetoNome?: string;
  clienteNome?: string;
  prioridade?: string;
}

interface DashboardOverview {
  clientsTotal: number;
  projectsTotal: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksPending: number;
  taskCompletionRate: number;
  taskCompletion: {
    inicio: string | null;
    fim: string | null;
    total: number;
    completed: number;
    pending: number;
    rate: number;
  };
  projectScope: 'active' | 'all';
  projectsInScope: number;
  projectByType: Array<{ name: string; value: number }>;
  projectByTypeStatus: Array<{ type: string; status: string; value: number }>;
  upcomingTasks: TaskItem[];
  upcomingLicenses: LicencaItem[];
}

interface LicencaItem {
  id: string;
  projetoId: string;
  numero: string;
  orgao: string;
  dataEmissao?: string | null;
  dataVencimento: string;
  status: string;
  observacoes?: string | null;
  projetoNome?: string;
}

const getDaysLeftText = (targetDate: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: diffDays, text: `Vencido há ${Math.abs(diffDays)}d`, className: 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20' };
  }
  if (diffDays === 0) {
    return { days: diffDays, text: 'Vence hoje', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20' };
  }
  if (diffDays === 1) {
    return { days: diffDays, text: 'Amanhã', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20' };
  }
  return { days: diffDays, text: `Em ${diffDays} dias`, className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/80' };
};

export function Dashboard() {
  const reduceMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardReferenceDate = useMemo(() => new Date(), []);
  const projectScope = resolveProjectScope(searchParams.get('projetosEscopo'));
  const projetoFilterMode = searchParams.get('projetosAgrupamento') === 'unitario' ? 'unitario' : 'macro';
  const selectedProjetoTipo = searchParams.get('projetosTipo') ?? '';
  const taskPeriod = resolveTaskCompletionPeriod(searchParams.get('tarefasPeriodo'));
  const currentMonthRange = useMemo(
    () => getTaskPeriodRange('month', '', '', dashboardReferenceDate)!,
    [dashboardReferenceDate],
  );
  const taskCustomStart = searchParams.get('tarefasInicio') ?? '';
  const taskCustomEnd = searchParams.get('tarefasFim') ?? '';
  const taskCustomError = taskPeriod === 'custom'
    ? validateCustomTaskRange(taskCustomStart, taskCustomEnd)
    : null;
  const selectedTaskRange = getTaskPeriodRange(
    taskPeriod,
    taskCustomStart,
    taskCustomEnd,
    dashboardReferenceDate,
  );
  const requestedTaskRange = selectedTaskRange ?? currentMonthRange;
  const taskPeriodLabel = formatTaskPeriodLabel(taskPeriod, selectedTaskRange ?? currentMonthRange);
  const [activeProjectStatusIndex, setActiveProjectStatusIndex] = useState<number | null>(null);
  const [financeChartReady, setFinanceChartReady] = useState(false);
  const [operationalPanelsReady, setOperationalPanelsReady] = useState(false);
  const [activityPanelsReady, setActivityPanelsReady] = useState(false);
  const [projectChartReady, setProjectChartReady] = useState(false);

  const updateDashboardFilters = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const changeTaskPeriod = (period: TaskCompletionPeriod) => {
    if (period === 'custom') {
      updateDashboardFilters({
        tarefasPeriodo: period,
        tarefasInicio: taskCustomStart || currentMonthRange.start,
        tarefasFim: taskCustomEnd || currentMonthRange.end,
      });
      return;
    }
    updateDashboardFilters({
      tarefasPeriodo: period,
      tarefasInicio: null,
      tarefasFim: null,
    });
  };

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (!['active', 'all'].includes(next.get('projetosEscopo') ?? '')) {
      next.set('projetosEscopo', 'active');
      changed = true;
    }
    if (!['macro', 'unitario'].includes(next.get('projetosAgrupamento') ?? '')) {
      next.set('projetosAgrupamento', 'macro');
      changed = true;
    }
    if (!['month', 'three_months', 'year', 'custom'].includes(next.get('tarefasPeriodo') ?? '')) {
      next.set('tarefasPeriodo', 'month');
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let operationalPanelsTimer: number | undefined;
    let activityPanelsTimer: number | undefined;
    let projectChartTimer: number | undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      startTransition(() => setFinanceChartReady(true));
      operationalPanelsTimer = window.setTimeout(() => {
        startTransition(() => setOperationalPanelsReady(true));
      }, 70);
      activityPanelsTimer = window.setTimeout(() => {
        startTransition(() => setActivityPanelsReady(true));
      }, 170);
      projectChartTimer = window.setTimeout(() => {
        startTransition(() => setProjectChartReady(true));
      }, 280);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (operationalPanelsTimer !== undefined) window.clearTimeout(operationalPanelsTimer);
      if (activityPanelsTimer !== undefined) window.clearTimeout(activityPanelsTimer);
      if (projectChartTimer !== undefined) window.clearTimeout(projectChartTimer);
    };
  }, []);

  const { data: overview, isLoading: overviewLoading, isFetching: overviewFetching, isError: overviewError } = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview', projectScope, requestedTaskRange.start, requestedTaskRange.end],
    placeholderData: (previousData) => previousData,
    refetchOnMount: 'always',
    queryFn: () => {
      const query = new URLSearchParams({
        projectScope,
        tasksInicio: requestedTaskRange.start,
        tasksFim: requestedTaskRange.end,
      });
      return apiClient.get<DashboardOverview>(`/api/dashboard/overview?${query.toString()}`);
    }
  });
  const filteredOverview = overview
    && overview.projectScope === projectScope
    && overview.taskCompletion.inicio === requestedTaskRange.start
    && overview.taskCompletion.fim === requestedTaskRange.end
    ? overview
    : undefined;

  const { data: stats, isLoading: loadingStats, isError: statsError } = useQuery<ManagerialReport>({
    queryKey: ['stats-geral'],
    queryFn: () => apiClient.get<ManagerialReport>('/api/relatorios/geral'),
    refetchOnMount: 'always'
  });

  const tasks = useMemo(() => overview?.upcomingTasks ?? [], [overview]);
  const licencas = useMemo(() => overview?.upcomingLicenses ?? [], [overview]);

  // Calcular balanço financeiro
  const { netProfit, areaTotal } = useMemo(() => {
    return {
      netProfit: stats?.financial.kpis.cashResult || 0,
      areaTotal: stats?.operational.kpis.activeAreaHa || 0,
    };
  }, [stats]);

  // Porcentagem de tarefas concluídas
  const taskCompletionRate = useMemo(() => {
    const completed = overview?.tasksCompleted ?? tasks.filter((t) => t.status === 'Concluído').length;
    return overview?.taskCompletionRate ?? (tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0);
  }, [overview, tasks]);

  const taskSummary = useMemo(() => {
    const total = filteredOverview?.taskCompletion.total ?? 0;
    const completed = filteredOverview?.taskCompletion.completed ?? 0;
    const pending = filteredOverview?.taskCompletion.pending ?? 0;
    const completedPart = filteredOverview?.taskCompletion.rate ?? 0;

    return {
      total,
      completed,
      rate: completedPart,
      pending,
    };
  }, [filteredOverview?.taskCompletion]);

  // Preparar dados do gráfico financeiro
  const financeChartData = useMemo(() => {
    const chartMap = new Map<string, { mes: string; recebimentos: number; pagamentos: number }>();
    stats?.financial.monthly.forEach((point) => {
      chartMap.set(point.month, {
        mes: point.month,
        recebimentos: point.receivedRevenue / 100,
        pagamentos: point.paidExpenses / 100
      });
    });
    let data = Array.from(chartMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));
    if (data.length === 0) {
      data = [
        { mes: 'Jan', recebimentos: 0, pagamentos: 0 },
        { mes: 'Fev', recebimentos: 0, pagamentos: 0 },
        { mes: 'Mar', recebimentos: 0, pagamentos: 0 },
      ];
    }
    return data;
  }, [stats]);



  // Preparar os tipos de projetos disponíveis a partir dos dados reais
  const availableProjectTypes = useMemo(() => filteredOverview?.projectByType.map((item) => item.name) || [], [filteredOverview]);

  const effectiveProjetoTipo = selectedProjetoTipo || availableProjectTypes[0] || '';

  useEffect(() => {
    if (projetoFilterMode !== 'unitario' || availableProjectTypes.length === 0) return;
    if (availableProjectTypes.includes(selectedProjetoTipo)) return;
    const next = new URLSearchParams(searchParams);
    next.set('projetosTipo', availableProjectTypes[0]);
    setSearchParams(next, { replace: true });
  }, [availableProjectTypes, projetoFilterMode, searchParams, selectedProjetoTipo, setSearchParams]);

  // Preparar dados de distribuição de projetos
  const projetosStatusData = useMemo(() => {
    if (projetoFilterMode === 'macro') {
      return filteredOverview?.projectByType || [];
    } else {
      return (filteredOverview?.projectByTypeStatus || [])
        .filter((item) => item.type === effectiveProjetoTipo)
        .map((item) => ({ name: item.status, value: item.value }));
    }
  }, [filteredOverview, projetoFilterMode, effectiveProjetoTipo]);

  const projectDistributionTotal = useMemo(
    () => projetosStatusData.reduce((total, item) => total + item.value, 0),
    [projetosStatusData]
  );



  const upcomingItems = useMemo(() => {
    const items: Array<{
      id: string;
      tipo: 'tarefa' | 'licenca';
      titulo: string;
      contexto: string;
      data: Date;
      dateTime: string;
      dataString: string;
      link: string;
    }> = [];

    tasks.forEach(t => {
      if (t.status !== 'Concluído' && t.dataLimite) {
        const dateParts = t.dataLimite.split('-');
        if (dateParts.length === 3) {
          const date = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
          const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
          items.push({
            id: t.id,
            tipo: 'tarefa',
            titulo: t.titulo,
            contexto: t.projetoNome || t.clienteNome || 'Interno',
            data: date,
            dateTime: t.dataLimite,
            dataString: formattedDate,
            link: appLinks.task(t.id)
          });
        }
      }
    });

    licencas.forEach(l => {
      if (l.status !== 'Concluído' && l.status !== 'Entregue' && l.dataVencimento) {
        const dateParts = l.dataVencimento.split('-');
        if (dateParts.length >= 3) {
          const date = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
          const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
          items.push({
            id: l.id,
            tipo: 'licenca',
            titulo: `${l.numero} - ${l.orgao}`,
            contexto: l.projetoNome || 'Sem projeto',
            data: date,
            dateTime: l.dataVencimento.slice(0, 10),
            dataString: formattedDate,
            link: appLinks.license(l.id)
          });
        }
      }
    });

    return items.sort((a, b) => a.data.getTime() - b.data.getTime()).slice(0, 5);
  }, [tasks, licencas]);
  const [featuredDeadline, ...remainingDeadlines] = upcomingItems;
  const featuredDeadlineStatus = featuredDeadline && getDaysLeftText(featuredDeadline.data);
  const failedWithoutData = (overviewError && !overview)
    || (statsError && !stats);

  if (failedWithoutData) {
    return (
      <Layout contentClassName={commercialContentClass}>
        <section role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <h1 className="text-2xl font-bold">Não foi possível carregar o painel</h1>
          <p className="mt-2 text-sm leading-6">
            Os indicadores não foram substituídos por zeros. Tente novamente depois que o serviço e o banco locais estiverem disponíveis.
          </p>
        </section>
      </Layout>
    );
  }

  return (
    <Layout contentClassName={commercialContentClass}>
      <PageHeader
        title="Visão Geral"
        description="Monitoramento operacional, financeiro e geográfico consolidado."
      />
      <WidgetSection id="dashboard-cash-section-title" title="Caixa e indicadores" className="border-t-0 pt-0 sm:pt-0" contentClassName="grid grid-cols-1 gap-6 xl:grid-cols-12">
        
        {/* Fluxo de Caixa (Large Bento Box) */}
        <div
          className="geo-card col-span-1 flex min-h-[320px] flex-col p-5 sm:min-h-[360px] sm:p-6 lg:p-8 xl:col-span-8"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 sm:mb-6 sm:items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={valueChainIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">Evolução do caixa</h3>
            </div>
            <div className="text-right">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Resultado de caixa</span>
              <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netProfit / 100)}
              </span>
              {stats && <KpiTransparency
                definition="Recebimentos confirmados menos despesas pagas. Cancelamentos não removem recebimentos anteriores; somente estornos explícitos."
                period={stats.period.label}
                total={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netProfit / 100)}
                recordCount={stats.state.filteredRecordCount}
                updatedAt={stats.generatedAt}
                records={stats.financial.monthly.map((item) => ({
                  id: item.month, label: item.month,
                  value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cashResult / 100)
                }))}
                warnings={stats.financial.alerts.map((alert) => alert.code === 'negative_cash' ? 'O resultado de caixa está negativo no período.' : '').filter(Boolean)}
              />}
            </div>
          </div>

          <div className={cn('min-w-0', stats && 'grid gap-4 min-[1440px]:grid-cols-[minmax(0,240px)_minmax(0,1fr)]')}>
            {stats && (
              <DashboardCashWidget
                received={stats.financial.kpis.receivedRevenue}
                paid={stats.financial.kpis.paidExpenses}
              />
            )}
            <div className="dashboard-cash-chart h-[220px] min-w-0 w-full">
              {financeChartReady ? <ResponsiveContainer {...responsiveChartProps}>
                <AreaChart data={financeChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {cashFlowChartSeries.map((series) => (
                      <linearGradient key={series.gradientId} id={series.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={series.color} stopOpacity={series.gradientOpacity} />
                        <stop offset="95%" stopColor={series.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dashboard-cash-grid)" />
                  <ReferenceLine y={0} stroke={dashboardCashAxisColor} strokeWidth={1.5} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chartSecondaryTextColor }} padding={{ left: 8, right: 8 }} minTickGap={18} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chartSecondaryTextColor }} width={62} tickFormatter={(value) => compactCashAxis.format(Number(value))} padding={{ top: 5, bottom: 5 }} />
                  <RechartsTooltip cursor={chartCursor} content={<RichTooltip showDifference={true} differenceLabel="Saldo de caixa" format="currency" />} />
                  {cashFlowChartSeries.map((series) => (
                    <Area
                      key={series.dataKey}
                      type="monotone"
                      name={series.label}
                      dataKey={series.dataKey}
                      stroke={series.color}
                      strokeWidth={3}
                      strokeDasharray={series.dash}
                      strokeLinecap="round"
                      fill={`url(#${series.gradientId})`}
                      fillOpacity={1}
                      dot={false}
                      activeDot={chartActiveDot(series.color)}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer> : <div aria-hidden="true" className="h-full min-h-[200px] rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40" />}
            </div>
          </div>
        </div>

        {/* Indicadores rápidos */}
        <section
          aria-label="Indicadores gerais"
          aria-busy={overviewLoading || loadingStats}
          className="col-span-1 xl:col-span-4"
        >
          <div className="grid h-full auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
            <MetricCard
              label="Clientes"
              value={overviewLoading ? <Skeleton className="h-9 w-20" /> : String(overview?.clientsTotal ?? 0).padStart(2, '0')}
              icon={<img src={coexistenceIcon} alt="" className="h-6 w-6 object-contain" />}
              tone="overview"
              layout="total"
              delay={0.2}
              animateOnMount={false}
              spotlight
            />
            <MetricCard
              label="Projetos"
              value={overviewLoading ? <Skeleton className="h-9 w-20" /> : String(overview?.projectsTotal ?? 0).padStart(2, '0')}
              icon={<img src={projectFolderIcon} alt="" className="h-6 w-6 object-contain" />}
              tone="overview"
              layout="total"
              delay={0.3}
              animateOnMount={false}
              spotlight
            />
            <MetricCard
              label="Área sob Gestão (ha)"
              value={loadingStats ? <Skeleton className="h-9 w-24" /> : areaNumberFormatter.format(areaTotal)}
              icon={<img src={mapIcon} alt="" className="h-6 w-6 object-contain" />}
              tone="overview"
              layout="total"
              delay={0.4}
              animateOnMount={false}
              spotlight
            />
            <MetricCard
              label="Eficiência Operacional"
              value={overviewLoading ? <Skeleton className="h-9 w-20" /> : `${taskCompletionRate}%`}
              helper="das tarefas concluídas"
              icon={<img src={stopwatchIcon} alt="" className="h-6 w-6 object-contain" />}
              tone="overview"
              layout="total"
              delay={0.5}
              animateOnMount={false}
              spotlight
            />
          </div>
        </section>

      </WidgetSection>

      {operationalPanelsReady ? <WidgetSection id="dashboard-deadlines-section-title" title="Prazos e execução" className="mt-8 sm:mt-10" contentClassName="grid grid-cols-1 gap-6 xl:grid-cols-12">
        
        {/* Próximos Vencimentos */}
        <div
          className="geo-card col-span-1 flex min-h-[300px] flex-col justify-between p-5 sm:min-h-[340px] sm:p-6 lg:min-h-[360px] lg:p-8 xl:col-span-8"
        >
          <div>
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={calendarIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Próximos Vencimentos</h3>
                <p className="mt-1 text-xs leading-5 text-text-secondary">Prazos de tarefas e licenças ambientais</p>
              </div>
            </div>

            <div className="dashboard-deadline-list">
              {featuredDeadline && featuredDeadlineStatus ? (
                <DashboardDeadlineWidget
                  title={featuredDeadline.titulo}
                  context={featuredDeadline.contexto}
                  kind={featuredDeadline.tipo === 'tarefa' ? 'Tarefa' : 'Licença'}
                  date={featuredDeadline.data}
                  dateTime={featuredDeadline.dateTime}
                  days={featuredDeadlineStatus.days}
                  status={featuredDeadlineStatus.text}
                  href={featuredDeadline.link}
                />
              ) : (
                <div className="py-12 text-center text-zinc-600 dark:text-zinc-300 text-sm">
                  Nenhum vencimento pendente para os próximos dias.
                </div>
              )}
              {remainingDeadlines.length > 0 && (
                <div className="min-w-0 space-y-3">
                  {remainingDeadlines.map((item) => {
                    const daysBadge = getDaysLeftText(item.data);
                    return (
                      <Link
                        key={`${item.tipo}-${item.id}`}
                        to={item.link}
                        aria-label={`Abrir ${item.tipo === 'tarefa' ? 'tarefa' : 'licença'}: ${item.titulo}`}
                        className="geo-focus-ring flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:bg-zinc-100/50 dark:border-zinc-800/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 flex items-center justify-center shrink-0">
                            {item.tipo === 'tarefa' ? (
                              <img src={calendarIcon} alt="" className="h-[22px] w-[22px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                            ) : (
                              <img src={diplomaIcon} alt="" className="h-[26px] w-[26px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-text-primary">{item.titulo}</h4>
                            <p className="text-[10px] text-text-secondary truncate mt-0.5">{item.contexto}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-3">
                          <time dateTime={item.dateTime} className="text-[10px] text-text-secondary font-medium tabular-nums">{item.dataString}</time>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${daysBadge.className}`}>
                            {daysBadge.text}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Taxa de conclusão */}
        <div
          className="geo-card col-span-1 flex min-h-[300px] flex-col p-5 sm:min-h-[340px] sm:p-6 lg:min-h-[360px] lg:p-8 xl:col-span-4"
          aria-busy={overviewFetching}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center">
                <img src={stopwatchIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text-primary">Taxa de conclusão</h3>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  {taskPeriodLabel} · tarefas com prazo no período
                </p>
              </div>
            </div>
            <MetricDefinition label="Como a taxa de conclusão é calculada">
              Tarefas concluídas com prazo no período divididas pelo total de tarefas com prazo no mesmo período. Tarefas sem prazo e registros excluídos não entram no cálculo.
            </MetricDefinition>
          </div>

          <div className="mt-4">
            <label htmlFor="dashboard-task-period" className="sr-only">Período da taxa de conclusão</label>
            <FormSelect
              id="dashboard-task-period"
              name="dashboardTaskPeriod"
              aria-label="Período da taxa de conclusão"
              value={taskPeriod}
              onChange={(event) => changeTaskPeriod(event.target.value as TaskCompletionPeriod)}
              wrapperClassName="w-full"
              className="geo-focus-ring"
              searchable={false}
            >
              <option value="month">Este mês</option>
              <option value="three_months">Últimos 3 meses</option>
              <option value="year">Este ano</option>
              <option value="custom">Personalizado</option>
            </FormSelect>
          </div>

          {taskPeriod === 'custom' && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="dashboard-task-start" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Data inicial</label>
                <DatePickerField
                  id="dashboard-task-start"
                  name="dashboardTaskStart"
                  value={taskCustomStart}
                  onChange={(event) => updateDashboardFilters({ tarefasInicio: event.target.value })}
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(taskCustomError)}
                  aria-describedby={taskCustomError ? 'dashboard-task-range-error' : undefined}
                />
              </div>
              <div>
                <label htmlFor="dashboard-task-end" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Data final</label>
                <DatePickerField
                  id="dashboard-task-end"
                  name="dashboardTaskEnd"
                  value={taskCustomEnd}
                  onChange={(event) => updateDashboardFilters({ tarefasFim: event.target.value })}
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(taskCustomError)}
                  aria-describedby={taskCustomError ? 'dashboard-task-range-error' : undefined}
                />
              </div>
              {taskCustomError && (
                <p id="dashboard-task-range-error" className="text-xs font-semibold leading-5 text-rose-600 dark:text-rose-300 sm:col-span-2" role="alert">
                  {taskCustomError}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex-1" aria-live="polite">
            {taskCustomError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                Corrija o período personalizado para calcular a taxa de conclusão.
              </div>
            ) : !filteredOverview ? (
              <div aria-hidden="true" className="space-y-5">
                <Skeleton className="h-9 w-44" />
                <Skeleton className="h-[34px] w-full" />
                <div className="grid grid-cols-2 gap-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              </div>
            ) : (
              <DashboardCompletionWidget {...taskSummary} />
            )}
          </div>
        </div>

      </WidgetSection> : <div aria-hidden="true" className="mt-8 min-h-[360px] rounded-2xl bg-zinc-100/55 dark:bg-zinc-900/35 sm:mt-10" />}

      {activityPanelsReady ? <WidgetSection id="dashboard-activity-section-title" title="Atividade e carteira" className="mt-8 sm:mt-10" contentClassName="grid grid-cols-1 gap-6 xl:grid-cols-12">
        
        {/* Atividades Recentes (span 8) */}
        <div
          className="geo-card col-span-1 flex h-[420px] flex-col p-5 sm:h-[460px] sm:p-6 lg:p-8 xl:col-span-8"
        >
          <RecentActivities />
        </div>

        {/* Distribuição de Projetos (span 4) */}
        <div
          className="geo-card col-span-1 flex min-h-[380px] flex-col p-5 sm:min-h-[460px] sm:p-6 lg:p-8 xl:col-span-4"
          aria-busy={overviewFetching}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center">
                  <img src={blueprintIcon} alt="" className="h-8 w-8 object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text-primary">Distribuição de projetos</h3>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {projectScope === 'active'
                      ? `Carteira atual · ${(filteredOverview?.projectsInScope ?? 0).toLocaleString('pt-BR')} ${(filteredOverview?.projectsInScope ?? 0) === 1 ? 'projeto ativo' : 'projetos ativos'}`
                      : `Todos os projetos · ${(filteredOverview?.projectsInScope ?? 0).toLocaleString('pt-BR')} cadastrados`}
                  </p>
                </div>
              </div>
              <MetricDefinition label="Como a distribuição de projetos é calculada">
                A carteira atual exclui projetos concluídos, finalizados, cancelados, arquivados e registros excluídos. O escopo “Todos os projetos” inclui os demais registros históricos, mas nunca os excluídos.
              </MetricDefinition>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="dashboard-project-scope" className="sr-only">Escopo da distribuição de projetos</label>
              <FormSelect
                id="dashboard-project-scope"
                name="dashboardProjectScope"
                aria-label="Escopo da distribuição de projetos"
                value={projectScope}
                onChange={(event) => updateDashboardFilters({ projetosEscopo: event.target.value, projetosTipo: null })}
                wrapperClassName="min-w-[138px] flex-1"
                className="geo-focus-ring"
                searchable={false}
              >
                <option value="active">Carteira atual</option>
                <option value="all">Todos os projetos</option>
              </FormSelect>
              <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60" role="group" aria-label="Agrupamento da distribuição de projetos">
                <button
                  type="button"
                  onClick={() => updateDashboardFilters({ projetosAgrupamento: 'macro' })}
                  aria-pressed={projetoFilterMode === 'macro'}
                  className={`geo-focus-ring rounded-lg px-3 py-1 text-[10px] font-medium transition-[color,background-color,box-shadow] ${projetoFilterMode === 'macro' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-white'}`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => updateDashboardFilters({ projetosAgrupamento: 'unitario' })}
                  aria-pressed={projetoFilterMode === 'unitario'}
                  className={`geo-focus-ring rounded-lg px-3 py-1 text-[10px] font-medium transition-[color,background-color,box-shadow] ${projetoFilterMode === 'unitario' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-white'}`}
                >
                  Unitário
                </button>
              </div>
              
              {projetoFilterMode === 'unitario' && availableProjectTypes.length > 0 && (
                <FormSelect
                  aria-label="Filtrar distribuição por tipo de projeto"
                  name="dashboardProjectType"
                  value={effectiveProjetoTipo}
                  onChange={(event) => updateDashboardFilters({ projetosTipo: event.target.value })}
                  wrapperClassName="w-full"
                  className="geo-focus-ring cursor-pointer animate-in rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] font-medium text-text-primary transition-[border-color,box-shadow] duration-200 fade-in zoom-in-95 dark:border-zinc-700/80 dark:bg-zinc-800/60"
                >
                  {availableProjectTypes.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </FormSelect>
              )}
            </div>
          </div>
          <div className="flex min-h-[180px] flex-1 flex-col justify-center py-2" aria-live="polite">
            {!filteredOverview ? (
              <div aria-hidden="true" className="h-full rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40" />
            ) : projectDistributionTotal === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <img src={blueprintIcon} alt="" className="h-10 w-10 opacity-45 grayscale" />
                <p className="mt-3 text-sm font-semibold text-text-secondary">Nenhum projeto neste escopo.</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-text-muted">Selecione outro escopo ou cadastre um novo projeto para preencher o gráfico.</p>
              </div>
            ) : projetosStatusData.length <= 3 ? (
              <DashboardProjectDistributionWidget items={projetosStatusData} total={projectDistributionTotal} />
            ) : projectChartReady ? (
              <div
                className="relative mx-auto min-h-[164px] max-h-[240px] w-full max-w-[240px] flex-1"
                role="img"
                aria-label={`Distribuição de ${projectDistributionTotal} ${projectDistributionTotal === 1 ? 'projeto' : 'projetos'} no escopo selecionado`}
              >
                <ResponsiveContainer {...responsiveChartProps}>
                  <PieChart>
                    <Pie
                      data={projetosStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius="48%"
                      outerRadius="78%"
                      paddingAngle={0}
                      cornerRadius={0}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                      isAnimationActive={false}
                      onMouseEnter={(_, index) => setActiveProjectStatusIndex(index)}
                      onMouseLeave={() => setActiveProjectStatusIndex(null)}
                    >
                      {projetosStatusData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={getStatusColor(entry.name, index)}
                          style={chartSegmentStyle(Boolean(reduceMotion), activeProjectStatusIndex !== null && activeProjectStatusIndex !== index)}
                        />
                      ))}
                    </Pie>
                    <text
                      x="50%"
                      y="47%"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="hsl(var(--text-primary))"
                      className="text-[2rem] font-bold tabular-nums"
                    >
                      {projectDistributionTotal}
                    </text>
                    <text
                      x="50%"
                      y="57%"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={chartTextColor}
                      className="text-xs font-medium"
                    >
                      {projectDistributionTotal === 1 ? 'Projeto' : 'Projetos'}
                    </text>
                    <RechartsTooltip content={<DynamicTooltip formatter={(value) => {
                      const percent = projectDistributionTotal > 0 ? projectPercentFormatter.format(value / projectDistributionTotal) : '0%';
                      return `${value.toLocaleString('pt-BR')} ${value === 1 ? 'projeto' : 'projetos'} · ${percent}`;
                    }} />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="sr-only">
                  {projetosStatusData.map((item) => (
                    <li key={item.name}>
                      {item.name}: {item.value.toLocaleString('pt-BR')} ({projectDistributionTotal > 0 ? projectPercentFormatter.format(item.value / projectDistributionTotal) : '0%'})
                    </li>
                  ))}
                </ul>
              </div>
            ) : <div aria-hidden="true" className="h-full rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40" />}
          </div>
          {projectDistributionTotal > 0 && (
            <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800/80">
              <div className="font-medium leading-none text-text-primary">Base de cálculo</div>
              <p className="leading-5 text-text-secondary">
                {projetoFilterMode === 'macro'
                  ? projectScope === 'active'
                    ? `${projectDistributionTotal.toLocaleString('pt-BR')} ${projectDistributionTotal === 1 ? 'projeto ativo' : 'projetos ativos'}, agrupados por categoria.`
                    : `${projectDistributionTotal.toLocaleString('pt-BR')} ${projectDistributionTotal === 1 ? 'projeto cadastrado' : 'projetos cadastrados'}, agrupados por categoria.`
                  : `${projectDistributionTotal.toLocaleString('pt-BR')} ${projectDistributionTotal === 1 ? 'projeto' : 'projetos'} do tipo ${effectiveProjetoTipo}, agrupados por status.`}
              </p>
            </div>
          )}
        </div>
      </WidgetSection> : <div aria-hidden="true" className="mt-8 min-h-[420px] rounded-2xl bg-zinc-100/55 dark:bg-zinc-900/35 sm:mt-10" />}
    </Layout>
  );
}
