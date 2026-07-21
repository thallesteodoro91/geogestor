import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', 'api-tests');
const dbPath = path.join(testRoot, 'runtime-migrations-safety.integration.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

async function removeTestDatabase() {
  for (const file of dbFiles) {
    try {
      await fs.rm(file, { force: true, maxRetries: 20, retryDelay: 100 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    }
  }
  await fs.rm(path.join(testRoot, 'migration-backups'), { recursive: true, force: true });
}

process.env.GEOGESTOR_DB_PATH = dbPath;

test('migração de orçamento legado é idempotente em execuções repetidas', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');
  await runRuntimeMigrations();

  const client = createClient({ url: `file:${dbPath}` });
  await client.execute({
    sql: 'INSERT INTO clientes (id, nome) VALUES (?, ?)',
    args: ['cliente-migracao', 'Cliente sintético']
  });
  await client.execute({
    sql: `INSERT INTO orcamentos (
      id, cliente_id, valor_total, itens_json, despesas_json
    ) VALUES (?, ?, ?, ?, ?)`,
    args: [
      'orcamento-legado',
      'cliente-migracao',
      125_000,
      JSON.stringify([{ descricao: 'Levantamento', quantidade: 1, valorUnitario: 100_000, total: 100_000 }]),
      JSON.stringify([{ descricao: 'Deslocamento', valor: 25_000 }])
    ]
  });

  await runRuntimeMigrations();
  const firstItems = await client.execute("SELECT descricao, quantidade, valor_unitario, total FROM orcamento_itens WHERE orcamento_id = 'orcamento-legado' ORDER BY id");
  const firstExpenses = await client.execute("SELECT descricao, valor FROM orcamento_despesas WHERE orcamento_id = 'orcamento-legado' ORDER BY id");

  await runRuntimeMigrations();
  await runRuntimeMigrations();

  const finalItems = await client.execute("SELECT descricao, quantidade, valor_unitario, total FROM orcamento_itens WHERE orcamento_id = 'orcamento-legado' ORDER BY id");
  const finalExpenses = await client.execute("SELECT descricao, valor FROM orcamento_despesas WHERE orcamento_id = 'orcamento-legado' ORDER BY id");

  assert.deepEqual(finalItems.rows, firstItems.rows);
  assert.deepEqual(finalExpenses.rows, firstExpenses.rows);
  assert.equal(finalItems.rows.length, 1);
  assert.equal(finalExpenses.rows.length, 1);

  const integrity = await client.execute('PRAGMA quick_check');
  const foreignKeys = await client.execute('PRAGMA foreign_key_check');
  const migration = await client.execute('SELECT version, status FROM schema_migrations WHERE version = 1');
  const userVersion = await client.execute('PRAGMA user_version');
  const legacyJson = await client.execute("SELECT itens_json, despesas_json FROM orcamentos WHERE id = 'orcamento-legado'");
  assert.equal(integrity.rows[0]?.quick_check, 'ok');
  assert.equal(foreignKeys.rows.length, 0);
  assert.equal(Number(migration.rows[0]?.version), 1);
  assert.equal(migration.rows[0]?.status, 'success');
  assert.equal(Number(userVersion.rows[0]?.user_version), 1);
  assert.equal(legacyJson.rows[0]?.itens_json, null);
  assert.equal(legacyJson.rows[0]?.despesas_json, null);

  await client.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await removeTestDatabase();
});
