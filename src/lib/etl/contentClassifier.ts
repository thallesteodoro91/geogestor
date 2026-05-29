/**
 * Content-based suggestion of a canonical field id.
 * Complements {@link synonymMatch} (header-based) with value-shape heuristics.
 */

import { normalizeText } from "./textNormalize";
import {
  isFormaPagamentoToken,
  isStatusOrcamentoToken,
} from "@/lib/etl/statusNormalizer";
import { parseFinancialNumber } from "@/lib/financialNumberParser";

const SITUACAO_PAGAMENTO = new Set([
  "pago", "pendente", "cancelado", "em aberto", "aberto", "atrasado", "vencido", "parcial",
]);
const STATUS_ORCAMENTO = new Set([
  "aprovado", "recusado", "em analise", "em análise", "enviado", "faturado", "cancelado", "pendente",
]);

const DATE_RE = /^(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContentSuggestion {
  fieldId: string;
  score: number;          // 0..1
  reason: string;
}

/**
 * Returns the best canonical field id suggested purely by the values seen.
 * `null` when content is not specific enough.
 */
export function classifyByContent(values: unknown[]): ContentSuggestion | null {
  const cleaned = values
    .map(v => String(v ?? "").trim())
    .filter(Boolean);
  const total = cleaned.length;
  if (total === 0) return null;

  let nSituacao = 0, nForma = 0, nStatus = 0, nMon = 0, nDate = 0,
      nCpf = 0, nCnpj = 0, nEmail = 0, nGeoLat = 0, nGeoLng = 0;

  for (const raw of cleaned) {
    const vn = normalizeText(raw).replace(/[^a-z0-9 ]/g, "");
    const vnSoft = String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    if (SITUACAO_PAGAMENTO.has(vnSoft)) nSituacao++;
    if (STATUS_ORCAMENTO.has(vnSoft)) nStatus++;
    if (isFormaPagamentoToken(raw)) nForma++;
    if (isStatusOrcamentoToken(raw)) nStatus++;

    if (EMAIL_RE.test(raw)) nEmail++;
    if (DATE_RE.test(raw)) nDate++;

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && /^[\d.\-/\s]+$/.test(raw)) nCpf++;
    if (digits.length === 14 && /^[\d.\-/\s]+$/.test(raw)) nCnpj++;

    const num = parseFinancialNumber(raw);
    if (num !== null) {
      if (/(R\$|\$|€)/.test(raw) || Math.abs(num) >= 100) nMon++;
      if (num >= -90 && num <= 90 && /[.,]\d{3,}/.test(raw)) nGeoLat++;
      if (num >= -180 && num <= 180 && /[.,]\d{3,}/.test(raw)) nGeoLng++;
    }
    void vn;
  }

  const r = (n: number) => n / total;

  const candidates: ContentSuggestion[] = [];
  if (r(nSituacao) >= 0.5)
    candidates.push({ fieldId: "orcamento.situacao_pagamento", score: r(nSituacao), reason: "valores tipo Pago/Pendente/Cancelado" });
  if (r(nForma) >= 0.5)
    candidates.push({ fieldId: "orcamento.forma_pagamento", score: r(nForma), reason: "valores tipo PIX/Boleto/Cartão" });
  if (r(nStatus) >= 0.5)
    candidates.push({ fieldId: "orcamento.status", score: r(nStatus), reason: "valores tipo Aprovado/Recusado/Em análise" });
  if (r(nEmail) >= 0.6)
    candidates.push({ fieldId: "cliente.email", score: r(nEmail), reason: "formato de e-mail" });
  if (r(nCpf) >= 0.6)
    candidates.push({ fieldId: "cliente.cpf", score: r(nCpf), reason: "11 dígitos" });
  if (r(nCnpj) >= 0.6)
    candidates.push({ fieldId: "cliente.cnpj", score: r(nCnpj), reason: "14 dígitos" });
  if (r(nDate) >= 0.7)
    candidates.push({ fieldId: "orcamento.data_emissao", score: r(nDate) * 0.6, reason: "formato de data (genérico)" });
  if (r(nMon) >= 0.6)
    candidates.push({ fieldId: "financeiro.receita", score: r(nMon) * 0.5, reason: "valores monetários (genérico)" });

  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.score - a.score)[0];
}
