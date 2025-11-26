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

/**
 * Story Card Component - Narrative Data Visualization
 * 
 * UX/UI Principles Applied (from UX/UI Design 2021-2022):
 * 
 * 1. "Benefits of Empathy" (Chapter 2):
 *    - Transforms raw data into human-readable narratives
 *    - Uses emotional color coding to communicate urgency and sentiment
 * 
 * 2. "Understanding Hierarchy" (Chapter 3):
 *    - Visual emphasis levels (high/medium/low) guide user attention
 *    - Icon → Title → Insight → Action creates natural reading flow
 * 
 * 3. "How to Apply Contrast" (Chapter 3):
 *    - Border intensity and shadow depth vary by emphasis
 *    - Trend icons pulse for non-neutral states (alert, up, down)
 * 
 * 4. "Benefits of Anticipation":
 *    - Hover effects lift card and intensify shadow
 *    - Smooth transitions create predictable, comfortable interactions
 */
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
        "p-6 transition-smooth hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br group",
        config.bgGradient,
        config.borderColor,
        emphasisStyles[emphasis],
        "focus-visible-ring"
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
          {/* Cabeçalho com título */}
          <div className="flex items-start justify-between gap-3">
            <h4 className={cn(
              "font-heading font-semibold text-foreground leading-tight tracking-tight",
              emphasis === "high" ? "text-lg" : "text-base"
            )}>
              {title}
            </h4>
          </div>
          
          {/* Princípio 6: Narrativa com contexto - insight em linguagem clara */}
          <p className={cn(
            "leading-loose tracking-wide text-content",
            emphasis === "high" ? "text-base text-foreground/90" : "text-sm text-muted-foreground/90"
          )}>
            {insight}
          </p>
          
          {/* Call-to-action quando há recomendação - aumenta actionability */}
          {action && (
            <div className="pt-2 border-t border-border/50 mt-3">
              <p className="text-sm font-medium text-accent flex items-center gap-2 hover:gap-3 transition-all cursor-pointer group-hover:text-accent/90">
                <Target className="h-4 w-4 transition-transform group-hover:scale-110" />
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
