/**
 * Explode a "wide" spreadsheet row into the canonical entities it carries.
 * Columns that have no canonical destination flow into `customFields` of the
 * most-relevant entity (cliente by default, otherwise the row-level entity
 * with at least one populated key).
 */

import type { HybridMatch } from "./hybridMatcher";
import type { CanonicalEntity } from "./canonicalSchema";

export type ExplodedRow = Partial<Record<CanonicalEntity, Record<string, unknown>>> & {
  customFieldsByEntity: Partial<Record<CanonicalEntity, Record<string, unknown>>>;
};

export function explodeRow(
  headers: string[],
  matches: HybridMatch[],
  row: unknown[],
): ExplodedRow {
  const out: ExplodedRow = { customFieldsByEntity: {} };

  // First pass: which canonical entities are present?
  const presentEntities = new Set<CanonicalEntity>();
  matches.forEach((m, idx) => {
    if (m.field && row[idx] != null && String(row[idx]).trim() !== "") {
      presentEntities.add(m.field.entity);
    }
  });

  // Decide default bucket for orphan columns (prefer the most "anchoring" entity present)
  const priority: CanonicalEntity[] = ["cliente", "propriedade", "orcamento", "servico", "financeiro", "endereco"];
  const orphanBucket: CanonicalEntity =
    priority.find(e => presentEntities.has(e)) ?? "cliente";

  matches.forEach((m, idx) => {
    const raw = row[idx];
    if (raw == null || String(raw).trim() === "") return;

    if (m.field) {
      const e = m.field.entity;
      (out[e] ??= {})[m.field.key] = raw;
    } else {
      const bag = (out.customFieldsByEntity[orphanBucket] ??= {});
      bag[headers[idx]] = raw;
    }
  });

  return out;
}
