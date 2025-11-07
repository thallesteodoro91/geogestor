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
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground/80">Visão geral da performance da empresa</p>
        </div>

        {/* Filtros Globais */}
        <GlobalFilters
          clientes={clientes}
          empresas={empresas}
          onFilterChange={setFilters}
        />

        {/* KPIs */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Receita Total"
            value={isLoading ? "..." : `R$ ${(kpis?.receita_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            subtitle={`${kpis?.total_servicos || 0} serviços`}
            change="+12.5%"
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
            title="Margem Líquida"
            value={isLoading ? "..." : `${(kpis?.margem_liquida || 0).toFixed(1)}%`}
            icon={Percent}
            subtitle="Lucro / Receita"
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
        </div>

        {/* Story Cards */}
        <div className="space-y-4">
          <h2 className="text-2xl font-heading font-semibold text-foreground">Insights Narrativos</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <StoryCard
              title="Margem em Crescimento"
              insight="A margem líquida apresentou crescimento consistente de 2,1% no semestre, refletindo maior eficiência operacional e controle de custos. A tendência indica consolidação da rentabilidade."
              category="financial"
            />
            <StoryCard
              title="Performance Operacional"
              insight="O tempo médio de conclusão de serviços reduziu 15% neste período, impactando positivamente a satisfação dos clientes e aumentando a capacidade de execução de novos projetos."
              category="operational"
            />
            <StoryCard
              title="Estrutura de Custos Equilibrada"
              insight="Os custos diretos mantiveram-se proporcionais ao crescimento da receita, preservando a margem bruta. A despesa operacional está sob controle, com variação inferior a 3%."
              category="financial"
            />
            <StoryCard
              title="Oportunidade de Expansão"
              insight="A taxa de conversão de 68% indica forte demanda. Com otimização do pipeline comercial, há potencial para crescimento de 20% na receita sem comprometer a estrutura atual."
              category="strategic"
            />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RevenueChart />
          <ProfitMarginChart />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
