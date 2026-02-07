import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

/**
 * KPI Card Component
 * UX/UI Principles Applied:
 * - "Benefits of Playfulness": Interactive lift on hover, icon scale animation
 * - "Understanding Hierarchy": Clear visual hierarchy (title → value → change)
 * - "How to Apply Contrast": Color-coded change indicators with background
 * - "Benefits of Anticipation": Smooth transitions create predictable interactions
 */
export const KPICard = ({ title, value, change, changeType = "neutral", icon: Icon }: KPICardProps) => {
  // Remove operation signs from change value
  const cleanChange = change?.replace(/^[+-]\s*/, '');
  
  // Dynamic lift class based on changeType
  const liftClass = changeType === "positive" 
    ? "interactive-lift-positive" 
    : changeType === "negative" 
      ? "interactive-lift-negative" 
      : "interactive-lift";
  
  return (
    <Card className={cn("relative overflow-hidden group bg-gradient-to-br from-card to-card/50 border-border/50", liftClass)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4 relative z-10">
          {/* Icon with micro-interaction - "Benefits of Playfulness" */}
          <div className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            "bg-gradient-to-br from-primary to-secondary shadow-glow",
            "transition-all group-hover:scale-110 group-hover:rotate-3"
          )}>
            <Icon className="h-5 w-5 text-primary-foreground transition-transform group-hover:scale-110" />
          </div>
          
          {/* Content with improved typography - Chapter 4: Typography */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground leading-relaxed">
              {title}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-3xl font-heading font-bold text-foreground leading-tight tracking-tight">
                {value}
              </h3>
              {cleanChange && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-full cursor-help",
                        "transition-all hover:scale-105",
                        changeType === "positive" && "text-accent bg-accent/10 hover:bg-accent/20",
                        changeType === "negative" && "text-destructive bg-destructive/10 hover:bg-destructive/20",
                        changeType === "neutral" && "text-muted-foreground bg-muted/10 hover:bg-muted/20"
                      )}>
                        {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
                        {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
                        <span>{cleanChange}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-center">
                      <p className="text-xs">
                        {changeType === "positive" 
                          ? "📈 Crescimento" 
                          : changeType === "negative" 
                            ? "📉 Queda" 
                            : "Variação"
                        }
                        {" de "}
                        <span className="font-semibold">{cleanChange}</span>
                        {" comparando os últimos 6 meses com os 6 meses anteriores."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};