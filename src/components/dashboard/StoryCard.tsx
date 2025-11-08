import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertCircle, Lightbulb, Target, Activity, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StoryCardProps {
  title: string;
  insight: string;
  category?: "financial" | "operational" | "strategic";
  trend?: "up" | "down" | "neutral" | "alert";
  emphasis?: "high" | "medium" | "low";
  action?: string;
  icon?: LucideIcon;
}

export const StoryCard = ({ 
  title, 
  insight, 
  category = "financial",
  trend = "neutral",
  emphasis = "medium",
  action,
  icon
}: StoryCardProps) => {
  // Princípio 1: Design com propósito - ícones que comunicam significado
  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Activity,
    alert: AlertCircle,
  };
  
  const TrendIcon = trendIcons[trend];
  
  // Princípio 2: Atenção e contraste - cores que guiam o olhar
  const trendColors = {
    up: "text-success",
    down: "text-destructive",
    neutral: "text-accent",
    alert: "text-warning",
  };
  
  const categoryConfig = {
    financial: {
      icon: Target,
      bgGradient: "from-primary/5 via-card to-card",
      borderColor: "border-primary/20",
      accentColor: "text-primary",
    },
    operational: {
      icon: Activity,
      bgGradient: "from-accent/5 via-card to-card",
      borderColor: "border-accent/20",
      accentColor: "text-accent",
    },
    strategic: {
      icon: Lightbulb,
      bgGradient: "from-chart-3/5 via-card to-card",
      borderColor: "border-chart-3/20",
      accentColor: "text-chart-3",
    },
  };
  
  const config = categoryConfig[category];
  const CategoryIcon = icon || config.icon;
  
  // Princípio 3: Hierarquia visual baseada em ênfase
  const emphasisStyles = {
    high: "border-2 shadow-glow",
    medium: "border shadow-lg",
    low: "border-border/50",
  };

  return (
    <Card 
      className={cn(
        "p-6 transition-smooth hover:shadow-xl bg-gradient-to-br",
        config.bgGradient,
        config.borderColor,
        emphasisStyles[emphasis]
      )}
    >
      {/* Princípio 4: Clareza visual - estrutura clara e limpa */}
      <div className="flex items-start gap-4">
        {/* Indicador visual de categoria */}
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          "bg-gradient-to-br from-background/50 to-muted/30 border",
          config.borderColor
        )}>
          <CategoryIcon className={cn("h-6 w-6", config.accentColor)} />
        </div>
        
        <div className="space-y-3 flex-1 min-w-0">
          {/* Cabeçalho com título e indicador de tendência */}
          <div className="flex items-start justify-between gap-3">
            <h4 className={cn(
              "font-heading font-semibold text-foreground leading-tight",
              emphasis === "high" ? "text-lg" : "text-base"
            )}>
              {title}
            </h4>
            
            {/* Princípio 5: Contraste para guiar atenção */}
            <TrendIcon className={cn(
              "h-5 w-5 shrink-0 mt-0.5",
              trendColors[trend],
              trend !== "neutral" && "animate-pulse"
            )} />
          </div>
          
          {/* Princípio 6: Narrativa com contexto - insight em linguagem clara */}
          <p className={cn(
            "leading-relaxed",
            emphasis === "high" ? "text-base text-foreground/90" : "text-sm text-muted-foreground/90"
          )}>
            {insight}
          </p>
          
          {/* Call-to-action quando há recomendação */}
          {action && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-sm font-medium text-accent flex items-center gap-2">
                <Target className="h-4 w-4" />
                {action}
              </p>
            </div>
          )}
          
          {/* Badge sutil de categoria */}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs border-0",
              config.accentColor,
              "bg-background/50"
            )}
          >
            {category === "financial" && "Financeiro"}
            {category === "operational" && "Operacional"}
            {category === "strategic" && "Estratégico"}
          </Badge>
        </div>
      </div>
    </Card>
  );
};
