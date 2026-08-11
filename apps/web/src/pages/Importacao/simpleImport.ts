import { ClientePayloadSchema } from '@geogestor/contracts';

export type SimpleImportRowResult = {
  index: number;
  row: number;
  status: 'success' | 'failed';
  id?: string;
  errors?: string[];
  association?: {
    clientId: string;
    clientName: string;
    method: 'document' | 'exact_name' | 'manual' | 'internal_id';
  };
};

export type SimpleImportResult = {
  importId: string;
  status: 'completed' | 'completed_with_warnings' | 'partial' | 'failed';
  rowsRead: number;
  imported: number;
  updated: number;
  reused: number;
  ignored: number;
  failed: number;
  pendingReview: number;
  idempotent?: boolean;
  requestReused?: boolean;
  filesystemPending?: boolean;
  warnings?: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  results: SimpleImportRowResult[];
};

export function simpleImportOutcome(imported: number, failed: number): SimpleImportResult['status'] {
  if (imported === 0) return 'failed';
  return failed > 0 ? 'partial' : 'completed';
}

export function validateSimpleClientPayload(rows: Array<Record<string, string>>) {
  return rows.flatMap((row, index) => {
    const result = ClientePayloadSchema.safeParse(row);
    if (result.success) return [];
    return [{
      row: index + 2,
      errors: [...new Set(result.error.issues.map(issue => issue.message))]
    }];
  });
}
