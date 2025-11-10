import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
}

const MiniSparkline = ({ trend = "up" }: { trend?: "up" | "down" | "neutral" }) => {
  const pathUp = "M2,20 Q10,15 20,12 T40,8 T60,10 T80,6 T98,4";
  const pathDown = "M2,4 Q10,8 20,12 T40,16 T60,14 T80,18 T98,20";
  const pathNeutral = "M2,12 Q20,10 40,12 T80,12 T98,12";
  
  const path = trend === "up" ? pathUp : trend === "down" ? pathDown : pathNeutral;
  const color = trend === "up" ? "hsl(189, 94%, 43%)" : trend === "down" ? "hsl(0, 72%, 51%)" : "hsl(262, 83%, 65%)";
  
  return (
    <svg width="100" height="24" viewBox="0 0 100 24" className="absolute bottom-2 right-2 opacity-20">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

/**
 * KPI Card Component
 * UX/UI Principles Applied:
 * - "Benefits of Playfulness": Interactive lift on hover, icon scale animation
 * - "Understanding Hierarchy": Clear visual hierarchy (title → value → change)
 * - "How to Apply Contrast": Color-coded change indicators with background
 * - "Benefits of Anticipation": Smooth transitions create predictable interactions
 */
export const KPICard = ({ title, value, change, changeType = "neutral", icon: Icon, subtitle }: KPICardProps) => {
  // Remove operation signs from change value
  const cleanChange = change?.replace(/^[+-]\s*/, '');
  
  return (
    <Card className="relative overflow-hidden interactive-lift group bg-gradient-to-br from-card to-card/50 border-border/50">
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
                <div className={cn(
                  "flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                  "transition-all hover:scale-105",
                  changeType === "positive" && "text-accent bg-accent/10 hover:bg-accent/20",
                  changeType === "negative" && "text-destructive bg-destructive/10 hover:bg-destructive/20",
                  changeType === "neutral" && "text-muted-foreground bg-muted/10 hover:bg-muted/20"
                )}>
                  {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
                  {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
                  <span>{cleanChange}</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <MiniSparkline trend={changeType === "positive" ? "up" : changeType === "negative" ? "down" : "neutral"} />
      </CardContent>
    </Card>
  );
};
