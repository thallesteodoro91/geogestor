/**
 * Profit Margin Evolution Chart
 * 
 * Storytelling com Dados:
 * - Cap. 2: Line chart for continuous time series
 * - Cap. 3: Remove dots on every point (clutter) — only show on hover
 * - Cap. 4: Two intentional colors — primary for gross, secondary for net. 
 *   Comparison lines muted.
 * - Cap. 7: Narrative subtitle guides interpretation
 */

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { RichTooltip } from "./RichTooltip";
import { useProfitMarginChartData } from "@/hooks/useChartData";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ProfitMarginChart = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data, isLoading } = useProfitMarginChartData(selectedYear);
  const { data: compareData } = useProfitMarginChartData(compareYear || undefined);

  if (isLoading || yearsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução das Margens</CardTitle>
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
      margemBrutaCompare: compareItem?.margemBruta || 0,
      margemLiquidaCompare: compareItem?.margemLiquida || 0,
    };
  });
  
  const hasData = filteredData.some(d => d.margemBruta > 0 || d.margemLiquida > 0);
  const compareYears = (availableYears || []).filter(y => y !== selectedYear);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-heading font-semibold">Evolução das Margens</CardTitle>
          <CardDescription className="text-sm">
            Margem bruta vs líquida — a diferença revela o peso das despesas fixas
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
            <p>Sem dados de margem para {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              {/* Cap. 3: Minimal grid */}
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
                tickFormatter={(value) => `${value}%`}
                domain={[-20, 100]}
              />
              {/* Cap. 4: Reference line at 0% to anchor interpretation */}
              <ReferenceLine 
                y={0} 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={1}
                opacity={0.5}
              />
              <Tooltip
                content={<RichTooltip format="percent" showDifference differenceLabel="Diferença" />}
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              {/* Cap. 4: Two clear colors — emerald for gross (healthier), indigo for net */}
              <Line
                type="monotone"
                dataKey="margemBruta"
                stroke="hsl(var(--chart-positive))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-positive))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={`Margem Bruta ${selectedYear}`}
              />
              <Line
                type="monotone"
                dataKey="margemLiquida"
                stroke="hsl(var(--chart-primary))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={`Margem Líquida ${selectedYear}`}
              />
              {/* Comparison — de-emphasized (Cap. 4) */}
              {compareYear && (
                <>
                  <Line
                    type="monotone"
                    dataKey="margemBrutaCompare"
                    stroke="hsl(var(--chart-positive))"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.4}
                    dot={false}
                    name={`Margem Bruta ${compareYear}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemLiquidaCompare"
                    stroke="hsl(var(--chart-primary))"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.4}
                    dot={false}
                    name={`Margem Líquida ${compareYear}`}
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