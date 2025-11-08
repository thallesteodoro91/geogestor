import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChartTitle } from "./ChartTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data2023 = [
  { month: "Jan", margemBruta: 38, margemLiquida: 26 },
  { month: "Fev", margemBruta: 39, margemLiquida: 27 },
  { month: "Mar", margemBruta: 38, margemLiquida: 26 },
  { month: "Abr", margemBruta: 40, margemLiquida: 28 },
  { month: "Mai", margemBruta: 40, margemLiquida: 28 },
  { month: "Jun", margemBruta: 41, margemLiquida: 29 },
];

const data2024 = [
  { month: "Jan", margemBruta: 40, margemLiquida: 28 },
  { month: "Fev", margemBruta: 41, margemLiquida: 29 },
  { month: "Mar", margemBruta: 40, margemLiquida: 28 },
  { month: "Abr", margemBruta: 42, margemLiquida: 30 },
  { month: "Mai", margemBruta: 42, margemLiquida: 30 },
  { month: "Jun", margemBruta: 43, margemLiquida: 31 },
];

const data2025 = [
  { month: "Jan", margemBruta: 42, margemLiquida: 30 },
  { month: "Fev", margemBruta: 43, margemLiquida: 31 },
  { month: "Mar", margemBruta: 42, margemLiquida: 30 },
  { month: "Abr", margemBruta: 44, margemLiquida: 32 },
  { month: "Mai", margemBruta: 44, margemLiquida: 32 },
  { month: "Jun", margemBruta: 45, margemLiquida: 33 },
];

const dataByYear: Record<string, any[]> = {
  "2023": data2023,
  "2024": data2024,
  "2025": data2025,
};

export const ProfitMarginChart = () => {
  const [selectedYear, setSelectedYear] = useState("2024");
  const [compareYears, setCompareYears] = useState(false);

  const currentYearData = dataByYear[selectedYear];
  const previousYear = (parseInt(selectedYear) - 1).toString();
  const previousYearData = dataByYear[previousYear];

  const combinedData = compareYears && previousYearData
    ? currentYearData.map((item, index) => ({
        month: item.month,
        [`margemBruta${selectedYear}`]: item.margemBruta,
        [`margemLiquida${selectedYear}`]: item.margemLiquida,
        [`margemBruta${previousYear}`]: previousYearData[index]?.margemBruta,
        [`margemLiquida${previousYear}`]: previousYearData[index]?.margemLiquida,
      }))
    : currentYearData;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader className="space-y-4">
        <ChartTitle 
          title="Margens de Lucratividade"
          description="Acompanha a evolução das margens bruta e líquida ao longo do tempo. A margem bruta indica eficiência operacional; a líquida mostra rentabilidade final."
          calculation="Margem Bruta (%) = (Lucro Bruto / Receita Bruta) × 100 | Margem Líquida (%) = (Lucro Líquido / Receita Líquida) × 100"
        />
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="margin-year-select" className="text-sm text-muted-foreground">Ano:</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="margin-year-select" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {previousYearData && (
            <div className="flex items-center gap-2">
              <Switch 
                id="compare-margin-years" 
                checked={compareYears}
                onCheckedChange={setCompareYears}
              />
              <Label htmlFor="compare-margin-years" className="text-sm text-muted-foreground cursor-pointer">
                Comparar com {previousYear}
              </Label>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={combinedData}>
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
            domain={[0, 50]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--primary))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
            cursor={{ fill: "hsl(var(--accent))", opacity: 0.1 }}
            formatter={(value: number) => [`${value}%`, '']}
          />
          <Legend />
          {!compareYears ? (
            <>
              <Line
                type="monotone"
                dataKey="margemBruta"
                stroke="hsl(262, 83%, 65%)"
                strokeWidth={3}
                dot={{ fill: "hsl(262, 83%, 65%)", r: 5 }}
                name="Margem Bruta"
              />
              <Line
                type="monotone"
                dataKey="margemLiquida"
                stroke="hsl(189, 94%, 43%)"
                strokeWidth={3}
                dot={{ fill: "hsl(189, 94%, 43%)", r: 5 }}
                name="Margem Líquida"
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey={`margemBruta${selectedYear}`}
                stroke="hsl(262, 83%, 65%)"
                strokeWidth={3}
                dot={{ fill: "hsl(262, 83%, 65%)", r: 5 }}
                name={`Margem Bruta ${selectedYear}`}
              />
              <Line
                type="monotone"
                dataKey={`margemLiquida${selectedYear}`}
                stroke="hsl(189, 94%, 43%)"
                strokeWidth={3}
                dot={{ fill: "hsl(189, 94%, 43%)", r: 5 }}
                name={`Margem Líquida ${selectedYear}`}
              />
              <Line
                type="monotone"
                dataKey={`margemBruta${previousYear}`}
                stroke="hsl(262, 83%, 65%)"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(262, 83%, 65%)", r: 4, opacity: 0.7 }}
                name={`Margem Bruta ${previousYear}`}
              />
              <Line
                type="monotone"
                dataKey={`margemLiquida${previousYear}`}
                stroke="hsl(189, 94%, 43%)"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(189, 94%, 43%)", r: 4, opacity: 0.7 }}
                name={`Margem Líquida ${previousYear}`}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
