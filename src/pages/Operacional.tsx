import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartTitle } from "@/components/charts/ChartTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeGranularityControl } from "@/components/controls/TimeGranularityControl";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { useOperationalMetrics } from "@/hooks/useOperationalMetrics";
import { Clock, TrendingUp, DollarSign, Zap, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { 
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  addMonths, addQuarters, addYears, format 
} from "date-fns";

const servicoCores: Record<string, string> = {
  "Levantamento": "hsl(var(--chart-1))",
  "Georreferenciamento": "hsl(var(--chart-2))",
  "Desmembramento": "hsl(var(--chart-3))",
  "Planta Topográfica": "hsl(var(--chart-4))",
  "Outros": "hsl(var(--chart-5))",
};

const getColorForCategory = (categoria: string, index: number): string => {
  if (servicoCores[categoria]) return servicoCores[categoria];
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];
  return colors[index % colors.length];
};

function getDateRangeByGranularity(granularity: string, periodOffset: number) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (granularity) {
    case 'month': {
      const targetMonth = addMonths(now, periodOffset);
      startDate = startOfMonth(targetMonth);
      endDate = endOfMonth(targetMonth);
      break;
    }
    case 'quarter': {
      const targetQuarter = addQuarters(now, periodOffset);
      startDate = startOfQuarter(targetQuarter);
      endDate = endOfQuarter(targetQuarter);
      break;
    }
    case 'year':
    default: {
      const targetYear = addYears(now, periodOffset);
      startDate = startOfYear(targetYear);
      endDate = endOfYear(targetYear);
      break;
    }
  }

  return {
    dataInicio: format(startDate, 'yyyy-MM-dd'),
    dataFim: format(endDate, 'yyyy-MM-dd'),
  };
}

export default function Operacional() {
  const [tempoMedioFiltro, setTempoMedioFiltro] = useState<string>("todos");
  const [ticketMedioFiltro, setTicketMedioFiltro] = useState<string>("todos");
  const [servicoSelecionado, setServicoSelecionado] = useState<string>("todos");

  const { granularity, periodOffset } = useChartSettings();
  const { dataInicio, dataFim } = getDateRangeByGranularity(granularity, periodOffset);
  
  const { data: metrics, isLoading } = useOperationalMetrics(dataInicio, dataFim);

  // Filter chart data based on selections
  const tempoMedioFiltrado = useMemo(() => {
    if (!metrics?.charts.tempoPorCategoria) return [];
    if (tempoMedioFiltro === "todos") return metrics.charts.tempoPorCategoria;
    return metrics.charts.tempoPorCategoria.filter(item => item.servico === tempoMedioFiltro);
  }, [metrics?.charts.tempoPorCategoria, tempoMedioFiltro]);

  const ticketMedioFiltrado = useMemo(() => {
    if (!metrics?.charts.ticketPorCategoria) return [];
    if (ticketMedioFiltro === "todos") return metrics.charts.ticketPorCategoria;
    return metrics.charts.ticketPorCategoria.filter(item => item.servico === ticketMedioFiltro);
  }, [metrics?.charts.ticketPorCategoria, ticketMedioFiltro]);

  const custoReceitaFiltrado = useMemo(() => {
    if (!metrics?.charts.custoReceitaPorCategoria) return [];
    if (servicoSelecionado === "todos") return metrics.charts.custoReceitaPorCategoria;
    return metrics.charts.custoReceitaPorCategoria.filter(item => item.servico === servicoSelecionado);
  }, [metrics?.charts.custoReceitaPorCategoria, servicoSelecionado]);

  // Get unique categories for filters
  const categoriasDisponiveis = useMemo(() => {
    if (!metrics) return [];
    const categorias = new Set<string>();
    metrics.charts.tempoPorCategoria.forEach(item => categorias.add(item.servico));
    metrics.charts.ticketPorCategoria.forEach(item => categorias.add(item.servico));
    metrics.charts.custoReceitaPorCategoria.forEach(item => categorias.add(item.servico));
    return Array.from(categorias).sort();
  }, [metrics]);

  // Generate dynamic story insights
  const storyProdutividade = useMemo(() => {
    if (!metrics) return "Carregando dados de produtividade...";
    const { produtividade, tempoMedioDias } = metrics.kpis;
    const { concluidos, total } = metrics.totals;
    
    if (total === 0) return "Nenhum serviço encontrado neste período.";
    
    return `A produtividade das equipes está em ${produtividade}% neste período — ${concluidos} de ${total} serviços foram concluídos${tempoMedioDias > 0 ? `, com tempo médio de ${tempoMedioDias} dias` : ''}.`;
  }, [metrics]);

  const storyTaxaConclusao = useMemo(() => {
    if (!metrics) return "Carregando dados...";
    const { concluidos, emAndamento, pendentes } = metrics.totals;
    
    if (concluidos === 0 && emAndamento === 0 && pendentes === 0) {
      return "Nenhum serviço registrado neste período.";
    }
    
    return `${concluidos} serviço${concluidos !== 1 ? 's foram concluídos' : ' foi concluído'}, ${emAndamento} ${emAndamento === 1 ? 'está' : 'estão'} em andamento e ${pendentes} ${pendentes === 1 ? 'aguarda' : 'aguardam'} início.`;
  }, [metrics]);

  const storyTicketMedio = useMemo(() => {
    if (!metrics) return "Carregando dados...";
    const { ticketMedio } = metrics.kpis;
    
    if (ticketMedio === 0) return "Sem dados de receita neste período.";
    
    return `O ticket médio está em R$ ${ticketMedio.toLocaleString('pt-BR')} por serviço neste período — reflexo da precificação e mix de serviços realizados.`;
  }, [metrics]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold text-foreground">Gestão Operacional</h1>
            <p className="text-muted-foreground mt-2">Análise de produtividade, tempo e eficiência operacional</p>
          </div>
          <TimeGranularityControl />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <>
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </>
          ) : (
            <>
              <KPICard
                title="Tempo Médio Conclusão"
                value={`${metrics?.kpis.tempoMedioDias || 0} dias`}
                icon={Clock}
              />
              <KPICard
                title="Produtividade"
                value={`${metrics?.kpis.produtividade || 0}%`}
                icon={TrendingUp}
              />
              <KPICard
                title="Ticket Médio"
                value={`R$ ${(metrics?.kpis.ticketMedio || 0).toLocaleString('pt-BR')}`}
                icon={DollarSign}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StoryCard
            title="Produtividade das Equipes"
            insight={storyProdutividade}
            category="operational"
            icon={Zap}
          />
          <StoryCard
            title="Taxa de Conclusão"
            insight={storyTaxaConclusao}
            category="operational"
            icon={Award}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="space-y-3">
              <ChartTitle 
                title="Tempo Médio por Serviço"
                description="Mostra o tempo médio de conclusão (em dias) para cada tipo de serviço oferecido, indicando eficiência operacional."
                calculation="Tempo Médio = Σ Dias de Execução / Número de Serviços"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={tempoMedioFiltro} onValueChange={setTempoMedioFiltro}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Serviços</SelectItem>
                    {categoriasDisponiveis.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : tempoMedioFiltrado.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tempoMedioFiltrado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="servico" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary))",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      formatter={(value: number) => [`${value} dias`, 'Tempo Médio']}
                    />
                    <Bar dataKey="tempo" radius={[8, 8, 0, 0]}>
                      {tempoMedioFiltrado.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForCategory(entry.servico, index)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ChartTitle 
                title="Status dos Serviços"
                description="Distribuição percentual dos serviços entre concluídos, em andamento e pendentes, oferecendo visão da carga de trabalho atual."
                calculation="% Status = (Quantidade do Status / Total de Serviços) × 100"
              />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : !metrics?.charts.statusDistribuicao.length ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.charts.statusDistribuicao}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={0}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {metrics.charts.statusDistribuicao.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary))",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                      formatter={(value: number, name: string) => [`${value} serviços`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <ChartTitle 
                  title="Ticket Médio por Serviço"
                  description="Valor médio de receita gerado por cada tipo de serviço, permitindo identificar quais são os mais rentáveis."
                  calculation="Ticket Médio = Receita Total do Serviço / Quantidade de Serviços"
                />
                <Select value={ticketMedioFiltro} onValueChange={setTicketMedioFiltro}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Serviços</SelectItem>
                    {categoriasDisponiveis.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : ticketMedioFiltrado.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ticketMedioFiltrado} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      type="number" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                    />
                    <YAxis dataKey="servico" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={150} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary))",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Ticket Médio']}
                    />
                    <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                      {ticketMedioFiltrado.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForCategory(entry.servico, index)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <ChartTitle 
                  title="Custo vs Receita por Serviço"
                  description="Compara custo direto, receita e lucro bruto por tipo de serviço. Permite identificar quais serviços são mais rentáveis."
                  calculation="Lucro Bruto = Receita - Custo Direto | Margem Bruta = (Lucro Bruto / Receita) × 100"
                />
                <Select value={servicoSelecionado} onValueChange={setServicoSelecionado}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Serviços</SelectItem>
                    {categoriasDisponiveis.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : custoReceitaFiltrado.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={custoReceitaFiltrado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="servico" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary))",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      formatter={(value: number, name: string) => {
                        const margemBruta = name === "Lucro Bruto" && custoReceitaFiltrado.length > 0 
                          ? ` (${((value / custoReceitaFiltrado[0].receita) * 100).toFixed(1)}%)`
                          : '';
                        return [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${margemBruta}`, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="custo" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} name="Custo Direto" />
                    <Bar dataKey="receita" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} name="Receita" />
                    <Bar dataKey="lucro" fill="hsl(142, 76%, 36%)" radius={[8, 8, 0, 0]} name="Lucro Bruto" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <StoryCard
          title="Ticket Médio"
          insight={storyTicketMedio}
          category="strategic"
        />
      </div>
    </AppLayout>
  );
}
