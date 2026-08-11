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
};

function CategoryTreemapCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  name = '',
  value = 0,
  percentage = 0
}: CategoryTreemapCellProps) {
  const compact = width < 126 || height < 74;
  const showValue = width >= 96 && height >= 52;
  const label = name.length > (compact ? 16 : 28) ? `${name.slice(0, compact ? 15 : 27)}…` : name;

  return (
    <g>
      <rect
        className="transition-[filter,opacity] duration-200 hover:brightness-110 motion-reduce:transition-none"
        x={x}
        y={y}
        width={Math.max(0, width - 3)}
        height={Math.max(0, height - 3)}
        rx={8}
        fill={colorblindSafeColors[index % colorblindSafeColors.length]}
        stroke="hsl(var(--brand-surface))"
        strokeWidth={2}
      />
      {width >= 62 && height >= 34 ? (
        <>
          <text x={x + 10} y={y + 20} fill="white" fontSize={compact ? 10 : 12} fontWeight={700}>
            {label}
          </text>
          {showValue ? (
            <text x={x + 10} y={y + 39} fill="rgba(255,255,255,0.9)" fontSize={10} fontWeight={600}>
              {formatCurrencyFromCents(value)} · {percentageFormatter.format(percentage)}%
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
        className={cn(mode === 'treemap' ? (compact ? 'h-64 w-full' : 'h-72 w-full') : 'space-y-4')}
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
              <th className="pb-3">Categoria</th>
              <th className="pb-3 text-right">Lançamentos</th>
              <th className="pb-3 text-right">Participação</th>
              <th className="pb-3 text-right">Valor</th>
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
