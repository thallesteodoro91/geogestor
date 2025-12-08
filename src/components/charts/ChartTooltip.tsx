import { Tooltip } from "recharts";
import { RichTooltip } from "./RichTooltip";

type TooltipFormat = "currency" | "percent" | "number";

interface ChartTooltipProps {
  format?: TooltipFormat;
  showVariation?: boolean;
  cursorFill?: string;
  cursorRadius?: number;
}

/**
 * Componente de Tooltip padronizado para gráficos Recharts.
 * Encapsula as configurações de cursor e RichTooltip para uso consistente.
 * 
 * @example
 * <BarChart data={data}>
 *   <ChartTooltip format="currency" />
 *   <Bar dataKey="value" />
 * </BarChart>
 */
export const ChartTooltip = ({
  format = "currency",
  showVariation = false,
  cursorFill = "hsl(var(--primary) / 0.15)",
  cursorRadius = 4,
}: ChartTooltipProps) => {
  return (
    <Tooltip
      content={<RichTooltip format={format} showVariation={showVariation} />}
      cursor={{ fill: cursorFill, radius: cursorRadius }}
    />
  );
};

export default ChartTooltip;
