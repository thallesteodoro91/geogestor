import crypto from 'node:crypto';
import { and, asc, eq, inArray, lte, lt, sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { FileSystemService } from './fs.service';
import { OperationalLogService } from './operational-log.service';

export type FileSystemOperationType =
  | 'create-client-folder'
  | 'rename-client-folder'
  | 'create-project-folder'
  | 'rename-project-folder';

type FileSystemOperationPayload = {
  clientName?: string;
  oldClientName?: string;
  newClientName?: string;
  projectName?: string;
  oldProjectName?: string;
  newProjectName?: string;
  clientId?: string;
  projectId?: string;
};

type EnqueueInput = {
  idempotencyKey: string;
  operationType: FileSystemOperationType;
  aggregateType: 'client' | 'project';
  aggregateId: string;
  payload: FileSystemOperationPayload;
  maxAttempts?: number;
};

type DatabaseExecutor = Pick<typeof db, 'insert'>;

const MAX_ERROR_LENGTH = 500;
const STALE_LOCK_MS = 10 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 25;

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, MAX_ERROR_LENGTH);
}

function parsePayload(raw: string): FileSystemOperationPayload {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Payload da operação de filesystem é inválido.');
  }
  return parsed as FileSystemOperationPayload;
}

function requiredText(value: string | undefined, field: string) {
  if (!value?.trim()) throw new Error(`Campo obrigatório ausente na operação de filesystem: ${field}.`);
  return value;
}

export class FileSystemOutboxService {
  private static running = false;
  private static readonly workerId = `${process.pid}-${crypto.randomUUID()}`;

  static async enqueue(input: EnqueueInput, dbOrTx: DatabaseExecutor = db) {
    const now = new Date().toISOString();
    await dbOrTx.insert(schema.filesystemOperations).values({
      id: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
      operationType: input.operationType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: JSON.stringify(input.payload),
      status: 'pending',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 8,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now
    }).onConflictDoNothing({ target: schema.filesystemOperations.idempotencyKey });
  }

  static kick() {
    void this.processPending().catch((error) => {
      void OperationalLogService.error('filesystem-reconciler-kick-failed', { error });
    });
  }

  static async cancelAggregate(
    aggregateType: 'client' | 'project',
    aggregateId: string,
    dbOrTx: Pick<typeof db, 'update'> = db
  ) {
    const now = new Date().toISOString();
    await dbOrTx.update(schema.filesystemOperations).set({
      status: 'cancelled',
      lockedAt: null,
      lockOwner: null,
      completedAt: now,
      lastError: 'Operação cancelada porque o registro foi excluído antes da execução.',
      updatedAt: now
    }).where(and(
      eq(schema.filesystemOperations.aggregateType, aggregateType),
      eq(schema.filesystemOperations.aggregateId, aggregateId),
      inArray(schema.filesystemOperations.status, ['pending', 'failed'])
    ));
  }

  static async recoverStaleOperations() {
    const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
    const now = new Date().toISOString();
    await db.update(schema.filesystemOperations).set({
      status: 'failed',
      nextAttemptAt: now,
      lockedAt: null,
      lockOwner: null,
      lastError: 'Operação recuperada após interrupção do processo.',
      updatedAt: now
    }).where(and(
      eq(schema.filesystemOperations.status, 'processing'),
      lt(schema.filesystemOperations.lockedAt, staleBefore)
    ));
  }

  static async processPending(limit = DEFAULT_BATCH_SIZE) {
    if (this.running) return { processed: 0, succeeded: 0, failed: 0, skipped: true };
    this.running = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      await this.recoverStaleOperations();
      const now = new Date().toISOString();
      const operations = await db.select().from(schema.filesystemOperations)
        .where(and(
          inArray(schema.filesystemOperations.status, ['pending', 'failed']),
          lte(schema.filesystemOperations.nextAttemptAt, now),
          sql`${schema.filesystemOperations.attempts} < ${schema.filesystemOperations.maxAttempts}`
        ))
        .orderBy(asc(schema.filesystemOperations.createdAt))
        .limit(Math.max(1, Math.min(100, limit)));

      for (const operation of operations) {
        const claimedAt = new Date().toISOString();
        const claimed = await db.update(schema.filesystemOperations).set({
          status: 'processing',
          lockedAt: claimedAt,
          lockOwner: this.workerId,
          updatedAt: claimedAt
        }).where(and(
          eq(schema.filesystemOperations.id, operation.id),
          inArray(schema.filesystemOperations.status, ['pending', 'failed'])
        )).returning({ id: schema.filesystemOperations.id });
        if (!claimed.length) continue;

        processed += 1;
        try {
          await this.execute(operation.operationType as FileSystemOperationType, parsePayload(operation.payload));
          const completedAt = new Date().toISOString();
          await db.update(schema.filesystemOperations).set({
            status: 'succeeded',
            attempts: operation.attempts + 1,
            lastError: null,
            nextAttemptAt: completedAt,
            lockedAt: null,
            lockOwner: null,
            completedAt,
            updatedAt: completedAt
          }).where(eq(schema.filesystemOperations.id, operation.id));
          succeeded += 1;
        } catch (error) {
          const attempts = operation.attempts + 1;
          const delayMs = Math.min(60 * 60 * 1000, 2 ** Math.min(attempts, 10) * 1000);
          const retryAt = new Date(Date.now() + delayMs).toISOString();
          await db.update(schema.filesystemOperations).set({
            status: 'failed',
            attempts,
            lastError: errorMessage(error),
            nextAttemptAt: retryAt,
            lockedAt: null,
            lockOwner: null,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.filesystemOperations.id, operation.id));
          failed += 1;
          await OperationalLogService.warn('filesystem-operation-failed', {
            operationId: operation.id,
            operationType: operation.operationType,
            aggregateType: operation.aggregateType,
            aggregateId: operation.aggregateId,
            attempts,
            error
          });
        }
      }

      await OperationalLogService.setState('filesystemReconciler', failed > 0 ? 'degraded' : 'ok', {
        processed,
        succeeded,
        failed
      });
      return { processed, succeeded, failed, skipped: false };
    } finally {
      this.running = false;
    }
  }

  static async getSummary() {
    try {
      const rows = await db.select({
        status: schema.filesystemOperations.status,
        total: sql<number>`count(*)`
      }).from(schema.filesystemOperations).groupBy(schema.filesystemOperations.status);
      return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
    } catch (error) {
      if (error instanceof Error && /no such table:\s*filesystem_operations/i.test(error.message)) return {};
      throw error;
    }
  }

  private static async execute(operationType: FileSystemOperationType, payload: FileSystemOperationPayload) {
    switch (operationType) {
      case 'create-client-folder':
        await FileSystemService.getClientFolder(requiredText(payload.clientName, 'clientName'));
        return;
      case 'rename-client-folder':
        await FileSystemService.renameClientFolder(
          requiredText(payload.oldClientName, 'oldClientName'),
          requiredText(payload.newClientName, 'newClientName'),
          requiredText(payload.clientId, 'clientId')
        );
        return;
      case 'create-project-folder':
        await FileSystemService.getProjectFolder(
          requiredText(payload.clientName, 'clientName'),
          requiredText(payload.projectName, 'projectName')
        );
        return;
      case 'rename-project-folder':
        await FileSystemService.moveProjectFolder(
          requiredText(payload.oldClientName || payload.clientName, 'oldClientName'),
          requiredText(payload.newClientName || payload.clientName, 'newClientName'),
          requiredText(payload.oldProjectName, 'oldProjectName'),
          requiredText(payload.newProjectName, 'newProjectName'),
          requiredText(payload.projectId, 'projectId')
        );
        return;
      default: {
        const exhaustive: never = operationType;
        throw new Error(`Operação de filesystem não suportada: ${String(exhaustive)}`);
      }
    }
  }
}
