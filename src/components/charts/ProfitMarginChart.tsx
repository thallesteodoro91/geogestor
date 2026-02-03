import { useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RichTooltip } from "./RichTooltip";
import { useProfitMarginChartData } from "@/hooks/useChartData";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ProfitMarginChart = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data, isLoading } = useProfitMarginChartData(selectedYear);

  if (isLoading || yearsLoading) {
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

  // Filter to only show months with data or up to current month (only for current year)
  const currentMonth = new Date().getMonth();
  const filteredData = selectedYear === currentYear 
    ? (data || []).slice(0, currentMonth + 1)
    : (data || []);
  
  // If no data, show placeholder
  const hasData = filteredData.some(d => d.margemBruta > 0 || d.margemLiquida > 0);

  return (
    <Card className="interactive-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Evolução das Margens</CardTitle>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(availableYears || [currentYear]).map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>Sem dados de margem para exibir em {selectedYear}</p>
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
                content={<RichTooltip format="percent" showDifference differenceLabel="Diferença" />}
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
