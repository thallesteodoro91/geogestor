import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `system-health-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const filesRoot = path.join(testRoot, 'documents');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;

function fileSystemError(code: string) {
  return Object.assign(new Error(`Falha sintética ${code}`), { code });
}

function adapterWithStatFailure(targetToFail: string, code: string) {
  return {
    stat: (async (target: Parameters<typeof fs.stat>[0], options?: Parameters<typeof fs.stat>[1]) => {
      if (path.resolve(String(target)) === path.resolve(targetToFail)) throw fileSystemError(code);
      return fs.stat(target, options as never);
    }) as typeof fs.stat,
    access: fs.access,
    writeFile: fs.writeFile,
    rm: fs.rm
  };
}

test('diagnóstico da pasta distingue estados sem criar ou expor o caminho configurado', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ runRuntimeMigrations }, { db }, { schema }, { SystemHealthService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./services/system-health.service')
  ]);
  await runRuntimeMigrations();

  let health = await SystemHealthService.inspect();
  assert.equal(health.checks.filesDirectoryWritable, null);
  assert.equal(health.checks.filesDirectory.code, 'not_configured');
  assert.equal(health.status, 'ok');

  await db.insert(schema.configuracoes).values({
    id: 'health-config',
    empresaNome: 'GeoGestor Teste',
    dadosPasta: filesRoot,
    adminNome: 'Administrador',
    adminEmail: 'admin@example.invalid',
    adminSenhaHash: 'scrypt:test:test',
    setupConcluido: true
  });

  SystemHealthService.configureFileSystemForTests(adapterWithStatFailure(filesRoot, 'ENOENT'));
  health = await SystemHealthService.inspect();
  assert.equal(health.checks.filesDirectory.code, 'directory_missing');
  assert.equal(health.checks.filesDirectoryWritable, false);
  await assert.rejects(fs.stat(filesRoot));

  for (const [errorCode, expected] of [
    ['EACCES', 'permission_denied'],
    ['EPERM', 'operation_not_permitted'],
    ['ENOTDIR', 'invalid_path'],
    ['EBUSY', 'temporarily_unavailable']
  ] as const) {
    SystemHealthService.configureFileSystemForTests(adapterWithStatFailure(filesRoot, errorCode));
    health = await SystemHealthService.inspect();
    assert.equal(health.checks.filesDirectory.code, expected);
    assert.doesNotMatch(JSON.stringify(health.checks.filesDirectory), new RegExp(filesRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const driveRoot = path.parse(filesRoot).root;
  SystemHealthService.configureFileSystemForTests(adapterWithStatFailure(driveRoot, 'ENOENT'));
  health = await SystemHealthService.inspect();
  assert.equal(health.checks.filesDirectory.code, 'drive_unavailable');

  SystemHealthService.configureFileSystemForTests(null);
  await fs.mkdir(filesRoot, { recursive: true });
  health = await SystemHealthService.inspect();
  assert.equal(health.checks.filesDirectory.code, 'ok');
  assert.equal(health.checks.filesDirectoryWritable, true);
  assert.equal(health.status, 'ok');

  await db.update(schema.configuracoes).set({ dadosPasta: '' }).where(eq(schema.configuracoes.id, 'health-config'));
  health = await SystemHealthService.inspect();
  assert.equal(health.checks.filesDirectory.code, 'not_configured');
  SystemHealthService.configureFileSystemForTests(null);
});
