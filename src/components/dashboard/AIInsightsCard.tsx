import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, CreditCard, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { trackAiCreditsCtaClick } from "@/lib/aiCreditsTracking";
import { BatchApplyDialog } from "./BatchApplyDialog";
import { z } from "zod";
import { toast } from "sonner";

const InsightSchema = z.object({
  tipo: z.enum(["positivo", "negativo", "neutro"]),
  titulo: z.string(),
  descricao: z.string(),
  acao: z.string(),
});

const AIInsightsResponseSchema = z.object({
  insights: z.array(InsightSchema).optional().default([]),
  kpis: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  creditsRemaining: z.number().nullable().optional(),
  creditsRequired: z.number().nullable().optional(),
  creditsInfoAvailable: z.boolean().optional(),
});

export type Insight = z.infer<typeof InsightSchema>;
export type AIInsightsResponse = z.infer<typeof AIInsightsResponseSchema>;

export function AIInsightsCard() {
  const [batchOpen, setBatchOpen] = useState(false);
  const [autoReloadDisabled, setAutoReloadDisabled] = useState(false);
  const [autoReloadPending, setAutoReloadPending] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useQuery<AIInsightsResponse>({
    queryKey: ["ai-insights"],
    queryFn: async (): Promise<AIInsightsResponse> => {
      const { data, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      const parsed = AIInsightsResponseSchema.safeParse(data);
      if (!parsed.success) {
        console.error("[AIInsightsCard] Schema inválido:", parsed.error.flatten());
        const err = new Error("SCHEMA_INVALID");
        (err as any).code = "SCHEMA_INVALID";
        throw err;
      }
      return parsed.data;
    },
    staleTime: 1000 * 60 * 30, // 30 min
    retry: 1,
  });

  const isPaymentRequired = data?.error === "PAYMENT_REQUIRED";
  const isRateLimited = data?.error === "RATE_LIMITED";
  const isServiceError = data?.error === "AI_SERVICE_ERROR";
  const errMsg = error instanceof Error ? error.message : "";
  const isSchemaInvalid = errMsg === "SCHEMA_INVALID";
  const isTimeout = /timeout|timed out|fetch failed|network/i.test(errMsg);

  // Auto-refetch when user returns to the tab after visiting Usage to top up credits.
  // Triggers only while in PAYMENT_REQUIRED state, with a small delay to let the
  // provider's credit balance propagate. User can disable via the cancel button.
  const autoRefetchTimer = useRef<number | null>(null);
  const clearAutoRefetch = () => {
    if (autoRefetchTimer.current) {
      window.clearTimeout(autoRefetchTimer.current);
      autoRefetchTimer.current = null;
    }
    setAutoReloadPending(false);
  };
  useEffect(() => {
    if (!isPaymentRequired || autoReloadDisabled) {
      clearAutoRefetch();
      return;
    }
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      clearAutoRefetch();
      setAutoReloadPending(true);
      autoRefetchTimer.current = window.setTimeout(async () => {
        autoRefetchTimer.current = null;
        setAutoReloadPending(false);
        const tId = toast.loading("Recarregando insights de IA...");
        try {
          const res = await refetch();
          if (res.error) throw res.error;
          const errCode = res.data?.error;
          if (errCode === "PAYMENT_REQUIRED") {
            toast.warning("Ainda sem créditos suficientes", { id: tId });
          } else if (errCode === "RATE_LIMITED") {
            toast.warning("Muitas requisições à IA", {
              id: tId,
              description: "Aguarde alguns instantes antes de tentar novamente.",
            });
          } else if (errCode === "AI_SERVICE_ERROR") {
            toast.error("Serviço de IA indisponível", {
              id: tId,
              description: "Não foi possível consultar a IA agora. Tente novamente em instantes.",
            });
          } else {
            toast.success("Insights atualizados", { id: tId });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e ?? "");
          const isNetwork = /fetch failed|network|networkerror|failed to fetch|load failed/i.test(msg);
          const isTimeoutErr = /timeout|timed out|abort/i.test(msg);
          if (isTimeoutErr) {
            toast.error("Tempo de resposta excedido", {
              id: tId,
              description: "A IA demorou demais para responder. Tente novamente em instantes.",
            });
          } else if (isNetwork) {
            toast.error("Sem conexão com o serviço de IA", {
              id: tId,
              description: "Verifique sua conexão de internet e tente novamente.",
            });
          } else {
            toast.error("Falha ao recarregar insights", {
              id: tId,
              description: "Ocorreu um erro inesperado ao consultar a IA.",
            });
          }
        }
      }, 3000);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
      clearAutoRefetch();
    };
  }, [isPaymentRequired, autoReloadDisabled, refetch]);


  const remainingCredits = typeof data?.creditsRemaining === "number" ? data.creditsRemaining : null;
  const requiredCredits = typeof data?.creditsRequired === "number" ? data.creditsRequired : null;
  const missingCredits =
    remainingCredits !== null && requiredCredits !== null
      ? Math.max(0, requiredCredits - remainingCredits)
      : null;

  const paymentDescription = (() => {
    if (missingCredits !== null) {
      return `Faltam ${missingCredits} crédito${missingCredits === 1 ? "" : "s"} de IA para gerar esta análise (necessário: ${requiredCredits}, disponível: ${remainingCredits}). Abra Settings → Workspace → Usage para revisar o consumo e adicionar créditos.`;
    }
    if (requiredCredits !== null) {
      return `Os créditos de IA do workspace acabaram. Esta análise custa ${requiredCredits} crédito${requiredCredits === 1 ? "" : "s"}. Abra Settings → Workspace → Usage para revisar o consumo e adicionar créditos.`;
    }
    if (remainingCredits !== null) {
      return `Os créditos de IA do workspace acabaram (saldo: ${remainingCredits}). Abra Settings → Workspace → Usage para revisar o consumo e adicionar créditos.`;
    }
    return "Os créditos de IA do workspace acabaram. Abra Settings → Workspace → Usage para revisar o consumo e adicionar créditos.";
  })();

  type ErrorKind = "schema" | "rate" | "timeout" | "service" | "payment";
  const ERROR_COPY: Record<ErrorKind, { title: string; description: string }> = {
    schema: {
      title: "Formato de resposta inesperado",
      description:
        "Recebemos os dados da IA, mas em um formato que não conseguimos interpretar. Isso pode ser temporário — tente novamente em alguns instantes.",
    },
    rate: {
      title: "Muitas requisições",
      description:
        data?.message ||
        "Atingimos o limite de requisições à IA por enquanto. Aguarde alguns instantes e tente novamente.",
    },
    timeout: {
      title: "Tempo de resposta excedido",
      description:
        "A IA demorou demais para responder. Verifique sua conexão e tente novamente em alguns instantes.",
    },
    service: {
      title: "Não foi possível gerar insights",
      description:
        "Ocorreu uma falha temporária ao consultar a IA. Tente novamente em alguns instantes.",
    },
    payment: {
      title: "Créditos de IA esgotados",
      description: paymentDescription,
    },
  };

  const renderErrorState = (kind: ErrorKind) => {
    const copy = ERROR_COPY[kind];
    const isPayment = kind === "payment";
    return (
      <Alert
        variant={isPayment ? "default" : "destructive"}
        className={isPayment ? "border-amber-500/50 bg-amber-500/5" : undefined}
      >
        {isPayment ? (
          <CreditCard className="h-4 w-4 text-amber-600" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <AlertTitle className="text-sm font-semibold">{copy.title}</AlertTitle>
        <AlertDescription className="text-xs space-y-2">
          <p>{copy.description}</p>
          {isPayment ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() =>
                  trackAiCreditsCtaClick({
                    source: "AIInsightsCard",
                    creditsRemaining: remainingCredits,
                    creditsRequired: requiredCredits,
                  })
                }
                className="gap-1"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Abrir Settings → Workspace → Usage
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-1"
                title="Recarregar após adicionar créditos"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Já atualizei meus créditos
              </Button>
              {autoReloadDisabled ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      title="Reativar recarga automática ao voltar à aba"
                    >
                      Reativar recarga automática
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reativar recarga automática?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O card voltará a recarregar sozinho alguns segundos depois que você retornar à aba.
                        Você poderá desativá-la novamente a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Manter desativada</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setAutoReloadDisabled(false);
                          toast.success("Recarga automática reativada", {
                            description: "Recarregaremos o card alguns segundos após você voltar à aba.",
                          });
                        }}
                      >
                        Reativar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      title="Não recarregar automaticamente ao voltar à aba"
                    >
                      {autoReloadPending ? "Cancelar recarga automática" : "Desativar recarga automática"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desativar recarga automática?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O card deixará de recarregar sozinho ao voltar à aba. Você ainda poderá usar o botão
                        "Já atualizei meus créditos" para recarregar manualmente, e poderá reativar a recarga
                        automática a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Manter ativa</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          clearAutoRefetch();
                          setAutoReloadDisabled(true);
                        }}
                      >
                        Desativar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  };

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
    <>
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Insights com IA</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBatchOpen(true)}
              title="Aplicar todas as sugestões em lote"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
          renderErrorState("payment")
        ) : isRateLimited ? (
          renderErrorState("rate")
        ) : isSchemaInvalid ? (
          renderErrorState("schema")
        ) : isTimeout ? (
          renderErrorState("timeout")
        ) : error || isServiceError ? (
          renderErrorState("service")
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
    <BatchApplyDialog open={batchOpen} onOpenChange={setBatchOpen} />
    </>
  );
}
