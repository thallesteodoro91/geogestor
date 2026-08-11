export type FullMigrationPayload = {
  fileName: string;
  fileHash: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  sheetName?: string;
  firstDataRow?: number;
  mappingOverrides?: Record<string, string | null>;
  clientTimings?: { readingMs: number; hashingMs: number };
};

export type FullMigrationIssue = {
  row: number | null;
  field: string | null;
  severity: 'info' | 'warning' | 'ambiguous' | 'blocking' | 'historical';
  message: string;
};

export type ReconciliationItem = {
  key: string;
  label: string;
  spreadsheet: number;
  imported: number;
  difference: number;
  status: string;
  historical: boolean;
};

export type FullMigrationPreview = {
  importId: string;
  previewId: string;
  previewExpiresAt: string;
  contentDigest: string;
  fileName: string;
  fileHash: string;
  status: 'ready' | 'blocked' | 'already_imported';
  counts: {
    rowsRead: number;
    clientsCreated: number;
    clientsUpdated: number;
    invalidDocuments: number;
    duplicateDocuments: number;
    properties: number;
    projects: number;
    budgets: number;
    billings: number;
    receivables: number;
    receipts: number;
    expenses: number;
    partial: number;
    warnings: number;
    blocking: number;
  };
  columns: {
    expected: number;
    sourceTotal: number;
    sources: string[];
    availableFields: Array<{ key: string; label: string; classification: string }>;
    selectedMapping: Record<string, string | null>;
    recognized: Array<{
      source: string;
      field: string;
      label: string;
      classification: string;
      confidence: number;
      method: 'manual' | 'exact' | 'semantic';
    }>;
    unrecognized: string[];
    ignored: string[];
    duplicateAliases: string[];
  };
  issues: FullMigrationIssue[];
  reconciliation: ReconciliationItem[];
  limitations: string[];
};

export type FullMigrationResult = {
  importId: string;
  status: 'completed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  counts: {
    imported: number;
    updated: number;
    ignored: number;
    rejected: number;
    pendingReview: number;
    clients: number;
    properties: number;
    projects: number;
    budgets: number;
    billings: number;
    receivables: number;
    receipts: number;
    expenses: number;
  };
  reconciliation: ReconciliationItem[];
  warnings: FullMigrationIssue[];
};

export type FullMigrationQueued = {
  importId: string;
  status: 'queued';
  pollUrl: string;
};

export type FullMigrationRun = {
  importId: string;
  status: 'queued' | 'validating' | 'ready' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled' | 'completed_with_warnings';
  stage: string;
  progress: number;
  result: FullMigrationResult | null;
  error: { message?: string } | null;
};

export const SPREADSHEET_LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  rows: 20_000,
  columns: 300
} as const;

export function validateSpreadsheetFile(name: string, size: number) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (!['csv', 'xlsx'].includes(extension)) return 'Formato não suportado. Envie um arquivo CSV ou XLSX.';
  if (size > SPREADSHEET_LIMITS.fileBytes) {
    return `O arquivo possui ${(size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB. O limite é 20 MB.`;
  }
  return null;
}

export function validateSpreadsheetDimensions(rows: number, columns: number) {
  if (rows > SPREADSHEET_LIMITS.rows) {
    return `A planilha possui ${rows.toLocaleString('pt-BR')} linhas. O limite é ${SPREADSHEET_LIMITS.rows.toLocaleString('pt-BR')}. Divida o arquivo em lotes menores.`;
  }
  if (columns > SPREADSHEET_LIMITS.columns) {
    return `A planilha possui ${columns} colunas. O limite é ${SPREADSHEET_LIMITS.columns}. Remova colunas desnecessárias.`;
  }
  return null;
}

export async function sha256File(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function isFilled(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function headerScore(row: unknown[]) {
  const values = row.filter(isFilled);
  if (!values.length) return -1;
  const strings = values.filter(value => typeof value === 'string' && String(value).trim().length > 0).length;
  const unique = new Set(values.map(value => String(value).trim().toLocaleLowerCase('pt-BR'))).size;
  return values.length * 2 + strings * 3 + unique / values.length;
}

export function detectHeaderRowIndex(rows: unknown[][]) {
  const candidates = rows.slice(0, 20).map((row, index) => ({ index, score: headerScore(row) }));
  return candidates.sort((left, right) => right.score - left.score || left.index - right.index)[0]?.index ?? 0;
}

export function uniqueSpreadsheetHeaders(row: unknown[]) {
  const occurrences = new Map<string, number>();
  return row.map((value, index) => {
    const base = String(value ?? '').trim() || `Coluna ${index + 1} (sem título)`;
    const count = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function selectBestWorkbookSheet<T extends { sheet: string; data: unknown[][] }>(sheets: T[]) {
  return [...sheets].sort((left, right) => {
    const leftIndex = detectHeaderRowIndex(left.data);
    const rightIndex = detectHeaderRowIndex(right.data);
    const leftScore = headerScore(left.data[leftIndex] ?? []) + Math.min(left.data.length, 100) / 100;
    const rightScore = headerScore(right.data[rightIndex] ?? []) + Math.min(right.data.length, 100) / 100;
    return rightScore - leftScore;
  })[0];
}
