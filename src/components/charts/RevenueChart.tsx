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
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data, isLoading } = useRevenueChartData(selectedYear);
  const { data: compareData } = useRevenueChartData(compareYear || undefined);

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
  
  // Merge comparison data if selected
  const mergedData = filteredData.map((item, index) => {
    const compareItem = compareYear && compareData ? compareData[index] : null;
    return {
      ...item,
      receitaCompare: compareItem?.receita || 0,
      despesaCompare: compareItem?.despesa || 0,
    };
  });
  
  // If no data, show placeholder
  const hasData = filteredData.some(d => d.receita > 0 || d.despesa > 0);

  // Available years for comparison (exclude selected year)
  const compareYears = (availableYears || []).filter(y => y !== selectedYear);

  return (
    <Card className="interactive-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Receita vs Despesa</CardTitle>
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
            <p>Sem dados financeiros para exibir em {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mergedData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorReceitaCompare" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDespesaCompare" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(280, 70%, 50%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(280, 70%, 50%)" stopOpacity={0}/>
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
                stroke="hsl(142, 76%, 36%)"
                fill="url(#colorReceita)"
                strokeWidth={2.5}
                name={`Receita ${selectedYear}`}
              />
              <Area
                type="monotone"
                dataKey="despesa"
                stroke="hsl(0, 72%, 51%)"
                fill="url(#colorDespesa)"
                strokeWidth={2.5}
                name={`Despesa ${selectedYear}`}
              />
              {compareYear && (
                <>
                  <Area
                    type="monotone"
                    dataKey="receitaCompare"
                    stroke="hsl(217, 91%, 60%)"
                    fill="url(#colorReceitaCompare)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name={`Receita ${compareYear}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesaCompare"
                    stroke="hsl(280, 70%, 50%)"
                    fill="url(#colorDespesaCompare)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name={`Despesa ${compareYear}`}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
