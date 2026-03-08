/**
 * Revenue Trend Chart — Composed (Bar + Line)
 * 
 * Storytelling com Dados:
 * - Cap. 2: ComposedChart (bars for volume, line for trend) is effective when 
 *   showing two related but different metrics on same time axis
 * - Cap. 3: Remove excessive decorations — no gradient fills, clean grid
 * - Cap. 4: Two intentional colors only. Bars in muted primary, line in accent.
 * - Cap. 7: Title and subtitle guide the narrative
 */

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

  const filteredData = chartData?.filter((_, index) => {
    if (selectedYear === currentYear) {
      return index <= new Date().getMonth();
    }
    return true;
  }) || [];

  const hasData = filteredData.some(d => d.receitaBruta > 0 || d.lucroLiquido !== 0);

  // Cap. 4: Strategic color — muted bar for context, vivid line for the key metric
  const barColor = colorblindMode 
    ? "hsl(220, 70%, 50%)"
    : "hsl(var(--chart-primary))";
  
  const lineColor = colorblindMode 
    ? "hsl(45, 90%, 50%)"
    : "hsl(var(--chart-positive))";

  const chartHeight = density === 'compact' ? 280 : 350;

  return (
    <Card role="region" aria-labelledby="revenue-trend-title">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle id="revenue-trend-title" className="text-lg font-heading font-semibold">
            Evolução Receita e Lucro
          </CardTitle>
          <CardDescription>
            Receita bruta (barras) vs lucro líquido (linha) — meses com linha abaixo de zero indicam prejuízo
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
            <ComposedChart data={filteredData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
              {/* Cap. 3: Minimal grid — horizontal only */}
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
                opacity={0.3}
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
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              {/* Cap. 4: Bar in semi-transparent primary — provides volume context without dominating */}
              <Bar
                dataKey="receitaBruta"
                name="Receita Bruta"
                fill={barColor}
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              {/* Cap. 4: Line in vivid accent — the key story is profit trend */}
              <Line
                type="monotone"
                dataKey="lucroLiquido"
                name="Lucro Líquido"
                stroke={lineColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ 
                  r: 6, 
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