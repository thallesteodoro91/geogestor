/**
 * Dynamic Tooltip Component
 * Tooltip with color indicator that matches the data series color
 */

import { cn } from "../../utils/cn";

const numberFormatter = new Intl.NumberFormat('pt-BR');

interface TooltipPayloadItem {
  value: number;
  name?: string;
  dataKey?: string;
  color?: string;
  payload?: {
    fill?: string;
    color?: string;
    [key: string]: unknown;
  };
}

interface DynamicTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  formatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
  className?: string;
}

const getItemColor = (item: TooltipPayloadItem): string => {
  return item.color || item.payload?.fill || item.payload?.color || 'hsl(var(--chart-primary))';
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
        "geo-surface-raised pointer-events-none relative min-w-[180px] max-w-[calc(100vw-2rem)] overflow-hidden p-3.5 text-zinc-950 backdrop-blur-md dark:text-zinc-50",
        className
      )}
      style={{ borderColor: primaryColor }}
      role="tooltip"
      aria-live="polite"
    >
      {/* Colored side indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ backgroundColor: primaryColor }}
        aria-hidden="true"
      />

      <div className="pl-2">
        {/* Label */}
        {label && (
          <p className="mb-2 break-words text-sm font-bold text-zinc-950 dark:text-white">
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
              : numberFormatter.format(item.value);

            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {displayName}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-zinc-950 dark:text-white">
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
