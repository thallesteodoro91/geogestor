import { Card } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { month: "Jan", lucro: 120000, margem: 42 },
  { month: "Fev", lucro: 132000, margem: 43 },
  { month: "Mar", lucro: 123000, margem: 42 },
  { month: "Abr", lucro: 145000, margem: 43 },
  { month: "Mai", lucro: 157000, margem: 43 },
  { month: "Jun", lucro: 170000, margem: 44 },
];

export const ProfitMarginChart = () => {
  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50">
      <div className="space-y-1.5 mb-6">
        <h3 className="text-xl font-heading font-semibold text-foreground">Lucro e Margem</h3>
        <p className="text-sm text-muted-foreground/80">Lucro líquido e margem percentual ao longo do tempo</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            yAxisId="left"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => `${value}%`}
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
            formatter={(value: number, name: string) => {
              if (name === "margem") return [`${value}%`, "Margem"];
              return [`R$ ${value.toLocaleString('pt-BR')}`, "Lucro"];
            }}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="lucro"
            fill="hsl(262, 83%, 65%)"
            radius={[8, 8, 0, 0]}
            name="Lucro Líquido"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margem"
            stroke="hsl(189, 94%, 43%)"
            strokeWidth={3}
            dot={{ fill: "hsl(189, 94%, 43%)", r: 5 }}
            name="Margem %"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
};
