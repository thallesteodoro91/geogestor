import { sql } from 'drizzle-orm';
import type { Client } from '@libsql/client';
import type { db } from '../../db';

type MigrationExecutor = Pick<typeof db, 'run' | 'all'>;

type StatementExecutor = {
  run(statement: string): Promise<unknown>;
  all<T extends Record<string, unknown>>(statement: string): Promise<T[]>;
};

export const IMPORT_RUNS_MIGRATION = {
  version: 11,
  name: 'import-runs-and-idempotency'
} as const;

async function applyImportRunsMigration(executor: StatementExecutor) {
  await executor.run(`CREATE TABLE IF NOT EXISTS import_runs (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT,
    entity TEXT NOT NULL,
    import_type TEXT NOT NULL,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    source_name TEXT,
    source_hash TEXT,
    request_digest TEXT NOT NULL,
    preview_expires_at TEXT,
    preview_used_at TEXT,
    payload_json TEXT,
    result_json TEXT,
    error_json TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    reused_count INTEGER NOT NULL DEFAULT 0,
    ignored_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    pending_review_count INTEGER NOT NULL DEFAULT 0,
    filesystem_pending INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL
  )`);
  await executor.run(`CREATE UNIQUE INDEX IF NOT EXISTS uq_import_runs_idempotency
    ON import_runs(entity, import_type, idempotency_key) WHERE idempotency_key IS NOT NULL`);
  await executor.run('DROP INDEX IF EXISTS uq_import_runs_single_heavy');
  await executor.run(`CREATE UNIQUE INDEX IF NOT EXISTS uq_import_runs_single_heavy
    ON import_runs(import_type) WHERE import_type = 'complete' AND status IN ('queued', 'validating', 'processing')`);
  await executor.run('CREATE INDEX IF NOT EXISTS idx_import_runs_recent ON import_runs(created_at DESC)');
  await executor.run('CREATE INDEX IF NOT EXISTS idx_import_runs_status ON import_runs(status, updated_at)');
  await executor.run(`CREATE TABLE IF NOT EXISTS import_rows (
    id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    action TEXT,
    record_id TEXT,
    errors_json TEXT,
    warnings_json TEXT,
    association_method TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(import_id, row_number)
  )`);
  await executor.run('CREATE INDEX IF NOT EXISTS idx_import_rows_run_status ON import_rows(import_id, status, row_number)');
  const tables = await executor.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('clientes', 'contatos')");
  const existingTables = new Set(tables.map(table => table.name));
  if (existingTables.has('clientes')) {
    await executor.run("UPDATE clientes SET situacao = 'Ativo' WHERE deleted_at IS NULL AND (situacao IS NULL OR trim(situacao) = '')");
    await executor.run("CREATE INDEX IF NOT EXISTS idx_clientes_import_document ON clientes(documento_normalizado) WHERE deleted_at IS NULL AND situacao = 'Ativo'");
    await executor.run("CREATE INDEX IF NOT EXISTS idx_clientes_import_name ON clientes(lower(trim(nome))) WHERE deleted_at IS NULL AND situacao = 'Ativo'");
  }
  if (existingTables.has('contatos')) {
    await executor.run("CREATE INDEX IF NOT EXISTS idx_contatos_import_email ON contatos(lower(trim(email))) WHERE deleted_at IS NULL AND email IS NOT NULL");
  }
}

export async function ensureImportRuns(executor: MigrationExecutor) {
  await applyImportRunsMigration({
    run: (statement) => executor.run(sql.raw(statement)),
    all: <T extends Record<string, unknown>>(statement: string) => executor.all<T>(sql.raw(statement))
  });
}

export async function ensureImportRunsWithClient(client: Client) {
  await applyImportRunsMigration({
    run: (statement) => client.execute(statement),
    all: async <T extends Record<string, unknown>>(statement: string) => {
      const result = await client.execute(statement);
      return result.rows.map((row) => ({ ...row })) as unknown as T[];
    }
  });
}
