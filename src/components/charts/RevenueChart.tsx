import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RichTooltip } from "./RichTooltip";
import { useRevenueChartData } from "@/hooks/useChartData";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const RevenueChart = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data, isLoading } = useRevenueChartData(selectedYear);

  if (isLoading || yearsLoading) {
    return (
      <Card className="interactive-lift">
        <CardHeader>
          <CardTitle className="text-lg">Receita vs Despesa</CardTitle>
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
  const hasData = filteredData.some(d => d.receita > 0 || d.despesa > 0);

  return (
    <Card className="interactive-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Receita vs Despesa</CardTitle>
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
            <p>Sem dados financeiros para exibir em {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-positive))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-positive))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-negative))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-negative))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => {
                  if (value === 0) return 'R$ 0';
                  return `R$ ${(value / 1000).toFixed(0)}k`;
                }}
              />
              <Tooltip
                content={<RichTooltip format="currency" showDifference differenceLabel="Lucro" />}
                cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="hsl(var(--chart-positive))"
                fill="url(#colorReceita)"
                strokeWidth={2.5}
                name="Receita"
              />
              <Area
                type="monotone"
                dataKey="despesa"
                stroke="hsl(var(--chart-negative))"
                fill="url(#colorDespesa)"
                strokeWidth={2.5}
                name="Despesa"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
