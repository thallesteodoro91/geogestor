import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors } from '../../data/chart-colors';
import { chartActiveBar, chartAnimationDuration, chartBorder, chartCursor, chartTextColor, responsiveChartProps } from '../../utils/chartHelpers';
import { DynamicTooltip } from './DynamicTooltip';

const countFormatter = new Intl.NumberFormat('pt-BR');

export function ProjectBreakdownChart({
  rows,
  ariaLabel,
  color = chartColors.primary
}: {
  rows: Array<{ label: string; count: number }>;
  ariaLabel: string;
  color?: string;
}) {
  const reduceMotion = useReducedMotion();
  const data = rows.filter((row) => row.count > 0).slice(0, 8);
  if (!data.length) return null;

  return (
    <div role="img" aria-label={ariaLabel} className="mt-4 h-52 min-w-0">
      <ResponsiveContainer {...responsiveChartProps}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartBorder} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: chartTextColor, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            dataKey="label"
            type="category"
            width={104}
            tick={{ fill: chartTextColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => String(value).length > 17 ? `${String(value).slice(0, 16)}…` : String(value)}
          />
          <Tooltip
            cursor={chartCursor}
            content={<DynamicTooltip formatter={(value) => `${countFormatter.format(value)} ${value === 1 ? 'projeto' : 'projetos'}`} />}
          />
          <Bar
            dataKey="count"
            name="Projetos"
            fill={color}
            radius={[0, 6, 6, 0]}
            maxBarSize={24}
            activeBar={chartActiveBar(color)}
            isAnimationActive={!reduceMotion}
            animationDuration={chartAnimationDuration}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
