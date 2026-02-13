/**
 * Sales Funnel Chart — custom horizontal bar visualization
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { useSalesFunnel } from "@/hooks/useSalesFunnel";
import { ArrowDown, FileX2 } from "lucide-react";

export const SalesFunnelChart = () => {
  const { density } = useChartSettings();
  const { data, isLoading } = useSalesFunnel();

  const compact = density === "compact";

  if (isLoading) {
    return (
      <Card className="interactive-lift" role="region" aria-labelledby="funnel-title">
        <CardHeader>
          <CardTitle id="funnel-title">Funil de Vendas</CardTitle>
          <CardDescription>Conversão de orçamentos</CardDescription>
        </CardHeader>
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="space-y-5">
            {[100, 72, 48, 28].map((w, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-12 rounded-lg" style={{ width: `${w}%` }} />
                {i < 3 && <Skeleton className="h-5 w-14 rounded-full mt-1" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="interactive-lift" role="region" aria-labelledby="funnel-title">
        <CardHeader>
          <CardTitle id="funnel-title">Funil de Vendas</CardTitle>
          <CardDescription>Conversão de orçamentos</CardDescription>
        </CardHeader>
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <FileX2 className="h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum orçamento encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = data.stages[0]?.value || 1;

  return (
    <Card className="interactive-lift" role="region" aria-labelledby="funnel-title">
      <CardHeader>
        <CardTitle id="funnel-title">Funil de Vendas</CardTitle>
        <CardDescription>
          {data.aprovados} de {data.total} aprovados ({((data.aprovados / data.total) * 100).toFixed(0)}%)
          {data.recusados > 0 && (
            <span className="ml-2 text-destructive/70">· {data.recusados} recusados</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="space-y-1">
          {data.stages.map((stage, index) => {
            const widthPercent = Math.max((stage.value / maxValue) * 100, 8);
            const isLast = index === data.stages.length - 1;

            return (
              <div key={stage.name}>
                {/* Bar */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-center">
                    <div
                      className="relative h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-500 ease-out group cursor-default"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: stage.fill,
                        minWidth: "120px",
                      }}
                    >
                      <span className="text-white text-xs font-medium truncate">
                        {stage.name}
                      </span>
                      <span className="text-white text-sm font-bold tabular-nums whitespace-nowrap ml-2">
                        {stage.value}
                        <span className="text-white/70 text-xs font-normal ml-1">
                          ({stage.percentage.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversion arrow */}
                {!isLast && stage.conversionRate !== null && (
                  <div className="flex items-center justify-center gap-1.5 py-1 text-muted-foreground/60">
                    <ArrowDown className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium tabular-nums">
                      {stage.conversionRate.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
