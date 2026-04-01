import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertCircle, Target, Activity, ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoryCardProps {
  title: string;
  insight: string;
  category?: "financial" | "operational" | "strategic";
  trend?: "up" | "down" | "neutral" | "alert";
  emphasis?: "high" | "medium" | "low";
  action?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
}

export const StoryCard = ({
  title, 
  insight, 
  category = "financial",
  trend = "neutral",
  emphasis = "medium",
  action,
  icon,
  actionLabel,
  actionHref,
}: StoryCardProps) => {
  const navigate = useNavigate();
  
  const categoryBorder = {
    financial: "border-l-primary",
    operational: "border-l-accent",
    strategic: "border-l-warning",
  };
  
  const categoryLabel = {
    financial: "Financeiro",
    operational: "Operacional",
    strategic: "Estratégico",
  };

  return (
    <Card 
      className={cn(
        "p-6 border-l-4 bg-card transition-all duration-200 hover:shadow-md",
        categoryBorder[category],
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className={cn(
            "font-heading font-semibold text-foreground leading-tight",
            emphasis === "high" ? "text-lg" : "text-base"
          )}>
            {title}
          </h4>
          <span className="text-xs text-muted-foreground">
            {categoryLabel[category]}
          </span>
        </div>
        
        <p className={cn(
          "leading-relaxed",
          emphasis === "high" ? "text-sm text-foreground" : "text-sm text-muted-foreground"
        )}>
          {insight}
        </p>
        
        {action && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-sm font-medium text-primary flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0" />
              {action}
            </p>
          </div>
        )}

        {actionLabel && actionHref && (
          <div className="pt-2 border-t border-border/30">
            <Button
              variant="ghost"
              size="sm"
              className="px-0 h-auto text-primary hover:text-primary/80"
              onClick={() => navigate(actionHref)}
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
