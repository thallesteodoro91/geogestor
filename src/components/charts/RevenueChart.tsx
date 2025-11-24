import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChartTitle } from "./ChartTitle";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data2023 = [
  { month: "Jan", receita: 245000, despesa: 145000 },
  { month: "Fev", receita: 270000, despesa: 158000 },
  { month: "Mar", receita: 255000, despesa: 152000 },
  { month: "Abr", receita: 290000, despesa: 175000 },
  { month: "Mai", receita: 315000, despesa: 188000 },
  { month: "Jun", receita: 340000, despesa: 200000 },
];

const data2024 = [
  { month: "Jan", receita: 285000, despesa: 165000 },
  { month: "Fev", receita: 310000, despesa: 178000 },
  { month: "Mar", receita: 295000, despesa: 172000 },
  { month: "Abr", receita: 340000, despesa: 195000 },
  { month: "Mai", receita: 365000, despesa: 208000 },
  { month: "Jun", receita: 390000, despesa: 220000 },
];

const data2025 = [
  { month: "Jan", receita: 325000, despesa: 185000 },
  { month: "Fev", receita: 350000, despesa: 198000 },
  { month: "Mar", receita: 335000, despesa: 192000 },
  { month: "Abr", receita: 380000, despesa: 215000 },
  { month: "Mai", receita: 405000, despesa: 228000 },
  { month: "Jun", receita: 430000, despesa: 240000 },
];

const dataByYear: Record<string, any[]> = {
  "2023": data2023,
  "2024": data2024,
  "2025": data2025,
};

export const RevenueChart = () => {
  const currentYearData = data2024;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader>
        <ChartTitle 
          title="Receita vs Despesa"
          description="Mostra a evolução mensal da receita e despesa, permitindo identificar tendências de crescimento e controle de custos."
          calculation="Receita Líquida = Receita Bruta − Impostos e Deduções | Crescimento (%) = ((Período Atual − Período Anterior) / Período Anterior) × 100"
        />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={currentYearData}>
          <defs>
            <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(262, 83%, 65%)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(262, 83%, 65%)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(189, 94%, 43%)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(189, 94%, 43%)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorReceitaPrev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(262, 83%, 65%)" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="hsl(262, 83%, 65%)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDespesaPrev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(189, 94%, 43%)" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="hsl(189, 94%, 43%)" stopOpacity={0}/>
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
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--primary))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
            formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="receita"
            stroke="hsl(262, 83%, 65%)"
            fill="url(#colorReceita)"
            strokeWidth={2.5}
            name="Receita"
          />
          <Area
            type="monotone"
            dataKey="despesa"
            stroke="hsl(189, 94%, 43%)"
            fill="url(#colorDespesa)"
            strokeWidth={2.5}
            name="Despesa"
          />
        </AreaChart>
      </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
