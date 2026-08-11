import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors } from '../../data/chart-colors';
import { chartActiveBar, chartAnimationDuration, chartBorder, chartCursor, chartTextColor, responsiveChartProps } from '../../utils/chartHelpers';

type ClientProfitabilityDatum = {
  name: string;
  result: number;
  margin: number;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function ProfitabilityTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: ClientProfitabilityDatum }>;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div role="tooltip" className="geo-surface-raised min-w-52 p-4 text-zinc-950 dark:text-white">
      <p className="break-words text-sm font-semibold">{item.name}</p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Resultado: <strong className={item.result >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}>{currencyFormatter.format(item.result)}</strong>
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Margem: <strong className="tabular-nums text-zinc-950 dark:text-white">{percentageFormatter.format(item.margin)}%</strong>
      </p>
    </div>
  );
}

export function ClientProfitabilityChart({ items }: { items: ClientProfitabilityDatum[] }) {
  const reduceMotion = useReducedMotion();
  const data = [...items].sort((a, b) => b.result - a.result).slice(0, 5);
  if (!data.length) return null;

  return (
    <div
      role="img"
      aria-label="Gráfico de barras da rentabilidade por cliente"
      className="mt-4 h-64 min-w-0"
    >
      <ResponsiveContainer {...responsiveChartProps}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartBorder} />
          <XAxis
            type="number"
            tick={{ fill: chartTextColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => currencyFormatter.format(Number(value))}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={112}
            tick={{ fill: chartTextColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => String(value).length > 18 ? `${String(value).slice(0, 17)}…` : String(value)}
          />
          <Tooltip cursor={chartCursor} content={<ProfitabilityTooltip />} />
          <Bar
            dataKey="result"
            name="Resultado"
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
            activeBar={chartActiveBar('hsl(var(--text-primary))')}
            isAnimationActive={!reduceMotion}
            animationDuration={chartAnimationDuration}
          >
            {data.map((item) => (
              <Cell key={item.name} fill={item.result >= 0 ? chartColors.positive : chartColors.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
