import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { StoryCard } from "./StoryCard";
import { useKPIs } from "@/hooks/useKPIs";
import { useKPIVariation } from "@/hooks/useKPIVariation";
import { useRevenueChartData } from "@/hooks/useChartData";

interface AICard {
  title: string;
  insight: string;
  category: "financial" | "operational" | "strategic";
  trend: "up" | "down" | "alert" | "neutral";
  kind: "variation" | "trend" | "alert";
  action?: string;
}

interface AIStoryCardsResponse {
  cards: AICard[];
  generated_at: string;
}

export function AIStoryCards() {
  const [cards, setCards] = useState<AICard[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const { data: kpis } = useKPIs();
  const { data: kpiVariation } = useKPIVariation();
  const { data: monthlyTrend } = useRevenueChartData();

  const mutation = useMutation({
    mutationFn: async (): Promise<AIStoryCardsResponse> => {
      if (!kpis || !kpiVariation) throw new Error("KPIs ainda não carregados");

      const current = {
        receita_total: kpis.receita_total ?? 0,
        lucro_liquido: kpis.lucro_liquido ?? 0,
        lucro_bruto: kpis.lucro_bruto ?? 0,
        total_despesas: kpis.total_despesas ?? 0,
        margem_liquida_percent: kpis.margem_liquida_percent ?? 0,
        margem_bruta_percent: kpis.margem_bruta_percent ?? 0,
        taxa_conversao_percent: kpis.taxa_conversao_percent ?? 0,
        ticket_medio: kpis.ticket_medio ?? 0,
        total_servicos: kpis.total_servicos ?? 0,
        servicos_concluidos: kpis.servicos_concluidos ?? 0,
      };

      const { data, error } = await supabase.functions.invoke("generate-story-cards", {
        body: {
          current,
          previous: kpiVariation.previousPeriod,
          variations: kpiVariation.variations,
          monthlyTrend: monthlyTrend ?? [],
        },
      });

      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.status === 429) throw new Error("Muitas requisições. Aguarde 1 minuto.");
        if (ctx?.status === 402)
          throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
        throw new Error(error.message || "Falha ao gerar análise");
      }

      return data as AIStoryCardsResponse;
    },
    onSuccess: (data) => {
      setCards(data.cards);
      setGeneratedAt(data.generated_at);
      toast({
        title: "Análise gerada",
        description: `${data.cards.length} insights produzidos pela IA.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível gerar a análise",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = mutation.isPending;
  const ready = Boolean(kpis && kpiVariation);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights Narrativos (IA)
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Análise automática de variações, tendências e alertas dos seus KPIs.
            {generatedAt && (
              <span className="ml-2 text-xs">
                · Gerado em {new Date(generatedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!ready || isLoading}
          size="sm"
          variant={cards ? "outline" : "default"}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : cards ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar análise
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar análise IA
            </>
          )}
        </Button>
      </div>

      {!cards && !isLoading && (
        <Card className="p-8 border-dashed bg-muted/30">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="rounded-full p-3 bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1 max-w-md">
              <p className="font-medium text-foreground">
                Clique em "Gerar análise IA" para receber insights narrativos
              </p>
              <p className="text-sm text-muted-foreground">
                A IA vai comparar seus KPIs do período atual com os 6 meses anteriores e gerar
                explicações sobre variações, tendências e alertas operacionais.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isLoading && (
        <Card className="p-8 border-dashed">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">A IA está analisando seus KPIs...</span>
          </div>
        </Card>
      )}

      {cards && cards.length === 0 && !isLoading && (
        <Card className="p-6 border-dashed">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Nenhum insight retornado pela IA.</span>
          </div>
        </Card>
      )}

      {cards && cards.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 grid-8pt">
          {cards.map((c, idx) => (
            <StoryCard
              key={idx}
              title={c.title}
              insight={c.insight}
              category={c.category}
              trend={c.trend}
              emphasis={c.kind === "alert" ? "high" : "medium"}
              action={c.action}
            />
          ))}
        </div>
      )}
    </div>
  );
}
