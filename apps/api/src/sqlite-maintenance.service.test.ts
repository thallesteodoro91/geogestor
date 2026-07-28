import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `sqlite-maintenance-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_WAL_CHECKPOINT_BYTES = '0';

test('manutenção usa exclusão mútua, optimize e checkpoint passivo sem VACUUM', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ runRuntimeMigrations }, { MaintenanceCoordinator }, { SqliteMaintenanceService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./services/maintenance-coordinator.service'),
    import('./services/sqlite-maintenance.service')
  ]);
  await runRuntimeMigrations();
  SqliteMaintenanceService.resetForTests();

  let releaseBackup: () => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseBackup = resolve; });
  const backup = MaintenanceCoordinator.runExclusive('backup', async () => {
    markStarted();
    await release;
  });
  await started;

  const maintenance = SqliteMaintenanceService.runIfDue(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(MaintenanceCoordinator.snapshot().activeOperation, 'backup');
  assert.equal(MaintenanceCoordinator.snapshot().waiting, 1);
  releaseBackup();
  await backup;
  const result = await maintenance;
  assert.ok(result);
  assert.equal(typeof result.databaseBytes, 'number');
  assert.equal(typeof result.durationMs, 'number');
  assert.ok(result.checkpoint);
  assert.equal(MaintenanceCoordinator.snapshot().activeOperation, null);

  const source = await fs.readFile(path.resolve(__dirname, 'services', 'sqlite-maintenance.service.ts'), 'utf8');
  assert.doesNotMatch(source, /\bVACUUM\b/i);
});
