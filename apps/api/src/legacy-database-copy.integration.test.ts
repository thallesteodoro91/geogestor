import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('cópia histórica sem contatos migra integralmente sem alterar a origem', async (t) => {
  const root = process.cwd();
  const fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'geogestor-legacy-test-'));
  t.after(() => fs.rm(fixtureDirectory, { recursive: true, force: true }));
  const source = path.join(fixtureDirectory, 'geogestor-legado.db');
  const database = new DatabaseSync(source);
  try {
    const migrations = path.join(root, 'packages', 'database', 'drizzle');
    database.exec(await fs.readFile(path.join(migrations, '0000_opposite_senator_kelly.sql'), 'utf8'));
    database.exec(await fs.readFile(path.join(migrations, '0001_magical_karma.sql'), 'utf8'));
    database.exec(`
      DROP TABLE contatos;
      INSERT INTO clientes (id, nome) VALUES ('cliente-legado', 'Cliente fictício');
      INSERT INTO projetos (id, cliente_id, nome) VALUES ('projeto-legado', 'cliente-legado', 'Projeto fictício');
      INSERT INTO orcamentos (id, cliente_id, projeto_id, valor_total) VALUES ('orcamento-legado', 'cliente-legado', 'projeto-legado', 12345);
    `);
  } finally {
    database.close();
  }
  const beforeMigration = await fs.readFile(source);
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts', 'validate-legacy-migration.mjs'),
    '--source',
    source,
  ], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Resultado: APROVADO/);
  assert.deepEqual(await fs.readFile(source), beforeMigration);
});
