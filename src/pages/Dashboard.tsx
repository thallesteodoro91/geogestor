import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ProfitMarginChart } from "@/components/charts/ProfitMarginChart";
import { DollarSign, TrendingUp, Percent, Target } from "lucide-react";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-2">Visão completa do desempenho da TopoVision</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Receita Total"
            value="R$ 2,34M"
            change="+12,5%"
            changeType="positive"
            icon={DollarSign}
            subtitle="Últimos 6 meses"
          />
          <KPICard
            title="Lucro Líquido"
            value="R$ 847K"
            change="+8,3%"
            changeType="positive"
            icon={TrendingUp}
            subtitle="Crescimento sustentável"
          />
          <KPICard
            title="Margem Líquida"
            value="36,2%"
            change="+2,1%"
            changeType="positive"
            icon={Percent}
            subtitle="Eficiência operacional"
          />
          <KPICard
            title="Taxa de Conversão"
            value="68%"
            change="-3,2%"
            changeType="negative"
            icon={Target}
            subtitle="Pipeline comercial"
          />
        </div>

        {/* Story Cards */}
        <div>
          <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">Insights Narrativos</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RevenueChart />
          <ProfitMarginChart />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
