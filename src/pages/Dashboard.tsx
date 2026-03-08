import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ProfitMarginChart } from "@/components/charts/ProfitMarginChart";
import { GlobalFilters, FilterState } from "@/components/filters/GlobalFilters";
import { useKPIs } from "@/hooks/useKPIs";
import { useKPIVariation, formatVariation } from "@/hooks/useKPIVariation";
import { GeoBot } from "@/components/dashboard/GeoBot";
import { AlertasFinanceiros } from "@/components/dashboard/AlertasFinanceiros";
import { 
  Banknote, 
  TrendingUp, 
  CircleDollarSign, 
  TrendingDown, 
  Percent, 
  Target, 
  Receipt, 
  ClipboardList, 
  ClipboardCheck 
} from "lucide-react";

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
  const { data: kpiVariation } = useKPIVariation();

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

        {/* KPIs Principais — Foco nos 4 mais importantes (Storytelling com Dados: elimine a saturação) */}
        <div className="space-y-3 animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Saúde Financeira</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Os indicadores que mais importam para a tomada de decisão</p>
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
              iconColor="text-indigo-500"
              change={kpiVariation ? formatVariation(kpiVariation.variations.receita_total) : "--"}
              changeType={kpiVariation?.variations.receita_total >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Lucro Líquido"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={CircleDollarSign}
              iconColor="text-emerald-500"
              change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_liquido) : "--"}
              changeType={kpiVariation?.variations.lucro_liquido >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Margem Líquida"
              value={isLoading ? "..." : `${(kpis?.margem_liquida_percent || 0).toFixed(1)}%`}
              icon={Percent}
              iconColor="text-cyan-500"
              change={kpiVariation ? formatVariation(kpiVariation.variations.margem_liquida_percent) : "--"}
              changeType={kpiVariation?.variations.margem_liquida_percent >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Total de Despesas"
              value={isLoading ? "..." : `R$ ${(kpis?.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingDown}
              iconColor="text-rose-500"
              change={kpiVariation ? formatVariation(kpiVariation.variations.total_despesas) : "--"}
              changeType={kpiVariation?.variations.total_despesas <= 0 ? "positive" : "negative"}
            />
              </>
            )}
          </div>
        </div>

        {/* KPIs Secundários — Contexto adicional (menor destaque visual) */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="space-y-1">
            <h2 className="text-lg font-heading font-medium text-muted-foreground">Contexto Operacional</h2>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 grid-8pt">
            {isLoading ? (
              <>
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
              </>
            ) : (
              <>
            <KPICard
              title="Margem Bruta"
              value={`${(kpis?.margem_bruta_percent || 0).toFixed(1)}%`}
              icon={Percent}
              change={kpiVariation ? formatVariation(kpiVariation.variations.margem_bruta_percent) : "--"}
              changeType={kpiVariation?.variations.margem_bruta_percent >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Taxa Conversão"
              value={`${(kpis?.taxa_conversao_percent || 0).toFixed(1)}%`}
              icon={Target}
              change={kpiVariation ? formatVariation(kpiVariation.variations.taxa_conversao_percent) : "--"}
              changeType={kpiVariation?.variations.taxa_conversao_percent >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Ticket Médio"
              value={`R$ ${(kpis?.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={Receipt}
              change={kpiVariation ? formatVariation(kpiVariation.variations.ticket_medio) : "--"}
              changeType={kpiVariation?.variations.ticket_medio >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Lucro Bruto"
              value={`R$ ${(kpis?.lucro_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_bruto) : "--"}
              changeType={kpiVariation?.variations.lucro_bruto >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Serviços"
              value={String(kpis?.total_servicos || 0)}
              icon={ClipboardList}
              change={kpiVariation ? formatVariation(kpiVariation.variations.total_servicos, false, true) : "--"}
              changeType={kpiVariation?.variations.total_servicos >= 0 ? "positive" : "negative"}
            />
            <KPICard
              title="Concluídos"
              value={String(kpis?.servicos_concluidos || 0)}
              icon={ClipboardCheck}
              change={kpiVariation ? formatVariation(kpiVariation.variations.servicos_concluidos, false, true) : "--"}
              changeType={kpiVariation?.variations.servicos_concluidos >= 0 ? "positive" : "negative"}
            />
              </>
            )}
          </div>
        </div>

        {/* Story Cards - Storytelling Visual com Contexto */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <div className="space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Insights Narrativos</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Análises que transformam dados em decisões — seu consultor financeiro digital
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 grid-8pt">
            <StoryCard
              title="Receita e Margem"
              insight={kpis && kpiVariation 
                ? `A receita ${kpiVariation.variations.receita_total >= 0 ? 'cresceu' : 'recuou'} ${formatVariation(kpiVariation.variations.receita_total)} no período. ${
                    (kpis.margem_liquida_percent || 0) > 15 
                      ? 'A margem líquida está saudável, indicando boa eficiência operacional.'
                      : 'Recomenda-se revisar a estrutura de custos para preservar a rentabilidade.'
                  }`
                : "Carregando análise de receita e margem..."}
              category="financial"
              trend={kpiVariation?.variations.receita_total >= 0 ? "up" : "alert"}
              emphasis="high"
              action={kpiVariation?.variations.receita_total < 0 ? "Análise detalhada de custos operacionais prioritária" : undefined}
            />
            <StoryCard
              title="Performance Operacional"
              insight={kpis 
                ? `${kpis.servicos_concluidos || 0} de ${kpis.total_servicos || 0} serviços concluídos. ${
                    (kpis.taxa_conversao_percent || 0) > 50
                      ? `Taxa de conversão de ${(kpis.taxa_conversao_percent || 0).toFixed(0)}% — acima da média do setor.`
                      : `Taxa de conversão de ${(kpis.taxa_conversao_percent || 0).toFixed(0)}% — há espaço para melhorar o follow-up comercial.`
                  }`
                : "Carregando indicadores operacionais..."}
              category="operational"
              trend="up"
              emphasis="high"
            />
            <StoryCard
              title="Ticket Médio"
              insight={kpis && kpiVariation
                ? `Ticket médio de R$ ${(kpis.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, ${
                    kpiVariation.variations.ticket_medio >= 0 
                      ? `em alta de ${formatVariation(kpiVariation.variations.ticket_medio)}, reflexo de serviços de maior valor agregado.`
                      : `com recuo de ${formatVariation(kpiVariation.variations.ticket_medio)}. Avaliar precificação.`
                  }`
                : "Carregando análise de ticket médio..."}
              category="financial"
              trend={kpiVariation?.variations.ticket_medio >= 0 ? "up" : "alert"}
              emphasis="medium"
            />
            <StoryCard
              title="Despesas sob Controle"
              insight={kpis && kpiVariation
                ? `Total de despesas: R$ ${(kpis.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${formatVariation(kpiVariation.variations.total_despesas)} vs anterior). ${
                    kpiVariation.variations.total_despesas <= 0 
                      ? 'Custos em queda — boa gestão de recursos.'
                      : 'Atenção: custos em alta — revisar categorias com maior impacto.'
                  }`
                : "Carregando análise de despesas..."}
              category="strategic"
              trend={kpiVariation?.variations.total_despesas <= 0 ? "up" : "alert"}
              emphasis="medium"
              action={kpiVariation?.variations.total_despesas > 5 ? "Manter estratégia de precificação e follow-up comercial" : undefined}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Análise Temporal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Evolução de receita e margens ao longo do tempo — identifique padrões e tendências
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 grid-8pt">
            <RevenueChart />
            <ProfitMarginChart />
          </div>
        </div>

        {/* GeoBot - Assistente IA */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <div className="space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">GeoBot - Consultor Financeiro IA</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Converse com o GeoBot para obter insights personalizados sobre seus dados financeiros
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 grid-8pt">
            <div className="lg:col-span-2">
              <GeoBot kpis={kpis} />
            </div>
            <div className="lg:col-span-1">
              <AlertasFinanceiros />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
