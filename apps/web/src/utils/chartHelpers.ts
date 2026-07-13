export const chartTextColor = "hsl(var(--text-muted))";
export const chartSecondaryTextColor = "hsl(var(--text-secondary))";
export const chartBorder = "hsl(var(--border))";

export const chartTooltipStyle = {
  borderRadius: "var(--brand-radius-lg)",
  border: "1px solid hsl(var(--brand-border-soft) / 0.92)",
  backgroundColor: "hsl(var(--brand-surface) / 0.98)",
  boxShadow: "var(--brand-shadow-md)",
  padding: "10px 12px",
};

export const chartTooltipLabelStyle = {
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
  fontSize: "12px",
  marginBottom: "4px",
};

export const chartTooltipItemStyle = {
  color: "hsl(var(--text-secondary))",
  fontSize: "12px",
  padding: "2px 0",
};

export const chartLegendStyle = {
  fontSize: "12px",
  color: "hsl(var(--text-secondary))",
  marginTop: "12px",
};

export const chartCursor = {
  fill: "hsl(var(--brand-primary-400))",
  opacity: 0.08,
};

export const responsiveChartProps = {
  width: "100%",
  height: "100%",
  minWidth: 0,
  initialDimension: {
    width: 800,
    height: 300,
  },
} as const;
