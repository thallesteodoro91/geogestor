export type ProjectAssociationMethod = 'document' | 'exact_name' | 'manual' | 'internal_id';

export type ProjectImportPreviewRow = {
  index: number;
  row: number;
  projectName: string;
  reference: string;
  status: 'resolved' | 'pending';
  reason: ProjectAssociationMethod | 'missing' | 'ambiguous' | 'invalid_document' | 'manual_pending' | 'invalid_row';
  message: string;
  association?: {
    clientId: string;
    clientName: string;
    documentMasked: string | null;
    municipality: string | null;
    method: ProjectAssociationMethod;
  };
};

export type ProjectImportPreview = {
  status: 'ready' | 'blocked';
  counts: ProjectImportPreviewCounts;
  rows: ProjectImportPreviewRow[];
};

export type ProjectImportPreviewCounts = {
  total: number;
  automatic: number;
  manual: number;
  pending: number;
  missing: number;
  ambiguous: number;
  invalid: number;
};

export type ProjectImportClientOption = {
  id: string;
  nome: string;
  documentoMascarado: string | null;
  municipio: string | null;
};

export type ProjectAssociationOverride = { clientId?: string; keepPending?: boolean };

export function applyProjectAssociationOverride(
  row: Record<string, string>,
  override?: ProjectAssociationOverride
): Record<string, unknown> {
  if (!override) return { ...row };
  if (override.keepPending) {
    return { ...row, clienteId: undefined, associacaoManual: false, associacaoPendente: true };
  }
  if (override.clientId) {
    return { ...row, clienteId: override.clientId, associacaoManual: true, associacaoPendente: false };
  }
  return { ...row };
}

export function summarizeProjectPreviewRows(rows: ProjectImportPreviewRow[]): ProjectImportPreviewCounts {
  return {
    total: rows.length,
    automatic: rows.filter(row => row.status === 'resolved' && row.association?.method !== 'manual').length,
    manual: rows.filter(row => row.association?.method === 'manual').length,
    pending: rows.filter(row => row.status === 'pending').length,
    missing: rows.filter(row => row.reason === 'missing').length,
    ambiguous: rows.filter(row => row.reason === 'ambiguous').length,
    invalid: rows.filter(row => row.reason === 'invalid_document' || row.reason === 'invalid_row').length
  };
}

export function replaceProjectPreviewRow(
  preview: ProjectImportPreview,
  index: number,
  replacement: ProjectImportPreviewRow
): ProjectImportPreview {
  const rows = preview.rows.map(row => row.index === index ? { ...replacement, index, row: index + 2 } : row);
  const counts = summarizeProjectPreviewRows(rows);
  return { status: counts.pending > 0 ? 'blocked' : 'ready', counts, rows };
}

export function canConfirmProjectImport(preview: ProjectImportPreview | null, refreshing: boolean) {
  return Boolean(preview && !refreshing && preview.status === 'ready' && preview.counts.pending === 0);
}
