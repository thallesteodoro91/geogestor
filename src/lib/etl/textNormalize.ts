/**
 * Shared text normalization for the universal importer.
 * Aggressive lowercase + remove accents + strip separators.
 */

export const normalizeText = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s\-./*]/g, "")
    .trim();

/** Soft normalization: keeps spaces. Use for human-facing comparisons. */
export const normalizeSoft = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Levenshtein distance (iterative, O(n*m) time, O(min(n,m)) space). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length < b.length) [a, b] = [b, a];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

/** True when normalized strings match exactly, by substring, or within `maxDist` Levenshtein. */
export function fuzzyMatch(a: string, b: string, maxDist = 2): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  if (Math.abs(na.length - nb.length) > maxDist) return false;
  return levenshtein(na, nb) <= maxDist;
}
