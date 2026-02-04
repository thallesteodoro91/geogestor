/**
 * Expense Treemap
 * Visualização hierárquica de custos usando Treemap do Recharts
 * Cores diferenciadas: Fixos (azul) vs Variáveis (laranja)
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExpenseCategory {
  name: string;
  value: number;
  tipo: "FIXA" | "VARIAVEL";
}

interface ExpenseTreemapProps {
  data: ExpenseCategory[];
  isLoading?: boolean;
}

// Paleta de cores para custos fixos (tons de azul)
const FIXED_COLORS = [
  "hsl(217, 91%, 60%)", // blue-500
  "hsl(217, 91%, 50%)", // blue-600
  "hsl(217, 91%, 40%)", // blue-700
  "hsl(217, 91%, 70%)", // blue-400
  "hsl(217, 91%, 55%)", // blue-550
];

// Paleta de cores para custos variáveis (tons de laranja)
const VARIABLE_COLORS = [
  "hsl(25, 95%, 53%)",  // orange-500
  "hsl(25, 95%, 43%)",  // orange-600
  "hsl(25, 95%, 63%)",  // orange-400
  "hsl(33, 95%, 53%)",  // amber-500
  "hsl(25, 95%, 48%)",  // orange-550
];

// Formata valor em formato abreviado (ex: 25.000 → 25k)
const formatValueShort = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
};

// Formata valor completo em BRL
const formatValueFull = (value: number): string => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

// Componente customizado para renderizar cada célula do Treemap
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, fill, value } = props;

  // Ocultar texto em retângulos pequenos para manter visual limpo
  const showName = width > 60 && height > 35;
  const showValue = width > 75 && height > 50;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        rx={4}
        ry={4}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        className="transition-opacity hover:opacity-90"
      />
      {showName && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showValue ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={12}
          fontWeight={600}
          className="pointer-events-none"
        >
          {name.length > 12 ? `${name.substring(0, 10)}...` : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={11}
          fontWeight={500}
          opacity={0.9}
          className="pointer-events-none"
        >
          R$ {formatValueShort(value)}
        </text>
      )}
    </g>
  );
};

// Tooltip customizado
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const tipoLabel = data.tipo === "FIXA" ? "Custo Fixo" : "Custo Variável";
  const tipoColor = data.tipo === "FIXA" ? FIXED_COLORS[0] : VARIABLE_COLORS[0];

  return (
    <div className="rounded-xl border-2 p-4 shadow-2xl min-w-[200px] bg-gradient-to-br from-card via-card to-background/95 border-primary/30 backdrop-blur-md">
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: tipoColor }}
      />
      <div className="pl-2">
        <p className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/30">
          {data.name}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Valor</span>
            <span className="text-sm font-bold text-foreground">
              {formatValueFull(data.value)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Tipo</span>
            <span className="text-sm font-medium" style={{ color: tipoColor }}>
              {tipoLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Proporção</span>
            <span className="text-sm font-bold text-foreground">
              {data.percentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ExpenseTreemap = ({ data, isLoading }: ExpenseTreemapProps) => {
  const { density } = useChartSettings();

  // Calcular total para percentuais
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Contadores para cores únicas por tipo
  let fixedIndex = 0;
  let variableIndex = 0;

  // Transformar dados para o Treemap com cores por tipo
  const treemapData = data.map((item) => {
    const colorIndex =
      item.tipo === "FIXA"
        ? fixedIndex++ % FIXED_COLORS.length
        : variableIndex++ % VARIABLE_COLORS.length;

    const fill =
      item.tipo === "FIXA"
        ? FIXED_COLORS[colorIndex]
        : VARIABLE_COLORS[colorIndex];

    return {
      name: item.name,
      value: item.value,
      fill,
      tipo: item.tipo,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
    };
  });

  const cardPadding = density === "compact" ? "p-4" : "p-6";
  const chartHeight = density === "compact" ? 250 : 300;

  // Legenda
  const legend = [
    { label: "Custos Fixos", color: FIXED_COLORS[0] },
    { label: "Custos Variáveis", color: VARIABLE_COLORS[0] },
  ];

  return (
    <Card className="interactive-lift" role="region" aria-labelledby="expense-treemap-title">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle id="expense-treemap-title">Custos por Categoria</CardTitle>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-primary cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Visualização hierárquica de custos por categoria. Áreas maiores
                  representam despesas maiores. Azul = Custos Fixos, Laranja = Custos
                  Variáveis.
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Proporção visual: Fixos vs Variáveis</CardDescription>
      </CardHeader>
      <CardContent className={cardPadding}>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Nenhuma despesa registrada no período</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <Treemap
                data={treemapData}
                dataKey="value"
                nameKey="name"
                stroke="hsl(var(--background))"
                content={<CustomTreemapContent />}
              >
                <Tooltip content={<CustomTooltip />} />
              </Treemap>
            </ResponsiveContainer>

            {/* Legenda */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 pt-3 border-t border-border/30">
              {legend.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm"
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
