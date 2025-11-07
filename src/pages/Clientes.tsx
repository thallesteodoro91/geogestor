import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, MapPin, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, ScatterChart, Scatter, Cell } from "recharts";

const paretoData = [
  { cliente: "Cliente A", receita: 45000, acumulado: 38 },
  { cliente: "Cliente B", receita: 32000, acumulado: 65 },
  { cliente: "Cliente C", receita: 18000, acumulado: 80 },
  { cliente: "Cliente D", receita: 12000, acumulado: 90 },
  { cliente: "Outros", receita: 11500, acumulado: 100 },
];

const ltvData = [
  { mes: "Jan", ltv: 12500 },
  { mes: "Fev", ltv: 13200 },
  { mes: "Mar", ltv: 14100 },
  { mes: "Abr", ltv: 14800 },
  { mes: "Mai", ltv: 15600 },
];

const rentabilidadeProjetoData = [
  { projeto: "Geo. Rural XYZ", rentabilidade: 42 },
  { projeto: "Desm. Urbano ABC", rentabilidade: 35 },
  { projeto: "Lev. Industrial 01", rentabilidade: 28 },
  { projeto: "Planta Fazenda Sul", rentabilidade: 45 },
  { projeto: "Geo. Condomínio", rentabilidade: 38 },
];

const distribuicaoGeoData = [
  { regiao: "Centro", receita: 85000, clientes: 12 },
  { regiao: "Norte", receita: 52000, clientes: 8 },
  { regiao: "Sul", receita: 68000, clientes: 10 },
  { regiao: "Leste", receita: 41000, clientes: 6 },
  { regiao: "Oeste", receita: 33000, clientes: 5 },
];

export default function Clientes() {
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
            value="41"
            change="+5"
            changeType="positive"
            icon={Users}
            subtitle="ativos no período"
          />
          <KPICard
            title="LTV Médio"
            value="R$ 15.6k"
            change="+12%"
            changeType="positive"
            icon={Award}
            subtitle="lifetime value"
          />
          <KPICard
            title="Top 3 Clientes"
            value="65%"
            change="-2%"
            changeType="neutral"
            icon={TrendingUp}
            subtitle="da receita total"
          />
          <KPICard
            title="Regiões Ativas"
            value="5"
            change="+1"
            changeType="positive"
            icon={MapPin}
            subtitle="áreas de atuação"
          />
        </div>

        <Tabs defaultValue="analise" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analise">Análise de Clientes</TabsTrigger>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="mapa">Distribuição</TabsTrigger>
          </TabsList>

          <TabsContent value="analise" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Regra de Pareto Confirmada"
                insight="80% da receita vem de 20% dos clientes — padrão saudável de concentração. Os três principais clientes representam 65% do faturamento, indicando forte relacionamento com clientes-chave."
                category="strategic"
              />
              <StoryCard
                title="LTV em Crescimento"
                insight="O LTV aumentou 12% neste período, refletindo fidelização e aumento na frequência de projetos. A base de clientes está se tornando mais valiosa ao longo do tempo."
                category="financial"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Receita por Cliente (Pareto)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={paretoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="cliente" stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Bar yAxisId="left" dataKey="receita" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Evolução do LTV Médio</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={ltvData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Line type="monotone" dataKey="ltv" stroke="hsl(var(--chart-3))" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projetos" className="space-y-6">
            <StoryCard
              title="Projetos de Alta Rentabilidade"
              insight="Os projetos de georreferenciamento e plantas topográficas apresentam as maiores margens de rentabilidade, acima de 40%. Foco estratégico nestes serviços pode amplificar resultados financeiros."
              category="operational"
            />

            <Card>
              <CardHeader>
                <CardTitle>Rentabilidade por Projeto (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={rentabilidadeProjetoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="projeto" type="category" stroke="hsl(var(--muted-foreground))" width={150} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Bar dataKey="rentabilidade" radius={[0, 8, 8, 0]}>
                      {rentabilidadeProjetoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mapa" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Concentração Regional"
                insight="As regiões Centro e Sul concentram as propriedades mais lucrativas, representando 54% da receita total. Maior densidade de receita observada no eixo central da área de atuação."
                category="strategic"
              />
              <StoryCard
                title="Oportunidades de Expansão"
                insight="As regiões Leste e Oeste apresentam menor penetração mas mostram potencial de crescimento. Uma estratégia de expansão focada pode diversificar a base de receita."
                category="operational"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Receita por Região</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={distribuicaoGeoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="regiao" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Bar dataKey="receita" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribuição Geográfica (Scatter)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="clientes" name="Clientes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="receita" name="Receita" stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Scatter name="Regiões" data={distribuicaoGeoData} fill="hsl(var(--chart-4))" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
