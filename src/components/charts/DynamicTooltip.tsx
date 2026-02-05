/**
 * Dynamic Tooltip Component
 * Tooltip with color indicator that matches the data series color
 */

import { cn } from "@/lib/utils";

interface DynamicTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name?: string;
    dataKey?: string;
    color?: string;
    payload?: {
      fill?: string;
      color?: string;
      [key: string]: unknown;
    };
  }>;
  label?: string;
  formatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
  className?: string;
}

const getItemColor = (item: DynamicTooltipProps['payload'][0]): string => {
  return item.color || item.payload?.fill || item.payload?.color || 'hsl(var(--primary))';
};

export const DynamicTooltip = ({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  className,
}: DynamicTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const primaryColor = getItemColor(payload[0]);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-lg bg-popover",
        className
      )}
      style={{ borderColor: primaryColor }}
      role="tooltip"
    >
      {/* Colored side indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: primaryColor }}
        aria-hidden="true"
      />

      <div className="pl-2">
        {/* Label */}
        {label && (
          <p className="text-sm font-semibold text-popover-foreground mb-2">
            {labelFormatter ? labelFormatter(label) : label}
          </p>
        )}

        {/* Data items */}
        <div className="space-y-1">
          {payload.map((item, index) => {
            const color = getItemColor(item);
            const displayName = item.name || item.dataKey || 'Valor';
            const displayValue = formatter 
              ? formatter(item.value) 
              : item.value.toLocaleString('pt-BR');

            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-muted-foreground">
                    {displayName}
                  </span>
                </div>
                <span className="text-sm font-bold text-popover-foreground">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
