import { Card } from "@/components/ui/card";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { month: "Jan", margemBruta: 40, margemLiquida: 28 },
  { month: "Fev", margemBruta: 41, margemLiquida: 29 },
  { month: "Mar", margemBruta: 40, margemLiquida: 28 },
  { month: "Abr", margemBruta: 42, margemLiquida: 30 },
  { month: "Mai", margemBruta: 42, margemLiquida: 30 },
  { month: "Jun", margemBruta: 43, margemLiquida: 31 },
];

export const ProfitMarginChart = () => {
  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50">
      <div className="space-y-1.5 mb-6">
        <h3 className="text-xl font-heading font-semibold text-foreground">Margens de Lucratividade</h3>
        <p className="text-sm text-muted-foreground/80">Evolução das margens bruta e líquida ao longo do tempo</p>
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
            formatter={(value: number, name: string) => {
              if (name === "Margem Bruta") return [`${value}%`, "Margem Bruta"];
              if (name === "Margem Líquida") return [`${value}%`, "Margem Líquida"];
              return [`${value}%`, name];
            }}
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
    </Card>
  );
};
