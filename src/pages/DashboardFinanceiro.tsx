import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { RichTooltip } from "@/components/charts/RichTooltip";
import { TimeGranularityControl, DensityToggle } from "@/components/controls";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
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
  ReferenceLine,
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

  // Dados vindos diretamente do servidor (já agregados)
  const lucroPorCliente = metrics?.lucro_por_cliente || [];
  const margemPorServico = metrics?.margem_por_servico || [];

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
                  subtitle={`${metrics?.total_orcamentos || 0} orçamentos emitidos`}
                  changeType="neutral"
                  description="Soma total de todas as receitas esperadas dos orçamentos (antes de impostos)"
                  calculation="Σ (Receita Esperada de todos os Orçamentos)"
                />

                <KPICard
                  title="Receita Líquida"
                  value={formatCurrency(derivedKPIs?.receita_liquida || 0)}
                  icon={DollarSign}
                  subtitle={`Impostos: ${formatCurrency(metrics?.total_impostos || 0)}`}
                  changeType="neutral"
                  description="Receita após dedução dos impostos"
                  calculation="Receita Bruta - Impostos"
                />

                <KPICard
                  title="Margem Contribuição"
                  value={formatPercent(derivedKPIs?.margem_contribuicao_percent || 0)}
                  icon={Target}
                  subtitle="Receita - Custos Variáveis"
                  changeType="positive"
                  description="Percentual da receita disponível para cobrir custos fixos e gerar lucro"
                  calculation="((Receita - Custos Variáveis) / Receita) × 100"
                />

                <KPICard
                  title="Ponto de Equilíbrio"
                  value={formatCurrency(derivedKPIs?.ponto_equilibrio_receita || 0)}
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
              {isLoading ? (
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
                    <Tooltip
                      content={<RichTooltip format="percent" showVariation={false} />}
                      cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                    />
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

      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;
