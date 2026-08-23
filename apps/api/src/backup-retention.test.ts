import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), 'scratch', `backup-retention-${process.pid}`);
process.env.GEOGESTOR_DB_PATH = path.join(root, 'database', 'geogestor.db');

async function createBundle(name: string, type: 'database' | 'complete', completedAt: string) {
  const target = path.join(root, 'backups', name);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify({
    application: 'GeoGestor',
    formatVersion: 3,
    type,
    createdAt: completedAt,
    completedAt,
    totals: { files: 1, bytes: 100 },
    files: []
  }), 'utf8');
}

test('retenção nunca remove a única versão mais recente de cada tipo', async () => {
  await fs.rm(root, { recursive: true, force: true });
  const backupDirectory = path.join(root, 'backups');
  await createBundle('geogestor-backup-database-2026-08-08', 'database', '2026-08-08T12:00:00.000Z');
  await createBundle('geogestor-backup-database-2025-01-01', 'database', '2025-01-01T12:00:00.000Z');
  await createBundle('geogestor-backup-complete-2026-08-07', 'complete', '2026-08-07T12:00:00.000Z');
  await createBundle('geogestor-backup-complete-2025-01-01', 'complete', '2025-01-01T12:00:00.000Z');
  const { BackupService } = await import('./services/backup.service');

  await BackupService.enforceRetention(1, backupDirectory, 1, 1, 1, 1);

  const remaining = (await fs.readdir(backupDirectory)).sort();
  assert.deepEqual(remaining, [
    'geogestor-backup-complete-2026-08-07',
    'geogestor-backup-database-2026-08-08'
  ]);
  await fs.rm(root, { recursive: true, force: true });
});

test('backup .db legado é classificado como não verificado e nunca entra na limpeza automática', async () => {
  await fs.rm(root, { recursive: true, force: true });
  const backupDirectory = path.join(root, 'backups');
  await createBundle('geogestor-backup-database-2026-08-08', 'database', '2026-08-08T12:00:00.000Z');
  const legacyPath = path.join(backupDirectory, 'geogestor-backup-legacy-2025.db');
  await fs.writeFile(legacyPath, 'conteúdo sintético legado', 'utf8');
  const { BackupService } = await import('./services/backup.service');

  const storage = await BackupService.getStorageStatus(backupDirectory);
  const legacy = storage.history.find((item) => item.directory === path.basename(legacyPath));
  assert.equal(storage.legacyVersions, 1);
  assert.equal(legacy?.legacy, true);
  assert.equal(legacy?.integrityState, 'legacy_unverified');
  assert.equal(storage.latestByType.database?.legacy, false);

  await BackupService.enforceRetention(1, backupDirectory, 1, 1, 1, 1);
  assert.equal(await fs.readFile(legacyPath, 'utf8'), 'conteúdo sintético legado');
  await fs.rm(root, { recursive: true, force: true });
});
