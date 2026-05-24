/**
 * Status normalizer: converts free-text status values to canonical strings.
 * Used during import so 'Pendente'/'pago'/'PAID' land in the same bucket
 * and never get parsed as numbers.
 */

import { PAYMENT_STATUS, PAYMENT_METHOD, BUDGET_SITUATION } from "@/constants/budgetStatus";

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const PAGAMENTO_MAP: Record<string, string> = {
  "pago": PAYMENT_STATUS.PAGO,
  "paid": PAYMENT_STATUS.PAGO,
  "quitado": PAYMENT_STATUS.PAGO,
  "liquidado": PAYMENT_STATUS.PAGO,
  "pagamento ok": PAYMENT_STATUS.PAGO,
  "recebido": PAYMENT_STATUS.PAGO,
  "ok": PAYMENT_STATUS.PAGO,

  "pendente": PAYMENT_STATUS.PENDENTE,
  "em aberto": PAYMENT_STATUS.PENDENTE,
  "aberto": PAYMENT_STATUS.PENDENTE,
  "a pagar": PAYMENT_STATUS.PENDENTE,
  "a receber": PAYMENT_STATUS.PENDENTE,
  "nao pago": PAYMENT_STATUS.PENDENTE,
  "não pago": PAYMENT_STATUS.PENDENTE,
  "aguardando": PAYMENT_STATUS.PENDENTE,
  "aguardando pagamento": PAYMENT_STATUS.PENDENTE,

  "atrasado": PAYMENT_STATUS.ATRASADO,
  "vencido": PAYMENT_STATUS.ATRASADO,
  "em atraso": PAYMENT_STATUS.ATRASADO,
  "overdue": PAYMENT_STATUS.ATRASADO,

  "cancelado": PAYMENT_STATUS.CANCELADO,
  "canceled": PAYMENT_STATUS.CANCELADO,
  "cancelled": PAYMENT_STATUS.CANCELADO,

  "parcial": PAYMENT_STATUS.PARCIAL,
  "pagamento parcial": PAYMENT_STATUS.PARCIAL,
  "parcialmente pago": PAYMENT_STATUS.PARCIAL,

  "faturado": PAYMENT_STATUS.FATURADO,
  "invoiced": PAYMENT_STATUS.FATURADO,
  "nota emitida": PAYMENT_STATUS.FATURADO,
};

const FORMA_PAGAMENTO_MAP: Record<string, string> = {
  "pix": PAYMENT_METHOD.PIX,

  "dinheiro": PAYMENT_METHOD.DINHEIRO,
  "especie": PAYMENT_METHOD.DINHEIRO,
  "espécie": PAYMENT_METHOD.DINHEIRO,
  "cash": PAYMENT_METHOD.DINHEIRO,
  "a vista": PAYMENT_METHOD.DINHEIRO,
  "à vista": PAYMENT_METHOD.DINHEIRO,

  "cartao": PAYMENT_METHOD.CARTAO,
  "cartão": PAYMENT_METHOD.CARTAO,
  "card": PAYMENT_METHOD.CARTAO,

  "cartao de credito": PAYMENT_METHOD.CARTAO_CREDITO,
  "cartao credito": PAYMENT_METHOD.CARTAO_CREDITO,
  "credito": PAYMENT_METHOD.CARTAO_CREDITO,
  "crédito": PAYMENT_METHOD.CARTAO_CREDITO,
  "credit": PAYMENT_METHOD.CARTAO_CREDITO,

  "cartao de debito": PAYMENT_METHOD.CARTAO_DEBITO,
  "cartao debito": PAYMENT_METHOD.CARTAO_DEBITO,
  "debito": PAYMENT_METHOD.CARTAO_DEBITO,
  "débito": PAYMENT_METHOD.CARTAO_DEBITO,
  "debit": PAYMENT_METHOD.CARTAO_DEBITO,

  "transferencia": PAYMENT_METHOD.TRANSFERENCIA,
  "transferência": PAYMENT_METHOD.TRANSFERENCIA,
  "ted": PAYMENT_METHOD.TRANSFERENCIA,
  "doc": PAYMENT_METHOD.TRANSFERENCIA,
  "transfer": PAYMENT_METHOD.TRANSFERENCIA,
  "wire": PAYMENT_METHOD.TRANSFERENCIA,

  "boleto": PAYMENT_METHOD.BOLETO,
  "boleto bancario": PAYMENT_METHOD.BOLETO,
  "boleto bancário": PAYMENT_METHOD.BOLETO,
  "bank slip": PAYMENT_METHOD.BOLETO,

  "parcelado": PAYMENT_METHOD.PARCELADO,
  "parcelamento": PAYMENT_METHOD.PARCELADO,
  "a prazo": PAYMENT_METHOD.PARCELADO,
  "prazo": PAYMENT_METHOD.PARCELADO,
  "installment": PAYMENT_METHOD.PARCELADO,

  "outro": PAYMENT_METHOD.OUTRO,
  "outros": PAYMENT_METHOD.OUTRO,
  "other": PAYMENT_METHOD.OUTRO,
};

const STATUS_ORCAMENTO_MAP: Record<string, string> = {
  "aprovado": BUDGET_SITUATION.APROVADO,
  "approved": BUDGET_SITUATION.APROVADO,
  "aceito": BUDGET_SITUATION.APROVADO,

  "enviado": BUDGET_SITUATION.EM_ANALISE,
  "sent": BUDGET_SITUATION.EM_ANALISE,
  "em analise": BUDGET_SITUATION.EM_ANALISE,
  "em análise": BUDGET_SITUATION.EM_ANALISE,
  "analise": BUDGET_SITUATION.EM_ANALISE,
  "análise": BUDGET_SITUATION.EM_ANALISE,
  "pending review": BUDGET_SITUATION.EM_ANALISE,
  "novo": BUDGET_SITUATION.EM_ANALISE,
  "rascunho": BUDGET_SITUATION.EM_ANALISE,
  "draft": BUDGET_SITUATION.EM_ANALISE,

  "em negociacao": BUDGET_SITUATION.EM_NEGOCIACAO,
  "em negociação": BUDGET_SITUATION.EM_NEGOCIACAO,
  "negociacao": BUDGET_SITUATION.EM_NEGOCIACAO,
  "negociação": BUDGET_SITUATION.EM_NEGOCIACAO,
  "negotiating": BUDGET_SITUATION.EM_NEGOCIACAO,

  "recusado": BUDGET_SITUATION.RECUSADO,
  "rejeitado": BUDGET_SITUATION.RECUSADO,
  "rejected": BUDGET_SITUATION.RECUSADO,
  "negado": BUDGET_SITUATION.RECUSADO,
  "perdido": BUDGET_SITUATION.RECUSADO,

  "cancelado": BUDGET_SITUATION.CANCELADO,
  "canceled": BUDGET_SITUATION.CANCELADO,
  "cancelled": BUDGET_SITUATION.CANCELADO,

  "pendente": BUDGET_SITUATION.PENDENTE,
  "aguardando": BUDGET_SITUATION.PENDENTE,

  "concluido": BUDGET_SITUATION.APROVADO,
  "concluído": BUDGET_SITUATION.APROVADO,
  "finalizado": BUDGET_SITUATION.APROVADO,
  "encerrado": BUDGET_SITUATION.APROVADO,
  "completed": BUDGET_SITUATION.APROVADO,
};

const SERVICO_MAP: Record<string, string> = {
  "pendente": "Pendente",
  "novo": "Pendente",
  "agendado": "Pendente",
  "em andamento": "Em andamento",
  "andamento": "Em andamento",
  "iniciado": "Em andamento",
  "concluido": "Concluído",
  "concluído": "Concluído",
  "finalizado": "Concluído",
  "encerrado": "Concluído",
  "cancelado": "Cancelado",
  "aprovado": "Aprovado",
  "rejeitado": "Rejeitado",
  "recusado": "Rejeitado",
};

export function normalizeStatusPagamento(value: unknown): string | null {
  const v = norm(value);
  if (!v) return null;
  return PAGAMENTO_MAP[v] ?? null;
}

export function normalizeFormaPagamento(value: unknown): string | null {
  const v = norm(value);
  if (!v) return null;
  // exact match first
  if (FORMA_PAGAMENTO_MAP[v]) return FORMA_PAGAMENTO_MAP[v];
  // contains-based match (e.g. "Cartão de Crédito Visa" → CARTAO_CREDITO)
  for (const [key, canonical] of Object.entries(FORMA_PAGAMENTO_MAP)) {
    if (key.length >= 4 && v.includes(key)) return canonical;
  }
  return null;
}

export function normalizeStatusOrcamento(value: unknown): string | null {
  const v = norm(value);
  if (!v) return null;
  return STATUS_ORCAMENTO_MAP[v] ?? null;
}

export function normalizeStatusServico(value: unknown): string | null {
  const v = norm(value);
  if (!v) return null;
  return SERVICO_MAP[v] ?? null;
}

/** True if the value looks like a payment status token. */
export function isStatusToken(value: unknown): boolean {
  const v = norm(value);
  if (!v) return false;
  return v in PAGAMENTO_MAP || v in SERVICO_MAP;
}

/** True if the value looks like a payment method token. */
export function isFormaPagamentoToken(value: unknown): boolean {
  return normalizeFormaPagamento(value) !== null;
}

/** True if the value looks like a budget status token. */
export function isStatusOrcamentoToken(value: unknown): boolean {
  const v = norm(value);
  if (!v) return false;
  return v in STATUS_ORCAMENTO_MAP;
}
