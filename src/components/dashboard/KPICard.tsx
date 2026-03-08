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
 * 
 * Storytelling com Dados:
 * - Cap. 3: Eliminate clutter — clean hierarchy: title → value → change
 * - Cap. 4: Use color ONLY on the change indicator to guide attention to what changed.
 *   The icon uses a muted background so it doesn't compete with the data.
 * - Cap. 5: Form follows function — the most important info (value) is largest.
 */
export const KPICard = ({ title, value, change, changeType = "neutral", icon: Icon }: KPICardProps) => {
  const cleanChange = change?.replace(/^[+-]\s*/, '');
  
  return (
    <Card className="relative overflow-hidden bg-card border-border/50 transition-all duration-200 hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Cap. 4: Icon in muted style — provides context without stealing attention */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          
          {/* Cap. 3: Clear hierarchy — title small, value dominant */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              {title}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl font-heading font-bold text-foreground leading-tight tracking-tight">
                {value}
              </h3>
              {/* Cap. 4: Color ONLY here — the change indicator is the actionable insight */}
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