import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const root = path.resolve(process.cwd(), 'scratch', 'backup-restore-test');
const dbPath = path.join(root, 'source', 'geogestor.db');
const filesRoot = path.join(root, 'source-files');
const restoredDbPath = path.join(root, 'restored', 'geogestor.db');
const restoredFilesRoot = path.join(root, 'restored-files');

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_BACKUP_RETENTION = '3';

async function reset() {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.mkdir(filesRoot, { recursive: true });
}

test('backup completo validado restaura banco e arquivos relacionados', async () => {
  await reset();
  const [{ runRuntimeMigrations }, { BackupService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./services/backup.service')
  ]);
  await runRuntimeMigrations();

  const sourceClient = createClient({ url: `file:${dbPath}` });
  await sourceClient.execute({ sql: 'INSERT INTO clientes (id, nome) VALUES (?, ?)', args: ['cliente-backup', 'Cliente sintético'] });
  await sourceClient.execute({
    sql: 'INSERT INTO projetos (id, cliente_id, nome) VALUES (?, ?, ?)',
    args: ['projeto-backup', 'cliente-backup', 'Projeto sintético']
  });
  await fs.writeFile(path.join(filesRoot, 'documento.txt'), 'versão preservada', 'utf8');

  const backup = await BackupService.createCompleteBackup(filesRoot);
  const validation = await BackupService.validateBackup(backup.bundlePath);
  assert.equal(validation.quickCheck, 'ok');
  assert.equal(validation.foreignKeyViolations, 0);
  assert.equal(validation.manifest.type, 'complete');

  await assert.rejects(
    BackupService.restoreBackup({
      bundlePath: backup.bundlePath,
      targetDatabasePath: restoredDbPath,
      targetFilesRoot: restoredFilesRoot,
      confirmation: 'confirmar'
    }),
    /Confirmação de restauração inválida/
  );

  await sourceClient.execute({ sql: 'INSERT INTO clientes (id, nome) VALUES (?, ?)', args: ['cliente-posterior', 'Alteração posterior'] });
  await fs.writeFile(path.join(filesRoot, 'documento.txt'), 'versão alterada', 'utf8');

  const restore = await BackupService.restoreBackup({
    bundlePath: backup.bundlePath,
    targetDatabasePath: restoredDbPath,
    targetFilesRoot: restoredFilesRoot,
    confirmation: 'RESTORE_GEOGESTOR'
  });
  assert.equal(restore.restored, true);

  const restoredClient = createClient({ url: `file:${restoredDbPath}` });
  const clients = await restoredClient.execute('SELECT id FROM clientes ORDER BY id');
  const projects = await restoredClient.execute('SELECT id, cliente_id FROM projetos');
  const quickCheck = await restoredClient.execute('PRAGMA quick_check');
  const foreignKeys = await restoredClient.execute('PRAGMA foreign_key_check');
  assert.deepEqual(clients.rows.map((row) => row.id), ['cliente-backup']);
  assert.equal(projects.rows[0]?.cliente_id, 'cliente-backup');
  assert.equal(quickCheck.rows[0]?.quick_check, 'ok');
  assert.equal(foreignKeys.rows.length, 0);
  assert.equal(await fs.readFile(path.join(restoredFilesRoot, 'documento.txt'), 'utf8'), 'versão preservada');

  await restoredClient.close();
  await sourceClient.close();
});
