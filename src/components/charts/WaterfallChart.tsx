import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartTitle } from "./ChartTitle";
import { RichTooltip } from "./RichTooltip";
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
        <ChartTitle 
          title={title}
          description="Visualiza o fluxo acumulado de valores ao longo do tempo, mostrando como entradas e saídas afetam o saldo final."
          calculation="Saldo Final = Saldo Inicial + Entradas − Saídas | Fluxo de Caixa Operacional = Recebimentos − Pagamentos"
        />
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
              content={<RichTooltip format="currency" showVariation={false} />}
              cursor={{ fill: 'hsl(var(--primary) / 0.15)', radius: 4 }}
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