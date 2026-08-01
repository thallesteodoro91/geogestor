import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('cópia histórica sem contatos migra integralmente sem alterar a origem', () => {
  const root = process.cwd();
  const source = path.join(root, 'data', 'geogestor.db.backup_inicio_fase1');
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
});
