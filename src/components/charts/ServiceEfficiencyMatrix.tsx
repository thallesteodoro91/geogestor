/**
 * Service Efficiency Matrix
 * ScatterChart estratégico que posiciona serviços em 4 quadrantes
 * baseado em Receita Total (X) vs Margem de Lucro % (Y)
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServicePoint {
  servico: string;
  receita: number;
  margem: number;
}

interface ServiceEfficiencyMatrixProps {
  data: ServicePoint[];
  isLoading?: boolean;
}

// Determina a cor do ponto baseado no quadrante
const getQuadrantInfo = (
  receita: number,
  margem: number,
  medReceita: number,
  medMargem: number
): { color: string; label: string; description: string } => {
  if (receita >= medReceita && margem >= medMargem) {
    return {
      color: "hsl(var(--chart-positive))",
      label: "Estrela",
      description: "Alta receita + Alta margem → Prioridade máxima",
    };
  }
  if (receita < medReceita && margem >= medMargem) {
    return {
      color: "hsl(var(--chart-primary))",
      label: "Nicho",
      description: "Baixa receita + Alta margem → Explorar crescimento",
    };
  }
  if (receita < medReceita && margem < medMargem) {
    return {
      color: "hsl(var(--chart-negative))",
      label: "Rever",
      description: "Baixa receita + Baixa margem → Avaliar descontinuação",
    };
  }
  return {
    color: "hsl(var(--chart-warning))",
    label: "Volume",
    description: "Alta receita + Baixa margem → Otimizar custos",
  };
};

// Calcula a mediana de um array de números
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Tooltip customizado para o ScatterChart
const CustomTooltip = ({
  active,
  payload,
  medReceita,
  medMargem,
}: {
  active?: boolean;
  payload?: Array<{ payload: ServicePoint }>;
  medReceita: number;
  medMargem: number;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const quadrant = getQuadrantInfo(point.receita, point.margem, medReceita, medMargem);

  return (
    <div className="rounded-xl border-2 p-4 shadow-2xl min-w-[220px] bg-gradient-to-br from-card via-card to-background/95 border-primary/30 backdrop-blur-md">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: quadrant.color }} />
      <div className="pl-2">
        <p className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/30">
          {point.servico}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Receita</span>
            <span className="text-sm font-bold text-foreground">
              R$ {point.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Margem</span>
            <span className="text-sm font-bold text-foreground">{point.margem.toFixed(1)}%</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: quadrant.color }}
            />
            <span className="text-sm font-medium" style={{ color: quadrant.color }}>
              {quadrant.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{quadrant.description}</p>
        </div>
      </div>
    </div>
  );
};

export const ServiceEfficiencyMatrix = ({ data, isLoading }: ServiceEfficiencyMatrixProps) => {
  const { density } = useChartSettings();

  // Calcular medianas para definir os quadrantes
  const receitas = data.map((d) => d.receita);
  const margens = data.map((d) => d.margem);
  const medReceita = calculateMedian(receitas);
  const medMargem = calculateMedian(margens);

  // Calcular ranges para os eixos
  const maxReceita = Math.max(...receitas, 1);
  const maxMargem = Math.max(...margens, 100);

  const cardPadding = density === "compact" ? "p-4" : "p-6";
  const chartHeight = density === "compact" ? 250 : 300;

  // Legendas dos quadrantes
  const quadrantLegend = [
    { label: "Estrela", color: "hsl(var(--chart-positive))" },
    { label: "Nicho", color: "hsl(var(--chart-primary))" },
    { label: "Volume", color: "hsl(var(--chart-warning))" },
    { label: "Rever", color: "hsl(var(--chart-negative))" },
  ];

  return (
    <Card className="interactive-lift" role="region" aria-labelledby="efficiency-matrix-title">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle id="efficiency-matrix-title">Matriz de Eficiência</CardTitle>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-primary cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Posiciona serviços em 4 quadrantes estratégicos baseado em Receita (eixo X) vs
                  Margem de Lucro (eixo Y). Serviços no quadrante superior direito (Estrela) são
                  prioridade máxima.
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Receita vs Rentabilidade por tipo de serviço</CardDescription>
      </CardHeader>
      <CardContent className={cardPadding}>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Nenhum dado de serviço disponível</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  type="number"
                  dataKey="receita"
                  name="Receita"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  domain={[0, maxReceita * 1.1]}
                  label={{
                    value: "Receita Total",
                    position: "insideBottom",
                    offset: -10,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="margem"
                  name="Margem"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, Math.min(maxMargem * 1.1, 100)]}
                  label={{
                    value: "Margem %",
                    angle: -90,
                    position: "insideLeft",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                />
                {/* Linhas de referência para criar quadrantes */}
                <ReferenceLine
                  x={medReceita}
                  stroke="hsl(var(--border))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
                <ReferenceLine
                  y={medMargem}
                  stroke="hsl(var(--border))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
                <Tooltip
                  content={<CustomTooltip medReceita={medReceita} medMargem={medMargem} />}
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Scatter name="Serviços" data={data} fill="hsl(var(--chart-primary))">
                  {data.map((entry, index) => {
                    const quadrant = getQuadrantInfo(entry.receita, entry.margem, medReceita, medMargem);
                    return <Cell key={`cell-${index}`} fill={quadrant.color} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>

            {/* Legenda dos quadrantes */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 pt-3 border-t border-border/30">
              {quadrantLegend.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
