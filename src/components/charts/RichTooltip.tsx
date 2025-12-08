/**
 * Rich Tooltip Component
 * Enhanced tooltip with full labels, % variation, and contextual information
 */

import { cn } from "@/lib/utils";

interface RichTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name?: string;
    dataKey?: string;
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

const calculateVariation = (current: number, previous: number): { value: number; type: 'positive' | 'negative' | 'neutral' } => {
  if (previous === 0) return { value: 0, type: 'neutral' };
  const variation = ((current - previous) / Math.abs(previous)) * 100;
  return {
    value: variation,
    type: variation > 0 ? 'positive' : variation < 0 ? 'negative' : 'neutral',
  };
};

export const RichTooltip = ({
  active,
  payload,
  label,
  format = 'currency',
  showVariation = true,
  className,
}: RichTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  const value = data.value;
  const previousValue = data.payload?.previousValue;
  const customLabel = data.payload?.label || data.name || label;
  const context = data.payload?.context;

  const variation = previousValue !== undefined ? calculateVariation(value, previousValue) : null;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 shadow-2xl",
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
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          variation?.type === 'positive' && "bg-chart-positive",
          variation?.type === 'negative' && "bg-chart-negative",
          (!variation || variation.type === 'neutral') && "bg-primary"
        )}
        aria-hidden="true"
      />

      <div className="pl-2">
        {/* Label */}
        {customLabel && (
          <p className="text-sm font-medium text-foreground mb-1">
            {customLabel}
          </p>
        )}

        {/* Value */}
        <p className="text-xl font-bold text-foreground">
          {formatValue(value, format)}
        </p>

        {/* Variation */}
        {showVariation && variation && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 text-xs font-semibold",
              variation.type === 'positive' && "text-chart-positive",
              variation.type === 'negative' && "text-chart-negative",
              variation.type === 'neutral' && "text-muted-foreground"
            )}
          >
            <span className="text-base">
              {variation.type === 'positive' && '↑'}
              {variation.type === 'negative' && '↓'}
              {variation.type === 'neutral' && '→'}
            </span>
            <span>
              {Math.abs(variation.value).toFixed(1)}% vs anterior
            </span>
          </div>
        )}

        {/* Previous value reference */}
        {previousValue !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            Anterior: {formatValue(previousValue, format)}
          </p>
        )}

        {/* Context */}
        {context && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/30">
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
