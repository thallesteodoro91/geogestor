import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', `crm-migration-${process.pid}`);
const dbPath = path.join(testRoot, 'crm-migration.integration.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

async function removeTestDatabase() {
  for (const file of dbFiles) await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
}

process.env.GEOGESTOR_DB_PATH = dbPath;

test('migração do CRM preserva oportunidades e habilita vínculo opcional com lead', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const preMigrationClient = createClient({ url: `file:${dbPath}` });
  await preMigrationClient.execute(`CREATE TABLE contatos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    empresa TEXT,
    cidade TEXT,
    observacoes TEXT,
    origem TEXT,
    status TEXT DEFAULT 'ativo' NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  await preMigrationClient.execute({
    sql: 'INSERT INTO contatos (id, nome, email, status) VALUES (?, ?, ?, ?)',
    args: ['lead-legado', 'Lead legado preservado', 'legado@example.com', 'ativo']
  });
  await preMigrationClient.close();

  const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');
  await runRuntimeMigrations();

  const legacyClient = createClient({ url: `file:${dbPath}` });
  await legacyClient.execute('PRAGMA foreign_keys = OFF;');
  await legacyClient.execute('DROP TABLE oportunidade_estagios_historico;');
  await legacyClient.execute('DROP TABLE oportunidades;');
  await legacyClient.execute(`CREATE TABLE oportunidades (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES clientes(id),
    titulo TEXT NOT NULL,
    valor_estimado INTEGER,
    estagio TEXT DEFAULT 'Prospect' NOT NULL,
    ordem INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  await legacyClient.execute({ sql: 'INSERT INTO clientes (id, nome) VALUES (?, ?)', args: ['cliente-legado', 'Cliente legado'] });
  await legacyClient.execute({
    sql: 'INSERT INTO oportunidades (id, cliente_id, titulo, valor_estimado) VALUES (?, ?, ?, ?)',
    args: ['oportunidade-legada', 'cliente-legado', 'Levantamento legado', 150_000]
  });
  await legacyClient.execute("UPDATE schema_migrations SET status = 'failed' WHERE version = 10");
  await legacyClient.close();

  await runRuntimeMigrations();

  const migratedClient = createClient({ url: `file:${dbPath}` });
  const rows = await migratedClient.execute('SELECT id, cliente_id, lead_id, titulo, valor_estimado, estagio FROM oportunidades');
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].id, 'oportunidade-legada');
  assert.equal(rows.rows[0].cliente_id, 'cliente-legado');
  assert.equal(rows.rows[0].lead_id, null);
  assert.equal(rows.rows[0].titulo, 'Levantamento legado');
  assert.equal(Number(rows.rows[0].valor_estimado), 150_000);
  assert.equal(rows.rows[0].estagio, 'Prospectado');

  const columns = await migratedClient.execute('PRAGMA table_info(oportunidades)');
  const clientColumn = columns.rows.find((column) => column.name === 'cliente_id');
  assert.equal(Number(clientColumn?.notnull), 0);
  assert.equal(columns.rows.some((column) => column.name === 'lead_id'), true);

  const contactColumns = await migratedClient.execute('PRAGMA table_info(contatos)');
  assert.equal(contactColumns.rows.some((column) => column.name === 'cliente_convertido_id'), true);
  assert.equal(contactColumns.rows.some((column) => column.name === 'convertido_em'), true);
  const preservedLead = await migratedClient.execute({
    sql: 'SELECT id, nome, email, status, cliente_convertido_id, convertido_em FROM contatos WHERE id = ?',
    args: ['lead-legado']
  });
  assert.equal(preservedLead.rows.length, 1);
  assert.equal(preservedLead.rows[0].nome, 'Lead legado preservado');
  assert.equal(preservedLead.rows[0].email, 'legado@example.com');
  assert.equal(preservedLead.rows[0].status, 'ativo');
  assert.equal(preservedLead.rows[0].cliente_convertido_id, null);
  assert.equal(preservedLead.rows[0].convertido_em, null);

  const foreignKeyCheck = await migratedClient.execute('PRAGMA foreign_key_check');
  assert.equal(foreignKeyCheck.rows.length, 0);
  await migratedClient.close();
  await removeTestDatabase().catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
  });
});
