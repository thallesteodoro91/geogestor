import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', `runtime-migrations-v11-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;

async function cleanup() {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
}

test('v11 integra runtime 13, ledger, backup, rollback e fast path sem evoluÃ§Ã£o preguiÃ§osa paralela', async () => {
  await cleanup();
  await fs.mkdir(testRoot, { recursive: true });
  const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');

  try {
    const initial = await runRuntimeMigrations();
    assert.deepEqual(initial, { fastPath: false, schemaVersion: 13 });

    const client = createClient({ url: `file:${databasePath}` });
    try {
      assert.deepEqual(
        (await client.execute('SELECT version, status FROM schema_migrations ORDER BY version')).rows
          .map((row) => [Number(row.version), row.status]),
        Array.from({ length: 13 }, (_, index) => [index + 1, 'success'])
      );
      assert.equal(Number((await client.execute('PRAGMA user_version')).rows[0]?.user_version), 13);

      // Reproduz o estado auditado: schema superior anunciado, mas v11 ausente.
      await client.execute('DROP TABLE import_rows');
      await client.execute('DROP TABLE import_runs');
      await client.execute('DELETE FROM schema_migrations WHERE version = 11');
      await client.execute('PRAGMA user_version = 13');

      const reconciled = await runRuntimeMigrations();
      assert.equal(reconciled.fastPath, false);
      const v11 = (await client.execute(
        'SELECT name, status, backup_path FROM schema_migrations WHERE version = 11'
      )).rows[0];
      assert.equal(v11?.name, 'import-runs-and-idempotency');
      assert.equal(v11?.status, 'success');
      assert.equal(typeof v11?.backup_path, 'string');
      assert.equal((await fs.stat(String(v11?.backup_path))).isFile(), true);
      assert.equal(
        Number((await client.execute("SELECT COUNT(*) total FROM sqlite_master WHERE type = 'table' AND name IN ('import_runs', 'import_rows')")).rows[0]?.total),
        2
      );

      const repeated = await runRuntimeMigrations();
      assert.equal(repeated.fastPath, true);

      // Uma falha estrutural controlada nÃ£o pode promover v11 nem alterar user_version.
      await client.execute('DROP TABLE import_rows');
      await client.execute('DROP TABLE import_runs');
      await client.execute('DELETE FROM schema_migrations WHERE version = 11');
      await client.execute('PRAGMA user_version = 10');
      await client.execute('CREATE VIEW import_runs AS SELECT 1 AS id');
      await assert.rejects(runRuntimeMigrations(), /import_runs|table|view/i);
      assert.equal((await client.execute('SELECT status FROM schema_migrations WHERE version = 11')).rows[0]?.status, 'failed');
      assert.equal(Number((await client.execute('PRAGMA user_version')).rows[0]?.user_version), 10);
      assert.equal(
        Number((await client.execute("SELECT COUNT(*) total FROM sqlite_master WHERE type = 'table' AND name = 'import_rows'")).rows[0]?.total),
        0
      );

      await client.execute('DROP VIEW import_runs');
      const recovered = await runRuntimeMigrations();
      assert.equal(recovered.schemaVersion, 13);
      assert.equal((await client.execute('SELECT status FROM schema_migrations WHERE version = 11')).rows[0]?.status, 'success');
      assert.equal(Number((await client.execute('PRAGMA foreign_key_check')).rows.length), 0);
    } finally {
      await client.close();
    }
  } finally {
    const { OperationalLogService } = await import('./services/operational-log.service');
    await OperationalLogService.shutdown();
    await cleanup();
  }
});

test('definiÃ§Ã£o central da v11 tolera banco sem tabelas opcionais', async () => {
  const isolatedPath = path.join(testRoot, 'optional-tables.db');
  await fs.mkdir(testRoot, { recursive: true });
  const client = createClient({ url: `file:${isolatedPath}` });
  try {
    const { ensureImportRunsWithClient } = await import('./services/runtime-migrations/v11-import-runs');
    await ensureImportRunsWithClient(client);
    await ensureImportRunsWithClient(client);
    assert.equal(
      Number((await client.execute("SELECT COUNT(*) total FROM sqlite_master WHERE type = 'table' AND name IN ('import_runs', 'import_rows')")).rows[0]?.total),
      2
    );
  } finally {
    await client.close();
    await cleanup();
  }
});
