import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { ensureSharedWorkspacePolish } from './services/runtime-migrations/v15-shared-workspace-polish';

const root = path.resolve(process.cwd(), 'scratch', `runtime-migrations-v15-${process.pid}`);
const databasePath = path.join(root, 'v15.db');

test('v15 preserva despesas antigas e cria modelos uma única vez', async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  await fs.mkdir(root, { recursive: true });
  const client = createClient({ url: `file:${databasePath}` });
  try {
    await client.execute('CREATE TABLE despesas (id TEXT PRIMARY KEY, descricao TEXT NOT NULL, categoria TEXT NOT NULL, deleted_at TEXT)');
    await client.execute({ sql: 'INSERT INTO despesas (id, descricao, categoria) VALUES (?, ?, ?)', args: ['expense-old', 'Despesa preservada', 'Campo'] });

    await ensureSharedWorkspacePolish(client);
    await ensureSharedWorkspacePolish(client);

    const expense = (await client.execute("SELECT descricao, categoria, subcategoria FROM despesas WHERE id = 'expense-old'")).rows[0];
    assert.deepEqual({ descricao: expense?.descricao, categoria: expense?.categoria, subcategoria: expense?.subcategoria }, {
      descricao: 'Despesa preservada', categoria: 'Campo', subcategoria: null
    });
    assert.equal(Number((await client.execute('SELECT count(*) total FROM checklist_modelos')).rows[0]?.total), 5);
    assert.ok(Number((await client.execute('SELECT count(*) total FROM checklist_modelo_etapas')).rows[0]?.total) > 5);
    assert.equal(Number((await client.execute("SELECT count(*) total FROM pragma_table_info('despesas') WHERE name = 'subcategoria'")).rows[0]?.total), 1);
  } finally {
    await client.close();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});
