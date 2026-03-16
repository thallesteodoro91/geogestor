import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { RichTooltip } from "@/components/charts/RichTooltip";
import { RevenueTrendChart } from "@/components/charts/RevenueTrendChart";
import { ServiceEfficiencyMatrix } from "@/components/charts/ServiceEfficiencyMatrix";
import { ExpenseTreemap } from "@/components/charts/ExpenseTreemap";
import { SalesFunnelChart } from "@/components/charts/SalesFunnelChart";
import { TimeGranularityControl, DensityToggle } from "@/components/controls";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { AIInsightsCard } from "@/components/dashboard/AIInsightsCard";
import { useDashboardMetrics, calculateDerivedKPIs } from "@/hooks/useDashboardMetrics";
import { standardChartColors, colorblindSafeColors } from "@/data/financial-mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  DollarSign,
  Target,
  AlertCircle,
} from "lucide-react";

const DashboardFinanceiro = () => {
  // Buscar todas as métricas via RPC (processamento no servidor)
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { colorblindMode, density } = useChartSettings();
  
  const colors = colorblindMode ? colorblindSafeColors : standardChartColors;

  // Calcular KPIs derivados a partir das métricas agregadas
  const derivedKPIs = metrics ? calculateDerivedKPIs(metrics) : null;

  // Cores para o gráfico de lucro por cliente
  const clienteColors = [
    "hsl(160, 84%, 39%)",   // Emerald
    "hsl(239, 84%, 67%)",   // Indigo
    "hsl(280, 70%, 50%)",   // Roxo
    "hsl(48, 96%, 53%)",    // Amarelo
    "hsl(350, 89%, 60%)",   // Rose
    "hsl(173, 80%, 40%)",   // Teal
    "hsl(340, 75%, 55%)",   // Rosa
    "hsl(25, 95%, 53%)",    // Laranja
  ];

  // Dados vindos diretamente do servidor (já agregados) com cores incluídas
  const lucroPorCliente = (metrics?.lucro_por_cliente || []).map((item, index) => ({
    ...item,
    fill: clienteColors[index % clienteColors.length],
  }));

  // Dados do Waterfall Chart - Fluxo Financeiro
  const waterfallData = metrics ? [
    { name: "Receita Bruta", valor: metrics.receita_total, fill: "hsl(var(--chart-primary))" },
    { name: "Impostos", valor: -metrics.total_impostos, fill: "hsl(var(--chart-secondary))" },
    { name: "Custos Var.", valor: -metrics.custos_variaveis, fill: "hsl(var(--chart-negative))" },
    { name: "Desp. Fixas", valor: -metrics.despesas_fixas, fill: "hsl(var(--chart-warning))" },
    { name: "Lucro Líquido", valor: derivedKPIs?.lucro_liquido || 0, fill: "hsl(var(--chart-positive))" },
  ] : [];

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
          </nav>
        </header>

        {/* Main KPIs Section - First in DOM for accessibility */}
        <section aria-labelledby="kpis-heading" role="region">
          <h2 id="kpis-heading" className="sr-only">Indicadores Principais</h2>
          <div className={`grid md:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
            {isLoading ? (
              <>
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
              </>
            ) : (
              <>
                <KPICard
                  title="Receita Bruta"
                  value={formatCurrency(metrics?.receita_total || 0)}
                  icon={DollarSign}
                  iconColor="#6366f1"
                  changeType="neutral"
                  description="Faturamento total antes de impostos e deduções."
                  calculation="Σ valor de todos os orçamentos faturados"
                />

                <KPICard
                  title="Receita Líquida"
                  value={formatCurrency(derivedKPIs?.receita_liquida || 0)}
                  icon={DollarSign}
                  iconColor="#3b82f6"
                  changeType="neutral"
                  description="Receita após dedução de impostos."
                  calculation="Receita Bruta - Impostos"
                />

                <KPICard
                  title="Margem Contribuição"
                  value={formatPercent(derivedKPIs?.margem_contribuicao_percent || 0)}
                  icon={Target}
                  iconColor="#8b5cf6"
                  changeType="positive"
                />

                <KPICard
                  title="Ponto de Equilíbrio"
                  value={formatCurrency(derivedKPIs?.ponto_equilibrio_receita || 0)}
                  icon={AlertCircle}
                  iconColor="#f59e0b"
                  changeType="neutral"
                />
              </>
            )}
          </div>
        </section>

        {/* Gráfico Evolução Receita e Lucro - Full Width */}
        <section aria-label="Evolução receita e lucro">
          <RevenueTrendChart />
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
                  {formatPercent(derivedKPIs?.margem_contribuicao_percent || 0)}
                </span>
                , com lucro líquido de{" "}
                <span className="font-bold text-success">
                  {formatCurrency(derivedKPIs?.lucro_liquido || 0)}
                </span>
                . O ponto de equilíbrio está em{" "}
                <span className="font-bold text-warning">
                  {formatCurrency(derivedKPIs?.ponto_equilibrio_receita || 0)}
                </span>{" "}
                reais. A receita total do período{" "}
                {(metrics?.receita_total || 0) >= (derivedKPIs?.ponto_equilibrio_receita || 0) ? (
                  <span className="font-bold text-success">superou o ponto de equilíbrio</span>
                ) : (
                  <span className="font-bold text-destructive">está abaixo do ponto de equilíbrio</span>
                )}
                , demonstrando{" "}
                {(metrics?.receita_total || 0) >= (derivedKPIs?.ponto_equilibrio_receita || 0)
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
                  <Tooltip
                    content={<RichTooltip format="currency" showVariation={false} />}
                    cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                  />
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
            value={metrics?.receita_total || 0}
            max={Math.max((derivedKPIs?.ponto_equilibrio_receita || 0) * 1.5, metrics?.receita_total || 1)}
            title="Ponto de Equilíbrio"
            subtitle={`Meta: ${formatCurrency(derivedKPIs?.ponto_equilibrio_receita || 0)}`}
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
              {isLoading ? (
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
                    <Tooltip
                      content={<RichTooltip format="currency" showVariation={false} />}
                      cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                    />
                    <Bar dataKey="lucro" radius={[0, 8, 8, 0]}>
                      {lucroPorCliente.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fill} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Funil de Vendas */}
          <SalesFunnelChart />
        </section>

        {/* Terceira Linha - Treemap de Custos */}
        <section className={`grid lg:grid-cols-2 ${gridGap}`} aria-label="Análise de custos e eficiência">
          {/* ExpenseTreemap - Custos por Categoria */}
          <ExpenseTreemap
            data={metrics?.custos_por_categoria || []}
            isLoading={isLoading}
          />

          {/* Matriz de Eficiência de Serviços */}
          <ServiceEfficiencyMatrix
            data={metrics?.margem_por_servico || []}
            isLoading={isLoading}
          />
        </section>

        {/* Quarta Linha - Insights com IA */}
        <section aria-label="Insights com IA">
          <AIInsightsCard />
        </section>

      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;
