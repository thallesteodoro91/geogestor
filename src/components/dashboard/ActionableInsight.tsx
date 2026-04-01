import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionableInsightProps {
  title: string;
  insight: string;
  priority: "urgent" | "attention" | "positive";
  actionLabel?: string;
  actionHref?: string;
  icon?: LucideIcon;
}

const priorityConfig = {
  urgent: {
    badge: "🔴 Urgente",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    borderClass: "border-l-destructive",
  },
  attention: {
    badge: "🟡 Atenção",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    borderClass: "border-l-amber-500",
  },
  positive: {
    badge: "🟢 Positivo",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    borderClass: "border-l-emerald-500",
  },
};

export function ActionableInsight({ title, insight, priority, actionLabel, actionHref, icon: Icon }: ActionableInsightProps) {
  const navigate = useNavigate();
  const config = priorityConfig[priority];

  return (
    <Card className={cn("p-5 border-l-4 transition-all hover:shadow-md", config.borderClass)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-heading font-semibold text-foreground">{title}</h4>
          <Badge variant="outline" className={cn("text-xs", config.badgeClass)}>
            {config.badge}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
        {actionLabel && actionHref && (
          <Button
            variant="ghost"
            size="sm"
            className="px-0 text-primary hover:text-primary/80"
            onClick={() => navigate(actionHref)}
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}
