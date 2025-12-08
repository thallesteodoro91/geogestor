/**
 * Smart Category Chart Component
 * Automatically switches between pie/donut chart and horizontal bar chart
 * Rule: Use ordered bars when categories > 4
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { standardChartColors, colorblindSafeColors } from "@/data/financial-mock-data";
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
  maxPieCategories?: number;
  showTotal?: boolean;
  format?: 'currency' | 'percent' | 'number';
  ariaLabel?: string;
}

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export const SmartCategoryChart = ({
  data,
  height = 300,
  maxPieCategories = 4,
  showTotal = true,
  format = 'currency',
  ariaLabel = "Gráfico de categorias",
}: SmartCategoryChartProps) => {
  const { colorblindMode } = useChartSettings();
  
  const colors = colorblindMode ? colorblindSafeColors : standardChartColors;
  const total = data.reduce((acc, item) => acc + item.value, 0);
  
  // Calculate percentages
  const dataWithPercentages = data.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));

  // Rule: Use bar chart for more than maxPieCategories
  const useBarChart = data.length > maxPieCategories;

  if (useBarChart) {
    // Horizontal Bar Chart for many categories
    return (
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={dataWithPercentages} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
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
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              content={<RichTooltip format={format} showVariation={false} />}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
              {dataWithPercentages.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {/* Legend for bar chart */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center" role="list" aria-label="Legenda">
          {dataWithPercentages.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center gap-1.5 text-xs"
              role="listitem"
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: colors[index % colors.length] }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">
                {item.name}: {item.percentage?.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Donut Chart for few categories
  return (
    <div className="relative" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={dataWithPercentages}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percentage }) => `${name}: ${percentage?.toFixed(0)}%`}
            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
          >
            {dataWithPercentages.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={<RichTooltip format={format} showVariation={false} />}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center total for donut */}
      {showTotal && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-bold text-foreground">
              {formatCurrency(total)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
