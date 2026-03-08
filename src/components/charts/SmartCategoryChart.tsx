/**
 * Smart Category Chart Component
 * 
 * Storytelling com Dados (Cap. 2): ALWAYS use horizontal bar charts for categorical data.
 * The book explicitly recommends AVOIDING pie/donut charts because humans struggle 
 * to accurately compare areas and angles. Horizontal bars leverage our natural ability 
 * to compare lengths along a common baseline.
 * 
 * Cap. 3: Eliminate clutter — minimal grid lines, clean labels.
 * Cap. 4: Focus attention — single accent color with muted context.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { RichTooltip } from "./RichTooltip";
import { useChartSettings } from "@/contexts/ChartSettingsContext";

interface CategoryDataItem {
  name: string;
  value: number;
  percentage?: number;
}

interface SmartCategoryChartProps {
  data: CategoryDataItem[];
  height?: number;
  showTotal?: boolean;
  format?: 'currency' | 'percent' | 'number';
  ariaLabel?: string;
  /** Highlight a specific category name with accent color */
  highlightCategory?: string;
}

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/**
 * Storytelling com Dados (Cap. 4): Use color strategically.
 * One accent color for the key insight; everything else in muted gray.
 * This guides the viewer's eye to what matters most.
 */
const ACCENT_COLOR = "hsl(var(--chart-primary))";
const MUTED_COLOR = "hsl(var(--muted-foreground) / 0.3)";

export const SmartCategoryChart = ({
  data,
  height = 300,
  showTotal = true,
  format = 'currency',
  ariaLabel = "Gráfico de categorias",
  highlightCategory,
}: SmartCategoryChartProps) => {
  const { colorblindMode } = useChartSettings();
  
  const total = data.reduce((acc, item) => acc + item.value, 0);
  
  // Calculate percentages and sort descending (Cap. 2: order bars by value)
  const sortedData = [...data]
    .map((item) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Cap. 4: If no highlight specified, highlight the top category
  const topCategory = highlightCategory || sortedData[0]?.name;

  const getBarColor = (name: string) => {
    if (name === topCategory) return ACCENT_COLOR;
    return MUTED_COLOR;
  };

  // Horizontal Bar Chart — ALWAYS (Cap. 2: bars are the workhorse of data visualization)
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart 
          data={sortedData} 
          layout="vertical"
          margin={{ top: 5, right: 60, left: 5, bottom: 5 }}
        >
          {/* Cap. 3: Minimal grid — only vertical lines, light stroke */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={false}
            vertical={true}
            opacity={0.3}
          />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              format === 'currency'
                ? `R$ ${(value / 1000).toFixed(0)}k`
                : `${value.toFixed(0)}%`
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={100}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<RichTooltip format={format} showVariation={false} />}
            cursor={{ fill: 'hsl(var(--primary) / 0.08)' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {sortedData.map((entry) => (
              <Cell
                key={entry.name}
                fill={getBarColor(entry.name)}
              />
            ))}
            {/* Cap. 4: Direct labels reduce need to look at axis */}
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(val: number) => `${val.toFixed(0)}%`}
              style={{ 
                fontSize: 11, 
                fill: 'hsl(var(--muted-foreground))',
                fontWeight: 500,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Cap. 3: Show total as simple text, not a decorative element */}
      {showTotal && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Total: {formatCurrency(total)}
        </p>
      )}
    </div>
  );
};