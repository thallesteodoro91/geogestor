import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { createRequire } from 'node:module';
import { databaseClientConfig } from '@geogestor/database';

const root = path.resolve(process.cwd(), 'scratch', `backup-restore-${process.pid}`);
const dbPath = path.join(root, 'source', 'geogestor.db');
const filesRoot = path.join(root, 'source-files');
const restoredDbPath = path.join(root, 'restored', 'geogestor.db');
const restoredFilesRoot = path.join(root, 'restored-files');

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_BACKUP_RETENTION = '3';
const databaseKey = Buffer.alloc(32, 73).toString('base64');
const requireFromHere = createRequire(__filename);
process.env.GEOGESTOR_DB_ENCRYPTION_KEY = databaseKey;
process.env.GEOGESTOR_DATABASE_WORKER = path.resolve(process.cwd(), 'apps/api/src/database-security-worker.ts');
process.env.GEOGESTOR_DATABASE_WORKER_RUNNER = requireFromHere.resolve('tsx/cli');
process.env.GEOGESTOR_BACKUP_RESTORE_WORKER = path.resolve(process.cwd(), 'apps/api/src/backup-restore-worker.ts');
process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_RUNNER = requireFromHere.resolve('tsx/cli');

async function reset() {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.mkdir(filesRoot, { recursive: true });
}

test('backup completo validado restaura banco e arquivos relacionados', async () => {
  await reset();
  const [{ runRuntimeMigrations }, { BackupService }, { RestoreAuthorizationService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./services/backup.service'),
    import('./services/restore-authorization.service')
  ]);
  await runRuntimeMigrations();

  const sourceClient = createClient(databaseClientConfig(dbPath));
  await sourceClient.execute({ sql: 'INSERT INTO clientes (id, nome) VALUES (?, ?)', args: ['cliente-backup', 'Cliente sintético'] });
  await sourceClient.execute({
    sql: `INSERT INTO configuracoes (id, empresa_nome, dados_pasta, admin_nome, admin_email, admin_senha_hash, setup_concluido, google_client_secret, google_refresh_token, google_access_token)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    args: ['config-backup', 'SkyGeo', filesRoot, 'Administrador', 'admin@example.invalid', 'scrypt:test:test', 'secret-sintetico', 'refresh-sintetico', 'access-sintetico']
  });
  await sourceClient.execute({
    sql: 'INSERT INTO projetos (id, cliente_id, nome) VALUES (?, ?, ?)',
    args: ['projeto-backup', 'cliente-backup', 'Projeto sintético']
  });
  await fs.writeFile(path.join(filesRoot, 'documento.txt'), 'versão preservada', 'utf8');

  const backup = await BackupService.createCompleteBackup(filesRoot);
  const bundleAuthorization = RestoreAuthorizationService.issueForTests(backup.bundlePath, { expiresAt: Date.now() + 5 * 60_000 });
  const selectedBundle = RestoreAuthorizationService.verify({ bundlePath: backup.bundlePath, authorization: bundleAuthorization });
  const validation = await BackupService.validateBackup(selectedBundle.bundlePath, selectedBundle.bundlePath);
  assert.equal(validation.quickCheck, 'ok');
  assert.equal(validation.foreignKeyViolations, 0);
  assert.equal(validation.manifest.type, 'complete');
  assert.equal(validation.manifest.formatVersion, 3);
  assert.equal(validation.manifest.credentialsExcluded, true);
  assert.equal(validation.integrity, 'verified');
  assert.equal(validation.checksumFilesVerified, validation.manifest.files.length);
  assert.ok(validation.manifest.files.every((entry) => entry.sha256 && entry.contentSha256));
  assert.ok(validation.manifest.device?.id);
  assert.ok(validation.manifest.device?.name);
  assert.equal((await fs.readdir(path.dirname(backup.bundlePath))).some((name) => name.includes('.pending-')), false);
  assert.equal((await fs.readFile(path.join(backup.bundlePath, 'database.db'))).includes(Buffer.from('Cliente sintético')), false);
  const encryptedDocument = validation.manifest.files.find((entry) => entry.kind === 'document');
  assert.ok(encryptedDocument);
  assert.equal((await fs.readFile(path.join(backup.bundlePath, encryptedDocument.path))).includes(Buffer.from('versão preservada')), false);

  const isolatedTest = await BackupService.testRestore(selectedBundle.bundlePath, selectedBundle.bundlePath);
  assert.equal(isolatedTest.tested, true);
  assert.equal(isolatedTest.temporaryDataRemoved, true);
  assert.equal(isolatedTest.credentialsExcluded, true);
  RestoreAuthorizationService.markTested({ bundlePath: backup.bundlePath, authorization: bundleAuthorization });

  const compatibleV2Bundle = `${backup.bundlePath}-v2`;
  await fs.cp(backup.bundlePath, compatibleV2Bundle, { recursive: true });
  const compatibleV2ManifestPath = path.join(compatibleV2Bundle, 'manifest.json');
  const compatibleV2Manifest = JSON.parse(await fs.readFile(compatibleV2ManifestPath, 'utf8'));
  compatibleV2Manifest.formatVersion = 2;
  await fs.writeFile(compatibleV2ManifestPath, JSON.stringify(compatibleV2Manifest), 'utf8');
  assert.equal((await BackupService.validateBackup(compatibleV2Bundle)).integrity, 'verified');

  const compatibleV1Bundle = `${backup.bundlePath}-v1`;
  await fs.cp(backup.bundlePath, compatibleV1Bundle, { recursive: true });
  const compatibleV1ManifestPath = path.join(compatibleV1Bundle, 'manifest.json');
  const compatibleV1Manifest = JSON.parse(await fs.readFile(compatibleV1ManifestPath, 'utf8'));
  compatibleV1Manifest.formatVersion = 1;
  for (const entry of compatibleV1Manifest.files) delete entry.sha256;
  await fs.writeFile(compatibleV1ManifestPath, JSON.stringify(compatibleV1Manifest), 'utf8');
  assert.equal((await BackupService.validateBackup(compatibleV1Bundle)).integrity, 'legacy-unverified');

  process.env.GEOGESTOR_DB_ENCRYPTION_KEY = Buffer.alloc(32, 74).toString('base64');
  await assert.rejects(BackupService.validateBackup(backup.bundlePath), /outra chave|incompatíveis|computador original/);
  process.env.GEOGESTOR_DB_ENCRYPTION_KEY = databaseKey;

  const corruptBundle = `${backup.bundlePath}-corrupt`;
  await fs.cp(backup.bundlePath, corruptBundle, { recursive: true });
  await fs.appendFile(path.join(corruptBundle, 'database.db'), 'corrupção sintética');
  await assert.rejects(BackupService.validateBackup(corruptBundle), /Tamanho divergente|Checksum divergente/);

  const incompatibleBundle = `${backup.bundlePath}-incompatible`;
  await fs.cp(backup.bundlePath, incompatibleBundle, { recursive: true });
  const incompatibleManifestPath = path.join(incompatibleBundle, 'manifest.json');
  const incompatibleManifest = JSON.parse(await fs.readFile(incompatibleManifestPath, 'utf8'));
  incompatibleManifest.schemaVersion = 999;
  await fs.writeFile(incompatibleManifestPath, JSON.stringify(incompatibleManifest), 'utf8');
  await assert.rejects(BackupService.validateBackup(incompatibleBundle), /versão mais nova/);

  const legacyBackup = path.join(path.dirname(backup.bundlePath), 'backup-legado.db');
  await fs.copyFile(path.join(backup.bundlePath, 'database.db'), legacyBackup);
  await assert.rejects(BackupService.validateBackup(legacyBackup), /Backup legado \.db/);

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

  const authorizedRestore = RestoreAuthorizationService.assertTested({ bundlePath: backup.bundlePath, authorization: bundleAuthorization });
  RestoreAuthorizationService.verify({ bundlePath: backup.bundlePath, authorization: bundleAuthorization }, { consume: true });
  const restore = await BackupService.restoreBackup({
    bundlePath: authorizedRestore.bundlePath,
    allowedBackupDirectory: authorizedRestore.bundlePath,
    targetDatabasePath: restoredDbPath,
    targetFilesRoot: restoredFilesRoot,
    confirmation: 'RESTORE_GEOGESTOR'
  });
  assert.equal(restore.restored, true);

  const secondRestore = await BackupService.restoreBackup({
    bundlePath: backup.bundlePath,
    targetDatabasePath: restoredDbPath,
    targetFilesRoot: restoredFilesRoot,
    confirmation: 'RESTORE_GEOGESTOR'
  });
  assert.equal(secondRestore.restored, true, 'duas restaurações isoladas consecutivas não devem manter o banco aberto');

  const restoredClient = createClient(databaseClientConfig(restoredDbPath));
  const clients = await restoredClient.execute('SELECT id FROM clientes ORDER BY id');
  const projects = await restoredClient.execute('SELECT id, cliente_id FROM projetos');
  const quickCheck = await restoredClient.execute('PRAGMA quick_check');
  const foreignKeys = await restoredClient.execute('PRAGMA foreign_key_check');
  assert.deepEqual(clients.rows.map((row) => row.id), ['cliente-backup']);
  assert.equal(projects.rows[0]?.cliente_id, 'cliente-backup');
  assert.equal(quickCheck.rows[0]?.quick_check, 'ok');
  assert.equal(foreignKeys.rows.length, 0);
  const restoredCredentials = await restoredClient.execute('SELECT google_client_secret, google_refresh_token, google_access_token FROM configuracoes');
  assert.equal(restoredCredentials.rows[0]?.google_client_secret, null);
  assert.equal(restoredCredentials.rows[0]?.google_refresh_token, null);
  assert.equal(restoredCredentials.rows[0]?.google_access_token, null);
  assert.equal(await fs.readFile(path.join(restoredFilesRoot, 'documento.txt'), 'utf8'), 'versão preservada');

  await restoredClient.close();

  const recoverySecret = Buffer.alloc(32, 91).toString('base64');
  process.env.GEOGESTOR_BACKUP_RECOVERY_KEY = recoverySecret;
  const portableBackup = await BackupService.createCompleteBackup(filesRoot);
  const portableManifest = JSON.parse(await fs.readFile(path.join(portableBackup.bundlePath, 'manifest.json'), 'utf8'));
  assert.equal(portableManifest.formatVersion, 4);
  assert.equal(portableManifest.encryption.dataKey, 'random-per-backup');
  assert.deepEqual(portableManifest.encryption.keyEnvelopes.map((item: { purpose: string }) => item.purpose).sort(), ['device', 'recovery']);

  const { BackupRecoveryService } = await import('./services/backup-recovery.service');
  const recoveryCode = BackupRecoveryService.formatRecoveryCode(recoverySecret);
  const nextDeviceKey = Buffer.alloc(32, 92).toString('base64');
  process.env.GEOGESTOR_DB_ENCRYPTION_KEY = nextDeviceKey;
  delete process.env.GEOGESTOR_BACKUP_RECOVERY_KEY;
  await assert.rejects(BackupService.validateBackup(portableBackup.bundlePath), /código|kit|outro computador/);
  const portableValidation = await BackupService.validateBackup(portableBackup.bundlePath, path.dirname(portableBackup.bundlePath), { recoveryCode });
  assert.equal(portableValidation.manifest.formatVersion, 4);

  const portableTarget = path.join(root, 'portable-restored', 'geogestor.db');
  const portableFilesTarget = path.join(root, 'portable-restored-files');
  await BackupService.restoreBackup({
    bundlePath: portableBackup.bundlePath,
    targetDatabasePath: portableTarget,
    targetFilesRoot: portableFilesTarget,
    confirmation: 'RESTORE_GEOGESTOR',
    recoveryCode
  });
  const portableClient = createClient(databaseClientConfig(portableTarget));
  assert.equal((await portableClient.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');
  assert.equal((await portableClient.execute('SELECT COUNT(*) AS total FROM clientes')).rows[0]?.total, 2);
  await portableClient.close();
  process.env.GEOGESTOR_DB_ENCRYPTION_KEY = databaseKey;
  process.env.GEOGESTOR_BACKUP_RECOVERY_KEY = recoverySecret;

  const rollbackDbPath = path.join(root, 'rollback', 'geogestor.db');
  const rollbackFilesRoot = path.join(root, 'rollback-files');
  await fs.mkdir(path.dirname(rollbackDbPath), { recursive: true });
  await fs.mkdir(rollbackFilesRoot, { recursive: true });
  await fs.copyFile(path.join(backup.bundlePath, 'database.db'), rollbackDbPath);
  const rollbackDatabaseBefore = await fs.readFile(rollbackDbPath);
  await fs.writeFile(path.join(rollbackFilesRoot, 'documento.txt'), 'estado anterior', 'utf8');
  BackupService.setRestoreFailureInjectorForTests((stage) => {
    if (stage === 'files-installed') throw new Error('Falha sintética após instalar arquivos');
  });
  process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_ACTIVE = '1';
  await assert.rejects(BackupService.restoreBackup({
    bundlePath: backup.bundlePath,
    targetDatabasePath: rollbackDbPath,
    targetFilesRoot: rollbackFilesRoot,
    confirmation: 'RESTORE_GEOGESTOR'
  }), /Falha sintética/);
  delete process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_ACTIVE;
  BackupService.setRestoreFailureInjectorForTests(null);

  assert.deepEqual(await fs.readFile(rollbackDbPath), rollbackDatabaseBefore);
  const rolledBackClient = createClient(databaseClientConfig(rollbackDbPath));
  const rolledBackClients = await rolledBackClient.execute('SELECT id FROM clientes ORDER BY id');
  assert.deepEqual(rolledBackClients.rows.map((row) => row.id), ['cliente-backup']);
  assert.equal(await fs.readFile(path.join(rollbackFilesRoot, 'documento.txt'), 'utf8'), 'estado anterior');
  assert.equal((await rolledBackClient.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');
  await rolledBackClient.close();
  await sourceClient.close();
});
