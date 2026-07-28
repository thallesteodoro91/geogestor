import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const root = path.resolve(process.cwd(), 'scratch', `drizzle-client-document-${process.pid}`);
const dbPath = path.join(root, 'legacy.db');

test('migration SQL de documentos preserva base legada e instala proteção transacional', async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  const client = createClient({ url: `file:${dbPath}` });
  await client.execute(`CREATE TABLE clientes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    documento TEXT,
    cpf TEXT,
    cnpj TEXT,
    deleted_at TEXT
  )`);
  await client.execute(`INSERT INTO clientes (id, nome, cpf) VALUES
    ('a', 'Cliente A', '529.982.247-25'),
    ('b', 'Cliente B', '52998224725'),
    ('nulo', 'Sem documento', NULL)`);

  const migrationPath = path.resolve(__dirname, '..', '..', '..', 'packages', 'database', 'drizzle', '0008_client_document_integrity.sql');
  const statements = (await fs.readFile(migrationPath, 'utf8'))
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await client.execute(statement);

  assert.equal((await client.execute('SELECT count(*) AS total FROM clientes')).rows[0]?.total, 3);
  assert.equal((await client.execute('SELECT count(*) AS total FROM cliente_documento_conflitos')).rows[0]?.total, 1);
  await assert.rejects(client.execute(`INSERT INTO clientes (id, nome, cpf) VALUES
    ('c', 'Cliente C', '529.982.247-25')`), /CLIENT_DOCUMENT_CONFLICT/);
  await client.execute("INSERT INTO clientes (id, nome, cpf) VALUES ('sem-doc-2', 'Sem documento 2', NULL)");
  assert.equal((await client.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');

  await client.close();
  await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
});
