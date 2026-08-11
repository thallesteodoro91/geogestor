import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from './audit.service';

export const BACKUP_POLICY_KEY = 'geogestor_backup_policy';

export type BackupPolicy = {
  automaticEnabled: boolean;
  changeDebounceMinutes: number;
  databaseIntervalHours: number;
  completeIntervalDays: number;
  retention: number;
  retentionRecentHours: number;
  retentionDailyDays: number;
  retentionMonthlyMonths: number;
  destinationDirectory: string | null;
  maxStorageBytes: number;
  overdueGraceHours: number;
  runOnStartup: boolean;
  runOnShutdown: boolean;
  runRestoreTests: boolean;
  restoreTestIntervalDays: number;
};

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  automaticEnabled: true,
  changeDebounceMinutes: 5,
  databaseIntervalHours: 24,
  completeIntervalDays: 7,
  retention: 10,
  retentionRecentHours: 24,
  retentionDailyDays: 30,
  retentionMonthlyMonths: 12,
  destinationDirectory: null,
  maxStorageBytes: 0,
  overdueGraceHours: 12,
  runOnStartup: true,
  runOnShutdown: true,
  runRestoreTests: true,
  restoreTestIntervalDays: 30
};

export class BackupPolicyService {
  static async get(): Promise<BackupPolicy> {
    const [row] = await db.select().from(schema.configuracoesOperacionais)
      .where(eq(schema.configuracoesOperacionais.chave, BACKUP_POLICY_KEY))
      .limit(1);
    if (!row || row.deletedAt) return { ...DEFAULT_BACKUP_POLICY };
    try {
      return { ...DEFAULT_BACKUP_POLICY, ...JSON.parse(row.valorJson) };
    } catch {
      return { ...DEFAULT_BACKUP_POLICY };
    }
  }

  static async validateDestination(destinationDirectory: string) {
    const requestedDestination = destinationDirectory.trim();
    const expandedDestination = requestedDestination.startsWith('~/') || requestedDestination.startsWith('~\\')
      ? path.join(os.homedir(), requestedDestination.slice(2))
      : requestedDestination;
    if (!path.isAbsolute(expandedDestination)) {
      throw new Error('A pasta de backups deve usar um caminho absoluto.');
    }
    const normalizedDestination = path.resolve(expandedDestination);
    if (normalizedDestination === path.parse(normalizedDestination).root) {
      throw new Error('A raiz inteira da unidade não pode ser usada como pasta de backups.');
    }
    const [configuration] = await db.select({ dadosPasta: schema.configuracoes.dadosPasta }).from(schema.configuracoes).limit(1);
    if (configuration?.dadosPasta) {
      const configuredFiles = configuration.dadosPasta.startsWith('~/') || configuration.dadosPasta.startsWith('~\\')
        ? path.join(os.homedir(), configuration.dadosPasta.slice(2))
        : configuration.dadosPasta;
      const filesRoot = path.resolve(configuredFiles);
      const relativeBackupToFiles = path.relative(filesRoot, normalizedDestination);
      const relativeFilesToBackup = path.relative(normalizedDestination, filesRoot);
      const overlaps = !relativeBackupToFiles || !relativeFilesToBackup
        || (!relativeBackupToFiles.startsWith(`..${path.sep}`) && relativeBackupToFiles !== '..' && !path.isAbsolute(relativeBackupToFiles))
        || (!relativeFilesToBackup.startsWith(`..${path.sep}`) && relativeFilesToBackup !== '..' && !path.isAbsolute(relativeFilesToBackup));
      if (overlaps) throw new Error('A pasta de backups deve ficar fora da pasta de documentos dos clientes.');
    }
    await fs.mkdir(normalizedDestination, { recursive: true });
    const probe = path.join(normalizedDestination, `.geogestor-backup-test-${crypto.randomUUID()}.tmp`);
    try {
      await fs.writeFile(probe, 'ok', { encoding: 'utf8', flag: 'wx' });
      const disk = await fs.statfs(normalizedDestination);
      const availableBytes = Number(disk.bavail) * Number(disk.bsize);
      if (availableBytes <= 0) throw new Error('O destino não possui espaço livre disponível.');
      return { destinationDirectory: normalizedDestination, availableBytes, writable: true as const };
    } finally {
      await fs.rm(probe, { force: true }).catch(() => undefined);
    }
  }

  static async save(policy: BackupPolicy) {
    const destinationValidation = policy.destinationDirectory?.trim()
      ? await this.validateDestination(policy.destinationDirectory)
      : null;
    const normalized: BackupPolicy = {
      ...policy,
      destinationDirectory: destinationValidation?.destinationDirectory || null
    };
    const previous = await this.get();
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.insert(schema.configuracoesOperacionais).values({
        id: crypto.randomUUID(),
        chave: BACKUP_POLICY_KEY,
        valorJson: JSON.stringify(normalized),
        origem: 'aplicacao',
        updatedAt: now
      }).onConflictDoUpdate({
        target: schema.configuracoesOperacionais.chave,
        set: { valorJson: JSON.stringify(normalized), origem: 'aplicacao', updatedAt: now, deletedAt: null }
      });
      await AuditLogService.log('UPDATE', 'PoliticaBackup', previous, normalized, tx);
    });
    return normalized;
  }
}
