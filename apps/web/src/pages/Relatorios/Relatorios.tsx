import type { ManagerialReport } from '@geogestor/contracts';
import {
  ArrowClockwise,
  Briefcase,
  CalendarBlank,
  CaretDown,
  CheckCircle,
  Coins,
  Compass,
  DownloadSimple,
  FileText,
  Hourglass,
  Printer,
  TrendDown,
  TrendUp,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, ComposedChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ExpenseCategoryChart } from '../../components/charts/ExpenseCategoryChart';
import { ProjectBreakdownChart } from '../../components/charts/ProjectBreakdownChart';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { DatePickerField } from '../../components/Form';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { KpiTransparency, type KpiCompositionItem } from '../../components/KpiTransparency';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { chartColors } from '../../data/chart-colors';
import { chartBorder, chartCursor, chartLegendStyle, chartTextColor, responsiveChartProps } from '../../utils/chartHelpers';
import { headerPrimaryActionButtonClass, headerPrimaryActionIconClass } from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import { RelatorioExecutivo } from './RelatorioExecutivo';
import { ReportAlerts } from './ReportAlerts';
import { ReportTabs } from './ReportTabs';
import { buildReportDocumentModel } from './reportDocumentModel';
import {
  REPORT_PERIOD_PRESETS,
  activeReportPeriodPreset,
  reportPeriodGuidance,
  reportPeriodPresetRange,
  type ReportPeriodPreset
} from './reportPeriodPresets';
import {
  comparisonText,
  formatCurrency,
  formatDate,
  formatMonth,
  formatNumber,
  REPORT_TYPES,
  type ReportType
} from './reportPresentation';

const EMPTY_REPORT_COPY: Record<ReportType, {
  sourceTitle: string;
  sourceDescription: string;
  periodTitle: string;
}> = {
  financeiro: {
    sourceTitle: 'Ainda não há dados financeiros para analisar',
    sourceDescription: 'Cadastre orçamentos, recebimentos ou despesas para gerar sua primeira leitura financeira.',
    periodTitle: 'Nenhum resultado financeiro neste período'
  },
  projetos: {
    sourceTitle: 'Ainda não há projetos para analisar',
    sourceDescription: 'Cadastre projetos e seus prazos para acompanhar a carteira e a capacidade operacional.',
    periodTitle: 'Nenhum projeto encontrado neste período'
  },
  executivo: {
    sourceTitle: 'Ainda não há dados para a síntese executiva',
    sourceDescription: 'Cadastre projetos e movimentos financeiros para consolidar prioridades e próximos passos.',
    periodTitle: 'Nenhum dado executivo neste período'
  }
};
const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  style: 'currency',
  currency: 'BRL'
});

const REPORT_PERIOD_OPTIONS = [
  ...REPORT_PERIOD_PRESETS,
  { id: 'custom' as const, label: 'Personalizado' }
];

function KpiCard({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
  transparency
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  transparency?: {
    definition: string; period: string; recordCount: number; updatedAt: string;
    records?: KpiCompositionItem[]; warnings?: string[];
  };
}) {
  const toneClass = {
    neutral: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200',
    positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
    danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
  }[tone];
  return (
    <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{label}</p>
        <span aria-hidden="true" className={cn('rounded-lg p-2', toneClass)}>{icon}</span>
      </div>
      <p className="mt-5 truncate text-3xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-2 min-h-10 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{detail}</p>
      {transparency && <KpiTransparency {...transparency} total={value} />}
    </article>
  );
}

function FinancialReport({ report }: { report: ManagerialReport }) {
  const reduceMotion = useReducedMotion();
  const { kpis, previous, monthly, expensesByCategory, alerts } = report.financial;
  const cashChartData = monthly.map((item) => ({
    name: formatMonth(item.month),
    Recebido: item.receivedRevenue / 100,
    Despesas: item.paidExpenses / 100,
    Resultado: item.cashResult / 100
  }));
  return (
    <div className="space-y-6">
      <section aria-labelledby="financial-kpis-title">
        <h2 id="financial-kpis-title" className="mb-4 text-lg font-semibold text-zinc-950 dark:text-white">Caixa e recebíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Receita recebida"
            value={formatCurrency(kpis.receivedRevenue)}
            detail={comparisonText(kpis.receivedRevenue, previous?.receivedRevenue)}
            icon={<Coins size={20} />}
            tone="positive"
            transparency={{
              definition: report.period.rules.receivedRevenue,
              period: report.period.label,
              recordCount: report.state.filteredRecordCount,
              updatedAt: report.generatedAt,
              records: monthly.map((item) => ({ id: item.month, label: formatMonth(item.month), value: formatCurrency(item.receivedRevenue) }))
            }}
          />
          <KpiCard
            label="Receita pendente"
            value={formatCurrency(kpis.pendingRevenue)}
            detail={`${formatCurrency(kpis.overdueRevenue)} já vencidos`}
            icon={<Hourglass size={20} />}
            tone={kpis.overdueRevenue > 0 ? 'warning' : 'neutral'}
            transparency={{
              definition: report.period.rules.pendingRevenue,
              period: report.period.label,
              recordCount: report.state.filteredRecordCount,
              updatedAt: report.generatedAt,
              warnings: kpis.overdueRevenue > 0 ? [`${formatCurrency(kpis.overdueRevenue)} estão vencidos.`] : []
            }}
          />
          <KpiCard
            label="Despesas pagas"
            value={formatCurrency(kpis.paidExpenses)}
            detail={comparisonText(kpis.paidExpenses, previous?.paidExpenses)}
            icon={<TrendDown size={20} />}
            tone="danger"
            transparency={{
              definition: report.period.rules.paidExpenses,
              period: report.period.label,
              recordCount: report.state.filteredRecordCount,
              updatedAt: report.generatedAt,
              records: monthly.map((item) => ({ id: item.month, label: formatMonth(item.month), value: formatCurrency(item.paidExpenses) }))
            }}
          />
          <KpiCard
            label="Resultado de caixa"
            value={formatCurrency(kpis.cashResult)}
            detail={comparisonText(kpis.cashResult, previous?.cashResult)}
            icon={kpis.cashResult >= 0 ? <TrendUp size={20} /> : <TrendDown size={20} />}
            tone={kpis.cashResult >= 0 ? 'positive' : 'danger'}
            transparency={{
              definition: 'Recebimentos confirmados menos despesas pagas no período.',
              period: report.period.label,
              recordCount: report.state.filteredRecordCount,
              updatedAt: report.generatedAt,
              records: monthly.map((item) => ({ id: item.month, label: formatMonth(item.month), value: formatCurrency(item.cashResult) })),
              warnings: kpis.cashResult < 0 ? ['As saídas pagas superam os recebimentos confirmados.'] : []
            }}
          />
        </div>
      </section>

      <section aria-labelledby="commercial-kpis-title" className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 id="commercial-kpis-title" className="sr-only">Indicadores comerciais complementares</h2>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Receita contratada</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">{formatCurrency(kpis.contractedRevenue)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Impostos previstos</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">{formatCurrency(kpis.estimatedTaxes)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Conversão comercial</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">
            {kpis.conversionRate === null ? 'Sem base comparável' : `${formatNumber(kpis.conversionRate)}%`}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{kpis.approvedBudgets} aprovada(s) de {kpis.decidedBudgets} decidida(s)</p>
        </div>
      </section>

      <ReportAlerts alerts={alerts} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="cash-evolution-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="cash-evolution-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Evolução do caixa</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Entradas recebidas e despesas pagas por mês.</p>
          {monthly.length ? (
            <div className="mt-5 overflow-x-auto">
              <div role="img" aria-label="Gráfico da evolução mensal do caixa" className="h-72 min-w-[520px]">
                <ResponsiveContainer {...responsiveChartProps}>
                  <ComposedChart data={cashChartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTextColor, fontSize: 11 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartTextColor, fontSize: 10 }}
                      tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))}
                    />
                    <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                    <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
                    <Bar dataKey="Recebido" fill={chartColors.positive} radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={!reduceMotion} />
                    <Bar dataKey="Despesas" fill={chartColors.negative} radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={!reduceMotion} />
                    <Line type="monotone" dataKey="Resultado" stroke={chartColors.primary} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={!reduceMotion} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">Valores mensais exatos da evolução do caixa</caption>
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    <th className="pb-3">Mês</th>
                    <th className="pb-3 text-right">Recebido</th>
                    <th className="pb-3 text-right">Pago</th>
                    <th className="pb-3 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {monthly.map((item) => (
                    <tr key={item.month}>
                      <th scope="row" className="py-3 text-left font-medium text-zinc-900 dark:text-zinc-100">{formatMonth(item.month)}</th>
                      <td className="py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(item.receivedRevenue)}</td>
                      <td className="py-3 text-right tabular-nums text-rose-700 dark:text-rose-300">{formatCurrency(item.paidExpenses)}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-zinc-950 dark:text-white">{formatCurrency(item.cashResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">Nenhum movimento de caixa no período.</p>}
        </section>

        <section aria-labelledby="expense-distribution-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="expense-distribution-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Despesas por categoria</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Valores pagos e volume de lançamentos.</p>
          <ExpenseCategoryChart
            items={expensesByCategory.map((item) => ({
              name: item.category,
              value: item.paidTotal,
              count: item.count
            }))}
            emptyMessage="Nenhuma despesa paga no período."
          />
        </section>
      </div>
    </div>
  );
}

function OperationalReport({ report }: { report: ManagerialReport }) {
  const { kpis, previousCompletedProjects, byStatus, byType, byMunicipality, deadlines, alerts } = report.operational;
  return (
    <div className="space-y-6">
      <section aria-labelledby="operational-kpis-title">
        <h2 id="operational-kpis-title" className="mb-4 text-lg font-semibold text-zinc-950 dark:text-white">Carteira de projetos</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Projetos ativos" value={String(kpis.activeProjects)} detail={`${kpis.totalProjects} projeto(s) no recorte`} icon={<Briefcase size={20} />} />
          <KpiCard
            label="Concluídos"
            value={String(kpis.completedProjects)}
            detail={previousCompletedProjects === null ? 'Sem período anterior comparável' : `${previousCompletedProjects} no período anterior`}
            icon={<CheckCircle size={20} />}
            tone="positive"
          />
          <KpiCard
            label="Prazos vencidos"
            value={String(kpis.overdueProjects)}
            detail={`${kpis.dueSoonProjects} entrega(s) nos próximos 30 dias`}
            icon={<CalendarBlank size={20} />}
            tone={kpis.overdueProjects ? 'danger' : 'positive'}
          />
          <KpiCard
            label="Área ativa conhecida"
            value={kpis.activeAreaHa === null ? 'Não informada' : `${formatNumber(kpis.activeAreaHa)} ha`}
            detail={`${kpis.projectsWithKnownArea} projeto(s) ativo(s) com área`}
            icon={<Compass size={20} />}
          />
        </div>
      </section>

      <ReportAlerts alerts={alerts} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="project-distribution-title" className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="project-distribution-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Distribuição da carteira</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Breakdown title="Por status" rows={byStatus} chartLabel="Gráfico de projetos por status" color={chartColors.primary} />
            <Breakdown title="Por tipo" rows={byType} chartLabel="Gráfico de projetos por tipo" color={chartColors.secondary} />
          </div>
          <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <Breakdown title="Principais municípios" rows={byMunicipality.slice(0, 6)} chartLabel="Gráfico dos principais municípios dos projetos" color={chartColors.positive} />
          </div>
        </section>
        <section aria-labelledby="deadlines-title" className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="deadlines-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Agenda crítica de entregas</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Projetos vencidos ou com entrega nos próximos 30 dias.</p>
          {deadlines.length ? (
            <ul className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
              {deadlines.slice(0, 8).map((deadline) => (
                <li key={deadline.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link to={`/projetos/${deadline.id}`} className="geo-focus-ring truncate rounded font-medium text-indigo-700 hover:underline dark:text-indigo-200">
                      {deadline.name}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Entrega em {formatDate(deadline.dueDate)}</p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
                    deadline.daysUntilDue < 0
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
                  )}>
                    {deadline.daysUntilDue < 0 ? `${Math.abs(deadline.daysUntilDue)} dia(s) atrasado` : `${deadline.daysUntilDue} dia(s)`}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">Nenhuma entrega crítica no recorte.</p>}
        </section>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  chartLabel,
  color
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  chartLabel: string;
  color: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {rows.length ? (
        <>
          <ProjectBreakdownChart rows={rows} ariaLabel={chartLabel} color={color} />
          <ul className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {rows.map((row) => (
              <li key={row.label}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{row.label}</span>
                  <span className="font-semibold tabular-nums text-zinc-950 dark:text-white">{row.count}</span>
                </div>
                <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full" style={{ width: `${row.count / total * 100}%`, backgroundColor: color }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Sem dados.</p>}
    </div>
  );
}

function ReportDocument({ report, type }: { report: ManagerialReport; type: ReportType }) {
  const model = buildReportDocumentModel(report, type);
  return (
    <article data-report-document className="mx-auto max-w-4xl rounded-2xl bg-white p-6 text-zinc-950 ring-1 ring-zinc-200 sm:p-10 print:max-w-none print:rounded-none print:p-0 print:ring-0">
      <header className="flex flex-col gap-4 border-b border-zinc-300 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">GeoGestor · Relatório gerencial</p>
          <h2 className="mt-2 text-2xl font-semibold">{model.title}</h2>
          <p className="mt-1 text-sm text-zinc-600">Período: {model.period}</p>
        </div>
        <p className="text-sm text-zinc-600">Emitido em {model.issuedAt}</p>
      </header>
      {model.sections.map((section, sectionIndex) => (
        <section key={section.title} aria-labelledby={`document-section-${sectionIndex}`} className="mt-7 break-inside-avoid">
          <h3 id={`document-section-${sectionIndex}`} className="text-base font-semibold">{section.title}</h3>
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody className="divide-y divide-zinc-200">
              {section.rows.map(({ label, value }) => (
                <tr key={label}>
                  <th scope="row" className="py-3 text-left font-medium text-zinc-700">{label}</th>
                  <td className="py-3 text-right font-semibold tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <section className="mt-7 border-t border-zinc-300 pt-5 text-xs leading-5 text-zinc-600">
        <h3 className="font-semibold text-zinc-800">Critérios do recorte</h3>
        {model.criteria.map((criterion, index) => <p key={criterion} className={index === 0 ? 'mt-1' : undefined}>{criterion}</p>)}
      </section>
    </article>
  );
}

export function Relatorios() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportType: ReportType = REPORT_TYPES.includes(searchParams.get('tipo') as ReportType)
    ? searchParams.get('tipo') as ReportType
    : 'financeiro';
  const startDate = searchParams.get('inicio') || '';
  const endDate = searchParams.get('fim') || '';
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const matchedPreset = activeReportPeriodPreset(startDate, endDate);
  const customPeriodSelected = searchParams.get('periodo') === 'personalizado'
    || (Boolean(startDate || endDate) && !matchedPreset);
  const activePeriodOption = customPeriodSelected ? 'custom' : matchedPreset;
  const periodGuidance = reportPeriodGuidance(startDate, endDate);
  const endpointParams = new URLSearchParams();
  if (startDate) endpointParams.set('inicio', startDate);
  if (endDate) endpointParams.set('fim', endDate);

  const reportQuery = useQuery<ManagerialReport>({
    queryKey: ['relatorio-geral', startDate || null, endDate || null],
    queryFn: () => apiClient.get<ManagerialReport>(
      `/api/relatorios/geral${endpointParams.size ? `?${endpointParams.toString()}` : ''}`
    ),
    enabled: !invalidRange,
    retry: false,
    staleTime: 30_000
  });
  const report = reportQuery.data;

  const updateCustomDate = (name: 'inicio' | 'fim', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    next.set('periodo', 'personalizado');
    setSearchParams(next, { replace: true });
  };
  const setReportType = (type: ReportType) => {
    const next = new URLSearchParams(searchParams);
    if (type === 'financeiro') next.delete('tipo');
    else next.set('tipo', type);
    setSearchParams(next, { replace: true });
  };
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('inicio');
    next.delete('fim');
    next.set('periodo', 'personalizado');
    setSearchParams(next, { replace: true });
  };
  const selectCustomPeriod = () => {
    const next = new URLSearchParams(searchParams);
    next.set('periodo', 'personalizado');
    setSearchParams(next, { replace: true });
  };
  const applyPeriodPreset = (preset: ReportPeriodPreset) => {
    const range = reportPeriodPresetRange(preset);
    const next = new URLSearchParams(searchParams);
    if (range.startDate) next.set('inicio', range.startDate);
    else next.delete('inicio');
    if (range.endDate) next.set('fim', range.endDate);
    else next.delete('fim');
    next.delete('periodo');
    setSearchParams(next, { replace: true });
  };
  const handlePdf = async () => {
    if (!report || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const { createManagerialReportPdf } = await import('./reportPdfGenerator');
      await createManagerialReportPdf(report, reportType);
      toast.success('PDF gerado com os filtros aplicados.');
    } catch {
      toast.error('Não foi possível gerar o PDF. Revise a identidade visual e tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const handlePrint = () => {
    setPreviewOpen(true);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  };

  const hasTypeData = reportType === 'financeiro'
    ? Boolean(report && (
      report.financial.kpis.receivedRevenue
      || report.financial.kpis.paidExpenses
      || report.financial.kpis.pendingRevenue
      || report.financial.kpis.decidedBudgets
      || report.financial.monthly.length
    ))
    : reportType === 'projetos'
      ? Boolean(report?.operational.kpis.totalProjects)
      : Boolean(report?.state.hasFilteredData);
  const emptyCopy = EMPTY_REPORT_COPY[reportType];

  return (
    <Layout printContentOnly>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Análise e decisão"
          title="Relatórios"
          description="Acompanhe caixa, carteira de projetos e prioridades com critérios consistentes em todo o sistema."
          action={
            <button
              type="button"
              onClick={handlePdf}
              disabled={!report || reportQuery.isLoading || isGeneratingPdf}
              aria-describedby="report-pdf-status"
              className={cn(headerPrimaryActionButtonClass, 'disabled:cursor-not-allowed disabled:opacity-50')}
            >
              <span>{isGeneratingPdf ? 'Gerando PDF…' : 'Exportar PDF'}</span>
              <span className={headerPrimaryActionIconClass}>
                <DownloadSimple aria-hidden="true" className="h-4 w-4" weight="bold" />
              </span>
            </button>
          }
        />
        <p id="report-pdf-status" aria-live="polite" className="sr-only">
          {isGeneratingPdf ? 'Preparando o arquivo PDF. Aguarde…' : ''}
        </p>

        <div className="mb-4 space-y-4">
          <section aria-labelledby="period-filter-title" className="rounded-2xl border border-zinc-200 bg-white p-4 sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="min-w-0">
              <h2 id="period-filter-title" className="text-sm font-semibold text-zinc-950 dark:text-white">Período de análise</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">O recorte altera indicadores, comparações, tabelas e o PDF.</p>
            </div>

            <div
              role="group"
              aria-label="Atalhos de período"
              className="mt-3 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {REPORT_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={activePeriodOption === option.id}
                  aria-expanded={option.id === 'custom' ? customPeriodSelected : undefined}
                  aria-controls={option.id === 'custom' ? 'custom-period-fields' : undefined}
                  onClick={() => option.id === 'custom' ? selectCustomPeriod() : applyPeriodPreset(option.id)}
                  className={cn(
                    'geo-focus-ring min-h-10 shrink-0 rounded-lg border px-3.5 text-xs font-semibold transition-[background-color,border-color,color] motion-reduce:transition-none',
                    activePeriodOption === option.id
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {customPeriodSelected ? (
              <div id="custom-period-fields" className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800 sm:flex-row sm:items-end">
                <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Data inicial
                    <DatePickerField
                      name="report-start-date"
                      autoComplete="off"
                      value={startDate}
                      max={endDate || undefined}
                      onChange={(event) => updateCustomDate('inicio', event.target.value)}
                      className={cn(geoFieldClass, 'mt-1 h-11 min-h-11 w-full')}
                      aria-invalid={invalidRange}
                      aria-describedby={invalidRange ? 'report-period-error' : undefined}
                    />
                  </label>
                  <label className="min-w-0 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Data final
                    <DatePickerField
                      name="report-end-date"
                      autoComplete="off"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => updateCustomDate('fim', event.target.value)}
                      className={cn(geoFieldClass, 'mt-1 h-11 min-h-11 w-full')}
                      aria-invalid={invalidRange}
                      aria-describedby={invalidRange ? 'report-period-error' : undefined}
                    />
                  </label>
                </div>
                {startDate || endDate ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="geo-focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    Limpar período
                  </button>
                ) : null}
              </div>
            ) : null}
            {customPeriodSelected && invalidRange ? <p id="report-period-error" role="alert" className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-300">A data inicial deve ser anterior ou igual à data final.</p> : null}
            {customPeriodSelected && !invalidRange && periodGuidance ? (
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{periodGuidance}</p>
            ) : null}
          </section>

          <ReportTabs value={reportType} onChange={setReportType} />
        </div>
      </div>

      <section
        id="report-panel"
        role="tabpanel"
        aria-labelledby={`report-tab-${reportType}`}
        aria-live="polite"
        aria-busy={reportQuery.isLoading}
        data-report-type={reportType}
        className="min-w-0"
      >
        {reportQuery.isLoading ? (
          <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <span className="sr-only">Carregando relatório…</span>
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />)}
          </div>
        ) : reportQuery.isError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100">
            <h2 className="font-semibold">Não foi possível carregar o relatório</h2>
            <p className="mt-1 text-sm">{reportQuery.error instanceof Error ? reportQuery.error.message : 'Verifique o serviço local e tente novamente.'}</p>
            <button type="button" onClick={() => reportQuery.refetch()} className="geo-focus-ring mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
              <ArrowClockwise aria-hidden="true" size={16} />
              Tentar novamente
            </button>
          </div>
        ) : report && !report.state.hasSourceData ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-7 text-center dark:border-zinc-700 dark:bg-zinc-900 sm:px-8">
            <FileText aria-hidden="true" className="mx-auto text-zinc-400" size={32} />
            <h2 className="mt-3 font-semibold text-zinc-950 dark:text-white">{emptyCopy.sourceTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{emptyCopy.sourceDescription}</p>
            {reportType === 'financeiro' ? (
              <div className="mx-auto mt-5 flex max-w-2xl flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
                <Link
                  to="/orcamentos"
                  state={{ openCreateModal: true }}
                  className="geo-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800"
                >
                  Cadastrar orçamento
                </Link>
                <Link
                  to="/financeiro?tab=faturas"
                  className="geo-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Registrar recebimento
                </Link>
                <Link
                  to="/financeiro?tab=pagar"
                  className="geo-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Adicionar despesa
                </Link>
              </div>
            ) : null}
          </div>
        ) : report && !hasTypeData ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <CalendarBlank aria-hidden="true" className="mx-auto text-zinc-400" size={32} />
            <h2 className="mt-3 font-semibold text-zinc-950 dark:text-white">{emptyCopy.periodTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Ajuste as datas ou limpe o filtro para consultar todo o histórico.</p>
            <button type="button" onClick={clearFilters} className="geo-focus-ring mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10">
              Limpar período
            </button>
          </div>
        ) : report ? (
          <>
            <div className="print:hidden">
              {reportType === 'financeiro'
                ? <FinancialReport report={report} />
                : reportType === 'projetos'
                  ? <OperationalReport report={report} />
                  : <RelatorioExecutivo report={report} />}

              <section className="mt-8 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    aria-expanded={previewOpen}
                    aria-controls="report-print-preview"
                    onClick={() => setPreviewOpen((open) => !open)}
                    className="geo-focus-ring inline-flex items-center gap-2 rounded-lg text-left text-sm font-semibold text-zinc-900 hover:text-indigo-700 dark:text-zinc-100 dark:hover:text-indigo-200"
                  >
                    <CaretDown aria-hidden="true" className={cn('transition-transform motion-reduce:transition-none', previewOpen && 'rotate-180')} size={18} />
                    Pré-visualização do documento
                  </button>
                  <button type="button" onClick={handlePrint} className="geo-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                    <Printer aria-hidden="true" size={17} />
                    Imprimir
                  </button>
                </div>
                {previewOpen ? (
                  <div id="report-print-preview" className="border-t border-zinc-200 bg-zinc-100 p-3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
                    <ReportDocument report={report} type={reportType} />
                  </div>
                ) : null}
              </section>
            </div>
            <div className="hidden print:block">
              <ReportDocument report={report} type={reportType} />
            </div>
          </>
        ) : null}
      </section>
    </Layout>
  );
}
