import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle2, TrendingUp, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

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
  { servico: "Levantamento", custo: 2000, receita: 3500, lucro: 1500 },
  { servico: "Georreferenciamento", custo: 5000, receita: 8500, lucro: 3500 },
  { servico: "Desmembramento", custo: 4000, receita: 6200, lucro: 2200 },
  { servico: "Planta Topográfica", custo: 1800, receita: 2800, lucro: 1000 },
];

export default function Operacional() {
  const [servicoSelecionado, setServicoSelecionado] = useState<string>("todos");

  const custoReceitaFiltrado = servicoSelecionado === "todos" 
    ? custoReceitaData 
    : custoReceitaData.filter(item => item.servico === servicoSelecionado);

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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="servico" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                    formatter={(value: number) => [`${value} dias`, 'Tempo']}
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
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    formatter={(value: number) => [`${value} serviços`, 'Total']}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="servico" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={150} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Ticket Médio']}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-3))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle>Custo vs Receita por Serviço</CardTitle>
                <Select value={servicoSelecionado} onValueChange={setServicoSelecionado}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Serviços</SelectItem>
                    <SelectItem value="Levantamento">Levantamento</SelectItem>
                    <SelectItem value="Georreferenciamento">Georreferenciamento</SelectItem>
                    <SelectItem value="Desmembramento">Desmembramento</SelectItem>
                    <SelectItem value="Planta Topográfica">Planta Topográfica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={custoReceitaFiltrado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="servico" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                    formatter={(value: number, name: string) => {
                      const margemBruta = name === "Lucro" && custoReceitaFiltrado.length > 0 
                        ? ` (${((value / custoReceitaFiltrado[0].receita) * 100).toFixed(1)}%)`
                        : '';
                      return [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${margemBruta}`, name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="custo" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} name="Custo Direto" />
                  <Bar dataKey="receita" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} name="Receita" />
                  <Bar dataKey="lucro" fill="hsl(142, 76%, 56%)" radius={[8, 8, 0, 0]} name="Lucro Bruto" />
                </BarChart>
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
