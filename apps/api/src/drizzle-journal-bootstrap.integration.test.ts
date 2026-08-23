import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';

const testRoot = path.resolve(process.cwd(), 'scratch', `drizzle-journal-bootstrap-${process.pid}`);
const runtimePath = path.join(testRoot, 'runtime.db');
const drizzlePath = path.join(testRoot, 'drizzle.db');
const migrationsFolder = path.resolve(process.cwd(), 'packages', 'database', 'drizzle');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = runtimePath;

async function tableNames(client: ReturnType<typeof createClient>) {
  const result = await client.execute(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
  return result.rows.map((row) => String(row.name));
}

test('journal oficial 0000-0014 inicializa schema completo e permanece contido no runtime desktop', async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  await fs.mkdir(testRoot, { recursive: true });

  const journal = JSON.parse(await fs.readFile(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  assert.deepEqual(
    journal.entries.map((entry) => [entry.idx, entry.tag]),
    [
      '0000_opposite_senator_kelly',
      '0001_magical_karma',
      '0002_integrated-budgets',
      '0003_commercial-pipeline',
      '0004_structured-client-registration',
      '0005_crm-lead-opportunity-links',
      '0006_crm-conversion-integrity',
      '0007_ambiental_operacional',
      '0008_client_document_integrity',
      '0009_managerial_finance',
      '0010_strategic_planning',
      '0011_strategic_governance',
      '0012_unified_deadline_alerts',
      '0013_client_workspace_integrity',
      '0014_import_runs'
    ].map((tag, idx) => [idx, tag])
  );

  const drizzleClient = createClient({ url: `file:${drizzlePath}` });
  const runtimeClient = createClient({ url: `file:${runtimePath}` });
  try {
    const migrations = readMigrationFiles({ migrationsFolder });
    assert.equal(migrations.length, 15);
    for (const [migrationIndex, migration] of migrations.entries()) {
      await drizzleClient.execute('BEGIN IMMEDIATE');
      try {
        for (const [statementIndex, statement] of migration.sql.entries()) {
          try {
            await drizzleClient.execute(statement);
          } catch (error) {
            throw new Error(`Falha no journal ${migrationIndex}, statement ${statementIndex}: ${statement.slice(0, 120)}`, { cause: error });
          }
        }
        await drizzleClient.execute('COMMIT');
      } catch (error) {
        await drizzleClient.execute('ROLLBACK');
        throw error;
      }
    }
    const drizzleTables = await tableNames(drizzleClient);
    assert.equal(drizzleTables.includes('import_runs'), true);
    assert.equal(drizzleTables.includes('import_rows'), true);
    assert.equal((await drizzleClient.execute('PRAGMA foreign_key_check')).rows.length, 0);

    const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');
    await runRuntimeMigrations();
    const runtimeTables = new Set(await tableNames(runtimeClient));
    const drizzleApplicationTables = drizzleTables;
    assert.deepEqual(
      drizzleApplicationTables.filter((name) => !runtimeTables.has(name)),
      [],
      'O bootstrap Drizzle nÃ£o pode criar tabelas desconhecidas pelo runtime desktop.'
    );
    assert.equal(Number((await runtimeClient.execute('PRAGMA user_version')).rows[0]?.user_version), 13);
  } finally {
    await drizzleClient.close();
    await runtimeClient.close();
    const { OperationalLogService } = await import('./services/operational-log.service');
    await OperationalLogService.shutdown();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});
