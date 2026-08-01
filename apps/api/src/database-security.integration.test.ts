import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import {
  databaseClientConfig,
  ensureDatabaseProtectionSync,
  inspectProtectedDatabaseSync,
  rotateDatabaseKeySync
} from '@geogestor/database';

const root = path.resolve(process.cwd(), 'scratch', `database-security-${process.pid}`);
const keyOne = Buffer.alloc(32, 31).toString('base64');
const keyTwo = Buffer.alloc(32, 47).toString('base64');
const marker = 'DADO-SENSIVEL-GEOGESTOR-987654';
const requireFromHere = createRequire(__filename);
process.env.GEOGESTOR_DATABASE_WORKER = path.resolve(process.cwd(), 'apps/api/src/database-security-worker.ts');
process.env.GEOGESTOR_DATABASE_WORKER_RUNNER = requireFromHere.resolve('tsx/cli');

async function createLegacyDatabase(databasePath: string, invalidForeignKey = false) {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  const clientModule = requireFromHere.resolve('@libsql/client');
  const script = `
    const { createClient } = require(process.argv[1]);
    (async () => {
      const client = createClient({ url: 'file:' + process.argv[2] });
      await client.execute('PRAGMA foreign_keys = OFF');
      await client.execute('CREATE TABLE clientes (id TEXT PRIMARY KEY, nome TEXT NOT NULL)');
      if (process.argv[4] === '1') {
        await client.execute('CREATE TABLE projetos (id TEXT PRIMARY KEY, cliente_id TEXT REFERENCES clientes(id))');
        await client.execute("INSERT INTO projetos (id, cliente_id) VALUES ('p1', 'inexistente')");
      }
      await client.execute({ sql: 'INSERT INTO clientes (id, nome) VALUES (?, ?)', args: ['c1', process.argv[3]] });
      client.close();
    })().catch((error) => { console.error(error.message); process.exit(1); });
  `;
  const result = spawnSync(process.execPath, ['-e', script, clientModule, databasePath, marker, invalidForeignKey ? '1' : '0'], {
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
}

test('migra banco legado para arquivo criptografado e rejeita chave incorreta', async () => {
  await fs.rm(root, { recursive: true, force: true });
  const databasePath = path.join(root, 'migration', 'geogestor.db');
  await createLegacyDatabase(databasePath);

  const result = ensureDatabaseProtectionSync(databasePath, keyOne);
  assert.equal(result.status, 'migrated');
  assert.ok(result.recoveryPath);
  assert.equal((await fs.readFile(databasePath)).includes(Buffer.from(marker)), false);
  assert.equal((await fs.readFile(result.recoveryPath!)).includes(Buffer.from(marker)), false);
  assert.deepEqual(inspectProtectedDatabaseSync(databasePath, keyOne).encrypted, true);

  const correct = createClient(databaseClientConfig(databasePath, keyOne));
  assert.equal((await correct.execute('SELECT nome FROM clientes')).rows[0]?.nome, marker);
  correct.close();
  await assert.rejects(
    createClient(databaseClientConfig(databasePath, keyTwo)).execute('SELECT nome FROM clientes'),
    /not a database|SQLITE_NOTADB/i
  );
  await assert.rejects(
    createClient({ url: `file:${databasePath}` }).execute('SELECT nome FROM clientes'),
    /not a database|SQLITE_NOTADB/i
  );
});

test('falha de migração preserva integralmente o banco legado', async () => {
  const databasePath = path.join(root, 'rollback', 'geogestor.db');
  await createLegacyDatabase(databasePath, true);
  const before = await fs.readFile(databasePath);
  assert.throws(() => ensureDatabaseProtectionSync(databasePath, keyOne), /vínculo|integridade/i);
  assert.deepEqual(await fs.readFile(databasePath), before);
  const legacy = createClient({ url: `file:${databasePath}` });
  assert.equal((await legacy.execute('SELECT nome FROM clientes')).rows[0]?.nome, marker);
  legacy.close();
});

test('rotaciona a chave com recuperação controlada pela chave anterior', async () => {
  const databasePath = path.join(root, 'rotation', 'geogestor.db');
  await createLegacyDatabase(databasePath);
  ensureDatabaseProtectionSync(databasePath, keyOne);
  const result = rotateDatabaseKeySync(databasePath, keyOne, keyTwo);
  assert.ok(result.recoveryPath);
  await assert.rejects(
    createClient(databaseClientConfig(databasePath, keyOne)).execute('SELECT nome FROM clientes'),
    /not a database|SQLITE_NOTADB/i
  );
  const current = createClient(databaseClientConfig(databasePath, keyTwo));
  assert.equal((await current.execute('SELECT nome FROM clientes')).rows[0]?.nome, marker);
  current.close();
  const recovery = createClient(databaseClientConfig(result.recoveryPath, keyOne));
  assert.equal((await recovery.execute('SELECT nome FROM clientes')).rows[0]?.nome, marker);
  recovery.close();
});

test('banco e WAL não expõem conteúdo sensível em texto claro', async () => {
  const databasePath = path.join(root, 'wal', 'geogestor.db');
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  const client = createClient(databaseClientConfig(databasePath, crypto.randomBytes(32).toString('base64')));
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('CREATE TABLE segredos (valor TEXT)');
  await client.execute({ sql: 'INSERT INTO segredos (valor) VALUES (?)', args: [marker] });
  assert.equal((await fs.readFile(databasePath)).includes(Buffer.from(marker)), false);
  const walPath = `${databasePath}-wal`;
  try {
    assert.equal((await fs.readFile(walPath)).includes(Buffer.from(marker)), false);
  } catch (error) {
    assert.equal((error as NodeJS.ErrnoException).code, 'ENOENT');
  }
  client.close();
});
