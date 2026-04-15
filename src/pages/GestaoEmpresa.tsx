import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContextualKPIs } from "@/components/layout/ContextualKPIs";
import { KPICard } from "@/components/dashboard/KPICard";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import { StoryCard } from "@/components/dashboard/StoryCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { AIInsightsCard } from "@/components/dashboard/AIInsightsCard";
import { useKPIs } from "@/hooks/useKPIs";
import { useKPIVariation, formatVariation } from "@/hooks/useKPIVariation";
import { AlertasFinanceiros } from "@/components/dashboard/AlertasFinanceiros";
import { CriticalAlerts } from "@/components/dashboard/CriticalAlerts";
import { NextActions } from "@/components/dashboard/NextActions";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { EmptyState } from "@/components/ui/empty-state";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Banknote, CircleDollarSign, Percent, FileText,
  TrendingUp, HeartPulse, Bot,
  Briefcase, CheckCircle2, BarChart3, DollarSign,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TrialBanner } from "@/components/plan/TrialBanner";
import { useNavigate } from "react-router-dom";

const GestaoEmpresa = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: kpis, isLoading } = useKPIs();
  const { data: kpiVariation } = useKPIVariation();

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: pipelineValue } = useQuery({
    queryKey: ["pipeline-value"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fato_orcamento")
        .select("receita_esperada")
        .in("situacao", ["Pendente", "Em Análise", "Em Negociação"])
        .eq("orcamento_convertido", false);
      return (data || []).reduce((acc, o) => acc + (o.receita_esperada || 0), 0);
    },
    enabled: !!user,
  });

  const { data: opPulse } = useQuery({
    queryKey: ["operational-pulse"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const [activeRes, completedRes] = await Promise.all([
        supabase.from("fato_servico").select("id_servico", { count: "exact", head: true }).in("situacao_do_servico", ["Em Andamento", "Planejado"]),
        supabase.from("fato_servico").select("id_servico", { count: "exact", head: true }).eq("situacao_do_servico", "Concluído").gte("data_do_servico_fim", monthStart),
      ]);
      return { servicosAtivos: activeRes.count || 0, concluidosMes: completedRes.count || 0 };
    },
    enabled: !!user,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = profile?.full_name?.split(" ")[0] || "";

  const generateStoryInsight = () => {
    if (!kpis || !kpiVariation) return null;
    const v = kpiVariation.variations;
    return {
      crescimento:
        v.receita_total >= 0
          ? `A receita cresceu ${formatVariation(v.receita_total)} no período, mantendo trajetória ${v.receita_total > 5 ? "ascendente forte" : "estável"}.${v.lucro_bruto >= 0 ? " Destaque para o aumento da margem bruta." : " Porém, a margem bruta recuou — revisar custos diretos."}`
          : `A receita recuou ${formatVariation(v.receita_total)} no período. É necessário revisar a estratégia comercial e pipeline de vendas.`,
      margem:
        (kpis.margem_liquida_percent || 0) > 15
          ? `Com margem líquida de ${(kpis.margem_liquida_percent || 0).toFixed(1)}%, a empresa demonstra forte capacidade de gerar lucro. O controle de custos tem sido efetivo.`
          : (kpis.margem_liquida_percent || 0) > 0
            ? `A margem líquida está em ${(kpis.margem_liquida_percent || 0).toFixed(1)}%. Há espaço para otimização de custos operacionais.`
            : `Atenção: margem líquida negativa (${(kpis.margem_liquida_percent || 0).toFixed(1)}%). Revisão urgente de custos é necessária.`,
    };
  };
  const stories = generateStoryInsight();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Personalizado */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground tracking-tight">
              {getGreeting()}{firstName ? `, ${firstName}` : ""}! 👋
            </h1>
            <p className="text-base text-muted-foreground">Aqui está o que precisa da sua atenção hoje</p>
          </div>
          <Button variant="outline" className="gap-2 shrink-0" onClick={() => navigate("/geobot")}>
            <Bot className="h-4 w-4" />
            Consultar GeoBot
          </Button>
        </div>

        <TrialBanner />
        <OnboardingChecklist />

        {/* Estado vazio — sem dados financeiros */}
        {!isLoading && kpis && (kpis.receita_total === 0 && kpis.total_orcamentos === 0 && kpis.total_servicos === 0) && (
          <EmptyState
            icon={Upload}
            title="Seus dashboards estão vazios"
            description="Importe sua planilha com dados de clientes, serviços e valores para ver seus KPIs, gráficos e relatórios automaticamente preenchidos."
            actionLabel="Importar Planilha"
            onAction={() => navigate("/importacao")}
            tip="Aceita CSV, XLS e XLSX — o sistema detecta automaticamente clientes, propriedades, serviços, orçamentos e despesas."
          />
        )}
        

        {/* Alertas + Ações */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">O que precisa da sua atenção</h2>
            <p className="text-sm text-muted-foreground">Alertas críticos e ações recomendadas</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CriticalAlerts />
            <NextActions />
          </div>
        </div>

        {/* KPIs Essenciais */}
        <div className="space-y-3 animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Saúde Financeira</h2>
            <p className="text-sm text-muted-foreground">Indicadores principais da empresa</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              <><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /></>
            ) : (
              <>
                <KPICard title="Receita Total" value={`R$ ${(kpis?.receita_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={Banknote} iconColor="#6366f1" change={kpiVariation ? formatVariation(kpiVariation.variations.receita_total) : "--"} changeType={kpiVariation?.variations.receita_total >= 0 ? "positive" : "negative"} description="Soma de toda receita gerada no período." calculation="Σ receita de serviços + orçamentos" />
                <KPICard title="Lucro Líquido" value={`R$ ${(kpis?.lucro_liquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CircleDollarSign} iconColor="#10b981" change={kpiVariation ? formatVariation(kpiVariation.variations.lucro_liquido) : "--"} changeType={kpiVariation?.variations.lucro_liquido >= 0 ? "positive" : "negative"} description="Resultado final após todas as deduções." calculation="Receita - Impostos - Custos - Despesas" />
                <KPICard title="Margem Líquida" value={`${(kpis?.margem_liquida_percent || 0).toFixed(1)}%`} icon={Percent} iconColor="#8b5cf6" change={kpiVariation ? formatVariation(kpiVariation.variations.margem_bruta_percent) : "--"} changeType={kpiVariation?.variations.margem_bruta_percent >= 0 ? "positive" : "negative"} description="Percentual de lucro sobre a receita." calculation="Lucro Líquido / Receita Total × 100" />
                <KPICard title="Pipeline" value={`R$ ${(pipelineValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={FileText} iconColor="#f59e0b" description="Valor total de orçamentos pendentes de aprovação." calculation="Σ receita esperada de orçamentos pendentes" />
              </>
            )}
          </div>
        </div>

        {/* Pulso Operacional */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Pulso Operacional</h2>
            <p className="text-sm text-muted-foreground">Atividade do mês</p>
          </div>
          <ContextualKPIs
            columns={4}
            items={[
              { label: "Serviços Ativos", value: opPulse?.servicosAtivos ?? "—", icon: Briefcase },
              { label: "Concluídos no Mês", value: opPulse?.concluidosMes ?? "—", icon: CheckCircle2, iconColor: "text-chart-2", iconBg: "bg-chart-2/10" },
              { label: "Taxa de Conversão", value: `${(kpis?.taxa_conversao_percent || 0).toFixed(1)}%`, icon: BarChart3, iconColor: "text-chart-4", iconBg: "bg-chart-4/10" },
              { label: "Ticket Médio", value: `R$ ${(kpis?.receita_total && kpis?.total_servicos ? kpis.receita_total / kpis.total_servicos : 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, iconColor: "text-chart-5", iconBg: "bg-chart-5/10" },
            ]}
          />
        </div>

        {/* Insights IA + Receita */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIInsightsCard />
          <RevenueChart />
        </div>

        {/* Narrativas */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Interpretação dos Dados</h2>
            <p className="text-sm text-muted-foreground">Análise contextual dos seus resultados</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stories ? (
              <>
                <StoryCard title="Análise de Crescimento" insight={stories.crescimento} category="operational" icon={TrendingUp} actionLabel="Ver Dashboard Financeiro" actionHref="/dashboard-financeiro" />
                <StoryCard title="Margem Líquida" insight={stories.margem} category="operational" icon={HeartPulse} actionLabel="Ver despesas" actionHref="/despesas" />
              </>
            ) : (
              <><Skeleton className="h-32" /><Skeleton className="h-32" /></>
            )}
          </div>
        </div>

        {/* Alertas Financeiros */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-semibold text-foreground">Alertas Financeiros</h2>
            <p className="text-sm text-muted-foreground">Pagamentos e cobranças que precisam de ação</p>
          </div>
          <AlertasFinanceiros />
        </div>
      </div>
    </AppLayout>
  );
};

export default GestaoEmpresa;
