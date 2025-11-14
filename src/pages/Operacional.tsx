import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartTitle } from "@/components/charts/ChartTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle2, TrendingUp, DollarSign, Zap, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const servicoCores: Record<string, string> = {
  "Levantamento": "hsl(var(--chart-1))",
  "Georreferenciamento": "hsl(var(--chart-2))",
  "Desmembramento": "hsl(var(--chart-3))",
  "Planta Topográfica": "hsl(var(--chart-4))",
};

const tempoMedioDataPorPeriodo = {
  "2024-01": [
    { servico: "Levantamento", tempo: 9 },
    { servico: "Georreferenciamento", tempo: 16 },
    { servico: "Desmembramento", tempo: 13 },
    { servico: "Planta Topográfica", tempo: 7 },
  ],
  "2024-02": [
    { servico: "Levantamento", tempo: 8 },
    { servico: "Georreferenciamento", tempo: 15 },
    { servico: "Desmembramento", tempo: 12 },
    { servico: "Planta Topográfica", tempo: 6 },
  ],
  "2024-03": [
    { servico: "Levantamento", tempo: 7 },
    { servico: "Georreferenciamento", tempo: 14 },
    { servico: "Desmembramento", tempo: 11 },
    { servico: "Planta Topográfica", tempo: 5 },
  ],
  "2024-04": [
    { servico: "Levantamento", tempo: 8 },
    { servico: "Georreferenciamento", tempo: 13 },
    { servico: "Desmembramento", tempo: 10 },
    { servico: "Planta Topográfica", tempo: 6 },
  ],
};

const statusData = [
  { name: "Concluídos", value: 75, color: "hsl(142, 76%, 56%)" }, // Verde
  { name: "Em Andamento", value: 25, color: "hsl(38, 92%, 50%)" }, // Laranja
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
  const [tempoMedioFiltro, setTempoMedioFiltro] = useState<string>("todos");
  const [ticketMedioFiltro, setTicketMedioFiltro] = useState<string>("todos");
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>("2024-02");

  const custoReceitaFiltrado = servicoSelecionado === "todos" 
    ? custoReceitaData 
    : custoReceitaData.filter(item => item.servico === servicoSelecionado);

  const tempoMedioData = tempoMedioDataPorPeriodo[periodoSelecionado as keyof typeof tempoMedioDataPorPeriodo];
  
  const tempoMedioFiltrado = tempoMedioFiltro === "todos"
    ? tempoMedioData
    : tempoMedioData.filter(item => item.servico === tempoMedioFiltro);

  const ticketMedioFiltrado = ticketMedioFiltro === "todos"
    ? ticketMedioData
    : ticketMedioData.filter(item => item.servico === ticketMedioFiltro);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Gestão Operacional</h1>
          <p className="text-muted-foreground mt-2">Análise de produtividade, tempo e eficiência operacional</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KPICard
            title="Tempo Médio Conclusão"
            value="10 dias"
            change="-8%"
            changeType="positive"
            icon={Clock}
            subtitle="vs mês anterior"
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
            insight="A produtividade das equipes subiu 5% este mês — tempo médio de entrega caiu para 10 dias, refletindo melhor coordenação e eficiência operacional."
            category="operational"
            icon={Zap}
          />
          <StoryCard
            title="Taxa de Conclusão"
            insight="Mais de 75% dos serviços foram concluídos no prazo estabelecido. A gestão de prazos está funcionando bem, mantendo alta satisfação dos clientes."
            category="operational"
            icon={Award}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="space-y-3">
              <ChartTitle 
                title="Tempo Médio por Serviço"
                description="Mostra o tempo médio de conclusão (em dias) para cada tipo de serviço oferecido, indicando eficiência operacional."
                calculation="Tempo Médio = Σ Dias de Execução / Número de Serviços"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-01">Janeiro 2024</SelectItem>
                    <SelectItem value="2024-02">Fevereiro 2024</SelectItem>
                    <SelectItem value="2024-03">Março 2024</SelectItem>
                    <SelectItem value="2024-04">Abril 2024</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tempoMedioFiltro} onValueChange={setTempoMedioFiltro}>
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
                <BarChart data={tempoMedioFiltrado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="servico" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary))",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                    formatter={(value: number) => [`${value} dias`, 'Tempo Médio']}
                  />
                  <Bar dataKey="tempo" radius={[8, 8, 0, 0]}>
                    {tempoMedioFiltrado.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={servicoCores[entry.servico]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ChartTitle 
                title="Status dos Serviços"
                description="Distribuição percentual dos serviços entre concluídos e em andamento, oferecendo visão da carga de trabalho atual."
                calculation="% Status = (Quantidade do Status / Total de Serviços) × 100"
              />
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
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
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
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <ChartTitle 
                  title="Ticket Médio por Serviço"
                  description="Valor médio de receita gerado por cada tipo de serviço, permitindo identificar quais são os mais rentáveis."
                  calculation="Ticket Médio = Receita Total do Serviço / Quantidade de Serviços"
                />
                <Select value={ticketMedioFiltro} onValueChange={setTicketMedioFiltro}>
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
                <BarChart data={ticketMedioFiltrado} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                  />
                  <YAxis dataKey="servico" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={150} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary))",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Ticket Médio']}
                  />
                  <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                    {ticketMedioFiltrado.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={servicoCores[entry.servico]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <ChartTitle 
                  title="Custo vs Receita por Serviço"
                  description="Compara custo direto, receita e lucro bruto por tipo de serviço. Permite identificar quais serviços são mais rentáveis."
                  calculation="Lucro Bruto = Receita - Custo Direto | Margem Bruta = (Lucro Bruto / Receita) × 100"
                />
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
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
                    formatter={(value: number, name: string) => {
                      const margemBruta = name === "Lucro Bruto" && custoReceitaFiltrado.length > 0 
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
