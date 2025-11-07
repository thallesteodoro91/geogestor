import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelChartProps {
  data: Array<{
    stage: string;
    value: number;
    percentage: number;
  }>;
  title: string;
}

export const FunnelChart = ({ data, title }: FunnelChartProps) => {
  const maxValue = data[0]?.value || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((stage, index) => {
            const widthPercent = (stage.value / maxValue) * 100;
            return (
              <div key={index} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                  <span className="text-sm text-muted-foreground">{stage.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-lg overflow-hidden">
                  <div
                    className="h-12 bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold transition-all"
                    style={{ width: `${widthPercent}%` }}
                  >
                    {stage.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};