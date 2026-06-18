import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export type IconTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral" | "accent";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  /** Semantic icon tone — preferred over iconColor */
  iconTone?: IconTone;
  /** @deprecated Use iconTone instead. Hex strings are mapped to nearest tone. */
  iconColor?: string;
  /** Description shown in the info tooltip */
  description?: string;
  /** Calculation formula shown in the info tooltip */
  calculation?: string;
  /** Chave do catálogo central de tooltips (preferida sobre description). */
  tooltipKey?: string;
  /** Optional warning message — shows an amber alert badge with tooltip */
  warning?: string;
}

/** Semantic-token icon background+text classes (theme & dark-mode aware) */
const TONE_CLASSES: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  accent: "bg-accent/10 text-accent",
  neutral: "bg-muted text-muted-foreground",
};

/** Map legacy hex iconColor → nearest semantic tone (back-compat) */
function hexToTone(hex: string): IconTone {
  const h = hex.toLowerCase().replace(/\s/g, "");
  // Greens
  if (["#10b981", "#22c55e", "#14b8a6", "#16a34a", "#059669"].includes(h)) return "success";
  // Reds / rose
  if (["#f43f5e", "#ef4444", "#dc2626", "#e11d48"].includes(h)) return "danger";
  // Amber / yellow
  if (["#f59e0b", "#eab308", "#facc15", "#fbbf24"].includes(h)) return "warning";
  // Blues / cyan
  if (["#3b82f6", "#2563eb", "#06b6d4", "#0891b2", "#0284c7"].includes(h)) return "info";
  // Purples / indigos
  if (["#6366f1", "#8b5cf6", "#a855f7", "#7c3aed", "#4f46e5"].includes(h)) return "primary";
  // Slate / gray
  if (["#64748b", "#475569", "#94a3b8", "#6b7280"].includes(h)) return "neutral";
  return "primary";
}

export const KPICard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconTone,
  iconColor,
  description,
  calculation,
  warning,
}: KPICardProps) => {
  const cleanChange = change?.replace(/^[+-]\s*/, '');

  const hoverClass =
    changeType === "positive" ? "interactive-lift-positive" :
    changeType === "negative" ? "interactive-lift-negative" :
    "interactive-lift";

  // Resolve tone: explicit iconTone wins; else map hex; else default primary
  const resolvedTone: IconTone = iconTone ?? (iconColor ? hexToTone(iconColor) : "primary");

  return (
    <Card className={cn(
      "relative overflow-hidden bg-card border-border/50",
      hoverClass
    )}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              TONE_CLASSES[resolvedTone]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                {title}
              </p>
              {description && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help hover:text-primary transition-colors shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      <div className="space-y-1.5">
                        <p className="text-xs text-popover-foreground">{description}</p>
                        {calculation && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold">Cálculo:</span> {calculation}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl font-heading font-bold text-foreground leading-tight tracking-tight">
                {value}
              </h3>
              {warning && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-help bg-warning/15 text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Atenção</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      <p className="text-xs">{warning}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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
