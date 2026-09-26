import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { ensurePropertyIntegrity } from './services/runtime-migrations/v16-property-integrity';

const root = path.resolve(process.cwd(), 'scratch', `runtime-migrations-v16-${process.pid}`);
const databasePath = path.join(root, 'v16.db');

test('v16 preserva conflitos legados e bloqueia novas duplicidades normalizadas', async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  await fs.mkdir(root, { recursive: true });
  const client = createClient({ url: `file:${databasePath}` });
  try {
    await client.execute(`CREATE TABLE propriedades (
      id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, nome TEXT NOT NULL,
      matricula TEXT, car TEXT, ccir TEXT, itr TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )`);
    await client.batch([
      { sql: 'INSERT INTO propriedades (id, cliente_id, nome, matricula) VALUES (?, ?, ?, ?)', args: ['p1', 'c1', 'Fazenda Açores', '12.345-A'] },
      { sql: 'INSERT INTO propriedades (id, cliente_id, nome, matricula) VALUES (?, ?, ?, ?)', args: ['p2', 'c1', ' fazenda  acores ', '12 345 a'] },
      { sql: 'INSERT INTO propriedades (id, cliente_id, nome, matricula) VALUES (?, ?, ?, ?)', args: ['p3', 'c2', 'Fazenda Açores', '99'] }
    ]);

    await ensurePropertyIntegrity(client);
    await ensurePropertyIntegrity(client);

    const rows = await client.execute('SELECT id, nome_normalizado, matricula_normalizada FROM propriedades ORDER BY id');
    assert.equal(rows.rows[0]?.nome_normalizado, 'fazenda acores');
    assert.equal(rows.rows[0]?.matricula_normalizada, '12345A');
    assert.equal(rows.rows[1]?.nome_normalizado, null);
    assert.equal(rows.rows[1]?.matricula_normalizada, null);
    assert.equal(rows.rows[2]?.nome_normalizado, 'fazenda acores');
    assert.equal(Number((await client.execute('SELECT count(*) total FROM propriedade_integridade_conflitos')).rows[0]?.total), 2);

    await assert.rejects(client.execute({
      sql: `INSERT INTO propriedades
        (id, cliente_id, nome, nome_normalizado, matricula, matricula_normalizada)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['p4', 'c1', 'FAZENDA ACORES', 'fazenda acores', 'outro', 'OUTRO']
    }), /UNIQUE constraint/i);
    await assert.rejects(client.execute({
      sql: `INSERT INTO propriedades
        (id, cliente_id, nome, nome_normalizado, matricula, matricula_normalizada)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['p5', 'c3', 'Outra', 'outra', '12-345-A', '12345A']
    }), /UNIQUE constraint/i);
    assert.equal((await client.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');
  } finally {
    await client.close();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});
