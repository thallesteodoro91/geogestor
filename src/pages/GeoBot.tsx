import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GeoBot } from "@/components/dashboard/GeoBot";
import { PageHeader } from "@/components/layout/PageHeader";
import { useKPIs } from "@/hooks/useKPIs";

const CONTEXT_PROMPTS: Record<string, string> = {
  margem: "Analise minhas margens bruta e líquida e sugira otimizações para melhorar a rentabilidade.",
  despesas: "Quais despesas estão impactando mais o lucro? Sugira cortes ou otimizações.",
  conversao: "Como posso melhorar a taxa de conversão de orçamentos em serviços?",
};

const GeoBotPage = () => {
  const { data: kpis } = useKPIs();
  const [searchParams] = useSearchParams();
  const contextParam = searchParams.get("context");

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader
          title="GeoBot - Consultor Financeiro"
          subtitle="Seu assistente inteligente para análises financeiras e operacionais"
        />
        
        <div className="max-w-4xl mx-auto">
          <GeoBot kpis={kpis} initialPrompt={contextParam ? CONTEXT_PROMPTS[contextParam] : undefined} />
        </div>
      </div>
    </AppLayout>
  );
};

export default GeoBotPage;
