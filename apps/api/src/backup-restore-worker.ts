import fs from 'node:fs/promises';
import { BackupService } from './services/backup.service';
import { closeDb } from './db';

type RestoreWorkerRequest = Parameters<typeof BackupService.restoreBackup>[0] & {
  metadataDatabasePath: string;
};

async function main() {
  const encoded = process.env.GEOGESTOR_BACKUP_RESTORE_REQUEST;
  if (!encoded || process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_ACTIVE !== '1') {
    throw new Error('A solicitação autenticada da restauração isolada não foi fornecida.');
  }
  const input = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as RestoreWorkerRequest;
  delete process.env.GEOGESTOR_BACKUP_RESTORE_REQUEST;
  try {
    const result = await BackupService.restoreBackup(input);
    process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
  } finally {
    try {
      await closeDb();
    } catch {
      // A remoção dos arquivos temporários ainda precisa ser tentada.
    }
    for (const suffix of ['', '-wal', '-shm']) {
      await fs.rm(`${input.metadataDatabasePath}${suffix}`, { force: true }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida na restauração isolada.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
