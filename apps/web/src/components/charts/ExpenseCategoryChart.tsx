import { useReducedMotion } from 'framer-motion';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { colorblindSafeColors } from '../../data/chart-colors';
import { chartAnimationDuration, responsiveChartProps } from '../../utils/chartHelpers';
import { cn } from '../../utils/cn';
import {
  getExpenseCategoryChartMode,
  prepareExpenseCategoryData,
  type ExpenseCategoryInput
} from './chartBreakdowns';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const countFormatter = new Intl.NumberFormat('pt-BR');

const categoryCellForegrounds = [
  '#ffffff',
  '#321b0d',
  '#ffffff',
  '#2c2504',
  '#102a33',
  '#ffffff'
] as const;

function formatCurrencyFromCents(value: number) {
  return currencyFormatter.format(value / 100);
}

function countLabel(value: number) {
  return `${countFormatter.format(value)} ${value === 1 ? 'lançamento' : 'lançamentos'}`;
}

type CategoryTreemapCellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
  percentage?: number;
  count?: number;
};

function CategoryTreemapCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  name = '',
  value = 0,
  percentage = 0,
  count = 0
}: CategoryTreemapCellProps) {
  const inset = 3;
  const cellWidth = Math.max(0, width - inset * 2);
  const cellHeight = Math.max(0, height - inset * 2);
  const cellX = x + inset;
  const cellY = y + inset;
  const compact = cellWidth < 154 || cellHeight < 92;
  const showValue = cellWidth >= 104 && cellHeight >= 58;
  const showCount = cellWidth >= 132 && cellHeight >= 92;
  const showPercentageBadge = cellWidth >= 176 && cellHeight >= 64;
  const availableTitleWidth = cellWidth - (showPercentageBadge ? 92 : 28);
  const maxLabelLength = compact
    ? Math.max(8, Math.floor(availableTitleWidth / 6.2))
    : Math.max(10, Math.floor(availableTitleWidth / 7));
  const label = name.length > maxLabelLength ? `${name.slice(0, Math.max(1, maxLabelLength - 1))}…` : name;
  const foreground = categoryCellForegrounds[index % categoryCellForegrounds.length];
  const mutedForeground = foreground === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(24,24,27,0.72)';
  const detailForeground = foreground === '#ffffff' ? 'rgba(255,255,255,0.92)' : 'rgba(24,24,27,0.88)';
  const badgeFill = foreground === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.46)';
  const badgeWidth = 58;
  const contentX = cellX + (compact ? 10 : 14);
  const titleY = cellY + (compact ? 20 : 25);

  return (
    <g className="group/category-cell">
      <rect
        className="opacity-[0.94] transition-opacity duration-300 group-hover/category-cell:opacity-100 motion-reduce:transition-none"
        x={cellX}
        y={cellY}
        width={cellWidth}
        height={cellHeight}
        rx={12}
        fill={colorblindSafeColors[index % colorblindSafeColors.length]}
        stroke="hsl(var(--brand-surface) / 0.72)"
        strokeWidth={1}
        style={{ filter: 'drop-shadow(0 7px 10px rgba(9, 9, 11, 0.14))' }}
      />
      <rect
        aria-hidden="true"
        x={cellX + 1}
        y={cellY + 1}
        width={Math.max(0, cellWidth - 2)}
        height={Math.max(0, Math.min(42, cellHeight * 0.36))}
        rx={11}
        fill="rgba(255,255,255,0.08)"
        pointerEvents="none"
      />
      {cellWidth >= 62 && cellHeight >= 34 ? (
        <>
          <text
            x={contentX}
            y={titleY}
            fill={foreground}
            fontSize={compact ? 10 : 12}
            fontWeight={700}
            letterSpacing="-0.01em"
            pointerEvents="none"
          >
            {label}
          </text>
          {showPercentageBadge ? (
            <>
              <rect
                aria-hidden="true"
                x={cellX + cellWidth - badgeWidth - 12}
                y={cellY + 12}
                width={badgeWidth}
                height={24}
                rx={12}
                fill={badgeFill}
                pointerEvents="none"
              />
              <text
                x={cellX + cellWidth - badgeWidth / 2 - 12}
                y={cellY + 28.5}
                fill={foreground}
                fontSize={10}
                fontWeight={700}
                textAnchor="middle"
                pointerEvents="none"
              >
                {percentageFormatter.format(percentage)}%
              </text>
            </>
          ) : null}
          {showValue ? (
            <text
              x={contentX}
              y={titleY + (compact ? 18 : 24)}
              fill={detailForeground}
              fontSize={compact ? 10 : 14}
              fontWeight={700}
              letterSpacing="-0.015em"
              pointerEvents="none"
            >
              {formatCurrencyFromCents(value)}
            </text>
          ) : null}
          {showCount ? (
            <text
              x={contentX}
              y={cellY + cellHeight - 16}
              fill={mutedForeground}
              fontSize={10}
              fontWeight={600}
              pointerEvents="none"
            >
              {countLabel(count)}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

type TooltipPayload = {
  payload?: {
    name?: string;
    value?: number;
    percentage?: number;
    count?: number;
  };
};

function ExpenseCategoryTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div role="tooltip" className="geo-surface-raised min-w-56 p-4 text-zinc-950 dark:text-white">
      <p className="break-words text-sm font-semibold">{item.name}</p>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between gap-5">
          <dt className="text-zinc-500 dark:text-zinc-400">Valor</dt>
          <dd className="font-semibold tabular-nums">{formatCurrencyFromCents(item.value || 0)}</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-zinc-500 dark:text-zinc-400">Participação</dt>
          <dd className="font-semibold tabular-nums">{percentageFormatter.format(item.percentage || 0)}%</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-zinc-500 dark:text-zinc-400">Volume</dt>
          <dd className="font-semibold tabular-nums">{countLabel(item.count || 0)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ExpenseCategoryChart({
  items,
  emptyMessage = 'Nenhuma despesa encontrada.',
  className,
  compact = false
}: {
  items: ExpenseCategoryInput[];
  emptyMessage?: string;
  className?: string;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const data = prepareExpenseCategoryData(items).slice(0, compact ? 5 : undefined);
  const mode = compact ? (data.length > 0 ? 'bars' : 'empty') : getExpenseCategoryChartMode(data.length);

  if (mode === 'empty') {
    return (
      <p
        data-chart-mode="empty"
        className={cn('mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700', className)}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn('mt-5 min-w-0', className)} data-chart-mode={mode}>
      <div
        role="img"
        aria-label={mode === 'treemap' ? 'Gráfico em árvore das despesas por categoria' : 'Gráfico de barras das despesas por categoria'}
        className={cn(
          mode === 'treemap'
            ? cn(
                compact ? 'h-64' : 'h-72',
                'w-full rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-1 shadow-inner dark:border-zinc-800/90 dark:bg-zinc-950/50'
              )
            : 'space-y-4'
        )}
      >
        {mode === 'treemap' ? (
          <ResponsiveContainer {...responsiveChartProps}>
            <Treemap
              data={data}
              dataKey="value"
              nameKey="name"
              stroke="hsl(var(--brand-surface))"
              content={<CategoryTreemapCell />}
              isAnimationActive={!reduceMotion}
              animationDuration={chartAnimationDuration}
            >
              <Tooltip content={<ExpenseCategoryTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          data.map((item, index) => (
            <div key={item.name}>
              <div className="flex items-end justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100" title={item.name}>{item.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{countLabel(item.count || 0)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-zinc-950 dark:text-white">{formatCurrencyFromCents(item.value)}</p>
                  <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{percentageFormatter.format(item.percentage)}%</p>
                </div>
              </div>
              <div aria-hidden="true" className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, item.percentage)}%`,
                    backgroundColor: colorblindSafeColors[index % colorblindSafeColors.length],
                    transition: reduceMotion ? 'none' : `width ${chartAnimationDuration}ms var(--motion-ease-standard)`
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {compact ? (
        <ul className="sr-only">
          {data.map((item) => (
            <li key={item.name}>{item.name}: {formatCurrencyFromCents(item.value)}, {countLabel(item.count || 0)}, {percentageFormatter.format(item.percentage)}%</li>
          ))}
        </ul>
      ) : (
      <div className="mt-5 overflow-x-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <table className="w-full min-w-[430px] text-sm">
          <caption className="sr-only">Valores exatos das despesas por categoria</caption>
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <th scope="col" className="pb-3">Categoria</th>
              <th scope="col" className="pb-3 text-right">Lançamentos pagos</th>
              <th scope="col" className="pb-3 text-right">Participação</th>
              <th scope="col" className="pb-3 text-right">Valor pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.map((item) => (
              <tr key={item.name}>
                <th scope="row" className="max-w-56 break-words py-3 text-left font-medium text-zinc-900 dark:text-zinc-100">{item.name}</th>
                <td className="py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{countFormatter.format(item.count || 0)}</td>
                <td className="py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{percentageFormatter.format(item.percentage)}%</td>
                <td className="py-3 text-right font-semibold tabular-nums text-zinc-950 dark:text-white">{formatCurrencyFromCents(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
