/**
 * Financial Mock Data
 * Centralized data definitions for financial dashboards
 * Extract mock data from components to enable prop-based data injection
 */

export interface DREItem {
  categoria: string;
  valor: number;
  type: 'positive' | 'negative';
}

export interface ExpenseItem {
  name: string;
  value: number;
}

export interface CategoryData {
  name: string;
  value: number;
  percentage?: number;
}

export interface RevenueComparison {
  tipo: string;
  valor: number;
  previousValor?: number;
}

// DRE - Demonstração do Resultado
export const dreData: DREItem[] = [
  { categoria: "Receita Bruta", valor: 2340000, type: 'positive' },
  { categoria: "(-) Impostos", valor: -280800, type: 'negative' },
  { categoria: "Receita Líquida", valor: 2059200, type: 'positive' },
  { categoria: "(-) Custos Diretos", valor: -1235520, type: 'negative' },
  { categoria: "Lucro Bruto", valor: 823680, type: 'positive' },
  { categoria: "(-) Despesas Op.", valor: -206000, type: 'negative' },
  { categoria: "Lucro Líquido", valor: 617680, type: 'positive' },
];

// Expense breakdown by category
export const expenseData: ExpenseItem[] = [
  { name: "Pessoal", value: 95000 },
  { name: "Equipamentos", value: 42000 },
  { name: "Transporte", value: 28000 },
  { name: "Administrativo", value: 25000 },
  { name: "Marketing", value: 16000 },
];

// Calculate total expenses
export const totalExpenses = expenseData.reduce((acc, item) => acc + item.value, 0);

// Helper to get color based on item type
export const getDREColor = (type: 'positive' | 'negative'): string => {
  return type === 'positive' 
    ? 'hsl(var(--chart-positive))' 
    : 'hsl(var(--chart-negative))';
};

// Chart color palette using design tokens
export const chartColors = {
  primary: 'hsl(var(--chart-primary))',
  secondary: 'hsl(var(--chart-secondary))',
  positive: 'hsl(var(--chart-positive))',
  negative: 'hsl(var(--chart-negative))',
  warning: 'hsl(var(--chart-warning))',
  neutral: 'hsl(var(--chart-neutral))',
};

// Colorblind-safe palette
export const colorblindSafeColors = [
  'hsl(var(--chart-cb-1))',
  'hsl(var(--chart-cb-2))',
  'hsl(var(--chart-cb-3))',
  'hsl(var(--chart-cb-4))',
  'hsl(var(--chart-cb-5))',
  'hsl(var(--chart-cb-6))',
];

// Standard chart colors (semantic tokens)
export const standardChartColors = [
  'hsl(var(--chart-primary))',
  'hsl(var(--chart-secondary))',
  'hsl(var(--chart-positive))',
  'hsl(var(--chart-warning))',
  'hsl(var(--chart-cb-5))',
];
