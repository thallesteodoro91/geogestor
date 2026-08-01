import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', `runtime-migrations-fast-path-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;

async function removeTestDatabase() {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

test('fast path exige ledger success e user_version coincidentes', async () => {
  await removeTestDatabase();
  await fs.mkdir(testRoot, { recursive: true });

  const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');
  const initial = await runRuntimeMigrations();
  assert.equal(initial.fastPath, false);
  assert.equal(initial.schemaVersion, 7);

  const client = createClient({ url: `file:${dbPath}` });
  const sentinel = '2000-01-01T00:00:00.000Z';

  await client.execute({
    sql: 'UPDATE schema_migrations SET started_at = ? WHERE version = 7',
    args: [sentinel]
  });
  const fast = await runRuntimeMigrations();
  assert.equal(fast.fastPath, true);
  assert.equal(
    (await client.execute('SELECT started_at FROM schema_migrations WHERE version = 7')).rows[0]?.started_at,
    sentinel
  );

  for (const status of ['running', 'failed']) {
    await client.execute({
      sql: 'UPDATE schema_migrations SET status = ?, started_at = ? WHERE version = 7',
      args: [status, sentinel]
    });
    const recovered = await runRuntimeMigrations();
    assert.equal(recovered.fastPath, false);
    const ledger = (await client.execute(
      'SELECT status, started_at FROM schema_migrations WHERE version = 7'
    )).rows[0];
    assert.equal(ledger?.status, 'success');
    assert.notEqual(ledger?.started_at, sentinel);
  }

  await client.execute({
    sql: "UPDATE schema_migrations SET status = 'success', started_at = ? WHERE version = 7",
    args: [sentinel]
  });
  await client.execute('PRAGMA user_version = 2');
  const reconciled = await runRuntimeMigrations();
  assert.equal(reconciled.fastPath, false);
  assert.equal(
    Number((await client.execute('PRAGMA user_version')).rows[0]?.user_version),
    7
  );
  assert.notEqual(
    (await client.execute('SELECT started_at FROM schema_migrations WHERE version = 7')).rows[0]?.started_at,
    sentinel
  );

  const repeated = await runRuntimeMigrations();
  assert.equal(repeated.fastPath, true);

  await client.close();
  const { OperationalLogService } = await import('./services/operational-log.service');
  await OperationalLogService.shutdown();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await removeTestDatabase();
});
