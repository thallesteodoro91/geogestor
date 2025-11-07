import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, TrendingUp, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, Legend } from "recharts";

const tempoMedioData = [
  { servico: "Levantamento", tempo: 8 },
  { servico: "Georreferenciamento", tempo: 15 },
  { servico: "Desmembramento", tempo: 12 },
  { servico: "Planta Topográfica", tempo: 6 },
];

const statusData = [
  { name: "Concluídos", value: 75, color: "hsl(var(--chart-1))" },
  { name: "Em Andamento", value: 25, color: "hsl(var(--chart-2))" },
];

const ticketMedioData = [
  { servico: "Levantamento", valor: 3500 },
  { servico: "Georreferenciamento", valor: 8500 },
  { servico: "Desmembramento", valor: 6200 },
  { servico: "Planta Topográfica", valor: 2800 },
];

const custoReceitaData = [
  { custo: 2000, receita: 3500, name: "Lev. 1" },
  { custo: 5000, receita: 8500, name: "Geo. 1" },
  { custo: 4000, receita: 6200, name: "Desm. 1" },
  { custo: 1800, receita: 2800, name: "Planta 1" },
  { custo: 2200, receita: 3600, name: "Lev. 2" },
  { custo: 5500, receita: 8800, name: "Geo. 2" },
];

export default function Operacional() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Gestão Operacional</h1>
          <p className="text-muted-foreground mt-2">Análise de produtividade, tempo e eficiência operacional</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Tempo Médio Conclusão"
            value="10.3 dias"
            change="-8%"
            changeType="positive"
            icon={Clock}
            subtitle="vs mês anterior"
          />
          <KPICard
            title="Serviços Concluídos"
            value="45"
            change="+12%"
            changeType="positive"
            icon={CheckCircle2}
            subtitle="no período"
          />
          <KPICard
            title="Produtividade"
            value="92%"
            change="+5%"
            changeType="positive"
            icon={TrendingUp}
            subtitle="eficiência geral"
          />
          <KPICard
            title="Ticket Médio"
            value="R$ 5.250"
            change="+15%"
            changeType="positive"
            icon={DollarSign}
            subtitle="por serviço"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StoryCard
            title="Produtividade em Alta"
            insight="A produtividade das equipes subiu 5% este mês — tempo médio de entrega caiu para 10.3 dias, refletindo melhor coordenação e eficiência operacional."
            category="operational"
          />
          <StoryCard
            title="Taxa de Conclusão"
            insight="Mais de 75% dos serviços foram concluídos no prazo estabelecido. A gestão de prazos está funcionando bem, mantendo alta satisfação dos clientes."
            category="operational"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tempo Médio por Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tempoMedioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="servico" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="tempo" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status dos Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Médio por Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ticketMedioData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="servico" type="category" stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-3))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custo vs Receita por Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="custo" name="Custo" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="receita" name="Receita" stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Scatter name="Serviços" data={custoReceitaData} fill="hsl(var(--chart-4))" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <StoryCard
          title="Ticket Médio em Crescimento"
          insight="O ticket médio cresceu 15% neste período — reflexo de melhor precificação e foco em serviços de maior valor agregado. A rentabilidade por serviço está acima da meta estabelecida."
          category="strategic"
        />
      </div>
    </AppLayout>
  );
}
