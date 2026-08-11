import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `backup-activity-${process.pid}`);
process.env.GEOGESTOR_DB_PATH = path.join(testRoot, 'geogestor.db');

test('alterações ocorridas durante o backup continuam pendentes', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  const [{ OperationalLogService }, { BackupActivityService }] = await Promise.all([
    import('./services/operational-log.service'),
    import('./services/backup-activity.service')
  ]);
  OperationalLogService.resetForTests();
  BackupActivityService.resetForTests();

  await Promise.all([
    BackupActivityService.markChanged(),
    BackupActivityService.markChanged(),
    BackupActivityService.markChanged()
  ]);
  const capturedSequence = BackupActivityService.captureSequence();
  assert.equal(capturedSequence, 3);
  assert.equal(BackupActivityService.snapshot().pendingChanges, 3);

  await BackupActivityService.markChanged('complete');
  await BackupActivityService.markProtected(capturedSequence, {
    completedAt: new Date().toISOString(),
    bundleName: 'geogestor-backup-complete-sintetico'
  });

  const afterBackup = BackupActivityService.snapshot();
  assert.equal(afterBackup.changeSequence, 4);
  assert.equal(afterBackup.protectedSequence, 3);
  assert.equal(afterBackup.pendingChanges, 1);
  assert.equal(afterBackup.completeRequired, true);
  assert.ok(afterBackup.firstPendingAt);
  await OperationalLogService.shutdown();
  await fs.rm(testRoot, { recursive: true, force: true });
});

test('adaptador de pasta nunca inventa confirmação da nuvem', async () => {
  const { SynchronizedFolderBackupAdapter } = await import('./services/backup-provider.service');
  const adapter = new SynchronizedFolderBackupAdapter();
  const configured = await adapter.inspect(path.join(testRoot, 'OneDrive-like-name'));
  assert.equal(configured.availability, 'available');
  assert.equal(configured.upload, 'not_observable');
  assert.equal(configured.confirmation, 'unavailable');
  assert.match(configured.message, /Confirmação da nuvem indisponível/);
});
