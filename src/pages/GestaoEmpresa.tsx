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
import { useKPIVariation, formatVariation } from "@/hooks/useKPIVariation";
import { AlertasFinanceiros } from "@/components/dashboard/AlertasFinanceiros";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Banknote, TrendingUp, CircleDollarSign, TrendingDown, 
  Percent, Calculator, Target, Users,
  BadgeCheck, ShieldCheck, HeartPulse
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell } from "recharts";
import { RichTooltip } from "@/components/charts/RichTooltip";
import { useAuth } from "@/hooks/useAuth";
import { TrialBanner } from "@/components/plan/TrialBanner";

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const GestaoEmpresa = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    dataInicio: "", dataFim: "", clienteId: "", empresaId: "", categoria: "", situacao: "",
  });

  const { data: kpis, isLoading } = useKPIs();
  const { data: kpiVariation } = useKPIVariation();
  

  // Fetch monthly financial data for charts
  const currentYear = new Date().getFullYear();
  const { data: monthlyData } = useQuery({
    queryKey: ['monthly-financial-data', currentYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_financial_data', { p_year: currentYear });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-filter'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dim_cliente').select('id_cliente, nome').order('nome');
      if (error) throw error;
      return data.map(c => ({ id: c.id_cliente, nome: c.nome }));
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-filter'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dim_empresa').select('id_empresa, nome').order('nome');
      if (error) throw error;
      return data.map(e => ({ id: e.id_empresa, nome: e.nome }));
    },
  });

  // Build chart data from monthly RPC
  const custoFixoVariavelData = (monthlyData || [])
    .filter((m: any) => m.despesas_fixas > 0 || m.custos_variaveis > 0)
    .map((m: any) => ({
      mes: MONTH_NAMES[m.mes - 1],
      fixo: m.despesas_fixas,
      variavel: m.custos_variaveis,
    }));

  const pontoEquilibrioData = (monthlyData || [])
    .filter((m: any) => m.receita > 0 || m.total_despesas > 0)
    .map((m: any) => ({
      mes: MONTH_NAMES[m.mes - 1],
      receita: m.receita,
      custoTotal: m.total_despesas,
      pontoEquilibrio: kpis?.ponto_equilibrio_receita ? kpis.ponto_equilibrio_receita / 12 : 0,
    }));

  // Build budget deviation from monthly data
  const desvioData = (monthlyData || [])
    .filter((m: any) => m.receita > 0)
    .map((m: any) => {
      const desvio = m.receita > 0 ? ((m.receita - m.total_despesas) / m.receita * 100) - (kpis?.margem_liquida_percent || 0) : 0;
      return { mes: MONTH_NAMES[m.mes - 1], desvio: Number(desvio.toFixed(1)) };
    });

  // Dynamic StoryCards based on real KPIs
  const generateStoryInsight = () => {
    if (!kpis || !kpiVariation) return null;
    const v = kpiVariation.variations;
    return {
      crescimento: v.receita_total >= 0
        ? `A receita cresceu ${formatVariation(v.receita_total)} no período, mantendo trajetória ${v.receita_total > 5 ? 'ascendente forte' : 'estável'}.${v.lucro_bruto >= 0 ? ' Destaque para o aumento da margem bruta.' : ' Porém, a margem bruta recuou — revisar custos diretos.'}`
        : `A receita recuou ${formatVariation(v.receita_total)} no período. É necessário revisar a estratégia comercial e pipeline de vendas.`,
      margem: (kpis.margem_liquida_percent || 0) > 15
        ? `Com margem líquida de ${(kpis.margem_liquida_percent || 0).toFixed(1)}%, a empresa demonstra forte capacidade de gerar lucro. O controle de custos tem sido efetivo.`
        : (kpis.margem_liquida_percent || 0) > 0
          ? `A margem líquida está em ${(kpis.margem_liquida_percent || 0).toFixed(1)}%. Há espaço para otimização de custos operacionais.`
          : `Atenção: margem líquida negativa (${(kpis.margem_liquida_percent || 0).toFixed(1)}%). Revisão urgente de custos é necessária.`,
    };
  };
  const stories = generateStoryInsight();

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Gestão da Empresa</h1>
          <p className="text-base text-muted-foreground">Visão estratégica, planejamento e análise financeira</p>
        </div>

        <TrialBanner />

        <GlobalFilters clientes={clientes} empresas={empresas} onFilterChange={setFilters} />

        {/* KPIs Financeiros */}
        <div className="space-y-3 animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Indicadores Financeiros</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Visão consolidada da saúde financeira</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 grid-8pt">
            {isLoading ? (
              <><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /></>
            ) : (
              <>
                <KPICard
                  title="Receita Total"
                  value={`R$ ${(kpis?.receita_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={Banknote}
                  iconColor="#6366f1"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.receita_total) : "--"}
                  changeType={kpiVariation?.variations.receita_total >= 0 ? "positive" : "negative"}
                  description="Soma de toda receita gerada no período."
                  calculation="Σ receita de serviços + orçamentos"
                />
                <KPICard
                  title="Lucro Bruto"
                  value={`R$ ${(kpis?.lucro_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={TrendingUp}
                  iconColor="#22c55e"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_bruto) : "--"}
                  changeType={kpiVariation?.variations.lucro_bruto >= 0 ? "positive" : "negative"}
                  description="Receita menos custos diretos dos serviços."
                  calculation="Receita Total - Custos Variáveis"
                />
                <KPICard
                  title="Lucro Líquido"
                  value={`R$ ${(kpis?.lucro_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={CircleDollarSign}
                  iconColor="#10b981"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_liquido) : "--"}
                  changeType={kpiVariation?.variations.lucro_liquido >= 0 ? "positive" : "negative"}
                />
                <KPICard
                  title="Total Despesas"
                  value={`R$ ${(kpis?.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={TrendingDown}
                  iconColor="#f43f5e"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.total_despesas) : "--"}
                  changeType={kpiVariation?.variations.total_despesas <= 0 ? "positive" : "negative"}
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
              <><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /></>
            ) : (
              <>
                <KPICard
                  title="Margem Contribuição"
                  value={`${(kpis?.margem_contribuicao_percent || 0).toFixed(1)}%`}
                  icon={Percent}
                  iconColor="#8b5cf6"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.margem_bruta_percent) : "--"}
                  changeType={kpiVariation?.variations.margem_bruta_percent >= 0 ? "positive" : "negative"}
                />
                <KPICard
                  title="Ponto de Equilíbrio"
                  value={`R$ ${(kpis?.ponto_equilibrio_receita || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={Calculator}
                  iconColor="#06b6d4"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.total_despesas) : "--"}
                  changeType={kpiVariation?.variations.total_despesas <= 0 ? "positive" : "negative"}
                />
                <KPICard
                  title="Desvio Orçamentário"
                  value={`${(kpis?.desvio_orcamentario_percent || 0).toFixed(1)}%`}
                  icon={Target}
                  iconColor="#f59e0b"
                  change="--"
                  changeType="neutral"
                />
                <KPICard
                  title="Taxa de Conversão"
                  value={`${(kpis?.taxa_conversao_percent || 0).toFixed(1)}%`}
                  icon={Users}
                  iconColor="#14b8a6"
                  change={kpiVariation ? formatVariation(kpiVariation.variations.taxa_conversao_percent) : "--"}
                  changeType={kpiVariation?.variations.taxa_conversao_percent >= 0 ? "positive" : "negative"}
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
              {stories ? (
                <>
                  <StoryCard
                    title="Análise de Crescimento"
                    insight={stories.crescimento}
                    category="operational"
                    icon={TrendingUp}
                  />
                  <StoryCard
                    title="Margem Líquida"
                    insight={stories.margem}
                    category="operational"
                    icon={HeartPulse}
                  />
                </>
              ) : (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart />
              <ProfitMarginChart />
            </div>

          </TabsContent>

          <TabsContent value="orcamento" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Desempenho Orçamentário"
                insight={kpis ? `O desvio orçamentário está em ${(kpis.desvio_orcamentario_percent || 0).toFixed(1)}%. ${
                  (kpis.desvio_orcamentario_percent || 0) < 5 
                    ? 'Execução financeira dentro da meta, indicando boa disciplina orçamentária.'
                    : 'Atenção ao controle de gastos — desvio acima do ideal.'
                }` : 'Carregando dados...'}
                category="operational"
                icon={BadgeCheck}
              />
              <StoryCard
                title="Conversão de Orçamentos"
                insight={kpis ? `Taxa de conversão de ${(kpis.taxa_conversao_percent || 0).toFixed(1)}% — ${
                  (kpis.taxa_conversao_percent || 0) > 50 
                    ? 'acima da média do setor, indicando boa qualidade técnica e precificação competitiva.'
                    : 'há espaço para melhorar o follow-up comercial e ajustar precificação.'
                }` : 'Carregando dados...'}
                category="operational"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Budget Deviation Chart */}
              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle title="Desvio da Margem Mensal (%)" description="Variação da margem vs média" />
                </CardHeader>
                <CardContent className="h-80">
                  {desvioData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={desvioData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip content={<RichTooltip format="percent" showVariation={false} />} cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }} />
                        <Bar dataKey="desvio" name="Desvio (%)">
                          {desvioData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.desvio >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados no período</div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="equilibrio" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StoryCard
                title="Ponto de Equilíbrio"
                insight={kpis ? `O ponto de equilíbrio está em R$ ${(kpis.ponto_equilibrio_receita || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ${
                  (kpis.receita_total || 0) > (kpis.ponto_equilibrio_receita || 0)
                    ? `A empresa opera acima desse valor, com margem de segurança de ${kpis.receita_total ? (((kpis.receita_total - (kpis.ponto_equilibrio_receita || 0)) / kpis.receita_total) * 100).toFixed(0) : 0}%.`
                    : 'A empresa está abaixo do ponto de equilíbrio — ação corretiva necessária.'
                }` : 'Carregando dados...'}
                category="operational"
                icon={ShieldCheck}
              />
              <StoryCard
                title="Estrutura de Custos"
                insight={kpis ? `Custos variáveis: R$ ${(kpis.custos_variaveis_reais || 0).toLocaleString('pt-BR')} | Custos fixos: R$ ${(kpis.despesas_fixas_reais || 0).toLocaleString('pt-BR')}. ${
                  (kpis.custos_variaveis_reais || 0) > (kpis.despesas_fixas_reais || 0)
                    ? 'Estrutura com maior peso em variáveis, favorecendo escalabilidade.'
                    : 'Estrutura com maior peso em fixos — atenção à alavancagem operacional.'
                }` : 'Carregando dados...'}
                category="operational"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle title="Receita vs Ponto de Equilíbrio" description="Análise mensal" />
                </CardHeader>
                <CardContent className="h-80">
                  {pontoEquilibrioData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={pontoEquilibrioData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip content={<RichTooltip format="currency" showVariation={false} />} cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }} />
                        <Bar dataKey="custoTotal" fill="hsl(var(--chart-3))" name="Custo Total" />
                        <Line type="monotone" dataKey="receita" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Receita" />
                        <Line type="monotone" dataKey="pontoEquilibrio" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" name="Ponto de Equilíbrio" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados no período</div>
                  )}
                </CardContent>
              </Card>

              <Card className="interactive-lift border-0">
                <CardHeader>
                  <ChartTitle title="Custos Fixos vs Variáveis" description="Estrutura de custos mensal" />
                </CardHeader>
                <CardContent className="h-80">
                  {custoFixoVariavelData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={custoFixoVariavelData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip content={<RichTooltip format="currency" showVariation={false} />} cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }} />
                        <Bar dataKey="fixo" stackId="a" fill="hsl(var(--chart-1))" name="Fixo" />
                        <Bar dataKey="variavel" stackId="a" fill="hsl(var(--chart-2))" name="Variável" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados no período</div>
                  )}
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
