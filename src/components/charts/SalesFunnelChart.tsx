/**
 * Sales Funnel Chart Component
 * Visualizes budget conversion from total to approved
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { useSalesFunnel, FunnelStage } from "@/hooks/useSalesFunnel";
import {
  FunnelChart,
  Funnel,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: FunnelStage }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="font-semibold text-foreground mb-2">{data.name}</p>
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{data.value}</span> orçamentos
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{data.percentage.toFixed(1)}%</span> do total
        </p>
        {data.conversionRate !== null && (
          <p className="text-muted-foreground border-t pt-1 mt-1">
            Taxa de conversão:{" "}
            <span className="font-medium text-success">{data.conversionRate.toFixed(1)}%</span>
          </p>
        )}
      </div>
    </div>
  );
};

export const SalesFunnelChart = () => {
  const { density } = useChartSettings();
  const { data, isLoading } = useSalesFunnel();

  const cardPadding = density === "compact" ? "p-4" : "p-6";
  const chartHeight = density === "compact" ? 250 : 300;

  if (isLoading) {
    return (
      <Card className="interactive-lift" role="region" aria-labelledby="funnel-title">
        <CardHeader>
          <CardTitle id="funnel-title">Funil de Vendas</CardTitle>
          <CardDescription>Conversão de orçamentos</CardDescription>
        </CardHeader>
        <CardContent className={cardPadding}>
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <p className="text-muted-foreground">Carregando...</p>
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
        <CardContent className={cardPadding}>
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <p className="text-muted-foreground">Nenhum orçamento encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="interactive-lift" role="region" aria-labelledby="funnel-title">
      <CardHeader>
        <CardTitle id="funnel-title">Funil de Vendas</CardTitle>
        <CardDescription>
          {data.aprovados} de {data.total} orçamentos aprovados ({((data.aprovados / data.total) * 100).toFixed(0)}%)
        </CardDescription>
      </CardHeader>
      <CardContent className={cardPadding}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <FunnelChart>
            <Tooltip content={<CustomTooltip />} />
            <Funnel
              data={data.stages}
              dataKey="value"
              nameKey="name"
              isAnimationActive
            >
              {data.stages.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                position="right"
                fill="hsl(var(--foreground))"
                stroke="none"
                dataKey="name"
                fontSize={12}
              />
              <LabelList
                position="center"
                fill="#fff"
                stroke="none"
                dataKey="value"
                fontSize={14}
                fontWeight="bold"
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
