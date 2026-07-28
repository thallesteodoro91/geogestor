import type { Client } from '@libsql/client';

export const FILESYSTEM_OUTBOX_MIGRATION = {
  version: 2,
  name: 'filesystem-outbox-and-operations-2026-07-21'
} as const;

export async function ensureFilesystemOperations(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS filesystem_operations (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      operation_type TEXT NOT NULL CHECK (operation_type IN (
        'create-client-folder',
        'rename-client-folder',
        'create-project-folder',
        'rename-project-folder'
      )),
      aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('client', 'project')),
      aggregate_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
      attempts INTEGER DEFAULT 0 NOT NULL CHECK (attempts >= 0),
      max_attempts INTEGER DEFAULT 8 NOT NULL CHECK (max_attempts > 0),
      next_attempt_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      locked_at TEXT,
      lock_owner TEXT,
      last_error TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uq_filesystem_operations_idempotency_key
    ON filesystem_operations(idempotency_key)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_filesystem_operations_pending
    ON filesystem_operations(status, next_attempt_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_filesystem_operations_aggregate
    ON filesystem_operations(aggregate_type, aggregate_id)`);
}
