/**
 * Status normalizer: converts free-text status values to canonical strings.
 * Used during import so 'Pendente'/'pago'/'PAID' land in the same bucket
 * and never get parsed as numbers.
 */

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const PAGAMENTO_MAP: Record<string, string> = {
  "pago": "Pago",
  "paid": "Pago",
  "quitado": "Pago",
  "liquidado": "Pago",
  "pagamento ok": "Pago",
  "recebido": "Pago",

  "pendente": "Pendente",
  "em aberto": "Pendente",
  "aberto": "Pendente",
  "a pagar": "Pendente",
  "a receber": "Pendente",
  "nao pago": "Pendente",
  "não pago": "Pendente",

  "atrasado": "Atrasado",
  "vencido": "Atrasado",
  "em atraso": "Atrasado",
  "overdue": "Atrasado",

  "cancelado": "Cancelado",
  "canceled": "Cancelado",
  "cancelled": "Cancelado",

  "parcial": "Parcial",
  "pagamento parcial": "Parcial",

  "faturado": "Faturado",
  "invoiced": "Faturado",
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

export function normalizeStatusServico(value: unknown): string | null {
  const v = norm(value);
  if (!v) return null;
  return SERVICO_MAP[v] ?? null;
}

/** True if the value looks like a status token (non-monetary, non-date). */
export function isStatusToken(value: unknown): boolean {
  const v = norm(value);
  if (!v) return false;
  return v in PAGAMENTO_MAP || v in SERVICO_MAP;
}
