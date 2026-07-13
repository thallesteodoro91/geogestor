import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  chartTextColor, chartBorder, chartLegendStyle, chartCursor, responsiveChartProps 
} from '../../utils/chartHelpers';
import { chartColors } from '../../data/chart-colors';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { DynamicTooltip } from '../../components/charts/DynamicTooltip';
import { cn } from '../../utils/cn';
import { 
  Clock, CheckCircle, Folder, TrendUp 
} from '@phosphor-icons/react';
import { geoGreenIconClass, geoGreenLabelClass, geoGreenSurfaceWithAccentClass, geoGreenValueClass, geoOrangeIconClass, geoOrangeLabelClass, geoOrangeSurfaceWithAccentClass, geoOrangeValueClass, geoPurpleSurfaceClass } from '../../utils/geoTheme';
import { apiClient } from '../../services/apiClient';

interface Projeto {
  id: string;
  clienteId?: string;
  nome: string;
  status: string;
  dataInicio?: string;
  dataEntrega?: string;
  tipo?: string;
}

interface Orcamento {
  id: string;
  clienteId: string;
  status: string;
  valorTotal: number;
}

interface Despesa {
  id: string;
  projetoId?: string | null;
  valor: number;
}

export function Operacional() {
  const [categoriaFilter, setCategoriaFilter] = useState('todos');
  const [zoomPeriod, setZoomPeriod] = useState<'6m' | '12m' | 'all'>('all');

  // Queries
  const { data: projetos = [], isLoading: projetosLoading } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<Projeto[]>('/api/projetos')
  });

  const { data: orcamentos = [], isLoading: orcamentosLoading } = useQuery<Orcamento[]>({
    queryKey: ['orcamentos-financeiro'],
    queryFn: () => apiClient.get<Orcamento[]>('/api/financeiro/orcamentos')
  });

  const { data: despesas = [], isLoading: despesasLoading } = useQuery<Despesa[]>({
    queryKey: ['despesas-financeiro'],
    queryFn: () => apiClient.get<Despesa[]>('/api/financeiro/despesas')
  });

  const loading = projetosLoading || orcamentosLoading || despesasLoading;

  const filteredProjetos = useMemo(() => {
    if (zoomPeriod === 'all') return projetos;
    const count = zoomPeriod === '6m' ? 6 : 12;
    return projetos.slice(-count);
  }, [projetos, zoomPeriod]);

  // 1. Calculate project status totals
  const totalProjetos = filteredProjetos.length;
  const projetosConcluidos = filteredProjetos.filter((p) => p.status === 'Concluído').length;
  const projetosEmAndamento = filteredProjetos.filter((p) => p.status === 'Em Andamento').length;
  const projetosOutros = totalProjetos - projetosConcluidos - projetosEmAndamento;

  const statusPieData = [
    { name: 'Concluído', value: projetosConcluidos, color: chartColors.positive },
    { name: 'Em Andamento', value: projetosEmAndamento, color: chartColors.primary },
    { name: 'Outros', value: projetosOutros, color: chartColors.warning }
  ].filter(d => d.value > 0);

  // 2. Average completion time (in days)
  let totalDays = 0;
  let countConcluidos = 0;
  filteredProjetos.forEach((p) => {
    if (p.status === 'Concluído' && p.dataInicio && p.dataEntrega) {
      const start = new Date(p.dataInicio);
      const end = new Date(p.dataEntrega);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
      countConcluidos++;
    }
  });
  const avgCompletionTime = countConcluidos > 0 ? Math.round(totalDays / countConcluidos) : 0;

  // 3. Productivity rate
  const productivityRate = totalProjetos > 0 ? Math.round((projetosConcluidos / totalProjetos) * 100) : 0;

  // 4. Budget average (Ticket Médio)
  const approvedBudgets = orcamentos.filter((o) => o.status === 'Pago' || o.status === 'Aprovado');
  const avgTicket = approvedBudgets.length > 0 
    ? Math.round(approvedBudgets.reduce((acc: number, curr) => acc + curr.valorTotal, 0) / approvedBudgets.length) 
    : 0;

  // 5. Custo vs Receita por Projeto (Top 5)
  const projectComparisonData = filteredProjetos.map((proj) => {
    // find related budget value
    const relatedBudgets = orcamentos.filter((o) => o.clienteId === proj.clienteId);
    // divide total client budget by their project count as estimation if not 1-to-1
    const clientProjects = filteredProjetos.filter((p) => p.clienteId === proj.clienteId).length;
    const estimatedReceita = relatedBudgets.reduce((acc: number, o) => acc + o.valorTotal, 0) / (clientProjects || 1);

    // despesas linked to this project
    const projectExpenses = despesas.filter((d) => d.projetoId === proj.id);
    const totalExpenses = projectExpenses.reduce((acc: number, d) => acc + d.valor, 0);

    return {
      name: proj.nome,
      Receita: estimatedReceita / 100,
      Custo: totalExpenses / 100,
      Lucro: (estimatedReceita - totalExpenses) / 100,
      tipo: proj.tipo || 'Rural'
    };
  });

  const filteredComparisonData = categoriaFilter === 'todos'
    ? projectComparisonData
    : projectComparisonData.filter((d) => d.tipo === categoriaFilter);

  const topProjectsData = filteredComparisonData
    .sort((a, b) => b.Receita - a.Receita)
    .slice(0, 5);

  const formatBRL = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            Gestão Operacional
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Operacional
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Análise de produtividade das equipes, tempo médio de entregas e eficiência de projetos.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Bento Cards row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className={cn(geoOrangeSurfaceWithAccentClass, 'flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-orange-300/15 shadow-[0_20px_40px_-20px_rgba(217,119,6,0.22)] transition-transform duration-300 hover:-translate-y-0.5')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Total Projetos</span>
                <div className={cn(geoOrangeIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <Folder className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-semibold tracking-tight', geoOrangeValueClass)}>
                  {totalProjetos}
                </span>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-orange-100/70">CADASTRADOS NO SISTEMA</p>
              </div>
            </div>

            <div className={cn(geoOrangeSurfaceWithAccentClass, 'relative flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-orange-300/15 shadow-[0_20px_40px_-20px_rgba(217,119,6,0.22)] transition-transform duration-300 hover:-translate-y-0.5')}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-100/85">Tempo de Entrega</span>
                <div className="geo-orange-icon flex h-8 w-8 items-center justify-center rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-3xl font-semibold tracking-tight text-white">
                  {avgCompletionTime} dias
                </span>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-orange-100/70">MÉDIA DE CONCLUSÃO</p>
              </div>
            </div>

            <div className={cn(geoGreenSurfaceWithAccentClass, 'relative overflow-hidden rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-[0_20px_40px_-20px_rgba(5,150,105,0.22)] flex flex-col justify-between transition-transform duration-300 hover:-translate-y-0.5')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Produtividade</span>
                <div className={cn(geoGreenIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-semibold tracking-tight', geoGreenValueClass)}>
                  {productivityRate}%
                </span>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-100/70">TAXA DE CONCLUSÃO GERAL</p>
              </div>
            </div>

            <div className={cn(geoGreenSurfaceWithAccentClass, 'relative flex flex-col justify-between rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-[0_20px_40px_-20px_rgba(5,150,105,0.22)] transition-transform duration-300 hover:-translate-y-0.5')}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Ticket Médio</span>
                <div className={cn(geoGreenIconClass, 'flex h-8 w-8 items-center justify-center rounded-xl')}>
                  <TrendUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-semibold tracking-tight', geoGreenValueClass)}>
                  {formatBRL(avgTicket)}
                </span>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-100/70">POR ORÇAMENTO APROVADO</p>
              </div>
            </div>
          </div>

          {/* Productivity insights story card */}
          <div className={cn(geoPurpleSurfaceClass, 'relative overflow-hidden rounded-[2rem] border border-white/10 p-8 text-white shadow-[0_24px_50px_-24px_rgba(30,27,75,0.75)]')}>
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
            <h3 className="text-lg font-semibold mb-2 text-zinc-100">Visão Geral Operacional</h3>
            <div className="text-sm text-zinc-300 space-y-2 leading-relaxed">
              <p>
                A produtividade das equipes está em <strong>{productivityRate}%</strong> neste período — <strong>{projetosConcluidos}</strong> de <strong>{totalProjetos}</strong> projetos foram concluídos, com tempo médio de <strong>{avgCompletionTime} dias</strong>.
              </p>
              <p>
                Atualmente, <strong>{projetosEmAndamento}</strong> projetos estão em andamento e <strong>{projetosOutros}</strong> aguardam início ou estão sob revisão.
              </p>
            </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Custo vs Receita por Projeto */}
            <div className="col-span-1 md:col-span-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm min-h-[400px] flex flex-col">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Análise de Custos vs Receita Estimada (Top 5)</h3>
                  <p className="text-xs text-zinc-400 font-medium">Comparação direta de faturamento e despesas associadas por projeto.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                    <span className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Zoom:</span>
                    <button
                      type="button"
                      onClick={() => setZoomPeriod('6m')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        zoomPeriod === '6m'
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white font-bold'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      6m
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomPeriod('12m')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        zoomPeriod === '12m'
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white font-bold'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      12m
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomPeriod('all')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        zoomPeriod === 'all'
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white font-bold'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      Todos
                    </button>
                  </div>

                  <select 
                    value={categoriaFilter} 
                    onChange={e => setCategoriaFilter(e.target.value)} 
                    className="h-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 text-xs font-semibold text-zinc-700 focus:outline-none dark:text-zinc-200"
                  >
                    <option value="todos">Todos os Tipos</option>
                    <option value="Rural">Rural</option>
                    <option value="Urbano">Urbano</option>
                  </select>
                </div>
              </div>
              
              <div className="flex-1 w-full h-[280px]">
                {topProjectsData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                    Nenhum projeto faturado ou com custos neste filtro.
                  </div>
                ) : (
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={topProjectsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                      <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                      <Legend wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="Receita" fill={chartColors.positive} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Custo" fill={chartColors.negative} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Lucro" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Status dos Projetos Pie */}
            <div className="col-span-1 md:col-span-4 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm min-h-[400px] flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Distribuição por Status</h3>
                <p className="text-xs text-zinc-400 font-medium">Situação dos projetos ativos e entregues.</p>
              </div>

              <div className="w-full h-[200px] relative flex items-center justify-center">
                {statusPieData.length === 0 ? (
                  <p className="text-zinc-400 text-sm">Sem projetos.</p>
                ) : (
                  <ResponsiveContainer {...responsiveChartProps}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DynamicTooltip formatter={(v) => `${v} projetos`} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-zinc-600 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                {statusPieData.map(item => (
                  <div key={item.name} className="flex flex-col items-center">
                    <span className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">{item.name}</span>
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}
