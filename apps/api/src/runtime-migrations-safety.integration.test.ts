import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', `runtime-migrations-safety-${process.pid}`);
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
  await client.execute("UPDATE schema_migrations SET status = 'failed' WHERE version = 4");

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
  const migrations = await client.execute('SELECT version, status FROM schema_migrations WHERE version IN (1, 2, 3, 4) ORDER BY version');
  const userVersion = await client.execute('PRAGMA user_version');
  const legacyJson = await client.execute("SELECT itens_json, despesas_json FROM orcamentos WHERE id = 'orcamento-legado'");
  assert.equal(integrity.rows[0]?.quick_check, 'ok');
  assert.equal(foreignKeys.rows.length, 0);
  assert.deepEqual(migrations.rows.map((row) => [Number(row.version), row.status]), [[1, 'success'], [2, 'success'], [4, 'success']]);
  assert.equal(Number(userVersion.rows[0]?.user_version), 4);
  assert.equal(legacyJson.rows[0]?.itens_json, null);
  assert.equal(legacyJson.rows[0]?.despesas_json, null);

  await client.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await removeTestDatabase();
});

test('migração preserva duplicidades legadas, registra conflitos e bloqueia novas colisões', async () => {
  await removeTestDatabase();
  await fs.mkdir(testRoot, { recursive: true });
  const legacyClient = createClient({ url: `file:${dbPath}` });
  await legacyClient.execute(`
    CREATE TABLE clientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      documento TEXT,
      cpf TEXT,
      cnpj TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  await legacyClient.execute({
    sql: `INSERT INTO clientes (id, nome, documento, cpf) VALUES
      (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, NULL, NULL), (?, ?, '', '')`,
    args: [
      'duplicado-formatado', 'Duplicado formatado', '529.982.247-25', '529.982.247-25',
      'duplicado-numerico', 'Duplicado numérico', '52998224725', '52998224725',
      'documento-nulo', 'Documento nulo',
      'documento-vazio', 'Documento vazio'
    ]
  });
  await legacyClient.close();

  const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');
  await runRuntimeMigrations();

  const migratedClient = createClient({ url: `file:${dbPath}` });
  const preserved = await migratedClient.execute(`
    SELECT id, documento, cpf, documento_normalizado
    FROM clientes
    WHERE id IN ('duplicado-formatado', 'duplicado-numerico', 'documento-nulo', 'documento-vazio')
    ORDER BY id
  `);
  assert.equal(preserved.rows.length, 4);
  assert.equal(preserved.rows.filter((row) => row.documento_normalizado === '52998224725').length, 2);
  assert.equal(preserved.rows.find((row) => row.id === 'documento-nulo')?.documento_normalizado, null);
  assert.equal(preserved.rows.find((row) => row.id === 'documento-vazio')?.documento_normalizado, null);

  const conflicts = await migratedClient.execute(`
    SELECT documento_normalizado, quantidade, resolvido_em
    FROM cliente_documento_conflitos
  `);
  assert.equal(conflicts.rows.length, 1);
  assert.equal(conflicts.rows[0]?.documento_normalizado, '52998224725');
  assert.equal(Number(conflicts.rows[0]?.quantidade), 2);
  assert.equal(conflicts.rows[0]?.resolvido_em, null);

  await assert.rejects(migratedClient.execute({
    sql: 'INSERT INTO clientes (id, nome, cpf) VALUES (?, ?, ?)',
    args: ['nova-colisao', 'Nova colisão', '529.982.247-25']
  }), /CLIENT_DOCUMENT_CONFLICT/);
  await migratedClient.execute({
    sql: 'INSERT INTO clientes (id, nome, cpf) VALUES (?, ?, NULL)',
    args: ['novo-sem-documento', 'Novo sem documento']
  });
  assert.equal((await migratedClient.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');

  await migratedClient.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await removeTestDatabase();
});
