import { Card } from "@/components/ui/card";
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

export const KPICard = ({ title, value, change, changeType = "neutral", icon: Icon, subtitle }: KPICardProps) => {
  return (
    <Card className="relative overflow-hidden p-6 transition-smooth hover:shadow-lg bg-gradient-to-br from-card to-card/50 border-border/50">
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-heading font-bold text-foreground">{value}</h3>
            {change && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                changeType === "positive" && "text-accent bg-accent/10",
                changeType === "negative" && "text-destructive bg-destructive/10",
                changeType === "neutral" && "text-muted-foreground bg-muted/10"
              )}>
                {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
                {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
                {change}
              </div>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow">
          <Icon className="h-6 w-6 text-primary-foreground" />
        </div>
      </div>
      <MiniSparkline trend={changeType === "positive" ? "up" : changeType === "negative" ? "down" : "neutral"} />
    </Card>
  );
};
