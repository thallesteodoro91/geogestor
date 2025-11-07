import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GaugeChartProps {
  value: number;
  max: number;
  title: string;
  subtitle?: string;
}

export const GaugeChart = ({ value, max, title, subtitle }: GaugeChartProps) => {
  const percentage = (value / max) * 100;
  const rotation = (percentage / 100) * 180 - 90;

  const getColor = () => {
    if (percentage >= 80) return "text-success";
    if (percentage >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative w-48 h-24 mb-4">
          {/* Arco de fundo */}
          <svg className="w-full h-full" viewBox="0 0 200 100">
            <path
              d="M 20 80 A 80 80 0 0 1 180 80"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="20"
              strokeLinecap="round"
            />
            {/* Arco de progresso */}
            <path
              d="M 20 80 A 80 80 0 0 1 180 80"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
            />
            {/* Ponteiro */}
            <line
              x1="100"
              y1="80"
              x2="100"
              y2="20"
              stroke="hsl(var(--foreground))"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${rotation} 100 80)`}
            />
            <circle cx="100" cy="80" r="5" fill="hsl(var(--foreground))" />
          </svg>
        </div>
        <div className="text-center">
          <p className={`text-3xl font-heading font-bold ${getColor()}`}>
            {value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-muted-foreground">
            {percentage.toFixed(1)}% de {max}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
};