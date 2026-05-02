import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface Insight {
  tipo: "positivo" | "negativo" | "neutro";
  titulo: string;
  descricao: string;
  acao: string;
}

export function AIInsightsCard() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      return data as { insights?: Insight[]; kpis?: any; error?: string; message?: string };
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
          <Alert className="border-amber-500/50 bg-amber-500/5">
            <CreditCard className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm font-semibold">Créditos de IA esgotados</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <p>Para continuar gerando insights automáticos, adicione créditos ao seu workspace.</p>
              <a
                href="https://lovable.dev/settings/workspace/usage"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                Adicionar créditos em Settings → Workspace → Usage →
              </a>
            </AlertDescription>
          </Alert>
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
