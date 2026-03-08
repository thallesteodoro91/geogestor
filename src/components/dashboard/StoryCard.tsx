import { Card } from "@/components/ui/card";
import { TrendingUp, AlertCircle, Target, Activity, LucideIcon } from "lucide-react";
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
 * Story Card Component — Narrative Data Visualization
 * 
 * Storytelling com Dados:
 * - Cap. 1: Context — each card answers "so what?" for the viewer
 * - Cap. 3: Eliminate clutter — clean text, minimal decoration
 * - Cap. 4: Color only on the left border to indicate category. 
 *   Text does the storytelling, not visual effects.
 * - Cap. 7: Narrative structure — insight + recommended action
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
  
  // Cap. 4: Minimal color coding — just a left border accent
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

  const trendIcons = {
    up: TrendingUp,
    down: TrendingUp, // rotated via CSS
    neutral: Activity,
    alert: AlertCircle,
  };

  const TrendIcon = trendIcons[trend];

  return (
    <Card 
      className={cn(
        "p-6 border-l-4 bg-card transition-all duration-200 hover:shadow-md",
        categoryBorder[category],
      )}
    >
      <div className="space-y-3">
        {/* Cap. 3: Clean header — title + subtle category label */}
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
        
        {/* Cap. 7: The narrative — clear, actionable text */}
        <p className={cn(
          "leading-relaxed",
          emphasis === "high" ? "text-sm text-foreground" : "text-sm text-muted-foreground"
        )}>
          {insight}
        </p>
        
        {/* Cap. 1: Call-to-action — what should the viewer DO with this information */}
        {action && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-sm font-medium text-primary flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0" />
              {action}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};