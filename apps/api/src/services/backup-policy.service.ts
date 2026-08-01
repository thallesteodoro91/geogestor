import crypto from 'node:crypto';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from './audit.service';

export const BACKUP_POLICY_KEY = 'geogestor_backup_policy';

export type BackupPolicy = {
  databaseIntervalHours: number;
  completeIntervalDays: number;
  retention: number;
  destinationDirectory: string | null;
  maxStorageBytes: number;
  overdueGraceHours: number;
  runOnStartup: boolean;
  runOnShutdown: boolean;
};

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  databaseIntervalHours: 24,
  completeIntervalDays: 7,
  retention: 10,
  destinationDirectory: null,
  maxStorageBytes: 0,
  overdueGraceHours: 12,
  runOnStartup: true,
  runOnShutdown: false
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

  static async save(policy: BackupPolicy) {
    const normalized: BackupPolicy = {
      ...policy,
      destinationDirectory: policy.destinationDirectory?.trim()
        ? path.resolve(policy.destinationDirectory.trim())
        : null
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
