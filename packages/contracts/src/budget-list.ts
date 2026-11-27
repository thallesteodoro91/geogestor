/** Read-only list ordering; financial calculation and lifecycle rules are unchanged. */
export const BUDGET_LIST_SORTS = ['recentes', 'emissao', 'validade', 'cliente', 'valor_asc', 'valor_desc'] as const;
export type BudgetListSort = typeof BUDGET_LIST_SORTS[number];
