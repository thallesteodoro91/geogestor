import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActionableInsights, type InsightSeverity } from "@/hooks/useActionableInsights";

const severityStyles: Record<InsightSeverity, { dot: string; badge: string; label: string; border: string }> = {
  urgent: {
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Urgente",
    border: "border-l-destructive",
  },
  attention: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    label: "Atenção",
    border: "border-l-amber-500",
  },
  opportunity: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    label: "Oportunidade",
    border: "border-l-emerald-500",
  },
};

export function TodayActionsHub() {
  const navigate = useNavigate();
  const { data: insights, isLoading } = useActionableInsights();

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg md:text-xl font-heading font-semibold text-foreground">O que você deve fazer hoje</h2>
            <p className="text-xs md:text-sm text-muted-foreground">Ações priorizadas por impacto no seu negócio</p>
          </div>
        </div>
        {insights && insights.length > 0 && (
          <Badge variant="outline" className="shrink-0">{insights.length} {insights.length === 1 ? "ação" : "ações"}</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !insights || insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground">Tudo sob controle hoje 👍</h3>
          <p className="text-sm text-muted-foreground mt-1">Nenhuma ação urgente no momento. Continue acompanhando.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {insights.map((insight) => {
            const style = severityStyles[insight.severity];
            const Icon = insight.icon;
            return (
              <div
                key={insight.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-lg border-l-4 bg-muted/30 hover:bg-muted/50 transition-colors",
                  style.border
                )}
              >
                <div className={cn("shrink-0 h-9 w-9 rounded-lg flex items-center justify-center", style.badge)}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground leading-tight">{insight.title}</h3>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", style.badge)}>{style.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.explanation}</p>
                  <p className="text-xs font-semibold text-foreground/80 pt-0.5">{insight.impact}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 self-start sm:self-center gap-1"
                  onClick={() => navigate(insight.ctaHref)}
                >
                  {insight.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
