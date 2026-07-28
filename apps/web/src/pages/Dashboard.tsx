import { FormSelect } from '../components/Form';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { Layout } from '../components/Layout';
import { RecentActivities } from '../components/RecentActivities';
import { Skeleton } from '../components/Skeleton';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  chartTextColor, chartBorder, chartLegendStyle, chartCursor, responsiveChartProps 
} from '../utils/chartHelpers';
import { chartColors, colorblindSafeColors } from '../data/chart-colors';
import { DynamicTooltip } from '../components/charts/DynamicTooltip';
import { RichTooltip } from '../components/charts/RichTooltip';
import { geoGreenLabelClass, geoGreenSurfaceClass, geoGreenValueClass, geoOrangeLabelClass, geoOrangeSurfaceClass, geoOrangeValueClass } from '../utils/geoTheme';

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

interface StatsGeral {
  orcamentosStats?: Array<{ total?: number }>;
  despesasPorCategoria?: Array<{ categoria: string; total: number }>;
  areaTotal?: number;
  historicoMensal?: {
    receitasMensais: Array<{ mes: string; total: number }>;
    despesasMensais: Array<{ mes: string; total: number }>;
  };
  projetosPorStatus?: Array<{ status: string; count: number }>;
  financeiro?: {
    receitaContratada: number;
    receitaRecebida: number;
    receitaPendente: number;
    despesasPagas: number;
    impostosPrevistos: number;
    resultadoCaixa: number;
  };
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

interface ProjetoResumo {
  id: string;
  nome: string;
  clienteNome?: string;
  status: string;
  tipo?: string | null;
}

interface ClienteResumo {
  id: string;
  nome: string;
  email?: string | null;
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
}

const getDaysLeftText = (targetDate: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `Vencido há ${Math.abs(diffDays)}d`, className: 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20' };
  }
  if (diffDays === 0) {
    return { text: 'Vence hoje', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20' };
  }
  if (diffDays === 1) {
    return { text: 'Amanhã', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20' };
  }
  return { text: `Em ${diffDays} dias`, className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/80' };
};

export function Dashboard() {
  const [projetoFilterMode, setProjetoFilterMode] = useState<'macro' | 'unitario'>('macro');
  const [selectedProjetoTipo, setSelectedProjetoTipo] = useState<string>('');

  const { data: clientesData, isLoading: loadingClientes, isError: clientesError } = useQuery<ClienteResumo[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<ClienteResumo[]>('/api/clientes')
  });

  const { data: projetosData, isLoading: loadingProjetos, isError: projetosError } = useQuery<ProjetoResumo[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<ProjetoResumo[]>('/api/projetos'),
    staleTime: 60_000,
  });

  const { data: tasksData, isError: tasksError } = useQuery<TaskItem[]>({
    queryKey: ['tarefas'],
    queryFn: () => apiClient.get<TaskItem[]>('/api/tarefas')
  });

  const { data: stats, isLoading: loadingStats, isError: statsError } = useQuery<StatsGeral>({
    queryKey: ['stats-geral'],
    queryFn: () => apiClient.get<StatsGeral>('/api/relatorios/geral')
  });

  const { data: licencasData, isError: licencasError } = useQuery<LicencaItem[]>({
    queryKey: ['licencas'],
    queryFn: () => apiClient.get<LicencaItem[]>('/api/licencas')
  });
  const clientes = useMemo(() => clientesData ?? [], [clientesData]);
  const projetos = useMemo(() => projetosData ?? [], [projetosData]);
  const tasks = useMemo(() => tasksData ?? [], [tasksData]);
  const licencas = useMemo(() => licencasData ?? [], [licencasData]);

  // Calcular balanço financeiro
  const { netProfit, areaTotal } = useMemo(() => {
    return {
      netProfit: stats?.financeiro?.resultadoCaixa || 0,
      areaTotal: stats?.areaTotal || 0,
    };
  }, [stats]);

  // Porcentagem de tarefas concluídas
  const { completedTasks, taskCompletionRate } = useMemo(() => {
    const completed = tasks.filter((t) => t.status === 'Concluído').length;
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    return { completedTasks: completed, taskCompletionRate: rate };
  }, [tasks]);

  // Preparar dados do gráfico financeiro
  const financeChartData = useMemo(() => {
    const chartMap = new Map<string, { mes: string; receita: number; despesa: number }>();
    if (stats?.historicoMensal) {
      stats.historicoMensal.receitasMensais.forEach((r) => {
        chartMap.set(r.mes, { mes: r.mes, receita: r.total / 100, despesa: 0 });
      });
      stats.historicoMensal.despesasMensais.forEach((d) => {
        const existing = chartMap.get(d.mes);
        if (existing) {
          existing.despesa = d.total / 100;
        } else {
          chartMap.set(d.mes, { mes: d.mes, receita: 0, despesa: d.total / 100 });
        }
      });
    }
    let data = Array.from(chartMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));
    if (data.length === 0) {
      data = [{ mes: 'Jan', receita: 0, despesa: 0 }, { mes: 'Fev', receita: 0, despesa: 0 }, { mes: 'Mar', receita: 0, despesa: 0 }];
    }
    return data;
  }, [stats]);



  // Preparar os tipos de projetos disponíveis a partir dos dados reais
  const availableProjectTypes = useMemo(() => 
    Array.from(new Set(projetos.map((p) => p.tipo || 'Não Informado'))) as string[],
  [projetos]);

  const effectiveProjetoTipo = selectedProjetoTipo || availableProjectTypes[0] || '';

  // Preparar dados de distribuição de projetos
  const projetosStatusData = useMemo(() => {
    if (projetoFilterMode === 'macro') {
      const countMap = new Map<string, number>();
      projetos.forEach((p) => {
        const key = p.tipo || 'Não Informado';
        countMap.set(key, (countMap.get(key) || 0) + 1);
      });
      return Array.from(countMap.entries()).map(([name, value]) => ({ name, value }));
    } else {
      const filtered = projetos.filter((p) => (p.tipo || 'Não Informado') === effectiveProjetoTipo);
      const countMap = new Map<string, number>();
      filtered.forEach((p) => {
        const key = p.status || 'Sem Status';
        countMap.set(key, (countMap.get(key) || 0) + 1);
      });
      return Array.from(countMap.entries()).map(([name, value]) => ({ name, value }));
    }
  }, [projetos, projetoFilterMode, effectiveProjetoTipo]);



  const upcomingItems = useMemo(() => {
    const items: Array<{
      id: string;
      tipo: 'tarefa' | 'licenca';
      titulo: string;
      contexto: string;
      data: Date;
      dataString: string;
      badgeColor: string;
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
            dataString: formattedDate,
            badgeColor: t.prioridade === 'Alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
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
          const projeto = projetos.find(p => p.id === l.projetoId);
          items.push({
            id: l.id,
            tipo: 'licenca',
            titulo: `${l.numero} - ${l.orgao}`,
            contexto: projeto ? projeto.nome : 'Sem Projeto',
            data: date,
            dataString: formattedDate,
            badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
          });
        }
      }
    });

    return items.sort((a, b) => a.data.getTime() - b.data.getTime()).slice(0, 5);
  }, [tasks, licencas, projetos]);
  const failedWithoutData = (clientesError && !clientesData)
    || (projetosError && !projetosData)
    || (tasksError && !tasksData)
    || (statsError && !stats)
    || (licencasError && !licencasData);

  if (failedWithoutData) {
    return (
      <Layout>
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
    <Layout>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end md:pt-10 lg:mb-10 xl:pt-0">
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tighter text-text-primary sm:text-5xl">
            Visão Geral
          </h1>
          <p className="mt-2 max-w-3xl text-base font-medium leading-7 text-text-secondary sm:mt-3 sm:text-lg">
            Monitoramento operacional, financeiro e geográfico consolidado.
          </p>
        </div>

      </div>
      
            {/* Top Row: Finance & Quick Stats */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:mb-6 lg:gap-6 xl:grid-cols-12">
        
        {/* Fluxo de Caixa (Large Bento Box) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
          className="geo-card col-span-1 flex min-h-[320px] flex-col p-5 sm:min-h-[360px] sm:p-6 lg:p-8 xl:col-span-8"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 sm:mb-6 sm:items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={valueChainIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Fluxo de Caixa</h2>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-text-muted block mb-1">Resultado de Caixa</span>
              <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netProfit / 100)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] w-full">
            <ResponsiveContainer {...responsiveChartProps}>
              <AreaChart data={financeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.negative} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartColors.negative} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} opacity={0.4} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTextColor }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTextColor }} tickFormatter={(value) => `R$ ${value}`} />
                <RechartsTooltip cursor={chartCursor} content={<RichTooltip showDifference={true} differenceLabel="Saldo de caixa" format="currency" />} />
                <Area type="monotone" name="Receita" dataKey="receita" stroke={chartColors.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" name="Despesa" dataKey="despesa" stroke={chartColors.negative} strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Quick Stats Column (stacked vertically on right) */}
        <div className="col-span-1 flex flex-col gap-4 sm:gap-5 lg:gap-6 xl:col-span-4">
          <div className="grid grid-cols-1 gap-4 sm:gap-5 min-[900px]:grid-cols-3 lg:gap-6 xl:flex xl:flex-col">
          
          {/* Clientes */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            className={`${geoGreenSurfaceClass} relative flex flex-1 items-center justify-between overflow-hidden rounded-2xl p-5 shadow-sm ring-1 ring-emerald-300/15 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6`}
          >
            <div className="w-12 h-12 flex items-center justify-center shrink-0 relative z-10">
              <img src={coexistenceIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>
            <div className="text-right relative z-10">
              <span className={`text-xs font-semibold uppercase tracking-wider ${geoGreenLabelClass} block mb-1`}>Clientes</span>
              {loadingClientes ? (
                <Skeleton className="h-10 w-16 ml-auto mt-1" />
              ) : (
                <span className={`text-3xl font-semibold tracking-tighter sm:text-2xl xl:text-4xl ${geoGreenValueClass}`}>
                  {String(clientes.length).padStart(2, '0')}
                </span>
              )}
            </div>
          </motion.div>

          {/* Projetos */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
            className={`${geoOrangeSurfaceClass} relative flex flex-1 items-center justify-between overflow-hidden rounded-2xl p-5 shadow-sm ring-1 ring-orange-300/15 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6`}
          >
            <div className="w-12 h-12 flex items-center justify-center shrink-0 relative z-10">
              <img src={projectFolderIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>
            <div className="text-right relative z-10">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-orange-100/85">Projetos</span>
              {loadingProjetos ? (
                <Skeleton className="h-10 w-16 ml-auto mt-1" />
              ) : (
                <span className="text-3xl font-semibold tracking-tighter text-white sm:text-2xl xl:text-4xl">
                  {String(projetos.length).padStart(2, '0')}
                </span>
              )}
            </div>
          </motion.div>

          {/* Área sob Gestão */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
            className={`${geoOrangeSurfaceClass} relative flex flex-1 items-center justify-between overflow-hidden rounded-2xl p-5 shadow-sm ring-1 ring-orange-300/15 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6`}
          >
            <div className="w-12 h-12 flex items-center justify-center shrink-0 relative z-10">
              <img src={mapIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>
            <div className="text-right relative z-10">
              <span className={`text-xs font-semibold uppercase tracking-wider ${geoOrangeLabelClass} block mb-1`}>Área sob Gestão (ha)</span>
              {loadingStats ? (
                <Skeleton className="h-10 w-24 ml-auto mt-1" />
              ) : (
                <span className={`text-3xl font-semibold tracking-tighter sm:text-2xl xl:text-4xl ${geoOrangeValueClass}`}>
                  {areaTotal.toFixed(1)}
                </span>
              )}
            </div>
          </motion.div>
        </div>
        </div>

      </div>

      {/* Row 2: Vencimentos & Eficiência */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:mb-6 lg:gap-6 xl:grid-cols-12">
        
        {/* Próximos Vencimentos */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
          className="geo-card col-span-1 flex min-h-[300px] flex-col justify-between p-5 sm:min-h-[340px] sm:p-6 lg:min-h-[360px] lg:p-8 xl:col-span-8"
        >
          <div>
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={calendarIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <div>
                <h2 className="block text-sm font-semibold uppercase tracking-wider text-text-muted">Próximos Vencimentos</h2>
                <span className="text-[10px] text-text-secondary font-medium block mt-0.5">Prazos de tarefas e licenças ambientais para os próximos dias</span>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingItems.length === 0 ? (
                <div className="py-12 text-center text-zinc-600 dark:text-zinc-300 text-sm">
                  Nenhum vencimento pendente para os próximos dias.
                </div>
              ) : (
                upcomingItems.map((item) => {
                  const daysBadge = getDaysLeftText(item.data);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl hover:bg-zinc-100/50 dark:hover:bg-zinc-800/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 flex items-center justify-center shrink-0">
                          {item.tipo === 'tarefa' ? (
                            <img src={calendarIcon} alt="" className="h-[22px] w-[22px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                          ) : (
                            <img src={diplomaIcon} alt="" className="h-[26px] w-[26px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-text-primary truncate">{item.titulo}</h4>
                          <p className="text-[10px] text-text-secondary truncate mt-0.5">{item.contexto}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-text-secondary font-medium tabular-nums">{item.dataString}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${daysBadge.className}`}>
                          {daysBadge.text}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

        {/* Eficiência Operacional */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 100 }}
          className="geo-card col-span-1 flex min-h-[300px] flex-col justify-between p-5 sm:min-h-[340px] sm:p-6 lg:min-h-[360px] lg:p-8 xl:col-span-4"
        >
          <div>
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={stopwatchIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Eficiência Operacional</h2>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-bold tracking-tight text-text-primary">{taskCompletionRate}%</span>
              <span className="text-xs text-text-secondary font-medium">das tarefas concluídas</span>
            </div>

            {/* Detalhamento compacto */}
            <div className="space-y-2 mt-4 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Concluídas:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{completedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Pendentes:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{tasks.length - completedTasks}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-label="Conclusão das tarefas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={taskCompletionRate}>
              <div 
                className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                style={{ width: `${taskCompletionRate}%` }}
              />
            </div>
            <p className="text-[10px] text-text-secondary">Métrica de conclusão de atividades.</p>
          </div>
        </motion.div>

      </div>
{/* Row 3: Distribuição e Despesas */}
      <div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-12">
        
        {/* Atividades Recentes (span 8) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
          className="geo-card col-span-1 flex h-[420px] flex-col p-5 sm:h-[460px] sm:p-6 lg:p-8 xl:col-span-8"
        >
          <RecentActivities />
        </motion.div>

        {/* Distribuição de Projetos (span 4) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
          className="geo-card col-span-1 flex h-[380px] flex-col p-5 sm:h-[460px] sm:p-6 lg:p-8 xl:col-span-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <img src={blueprintIcon} alt="" className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              </div>
              <div>
                <h2 className="block text-sm font-semibold uppercase tracking-wider text-text-muted">Distribuição de Projetos</h2>
                <span className="text-[10px] text-text-secondary font-medium block mt-0.5">
                  {projetoFilterMode === 'macro' ? 'Por tipo/categoria' : `Status (${effectiveProjetoTipo})`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60" role="group" aria-label="Agrupamento da distribuição de projetos">
                <button
                  type="button"
                  onClick={() => setProjetoFilterMode('macro')} 
                  aria-pressed={projetoFilterMode === 'macro'}
                  className={`geo-focus-ring rounded-lg px-3 py-1 text-[10px] font-medium transition-[color,background-color,box-shadow] ${projetoFilterMode === 'macro' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-white'}`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setProjetoFilterMode('unitario')} 
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
                  onChange={(e) => setSelectedProjetoTipo(e.target.value)}
                  className="geo-focus-ring cursor-pointer animate-in rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] font-medium text-text-primary transition-[border-color,box-shadow] duration-200 fade-in zoom-in-95 dark:border-zinc-700/80 dark:bg-zinc-800/60"
                >
                  {availableProjectTypes.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </FormSelect>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {projetosStatusData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <img src={blueprintIcon} alt="" className="h-10 w-10 opacity-45 grayscale" />
                <p className="mt-3 text-sm font-semibold text-text-secondary">Nenhum projeto para distribuir</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-text-muted">Os dados aparecerão aqui quando houver projetos cadastrados.</p>
              </div>
            ) : <ResponsiveContainer {...responsiveChartProps}>
              <PieChart>
                <Pie
                  data={projetosStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {projetosStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.name, index)} />
                  ))}
                </Pie>
                <RechartsTooltip content={<DynamicTooltip formatter={(v) => `${v} projetos`} />} />
                <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
              </PieChart>
            </ResponsiveContainer>}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
