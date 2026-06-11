/**
 * Pure coercion helpers used by the Universal Importer.
 * Extracted so they can be unit-tested without React/Supabase deps.
 */

import { CANONICAL_BY_ID } from "./canonicalSchema";
import { parseFinancialNumber } from "@/lib/financialNumberParser";

/**
 * Date parser BR-first. Aceita dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd, ISO.
 * NUNCA usa `new Date(string)` antes do parser BR (evita inversão de dd/mm).
 */
export function parseDateBRFirst(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    const d = parseInt(br[1], 10);
    const m = parseInt(br[2], 10);
    let y = parseInt(br[3], 10);
    if (br[3].length === 2) y = 2000 + y;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
    return null;
  }
  const iso = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime()) && s.length >= 10) return dt.toISOString().slice(0, 10);
  return null;
}

/** Coerce raw cell to canonical-typed value. Retorna { value, warning? } */
export function coerce(canonicalId: string, raw: unknown): { value: unknown; warning?: string } {
  const f = CANONICAL_BY_ID[canonicalId];
  if (!f) return { value: raw };
  const s = String(raw ?? "").trim();
  if (!s) return { value: null };
  switch (f.type) {
    case "monetary":
    case "number":
    case "percent": {
      const n = parseFinancialNumber(s);
      if (n === null) return { value: null, warning: `valor não numérico em ${f.label}: "${s}"` };
      return { value: n };
    }
    case "date": {
      const d = parseDateBRFirst(s);
      if (d === null) return { value: null, warning: `data inválida em ${f.label}: "${s}"` };
      return { value: d };
    }
    case "cpf":
    case "cnpj":
    case "phone":
      return { value: s.replace(/\D/g, "") };
    case "geo": {
      const n = parseFinancialNumber(s);
      return { value: n };
    }
    default:
      return { value: s };
  }
}
