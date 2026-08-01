export type ExpenseCategoryInput = {
  name: string;
  value: number;
  count?: number;
};

export type ExpenseCategoryDatum = ExpenseCategoryInput & {
  percentage: number;
};

export type ExpenseCategoryChartMode = 'empty' | 'bars' | 'treemap';

export function prepareExpenseCategoryData(items: ExpenseCategoryInput[]): ExpenseCategoryDatum[] {
  const normalized = items
    .map((item) => ({
      name: item.name.trim() || 'Sem categoria',
      value: Math.max(0, Number(item.value) || 0),
      count: Math.max(0, Number(item.count) || 0)
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = normalized.reduce((sum, item) => sum + item.value, 0);

  return normalized.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0
  }));
}

export function getExpenseCategoryChartMode(itemCount: number): ExpenseCategoryChartMode {
  if (itemCount <= 0) return 'empty';
  return itemCount >= 4 ? 'treemap' : 'bars';
}
