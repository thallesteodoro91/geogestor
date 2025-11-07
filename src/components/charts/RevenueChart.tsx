import { Card } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { month: "Jan", receita: 285000, despesa: 165000, lucro: 120000 },
  { month: "Fev", receita: 310000, despesa: 178000, lucro: 132000 },
  { month: "Mar", receita: 295000, despesa: 172000, lucro: 123000 },
  { month: "Abr", receita: 340000, despesa: 195000, lucro: 145000 },
  { month: "Mai", receita: 365000, despesa: 208000, lucro: 157000 },
  { month: "Jun", receita: 390000, despesa: 220000, lucro: 170000 },
];

export const RevenueChart = () => {
  return (
    <Card className="p-6">
      <div className="space-y-2 mb-6">
        <h3 className="text-lg font-heading font-semibold text-foreground">Receita vs Despesa</h3>
        <p className="text-sm text-muted-foreground">Evolução mensal do desempenho financeiro</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="receita"
            stroke="hsl(var(--primary))"
            fill="url(#colorReceita)"
            strokeWidth={2}
            name="Receita"
          />
          <Area
            type="monotone"
            dataKey="despesa"
            stroke="hsl(var(--destructive))"
            fill="url(#colorDespesa)"
            strokeWidth={2}
            name="Despesa"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};
