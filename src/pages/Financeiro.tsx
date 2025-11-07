import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const dreData = [
  { categoria: "Receita Bruta", valor: 2340000 },
  { categoria: "(-) Impostos", valor: -280800 },
  { categoria: "Receita Líquida", valor: 2059200 },
  { categoria: "(-) Custos Diretos", valor: -1235520 },
  { categoria: "Lucro Bruto", valor: 823680 },
  { categoria: "(-) Despesas Op.", valor: -206000 },
  { categoria: "Lucro Líquido", valor: 617680 },
];

const expenseData = [
  { name: "Pessoal", value: 95000, color: "hsl(var(--chart-1))" },
  { name: "Equipamentos", value: 42000, color: "hsl(var(--chart-2))" },
  { name: "Transporte", value: 28000, color: "hsl(var(--chart-3))" },
  { name: "Administrativo", value: 25000, color: "hsl(var(--chart-4))" },
  { name: "Marketing", value: 16000, color: "hsl(var(--chart-5))" },
];

const Financeiro = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Gestão Financeira</h1>
          <p className="text-muted-foreground mt-2">Análise detalhada de receitas, custos e lucratividade</p>
        </div>

        <Tabs defaultValue="dre" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
          </TabsList>

          <TabsContent value="dre" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-2 mb-6">
                <h3 className="text-lg font-heading font-semibold text-foreground">DRE - Demonstração do Resultado</h3>
                <p className="text-sm text-muted-foreground">Estrutura de lucratividade consolidada</p>
              </div>
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
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => `R$ ${Math.abs(value).toLocaleString('pt-BR')}`}
                  />
                  <Bar
                    dataKey="valor"
                    radius={[0, 8, 8, 0]}
                    fill="hsl(var(--primary))"
                  />
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
            </Card>
          </TabsContent>

          <TabsContent value="receitas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
                  <p className="text-3xl font-heading font-bold text-foreground">R$ 2,34M</p>
                  <p className="text-xs text-success">+12,5% vs período anterior</p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Receita Líquida</p>
                  <p className="text-3xl font-heading font-bold text-foreground">R$ 2,06M</p>
                  <p className="text-xs text-muted-foreground">Após impostos (12%)</p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                  <p className="text-3xl font-heading font-bold text-foreground">R$ 18,5K</p>
                  <p className="text-xs text-success">+5,8% vs período anterior</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="despesas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="space-y-2 mb-6">
                  <h3 className="text-lg font-heading font-semibold text-foreground">Composição de Despesas</h3>
                  <p className="text-sm text-muted-foreground">Distribuição por categoria</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              
              <Card className="p-6">
                <div className="space-y-2 mb-6">
                  <h3 className="text-lg font-heading font-semibold text-foreground">Despesas Mensais</h3>
                  <p className="text-sm text-muted-foreground">Total: R$ 206.000</p>
                </div>
                <div className="space-y-4">
                  {expenseData.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="text-muted-foreground">R$ {item.value.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all rounded-full"
                          style={{ 
                            width: `${(item.value / 206000) * 100}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Financeiro;
