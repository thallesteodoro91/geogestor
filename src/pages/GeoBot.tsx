import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GeoBot } from "@/components/dashboard/GeoBot";
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
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">GeoBot - Consultor Financeiro</h1>
          <p className="text-muted-foreground">
            Seu assistente inteligente para análises financeiras e operacionais
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <GeoBot kpis={kpis} />
        </div>
      </div>
    </AppLayout>
  );
};

export default GeoBotPage;
