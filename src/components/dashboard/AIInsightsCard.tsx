import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, CreditCard, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { trackAiCreditsCtaClick } from "@/lib/aiCreditsTracking";
import { BatchApplyDialog } from "./BatchApplyDialog";

interface Insight {
  tipo: "positivo" | "negativo" | "neutro";
  titulo: string;
  descricao: string;
  acao: string;
}

export function AIInsightsCard() {
  const [batchOpen, setBatchOpen] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      return data as {
        insights?: Insight[];
        kpis?: any;
        error?: string;
        message?: string;
        creditsRemaining?: number | null;
        creditsRequired?: number | null;
        creditsInfoAvailable?: boolean;
      };
    },
    staleTime: 1000 * 60 * 30, // 30 min
    retry: 1,
  });

  const isPaymentRequired = data?.error === "PAYMENT_REQUIRED";
  const isRateLimited = data?.error === "RATE_LIMITED";
  const isServiceError = data?.error === "AI_SERVICE_ERROR";

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "positivo": return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "negativo": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-amber-500" />;
    }
  };

  const getBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "positivo": return "default" as const;
      case "negativo": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Insights com IA</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : isPaymentRequired ? (
          (() => {
            const remaining = typeof data?.creditsRemaining === "number" ? data.creditsRemaining : null;
            const required = typeof data?.creditsRequired === "number" ? data.creditsRequired : null;
            const infoAvailable = data?.creditsInfoAvailable === true;
            const missing =
              remaining !== null && required !== null
                ? Math.max(0, required - remaining)
                : null;
            // Partial info: provider returned exactly one of the two values
            const partialInfo =
              infoAvailable &&
              ((remaining === null) !== (required === null));
            // Flagged available but neither value present (inconsistent provider response)
            const infoAvailableButEmpty =
              infoAvailable && remaining === null && required === null;
            return (
          <Alert className="border-amber-500/50 bg-amber-500/5">
            <CreditCard className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm font-semibold">Créditos de IA esgotados</AlertTitle>
            <AlertDescription className="text-xs space-y-3">
              {missing !== null ? (
                <p>
                  Faltam <strong>{missing}</strong> crédito{missing === 1 ? "" : "s"} para gerar
                  esta análise
                  {required !== null && (
                    <> (necessário: {required}, disponível: {remaining})</>
                  )}
                  .
                </p>
              ) : partialInfo ? (
                <p>
                  Os créditos de IA do workspace acabaram. O provedor informou apenas{" "}
                  {required !== null ? (
                    <>
                      o custo desta análise (<strong>{required}</strong> crédito
                      {required === 1 ? "" : "s"}), mas não o saldo restante
                    </>
                  ) : (
                    <>
                      o saldo restante (<strong>{remaining}</strong> crédito
                      {remaining === 1 ? "" : "s"}), mas não o custo desta análise
                    </>
                  )}
                  . Abra <strong>Usage</strong> para conferir o consumo atual.
                </p>
              ) : infoAvailableButEmpty ? (
                <p>
                  Os créditos de IA do workspace acabaram. O provedor sinalizou falta de
                  créditos, mas não informou nem o saldo nem o custo desta análise. Abra{" "}
                  <strong>Usage</strong> para conferir o consumo atual.
                </p>
              ) : data?.creditsInfoAvailable === false ? (
                <p>
                  Os créditos de IA do workspace acabaram. O provedor não retornou o saldo
                  exato — abra <strong>Usage</strong> para conferir o consumo atual.
                </p>
              ) : (
                <p>Não há créditos suficientes no workspace para gerar esta análise.</p>
              )}
              <p className="text-muted-foreground">
                Sem créditos, os seguintes recursos ficam indisponíveis:
              </p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                <li>Geração automática de insights financeiros no dashboard</li>
                <li>Recomendações acionáveis baseadas nos seus KPIs</li>
                <li>Respostas do assistente GeoBot</li>
              </ul>
              <p className="text-muted-foreground">
                Ao clicar abaixo, você abre <strong>Settings → Workspace → Usage</strong> em uma
                nova aba para revisar consumo e adicionar créditos. Sua sessão atual continua
                ativa.
              </p>
              <Button
                size="sm"
                variant="default"
                onClick={() =>
                  trackAiCreditsCtaClick({
                    source: "AIInsightsCard",
                    creditsRemaining: remaining,
                    creditsRequired: required,
                  })
                }
                className="gap-1"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Abrir Settings → Workspace → Usage
              </Button>
            </AlertDescription>
          </Alert>
            );
          })()
        ) : isRateLimited ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <AlertTriangle className="h-4 w-4" />
            <span>{data?.message || "Muitas requisições. Aguarde alguns instantes."}</span>
          </div>
        ) : error || isServiceError ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <AlertTriangle className="h-4 w-4" />
            <span>Não foi possível gerar insights. Tente novamente.</span>
          </div>
        ) : data?.insights?.length ? (
          data.insights.map((insight, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-2 mb-1">
                {getIcon(insight.tipo)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-foreground truncate">
                      {insight.titulo}
                    </span>
                    <Badge variant={getBadgeVariant(insight.tipo)} className="text-[10px] h-4 px-1.5">
                      {insight.tipo}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.descricao}
                  </p>
                  <p className="text-xs text-primary mt-1 font-medium">
                    💡 {insight.acao}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum insight disponível. Adicione dados financeiros primeiro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
