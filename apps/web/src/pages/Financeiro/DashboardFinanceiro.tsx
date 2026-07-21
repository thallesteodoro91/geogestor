import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Treemap, PieChart, Pie, Cell
} from 'recharts';
import { 
  chartTextColor, chartBorder, chartLegendStyle, chartCursor, responsiveChartProps 
} from '../../utils/chartHelpers';
import { chartColors, colorblindSafeColors } from '../../data/chart-colors';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { 
  TrendUp, TrendDown, ShieldCheck, Wallet, CalendarBlank, Tag, ArrowUpRight, ArrowDownRight
} from '@phosphor-icons/react';
import {
  buildFinancialAnalytics,
  formatCurrencyFromCents,
  type ParcelaFinanceira,
} from '../../utils/financialAnalytics';
import { cn } from '../../utils/cn';
import { apiClient } from '../../services/apiClient';
import { isApprovedBudgetStatus } from '../../utils/budgetStatus';
import {
  geoGreenIconClass,
  geoGreenLabelClass,
  geoGreenSurfaceClass,
  geoGreenValueClass,
  geoKickerClass,
  geoPurpleLabelClass,
  geoPurpleSurfaceClass,
  geoPurpleValueClass
} from '../../utils/geoTheme';

interface Orcamento {
  id: string;
  clienteId: string;
  clienteNome?: string;
  projetoId?: string | null;
  projetoNome?: string | null;
  status: string;
  valorTotal: number;
  dataOrcamento?: string | null;
  createdAt?: string | null;
  possuiImposto?: boolean | number | null;
  impostoPorcentagem?: number | null;
}

interface Despesa {
  id: string;
  clienteId?: string | null;
  projetoId?: string | null;
  descricao?: string;
  categoria: string;
  valor: number;
  data?: string;
  dataPagamento?: string | null;
  status: string;
  tipoCusto?: string | null;
}

interface Cliente {
  id: string;
  nome: string;
}

interface Projeto {
  id: string;
  nome: string;
  clienteId?: string;
  clienteNome?: string;
}

interface TreemapContentProps {
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
}

const CustomTreemapContent = (props: TreemapContentProps) => {
  const { depth = 0, x = 0, y = 0, width = 0, height = 0, index = 0, name = '', value = 0 } = props;
  if (depth < 1 || !width || !height || width < 30 || height < 25) return null;
  const color = colorblindSafeColors[index % colorblindSafeColors.length];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={12}
        ry={12}
        fill={color}
        stroke={chartBorder}
        strokeWidth={3}
        fillOpacity={0.88}
        className="transition-all hover:opacity-100"
        style={{ cursor: 'pointer' }}
      />
      {width > 55 && height > 35 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontWeight="bold"
        >
          {name}
        </text>
      )}
      {width > 65 && height > 50 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.9)"
          fontSize={10}
          fontWeight="600"
        >
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0)}
        </text>
      )}
    </g>
  );
};

export function DashboardFinanceiro() {
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

  const { data: parcelas = [], isLoading: parcelasLoading } = useQuery<ParcelaFinanceira[]>({
    queryKey: ['parcelas-financeiro'],
    queryFn: () => apiClient.get<ParcelaFinanceira[]>('/api/financeiro/parcelas')
  });

  const loading = orcamentosLoading || despesasLoading || clientesLoading || projetosLoading || parcelasLoading;

  const analytics = buildFinancialAnalytics({
    orcamentos,
    despesas,
    parcelas,
    clientes,
    projetos,
  });

  // Process data locally (DRE approach)

  const totalContratado = analytics.kpis.receitaContratada / 100;
  const receitaLiquida = analytics.kpis.receitaLiquidaEstimada / 100;
  const totalDespesas = analytics.kpis.despesasPagas / 100;
  const totalDespesasLancadas = analytics.kpis.despesasLancadas / 100;
  
  const netProfit = analytics.kpis.resultadoCaixa / 100; // Fluxo de Caixa Livre
  const lucroOperacional = analytics.kpis.resultadoCompetencia / 100; // EBITDA / DRE
  
  const profitMargin = analytics.kpis.margemCaixa;
  const margemContribuicao = analytics.kpis.margemContribuicao;

  // Monthly DRE data mapping
  const monthlyChartData = analytics.monthly.map((d) => {
    return {
      mes: d.label.toUpperCase(),
      Recebido: d.receitaRecebida / 100,
      Contratado: d.receitaContratada / 100,
      Despesas: d.despesasPagas / 100,
      Resultado: d.resultadoCaixa / 100
    };
  });

  const [chartPeriod, setChartPeriod] = useState<'all' | '6m' | '3m'>('all');

  const filteredMonthlyData = (() => {
    if (chartPeriod === '3m') return monthlyChartData.slice(-3);
    if (chartPeriod === '6m') return monthlyChartData.slice(-6);
    return monthlyChartData;
  })();

  // Calculate profit per client
  const clientProfitMap = new Map<string, { nome: string, receita: number, despesa: number }>();

  // Add revenues per client
  orcamentos.forEach((orc) => {
    if (isApprovedBudgetStatus(orc.status)) {
      const clientName = orc.clienteNome || 'Cliente Não Identificado';
      const current = clientProfitMap.get(orc.clienteId) || { nome: clientName, receita: 0, despesa: 0 };
      current.receita += orc.valorTotal / 100;
      clientProfitMap.set(orc.clienteId, current);
    }
  });

  // Add expenses per client (by linking through projects)
  despesas.forEach((desp) => {
    if (desp.projetoId) {
      const linkedProj = projetos.find((p) => p.id === desp.projetoId);
      if (linkedProj && linkedProj.clienteId) {
        const clientName = linkedProj.clienteNome || clientes.find((c) => c.id === linkedProj.clienteId)?.nome || 'Cliente Não Identificado';
        const current = clientProfitMap.get(linkedProj.clienteId) || { nome: clientName, receita: 0, despesa: 0 };
        current.despesa += desp.valor / 100;
        clientProfitMap.set(linkedProj.clienteId, current);
      }
    }
  });

  const clientProfitData = analytics.clientes
    .map(c => ({
      name: c.cliente,
      Recebido: c.receitaRecebida / 100,
      Despesa: c.despesas / 100,
      Resultado: c.resultado / 100
    }))
    .slice(0, 5); // top 5 clients

  // Category chart mapping
  const categoryMap = new Map<string, number>();
  despesas.forEach((desp) => {
    const current = categoryMap.get(desp.categoria) || 0;
    categoryMap.set(desp.categoria, current + desp.valor / 100);
  });

  const categoryChartData = analytics.categorias.map((item) => ({
    name: item.categoria,
    value: item.total / 100
  }));

  // Monthly current vs previous calculations
  const now = new Date();
  const currentYearMonth = now.toISOString().slice(0, 7);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYearMonth = prevDate.toISOString().slice(0, 7);

  const currentMonthData = analytics.monthly.find((item) => item.mes === currentYearMonth);
  const prevMonthData = analytics.monthly.find((item) => item.mes === prevYearMonth);
  const currentMonthDespesas = despesas.filter(d => d.data && d.data.startsWith(currentYearMonth));
  const totalCurrentMonthDespesas = (currentMonthData?.despesasLancadas || 0) / 100;
  const totalPrevMonthDespesas = (prevMonthData?.despesasLancadas || 0) / 100;

  const expenseVariation = totalPrevMonthDespesas > 0 
    ? ((totalCurrentMonthDespesas - totalPrevMonthDespesas) / totalPrevMonthDespesas) * 100 
    : 0;

  const monthForAnalysis = currentMonthDespesas.length > 0 ? currentMonthDespesas : despesas;
  const monthCategoryMap = new Map<string, number>();
  monthForAnalysis.forEach(d => {
    const curr = monthCategoryMap.get(d.categoria) || 0;
    monthCategoryMap.set(d.categoria, curr + d.valor / 100);
  });
  const monthCategoryData = Array.from(monthCategoryMap.entries()).map(([name, value]) => ({ name, value }));

  const formatBRL = (val: number) => formatCurrencyFromCents(Math.round(val * 100));

  const COLORS = colorblindSafeColors;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <span className={`${geoKickerClass} mb-4`}>
            Análise Avançada
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Dash Financeiro
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Rentabilidade por cliente, categorias de custos e DRE detalhada.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPIs Row (DRE Cascade) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className={cn(geoGreenSurfaceClass, 'flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Receita Líquida</span>
                <div className={cn(geoGreenIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <TrendUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-2xl font-semibold tracking-tight', geoGreenValueClass)}>
                  {formatBRL(receitaLiquida)}
                </span>
                <p className="mt-1 text-xs font-bold tracking-wide text-emerald-100/70">BRUTA (CONTRATADA): {formatBRL(totalContratado)}</p>
              </div>
            </div>

            <div className={cn(geoGreenSurfaceClass, 'flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Lucro Oper. (EBITDA)</span>
                <div className={cn(geoGreenIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-2xl font-semibold tracking-tight', lucroOperacional >= 0 ? geoGreenValueClass : 'text-rose-100')}>
                  {formatBRL(lucroOperacional)}
                </span>
                <p className="mt-1 text-xs font-bold tracking-wide text-emerald-100/70">PELA COMPETÊNCIA (DRE)</p>
              </div>
            </div>

            <div className={cn(geoGreenSurfaceClass, 'flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Margem Contribuição</span>
                <div className={cn(geoGreenIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-2xl font-semibold tracking-tight', geoGreenValueClass)}>
                  {margemContribuicao.toFixed(1)}%
                </span>
                <p className="mt-1 text-xs font-bold tracking-wide text-emerald-100/70">RECEITA LÍQUIDA - CUSTOS VAR.</p>
              </div>
            </div>

            <div className={cn(geoGreenSurfaceClass, 'flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-bold uppercase tracking-wider', geoGreenLabelClass)}>Resultado de Caixa</span>
                <div className={cn(geoGreenIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <TrendDown className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-2xl font-semibold tracking-tight', netProfit >= 0 ? geoGreenValueClass : 'text-rose-100')}>
                  {formatBRL(netProfit)}
                </span>
                <p className="mt-1 text-xs font-bold tracking-wide text-emerald-100/70">RECEBIDO - PAGO (M. CAIXA {profitMargin.toFixed(1)}%)</p>
              </div>
            </div>
          </div>

          {/* Lovable & Storytelling Analytics Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Treemap interativo */}
            <div className="col-span-1 md:col-span-7 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm min-h-[360px] flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-500" />
                    Árvore de Custos (Treemap)
                  </h3>
                  <p className="text-xs text-text-muted font-medium">Proporção visual de impacto financeiro por categoria.</p>
                </div>
              </div>
              <div className="flex-1 w-full h-[260px] mt-2">
                {categoryChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted text-sm">
                    Nenhuma despesa para mapear na árvore.
                  </div>
                ) : (
                  <ResponsiveContainer {...responsiveChartProps}>
                    <Treemap
                      data={categoryChartData}
                      dataKey="value"
                      aspectRatio={4 / 3}
                      stroke="#fff"
                      fill="#6366f1"
                      content={<CustomTreemapContent />}
                    >
                      <Tooltip content={<RichTooltip format="currency" />} />
                    </Treemap>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Visão do Mês Atual */}
            <div className={cn(geoPurpleSurfaceClass, 'col-span-1 flex min-h-[360px] flex-col justify-between rounded-[2.5rem] p-8 ring-1 ring-violet-300/15 shadow-sm md:col-span-5')}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider', geoPurpleLabelClass)}>
                    <CalendarBlank className="w-4 h-4" />
                    Gastos do Mês Atual
                  </span>
                  {totalPrevMonthDespesas > 0 && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${expenseVariation <= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                      {expenseVariation <= 0 ? <ArrowDownRight weight="bold" /> : <ArrowUpRight weight="bold" />}
                      {Math.abs(expenseVariation).toFixed(1)}% vs mês ant.
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <span className={cn('text-3xl font-bold tracking-tight', geoPurpleValueClass)}>
                    {formatBRL(totalCurrentMonthDespesas > 0 ? totalCurrentMonthDespesas : totalDespesas)}
                  </span>
                  <p className="mt-0.5 text-xs font-semibold tracking-wide text-violet-100/70">
                    {currentMonthDespesas.length > 0 ? `ACUMULADO EM ${currentYearMonth}` : 'VISÃO GERAL CONSOLIDADA'}
                  </p>
                </div>
              </div>

              <div className="w-full h-[180px] mt-4">
                {monthCategoryData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted text-xs">
                    Sem registros no período.
                  </div>
                ) : (
                  <ResponsiveContainer {...responsiveChartProps}>
                    <PieChart>
                      <Pie
                        data={monthCategoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {monthCategoryData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<RichTooltip format="currency" />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Historico Mensal (DRE) */}
            <div className="col-span-1 md:col-span-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm min-h-[400px] flex flex-col">
              <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Evolução do Fluxo de Caixa (DRE)</h3>
                  <p className="text-xs text-text-muted font-medium">Comparação mensal de receitas líquidas e despesas registradas.</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
                  <button
                    type="button"
                    onClick={() => setChartPeriod('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${chartPeriod === 'all' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartPeriod('6m')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${chartPeriod === '6m' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                  >
                    Últimos 6m
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartPeriod('3m')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${chartPeriod === '3m' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                  >
                    Últimos 3m
                  </button>
                </div>
              </div>
              
              <div className="flex-1 w-full h-[300px]">
                <ResponsiveContainer {...responsiveChartProps}>
                  <AreaChart data={filteredMonthlyData}>
                    <defs>
                      <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.positive} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={chartColors.positive} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.negative} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={chartColors.negative} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                    <XAxis dataKey="mes" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip cursor={chartCursor} content={<RichTooltip showDifference={true} differenceLabel="Lucro Líquido" format="currency" />} />
                    <Area type="monotone" dataKey="Recebido" stroke={chartColors.positive} strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                    <Area type="monotone" dataKey="Despesas" stroke={chartColors.negative} strokeWidth={2} fillOpacity={1} fill="url(#colorDes)" />
                    <Area type="monotone" dataKey="Resultado" stroke={chartColors.primary} strokeWidth={2} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Custos por Categoria */}
            <div className="col-span-1 md:col-span-4 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm min-h-[400px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Despesas por Categoria</h3>
                <p className="text-xs text-text-muted font-medium">Distribuição das saídas financeiras por setor.</p>
              </div>

              <div className="flex-1 w-full h-[250px] flex flex-col justify-center">
                {categoryChartData.length === 0 ? (
                  <p className="text-text-muted text-sm text-center">Nenhum custo registrado.</p>
                ) : (
                  <div className="space-y-4">
                    {categoryChartData.map((item, idx) => {
                      const percentage = totalDespesasLancadas > 0 ? (item.value / totalDespesasLancadas) * 100 : 0;
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            <span className="geo-badge-base geo-badge-info max-w-[58%] truncate px-2 py-0.5 text-xs" title={item.name}>{item.name}</span>
                            <span>{percentage.toFixed(0)}% ({formatBRL(item.value)})</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${percentage}%`, 
                                backgroundColor: COLORS[idx % COLORS.length] 
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Row: Profit per Client */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm min-h-[350px]">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Rentabilidade de Clientes (Top 5)</h3>
              <p className="text-xs text-text-muted font-medium">Análise de retorno líquido por cliente comparando receitas e custos operacionais diretos.</p>
            </div>

            <div className="w-full h-[280px]">
              {clientProfitData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-text-muted text-sm">
                  Nenhum dado financeiro disponível para faturamento de clientes.
                </div>
              ) : (
                <ResponsiveContainer {...responsiveChartProps}>
                  <BarChart data={clientProfitData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                    <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                    <Legend wrapperStyle={chartLegendStyle} />
                    <Bar dataKey="Recebido" fill={chartColors.positive} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesa" fill={chartColors.negative} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Resultado" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
