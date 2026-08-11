import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { ensureImportRuns } from './runtime-migrations/v11-import-runs';

export type ImportRunStatus = 'queued' | 'validating' | 'ready' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled' | 'completed_with_warnings';
export type ImportRowResult = {
  index: number;
  row?: number;
  status: 'success' | 'failed';
  id?: string;
  errors?: string[];
  warnings?: string[];
  association?: { method?: string };
  action?: string;
};

type Executor = Pick<typeof db, 'run' | 'all'>;
type RawRun = {
  id: string;
  idempotency_key: string | null;
  entity: string;
  import_type: string;
  status: ImportRunStatus;
  stage: string;
  progress: number;
  source_name: string | null;
  source_hash: string | null;
  request_digest: string;
  preview_expires_at: string | null;
  preview_used_at: string | null;
  payload_json: string | null;
  result_json: string | null;
  error_json: string | null;
  total_rows: number;
  imported_count: number;
  updated_count: number;
  reused_count: number;
  ignored_count: number;
  failed_count: number;
  pending_review_count: number;
  filesystem_pending: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export class ImportRunError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'ImportRunError';
  }
}

let infrastructure: Promise<void> | null = null;

function canonical(value: unknown): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string') return value.normalize('NFKC').replace(/\r\n?/g, '\n');
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return String(value);
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function publicRun(row: RawRun, includePayload = false) {
  return {
    id: row.id,
    importId: row.id,
    idempotencyKey: row.idempotency_key,
    entity: row.entity,
    importType: row.import_type,
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress),
    sourceName: row.source_name,
    sourceHash: row.source_hash,
    requestDigest: row.request_digest,
    previewExpiresAt: row.preview_expires_at,
    previewUsedAt: row.preview_used_at,
    totalRows: Number(row.total_rows),
    imported: Number(row.imported_count),
    updated: Number(row.updated_count),
    reused: Number(row.reused_count),
    ignored: Number(row.ignored_count),
    failed: Number(row.failed_count),
    pendingReview: Number(row.pending_review_count),
    filesystemPending: Boolean(row.filesystem_pending),
    result: parseJson<unknown>(row.result_json),
    error: parseJson<unknown>(row.error_json),
    payload: includePayload ? parseJson<unknown>(row.payload_json) : undefined,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

async function rawRun(executor: Executor, id: string) {
  return (await executor.all<RawRun>(sql`SELECT * FROM import_runs WHERE id = ${id} LIMIT 1`))[0] ?? null;
}

async function waitForStoredResult(id: string, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const row = await rawRun(db, id);
    const result = row ? parseJson<Record<string, unknown>>(row.result_json) : null;
    if (row && result) return { row, result };
    if (row && ['failed', 'cancelled'].includes(row.status)) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return null;
}

export function importContentDigest(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function readIdempotencyKey(headers: Record<string, unknown>) {
  const raw = headers['idempotency-key'] ?? headers['x-idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || String(value).trim() === '') return `legacy:${crypto.randomUUID()}`;
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]{12,200}$/.test(normalized)) {
    throw new ImportRunError('A chave de idempotência deve possuir de 12 a 200 caracteres seguros.', 400, 'INVALID_IDEMPOTENCY_KEY');
  }
  return normalized;
}

export async function ensureImportInfrastructure() {
  infrastructure ??= ensureImportRuns().catch((error) => {
    infrastructure = null;
    throw error;
  });
  await infrastructure;
}

export async function findImportReplay(entity: string, importType: string, key: string, digest: string) {
  await ensureImportInfrastructure();
  const [row] = await db.all<RawRun>(sql`SELECT * FROM import_runs
    WHERE entity = ${entity} AND import_type = ${importType} AND idempotency_key = ${key} LIMIT 1`);
  if (!row) return null;
  if (row.request_digest !== digest) throw new ImportRunError('Esta chave de idempotência já foi utilizada com outro conteúdo.', 409, 'IDEMPOTENCY_CONFLICT');
  const result = parseJson<Record<string, unknown>>(row.result_json);
  const completed = result ? { row, result } : await waitForStoredResult(row.id);
  if (!completed) throw new ImportRunError('A importação com esta chave ainda está em processamento.', 409, 'IMPORT_IN_PROGRESS');
  return { ...completed.result, importId: completed.row.id, idempotent: true, requestReused: true };
}

export async function reserveSimpleImport(executor: Executor, input: {
  entity: string;
  key: string;
  digest: string;
  totalRows: number;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await executor.run(sql`INSERT OR IGNORE INTO import_runs (
    id, idempotency_key, entity, import_type, status, stage, progress, request_digest,
    total_rows, created_at, started_at, updated_at
  ) VALUES (${id}, ${input.key}, ${input.entity}, 'simple', 'processing', 'Gravando dados', 50,
    ${input.digest}, ${input.totalRows}, ${now}, ${now}, ${now})`);
  const [row] = await executor.all<RawRun>(sql`SELECT * FROM import_runs
    WHERE entity = ${input.entity} AND import_type = 'simple' AND idempotency_key = ${input.key} LIMIT 1`);
  if (!row) throw new Error('Não foi possível reservar a execução da importação.');
  if (row.request_digest !== input.digest) throw new ImportRunError('Esta chave de idempotência já foi utilizada com outro conteúdo.', 409, 'IDEMPOTENCY_CONFLICT');
  if (row.id !== id) {
    const result = parseJson<Record<string, unknown>>(row.result_json);
    const completed = result ? { row, result } : await waitForStoredResult(row.id);
    if (!completed) throw new ImportRunError('A importação com esta chave ainda está em processamento.', 409, 'IMPORT_IN_PROGRESS');
    return { runId: completed.row.id, replay: { ...completed.result, importId: completed.row.id, idempotent: true, requestReused: true } };
  }
  return { runId: id, replay: null };
}

export async function completeImportRun(executor: Executor, runId: string, result: Record<string, unknown>, rows: ImportRowResult[] = []) {
  const completedAt = new Date().toISOString();
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const baseStatus = String(result.status || 'completed');
  const status: ImportRunStatus = warnings.length && baseStatus === 'completed' ? 'completed_with_warnings'
    : baseStatus === 'partial' ? 'partial'
      : baseStatus === 'failed' ? 'failed'
        : 'completed';
  await executor.run(sql`UPDATE import_runs SET
    status = ${status}, stage = 'Concluído', progress = 100, result_json = ${JSON.stringify(result)},
    error_json = NULL, imported_count = ${Number(result.imported || 0)}, updated_count = ${Number(result.updated || 0)},
    reused_count = ${Number(result.reused || 0)}, ignored_count = ${Number(result.ignored || 0)},
    failed_count = ${Number(result.failed || 0)}, pending_review_count = ${Number(result.pendingReview || 0)},
    filesystem_pending = ${result.filesystemPending ? 1 : 0}, payload_json = NULL,
    completed_at = ${completedAt}, updated_at = ${completedAt}
    WHERE id = ${runId}`);
  for (const item of rows) {
    const rowNumber = item.row ?? item.index + 2;
    await executor.run(sql`INSERT OR REPLACE INTO import_rows (
      id, import_id, row_number, status, action, record_id, errors_json, warnings_json, association_method, created_at
    ) VALUES (${crypto.randomUUID()}, ${runId}, ${rowNumber}, ${item.status}, ${item.action ?? (item.status === 'success' ? 'created' : 'rejected')},
      ${item.id ?? null}, ${item.errors ? JSON.stringify(item.errors) : null}, ${item.warnings ? JSON.stringify(item.warnings) : null},
      ${item.association?.method ?? null}, ${completedAt})`);
  }
}

export async function persistPostCommitResult(runId: string, result: Record<string, unknown>) {
  await completeImportRun(db, runId, result, Array.isArray(result.results) ? result.results as ImportRowResult[] : []);
}

export async function registerImportPreview(input: {
  entity: string;
  digest: string;
  sourceName?: string;
  sourceHash?: string;
  totalRows: number;
  preview: Record<string, unknown>;
  ttlMs?: number;
}) {
  await ensureImportInfrastructure();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 30 * 60 * 1000)).toISOString();
  const previewStatus = input.preview.status === 'ready' ? 'ready' : 'failed';
  await db.run(sql`INSERT INTO import_runs (
    id, entity, import_type, status, stage, progress, source_name, source_hash, request_digest,
    preview_expires_at, result_json, total_rows, created_at, updated_at
  ) VALUES (${id}, ${input.entity}, 'complete', ${previewStatus}, 'Prévia gerada', 25,
    ${input.sourceName ?? null}, ${input.sourceHash ?? null}, ${input.digest}, ${expiresAt},
    ${JSON.stringify(input.preview)}, ${input.totalRows}, ${now}, ${now})`);
  return { previewId: id, previewExpiresAt: expiresAt, contentDigest: input.digest };
}

export async function queueConfirmedPreview(previewId: string, digest: string, payload: unknown) {
  await ensureImportInfrastructure();
  const now = new Date().toISOString();
  const row = await rawRun(db, previewId);
  if (!row) throw new ImportRunError('A prévia informada não existe.', 404, 'PREVIEW_NOT_FOUND');
  if (row.request_digest !== digest) throw new ImportRunError('O conteúdo ou o mapeamento mudou depois da prévia. Gere uma nova prévia.', 409, 'PREVIEW_CONTENT_CHANGED');
  if (row.preview_used_at) throw new ImportRunError('Esta prévia já foi utilizada.', 409, 'PREVIEW_ALREADY_USED');
  if (!row.preview_expires_at || Date.parse(row.preview_expires_at) <= Date.now()) throw new ImportRunError('A prévia expirou. Gere uma nova prévia.', 410, 'PREVIEW_EXPIRED');
  if (row.status !== 'ready') throw new ImportRunError('A prévia possui erros impeditivos e não pode ser confirmada.', 422, 'PREVIEW_BLOCKED');
  try {
    const updated = await db.all<RawRun>(sql`UPDATE import_runs SET status = 'queued', stage = 'Recebido', progress = 0,
      preview_used_at = ${now}, payload_json = ${JSON.stringify(payload)}, result_json = NULL, updated_at = ${now}
      WHERE id = ${previewId} AND status = 'ready' AND preview_used_at IS NULL
        AND preview_expires_at > ${now} AND request_digest = ${digest}
      RETURNING *`);
    if (updated.length === 0) {
      throw new ImportRunError('Esta prévia já foi utilizada ou expirou. Gere uma nova prévia.', 409, 'PREVIEW_NOT_AVAILABLE');
    }
  } catch (error) {
    if (error instanceof ImportRunError) throw error;
    const causeMessage = error && typeof error === 'object' && 'cause' in error && error.cause instanceof Error ? error.cause.message : '';
    if (error instanceof Error && /uq_import_runs_single_heavy|UNIQUE constraint/i.test(`${error.message} ${causeMessage}`)) {
      throw new ImportRunError('Outra importação completa está em andamento. Aguarde a conclusão antes de iniciar uma nova.', 409, 'HEAVY_IMPORT_IN_PROGRESS');
    }
    throw error;
  }
  return { importId: previewId, status: 'queued' as const, pollUrl: `/api/importacoes/${previewId}` };
}

export async function updateImportProgress(id: string, status: ImportRunStatus, stage: string, progress: number) {
  const now = new Date().toISOString();
  await db.run(sql`UPDATE import_runs SET status = ${status}, stage = ${stage}, progress = ${Math.max(0, Math.min(100, progress))},
    started_at = COALESCE(started_at, ${now}), updated_at = ${now} WHERE id = ${id}`);
}

export async function failImportRun(id: string, error: unknown) {
  const completedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : 'Falha desconhecida durante a importação.';
  const safe = { message: message.replace(/[\r\n\t]+/g, ' ').slice(0, 500) };
  await db.run(sql`UPDATE import_runs SET status = 'failed', stage = 'Falha', progress = 100,
    error_json = ${JSON.stringify(safe)}, payload_json = NULL, completed_at = ${completedAt}, updated_at = ${completedAt}
    WHERE id = ${id}`);
}

export async function nextQueuedFullImport() {
  await ensureImportInfrastructure();
  const [row] = await db.all<RawRun>(sql`SELECT * FROM import_runs
    WHERE import_type = 'complete' AND status = 'queued' ORDER BY created_at LIMIT 1`);
  return row ? publicRun(row, true) : null;
}

export async function recoverInterruptedImportRuns() {
  await ensureImportInfrastructure();
  const now = new Date().toISOString();
  await db.run(sql`UPDATE import_runs SET status = 'failed', stage = 'Interrompido', progress = 100,
    error_json = ${JSON.stringify({ message: 'A execução foi interrompida e o resultado final não pôde ser confirmado. Confira os registros antes de tentar novamente.' })},
    payload_json = NULL, completed_at = ${now}, updated_at = ${now}
    WHERE status IN ('processing', 'validating')`);
}

export async function getImportRun(id: string) {
  await ensureImportInfrastructure();
  const row = await rawRun(db, id);
  return row ? publicRun(row) : null;
}

export async function listImportRuns(limit = 50) {
  await ensureImportInfrastructure();
  const rows = await db.all<RawRun>(sql`SELECT * FROM import_runs ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`);
  return rows.map(row => publicRun(row));
}

export async function listImportRows(importId: string, onlyErrors = false) {
  await ensureImportInfrastructure();
  const rows = await db.all<Record<string, unknown>>(onlyErrors
    ? sql`SELECT row_number, status, action, record_id, errors_json, warnings_json, association_method FROM import_rows WHERE import_id = ${importId} AND status = 'failed' ORDER BY row_number`
    : sql`SELECT row_number, status, action, record_id, errors_json, warnings_json, association_method FROM import_rows WHERE import_id = ${importId} ORDER BY row_number`);
  return rows.map(row => ({
    row: Number(row.row_number),
    status: row.status,
    action: row.action,
    recordId: row.record_id,
    errors: parseJson<string[]>(String(row.errors_json || '')) ?? [],
    warnings: parseJson<string[]>(String(row.warnings_json || '')) ?? [],
    associationMethod: row.association_method
  }));
}

export function importErrorsCsv(rows: Array<{ row: number; status: unknown; errors: string[]; warnings: string[] }>) {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
  const lines = [['Linha', 'Status', 'Erros', 'Avisos'], ...rows.map(row => [row.row, row.status, row.errors.join(' | '), row.warnings.join(' | ')])];
  return `\uFEFF${lines.map(line => line.map(cell).join(';')).join('\n')}`;
}

export function resetImportInfrastructureForTests() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Reinicialização permitida somente em testes.');
  infrastructure = null;
}
