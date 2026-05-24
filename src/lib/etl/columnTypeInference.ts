/**
 * Content-based column type inference.
 * Looks at a SAMPLE of values (not just header) to decide what a column REALLY is.
 *
 * This prevents bugs like:
 *   - "Situação do Pagamento" → being parsed as monetary
 *   - "Pendente" → being converted to a number
 *   - "Data do Faturamento" → mapped as receita
 */

import { parseFinancialNumber } from "@/lib/financialNumberParser";
import {
  isFormaPagamentoToken,
  isStatusOrcamentoToken,
} from "@/lib/etl/statusNormalizer";

export type ColumnType =
  | "monetario"
  | "percentual"
  | "data"
  | "status"
  | "forma_pagamento"
  | "status_orcamento"
  | "documento"
  | "telefone"
  | "email"
  | "categoria"
  | "subcategoria"
  | "texto"
  | "numero"
  | "booleano"
  | "vazio";

export interface InferredColumn {
  header: string;
  type: ColumnType;
  confidence: number; // 0..1
  sampleSize: number;
}

const STATUS_VOCAB = new Set([
  "pago", "pendente", "cancelado", "aprovado", "faturado", "atrasado",
  "em aberto", "aberto", "concluido", "concluído", "em andamento", "andamento",
  "rejeitado", "recusado", "negociacao", "negociação", "ativo", "inativo",
  "encerrado", "vencido", "quitado", "parcial", "agendado", "iniciado",
  "finalizado", "novo", "em pagamento", "nao pago", "não pago",
]);

const DATE_RE = /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\s\-().+\d]{8,}$/;
const CPF_CNPJ_RE = /^[\d.\-/\s]{11,18}$/;
const PERCENT_RE = /%\s*$/;
const MONEY_HINT_RE = /(R\$|US\$|\$|€|£)/;

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function looksLikeStatus(v: string): boolean {
  if (!v) return false;
  if (v.length > 30) return false;
  return STATUS_VOCAB.has(v);
}

function looksLikeMonetary(v: string): boolean {
  if (!v) return false;
  if (looksLikeStatus(v)) return false;
  // Has explicit currency or accounting marker
  if (MONEY_HINT_RE.test(v)) return true;
  if (/^\(.*\)$/.test(v)) return true;
  // Pure number-like (digits with separators); reject if it looks like a date or doc
  if (DATE_RE.test(v)) return false;
  // CPF/CNPJ with dots/slashes — too many separators for typical money
  const seps = (v.match(/[.,]/g) || []).length;
  if (seps > 3) return false;
  return parseFinancialNumber(v) !== null && /\d/.test(v);
}

function looksLikeDate(v: string): boolean {
  if (!v) return false;
  return DATE_RE.test(v);
}

export function inferColumnType(header: string, samples: unknown[]): InferredColumn {
  const headerN = norm(header);
  const values = samples.map(s => String(s ?? "").trim()).filter(Boolean);
  const total = values.length;

  if (total === 0) {
    return { header, type: "vazio", confidence: 1, sampleSize: 0 };
  }

  let nMonetary = 0, nDate = 0, nStatus = 0, nEmail = 0, nPhone = 0,
      nDoc = 0, nPercent = 0, nNumber = 0, nBoolean = 0,
      nFormaPag = 0, nStatusOrc = 0;

  const distinct = new Set<string>();
  let totalLen = 0;

  for (const raw of values) {
    const v = raw;
    const vn = norm(v);
    distinct.add(vn);
    totalLen += v.length;

    if (PERCENT_RE.test(v)) nPercent++;
    if (looksLikeStatus(vn)) nStatus++;
    if (isFormaPagamentoToken(v)) nFormaPag++;
    if (isStatusOrcamentoToken(v)) nStatusOrc++;
    if (EMAIL_RE.test(v)) nEmail++;
    if (PHONE_RE.test(v) && /\d{4}/.test(v) && !looksLikeMonetary(v)) nPhone++;
    if (CPF_CNPJ_RE.test(v) && (v.replace(/\D/g, "").length === 11 || v.replace(/\D/g, "").length === 14)) nDoc++;
    if (looksLikeDate(v)) nDate++;
    else if (looksLikeMonetary(v)) nMonetary++;
    if (/^(sim|nao|não|true|false|1|0|yes|no)$/i.test(v)) nBoolean++;
    if (/^-?\d+(\.\d+)?$/.test(v) && !looksLikeDate(v)) nNumber++;
  }

  const ratio = (n: number) => n / total;

  // Header hints help disambiguate
  const headerSuggestsForma = /(forma|meio|metodo|método|modalidade|tipo)\s*(de)?\s*pag/.test(headerN)
    || /^pagamento$/.test(headerN) || /payment.*(method|type)/.test(headerN);
  const headerSuggestsStatusOrc = /(status|situacao|situação|estado).*(orcament|orçament|proposta|venda)/.test(headerN)
    || /^(status|situacao|situação)$/.test(headerN);

  // Priority order: forma_pagamento → status_orcamento → status → date → ...
  if (ratio(nFormaPag) >= 0.5 && distinct.size <= 12) {
    return { header, type: "forma_pagamento", confidence: ratio(nFormaPag), sampleSize: total };
  }
  if (ratio(nStatusOrc) >= 0.5 && distinct.size <= 12 && headerSuggestsStatusOrc) {
    return { header, type: "status_orcamento", confidence: ratio(nStatusOrc), sampleSize: total };
  }
  if (ratio(nStatus) >= 0.5 && distinct.size <= 12) {
    return { header, type: "status", confidence: ratio(nStatus), sampleSize: total };
  }
  if (ratio(nDate) >= 0.7) {
    return { header, type: "data", confidence: ratio(nDate), sampleSize: total };
  }
  if (ratio(nEmail) >= 0.6) {
    return { header, type: "email", confidence: ratio(nEmail), sampleSize: total };
  }
  if (ratio(nDoc) >= 0.6 && /cpf|cnpj|documento|doc/.test(headerN)) {
    return { header, type: "documento", confidence: ratio(nDoc), sampleSize: total };
  }
  if (ratio(nPhone) >= 0.6 && /(fone|tel|cel|whats|contato)/.test(headerN)) {
    return { header, type: "telefone", confidence: ratio(nPhone), sampleSize: total };
  }
  if (ratio(nPercent) >= 0.6) {
    return { header, type: "percentual", confidence: ratio(nPercent), sampleSize: total };
  }
  // Header strongly suggests forma de pagamento — accept lower content ratio
  if (headerSuggestsForma && ratio(nFormaPag) >= 0.2 && !looksLikeMonetary(values[0] || "")) {
    return { header, type: "forma_pagamento", confidence: Math.max(0.5, ratio(nFormaPag)), sampleSize: total };
  }
  if (ratio(nMonetary) >= 0.6) {
    return { header, type: "monetario", confidence: ratio(nMonetary), sampleSize: total };
  }
  if (ratio(nBoolean) >= 0.8) {
    return { header, type: "booleano", confidence: ratio(nBoolean), sampleSize: total };
  }
  if (ratio(nNumber) >= 0.7) {
    return { header, type: "numero", confidence: ratio(nNumber), sampleSize: total };
  }
  // Categoria heuristic: low cardinality, short values
  const avgLen = totalLen / total;
  if (distinct.size <= Math.max(8, total * 0.2) && avgLen <= 30) {
    if (/sub.?categ/.test(headerN)) {
      return { header, type: "subcategoria", confidence: 0.6, sampleSize: total };
    }
    return { header, type: "categoria", confidence: 0.6, sampleSize: total };
  }

  return { header, type: "texto", confidence: 0.4, sampleSize: total };
}

export function inferColumnTypes(headers: string[], rows: unknown[][], maxSamples = 50): InferredColumn[] {
  const sampled = rows.slice(0, maxSamples);
  return headers.map((h, idx) => {
    const samples = sampled.map(r => r?.[idx]);
    return inferColumnType(h, samples);
  });
}

/** True if the inferred type can carry a monetary value. Used to BLOCK financial mappings on text columns. */
export function isMonetaryCompatible(type: ColumnType): boolean {
  return type === "monetario" || type === "numero";
}
