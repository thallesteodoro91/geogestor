/**
 * Hybrid header+content matcher that produces the final canonical field
 * suggestion per spreadsheet column.
 *
 *   score = 0.6 * headerScore + 0.4 * contentScore
 *
 * - When both header and content agree, the score is boosted (capped at 1).
 * - When only one signal exists, the other contributes 0.
 * - Below 0.45 the column is considered "no destination" (custom field candidate).
 */

import { CANONICAL_BY_ID, type CanonicalField } from "./canonicalSchema";
import { synonymMatch } from "./synonymsDictionary";
import { classifyByContent } from "./contentClassifier";

export interface HybridMatch {
  header: string;
  field: CanonicalField | null;
  score: number;
  headerScore: number;
  contentScore: number;
  reason: string;
  /** When true, no canonical destination — store as custom field. */
  isCustomField: boolean;
}

export const HYBRID_ACCEPT_THRESHOLD = 0.45;

export function matchColumn(header: string, samples: unknown[]): HybridMatch {
  const syn = synonymMatch(header);
  const content = classifyByContent(samples);

  const headerField = syn?.field ?? null;
  const contentField = content ? CANONICAL_BY_ID[content.fieldId] ?? null : null;

  const headerScore = syn?.score ?? 0;
  const contentScore = content?.score ?? 0;

  // Pick winner: prefer field that both signals agree on.
  let winner: CanonicalField | null = null;
  let combined = 0;
  let reason = "";

  if (headerField && contentField && headerField.id === contentField.id) {
    winner = headerField;
    combined = Math.min(1, 0.6 * headerScore + 0.4 * contentScore + 0.15);
    reason = `header "${syn!.matchedAlias}" + conteúdo (${content!.reason})`;
  } else if (headerField && headerScore >= contentScore) {
    winner = headerField;
    combined = 0.6 * headerScore + 0.4 * contentScore;
    reason = `header "${syn!.matchedAlias}"`;
  } else if (contentField) {
    winner = contentField;
    combined = 0.6 * headerScore + 0.4 * contentScore;
    reason = `conteúdo (${content!.reason})`;
  } else if (headerField) {
    winner = headerField;
    combined = 0.6 * headerScore;
    reason = `header "${syn!.matchedAlias}"`;
  }

  const accepted = winner && combined >= HYBRID_ACCEPT_THRESHOLD;
  return {
    header,
    field: accepted ? winner : null,
    score: combined,
    headerScore,
    contentScore,
    reason: accepted ? reason : (reason || "sem correspondência confiável"),
    isCustomField: !accepted,
  };
}

export function matchAllColumns(
  headers: string[],
  rows: unknown[][],
  sampleSize = 50,
): HybridMatch[] {
  const sampled = rows.slice(0, sampleSize);
  return headers.map((h, idx) => matchColumn(h, sampled.map(r => r?.[idx])));
}
