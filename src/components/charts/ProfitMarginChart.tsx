import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RichTooltip } from "./RichTooltip";
import { useProfitMarginChartData } from "@/hooks/useChartData";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const ProfitMarginChart = () => {
  const currentYear = new Date().getFullYear();
  const { data, isLoading } = useProfitMarginChartData(currentYear);

  if (isLoading) {
    return (
      <Card className="interactive-lift">
        <CardHeader>
          <CardTitle className="text-lg">Evolução das Margens</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Filter to only show months with data or up to current month
  const currentMonth = new Date().getMonth();
  const filteredData = (data || []).slice(0, currentMonth + 1);
  
  // If no data, show placeholder
  const hasData = filteredData.some(d => d.margemBruta > 0 || d.margemLiquida > 0);

  return (
    <Card className="interactive-lift">
      <CardHeader>
        <CardTitle className="text-lg">Evolução das Margens ({currentYear})</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>Sem dados de margem para exibir neste período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip
                content={<RichTooltip format="percent" showVariation={false} />}
                cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="margemBruta"
                stroke="hsl(var(--chart-primary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--chart-primary))", r: 5 }}
                name="Margem Bruta"
              />
              <Line
                type="monotone"
                dataKey="margemLiquida"
                stroke="hsl(var(--chart-secondary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--chart-secondary))", r: 5 }}
                name="Margem Líquida"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
