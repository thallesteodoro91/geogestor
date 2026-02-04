import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTooltip } from "./RichTooltip";
import { useRevenueTrendChartData } from "@/hooks/useChartData";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function RevenueTrendChart() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const { data: availableYears = [currentYear], isLoading: yearsLoading } = useAvailableYears();
  const { data: chartData, isLoading: dataLoading } = useRevenueTrendChartData(selectedYear);
  const { density, colorblindMode } = useChartSettings();

  const isLoading = yearsLoading || dataLoading;

  // Filter data to only show months up to current month if viewing current year
  const filteredData = chartData?.filter((_, index) => {
    if (selectedYear === currentYear) {
      return index <= new Date().getMonth();
    }
    return true;
  }) || [];

  const hasData = filteredData.some(d => d.receitaBruta > 0 || d.lucroLiquido !== 0);

  // Colors based on colorblind mode
  const barColor = colorblindMode 
    ? "hsl(220, 70%, 50%)" // Blue for colorblind
    : "hsl(var(--chart-primary))";
  
  const lineColor = colorblindMode 
    ? "hsl(45, 90%, 50%)" // Gold/Yellow for colorblind
    : "hsl(var(--chart-positive))";

  const chartHeight = density === 'compact' ? 280 : 350;

  return (
    <Card className="interactive-lift" role="region" aria-labelledby="revenue-trend-title">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle id="revenue-trend-title" className="text-lg font-semibold">
            Evolução Receita e Lucro
          </CardTitle>
          <CardDescription>
            Receita Bruta (barras) vs Lucro Líquido (linha) mensal
          </CardDescription>
        </div>
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => setSelectedYear(Number(value))}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[100px]" aria-label="Selecionar ano">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : !hasData ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Sem dados para {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={barColor} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={barColor} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false} 
              />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={<RichTooltip format="currency" showDifference differenceLabel="Margem" />}
                cursor={{ fill: 'hsl(var(--primary) / 0.1)', radius: 4 }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 16 }}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
              <Bar
                dataKey="receitaBruta"
                name="Receita Bruta"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
              <Line
                type="monotone"
                dataKey="lucroLiquido"
                name="Lucro Líquido"
                stroke={lineColor}
                strokeWidth={3}
                dot={{ 
                  r: 5, 
                  fill: lineColor, 
                  stroke: "hsl(var(--background))", 
                  strokeWidth: 2 
                }}
                activeDot={{ 
                  r: 7, 
                  fill: lineColor, 
                  stroke: "hsl(var(--background))", 
                  strokeWidth: 2 
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
