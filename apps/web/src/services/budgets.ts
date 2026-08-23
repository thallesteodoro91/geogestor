import { apiClient } from './apiClient';

export interface BudgetSummary {
  id: string;
  clientId: string;
  clientName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  status: string;
  totalCents: number;
  issueDate?: string | null;
  createdAt?: string | null;
  estimatedTaxesCents?: number | null;
  description?: string | null;
  number?: string | null;
}

export function listBudgetSummaries(clientId?: string) {
  const search = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  return apiClient.get<BudgetSummary[]>(`/api/orcamentos${search}`);
}
