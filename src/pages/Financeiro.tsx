import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChartTitle } from "@/components/charts/ChartTitle";
import { SmartCategoryChart } from "@/components/charts/SmartCategoryChart";
import { RichTooltip } from "@/components/charts/RichTooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useKPIs } from "@/hooks/useKPIs";
import { useKPIVariation, formatVariation } from "@/hooks/useKPIVariation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Financeiro = () => {
  const { user } = useAuth();
  const { data: kpis, isLoading } = useKPIs();
  const { data: kpiVariation } = useKPIVariation();

  // Fetch expense breakdown from RPC
  const { data: dashboardMetrics } = useQuery({
    queryKey: ['financial-dashboard-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_financial_dashboard_metrics');
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  // Build DRE data from real KPIs
  const dreData = kpis ? [
    { categoria: "Receita Bruta", valor: kpis.receita_total || 0, type: 'positive' as const },
    { categoria: "(-) Impostos", valor: -(kpis.total_impostos || 0), type: 'negative' as const },
    { categoria: "Receita Líquida", valor: kpis.receita_liquida || 0, type: 'positive' as const },
    { categoria: "(-) Custos Variáveis", valor: -(kpis.custos_variaveis_reais || 0), type: 'negative' as const },
    { categoria: "Lucro Bruto", valor: kpis.lucro_bruto || 0, type: 'positive' as const },
    { categoria: "(-) Despesas Fixas", valor: -(kpis.despesas_fixas_reais || 0), type: 'negative' as const },
    { categoria: "Lucro Líquido", valor: kpis.lucro_liquido || 0, type: 'positive' as const },
  ] : [];

  // Get expense data from dashboard metrics
  const expenseData: Array<{ name: string; value: number }> = (dashboardMetrics?.custos_por_categoria || []).map((c: any) => ({
    name: c.name,
    value: c.value,
  }));
  const totalExpenses = expenseData.reduce((acc, item) => acc + item.value, 0);

  const getDREColor = (type: 'positive' | 'negative') =>
    type === 'positive' ? 'hsl(var(--chart-positive))' : 'hsl(var(--chart-negative))';

  // Calculate margins
  const margemBruta = kpis?.receita_total ? ((kpis.lucro_bruto || 0) / kpis.receita_total * 100).toFixed(0) : '0';
  const margemLiquida = kpis?.receita_total ? ((kpis.lucro_liquido || 0) / kpis.receita_total * 100).toFixed(0) : '0';

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">Gestão Financeira</h1>
          <p className="text-muted-foreground mt-2">Análise detalhada de receitas, custos e lucratividade</p>
        </header>

        <Tabs defaultValue="dre" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
          </TabsList>

          <TabsContent value="dre" className="space-y-6">
            <Card role="region" aria-labelledby="dre-title">
              <CardHeader>
                <ChartTitle 
                  title="DRE - Demonstração do Resultado"
                  description="Estrutura contábil que mostra a formação do resultado (lucro ou prejuízo) a partir da receita bruta até o lucro líquido, deduzindo impostos, custos e despesas."
                  calculation="Lucro Líquido = Receita Bruta - Impostos - Custos Variáveis - Despesas Fixas"
                />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : dreData.length > 0 && dreData.some(d => d.valor !== 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={dreData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                        />
                        <YAxis 
                          type="category"
                          dataKey="categoria"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          width={150}
                        />
                        <Tooltip
                          content={<RichTooltip format="currency" showVariation={false} />}
                          cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                        />
                        <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                          {dreData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getDREColor(entry.type)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">Análise:</span> Margem bruta de {margemBruta}% e margem líquida de {margemLiquida}%.
                          {Number(margemLiquida) > 20 
                            ? " A eficiência operacional está saudável, indicando sustentabilidade financeira."
                            : Number(margemLiquida) > 0
                              ? " Margem positiva, mas há espaço para otimização de custos."
                              : " Atenção: margem negativa indica necessidade de revisão da estrutura de custos."
                          }
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <p className="text-sm">Nenhum dado financeiro disponível</p>
                    <p className="text-xs mt-1">Cadastre orçamentos e despesas para gerar o DRE</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receitas" className="space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-label="Métricas de receita">
              <Card className="p-6" role="region" aria-labelledby="receita-bruta">
                <div className="space-y-2">
                  <p id="receita-bruta" className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
                  {isLoading ? <Skeleton className="h-9 w-32" /> : (
                    <>
                      <p className="text-3xl font-heading font-bold text-foreground">
                        R$ {((kpis?.receita_total || 0) / 1000000).toFixed(2)}M
                      </p>
                      <p className={`text-xs ${kpiVariation?.variations.receita_total >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {kpiVariation ? formatVariation(kpiVariation.variations.receita_total) : '--'} vs período anterior
                      </p>
                    </>
                  )}
                </div>
              </Card>
              <Card className="p-6" role="region" aria-labelledby="receita-liquida">
                <div className="space-y-2">
                  <p id="receita-liquida" className="text-sm font-medium text-muted-foreground">Receita Líquida</p>
                  {isLoading ? <Skeleton className="h-9 w-32" /> : (
                    <>
                      <p className="text-3xl font-heading font-bold text-foreground">
                        R$ {((kpis?.receita_liquida || 0) / 1000000).toFixed(2)}M
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Após impostos ({kpis?.receita_total ? ((kpis.total_impostos || 0) / kpis.receita_total * 100).toFixed(0) : '0'}%)
                      </p>
                    </>
                  )}
                </div>
              </Card>
              <Card className="p-6" role="region" aria-labelledby="ticket-medio">
                <div className="space-y-2">
                  <p id="ticket-medio" className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                  {isLoading ? <Skeleton className="h-9 w-32" /> : (
                    <>
                      <p className="text-3xl font-heading font-bold text-foreground">
                        R$ {((kpis?.ticket_medio || 0) / 1000).toFixed(1)}K
                      </p>
                      <p className={`text-xs ${kpiVariation?.variations.ticket_medio >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {kpiVariation ? formatVariation(kpiVariation.variations.ticket_medio) : '--'} vs período anterior
                      </p>
                    </>
                  )}
                </div>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="despesas" className="space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label="Análise de despesas">
              <Card role="region" aria-labelledby="expense-composition">
                <CardHeader>
                  <ChartTitle 
                    title="Composição de Despesas"
                    description="Distribuição percentual das despesas operacionais por categoria."
                    calculation="% Categoria = (Valor da Categoria / Total de Despesas) × 100"
                  />
                </CardHeader>
                <CardContent>
                  {expenseData.length > 0 ? (
                    <SmartCategoryChart
                      data={expenseData}
                      height={300}
                      maxPieCategories={4}
                      format="currency"
                      ariaLabel="Gráfico de composição de despesas"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      Nenhuma despesa cadastrada
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card role="region" aria-labelledby="monthly-expenses">
                <CardHeader>
                  <ChartTitle 
                    title="Despesas por Categoria"
                    description="Detalhamento das despesas operacionais por categoria, com valores absolutos e proporção relativa ao total."
                    calculation="Total de Despesas = Σ Todas as Categorias de Despesas"
                  />
                </CardHeader>
                <CardContent>
                  {expenseData.length > 0 ? (
                    <div className="space-y-4" role="list" aria-label="Lista de despesas por categoria">
                      {expenseData.map((item, index) => {
                        const percentage = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0;
                        return (
                          <div key={index} className="space-y-2" role="listitem">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">{item.name}</span>
                              <span className="text-muted-foreground">R$ {item.value.toLocaleString('pt-BR')}</span>
                            </div>
                            <div 
                              className="h-2 bg-muted rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={percentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${item.name}: ${percentage.toFixed(0)}% do total`}
                            >
                              <div 
                                className="h-full transition-all rounded-full bg-chart-primary"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      Nenhuma despesa cadastrada
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Financeiro;
