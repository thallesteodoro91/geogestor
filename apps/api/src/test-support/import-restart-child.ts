import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const mode = process.argv[2];
const root = process.env.GEOGESTOR_E2E_ROOT!;
const send = (data: unknown) => new Promise<void>((resolve, reject) => {
  if (!process.send) return reject(new Error('Este auxiliar exige IPC.'));
  process.send(data, error => error ? reject(error) : resolve());
});
const pause = async (data: unknown) => {
  await send(data);
  setInterval(() => undefined, 1000);
  await new Promise<never>(() => undefined);
};

async function main() {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.ok(['queued', 'transaction', 'committed', 'backup', 'restore'].includes(mode));
  const scratch = path.resolve('scratch');
  const relative = path.relative(scratch, path.resolve(root));
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'O perfil deve ficar no scratch do projeto.');
  assert.equal(path.resolve(process.env.GEOGESTOR_DB_PATH!), path.join(path.resolve(root), 'geogestor.db'));
  await fs.mkdir(root, { recursive: true });
  const requireApi = createRequire(path.resolve('apps/api/package.json'));
  process.env.GEOGESTOR_DATABASE_WORKER = path.resolve('apps/api/src/database-security-worker.ts');
  process.env.GEOGESTOR_DATABASE_WORKER_RUNNER = requireApi.resolve('tsx/cli');
  process.env.GEOGESTOR_BACKUP_RESTORE_WORKER = path.resolve('apps/api/src/backup-restore-worker.ts');
  process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_RUNNER = requireApi.resolve('tsx/cli');

  if (mode === 'restore') {
    const { BackupService } = await import('../services/backup.service');
    const { databaseClientConfig } = await import('@geogestor/database');
    const { createClient } = await import('@libsql/client');
    const bundle = process.env.QA_BUNDLE!;
    await assert.rejects(BackupService.validateBackup(bundle, bundle), /código|kit|outro computador/);
    await assert.rejects(BackupService.validateBackup(bundle, bundle, { recoveryCode: 'INVALIDO' }));
    const start = performance.now();
    const result = await BackupService.restoreBackup({
      bundlePath: bundle, allowedBackupDirectory: bundle,
      targetDatabasePath: process.env.GEOGESTOR_DB_PATH!, targetFilesRoot: path.join(root, 'documents'),
      confirmation: 'RESTORE_GEOGESTOR', recoveryCode: process.env.QA_RECOVERY_CODE!
    });
    assert.equal(result.restored, true);
    const client = createClient(databaseClientConfig(process.env.GEOGESTOR_DB_PATH!));
    try {
      assert.deepEqual((await client.execute('SELECT id FROM clientes')).rows.map(row => row.id), ['qa-portable-client']);
      assert.equal((await client.execute('SELECT cliente_id FROM projetos')).rows[0]?.cliente_id, 'qa-portable-client');
      assert.equal((await client.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');
      assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
      assert.equal(await fs.readFile(path.join(root, 'documents', 'documento.txt'), 'utf8'), 'Documento fictício preservado entre perfis.');
      // Selecting paths on the replacement computer is an explicit preparation
      // step; absolute paths from the source computer must never be assumed valid.
      await client.execute({ sql: 'UPDATE configuracoes SET dados_pasta=?', args: [path.join(root, 'documents')] });
      await client.execute({ sql: 'UPDATE documentos SET caminho=?', args: [path.join(root, 'documents', 'documento.txt')] });
      await send({ phase: 'restored', restoreMs: performance.now() - start, checks: ['missing-code-blocked', 'wrong-code-blocked', 'client', 'project-link', 'document', 'quick-check', 'foreign-keys'] });
    } finally { client.close(); }
    return;
  }

  const { db, dbReady, closeDb } = await import('../db');
  const { runRuntimeMigrations } = await import('../services/runtime-migrations.service');
  await dbReady;
  await runRuntimeMigrations();
  if (mode === 'backup') {
    const { schema } = await import('@geogestor/database');
    const { BackupService } = await import('../services/backup.service');
    const { BackupRecoveryService } = await import('../services/backup-recovery.service');
    await db.insert(schema.clientes).values({ id: 'qa-portable-client', nome: 'Cliente fictício portátil' });
    await db.insert(schema.projetos).values({ id: 'qa-portable-project', clienteId: 'qa-portable-client', nome: 'Projeto fictício portátil' });
    const documents = path.join(root, 'documents');
    await fs.mkdir(documents, { recursive: true });
    await fs.writeFile(path.join(documents, 'documento.txt'), 'Documento fictício preservado entre perfis.');
    await db.insert(schema.configuracoes).values({ id: crypto.randomUUID(), empresaNome: 'Empresa fictícia QA — não usar em produção', dadosPasta: documents, adminNome: 'Administrador fictício', adminEmail: 'qa@example.invalid', adminSenhaHash: 'disabled-qa', setupConcluido: true });
    await db.insert(schema.documentos).values({ id: crypto.randomUUID(), clienteId: 'qa-portable-client', projetoId: 'qa-portable-project', nome: 'Documento fictício', nomeOriginal: 'documento.txt', extensao: '.txt', caminho: path.join(documents, 'documento.txt'), caminhoRelativo: 'documento.txt', tamanhoBytes: (await fs.stat(path.join(documents, 'documento.txt'))).size, mimeType: 'text/plain' });
    const { BackupPolicyService, DEFAULT_BACKUP_POLICY } = await import('../services/backup-policy.service');
    const destination = path.join(root, 'backups');
    await BackupPolicyService.save({ ...DEFAULT_BACKUP_POLICY, automaticEnabled: false, destinationDirectory: destination });
    assert.equal((await BackupPolicyService.get()).destinationDirectory, destination);
    assert.equal((await BackupPolicyService.validateDestination(destination)).writable, true);
    await assert.rejects(BackupPolicyService.validateDestination(documents), /fora da pasta/);
    const unavailable = path.join(root, 'destination-is-a-file');
    await fs.writeFile(unavailable, 'indisponível');
    await assert.rejects(BackupPolicyService.validateDestination(unavailable));
    const start = performance.now();
    const backup = await BackupService.createCompleteBackup(documents, { destinationDirectory: destination });
    const manifest = JSON.parse(await fs.readFile(path.join(backup.bundlePath, 'manifest.json'), 'utf8'));
    assert.equal(manifest.formatVersion, 4);
    await send({ phase: 'backup', bundle: backup.bundlePath, recoveryCode: BackupRecoveryService.formatRecoveryCode(process.env.GEOGESTOR_BACKUP_RECOVERY_KEY!), backupMs: performance.now() - start });
    closeDb();
    return;
  }

  const { previewFullSpreadsheetImport } = await import('../services/full-spreadsheet-import.service');
  const runs = await import('../services/import-run.service');
  const label = `QA-RESTART-${mode}`;
  const payload = {
    fileName: `${label}.csv`, fileHash: crypto.createHash('sha256').update(label).digest('hex'),
    headers: ['Cliente', 'Nome da Propriedade', 'Cidade', 'Projeto', 'Valor Unitário', 'Quantidade', 'Receita Esperada', 'Valor Imposto', 'Receita Esperada + Imposto', 'Valor Faturado', 'Data do Faturamento', 'Valor da Despesa', 'Data da Despesa'],
    rows: [{ Cliente: label, 'Nome da Propriedade': `${label}-Imóvel`, Cidade: 'Florianópolis', Projeto: `${label}-Projeto`, 'Valor Unitário': 1000, Quantidade: 1, 'Receita Esperada': 1000, 'Valor Imposto': 50, 'Receita Esperada + Imposto': 1050, 'Valor Faturado': 1050, 'Data do Faturamento': '2026-09-01', 'Valor da Despesa': 75, 'Data da Despesa': '2026-09-01' }]
  };
  const preview = await previewFullSpreadsheetImport(payload);
  assert.equal(preview.status, 'ready', JSON.stringify(preview));
  const digest = runs.importContentDigest({ fileName: payload.fileName, headers: payload.headers, rows: payload.rows, sheetName: null, firstDataRow: 2, sourceRowNumbers: null, mappingOverrides: {} });
  const registration = await runs.registerImportPreview({ entity: 'complete', digest, sourceName: payload.fileName, sourceHash: payload.fileHash, totalRows: 1, preview });
  await runs.queueConfirmedPreview(registration.previewId, digest, payload);
  const checkpoint = { phase: mode, importId: registration.previewId, payload };
  if (mode === 'queued') await pause(checkpoint);
  if (mode === 'transaction') {
    const { AuditLogService } = await import('../services/audit.service');
    const original = AuditLogService.log;
    AuditLogService.log = async (...args: Parameters<typeof original>) => {
      if (args[1] === 'Migração completa de planilha') await pause(checkpoint);
      return original.apply(AuditLogService, args);
    };
  } else if (mode === 'committed') {
    const { FileSystemOutboxService } = await import('../services/filesystem-outbox.service');
    FileSystemOutboxService.processPending = async () => { await pause(checkpoint); return { processed: 0, succeeded: 0, failed: 0, skipped: false }; };
  }
  const { FullImportWorkerService } = await import('../services/full-import-worker.service');
  await FullImportWorkerService.drain();
  throw new Error(`O ponto de interrupção ${mode} não foi atingido.`);
}

main().then(() => { process.disconnect?.(); process.exit(0); }).catch(async error => {
  await send({ phase: 'error', error: error instanceof Error ? error.stack : String(error) }).catch(() => undefined);
  process.exit(1);
});
