export const BUDGET_FILTER_KEYS = ['query', 'clientId', 'projectId', 'serviceType', 'municipality', 'property', 'technicalLead', 'propertyType', 'linkedProject', 'issueFrom', 'issueTo', 'validFrom', 'validTo', 'minValueCents', 'maxValueCents', 'status'] as const;
export function budgetFilterParams(params: URLSearchParams) {
  const result = new URLSearchParams();
  BUDGET_FILTER_KEYS.forEach(key => { const value = params.get(key); if (value) result.set(key, value); });
  return result;
}
export function budgetRange(page: number, count: number, total: number) {
  if (!total || !count) return `0 de ${total} orçamentos`;
  const first = (page - 1) * 25 + 1;
  return `${first}–${Math.min(first + count - 1, total)} de ${total} ${total === 1 ? 'orçamento' : 'orçamentos'}`;
}
