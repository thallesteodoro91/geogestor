import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { SmartCategoryChart } from "@/components/charts/SmartCategoryChart";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { TimeGranularityControl, DensityToggle, ColorblindToggle } from "@/components/controls";
import { useKPIs } from "@/hooks/useKPIs";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { standardChartColors, colorblindSafeColors } from "@/data/financial-mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Target,
  AlertCircle,
} from "lucide-react";

const DashboardFinanceiro = () => {
  const { data: kpis, isLoading: kpisLoading } = useKPIs();
  const { colorblindMode, density } = useChartSettings();
  
  const colors = colorblindMode ? colorblindSafeColors : standardChartColors;

  // Buscar dados de lucro por cliente
  const { data: lucroPorCliente = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["lucro-por-cliente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_orcamento")
        .select(`
          id_cliente,
          lucro_esperado,
          dim_cliente!inner(nome)
        `)
        .order("lucro_esperado", { ascending: false })
        .limit(10);

      if (error) throw error;

      const grouped = data.reduce((acc: { cliente: string; lucro: number }[], curr) => {
        const cliente = curr.dim_cliente.nome;
        const existing = acc.find((item) => item.cliente === cliente);
        if (existing) {
          existing.lucro += curr.lucro_esperado || 0;
        } else {
          acc.push({
            cliente: cliente.length > 15 ? cliente.substring(0, 12) + "..." : cliente,
            lucro: curr.lucro_esperado || 0,
          });
        }
        return acc;
      }, []);

      return grouped.sort((a, b) => b.lucro - a.lucro).slice(0, 6);
    },
  });

  // Buscar dados de margem por serviço
  const { data: margemPorServico = [], isLoading: servicosLoading } = useQuery({
    queryKey: ["margem-por-servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_servico")
        .select(`
          nome_do_servico,
          categoria,
          receita_servico,
          custo_servico
        `)
        .order("receita_servico", { ascending: false })
        .limit(10);

      if (error) throw error;

      return data.map((s) => ({
        servico: s.nome_do_servico.length > 18 ? s.nome_do_servico.substring(0, 15) + "..." : s.nome_do_servico,
        margem: s.receita_servico > 0 ? ((s.receita_servico - s.custo_servico) / s.receita_servico * 100) : 0,
      })).slice(0, 6);
    },
  });

  // Buscar dados de custos por categoria
  const { data: custosPorCategoria = [], isLoading: custosLoading } = useQuery({
    queryKey: ["custos-por-categoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_despesas")
        .select(`
          valor_da_despesa,
          dim_tipodespesa!inner(categoria)
        `);

      if (error) throw error;

      const grouped = data.reduce((acc: { name: string; value: number }[], curr) => {
        const categoria = curr.dim_tipodespesa.categoria;
        const existing = acc.find((item) => item.name === categoria);
        if (existing) {
          existing.value += curr.valor_da_despesa;
        } else {
          acc.push({
            name: categoria,
            value: curr.valor_da_despesa,
          });
        }
        return acc;
      }, []);

      return grouped.sort((a, b) => b.value - a.value);
    },
  });

  // Dados do Waterfall Chart - Fluxo Financeiro
  const waterfallData = [
    { name: "Receita", valor: kpis?.receita_total || 0, fill: "hsl(var(--chart-primary))" },
    { name: "Custos", valor: -(kpis?.custo_total || 0), fill: "hsl(var(--chart-negative))" },
    { name: "Despesas", valor: -(kpis?.total_despesas || 0), fill: "hsl(var(--chart-warning))" },
    { name: "Lucro", valor: kpis?.lucro_liquido || 0, fill: "hsl(var(--chart-positive))" },
  ];

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Density-based spacing classes
  const sectionSpacing = density === 'compact' ? 'space-y-4' : 'space-y-6';
  const gridGap = density === 'compact' ? 'gap-4' : 'gap-6';
  const cardPadding = density === 'compact' ? 'p-4' : 'p-6';

  return (
    <AppLayout>
      <div className={sectionSpacing}>
        {/* Header with Controls */}
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground tracking-tight">
              Dashboard Financeiro
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Análise contábil detalhada e performance financeira
            </p>
          </div>
          
          {/* Chart Controls */}
          <nav className="flex items-center gap-2" aria-label="Controles de visualização">
            <TimeGranularityControl size="sm" />
            <DensityToggle />
            <ColorblindToggle />
          </nav>
        </header>

        {/* Main KPIs Section - First in DOM for accessibility */}
        <section aria-labelledby="kpis-heading" role="region">
          <h2 id="kpis-heading" className="sr-only">Indicadores Principais</h2>
          <div className={`grid md:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
            {kpisLoading ? (
              <>
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
              </>
            ) : (
              <>
                <KPICard
                  title="Receita Total"
                  value={formatCurrency(kpis?.receita_total || 0)}
                  icon={DollarSign}
                  subtitle={`${kpis?.total_orcamentos || 0} orçamentos emitidos`}
                  changeType="neutral"
                  description="Soma total de todas as receitas esperadas dos orçamentos"
                  calculation="Σ (Receita Esperada de todos os Orçamentos)"
                />

                <KPICard
                  title="Lucro Líquido"
                  value={formatCurrency(kpis?.lucro_liquido || 0)}
                  icon={TrendingUp}
                  subtitle={`Margem: ${formatPercent(kpis?.margem_liquida_percent || 0)}`}
                  changeType="positive"
                  description="Lucro final após todas as deduções de custos e despesas"
                  calculation="Receita Total - Custos Totais - Despesas Operacionais"
                />

                <KPICard
                  title="Margem Contribuição"
                  value={formatPercent(kpis?.margem_contribuicao_percent || 0)}
                  icon={Target}
                  subtitle="Receita - Custos Variáveis"
                  changeType="positive"
                  description="Percentual da receita disponível para cobrir custos fixos e gerar lucro"
                  calculation="((Receita - Custos Variáveis) / Receita) × 100"
                />

                <KPICard
                  title="Ponto de Equilíbrio"
                  value={formatCurrency(kpis?.ponto_equilibrio_receita || 0)}
                  icon={AlertCircle}
                  subtitle="Receita mínima necessária"
                  changeType="neutral"
                  description="Receita necessária para cobrir todos os custos sem gerar lucro nem prejuízo"
                  calculation="Custos Fixos / Margem de Contribuição (%)"
                />
              </>
            )}
          </div>
        </section>

        {/* Análise Textual */}
        <section aria-labelledby="summary-heading" role="region">
          <Card className="bg-gradient-to-br from-card to-card/80 interactive-lift">
            <CardHeader>
              <CardTitle id="summary-heading">Resumo Executivo</CardTitle>
              <CardDescription>Análise automática do período</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed">
                A margem média da empresa neste período foi de{" "}
                <span className="font-bold text-accent">
                  {formatPercent(kpis?.margem_contribuicao_percent || 0)}
                </span>
                , com lucro líquido de{" "}
                <span className="font-bold text-success">
                  {formatCurrency(kpis?.lucro_liquido || 0)}
                </span>
                . O ponto de equilíbrio está em{" "}
                <span className="font-bold text-warning">
                  {formatCurrency(kpis?.ponto_equilibrio_receita || 0)}
                </span>{" "}
                reais. A receita total do período{" "}
                {(kpis?.receita_total || 0) >= (kpis?.ponto_equilibrio_receita || 0) ? (
                  <span className="font-bold text-success">superou o ponto de equilíbrio</span>
                ) : (
                  <span className="font-bold text-destructive">está abaixo do ponto de equilíbrio</span>
                )}
                , demonstrando{" "}
                {(kpis?.receita_total || 0) >= (kpis?.ponto_equilibrio_receita || 0)
                  ? "uma operação saudável e sustentável"
                  : "necessidade de atenção aos custos ou aumento de receita"}.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Gráficos - Primeira Linha */}
        <section className={`grid lg:grid-cols-2 ${gridGap}`} aria-label="Gráficos financeiros principais">
          {/* Waterfall Chart - Fluxo Financeiro */}
          <Card className="interactive-lift" role="region" aria-labelledby="waterfall-title">
            <CardHeader>
              <CardTitle id="waterfall-title">Fluxo Financeiro</CardTitle>
              <CardDescription>Da receita ao lucro líquido</CardDescription>
            </CardHeader>
            <CardContent className={cardPadding}>
              <ResponsiveContainer width="100%" height={density === 'compact' ? 250 : 300}>
                <BarChart data={waterfallData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `R$ ${(Math.abs(value) / 1000).toFixed(0)}k`}
                    fontSize={12}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    width={80}
                    fontSize={12}
                  />
                  <ChartTooltip format="currency" />
                  <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gauge Chart - Ponto de Equilíbrio */}
          <GaugeChart
            value={kpis?.receita_total || 0}
            max={Math.max((kpis?.ponto_equilibrio_receita || 0) * 1.5, kpis?.receita_total || 1)}
            title="Ponto de Equilíbrio"
            subtitle={`Meta: ${formatCurrency(kpis?.ponto_equilibrio_receita || 0)}`}
          />
        </section>

        {/* Gráficos - Segunda Linha */}
        <section className={`grid lg:grid-cols-2 ${gridGap}`} aria-label="Análise de lucratividade">
          {/* Lucro por Cliente - Horizontal Bar */}
          <Card className="interactive-lift" role="region" aria-labelledby="profit-client-title">
            <CardHeader>
              <CardTitle id="profit-client-title">Lucro por Cliente</CardTitle>
              <CardDescription>Top clientes por lucratividade esperada</CardDescription>
            </CardHeader>
            <CardContent className={cardPadding}>
              {clientesLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={density === 'compact' ? 250 : 300}>
                  <BarChart data={lucroPorCliente} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="cliente"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={100}
                    />
                    <ChartTooltip format="currency" />
                    <Bar dataKey="lucro" fill={colors[0]} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Margem por Serviço - Horizontal Bar com Linha de Referência */}
          <Card className="interactive-lift" role="region" aria-labelledby="margin-service-title">
            <CardHeader>
              <CardTitle id="margin-service-title">Margem por Serviço</CardTitle>
              <CardDescription>Rentabilidade dos principais serviços (meta: 30%)</CardDescription>
            </CardHeader>
            <CardContent className={cardPadding}>
              {servicosLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={density === 'compact' ? 250 : 300}>
                  <BarChart data={margemPorServico} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `${value}%`}
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="servico"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={120}
                    />
                    <ChartTooltip format="percent" />
                    <ReferenceLine 
                      x={30} 
                      stroke="hsl(var(--chart-warning))" 
                      strokeDasharray="5 5" 
                      label={{ value: "Meta", fill: "hsl(var(--chart-warning))", fontSize: 10 }} 
                    />
                    <Bar dataKey="margem" radius={[0, 8, 8, 0]}>
                      {margemPorServico.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.margem >= 30 ? "hsl(var(--chart-positive))" : "hsl(var(--chart-negative))"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Gráficos - Terceira Linha */}
        <section className={`grid lg:grid-cols-2 ${gridGap}`} aria-label="Análise de custos e receitas">
          {/* Custos por Categoria - Smart Chart (auto pie/bar) */}
          <Card className="interactive-lift" role="region" aria-labelledby="costs-category-title">
            <CardHeader>
              <CardTitle id="costs-category-title">Custos por Categoria</CardTitle>
              <CardDescription>Distribuição das despesas operacionais</CardDescription>
            </CardHeader>
            <CardContent className={cardPadding}>
              {custosLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <SmartCategoryChart
                  data={custosPorCategoria}
                  height={density === 'compact' ? 250 : 300}
                  maxPieCategories={4}
                  format="currency"
                  ariaLabel="Gráfico de custos por categoria"
                />
              )}
            </CardContent>
          </Card>

          {/* Receita Comparativa */}
          <Card className="interactive-lift" role="region" aria-labelledby="revenue-compare-title">
            <CardHeader>
              <CardTitle id="revenue-compare-title">Receita: Esperada x Realizada</CardTitle>
              <CardDescription>Comparativo de execução financeira</CardDescription>
            </CardHeader>
            <CardContent className={cardPadding}>
              <ResponsiveContainer width="100%" height={density === 'compact' ? 250 : 300}>
                <BarChart 
                  data={[
                    { tipo: "Esperada", valor: kpis?.receita_total || 0 },
                    { tipo: "Realizada", valor: kpis?.receita_realizada_total || 0 },
                    { tipo: "Faturada", valor: kpis?.valor_faturado_total || 0 },
                  ]} 
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    fontSize={12}
                  />
                  <YAxis 
                    type="category"
                    dataKey="tipo" 
                    stroke="hsl(var(--muted-foreground))"
                    width={80}
                    fontSize={12}
                  />
                  <ChartTooltip format="currency" />
                  <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                    <Cell fill={colors[0]} />
                    <Cell fill={colors[1]} />
                    <Cell fill={colors[2]} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;
