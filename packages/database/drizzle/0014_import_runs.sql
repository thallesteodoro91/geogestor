CREATE TABLE IF NOT EXISTS import_runs (
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
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_import_runs_idempotency
  ON import_runs(entity, import_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_import_runs_single_heavy
  ON import_runs(import_type)
  WHERE import_type = 'complete' AND status IN ('queued', 'validating', 'processing');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_import_runs_recent
  ON import_runs(created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_import_runs_status
  ON import_runs(status, updated_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS import_rows (
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_import_rows_run_status
  ON import_rows(import_id, status, row_number);
--> statement-breakpoint
UPDATE clientes
SET situacao = 'Ativo'
WHERE deleted_at IS NULL AND (situacao IS NULL OR trim(situacao) = '');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_clientes_import_document
  ON clientes(documento_normalizado)
  WHERE deleted_at IS NULL AND situacao = 'Ativo';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_clientes_import_name
  ON clientes(lower(trim(nome)))
  WHERE deleted_at IS NULL AND situacao = 'Ativo';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_contatos_import_email
  ON contatos(lower(trim(email)))
  WHERE deleted_at IS NULL AND email IS NOT NULL;
