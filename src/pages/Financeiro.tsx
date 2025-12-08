import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChartTitle } from "@/components/charts/ChartTitle";
import { SmartCategoryChart } from "@/components/charts/SmartCategoryChart";
import { RichTooltip } from "@/components/charts/RichTooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dreData, expenseData, totalExpenses, getDREColor } from "@/data/financial-mock-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const Financeiro = () => {
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
                  calculation="Lucro Líquido = Receita Bruta - Impostos - Custos Diretos - Despesas Operacionais"
                />
              </CardHeader>
              <CardContent>
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
                    <Bar
                      dataKey="valor"
                      radius={[0, 8, 8, 0]}
                    >
                      {dreData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDREColor(entry.type)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium text-foreground">Análise:</span> A estrutura de custos está equilibrada, com margem bruta de 40% e margem líquida de 30%. 
                      A eficiência operacional mantém-se consistente, indicando sustentabilidade financeira.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receitas" className="space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-label="Métricas de receita">
              <Card className="p-6" role="region" aria-labelledby="receita-bruta">
                <div className="space-y-2">
                  <p id="receita-bruta" className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
                  <p className="text-3xl font-heading font-bold text-foreground">R$ 2,34M</p>
                  <p className="text-xs text-success">+12,5% vs período anterior</p>
                </div>
              </Card>
              <Card className="p-6" role="region" aria-labelledby="receita-liquida">
                <div className="space-y-2">
                  <p id="receita-liquida" className="text-sm font-medium text-muted-foreground">Receita Líquida</p>
                  <p className="text-3xl font-heading font-bold text-foreground">R$ 2,06M</p>
                  <p className="text-xs text-muted-foreground">Após impostos (12%)</p>
                </div>
              </Card>
              <Card className="p-6" role="region" aria-labelledby="ticket-medio">
                <div className="space-y-2">
                  <p id="ticket-medio" className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                  <p className="text-3xl font-heading font-bold text-foreground">R$ 18,5K</p>
                  <p className="text-xs text-success">+5,8% vs período anterior</p>
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
                    description="Distribuição percentual das despesas operacionais por categoria, mostrando onde a empresa investe seus recursos."
                    calculation="% Categoria = (Valor da Categoria / Total de Despesas) × 100"
                  />
                </CardHeader>
                <CardContent>
                  {/* Smart chart: auto-switches to bar chart if > 4 categories */}
                  <SmartCategoryChart
                    data={expenseData}
                    height={300}
                    maxPieCategories={4}
                    format="currency"
                    ariaLabel="Gráfico de composição de despesas"
                  />
                </CardContent>
              </Card>
              
              <Card role="region" aria-labelledby="monthly-expenses">
                <CardHeader>
                  <ChartTitle 
                    title="Despesas Mensais"
                    description="Detalhamento das despesas operacionais mensais por categoria, com valores absolutos e proporção relativa ao total."
                    calculation="Total de Despesas = Σ Todas as Categorias de Despesas"
                  />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" role="list" aria-label="Lista de despesas por categoria">
                    {expenseData.map((item, index) => {
                      const percentage = (item.value / totalExpenses) * 100;
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
