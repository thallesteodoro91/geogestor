import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GaugeChartProps {
  value: number;
  max: number;
  title: string;
  subtitle?: string;
  description?: string;
}

export const GaugeChart = ({ value, max, title, subtitle, description = "Indica o quanto da meta foi atingido. Valores acima de 80% são considerados ótimos, entre 50-80% são moderados, e abaixo de 50% requerem atenção." }: GaugeChartProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage / 100) * 180 - 90;

  const getColor = () => {
    if (percentage >= 80) return "text-success";
    if (percentage >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-heading">{title}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[250px]">
                <p className="text-sm">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2">
        <div className="relative w-48 h-28 mb-4">
          {/* Arco de fundo */}
          <svg className="w-full h-full" viewBox="0 0 200 110" preserveAspectRatio="xMidYMid meet">
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="18"
              strokeLinecap="round"
            />
            {/* Arco de progresso */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
            />
            {/* Ponteiro */}
            <line
              x1="100"
              y1="90"
              x2="100"
              y2="30"
              stroke="hsl(var(--accent-foreground))"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${rotation} 100 90)`}
            />
            <circle cx="100" cy="90" r="5" fill="hsl(var(--accent-foreground))" />
          </svg>
        </div>
        <div className="text-center">
          <p className={`text-3xl font-heading font-bold ${getColor()}`}>
            {value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-muted-foreground/80">
            {percentage.toFixed(1)}% de {max}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
};