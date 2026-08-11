import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { constants, createReadStream } from 'node:fs';
import { eq } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from './audit.service';
import { BackupPolicyService } from './backup-policy.service';
import { BackupService, MaintenanceCancelledError } from './backup.service';
import { FileSystemService } from './fs.service';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { OperationalLogService } from './operational-log.service';
import { MaintenanceHistoryService } from './maintenance-history.service';

export type DataDirectoryStrategy = 'use' | 'copy' | 'move';

type TreeStats = { bytes: number; files: number; directories: number };

function expandAndResolve(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Informe a pasta de destino.');
  const expanded = trimmed.startsWith('~/') || trimmed.startsWith('~\\')
    ? path.join(os.homedir(), trimmed.slice(2))
    : trimmed;
  if (!path.isAbsolute(expanded)) throw new Error('Escolha um caminho absoluto para a pasta de documentos.');
  return path.resolve(expanded);
}

function relativeInside(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (!relative || relative === '.') return '';
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return relative;
}

function safeTrackedRelative(root: string, absolute: string, storedRelative?: string | null) {
  const candidate = storedRelative?.trim() || relativeInside(root, absolute);
  if (!candidate || path.isAbsolute(candidate)) return null;
  const normalized = path.normalize(candidate);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return null;
  return normalized;
}

function pathsOverlap(left: string, right: string) {
  return relativeInside(left, right) !== null || relativeInside(right, left) !== null;
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function listTree(root: string) {
  const result: Array<{ absolute: string; relative: string; size: number }> = [];
  if (!await exists(root)) return result;
  const queue = [''];
  while (queue.length) {
    const relativeDirectory = queue.shift()!;
    const directory = path.join(root, relativeDirectory);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = path.join(relativeDirectory, entry.name);
      const absolute = path.join(root, relative);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) queue.push(relative);
      else if (entry.isFile()) result.push({ absolute, relative, size: (await fs.stat(absolute)).size });
      if (result.length + queue.length > 250_000) throw new Error('A pasta possui itens demais para uma migração segura nesta operação.');
    }
  }
  return result;
}

async function treeStats(root: string): Promise<TreeStats> {
  if (!await exists(root)) return { bytes: 0, files: 0, directories: 0 };
  let bytes = 0;
  let files = 0;
  let directories = 1;
  const queue = [root];
  while (queue.length) {
    const directory = queue.shift()!;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        directories += 1;
        queue.push(absolute);
      } else if (entry.isFile()) {
        files += 1;
        bytes += (await fs.stat(absolute)).size;
      }
    }
  }
  return { bytes, files, directories };
}

async function probeWritable(directory: string) {
  await fs.mkdir(directory, { recursive: true });
  const probe = path.join(directory, `.geogestor-write-test-${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(probe, 'ok', { encoding: 'utf8', flag: 'wx' });
    await fs.access(directory, constants.R_OK | constants.W_OK);
  } finally {
    await fs.rm(probe, { force: true }).catch(() => undefined);
  }
}

async function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

export class DataDirectoryService {
  static normalize(input: string) {
    return expandAndResolve(input);
  }

  static async preflight(input: string) {
    const currentDirectory = await FileSystemService.getRootFolder();
    const targetDirectory = expandAndResolve(input);
    const databaseDirectory = path.dirname(BackupService.getDatabasePath());
    const policy = await BackupPolicyService.get();
    const backupDirectory = BackupService.getBackupDirectory(policy.destinationDirectory);
    const filesystemRoot = path.parse(targetDirectory).root;
    if (targetDirectory === filesystemRoot) throw new Error('A raiz inteira da unidade não pode ser usada como pasta de documentos.');
    if (pathsOverlap(targetDirectory, databaseDirectory)) throw new Error('A pasta de documentos não pode conter o banco local nem ficar dentro da pasta interna do aplicativo.');
    if (pathsOverlap(targetDirectory, backupDirectory)) throw new Error('A pasta de documentos e a pasta de backups devem ser separadas.');

    const sameDirectory = path.resolve(currentDirectory).toLowerCase() === targetDirectory.toLowerCase();
    const targetExisted = await exists(targetDirectory);
    await probeWritable(targetDirectory);
    const [sourceFiles, currentStats, targetStats, documents, disk] = await Promise.all([
      listTree(currentDirectory),
      treeStats(currentDirectory),
      treeStats(targetDirectory),
      db.select({ id: schema.documentos.id, caminho: schema.documentos.caminho, caminhoRelativo: schema.documentos.caminhoRelativo }).from(schema.documentos),
      fs.statfs(targetDirectory)
    ]);

    let conflicts = 0;
    for (const file of sourceFiles) if (await exists(path.join(targetDirectory, file.relative))) conflicts += 1;
    let trackedOutsideCurrent = 0;
    let missingTrackedAtTarget = 0;
    for (const document of documents) {
      const relative = safeTrackedRelative(currentDirectory, document.caminho, document.caminhoRelativo);
      if (!relative) {
        trackedOutsideCurrent += 1;
        continue;
      }
      if (!await exists(path.join(targetDirectory, relative))) missingTrackedAtTarget += 1;
    }

    return {
      currentDirectory,
      targetDirectory,
      sameDirectory,
      targetExisted,
      current: currentStats,
      target: targetStats,
      availableBytes: Number(disk.bavail) * Number(disk.bsize),
      trackedDocuments: documents.length,
      trackedOutsideCurrent,
      missingTrackedAtTarget,
      conflictingFiles: conflicts,
      canUseExisting: documents.length === 0 || (trackedOutsideCurrent === 0 && missingTrackedAtTarget === 0),
      canCopyOrMove: !sameDirectory && !pathsOverlap(currentDirectory, targetDirectory) && conflicts === 0,
      requiresMigration: !sameDirectory && sourceFiles.length > 0
    };
  }

  static async migrate(input: {
    targetDirectory: string;
    strategy: DataDirectoryStrategy;
    confirmation: string;
    shouldCancel?: () => boolean;
    onProgress?: (progress: { stage: string; processedFiles: number; processedBytes: number; totalFiles: number; totalBytes: number }) => void | Promise<void>;
  }) {
    if (input.confirmation !== 'ALTERAR PASTA DE DADOS DO GEOGESTOR') throw new Error('Confirmação de alteração da pasta inválida.');
    return MaintenanceCoordinator.runExclusive('migration', async () => {
      const startedAt = new Date().toISOString();
      const startedAtMs = Date.now();
      const preflight = await this.preflight(input.targetDirectory);
      if (preflight.sameDirectory) return { ...preflight, strategy: input.strategy, changed: false, copiedFiles: 0, cleanupWarning: null };
      if (input.strategy === 'use' && !preflight.canUseExisting) {
        throw new Error('A pasta escolhida não contém todos os documentos vinculados. Copie ou mova os arquivos antes de usá-la.');
      }
      if (input.strategy !== 'use' && !preflight.canCopyOrMove) {
        throw new Error('A migração foi bloqueada porque as pastas se sobrepõem ou já existem arquivos conflitantes no destino.');
      }
      if (input.strategy !== 'use' && preflight.availableBytes < preflight.current.bytes * 1.1) {
        throw new Error('Não há espaço livre suficiente no destino para copiar e validar os documentos.');
      }

      const sourceFiles = input.strategy === 'use' ? [] : await listTree(preflight.currentDirectory);
      const createdFiles: string[] = [];
      let processedBytes = 0;
      let checksumFilesVerified = 0;
      try {
        for (const [index, file] of sourceFiles.entries()) {
          if (input.shouldCancel?.()) throw new MaintenanceCancelledError();
          await input.onProgress?.({
            stage: 'Copiando e verificando documentos',
            processedFiles: index,
            processedBytes,
            totalFiles: sourceFiles.length,
            totalBytes: preflight.current.bytes
          });
          const destination = path.join(preflight.targetDirectory, file.relative);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          const sourceHash = await sha256File(file.absolute);
          await fs.copyFile(file.absolute, destination, constants.COPYFILE_EXCL);
          const destinationHash = await sha256File(destination);
          if (sourceHash !== destinationHash) throw new Error(`Checksum divergente após copiar ${file.relative}.`);
          createdFiles.push(destination);
          processedBytes += file.size;
          checksumFilesVerified += 1;
        }
        for (const file of sourceFiles) {
          const copied = await fs.stat(path.join(preflight.targetDirectory, file.relative));
          if (copied.size !== file.size) throw new Error(`A validação da cópia falhou para ${file.relative}.`);
        }

        const documents = await db.select().from(schema.documentos);
        const [configuration] = await db.select().from(schema.configuracoes).limit(1);
        if (!configuration) throw new Error('A configuração principal do GeoGestor não foi encontrada.');
        await db.transaction(async (tx) => {
          for (const document of documents) {
            const relative = safeTrackedRelative(preflight.currentDirectory, document.caminho, document.caminhoRelativo);
            if (!relative) throw new Error(`O documento ${document.nome} não pertence à pasta atual e precisa ser corrigido antes da migração.`);
            await tx.update(schema.documentos).set({
              caminho: path.join(preflight.targetDirectory, relative),
              updatedAt: new Date().toISOString()
            }).where(eq(schema.documentos.id, document.id));
          }
          await tx.update(schema.configuracoes).set({
            dadosPasta: preflight.targetDirectory,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.configuracoes.id, configuration.id));
          await AuditLogService.log('UPDATE', 'PastaDados', { path: preflight.currentDirectory }, {
            path: preflight.targetDirectory,
            strategy: input.strategy,
            files: sourceFiles.length
          }, tx);
        });
        await input.onProgress?.({
          stage: 'Migração validada',
          processedFiles: sourceFiles.length,
          processedBytes,
          totalFiles: sourceFiles.length,
          totalBytes: preflight.current.bytes
        });
      } catch (error) {
        for (const created of createdFiles.reverse()) await fs.rm(created, { force: true }).catch(() => undefined);
        await MaintenanceHistoryService.record({
          type: 'data_migration',
          status: error instanceof MaintenanceCancelledError ? 'cancelled' : 'failed',
          startedAt,
          durationMs: Date.now() - startedAtMs,
          sourceLabel: preflight.currentDirectory,
          destinationLabel: preflight.targetDirectory,
          files: checksumFilesVerified,
          bytes: processedBytes,
          user: 'admin',
          auditId: null,
          error
        }).catch(() => undefined);
        throw error;
      }

      let cleanupWarning: string | null = null;
      if (input.strategy === 'move') {
        try {
          await fs.rm(preflight.currentDirectory, { recursive: true, force: true });
        } catch {
          cleanupWarning = 'Os documentos foram migrados e validados, mas a pasta antiga não pôde ser removida. Ela pode ser excluída manualmente após conferir os arquivos.';
        }
      }
      await OperationalLogService.info('data-directory-migrated', {
        strategy: input.strategy,
        copiedFiles: sourceFiles.length,
        cleanupWarning: Boolean(cleanupWarning)
      });
      await MaintenanceHistoryService.record({
        type: 'data_migration',
        status: 'success',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: preflight.currentDirectory,
        destinationLabel: preflight.targetDirectory,
        files: sourceFiles.length,
        bytes: processedBytes,
        user: 'admin',
        auditId: null,
        details: { strategy: input.strategy, checksumFilesVerified }
      });
      return { ...preflight, strategy: input.strategy, changed: true, copiedFiles: sourceFiles.length, checksumFilesVerified, cleanupWarning };
    });
  }
}
