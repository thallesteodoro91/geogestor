import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartTitle } from "@/components/charts/ChartTitle";
import { Target, TrendingUp, Users, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell, FunnelChart, Funnel, LabelList } from "recharts";

const orcamentoData = [
  { categoria: "Receita", orcado: 120000, realizado: 118500 },
  { categoria: "Despesas", orcado: 75000, realizado: 72000 },
  { categoria: "Investimentos", orcado: 20000, realizado: 18500 },
];

const desvioData = [
  { mes: "Jan", desvio: 2.5 },
  { mes: "Fev", desvio: -1.2 },
  { mes: "Mar", desvio: 3.8 },
  { mes: "Abr", desvio: -0.5 },
  { mes: "Mai", desvio: 1.2 },
];

const pontoEquilibrioData = [
  { mes: "Jan", receita: 85000, custoTotal: 78000, pontoEquilibrio: 75000 },
  { mes: "Fev", receita: 92000, custoTotal: 81000, pontoEquilibrio: 75000 },
  { mes: "Mar", receita: 98000, custoTotal: 83000, pontoEquilibrio: 75000 },
  { mes: "Abr", receita: 105000, custoTotal: 86000, pontoEquilibrio: 75000 },
  { mes: "Mai", receita: 118500, custoTotal: 88000, pontoEquilibrio: 75000 },
];

const custoFixoVariavelData = [
  { mes: "Jan", fixo: 45000, variavel: 33000 },
  { mes: "Fev", fixo: 45000, variavel: 36000 },
  { mes: "Mar", fixo: 46000, variavel: 37000 },
  { mes: "Abr", fixo: 46000, variavel: 40000 },
  { mes: "Mai", fixo: 47000, variavel: 41000 },
];

const pipelineData = [
  { name: "Leads", value: 150, fill: "hsl(var(--chart-1))" },
  { name: "Propostas", value: 85, fill: "hsl(var(--chart-2))" },
  { name: "Negociação", value: 45, fill: "hsl(var(--chart-3))" },
  { name: "Fechados", value: 32, fill: "hsl(var(--chart-4))" },
];

export default function Planejamento() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Planejamento Estratégico</h1>
          <p className="text-muted-foreground mt-2">Orçamento, metas e análise de viabilidade financeira</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Desvio Orçamentário"
            value="1.2%"
            change="+0.3%"
            changeType="neutral"
            icon={Target}
            subtitle="dentro da meta"
          />
          <KPICard
            title="Margem Contribuição"
            value="38.5%"
            change="+2.1%"
            changeType="positive"
            icon={TrendingUp}
            subtitle="vs mês anterior"
          />
          <KPICard
            title="Taxa de Conversão"
            value="21.3%"
            change="+3.5%"
            changeType="positive"
            icon={Users}
            subtitle="leads → clientes"
          />
          <KPICard
            title="Pipeline Total"
            value="R$ 385k"
            change="+8%"
            changeType="positive"
            icon={DollarSign}
            subtitle="em negociação"
          />
        </div>

        <Tabs defaultValue="orcamento" className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-2">
            <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
            <TabsTrigger value="equilibrio">Ponto de Equilíbrio</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="orcamento" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Orçamento Cumprido"
                insight="O orçamento foi cumprido com variação inferior a 2% em todas as categorias. A execução financeira está alinhada com o planejado, demonstrando controle eficiente."
                category="financial"
              />
              <StoryCard
                title="Desvio Controlado"
                insight="O desvio orçamentário manteve-se positivo, com economia de 4% em despesas operacionais. A área financeira mantém trajetória saudável de eficiência."
                category="strategic"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <ChartTitle 
                    title="Orçado vs Realizado"
                    description="Compara os valores planejados (orçados) com os valores efetivamente executados (realizados) para cada categoria financeira."
                    calculation="Desvio = ((Realizado - Orçado) / Orçado) × 100"
                  />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={orcamentoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--primary))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--popover-foreground))",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                        }}
                        cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      />
                      <Bar dataKey="orcado" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="realizado" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <ChartTitle 
                    title="Desvio Orçamentário (%)"
                    description="Mostra a diferença percentual entre o orçado e o realizado ao longo dos meses. Valores positivos indicam economia; negativos indicam excesso de gasto."
                    calculation="Desvio % = ((Realizado - Orçado) / Orçado) × 100"
                  />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={desvioData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--primary))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--popover-foreground))",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                        }}
                        cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      />
                      <Bar dataKey="desvio" radius={[8, 8, 0, 0]}>
                        {desvioData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.desvio > 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equilibrio" className="space-y-6">
            <StoryCard
              title="Ponto de Equilíbrio Atingido"
              insight="A empresa mantém-se consistentemente acima do ponto de equilíbrio — ótima eficiência financeira. A margem de contribuição permaneceu estável em 38.5%, reforçando sustentabilidade operacional."
              category="financial"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <ChartTitle 
                    title="Receita vs Custo Total"
                    description="Compara a receita obtida com o custo total (fixo + variável). A linha tracejada indica o ponto de equilíbrio — nível mínimo de receita para cobrir todos os custos."
                    calculation="Ponto de Equilíbrio = Custos Fixos / (1 - (Custos Variáveis / Receita))"
                  />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={pontoEquilibrioData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--primary))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--popover-foreground))",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                        }}
                        cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      />
                      <Bar dataKey="receita" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="custoTotal" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                      <Line type="monotone" dataKey="pontoEquilibrio" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <ChartTitle 
                    title="Custo Fixo vs Variável"
                    description="Mostra a composição dos custos totais em fixos (não variam com produção) e variáveis (variam proporcionalmente com a atividade)."
                    calculation="Custo Total = Custos Fixos + Custos Variáveis"
                  />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={custoFixoVariavelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--primary))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--popover-foreground))",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                        }}
                        cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                      />
                      <Bar dataKey="fixo" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="variavel" stackId="a" fill="hsl(var(--chart-4))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Conversão Comercial Eficiente"
                insight="O pipeline converteu 21.3% dos leads em receita real este mês. A eficiência comercial melhorou 3.5% em comparação ao período anterior, refletindo melhor qualificação."
                category="strategic"
              />
              <StoryCard
                title="Pipeline Saudável"
                insight="R$ 385k em negociação indicam crescimento contínuo. A taxa de conversão está acima da meta estabelecida, sugerindo boa qualidade dos leads e efetividade comercial."
                category="operational"
              />
            </div>

            <Card>
              <CardHeader>
                <ChartTitle 
                  title="Funil Comercial"
                  description="Representa o processo de conversão comercial, desde os leads iniciais até os negócios fechados. Cada etapa mostra quantos prospectos avançaram."
                  calculation="Taxa de Conversão = (Fechados / Leads) × 100"
                />
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <FunnelChart>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary))",
                        borderRadius: "0.5rem",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                      }}
                    />
                    <Funnel dataKey="value" data={pipelineData} isAnimationActive>
                      <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
