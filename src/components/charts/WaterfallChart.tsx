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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={processedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            />
            <Legend />
            <Bar dataKey="value" fill="hsl(var(--primary))" name="Valor">
              {processedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isTotal ? "hsl(var(--primary))" : entry.value > 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};