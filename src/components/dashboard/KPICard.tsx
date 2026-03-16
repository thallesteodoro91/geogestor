import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  /** Hex color for the icon, e.g. "#6366f1" */
  iconColor?: string;
  /** Description shown in the info tooltip */
  description?: string;
  /** Calculation formula shown in the info tooltip */
  calculation?: string;
}

export const KPICard = ({ title, value, change, changeType = "neutral", icon: Icon, iconColor, description, calculation }: KPICardProps) => {
  const cleanChange = change?.replace(/^[+-]\s*/, '');

  const hoverClass =
    changeType === "positive" ? "interactive-lift-positive" :
    changeType === "negative" ? "interactive-lift-negative" :
    "interactive-lift";

  
  
  return (
    <Card className={cn(
      "relative overflow-hidden bg-card border-border/50",
      hoverClass
    )}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={iconColor
              ? { backgroundColor: `${iconColor}1a`, color: iconColor }
              : undefined
            }
          >
            <Icon className={cn("h-5 w-5", !iconColor && "text-muted-foreground")} style={iconColor ? { color: iconColor } : undefined} />
          </div>
          
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              {title}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl font-heading font-bold text-foreground leading-tight tracking-tight">
                {value}
              </h3>
              {cleanChange && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-help",
                        changeType === "positive" && "text-success bg-success/10",
                        changeType === "negative" && "text-destructive bg-destructive/10",
                        changeType === "neutral" && "text-muted-foreground bg-muted/30"
                      )}>
                        {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
                        {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
                        <span>{cleanChange}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-center">
                      <p className="text-xs">
                        {changeType === "positive" 
                          ? "Crescimento" 
                          : changeType === "negative" 
                            ? "Queda" 
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
