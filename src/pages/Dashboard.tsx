import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { AIStoryCards } from "@/components/dashboard/AIStoryCards";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ProfitMarginChart } from "@/components/charts/ProfitMarginChart";
import { GlobalFilters, FilterState } from "@/components/filters/GlobalFilters";
import { useKPIs } from "@/hooks/useKPIs";
import { useKPIVariation, formatVariation } from "@/hooks/useKPIVariation";
import { GeoBot } from "@/components/dashboard/GeoBot";
import { AlertasFinanceiros } from "@/components/dashboard/AlertasFinanceiros";
import { PageHeader } from "@/components/layout/PageHeader";
import { 
  Banknote, 
  TrendingUp, 
  CircleDollarSign, 
  TrendingDown, 
  Percent, 
  Target, 
  Receipt, 
  ClipboardList, 
  ClipboardCheck,
  Filter
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
        <PageHeader
          title="Dashboard Executivo"
          subtitle="Visão geral da performance da empresa"
        />

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
              iconTone="primary"
              change={kpiVariation ? formatVariation(kpiVariation.variations.receita_total) : "--"}
              changeType={kpiVariation?.variations.receita_total >= 0 ? "positive" : "negative"}
              description="Receita realizada no período (com fallback para faturado). Nunca usa apenas valor esperado."
              calculation="Σ COALESCE(receita_realizada, valor_faturado) dos orçamentos"
            />
            <KPICard
              title="Lucro Líquido"
              value={isLoading ? "..." : `R$ ${(kpis?.lucro_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={CircleDollarSign}
              iconTone="success"
              change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_liquido) : "--"}
              changeType={kpiVariation?.variations.lucro_liquido >= 0 ? "positive" : "negative"}
              description="Resultado final após impostos, custo de serviço e despesas."
              calculation="Receita Realizada - Impostos - Custo de Serviço - Despesas"
            />
            <KPICard
              title="Margem Líquida"
              value={isLoading ? "..." : `${(kpis?.margem_liquida_percent || 0).toFixed(1)}%`}
              icon={Percent}
              iconTone="info"
              change={kpiVariation ? formatVariation(kpiVariation.variations.margem_liquida_percent) : "--"}
              changeType={kpiVariation?.variations.margem_liquida_percent >= 0 ? "positive" : "negative"}
              description="Percentual de lucro líquido sobre a receita total."
              calculation="(Lucro Líquido / Receita Total) × 100"
            />
            <KPICard
              title="Total de Despesas"
              value={isLoading ? "..." : `R$ ${(kpis?.total_despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingDown}
              iconTone="danger"
              change={kpiVariation ? formatVariation(kpiVariation.variations.total_despesas) : "--"}
              changeType={kpiVariation?.variations.total_despesas <= 0 ? "positive" : "negative"}
              description="Soma de todas as despesas operacionais no período."
              calculation="Σ despesas fixas + variáveis"
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
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7 grid-8pt">
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
              iconTone="primary"
              change={kpiVariation ? formatVariation(kpiVariation.variations.margem_bruta_percent) : "--"}
              changeType={kpiVariation?.variations.margem_bruta_percent >= 0 ? "positive" : "negative"}
              description="Rentabilidade antes das despesas fixas."
              calculation="(Receita - Custos Variáveis) / Receita × 100"
            />
            <KPICard
              title="Taxa Conversão"
              value={`${(kpis?.taxa_conversao_percent || 0).toFixed(1)}%`}
              icon={Target}
              iconTone="warning"
              change={kpiVariation ? formatVariation(kpiVariation.variations.taxa_conversao_percent) : "--"}
              changeType={kpiVariation?.variations.taxa_conversao_percent >= 0 ? "positive" : "negative"}
              description="Percentual de orçamentos convertidos em serviços."
              calculation="(Orçamentos aprovados / Total de orçamentos) × 100"
            />
            <KPICard
              title="Ticket Médio"
              value={`R$ ${(kpis?.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={Receipt}
              iconTone="info"
              change={kpiVariation ? formatVariation(kpiVariation.variations.ticket_medio) : "--"}
              changeType={kpiVariation?.variations.ticket_medio >= 0 ? "positive" : "negative"}
              description="Valor médio de receita por serviço realizado."
              calculation="Receita Total / Nº de Serviços"
            />
            <KPICard
              title="Lucro Bruto"
              value={`R$ ${(kpis?.lucro_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              iconTone="success"
              change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_bruto) : "--"}
              changeType={kpiVariation?.variations.lucro_bruto >= 0 ? "positive" : "negative"}
              description="Receita menos custos diretos dos serviços."
              calculation="Receita Total - Custos Variáveis"
            />
            <KPICard
              title="Serviços"
              value={String(kpis?.total_servicos || 0)}
              icon={ClipboardList}
              iconTone="neutral"
              change={kpiVariation ? formatVariation(kpiVariation.variations.total_servicos, false, true) : "--"}
              changeType={kpiVariation?.variations.total_servicos >= 0 ? "positive" : "negative"}
              description="Total de serviços cadastrados no período."
              calculation="Contagem de todos os serviços"
            />
            <KPICard
              title="Concluídos"
              value={String(kpis?.servicos_concluidos || 0)}
              icon={ClipboardCheck}
              iconTone="success"
              change={kpiVariation ? formatVariation(kpiVariation.variations.servicos_concluidos, false, true) : "--"}
              changeType={kpiVariation?.variations.servicos_concluidos >= 0 ? "positive" : "negative"}
              description="Serviços finalizados com sucesso."
              calculation="Contagem de serviços com status 'Concluído'"
            />
              </>
            )}
          </div>
        </div>

        {/* Story Cards gerados por IA sob demanda */}
        <AIStoryCards />

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
