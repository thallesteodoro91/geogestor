/**
 * Cross-field consistency checks for budget rows during import.
 * Returns warnings (not blocking) when payment method + payment status +
 * budget situation form an unlikely combination.
 */
import { PAYMENT_STATUS, PAYMENT_METHOD, BUDGET_SITUATION } from "@/constants/budgetStatus";

export interface ConsistencyIssue {
  code: string; // stable rule identifier
  fields: string[]; // canonical field keys involved
  message: string;
  suggestion?: string;
  /** Auto-fix patch to apply on top of the row (only the fields that should change). */
  autoFix?: Record<string, string | null>;
  /** Human-readable description of what the auto-fix will do. */
  autoFixLabel?: string;
}

interface BudgetRow {
  forma_de_pagamento?: string | null;
  situacao_do_pagamento?: string | null;
  situacao?: string | null; // status do orçamento
  valor_pago?: number | string | null;
  valor_total?: number | string | null;
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export function checkBudgetRowConsistency(row: BudgetRow): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const forma = row.forma_de_pagamento || null;
  const pago = row.situacao_do_pagamento || null;
  const orc = row.situacao || null;
  const vPago = num(row.valor_pago);
  const vTotal = num(row.valor_total);

  // 1. Pago without forma de pagamento
  if (pago === PAYMENT_STATUS.PAGO && !forma) {
    issues.push({
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: "Marcado como Pago, mas sem forma de pagamento",
      suggestion: "Defina a forma de pagamento usada",
    });
  }

  // 2. Cancelado with forma de pagamento
  if (pago === PAYMENT_STATUS.CANCELADO && forma) {
    issues.push({
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: `Pagamento Cancelado, mas forma "${forma}" preenchida`,
      suggestion: "Remova a forma de pagamento ou revise o status",
    });
  }

  // 3. Orçamento Recusado/Cancelado com pagamento Pago
  if (
    (orc === BUDGET_SITUATION.RECUSADO || orc === BUDGET_SITUATION.CANCELADO) &&
    pago === PAYMENT_STATUS.PAGO
  ) {
    issues.push({
      fields: ["situacao", "situacao_do_pagamento"],
      message: `Orçamento ${orc} marcado como Pago`,
      suggestion: "Revise: orçamentos recusados/cancelados normalmente não são pagos",
    });
  }

  // 4. Orçamento Aprovado com pagamento Cancelado
  if (orc === BUDGET_SITUATION.APROVADO && pago === PAYMENT_STATUS.CANCELADO) {
    issues.push({
      fields: ["situacao", "situacao_do_pagamento"],
      message: "Orçamento Aprovado mas pagamento Cancelado",
      suggestion: "Verifique se o orçamento deveria estar como Recusado",
    });
  }

  // 5. Parcelado mas marcado como Pago integral
  if (forma === PAYMENT_METHOD.PARCELADO && pago === PAYMENT_STATUS.PAGO && vTotal > 0 && vPago > 0 && vPago < vTotal) {
    issues.push({
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: "Parcelado e Pago, mas valor pago < valor total",
      suggestion: "Use status Parcial",
    });
  }

  // 6. Valor pago > 0 mas status Pendente
  if (pago === PAYMENT_STATUS.PENDENTE && vPago > 0) {
    issues.push({
      fields: ["situacao_do_pagamento"],
      message: `Status Pendente, mas valor pago = ${vPago}`,
      suggestion: "Use Parcial ou Pago conforme o caso",
    });
  }

  // 7. Atrasado em orçamento ainda Em Análise
  if (pago === PAYMENT_STATUS.ATRASADO && (orc === BUDGET_SITUATION.EM_ANALISE || orc === BUDGET_SITUATION.EM_NEGOCIACAO)) {
    issues.push({
      fields: ["situacao", "situacao_do_pagamento"],
      message: `Pagamento Atrasado em orçamento ${orc}`,
      suggestion: "Orçamentos não aprovados normalmente não têm pagamento atrasado",
    });
  }

  // 8. Faturado sem forma de pagamento definida
  if (pago === PAYMENT_STATUS.FATURADO && !forma) {
    issues.push({
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: "Faturado mas sem forma de pagamento",
      suggestion: "Defina como será cobrado (boleto, transferência, etc)",
    });
  }

  return issues;
}
