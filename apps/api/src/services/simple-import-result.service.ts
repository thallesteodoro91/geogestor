import crypto from 'node:crypto';

export type SimpleImportRowResult = {
  index: number;
  status: 'success' | 'failed';
  id?: string;
  errors?: string[];
  association?: {
    clientId: string;
    clientName: string;
    method: 'document' | 'exact_name' | 'manual' | 'internal_id';
  };
};

export function finishSimpleImport(startedAt: string, rowsRead: number, results: SimpleImportRowResult[]) {
  const completedAt = new Date().toISOString();
  const imported = results.filter((item) => item.status === 'success').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  return {
    importId: crypto.randomUUID(),
    status: imported === 0 ? 'failed' as const : failed > 0 ? 'partial' as const : 'completed' as const,
    rowsRead,
    imported,
    importedCount: imported,
    success: imported > 0,
    message: imported === 0 ? 'Nenhum registro foi importado' : `${imported} registro(s) importado(s)`,
    updated: 0,
    reused: 0,
    ignored: 0,
    failed,
    pendingReview: failed,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    results: results
      .sort((left, right) => left.index - right.index)
      .map((item) => ({ ...item, row: item.index + 2 }))
  };
}
