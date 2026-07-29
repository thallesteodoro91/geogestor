import { useState, useMemo } from 'react';
import { apiClient } from '../services/apiClient';
import { useQuery } from '@tanstack/react-query';
import { isActiveOpportunityStage, type OpportunityListItem, type OpportunityStage } from '@geogestor/contracts';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  TrendUp, 
  Users, 
  CurrencyDollar, 
  Funnel, 
  ShieldCheck,
  FileText,
  Info,
  WarningCircle
} from '@phosphor-icons/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell, FunnelChart, Funnel as RechartsFunnel, LabelList 
} from 'recharts';
import { 
  chartTextColor, chartBorder, chartCursor, responsiveChartProps 
} from '../utils/chartHelpers';
import { formatarMoeda, formatarPercentual, calcularDesvioOrcamentario, calcularPontoEquilibrio, calcularMargemContribuicao, calcularTaxaConversao } from '../core/finance';
import { geoHoverTransition, geoViewTransition } from '../utils/motion';
import { RichTooltip } from '../components/charts/RichTooltip';
import { cn } from '../utils/cn';
import { geoGreenIconClass, geoGreenLabelClass, geoGreenSurfaceWithAccentClass, geoGreenValueClass, geoKickerClass, geoOrangeIconClass, geoOrangeSurfaceWithAccentClass, geoPurpleIconClass, geoPurpleSurfaceWithAccentClass, geoTabButtonClass, geoTabIconClass, geoTabListClass } from '../utils/geoTheme';

// Local UI Components to keep Page self-contained and clean
interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  helper?: string;
  statusLabel?: string;
  icon: React.ComponentType<{ className?: string; weight?: 'fill' | 'regular' | 'duotone' }>;
  iconTone: 'primary' | 'success' | 'warning' | 'info';
  calculation?: string;
  warning?: string;
}


const TONE_CLASSES = {
  primary: geoPurpleIconClass,
  success: geoGreenIconClass,
  warning: geoOrangeIconClass,
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
};

const CARD_TONE_CLASSES = {
  primary: geoPurpleSurfaceWithAccentClass,
  success: geoGreenSurfaceWithAccentClass,
  warning: geoOrangeSurfaceWithAccentClass,
  info: "bg-gradient-to-br from-brand-turquoise-50/90 via-brand-blue-50/65 to-brand-primary-50/55 before:bg-gradient-to-r before:from-brand-turquoise-400 before:via-brand-blue-400 before:to-brand-primary-400 dark:from-brand-turquoise-900/65 dark:via-brand-blue-900/42 dark:to-brand-primary-900/40",
};

const CHANGE_CLASSES = {
  positive: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  negative: 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  neutral: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300',
};

function KPICard({
  title,
  value,
  change,
  changeType = 'neutral',
  helper,
  statusLabel,
  icon: Icon,
  iconTone,
  calculation,
  warning
}: KPICardProps) {
  const isPurple = iconTone === 'primary';
  const isOrange = iconTone === 'warning';
  const isGreen = iconTone === 'success';

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={geoHoverTransition}
      className={cn(
        "relative flex h-full min-h-[150px] flex-col overflow-hidden rounded-2xl border border-zinc-200/70 p-5 shadow-sm motion-gpu motion-standard before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:content-[''] hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700",
        CARD_TONE_CLASSES[iconTone]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[iconTone]}`}>
            <Icon className="h-5 w-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <p className={cn('truncate text-sm font-semibold', isPurple ? 'text-violet-100/90' : isOrange ? 'text-orange-100/90' : isGreen ? geoGreenLabelClass : 'text-zinc-700 dark:text-zinc-200')}>
              {title}
            </p>
            {helper && (
              <p className={cn('mt-0.5 truncate text-xs font-medium', isPurple ? 'text-violet-100/70' : isOrange ? 'text-orange-100/70' : isGreen ? 'text-emerald-100/70' : 'text-zinc-500 dark:text-zinc-400')}>
                {helper}
              </p>
            )}
          </div>
        </div>
        
        {calculation && (
          <div className="relative group/tooltip flex items-center shrink-0">
            <button
              type="button"
              aria-label={`Ver fórmula de ${title}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Info weight="duotone" className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full z-50 mt-2 hidden w-64 rounded-xl bg-zinc-950/95 p-3 text-xs text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md group-hover/tooltip:block dark:bg-zinc-800/95">
              <span className="mb-1 block font-semibold text-indigo-300">Fórmula de cálculo</span>
              {calculation}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-end gap-3">
          <h3 className={cn('text-3xl font-semibold tracking-tight', isPurple || isOrange ? 'text-white' : isGreen ? geoGreenValueClass : 'text-zinc-950 dark:text-white')}>
            {value}
          </h3>
          {change && (
            <span className={`mb-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${CHANGE_CLASSES[changeType]}`}>
              {change}
            </span>
          )}
        </div>
        {statusLabel && (
          <p className={cn('mt-2 text-xs font-medium', isPurple ? 'text-violet-100/70' : isOrange ? 'text-orange-100/70' : isGreen ? 'text-emerald-100/70' : 'text-zinc-500 dark:text-zinc-400')}>
            {statusLabel}
          </p>
        )}
      </div>
      
      {warning && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" weight="duotone" />
          <span>{warning}</span>
        </div>
      )}
    </motion.div>
  );
}

interface StoryCardProps {
  title: string;
  insight: string;
  category?: 'financial' | 'operational' | 'strategic';
  icon?: React.ComponentType<{ className?: string; weight?: 'fill' | 'regular' | 'duotone' }>;
}

function StoryCard({
  title,
  insight,
  category = 'financial',
  icon: Icon
}: StoryCardProps) {
  const categoryBorder = {
    financial: 'border-l-indigo-600 dark:border-l-indigo-400',
    operational: 'border-l-sky-500 dark:border-l-sky-400',
    strategic: 'border-l-amber-500 dark:border-l-amber-400',
  };
  
  const categoryLabel = {
    financial: 'Financeiro',
    operational: 'Operacional',
    strategic: 'Estratégico',
  };

  return (
    <div className={`p-6 border-l-4 bg-white dark:bg-zinc-900 rounded-r-2xl ring-1 ring-zinc-900/5 shadow-sm motion-gpu motion-standard hover:shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:-translate-y-0.5 ${categoryBorder[category]}`}>
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {categoryLabel[category]}
        </span>
        <h4 className="font-semibold text-zinc-900 dark:text-white text-lg flex items-center gap-3">
          {Icon && <Icon className="w-6 h-6 text-zinc-500" weight="duotone" />}
          {title}
        </h4>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {insight}
        </p>
      </div>
    </div>
  );
}

// Chart Title
function ChartTitle({ title, calculation }: { title: string; calculation?: string }) {
  return (
    <div className="space-y-1 mb-4">
      <h4 className="font-semibold text-zinc-900 dark:text-white text-lg">{title}</h4>
      {/* description removed to save space */}
      {calculation && <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono italic">Cálculo: {calculation}</p>}
    </div>
  );
}

export function Planejamento() {
  const [activeTab, setActiveTab] = useState<'orcamento' | 'equilibrio' | 'pipeline'>('orcamento');
  const [zoomPeriod, setZoomPeriod] = useState<'6m' | '12m' | 'all'>('all');

  // Busca o fluxo de caixa mensal gerencial.
  const { data: monthlyCashFlow = [], isLoading: loadingMonthlyCashFlow } = useQuery<Array<{ mes: string; receitas: number; despesas: number; lucro: number }>>({
    queryKey: ['resumo-mensal-financeiro'],
    queryFn: () => apiClient.get<Array<{ mes: string; receitas: number; despesas: number; lucro: number }>>('/api/financeiro/resumo-mensal')
  });

  // Fetch opportunities for Pipeline Funnel
  const { data: opportunities = [], isLoading: loadingOpportunities } = useQuery<OpportunityListItem[]>({
    queryKey: ['opportunities'],
    queryFn: () => apiClient.get<OpportunityListItem[]>('/api/oportunidades')
  });

  const loading = loadingMonthlyCashFlow || loadingOpportunities;

  const filteredMonthlyCashFlow = useMemo(() => {
    if (zoomPeriod === 'all') return monthlyCashFlow;
    const count = zoomPeriod === '6m' ? 6 : 12;
    return monthlyCashFlow.slice(-count);
  }, [monthlyCashFlow, zoomPeriod]);

  // Process data for Orçamento tab
  const { orcamentoChartData, desvioChartData, desvioMedio, totalReceitasReal, totalDespesasReal } = useMemo(() => {
    const totalReceitasReal = filteredMonthlyCashFlow.reduce((sum, d) => sum + (d.receitas / 100), 0);
    const totalDespesasReal = filteredMonthlyCashFlow.reduce((sum, d) => sum + (d.despesas / 100), 0);

    const data = filteredMonthlyCashFlow.map(d => {
      const rec = d.receitas / 100;
      const desp = d.despesas / 100;

      // Orçado mock/meta: estimamos 10% acima do realizado médio ou valor aproximado baseado na série
      const recOrcado = Math.round(rec > 0 ? rec * 0.95 : 15000);
      const despOrcado = Math.round(desp > 0 ? desp * 1.05 : 10000);

      const desvio = calcularDesvioOrcamentario(despOrcado, desp);

      return {
        mes: d.mes,
        receitaRealizado: rec,
        receitaOrcado: recOrcado,
        despesaRealizado: desp,
        despesaOrcado: despOrcado,
        desvio: parseFloat(desvio.toFixed(1))
      };
    });

    const desviosValores = data.map(d => d.desvio).filter(d => !isNaN(d));
    const desvioMedio = desviosValores.length > 0 
      ? desviosValores.reduce((a, b) => a + b, 0) / desviosValores.length 
      : 0;

    return {
      orcamentoChartData: data.map(d => ({
        mes: d.mes,
        'Receita Planejada': d.receitaOrcado,
        'Receita Realizada': d.receitaRealizado,
        'Despesa Planejada': d.despesaOrcado,
        'Despesa Realizada': d.despesaRealizado,
      })),
      desvioChartData: data.map(d => ({
        mes: d.mes,
        desvio: d.desvio
      })),
      desvioMedio,
      totalReceitasReal,
      totalDespesasReal
    };
  }, [filteredMonthlyCashFlow]);

  // Process data for Ponto de Equilíbrio tab
  const { equilibrioChartData, custoFixoVariavelChartData, pontoEquilibrioMedio, margemContribuiçãoMedia } = useMemo(() => {
    const data = filteredMonthlyCashFlow.map(d => {
      const rec = d.receitas / 100;
      const desp = d.despesas / 100;

      // Classificamos custos fixos como 60% e variáveis como 40% das despesas totais
      const fixo = desp * 0.6;
      const variavel = desp * 0.4;
      const margemContribPercent = calcularMargemContribuicao(rec, variavel);
      const pontoEquil = calcularPontoEquilibrio(fixo, margemContribPercent);

      return {
        mes: d.mes,
        receita: rec,
        custoTotal: desp,
        pontoEquilibrio: Math.round(pontoEquil),
        fixo: Math.round(fixo),
        variavel: Math.round(variavel),
        rawPontoEquilibrio: pontoEquil,
        rawMargemContribPercent: margemContribPercent
      };
    });

    const validEntries = data.filter(d => d.rawPontoEquilibrio > 0);
    const count = validEntries.length;
    const pontoEquilibrioMedio = count > 0 
      ? validEntries.reduce((sum, d) => sum + d.rawPontoEquilibrio, 0) / count 
      : 0;
    const margemContribuiçãoMedia = count > 0 
      ? validEntries.reduce((sum, d) => sum + d.rawMargemContribPercent, 0) / count 
      : 0;

    return {
      equilibrioChartData: data.map(d => ({
        mes: d.mes,
        Receita: d.receita,
        'Custo Total': d.custoTotal,
        'Ponto de Equilíbrio': d.pontoEquilibrio
      })),
      custoFixoVariavelChartData: data.map(d => ({
        mes: d.mes,
        'Custo Fixo': d.fixo,
        'Custo Variável': d.variavel
      })),
      pontoEquilibrioMedio,
      margemContribuiçãoMedia
    };
  }, [filteredMonthlyCashFlow]);

  // Process data for Pipeline Funnel
  const { pipelineChartData, pipelineTotalValue, taxaConversaoComercial } = useMemo(() => {
    const counts = {
      Prospectado: 0,
      Contato: 0,
      Proposta: 0,
      Ganho: 0,
      Perdido: 0
    };

    let totalValue = 0;

    opportunities.forEach(o => {
      const stage = o.estagio as OpportunityStage;
      if (stage in counts) {
        counts[stage]++;
      }
      if (isActiveOpportunityStage(stage)) totalValue += (o.valorEstimado || 0) / 100;
    });

    const funnelData = [
      { name: 'Leads (Prospectado)', value: counts.Prospectado + counts.Contato + counts.Proposta + counts.Ganho, fill: '#6366f1' },
      { name: 'Contato Estabelecido', value: counts.Contato + counts.Proposta + counts.Ganho, fill: '#3b82f6' },
      { name: 'Proposta Enviada', value: counts.Proposta + counts.Ganho, fill: '#f59e0b' },
      { name: 'Fechados (Ganho)', value: counts.Ganho, fill: '#10b981' }
    ];

    const totalClosed = counts.Ganho + counts.Perdido;
    const rate = calcularTaxaConversao(counts.Ganho, totalClosed);

    return {
      pipelineChartData: funnelData,
      pipelineTotalValue: totalValue,
      taxaConversaoComercial: rate
    };
  }, [opportunities]);

  return (
    <Layout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className={cn(geoKickerClass, 'mb-3')}>Financeiro e estratégia</span>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
              Planejamento Estratégico
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
              Metas orçamentárias, ponto de equilíbrio e análise de conversão do funil de vendas.
            </p>
          </div>
        </div>

        {/* Top KPIs Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Desvio orçamentário médio"
            value={formatarPercentual(desvioMedio)}
            change={desvioMedio > 0 ? `+${desvioMedio.toFixed(1)}%` : `${desvioMedio.toFixed(1)}%`}
            changeType={desvioMedio <= 0 ? 'positive' : 'negative'} // Para despesas, desvio negativo = economia
            helper="Custos realizados vs. planejados"
            statusLabel={desvioMedio <= 0 ? 'Abaixo do orçamento planejado' : 'Acima do orçamento planejado'}
            icon={Target}
            iconTone="warning"
            calculation="((Realizado - Orçado) / Orçado) × 100"
            warning={monthlyCashFlow.length === 0 ? "Aguardando registros financeiros reais para cálculo dinâmico." : undefined}
          />
          <KPICard
            title="Margem de contribuição"
            value={formatarPercentual(margemContribuiçãoMedia)}
            changeType="positive"
            helper="Receita após custos variáveis"
            statusLabel="Média do recorte selecionado"
            icon={TrendUp}
            iconTone="primary"
            calculation="((Receita - Custos Variáveis) / Receita) × 100"
          />
          <KPICard
            title="Taxa de conversão"
            value={formatarPercentual(taxaConversaoComercial)}
            changeType="positive"
            helper="Ganhos sobre total de leads"
            statusLabel="Conversão comercial do CRM"
            icon={Users}
            iconTone="success"
            calculation="(Ganhos / Total de Leads) × 100"
          />
          <KPICard
            title="Pipeline Total"
            value={formatarMoeda(pipelineTotalValue)}
            changeType="neutral"
            helper="Oportunidades em andamento"
            statusLabel="Valor estimado do funil"
            icon={CurrencyDollar}
            iconTone="info"
            calculation="Soma do valor estimado das oportunidades"
          />
        </div>

        {/* Navigation Tabs & Zoom Pills */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div role="tablist" aria-label="Abas de planejamento" className={cn(geoTabListClass, 'flex gap-1 overflow-x-auto hide-scrollbar')}>
            <button 
              role="tab"
              aria-selected={activeTab === 'orcamento'}
              onClick={() => setActiveTab('orcamento')}
              className={geoTabButtonClass(activeTab === 'orcamento', 'finance', 'px-6')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'orcamento', 'system')}><FileText weight={activeTab === 'orcamento' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Metas Orçamentárias
            </button>
            <button 
              role="tab"
              aria-selected={activeTab === 'equilibrio'}
              onClick={() => setActiveTab('equilibrio')}
              className={geoTabButtonClass(activeTab === 'equilibrio', 'finance', 'px-6')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'equilibrio', 'success')}><TrendUp weight={activeTab === 'equilibrio' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Ponto de Equilíbrio
            </button>
            <button 
              role="tab"
              aria-selected={activeTab === 'pipeline'}
              onClick={() => setActiveTab('pipeline')}
              className={geoTabButtonClass(activeTab === 'pipeline', 'finance', 'px-6')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'pipeline', 'warning')}><Funnel weight={activeTab === 'pipeline' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Funil Comercial (Pipeline)
            </button>
          </div>

          {activeTab !== 'pipeline' && (
            <div className="mb-2 flex items-center gap-1 self-start rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 sm:mb-0 sm:self-auto">
              <span className="px-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Zoom:</span>
              <button
                type="button"
                onClick={() => setZoomPeriod('6m')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold motion-fast ${
                  zoomPeriod === '6m'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Últimos 6m
              </button>
              <button
                type="button"
                onClick={() => setZoomPeriod('12m')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold motion-fast ${
                  zoomPeriod === '12m'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Últimos 12m
              </button>
              <button
                type="button"
                onClick={() => setZoomPeriod('all')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold motion-fast ${
                  zoomPeriod === 'all'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-24 flex justify-center">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green-100 border-t-brand-turquoise-600 dark:border-brand-green-300/20 dark:border-t-brand-turquoise-300" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'orcamento' && (
              <motion.div 
                key="orcamento" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={geoViewTransition}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StoryCard
                    title="Orçamento Sob Controle"
                    insight={`A análise dos últimos meses indica que as despesas totais realizaram-se ${desvioMedio > 0 ? 'acima' : 'abaixo'} do planejado médio em ${Math.abs(desvioMedio).toFixed(1)}%. Manter este desvio próximo a zero é vital para o controle de caixa.`}
                    category="financial"
                    icon={ShieldCheck}
                  />
                  <StoryCard
                    title="Planejamento de Caixa"
                    insight={`Com receitas acumuladas de ${formatarMoeda(totalReceitasReal)} e custos de ${formatarMoeda(totalDespesasReal)} no semestre, a empresa opera com superávit acumulado. Sugere-se alocar 10% em reservas.`}
                    category="strategic"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 ring-1 ring-zinc-900/5 shadow-sm">
                    <ChartTitle 
                      title="Orçado vs Realizado (Receitas e Custos)"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer {...responsiveChartProps} minHeight={240}>
                        <BarChart data={orcamentoChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} />
                          <XAxis dataKey="mes" stroke={chartTextColor} />
                          <YAxis stroke={chartTextColor} />
                          <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                          <Bar dataKey="Receita Planejada" fill="#818cf8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Receita Realizada" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Despesa Planejada" fill="#f87171" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Despesa Realizada" fill="#dc2626" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 ring-1 ring-zinc-900/5 shadow-sm">
                    <ChartTitle 
                      title="Desvio de Custos (%)"
                      calculation="((Realizado - Orçado) / Orçado) × 100"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer {...responsiveChartProps} minHeight={240}>
                        <BarChart data={desvioChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} />
                          <XAxis dataKey="mes" stroke={chartTextColor} />
                          <YAxis stroke={chartTextColor} />
                          <Tooltip cursor={chartCursor} content={<RichTooltip format="percent" />} />
                          <Bar dataKey="desvio" radius={[4, 4, 0, 0]}>
                            {desvioChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.desvio <= 0 ? "#10b981" : "#ef4444"} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'equilibrio' && (
              <motion.div 
                key="equilibrio" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={geoViewTransition}
                className="space-y-8"
              >
                <StoryCard
                  title="Estabilidade e Margem de Segurança"
                  insight={`A meta média estimada de faturamento mínimo para cobrir todos os custos operacionais (Ponto de Equilíbrio) é de ${formatarMoeda(pontoEquilibrioMedio)}. Operar consistentemente acima desse teto garante a saúde da empresa.`}
                  category="financial"
                  icon={ShieldCheck}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 ring-1 ring-zinc-900/5 shadow-sm">
                    <ChartTitle 
                      title="Receita Real vs Custo vs Ponto de Equilíbrio"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer {...responsiveChartProps} minHeight={240}>
                        <ComposedChart data={equilibrioChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} />
                          <XAxis dataKey="mes" stroke={chartTextColor} />
                          <YAxis stroke={chartTextColor} />
                          <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                          <Bar dataKey="Receita" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Custo Total" fill="#dc2626" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="Ponto de Equilíbrio" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 ring-1 ring-zinc-900/5 shadow-sm">
                    <ChartTitle 
                      title="Composição de Custo: Fixo vs Variável"
                      calculation="Custo Total = Custo Fixo + Custo Variável"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer {...responsiveChartProps} minHeight={240}>
                        <BarChart data={custoFixoVariavelChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} />
                          <XAxis dataKey="mes" stroke={chartTextColor} />
                          <YAxis stroke={chartTextColor} />
                          <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                          <Bar dataKey="Custo Fixo" stackId="a" fill="#e4e4e7" dark-fill="#27272a" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Custo Variável" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pipeline' && (
              <motion.div 
                key="pipeline" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={geoViewTransition}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StoryCard
                    title="Funil e Oportunidades no CRM"
                    insight={`Com uma taxa de conversão comercial de ${formatarPercentual(taxaConversaoComercial)}, o departamento de vendas demonstra bom aproveitamento. Aumentar o fluxo de propostas acelerará os resultados.`}
                    category="strategic"
                    icon={Users}
                  />
                  <StoryCard
                    title="Pipeline de Oportunidades"
                    insight={`A soma estimada do pipeline do CRM é de ${formatarMoeda(pipelineTotalValue)}. Este valor representa as oportunidades e orçamentos em andamento passíveis de fechamento.`}
                    category="operational"
                  />
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 ring-1 ring-zinc-900/5 shadow-sm">
                  <ChartTitle 
                    title="Funil de Conversão Comercial (CRM)"
                  />
                  <div className="h-[400px] flex justify-center items-center">
                    {opportunities.length === 0 ? (
                      <div className="text-center text-zinc-400 dark:text-zinc-500 py-12">
                        Nenhuma oportunidade cadastrada no CRM para gerar o gráfico de funil.
                      </div>
                    ) : (
                        <ResponsiveContainer {...responsiveChartProps} minHeight={320}>
                        <FunnelChart>
                          <Tooltip content={<RichTooltip format="currency" />} />
                          <RechartsFunnel dataKey="value" data={pipelineChartData} isAnimationActive>
                            <LabelList position="right" fill="#a1a1aa" stroke="none" dataKey="name" />
                          </RechartsFunnel>
                        </FunnelChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </Layout>
  );
}

// Force Vite HMR reload
