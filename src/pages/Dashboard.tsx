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
  Calculator, 
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
              change={kpiVariation ? formatVariation(kpiVariation.variations.receita_total) : "--"}
              changeType={kpiVariation?.variations.receita_total >= 0 ? "positive" : "negative"}
              description="Soma de toda a receita gerada pelos serviços prestados no período"
              calculation="Σ (Receita de Serviços + Receita Realizada)"
            />
            <KPICard
              title="Lucro Bruto"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              subtitle={`margem de ${(kpis?.margem_bruta_percent || 0).toFixed(1)}%`}
              change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_bruto) : "--"}
              changeType={kpiVariation?.variations.lucro_bruto >= 0 ? "positive" : "negative"}
              description="Lucro após dedução dos custos diretos dos serviços"
              calculation="Receita Total - Custos Diretos"
            />
            <KPICard
              title="Lucro Líquido"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={CircleDollarSign}
              subtitle={`margem de ${(kpis?.margem_liquida_percent || 0).toFixed(1)}%`}
              change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_liquido) : "--"}
              changeType={kpiVariation?.variations.lucro_liquido >= 0 ? "positive" : "negative"}
              description="Lucro final após todas as deduções (custos e despesas operacionais)"
              calculation="Receita Total - Custos Totais - Despesas"
            />
            <KPICard
              title="Total de Despesas"
              value={isLoading ? "..." : `R$ ${(kpis?.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingDown}
              subtitle="custos operacionais"
              change={kpiVariation ? formatVariation(kpiVariation.variations.total_despesas) : "--"}
              changeType={kpiVariation?.variations.total_despesas <= 0 ? "positive" : "negative"}
              description="Soma de todas as despesas operacionais e administrativas"
              calculation="Σ (Despesas Fixas + Despesas Variáveis)"
            />
              </>
            )}
          </div>
        </div>

        {/* KPIs Secundários - Margens e Operacionais */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Margens e Performance Operacional</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Análise de rentabilidade e conversão</p>
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
              title="Margem Bruta"
              value={isLoading ? "..." : `${(kpis?.margem_bruta_percent || 0).toFixed(1)}%`}
              icon={Percent}
              subtitle="Lucro Bruto / Receita"
              change={kpiVariation ? formatVariation(kpiVariation.variations.margem_bruta_percent) : "--"}
              changeType={kpiVariation?.variations.margem_bruta_percent >= 0 ? "positive" : "negative"}
              description="Percentual de receita que resta após dedução dos custos diretos"
              calculation="(Lucro Bruto / Receita Total) × 100"
            />
            <KPICard
              title="Margem Líquida"
              value={isLoading ? "..." : `${(kpis?.margem_liquida_percent || 0).toFixed(1)}%`}
              icon={Calculator}
              subtitle="Lucro Líquido / Receita"
              change={kpiVariation ? formatVariation(kpiVariation.variations.margem_liquida_percent) : "--"}
              changeType={kpiVariation?.variations.margem_liquida_percent >= 0 ? "positive" : "negative"}
              description="Percentual de receita que vira lucro efetivo após todas as deduções"
              calculation="(Lucro Líquido / Receita Total) × 100"
            />
            <KPICard
              title="Taxa de Conversão"
              value={isLoading ? "..." : `${(kpis?.taxa_conversao_percent || 0).toFixed(1)}%`}
              icon={Target}
              subtitle="orçamentos convertidos"
              change={kpiVariation ? formatVariation(kpiVariation.variations.taxa_conversao_percent) : "--"}
              changeType={kpiVariation?.variations.taxa_conversao_percent >= 0 ? "positive" : "negative"}
              description="Percentual de orçamentos que foram convertidos em serviços efetivos"
              calculation="(Orçamentos Convertidos / Total de Orçamentos) × 100"
            />
            <KPICard
              title="Ticket Médio"
              value={isLoading ? "..." : `R$ ${(kpis?.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={Receipt}
              subtitle="por serviço"
              change={kpiVariation ? formatVariation(kpiVariation.variations.ticket_medio) : "--"}
              changeType={kpiVariation?.variations.ticket_medio >= 0 ? "positive" : "negative"}
              description="Valor médio de receita gerada por cada serviço executado"
              calculation="Receita Total / Quantidade de Serviços"
            />
              </>
            )}
          </div>
        </div>

        {/* KPIs Operacionais */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Indicadores Operacionais</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Acompanhamento de entregas e execução</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 grid-8pt">
            {isLoading ? (
              <>
                <SkeletonKPI />
                <SkeletonKPI />
              </>
            ) : (
              <>
            <KPICard
              title="Total de Serviços"
              value={isLoading ? "..." : String(kpis?.total_servicos || 0)}
              icon={ClipboardList}
              subtitle="serviços registrados"
              change={kpiVariation ? formatVariation(kpiVariation.variations.total_servicos, false, true) : "--"}
              changeType={kpiVariation?.variations.total_servicos >= 0 ? "positive" : "negative"}
              description="Número total de serviços cadastrados no sistema"
              calculation="COUNT(Serviços)"
            />
            <KPICard
              title="Serviços Concluídos"
              value={isLoading ? "..." : String(kpis?.servicos_concluidos || 0)}
              icon={ClipboardCheck}
              subtitle={`${kpis?.total_servicos ? ((kpis.servicos_concluidos / kpis.total_servicos) * 100).toFixed(1) : 0}% do total`}
              change={kpiVariation ? formatVariation(kpiVariation.variations.servicos_concluidos, false, true) : "--"}
              changeType={kpiVariation?.variations.servicos_concluidos >= 0 ? "positive" : "negative"}
              description="Quantidade de serviços finalizados e entregues aos clientes"
              calculation="COUNT(Serviços WHERE situação = 'Concluído')"
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
