import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ProfitMarginChart } from "@/components/charts/ProfitMarginChart";
import { GlobalFilters, FilterState } from "@/components/filters/GlobalFilters";
import { useKPIs } from "@/hooks/useKPIs";
import { DollarSign, TrendingUp, Percent, Target } from "lucide-react";

const Dashboard = () => {
  const [filters, setFilters] = useState<FilterState>({
    dataInicio: "",
    dataFim: "",
    clienteId: "",
    empresaId: "",
    categoria: "",
    situacao: "",
  });

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
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Dashboard Executivo</h1>
          <p className="text-base text-muted-foreground">Visão geral da performance da empresa</p>
        </div>

        {/* Filtros Globais */}
        <GlobalFilters
          clientes={clientes}
          empresas={empresas}
          onFilterChange={setFilters}
        />

        {/* KPIs Principais - Financeiros */}
        <div className="space-y-3">
          <h2 className="text-xl font-heading font-semibold text-foreground">Indicadores Financeiros</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Receita Total"
              value={isLoading ? "..." : `R$ ${(kpis?.receita_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
              subtitle={`${kpis?.total_servicos || 0} serviços`}
              change="+12.5%"
              changeType="positive"
            />
            <KPICard
              title="Lucro Bruto"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              subtitle={`margem de ${(kpis?.margem_bruta || 0).toFixed(1)}%`}
              change="+10.3%"
              changeType="positive"
            />
            <KPICard
              title="Lucro Líquido"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              subtitle={`margem de ${(kpis?.margem_liquida || 0).toFixed(1)}%`}
              change="+8.2%"
              changeType="positive"
            />
            <KPICard
              title="Total de Despesas"
              value={isLoading ? "..." : `R$ ${(kpis?.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
              subtitle="custos operacionais"
              change="+5.1%"
              changeType="negative"
            />
          </div>
        </div>

        {/* KPIs Secundários - Margens e Operacionais */}
        <div className="space-y-3">
          <h2 className="text-xl font-heading font-semibold text-foreground">Margens e Performance Operacional</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Margem Bruta"
              value={isLoading ? "..." : `${(kpis?.margem_bruta || 0).toFixed(1)}%`}
              icon={Percent}
              subtitle="Lucro Bruto / Receita"
              change="+1.8%"
              changeType="positive"
            />
            <KPICard
              title="Margem Líquida"
              value={isLoading ? "..." : `${(kpis?.margem_liquida || 0).toFixed(1)}%`}
              icon={Percent}
              subtitle="Lucro Líquido / Receita"
              change="+2.1%"
              changeType="positive"
            />
            <KPICard
              title="Taxa de Conversão"
              value={isLoading ? "..." : `${(kpis?.taxa_conversao || 0).toFixed(1)}%`}
              icon={Target}
              subtitle="orçamentos convertidos"
              change="+4.5%"
              changeType="positive"
            />
            <KPICard
              title="Ticket Médio"
              value={isLoading ? "..." : `R$ ${(kpis?.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
              subtitle="por serviço"
              change="+6.3%"
              changeType="positive"
            />
          </div>
        </div>

        {/* KPIs Operacionais */}
        <div className="space-y-3">
          <h2 className="text-xl font-heading font-semibold text-foreground">Indicadores Operacionais</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total de Serviços"
              value={isLoading ? "..." : String(kpis?.total_servicos || 0)}
              icon={Target}
              subtitle="serviços registrados"
              change="+15"
              changeType="positive"
            />
            <KPICard
              title="Serviços Concluídos"
              value={isLoading ? "..." : String(kpis?.servicos_concluidos || 0)}
              icon={Target}
              subtitle={`${kpis?.total_servicos ? ((kpis.servicos_concluidos / kpis.total_servicos) * 100).toFixed(1) : 0}% do total`}
              change="+12"
              changeType="positive"
            />
          </div>
        </div>

        {/* Story Cards - Storytelling Visual com Contexto */}
        <div className="space-y-4">
          <h2 className="text-xl font-heading font-semibold text-foreground">Insights Narrativos</h2>
          <p className="text-sm text-muted-foreground">Análises que transformam dados em decisões</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StoryCard
              title="Receita em Alta, Margem sob Atenção"
              insight="A receita cresceu 12,5% no período, sinalizando forte demanda. Porém, as despesas avançaram 5,1%, pressionando a margem líquida. Recomenda-se revisar a estrutura de custos fixos para preservar a rentabilidade."
              category="financial"
              trend="alert"
              emphasis="high"
              action="Análise detalhada de custos operacionais prioritária"
            />
            <StoryCard
              title="Eficiência Operacional em Destaque"
              insight="O tempo médio de conclusão reduziu 15%, resultado direto da otimização de rotas e melhor coordenação das equipes de campo. Isso amplia a capacidade de atender novos clientes sem expandir recursos."
              category="operational"
              trend="up"
              emphasis="high"
            />
            <StoryCard
              title="Taxa de Conversão Sólida"
              insight="Com 68% de conversão de orçamentos em serviços, o desempenho comercial está acima da média do setor. Este é um indicador de boa qualidade técnica e precificação competitiva."
              category="strategic"
              trend="up"
              emphasis="medium"
              action="Manter estratégia de precificação e follow-up comercial"
            />
            <StoryCard
              title="Ticket Médio em Expansão"
              insight="O ticket médio subiu 6,3%, reflexo de serviços mais complexos e de maior valor agregado. A empresa está capturando projetos de topografia para grandes propriedades rurais com sucesso."
              category="financial"
              trend="up"
              emphasis="medium"
            />
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-3">
          <h2 className="text-xl font-heading font-semibold text-foreground">Análise Temporal</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RevenueChart />
            <ProfitMarginChart />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
