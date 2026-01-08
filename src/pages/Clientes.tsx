import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, MapPin, Award, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Cell } from "recharts";
import { useClientesAnalytics } from "@/hooks/useClientesAnalytics";
import { formatCurrency } from "@/ui/formatters/currency.formatter";

export default function Clientes() {
  const { isLoading, paretoData, ltvData, rentabilidadeData, kpis } = useClientesAnalytics();

  const formatLTV = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return formatCurrency(value);
  };

  // Generate dynamic insights based on real data
  const getParetoInsight = () => {
    if (paretoData.length === 0) return "Sem dados suficientes para análise de Pareto.";
    const top3 = paretoData.slice(0, 3);
    const top3Percent = top3.length > 0 ? top3[top3.length - 1]?.acumulado || 0 : 0;
    return `Os três principais clientes representam ${top3Percent}% do faturamento, ${top3Percent >= 60 ? "indicando forte relacionamento com clientes-chave" : "com boa distribuição de receita"}.`;
  };

  const getLtvInsight = () => {
    if (ltvData.length < 2) return "Dados insuficientes para análise de tendência de LTV.";
    const first = ltvData[0]?.ltv || 0;
    const last = ltvData[ltvData.length - 1]?.ltv || 0;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    if (change > 0) {
      return `O LTV aumentou ${Math.round(change)}% no período, refletindo fidelização e aumento na frequência de projetos.`;
    } else if (change < 0) {
      return `O LTV diminuiu ${Math.abs(Math.round(change))}% no período. Considere estratégias de retenção.`;
    }
    return "O LTV permaneceu estável no período analisado.";
  };

  const getRentabilidadeInsight = () => {
    if (rentabilidadeData.length === 0) return "Sem dados de rentabilidade de projetos.";
    const highProfit = rentabilidadeData.filter((r) => r.rentabilidade >= 30);
    if (highProfit.length > 0) {
      return `${highProfit.length} projeto(s) apresentam rentabilidade acima de 30%. Foco estratégico nestes serviços pode amplificar resultados.`;
    }
    return "Os projetos apresentam margens moderadas. Considere revisar custos operacionais.";
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const hasData = paretoData.length > 0 || ltvData.length > 0 || rentabilidadeData.length > 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Clientes e Projetos</h1>
          <p className="text-muted-foreground mt-2">Análise de rentabilidade, LTV e distribuição geográfica</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total de Clientes"
            value={kpis.totalClientes.toString()}
            icon={Users}
            subtitle="cadastrados"
          />
          <KPICard
            title="LTV Médio"
            value={formatLTV(kpis.ltvMedio)}
            icon={Award}
            subtitle="lifetime value"
          />
          <KPICard
            title="Top 3 Clientes"
            value={`${kpis.top3Percentual}%`}
            icon={TrendingUp}
            subtitle="da receita total"
          />
          <KPICard
            title="Cidades Ativas"
            value={kpis.cidadesAtivas.toString()}
            icon={MapPin}
            subtitle="áreas de atuação"
          />
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Sem dados para análise</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Cadastre clientes e orçamentos para visualizar análises de receita, LTV e rentabilidade.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="analise" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="analise">Análise de Clientes</TabsTrigger>
              <TabsTrigger value="projetos">Projetos</TabsTrigger>
            </TabsList>

            <TabsContent value="analise" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StoryCard
                  title="Distribuição de Receita"
                  insight={getParetoInsight()}
                  category="strategic"
                />
                <StoryCard
                  title="Tendência de LTV"
                  insight={getLtvInsight()}
                  category="financial"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {paretoData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Receita por Cliente (Pareto)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={paretoData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="cliente" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" unit="%" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                            formatter={(value: number, name: string) => {
                              if (name === "receita") return [formatCurrency(value), "Receita"];
                              return [`${value}%`, "Acumulado"];
                            }}
                          />
                          <Bar yAxisId="left" dataKey="receita" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {ltvData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Evolução do LTV Médio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={ltvData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                          <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                            formatter={(value: number) => [formatCurrency(value), "LTV Médio"]}
                          />
                          <Line type="monotone" dataKey="ltv" stroke="hsl(var(--chart-3))" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="projetos" className="space-y-6">
              <StoryCard
                title="Rentabilidade dos Projetos"
                insight={getRentabilidadeInsight()}
                category="operational"
              />

              {rentabilidadeData.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Rentabilidade por Projeto (%)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={rentabilidadeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" unit="%" />
                        <YAxis dataKey="projeto" type="category" stroke="hsl(var(--muted-foreground))" width={150} fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === "rentabilidade") return [`${value}%`, "Rentabilidade"];
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="rentabilidade" radius={[0, 8, 8, 0]}>
                          {rentabilidadeData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Sem dados de projetos</h3>
                    <p className="text-muted-foreground text-center">
                      Cadastre serviços com receita e custo para visualizar análises de rentabilidade.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
