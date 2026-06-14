// Paletas de cores para gráficos — todos os valores via tokens de design (HSL CSS vars).
// Não inclui dados de negócio; somente cor.

export const chartColors = {
  primary: 'hsl(var(--chart-primary))',
  secondary: 'hsl(var(--chart-secondary))',
  positive: 'hsl(var(--chart-positive))',
  negative: 'hsl(var(--chart-negative))',
  warning: 'hsl(var(--chart-warning))',
  neutral: 'hsl(var(--chart-neutral))',
} as const;

// Paleta segura para daltonismo
export const colorblindSafeColors = [
  'hsl(var(--chart-cb-1))',
  'hsl(var(--chart-cb-2))',
  'hsl(var(--chart-cb-3))',
  'hsl(var(--chart-cb-4))',
  'hsl(var(--chart-cb-5))',
  'hsl(var(--chart-cb-6))',
];

// Paleta padrão de gráficos (tokens semânticos)
export const standardChartColors = [
  'hsl(var(--chart-primary))',
  'hsl(var(--chart-secondary))',
  'hsl(var(--chart-positive))',
  'hsl(var(--chart-warning))',
  'hsl(var(--chart-cb-5))',
];
