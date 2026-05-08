/**
 * Robust financial number parser.
 * Accepts BR, US, accounting (parenthesis), suffixes (k/m), Excel serials, NBSP.
 *
 * Rules:
 * - Strips currency symbols (R$, $, €, £) and whitespace incl. NBSP.
 * - "(1.500)" → -1500 (accounting negative).
 * - Locale auto-detected from last separator: if the LAST `,` is followed by 1–2 digits → BR;
 *   if the LAST `.` is followed by 1–2 digits and there is also a `,` thousands grouping → US.
 * - "1.2k" → 1200, "1,5m" → 1_500_000.
 * - Empty / non-numeric → null.
 */

const CURRENCY_RE = /(R\$|US\$|\$|€|£)/gi;
const WHITESPACE_RE = /[\s\u00a0\u202f]/g; // includes NBSP and narrow NBSP

export function parseFinancialNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  let s = String(input).trim();
  if (!s) return null;

  // Accounting negative: (1.500,00) → -1500
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  }

  s = s.replace(CURRENCY_RE, "").replace(WHITESPACE_RE, "");

  // Suffix multipliers
  let multiplier = 1;
  const suffixMatch = s.match(/([kKmMbB])$/);
  if (suffixMatch) {
    const sfx = suffixMatch[1].toLowerCase();
    multiplier = sfx === "k" ? 1_000 : sfx === "m" ? 1_000_000 : 1_000_000_000;
    s = s.slice(0, -1);
  }

  if (!s) return null;

  // Detect locale from separators
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Whichever comes LAST is the decimal separator
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // BR: 12.500,00
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 12,500.00
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only comma. If 1–2 digits after last comma → BR decimal, else thousands.
    const parts = s.split(",");
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length <= 2) {
      s = parts[0].replace(/\./g, "") + "." + last;
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasDot) {
    // Only dots. If multiple dots OR 3 digits after last dot → BR thousands; else decimal.
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 2 || (parts.length === 2 && last.length === 3 && parts[0].length <= 3)) {
      // 12.500 or 1.234.567 → BR thousands
      s = s.replace(/\./g, "");
    }
    // else "1.5" stays as-is (US decimal)
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return (negative ? -n : n) * multiplier;
}

/** Returns 0 when input is unparsable — convenience for sums. */
export function parseFinancialNumberOrZero(input: unknown): number {
  return parseFinancialNumber(input) ?? 0;
}
