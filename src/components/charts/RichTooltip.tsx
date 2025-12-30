/**
 * Rich Tooltip Component
 * Enhanced tooltip with full labels, multiple series support, and contextual information
 */

import { cn } from "@/lib/utils";

interface RichTooltipProps {
  active?: boolean;
  payload?: Array<{
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
      [key: string]: unknown;
    };
  }>;
  label?: string;
  format?: 'currency' | 'percent' | 'number';
  showVariation?: boolean;
  className?: string;
}

const formatValue = (value: number, format: 'currency' | 'percent' | 'number'): string => {
  switch (format) {
    case 'currency':
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString('pt-BR');
  }
};

const getSeriesColor = (item: RichTooltipProps['payload'][0]): string => {
  return item.color || item.stroke || item.fill || 'hsl(var(--primary))';
};

export const RichTooltip = ({
  active,
  payload,
  label,
  format = 'currency',
  showVariation = false,
  className,
}: RichTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  // Get context from first item if available
  const context = payload[0]?.payload?.context;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 shadow-2xl min-w-[200px]",
        "bg-gradient-to-br from-card via-card to-background/95",
        "border-primary/30 backdrop-blur-md",
        "shadow-primary/20",
        className
      )}
      role="tooltip"
      aria-live="polite"
    >
      {/* Colored side indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-primary"
        aria-hidden="true"
      />

      <div className="pl-2">
        {/* Period Label */}
        {label && (
          <p className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/30">
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
                <div className="flex items-center gap-2">
                  {/* Color indicator */}
                  <span 
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: seriesColor }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-muted-foreground">
                    {seriesName}
                  </span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {formatValue(item.value, format)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Variation for first item (if enabled) */}
        {showVariation && payload[0]?.payload?.previousValue !== undefined && (
          <div className="mt-3 pt-2 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              Anterior: {formatValue(payload[0].payload.previousValue, format)}
            </p>
          </div>
        )}

        {/* Context */}
        {context && (
          <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border/30">
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
  <div className="rounded-lg border bg-popover p-2 shadow-md border-border/50">
    {label && <p className="text-xs text-muted-foreground">{label}</p>}
    <p className="text-sm font-semibold text-foreground">{formatValue(value, format)}</p>
  </div>
);
