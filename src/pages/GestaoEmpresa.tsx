import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ProfitMarginChart } from "@/components/charts/ProfitMarginChart";
import { ChartTitle } from "@/components/charts/ChartTitle";
import { GlobalFilters, FilterState } from "@/components/filters/GlobalFilters";
import { useKPIs } from "@/hooks/useKPIs";
import { AlertasFinanceiros } from "@/components/dashboard/AlertasFinanceiros";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Banknote, 
  TrendingUp, 
  CircleDollarSign, 
  TrendingDown, 
  Percent, 
  Calculator, 
  Target, 
  Receipt, 
  ClipboardList, 
  CheckCircle2,
  DollarSign,
  Users,
  BadgeCheck
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { RichTooltip } from "@/components/charts/RichTooltip";

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

const GestaoEmpresa = () => {
  const [filters, setFilters] = useState<FilterState>({
    dataInicio: "",
    dataFim: "",
    clienteId: "",
    empresaId: "",
    categoria: "",
    situacao: "",
  });

  const [anoBase, setAnoBase] = useState<string>("2024");
  const [anoComparacao, setAnoComparacao] = useState<string>("2023");

  const { data: kpis, isLoading } = useKPIs();

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_cliente')
        .select('id_cliente, nome')
        .order('nome');
      if (error) throw error;
      return data.map(c => ({ id: c.id_cliente, nome: c.nome }));
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_empresa')
        .select('id_empresa, nome')
        .order('nome');
      if (error) throw error;
      return data.map(e => ({ id: e.id_empresa, nome: e.nome }));
    },
  });

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Gestão da Empresa</h1>
          <p className="text-base text-muted-foreground">Visão estratégica, planejamento e análise financeira</p>
        </div>

        {/* Filtros Globais */}
        <GlobalFilters
          clientes={clientes}
          empresas={empresas}
          onFilterChange={setFilters}
        />

        {/* KPIs Principais - Financeiros */}
        <div className="space-y-3 animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Indicadores Financeiros</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Visão consolidada da saúde financeira</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 grid-8pt">
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
              title="Receita Total"
              value={isLoading ? "..." : `R$ ${(kpis?.receita_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={Banknote}
              subtitle={`${kpis?.total_servicos || 0} serviços`}
              change="+12.5%"
              changeType="positive"
              description="Soma de toda a receita gerada pelos serviços prestados no período"
              calculation="Σ (Receita de Serviços + Receita Realizada)"
            />
            <KPICard
              title="Lucro Bruto"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              subtitle={`margem de ${(kpis?.margem_bruta_percent || 0).toFixed(1)}%`}
              change="+10.3%"
              changeType="positive"
              description="Lucro após dedução dos custos diretos dos serviços"
              calculation="Receita Total - Custos Diretos"
            />
            <KPICard
              title="Lucro Líquido"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={CircleDollarSign}
              subtitle={`margem de ${(kpis?.margem_liquida_percent || 0).toFixed(1)}%`}
              change="+8.7%"
              changeType="positive"
              description="Lucro final após todas as deduções (custos e despesas operacionais)"
              calculation="Receita Total - Custos Totais - Despesas"
            />
            <KPICard
              title="Total Despesas"
              value={isLoading ? "..." : `R$ ${(kpis?.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingDown}
              subtitle="custos operacionais"
              change="+5.2%"
              changeType="negative"
              description="Soma de todas as despesas operacionais e administrativas"
              calculation="Σ (Despesas Fixas + Despesas Variáveis)"
            />
              </>
            )}
          </div>
        </div>

        {/* KPIs Estratégicos */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Planejamento Estratégico</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Indicadores de metas e crescimento</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 grid-8pt">
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
              title="Margem Contribuição"
              value={`${(kpis?.margem_contribuicao_percent || 0).toFixed(1)}%`}
              icon={Percent}
              subtitle="eficiência operacional"
              change="+2.1%"
              changeType="positive"
              description="Percentual da receita que sobra após dedução dos custos variáveis"
              calculation="((Receita - Custos Variáveis) / Receita) × 100"
            />
            <KPICard
              title="Ponto de Equilíbrio"
              value={`R$ ${(kpis?.ponto_equilibrio_receita || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={Calculator}
              subtitle="meta mensal"
              change="-3.2%"
              changeType="positive"
              description="Receita mínima necessária para cobrir todos os custos fixos"
              calculation="Custos Fixos / (Margem de Contribuição %)"
            />
            <KPICard
              title="Desvio Orçamentário"
              value={`${(kpis?.desvio_orcamentario_percent || 0).toFixed(1)}%`}
              icon={Target}
              subtitle="vs planejado"
              change="+0.3%"
              changeType="neutral"
              description="Diferença percentual entre o valor orçado e o realizado"
              calculation="((Realizado - Orçado) / Orçado) × 100"
            />
            <KPICard
              title="Taxa de Conversão"
              value={`${(kpis?.taxa_conversao_percent || 0).toFixed(1)}%`}
              icon={Users}
              subtitle="orçamentos → vendas"
              change="+3.5%"
              changeType="positive"
              description="Percentual de orçamentos que foram convertidos em serviços efetivos"
              calculation="(Orçamentos Convertidos / Total de Orçamentos) × 100"
            />
              </>
            )}
          </div>
        </div>

        {/* Tabs com Análises */}
        <Tabs defaultValue="visao-geral" className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-2">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
            <TabsTrigger value="equilibrio">Ponto de Equilíbrio</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Crescimento Consistente"
                insight="A receita cresceu 12.5% no período, mantendo trajetória ascendente. Destaque para o aumento da margem bruta, indicando melhor eficiência na gestão de custos diretos."
                category="operational"
                icon={TrendingUp}
              />
              <StoryCard
                title="Margem Líquida Saudável"
                insight="Com margem líquida de 8.7%, a empresa demonstra capacidade de gerar lucro após todas as despesas. O controle de custos fixos tem sido efetivo."
                category="operational"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="interactive-lift border-0">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-lg font-heading font-semibold text-foreground">Evolução da Receita</h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Ano:</span>
                        <Select value={anoBase} onValueChange={setAnoBase}>
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2023">2023</SelectItem>
                            <SelectItem value="2022">2022</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Comparar com</span>
                        <Select value={anoComparacao} onValueChange={setAnoComparacao}>
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2023">2023</SelectItem>
                            <SelectItem value="2022">2022</SelectItem>
                            <SelectItem value="2021">2021</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <RevenueChart />
                </CardContent>
              </Card>

              <Card className="interactive-lift border-0">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-lg font-heading font-semibold text-foreground">Margem de Lucro</h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Ano:</span>
                        <Select value={anoBase} onValueChange={setAnoBase}>
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2023">2023</SelectItem>
                            <SelectItem value="2022">2022</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Comparar com</span>
                        <Select value={anoComparacao} onValueChange={setAnoComparacao}>
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2023">2023</SelectItem>
                            <SelectItem value="2022">2022</SelectItem>
                            <SelectItem value="2021">2021</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProfitMarginChart />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orcamento" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Orçamento Cumprido"
                insight="A receita realizada ficou 1.2% abaixo do orçado, mas as despesas foram controladas com economia de 4% vs planejado. Resultado líquido positivo em relação às metas."
                category="operational"
                icon={BadgeCheck}
              />
              <StoryCard
                title="Investimentos no Prazo"
                insight="Os investimentos planejados estão sendo executados de forma disciplinada, com 92.5% do orçado já realizado. Boa gestão do capital alocado."
                category="operational"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle 
                    title="Orçado x Realizado"
                    description="Comparativo por categoria"
                  />
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orcamentoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        content={<RichTooltip format="currency" showVariation={false} />}
                        cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                      />
                      <Bar dataKey="orcado" fill="hsl(var(--chart-1))" name="Orçado" />
                      <Bar dataKey="realizado" fill="hsl(var(--chart-2))" name="Realizado" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle 
                    title="Desvio Orçamentário (%)"
                    description="Últimos 5 meses"
                  />
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={desvioData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        content={<RichTooltip format="percent" showVariation={false} />}
                        cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                      />
                      <Bar dataKey="desvio" name="Desvio (%)">
                        {desvioData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.desvio >= 0 ? "hsl(var(--destructive))" : "hsl(var(--success))"} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equilibrio" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Acima do Ponto de Equilíbrio"
                insight="A empresa opera consistentemente acima do ponto de equilíbrio há 5 meses. A margem de segurança atual é de 58%, indicando zona confortável de operação."
                category="operational"
              />
              <StoryCard
                title="Custos sob Controle"
                insight="Os custos fixos se mantêm estáveis enquanto os custos variáveis crescem proporcionalmente à receita. Estrutura de custos saudável e escalável."
                category="operational"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle 
                    title="Receita vs Ponto de Equilíbrio"
                    description="Análise mensal"
                  />
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={pontoEquilibrioData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        content={<RichTooltip format="currency" showVariation={false} />}
                        cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                      />
                      <Bar dataKey="custoTotal" fill="hsl(var(--chart-3))" name="Custo Total" />
                      <Line type="monotone" dataKey="receita" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Receita" />
                      <Line type="monotone" dataKey="pontoEquilibrio" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" name="Ponto de Equilíbrio" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle 
                    title="Custos Fixos vs Variáveis"
                    description="Estrutura de custos"
                  />
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={custoFixoVariavelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        content={<RichTooltip format="currency" showVariation={false} />}
                        cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
                      />
                      <Bar dataKey="fixo" stackId="a" fill="hsl(var(--chart-1))" name="Fixo" />
                      <Bar dataKey="variavel" stackId="a" fill="hsl(var(--chart-2))" name="Variável" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Alertas Financeiros */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Alertas e Recomendações</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Insights automáticos do sistema</p>
          </div>
          <AlertasFinanceiros />
        </div>
      </div>
    </AppLayout>
  );
};

export default GestaoEmpresa;
