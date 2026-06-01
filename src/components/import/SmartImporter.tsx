/**
 * SmartImporter — thin compatibility wrapper around the Universal Importer.
 *
 * The legacy multi-step wizard (with MappingValidationPanel, per-entity
 * SYSTEM_FIELDS, consistency auto-fix, etc.) has been replaced by the
 * universal pipeline:
 *
 *   File → headers/rows → hybrid match → UniversalValidationPanel
 *        → explodeRow → resolveRelations → batch insert → refresh KPIs
 *
 * The `entityType` prop is preserved for call-site compatibility but is no
 * longer used to switch behavior — the universal pipeline detects entities
 * automatically from the spreadsheet content. Callers can keep using
 * <SmartImporter open ... entityType="orcamentos" /> with no changes.
 */

import { UniversalImporter } from "@/components/import/UniversalImporter";

export type ImportEntityType =
  | "clientes"
  | "propriedades"
  | "orcamentos"
  | "servicos"
  | "despesas"
  | "completo";

interface SmartImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /**
   * @deprecated The universal importer auto-detects every entity in the
   * spreadsheet. This prop is accepted for backward compatibility but has
   * no runtime effect.
   */
  entityType?: ImportEntityType;
}

export function SmartImporter({ open, onOpenChange, onSuccess }: SmartImporterProps) {
  return (
    <UniversalImporter
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}
