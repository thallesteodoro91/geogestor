import { BUDGET_STATUS_LABELS, normalizeBudgetStatus } from '@geogestor/contracts';

export const isApprovedBudgetStatus = (status?: string | null) =>
  normalizeBudgetStatus(status) === 'aprovado';

export const isClosedBudgetStatus = (status?: string | null) =>
  ['aprovado', 'rejeitado', 'expirado', 'cancelado', 'substituido'].includes(normalizeBudgetStatus(status));

export const getBudgetStatusLabel = (status?: string | null) =>
  BUDGET_STATUS_LABELS[normalizeBudgetStatus(status)];
