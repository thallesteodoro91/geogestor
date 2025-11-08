import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";

interface WaterfallChartProps {
  data: Array<{
    name: string;
    value: number;
    isTotal?: boolean;
  }>;
  title: string;
}

export const WaterfallChart = ({ data, title }: WaterfallChartProps) => {
  // Calcular posições acumuladas para efeito cascata
  const processedData = data.map((item, index) => {
    const previousTotal = data.slice(0, index).reduce((sum, d) => sum + d.value, 0);
    return {
      ...item,
      start: item.isTotal ? 0 : previousTotal,
      end: item.isTotal ? item.value : previousTotal + item.value,
    };
  });

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-xl font-heading">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={processedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
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
              formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
            />
            <Legend />
            <Bar dataKey="value" fill="hsl(262, 83%, 65%)" name="Valor">
              {processedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isTotal ? "hsl(262, 83%, 65%)" : entry.value > 0 ? "hsl(142, 76%, 56%)" : "hsl(0, 72%, 51%)"} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};