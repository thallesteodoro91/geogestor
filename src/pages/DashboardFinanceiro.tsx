import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
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
  const { data: metricsCurrent, isLoading: isLoadingCurrent } = useDashboardMetrics();

  // Auto-expansão: se o ano corrente não trouxe receita, busca janela ampla (2020 → +1 ano)
  const shouldAutoExpand = !isLoadingCurrent && (metricsCurrent?.receita_total ?? 0) === 0;
  const wideStart = "2020-01-01";
  const wideEnd = `${new Date().getFullYear() + 1}-12-31`;
  const { data: metricsWide, isLoading: isLoadingWide } = useDashboardMetrics({
    dataInicio: wideStart,
    dataFim: wideEnd,
    enabled: shouldAutoExpand,
  });

  const metrics = shouldAutoExpand && metricsWide ? metricsWide : metricsCurrent;
  const isLoading = isLoadingCurrent || (shouldAutoExpand && isLoadingWide);
  const isAutoExpanded = shouldAutoExpand && !!metricsWide && (metricsWide.receita_total ?? 0) > 0;

  const { colorblindMode, density } = useChartSettings();
  
  const colors = colorblindMode ? colorblindSafeColors : standardChartColors;

  // Calcular KPIs derivados a partir das métricas agregadas
  const derivedKPIs = metrics ? calculateDerivedKPIs(metrics) : null;

  // Detecta importação incompleta: receita > 0 mas custos e despesas zerados
  const hasReceita = (metrics?.receita_total ?? 0) > 0;
  const noCostsDetected =
    hasReceita &&
    (metrics?.custos_variaveis ?? 0) === 0 &&
    (metrics?.despesas_fixas ?? 0) === 0;
  const profitEqualsRevenue =
    hasReceita && (derivedKPIs?.lucro_liquido ?? 0) === (metrics?.receita_total ?? 0);
  const importWarning = noCostsDetected || profitEqualsRevenue
    ? "Nenhum custo ou despesa foi detectado — o lucro está igual à receita. Verifique se sua planilha possui colunas de custo/despesa mapeadas na próxima importação."
    : undefined;

  // Aviso de inconsistência tributária (Receita x Impostos)
  const taxWarning = (() => {
    if (!hasReceita) return undefined;
    const impostos = metrics?.total_impostos ?? 0;
    if (impostos === 0) {
      return "Nenhum imposto foi identificado nos orçamentos importados. Confira se a coluna de imposto/ISS foi mapeada — caso contrário a Receita Líquida estará igual à Receita Bruta.";
    }
    if (impostos > (metrics?.receita_total ?? 0)) {
      return "O total de impostos é maior que a Receita Bruta — provável erro de mapeamento de coluna na importação.";
    }
    if (impostos / (metrics?.receita_total ?? 1) > 0.5) {
      return "A carga tributária detectada é superior a 50% da receita — verifique se valores de impostos não foram duplicados.";
    }
    return undefined;
  })();

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
        <PageHeader
          title="Dashboard Financeiro"
          subtitle="Análise contábil detalhada e performance financeira"
        >
          <TimeGranularityControl size="sm" />
          <DensityToggle />
        </PageHeader>

        {isAutoExpanded && (
          <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-info flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Não encontramos dados no ano corrente — exibindo o período completo
              ({wideStart.slice(0, 4)} – {wideEnd.slice(0, 4)}) com base nos dados importados.
            </p>
          </div>
        )}

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
                  iconTone="primary"
                  changeType="neutral"
                  description="Faturamento total antes de impostos e deduções."
                  calculation="Σ valor de todos os orçamentos faturados"
                />

                <KPICard
                  title="Receita Líquida"
                  value={formatCurrency(derivedKPIs?.receita_liquida || 0)}
                  icon={DollarSign}
                  iconTone="info"
                  changeType="neutral"
                  description="Receita após dedução de impostos."
                  calculation="Receita Bruta - Impostos"
                  warning={taxWarning}
                />

                <KPICard
                  title="Margem Contribuição"
                  value={formatPercent(derivedKPIs?.margem_contribuicao_percent || 0)}
                  icon={Target}
                  iconTone="primary"
                  changeType="positive"
                  description="Percentual da receita disponível para cobrir custos fixos e gerar lucro."
                  calculation="(Receita Líquida - Custos Variáveis) / Receita Líquida × 100"
                  warning={importWarning}
                />

                <KPICard
                  title="Ponto de Equilíbrio"
                  value={formatCurrency(derivedKPIs?.ponto_equilibrio_receita || 0)}
                  icon={AlertCircle}
                  iconTone="warning"
                  changeType="neutral"
                  description="Receita mínima necessária para cobrir todos os custos."
                  calculation="Custos Fixos / Margem de Contribuição (%)"
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
