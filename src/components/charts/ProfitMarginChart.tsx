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
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data, isLoading } = useProfitMarginChartData(selectedYear);
  const { data: compareData, isLoading: compareLoading } = useProfitMarginChartData(compareYear || undefined);

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
  
  // Merge comparison data if selected
  const mergedData = filteredData.map((item, index) => {
    const compareItem = compareYear && compareData ? compareData[index] : null;
    return {
      ...item,
      margemBrutaCompare: compareItem?.margemBruta || 0,
      margemLiquidaCompare: compareItem?.margemLiquida || 0,
    };
  });
  
  // If no data, show placeholder
  const hasData = filteredData.some(d => d.margemBruta > 0 || d.margemLiquida > 0);

  // Available years for comparison (exclude selected year)
  const compareYears = (availableYears || []).filter(y => y !== selectedYear);

  return (
    <Card className="interactive-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Evolução das Margens</CardTitle>
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
            <p>Sem dados de margem para exibir em {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={mergedData}>
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
                domain={[-20, 100]}
              />
              <Tooltip
                content={<RichTooltip format="percent" showDifference differenceLabel="Diferença" />}
                cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
              />
              <Legend />
              {/* Current year lines - solid */}
              <Line
                type="monotone"
                dataKey="margemBruta"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={3}
                dot={{ fill: "hsl(142, 76%, 36%)", r: 5 }}
                name={`Margem Bruta ${selectedYear}`}
              />
              <Line
                type="monotone"
                dataKey="margemLiquida"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={3}
                dot={{ fill: "hsl(217, 91%, 60%)", r: 5 }}
                name={`Margem Líquida ${selectedYear}`}
              />
              {/* Comparison year lines - dashed */}
              {compareYear && (
                <>
                  <Line
                    type="monotone"
                    dataKey="margemBrutaCompare"
                    stroke="hsl(48, 96%, 53%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(48, 96%, 53%)", r: 4 }}
                    name={`Margem Bruta ${compareYear}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemLiquidaCompare"
                    stroke="hsl(280, 70%, 50%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(280, 70%, 50%)", r: 4 }}
                    name={`Margem Líquida ${compareYear}`}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
