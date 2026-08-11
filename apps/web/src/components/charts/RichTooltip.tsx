/**
 * Rich Tooltip Component
 * Enhanced tooltip with full labels, multiple series support, and contextual information
 */

import { cn } from "../../utils/cn";

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat('pt-BR');

interface TooltipPayloadItem {
  value: number;
  name?: string;
  dataKey?: string;
  color?: string;
  stroke?: string;
  fill?: string;
  payload?: {
    previousValue?: number;
    label?: string;
    context?: string;
    fill?: string;
    color?: string;
    [key: string]: unknown;
  };
}

interface RichTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  format?: 'currency' | 'percent' | 'number';
  showVariation?: boolean;
  showDifference?: boolean;
  differenceLabel?: string;
  className?: string;
}

const formatValue = (value: number, format: 'currency' | 'percent' | 'number'): string => {
  switch (format) {
    case 'currency':
      return currencyFormatter.format(value);
    case 'percent':
      return `${percentFormatter.format(value)}%`;
    case 'number':
    default:
      return numberFormatter.format(value);
  }
};

const getSeriesColor = (item: TooltipPayloadItem): string => {
  const payloadFill = item.payload?.fill as string | undefined;
  const payloadColor = item.payload?.color as string | undefined;
  return payloadFill || item.color || item.stroke || item.fill || payloadColor || 'hsl(var(--chart-primary))';
};

export const RichTooltip = ({
  active,
  payload,
  label,
  format = 'currency',
  showVariation = false,
  showDifference = false,
  differenceLabel = 'Lucro',
  className,
}: RichTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  // Get context from first item if available
  const context = payload[0]?.payload?.context;

  // Calculate difference between first two series (e.g., Receita - Despesa)
  const difference = payload.length >= 2 ? payload[0].value - payload[1].value : null;
  const isDifferencePositive = difference !== null && difference >= 0;

  return (
    <div
      className={cn(
        "geo-surface-raised pointer-events-none relative min-w-[220px] max-w-[calc(100vw-2rem)] overflow-hidden p-4 text-zinc-950 backdrop-blur-md dark:text-zinc-50",
        className
      )}
      role="tooltip"
      aria-live="polite"
    >
      {/* Colored side indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ backgroundColor: getSeriesColor(payload[0]) }}
        aria-hidden="true"
      />

      <div className="pl-2">
        {/* Period Label */}
        {label && (
          <p className="mb-3 break-words border-b border-brand-border pb-2 text-xs font-bold text-zinc-950 dark:text-white">
            {label}
          </p>
        )}

        {/* All Series Data */}
        <div className="space-y-2">
          {payload.map((item, index) => {
            const seriesColor = getSeriesColor(item);
            const seriesName = item.name || item.dataKey || `Série ${index + 1}`;
            
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  {/* Color indicator */}
                  <span 
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: seriesColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {seriesName}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-zinc-950 dark:text-white">
                  {formatValue(item.value, format)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Calculated Difference (Lucro) */}
        {showDifference && difference !== null && (
          <div className="mt-3 border-t border-brand-border pt-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {differenceLabel}
              </span>
              <span className={cn(
                "text-sm font-bold",
                isDifferencePositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {isDifferencePositive ? '+' : ''}{formatValue(difference, format)}
              </span>
            </div>
          </div>
        )}

        {/* Variation for first item (if enabled) */}
        {showVariation && payload[0]?.payload?.previousValue !== undefined && (
          <div className="mt-3 border-t border-brand-border pt-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Anterior: {formatValue(payload[0].payload.previousValue, format)}
            </p>
          </div>
        )}

        {/* Context */}
        {context && (
          <p className="mt-3 break-words border-t border-brand-border pt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {context}
          </p>
        )}
      </div>
    </div>
  );
};

// Simpler tooltip content for inline use
export const SimpleTooltipContent = ({
  value,
  label,
  format = 'currency',
}: {
  value: number;
  label?: string;
  format?: 'currency' | 'percent' | 'number';
}) => (
  <div className="geo-surface-raised p-2.5 text-zinc-950 backdrop-blur-md dark:text-white">
    {label && <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>}
    <p className="text-sm font-bold tabular-nums text-zinc-950 dark:text-white">{formatValue(value, format)}</p>
  </div>
);
