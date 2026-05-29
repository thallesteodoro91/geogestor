/**
 * Header → canonical field matcher built from {@link CANONICAL_FIELDS}.
 * Uses normalized equality, substring and Levenshtein fallback.
 */

import { CANONICAL_FIELDS, type CanonicalField } from "./canonicalSchema";
import { normalizeText, levenshtein } from "./textNormalize";

interface AliasEntry {
  field: CanonicalField;
  alias: string;          // raw alias
  normalized: string;     // normalized alias
}

const ALIAS_INDEX: AliasEntry[] = CANONICAL_FIELDS.flatMap(field =>
  // Always include the field's `key` and `label` along with explicit aliases.
  Array.from(new Set([field.key, field.label, ...field.aliases])).map(alias => ({
    field,
    alias,
    normalized: normalizeText(alias),
  })),
).filter(e => e.normalized.length > 0);

export interface SynonymMatch {
  field: CanonicalField;
  score: number;          // 0..1
  matchedAlias: string;
  reason: "exact" | "substring" | "fuzzy";
}

/**
 * Find the best canonical field for a spreadsheet header.
 * Returns null when no alias is reasonably close.
 */
export function synonymMatch(header: string): SynonymMatch | null {
  const nh = normalizeText(header);
  if (!nh) return null;

  let best: SynonymMatch | null = null;
  const consider = (m: SynonymMatch) => {
    if (!best || m.score > best.score) best = m;
  };

  for (const entry of ALIAS_INDEX) {
    if (entry.normalized === nh) {
      consider({ field: entry.field, score: 1, matchedAlias: entry.alias, reason: "exact" });
      continue;
    }
    if (nh.includes(entry.normalized) || entry.normalized.includes(nh)) {
      // Longer alias overlap → higher score, capped under 0.9.
      const overlap = Math.min(nh.length, entry.normalized.length) /
                      Math.max(nh.length, entry.normalized.length);
      consider({ field: entry.field, score: 0.6 + overlap * 0.3, matchedAlias: entry.alias, reason: "substring" });
      continue;
    }
    // Cheap length pre-filter before Levenshtein
    if (Math.abs(nh.length - entry.normalized.length) > 2) continue;
    const d = levenshtein(nh, entry.normalized);
    if (d <= 2) {
      consider({
        field: entry.field,
        score: 0.5 + (1 - d / Math.max(nh.length, entry.normalized.length)) * 0.3,
        matchedAlias: entry.alias,
        reason: "fuzzy",
      });
    }
  }

  return best && best.score >= 0.45 ? best : null;
}

/** Returns all candidate canonical fields (useful for "did you mean" UI). */
export function synonymCandidates(header: string, limit = 5): SynonymMatch[] {
  const nh = normalizeText(header);
  if (!nh) return [];
  const out: SynonymMatch[] = [];
  for (const entry of ALIAS_INDEX) {
    const d = levenshtein(nh, entry.normalized);
    const maxLen = Math.max(nh.length, entry.normalized.length);
    const score = nh === entry.normalized ? 1
                : nh.includes(entry.normalized) || entry.normalized.includes(nh) ? 0.8
                : 1 - d / Math.max(maxLen, 1);
    out.push({ field: entry.field, score, matchedAlias: entry.alias,
               reason: nh === entry.normalized ? "exact" : score >= 0.7 ? "substring" : "fuzzy" });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
