import Papa from 'papaparse';

export type FullMigrationPayload = {
  fileName: string;
  fileHash: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  sheetName?: string;
  firstDataRow?: number;
  sourceRowNumbers?: number[];
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

export function validateSpreadsheetCells(rows: unknown[][]) {
  for (const row of rows) {
    for (const value of row) {
      if (typeof value === 'string' && value.length > 20_000) {
        return 'A planilha contém uma célula com mais de 20.000 caracteres. Reduza esse conteúdo e envie novamente.';
      }
    }
  }
  return null;
}

const MAX_XLSX_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_XLSX_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 2_048;

function validateXlsxArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('O conteúdo não corresponde a um arquivo XLSX válido.');
  }
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      end = offset;
      break;
    }
  }
  if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) {
    throw new Error('O ZIP do XLSX está incompleto ou usa múltiplos volumes.');
  }
  const entries = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (entries > MAX_XLSX_ENTRIES || entries === 0 || entries === 0xffff ||
      directorySize === 0xffffffff || directoryOffset === 0xffffffff ||
      directoryOffset + directorySize > end) {
    throw new Error('O XLSX excede os limites seguros de estrutura ZIP.');
  }
  let offset = directoryOffset;
  let expanded = 0;
  let hasContentTypes = false;
  let hasWorkbook = false;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('O diretório ZIP do XLSX está malformado.');
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 1 || ![0, 8].includes(method) ||
        compressed === 0xffffffff || uncompressed === 0xffffffff ||
        uncompressed > MAX_XLSX_ENTRY_BYTES || expanded + uncompressed > MAX_XLSX_EXPANDED_BYTES ||
        (compressed === 0 && uncompressed > 0) ||
        (compressed > 0 && uncompressed > compressed * 1_000) ||
        localOffset + 30 > directoryOffset || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('O XLSX está protegido, malformado ou excede o limite de expansão.');
    }
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    hasContentTypes ||= name === '[Content_Types].xml';
    hasWorkbook ||= name === 'xl/workbook.xml';
    expanded += uncompressed;
    offset = next;
  }
  if (offset !== directoryOffset + directorySize || !hasContentTypes || !hasWorkbook) {
    throw new Error('O conteúdo ZIP não corresponde a uma pasta de trabalho XLSX.');
  }
}

export async function readValidatedSpreadsheet(file: File): Promise<string | null> {
  const fileError = validateSpreadsheetFile(file.name, file.size);
  if (fileError) throw new Error(fileError);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') {
    validateXlsxArchive(bytes);
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4) {
    throw new Error('O conteúdo ZIP não corresponde à extensão CSV.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('O CSV contém bytes inválidos para UTF-8. Salve o arquivo em UTF-8 e tente novamente.');
  }
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

export function headerOutsideDetectionWindow(rows: unknown[][]) {
  const looksTabular = (row: unknown[]) => row.filter(isFilled).length >= 2;
  return !rows.slice(0, 20).some(looksTabular) && rows.slice(20).some(looksTabular);
}

export function requiresManualHeaderSelection(rows: unknown[][], detectedIndex: number) {
  const detectedWidth = rows[detectedIndex]?.length ?? 0;
  if (detectedWidth < 2) return false;
  return rows.slice(0, detectedIndex + 1).some(row => {
    const filled = row.filter(isFilled).length;
    if (filled < 2) return false;
    const unique = new Set(row.filter(isFilled).map(value => String(value).trim().toLocaleLowerCase('pt-BR'))).size;
    return filled < detectedWidth || unique < filled;
  });
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

export function parseCsvWithSourceRows(contents: string) {
  const text = contents.replace(/^\uFEFF/, '');
  const rows: unknown[][] = [];
  const sourceRowNumbers: number[] = [];
  const errors: string[] = [];
  let cursor = 0;
  let line = 1;
  Papa.parse<unknown[]>(text, {
    header: false,
    skipEmptyLines: false,
    step: result => {
      sourceRowNumbers.push(line);
      rows.push(result.data);
      errors.push(...result.errors.filter(error => error.code !== 'UndetectableDelimiter').map(error => error.message));
      line += (text.slice(cursor, result.meta.cursor).match(/\r\n|\r|\n/g) ?? []).length;
      cursor = result.meta.cursor;
    }
  });
  if (errors.length > 0) throw new Error(errors[0]);
  return { rows, sourceRowNumbers };
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
