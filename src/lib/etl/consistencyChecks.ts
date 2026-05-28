/**
 * Cross-field consistency checks for budget rows during import.
 * Returns warnings (not blocking) when payment method + payment status +
 * budget situation form an unlikely combination.
 *
 * As regras podem ser ativadas/desativadas individualmente (e também os
 * auto-fixes) via `consistencyRulesConfig`.
 */
import { PAYMENT_STATUS, PAYMENT_METHOD, BUDGET_SITUATION } from "@/constants/budgetStatus";
import { getRuleConfig, type RuleConfig } from "@/lib/etl/consistencyRulesConfig";

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

export function checkBudgetRowConsistency(
  row: BudgetRow,
  config?: RuleConfig
): ConsistencyIssue[] {
  const cfg = config ?? getRuleConfig();
  const issues: ConsistencyIssue[] = [];
  const forma = row.forma_de_pagamento || null;
  const pago = row.situacao_do_pagamento || null;
  const orc = row.situacao || null;
  const vPago = num(row.valor_pago);
  const vTotal = num(row.valor_total);

  // 1. Pago without forma de pagamento — apenas avisar (não corrigir automaticamente)
  if (pago === PAYMENT_STATUS.PAGO && !forma) {
    issues.push({
      code: "PAGO_SEM_FORMA",
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: "Marcado como Pago, mas sem forma de pagamento",
      suggestion: "Defina manualmente a forma de pagamento usada",
    });
  }

  // 2. Cancelado with forma de pagamento — apenas avisar; preservar a forma como histórico da tentativa original
  if (pago === PAYMENT_STATUS.CANCELADO && forma) {
    issues.push({
      code: "CANCELADO_COM_FORMA",
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: `Pagamento Cancelado com forma "${forma}" preenchida`,
      suggestion: "Forma preservada como histórico da tentativa original; revise se necessário",
    });
  }

  // 3. Orçamento Recusado/Cancelado com pagamento Pago
  if (
    (orc === BUDGET_SITUATION.RECUSADO || orc === BUDGET_SITUATION.CANCELADO) &&
    pago === PAYMENT_STATUS.PAGO
  ) {
    issues.push({
      code: "RECUSADO_CANCELADO_PAGO",
      fields: ["situacao", "situacao_do_pagamento"],
      message: `Orçamento ${orc} marcado como Pago`,
      suggestion: "Revise: orçamentos recusados/cancelados normalmente não são pagos",
      autoFix: { situacao_do_pagamento: PAYMENT_STATUS.CANCELADO },
      autoFixLabel: `Alterar pagamento para "${PAYMENT_STATUS.CANCELADO}"`,
    });
  }

  // 4. Orçamento Aprovado com pagamento Cancelado
  if (orc === BUDGET_SITUATION.APROVADO && pago === PAYMENT_STATUS.CANCELADO) {
    issues.push({
      code: "APROVADO_PAGAMENTO_CANCELADO",
      fields: ["situacao", "situacao_do_pagamento"],
      message: "Orçamento Aprovado mas pagamento Cancelado",
      suggestion: "Verifique se o orçamento deveria estar como Recusado",
      autoFix: { situacao_do_pagamento: PAYMENT_STATUS.PENDENTE },
      autoFixLabel: `Alterar pagamento para "${PAYMENT_STATUS.PENDENTE}"`,
    });
  }

  // 5. Parcelado mas marcado como Pago integral
  if (forma === PAYMENT_METHOD.PARCELADO && pago === PAYMENT_STATUS.PAGO && vTotal > 0 && vPago > 0 && vPago < vTotal) {
    issues.push({
      code: "PARCELADO_PAGO_PARCIAL",
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: "Parcelado e Pago, mas valor pago < valor total",
      suggestion: "Use status Parcial",
      autoFix: { situacao_do_pagamento: PAYMENT_STATUS.PARCIAL },
      autoFixLabel: `Alterar pagamento para "${PAYMENT_STATUS.PARCIAL}"`,
    });
  }

  // 6. Valor pago > 0 mas status Pendente
  if (pago === PAYMENT_STATUS.PENDENTE && vPago > 0) {
    const target = vTotal > 0 && vPago >= vTotal ? PAYMENT_STATUS.PAGO : PAYMENT_STATUS.PARCIAL;
    issues.push({
      code: "PENDENTE_COM_VALOR_PAGO",
      fields: ["situacao_do_pagamento"],
      message: `Status Pendente, mas valor pago = ${vPago}`,
      suggestion: "Use Parcial ou Pago conforme o caso",
      autoFix: { situacao_do_pagamento: target },
      autoFixLabel: `Alterar pagamento para "${target}"`,
    });
  }

  // 7. Atrasado em orçamento ainda Em Análise
  if (pago === PAYMENT_STATUS.ATRASADO && (orc === BUDGET_SITUATION.EM_ANALISE || orc === BUDGET_SITUATION.EM_NEGOCIACAO)) {
    issues.push({
      code: "ATRASADO_EM_ANALISE",
      fields: ["situacao", "situacao_do_pagamento"],
      message: `Pagamento Atrasado em orçamento ${orc}`,
      suggestion: "Orçamentos não aprovados normalmente não têm pagamento atrasado",
      autoFix: { situacao_do_pagamento: PAYMENT_STATUS.PENDENTE },
      autoFixLabel: `Alterar pagamento para "${PAYMENT_STATUS.PENDENTE}"`,
    });
  }

  // 8. Faturado sem forma de pagamento — apenas avisar (não assumir forma padrão)
  if (pago === PAYMENT_STATUS.FATURADO && !forma) {
    issues.push({
      code: "FATURADO_SEM_FORMA",
      fields: ["forma_de_pagamento", "situacao_do_pagamento"],
      message: "Faturado mas sem forma de pagamento",
      suggestion: "Defina manualmente como será cobrado",
    });
  }

  // Aplica a configuração: filtra regras desabilitadas e remove auto-fix das que tiveram auto-fix desligado.
  return issues
    .filter((i) => cfg[i.code]?.enabled !== false)
    .map((i) => {
      if (i.autoFix && cfg[i.code]?.autoFix === false) {
        const { autoFix: _af, autoFixLabel: _afl, ...rest } = i;
        return rest as ConsistencyIssue;
      }
      return i;
    });
}

/**
 * Builds a consolidated patch from all auto-fixable issues for a row.
 * Later rules override earlier ones for the same field (rules are ordered by priority).
 */
export function buildAutoFixPatch(
  issues: ConsistencyIssue[]
): { patch: Record<string, string | null>; appliedCodes: string[] } {
  const patch: Record<string, string | null> = {};
  const appliedCodes: string[] = [];
  for (const issue of issues) {
    if (!issue.autoFix) continue;
    appliedCodes.push(issue.code);
    for (const [k, v] of Object.entries(issue.autoFix)) {
      patch[k] = v;
    }
  }
  return { patch, appliedCodes };
}

