/**
 * Revenue vs Expense Chart
 * 
 * Storytelling com Dados:
 * - Cap. 2: Line chart for continuous time series data (not area — overlapping areas obscure data)
 * - Cap. 3: Remove clutter — no gradients fills, minimal grid, clean axes
 * - Cap. 4: Strategic color — green=revenue (positive), red=expense (cost). 
 *   Muted comparison lines with dashes.
 * - Cap. 7: Action-oriented title that tells the story
 */

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RichTooltip } from "./RichTooltip";
import { useRevenueChartData } from "@/hooks/useChartData";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const RevenueChart = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data, isLoading } = useRevenueChartData(selectedYear);
  const { data: compareData } = useRevenueChartData(compareYear || undefined);

  if (isLoading || yearsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receita vs Despesa</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const currentMonth = new Date().getMonth();
  const filteredData = selectedYear === currentYear 
    ? (data || []).slice(0, currentMonth + 1)
    : (data || []);
  
  const mergedData = filteredData.map((item, index) => {
    const compareItem = compareYear && compareData ? compareData[index] : null;
    return {
      ...item,
      receitaCompare: compareItem?.receita || 0,
      despesaCompare: compareItem?.despesa || 0,
    };
  });
  
  const hasData = filteredData.some(d => d.receita > 0 || d.despesa > 0);
  const compareYears = (availableYears || []).filter(y => y !== selectedYear);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          {/* Cap. 7: Title tells the story, subtitle adds context */}
          <CardTitle className="text-lg font-heading font-semibold">Receita vs Despesa</CardTitle>
          <CardDescription className="text-sm">
            Evolução mensal — identifique meses onde despesas superam a receita
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
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
          <Select 
            value={compareYear?.toString() || "none"} 
            onValueChange={(v) => setCompareYear(v === "none" ? null : Number(v))}
          >
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue placeholder="Comparar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem comparar</SelectItem>
              {compareYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  vs {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>Sem dados financeiros para {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {/* Cap. 2: Line chart for time series — clean and direct */}
            <LineChart data={mergedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              {/* Cap. 3: Minimal grid — horizontal only, very light */}
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.3} 
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
                tickFormatter={(value) => {
                  if (value === 0) return 'R$ 0';
                  return `R$ ${(value / 1000).toFixed(0)}k`;
                }}
              />
              <Tooltip
                content={<RichTooltip format="currency" showDifference differenceLabel="Lucro" />}
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              {/* Cap. 4: Strategic color — green for revenue (good), red for expense (cost) */}
              <Line
                type="monotone"
                dataKey="receita"
                stroke="hsl(var(--chart-positive))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-positive))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={`Receita ${selectedYear}`}
              />
              <Line
                type="monotone"
                dataKey="despesa"
                stroke="hsl(var(--chart-negative))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-negative))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={`Despesa ${selectedYear}`}
              />
              {/* Comparison lines — muted and dashed (Cap. 4: de-emphasize secondary info) */}
              {compareYear && (
                <>
                  <Line
                    type="monotone"
                    dataKey="receitaCompare"
                    stroke="hsl(var(--chart-positive))"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.4}
                    dot={false}
                    name={`Receita ${compareYear}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="despesaCompare"
                    stroke="hsl(var(--chart-negative))"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.4}
                    dot={false}
                    name={`Despesa ${compareYear}`}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};