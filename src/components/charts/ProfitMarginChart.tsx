import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChartTitle } from "./ChartTitle";
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
  const currentYearData = data2024;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader>
        <ChartTitle 
          title="Margens de Lucratividade"
          description="Acompanha a evolução das margens bruta e líquida ao longo do tempo. A margem bruta indica eficiência operacional; a líquida mostra rentabilidade final."
          calculation="Margem Bruta (%) = (Lucro Bruto / Receita Bruta) × 100 | Margem Líquida (%) = (Lucro Líquido / Receita Líquida) × 100"
        />
      </CardHeader>
      <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={currentYearData}>
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
        </ComposedChart>
      </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
