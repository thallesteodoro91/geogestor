import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Layout } from '../../components/Layout';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  chartTextColor, chartBorder, chartCursor, responsiveChartProps 
} from '../../utils/chartHelpers';
import { chartColors, colorblindSafeColors } from '../../data/chart-colors';
import { DynamicTooltip } from '../../components/charts/DynamicTooltip';
import { 
  Printer, Coins, Briefcase, TrendUp, Compass, ChartBar, 
  Percent
} from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass } from '../../utils/actionStyles';
import { apiClient } from '../../services/apiClient';
import { isApprovedBudgetStatus } from '../../utils/budgetStatus';

interface ProjetoStatusStat {
  status: string;
  count: number;
}

interface OrcamentoStat {
  status: string;
  count: number;
  total: number;
}

interface DespesaCategoriaStat {
  categoria: string;
  total: number;
}

interface RelatorioStats {
  projetosPorStatus?: ProjetoStatusStat[];
  projetosPorTipo?: Array<{ tipo: string; count: number }>;
  areaTotal?: number;
  orcamentosStats?: OrcamentoStat[];
  despesasPorCategoria?: DespesaCategoriaStat[];
}

function PageFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

export function RelatorioExecutivo({ embedded = false }: { embedded?: boolean }) {
  const { data: stats, isLoading } = useQuery<RelatorioStats>({
    queryKey: ['relatorio-geral'],
    queryFn: () => apiClient.get<RelatorioStats>('/api/relatorios/geral')
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <PageFrame embedded={embedded}>
        <div className="py-24 flex justify-center items-center">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
            className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900"
          />
        </div>
      </PageFrame>
    );
  }

  // Helper formatting BRL
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
  };

  // Extract variables
  const {
    projetosPorStatus = [],
    areaTotal = 0,
    orcamentosStats = [],
    despesasPorCategoria = []
  } = stats || {};

  // Process operational KPIs
  const totalProjects = projetosPorStatus.reduce((acc: number, curr: ProjetoStatusStat) => acc + curr.count, 0);
  const completedProjects = projetosPorStatus.find((p: ProjetoStatusStat) => p.status === 'Concluído')?.count || 0;
  const runningProjects = projetosPorStatus.find((p: ProjetoStatusStat) => p.status === 'Em Andamento')?.count || 0;

  // Process financial KPIs
  const approvedBudgets = orcamentosStats.filter((o: OrcamentoStat) => isApprovedBudgetStatus(o.status)).reduce((acc: number, curr: OrcamentoStat) => acc + curr.count, 0);
  const decidedBudgets = orcamentosStats
    .filter((o: OrcamentoStat) => ['aprovado', 'pago', 'rejeitado', 'expirado'].includes((o.status || '').toLowerCase()))
    .reduce((acc: number, curr: OrcamentoStat) => acc + curr.count, 0);
  const conversionRate = decidedBudgets > 0 ? (approvedBudgets / decidedBudgets) * 100 : 0;

  const totalRevenue = orcamentosStats
    .filter((o: OrcamentoStat) => isApprovedBudgetStatus(o.status))
    .reduce((acc: number, curr: OrcamentoStat) => acc + (curr.total || 0), 0);

  const totalExpense = despesasPorCategoria.reduce((acc: number, curr: DespesaCategoriaStat) => acc + (curr.total || 0), 0);
  const netProfit = totalRevenue - totalExpense;

  // Pie chart colors (using colorblind-safe palette instead of hardcoded background colors)
  const COLORS = colorblindSafeColors;

  const expenseChartData = despesasPorCategoria.map((d: DespesaCategoriaStat) => ({
    name: d.categoria,
    value: d.total / 100
  }));

  return (
    <PageFrame embedded={embedded}>
      {/* Hide controls during printing */}
      <div className="print:hidden">
        {!embedded && <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
              Consolidado Corporativo
            </span>
            <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
              Relatório Executivo
            </h1>
            <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
              Visão 360° da saúde financeira e andamento das operações locais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint}
              className={primaryActionButtonClass}
            >
              <span>Imprimir Relatório</span>
              <div className={cn(primaryActionIconClass, 'group-hover:translate-x-0 group-hover:translate-y-0.5')}>
                <Printer weight="bold" className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>}

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Financeiro Geral */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 ring-1 ring-zinc-900/5 shadow-sm md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase font-bold tracking-widest text-text-secondary">Resultado Financeiro Local</span>
                <Coins className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-text-secondary uppercase font-bold tracking-wide">Valor contratado</span>
                  <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100 block mt-1">{formatCurrency(totalRevenue)}</span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase font-bold tracking-wide">Despesas lançadas</span>
                  <span className="text-xl font-bold text-red-600 block mt-1">-{formatCurrency(totalExpense)}</span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase font-bold tracking-wide">Resultado gerencial estimado</span>
                  <span className={`text-xl font-bold block mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(netProfit)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Estimativa gerencial: contratos menos despesas lançadas. Não é DRE contábil.</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <TrendUp className="w-3.5 h-3.5" /> Resultado positivo
              </span>
            </div>
          </div>

          {/* Card 2: Conversão de Propostas */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 ring-1 ring-zinc-900/5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase font-bold tracking-widest text-text-secondary">Taxa de Conversão</span>
                <Percent className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">{conversionRate.toFixed(1)}%</span>
                <span className="text-xs font-semibold text-text-secondary">das propostas</span>
              </div>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Percentual de orçamentos marcados como Aprovados ou Pagos em relação ao total de propostas criadas.
              </p>
            </div>
            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold text-zinc-700">
              {approvedBudgets} de {decidedBudgets} orçamentos encerrados com decisão
            </div>
          </div>

          {/* Card 3: Área total gerenciada */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 ring-1 ring-zinc-900/5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase font-bold tracking-widest text-text-secondary">Área Sob Gestão</span>
                <Compass className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">{areaTotal.toLocaleString('pt-BR')}</span>
                <span className="text-lg font-bold text-text-muted">Ha</span>
              </div>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Soma total das áreas em Hectares declaradas nos cadastros de projetos rurais e urbanos.
              </p>
            </div>
            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 font-medium">
              Metragem acumulada das matrículas topográficas.
            </div>
          </div>

          {/* Card 4: Operações (Projetos) */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 ring-1 ring-zinc-900/5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase font-bold tracking-widest text-text-secondary">Status de Projetos</span>
                <Briefcase className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">Total Cadastrado</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{totalProjects}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">Em Andamento</span>
                  <span className="font-bold text-indigo-600">{runningProjects}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">Concluídos</span>
                  <span className="font-bold text-emerald-600">{completedProjects}</span>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold text-zinc-700">
              Taxa de Conclusão: {totalProjects > 0 ? ((completedProjects / totalProjects) * 100).toFixed(0) : 0}%
            </div>
          </div>

          {/* Card 5: Divisão por Categorias de Custo */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 ring-1 ring-zinc-900/5 shadow-sm flex flex-col justify-between md:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase font-bold tracking-widest text-text-secondary">Distribuição de Despesas por Categoria</span>
                <ChartBar className="w-5 h-5 text-text-secondary" />
              </div>
              
              {expenseChartData.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8">Nenhum custo registrado.</p>
              ) : (
                <div className="h-44 w-full">
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={expenseChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} />
                      <XAxis type="number" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip cursor={chartCursor} content={<DynamicTooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} />
                      <Bar dataKey="value" fill={chartColors.primary} radius={[0, 4, 4, 0]}>
                        {expenseChartData.map((_entry, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Relatório Imprimível Oficial (Visível ao imprimir ou preview na tela) */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-12 ring-1 ring-zinc-900/5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] print:shadow-none print:ring-0 print:p-0 max-w-4xl mx-auto mt-12">
        <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-8 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">GeoGestor • Relatório Executivo Operacional</h2>
            <p className="text-sm text-text-secondary mt-1 uppercase tracking-wider">Compilado de Auditoria Corporativa Local</p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-bold tracking-widest text-text-secondary block">Data de Emissão</span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {new Date().toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        <div className="space-y-8">
          {/* Sessão 1: Visão Geral */}
          <div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">
              1. Sumário de Atividades Operacionais
            </h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-text-secondary font-bold uppercase text-xs tracking-wider">
                  <th className="pb-2">Indicador Operacional</th>
                  <th className="pb-2 text-right">Resultado Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                <tr>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">Área Sob Gestão (Topografia)</td>
                  <td className="py-3 text-right font-bold">{areaTotal.toLocaleString('pt-BR')} Ha</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">Total de Projetos Registrados</td>
                  <td className="py-3 text-right">{totalProjects} projetos</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">Projetos Concluídos (Fase Final)</td>
                  <td className="py-3 text-right text-emerald-600 font-semibold">{completedProjects}</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">Projetos Ativos em Andamento</td>
                  <td className="py-3 text-right text-indigo-600 font-semibold">{runningProjects}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sessão 2: Visão Financeira */}
          <div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">
              2. Balanço Geral de Receitas e Custos
            </h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-text-secondary font-bold uppercase text-xs tracking-wider">
                  <th className="pb-2">Status Financeiro</th>
                  <th className="pb-2 text-right">Qtd</th>
                  <th className="pb-2 text-right">Total Financeiro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                <tr>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">Receitas Totais (Orçamentos Aprovados/Pagos)</td>
                  <td className="py-3 text-right">{approvedBudgets}</td>
                  <td className="py-3 text-right text-emerald-600 font-bold">{formatCurrency(totalRevenue)}</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">Despesas Totais Registradas</td>
                  <td className="py-3 text-right">-</td>
                  <td className="py-3 text-right text-rose-600 font-bold">-{formatCurrency(totalExpense)}</td>
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-950 font-bold">
                  <td className="py-3 px-2 font-bold text-zinc-900 dark:text-zinc-100">Margem Operacional Líquida (Lucro)</td>
                  <td className="py-3 text-right">-</td>
                  <td className={`py-3 px-2 text-right ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Rodapé do relatório */}
          <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-xs text-text-secondary uppercase tracking-widest font-bold mb-1">Assinatura do Responsável</p>
            <div className="h-16 border-b border-zinc-300 w-64 mx-auto my-4"></div>
            <p className="text-xs text-text-muted leading-relaxed max-w-lg mx-auto">
              Este relatório contábil e operacional foi gerado de forma totalmente offline pelo GeoGestor. Os dados acima representam a consolidação em tempo real das tabelas do SQLite.
            </p>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
