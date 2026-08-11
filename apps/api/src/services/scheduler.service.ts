import { GoogleCalendarService } from './google-calendar.service';
import { BackupService } from './backup.service';
import { FileSystemOutboxService } from './filesystem-outbox.service';
import { FileSystemService } from './fs.service';
import { OperationalLogService } from './operational-log.service';
import { RecoverableFileService } from './recoverable-file.service';
import { SqliteMaintenanceService } from './sqlite-maintenance.service';
import { BackupPolicyService, type BackupPolicy } from './backup-policy.service';
import { BackupActivityService } from './backup-activity.service';
import { MaintenanceHistoryService } from './maintenance-history.service';
import path from 'node:path';

const getErrorMessage = (err: unknown) => (
  err instanceof Error ? err.message : String(err)
);

export const SCHEDULER_DELAYS = {
  outboxBootMs: 0,
  backupBootMs: 45_000,
  maintenanceBootMs: 60_000,
  syncIntervalMs: 15 * 60 * 1000,
  maintenanceIntervalMs: 15 * 60 * 1000,
  backupIntervalMs: 60 * 1000,
  backupDueMs: 24 * 60 * 60 * 1000,
  completeBackupDueMs: 7 * 24 * 60 * 60 * 1000
} as const;

export function isAutomaticBackupDue(
  state: ReturnType<typeof OperationalLogService.getState>,
  now = Date.now(),
  intervalMs = SCHEDULER_DELAYS.backupDueMs
) {
  const completedAt = state.backup?.details?.completedAt;
  if (typeof completedAt !== 'string') return true;
  const completedAtMs = Date.parse(completedAt);
  return !Number.isFinite(completedAtMs) || now - completedAtMs >= intervalMs;
}

export function isAutomaticCompleteBackupDue(
  state: ReturnType<typeof OperationalLogService.getState>,
  now = Date.now(),
  intervalMs = SCHEDULER_DELAYS.completeBackupDueMs
) {
  const completedAt = state.backupComplete?.details?.completedAt;
  if (typeof completedAt !== 'string') return true;
  const completedAtMs = Date.parse(completedAt);
  return !Number.isFinite(completedAtMs) || now - completedAtMs >= intervalMs;
}

export class SchedulerService {
  private static syncIntervalId: NodeJS.Timeout | null = null;
  private static backupIntervalId: NodeJS.Timeout | null = null;
  private static outboxBootTimeoutId: NodeJS.Timeout | null = null;
  private static backupBootTimeoutId: NodeJS.Timeout | null = null;
  private static maintenanceBootTimeoutId: NodeJS.Timeout | null = null;
  private static maintenanceIntervalId: NodeJS.Timeout | null = null;
  private static syncRunning = false;
  private static backupRunning = false;
  private static maintenanceRunning = false;

  private static async runSync() {
    if (this.syncRunning) return;
    this.syncRunning = true;
    try {
      console.log('[SchedulerService] Disparando Sincronização com Google Calendar...');
      const result = await GoogleCalendarService.sync();
      await OperationalLogService.setState('googleSync', 'ok', { sent: result.sent, received: result.received });
      console.log(`[SchedulerService] Google Calendar Sync finalizado: Enviados=${result.sent}, Recebidos=${result.received}`);
    } finally {
      this.syncRunning = false;
    }
  }

  private static async runBackup(
    policy?: BackupPolicy,
    forceComplete = false,
    onProgress?: (progress: { stage: string; processedFiles: number; processedBytes: number; totalFiles: number; totalBytes: number }) => void
  ) {
    if (this.backupRunning) return;
    this.backupRunning = true;
    const startedAtMs = performance.now();
    const attemptedAt = new Date().toISOString();
    try {
      const activePolicy = policy || await BackupPolicyService.get();
      const activityAtStart = BackupActivityService.snapshot();
      const protectedSequence = activityAtStart.changeSequence;
      const executionOptions = {
        destinationDirectory: activePolicy.destinationDirectory,
        retention: activePolicy.retention,
        maxStorageBytes: activePolicy.maxStorageBytes,
        retentionRecentHours: activePolicy.retentionRecentHours,
        retentionDailyDays: activePolicy.retentionDailyDays,
        retentionMonthlyMonths: activePolicy.retentionMonthlyMonths
        ,onProgress
      };
      await OperationalLogService.setState('backup', 'running', { attemptedAt });
      const databaseBackup = forceComplete ? null : await BackupService.createLocalBackup(executionOptions);
      let completeBackupResult: Awaited<ReturnType<typeof BackupService.createCompleteBackup>> | null = null;
      if (forceComplete || isAutomaticCompleteBackupDue(
        OperationalLogService.getState(),
        Date.now(),
        activePolicy.completeIntervalDays * 24 * 60 * 60 * 1000
      )) {
        const completeStartedAtMs = performance.now();
        const completeAttemptedAt = new Date().toISOString();
        try {
          await OperationalLogService.setState('backupComplete', 'running', { attemptedAt: completeAttemptedAt });
          await FileSystemOutboxService.processPending();
          const filesRootDirectory = await FileSystemService.getRootFolder();
          const completeBackup = await BackupService.createCompleteBackup(filesRootDirectory, executionOptions);
          completeBackupResult = completeBackup;
          const completeDetails = {
            attemptedAt: completeAttemptedAt,
            completedAt: new Date().toISOString(),
            durationMs: Number((performance.now() - completeStartedAtMs).toFixed(2)),
            totalBytes: completeBackup.totalBytes,
            totalFiles: completeBackup.totalFiles
          };
          await OperationalLogService.setState('backupComplete', 'ok', completeDetails);
          await BackupActivityService.markProtected(protectedSequence, {
            completedAt: completeDetails.completedAt,
            bundleName: path.basename(completeBackup.bundlePath)
          });
          await OperationalLogService.info('automatic-complete-backup-completed', completeDetails);
        } catch (error) {
          const completeDetails = {
            attemptedAt: completeAttemptedAt,
            durationMs: Number((performance.now() - completeStartedAtMs).toFixed(2)),
            error
          };
          await OperationalLogService.setState('backupComplete', 'failed', completeDetails);
          await OperationalLogService.error('automatic-complete-backup-failed', completeDetails);
          if (forceComplete) throw error;
        }
      }
      if (databaseBackup && !completeBackupResult && !activityAtStart.completeRequired) {
        await BackupActivityService.markProtected(protectedSequence, {
          completedAt: new Date().toISOString(),
          bundleName: path.basename(databaseBackup.bundlePath)
        });
      }
      const details = {
        attemptedAt,
        completedAt: new Date().toISOString(),
        durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
        totalBytes: (databaseBackup || completeBackupResult)?.totalBytes || 0,
        totalFiles: (databaseBackup || completeBackupResult)?.totalFiles || 0
      };
      await OperationalLogService.setState('backup', 'ok', details);
      await OperationalLogService.info('automatic-backup-completed', details);
      console.log('[SchedulerService] Backup concluído com sucesso.');
    } catch (error) {
      const details = {
        attemptedAt,
        durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
        error
      };
      await OperationalLogService.setState('backup', 'failed', details);
      await OperationalLogService.error('automatic-backup-failed', details);
      throw error;
    } finally {
      this.backupRunning = false;
    }
  }

  private static async runBackupIfDue() {
    const policy = await BackupPolicyService.get();
    if (!policy.automaticEnabled) return;
    if (BackupActivityService.isDue(policy.changeDebounceMinutes)) {
      await this.runBackup(policy, BackupActivityService.snapshot().completeRequired);
      return;
    }
    if (!isAutomaticBackupDue(
      OperationalLogService.getState(),
      Date.now(),
      policy.databaseIntervalHours * 60 * 60 * 1000
    )) return;
    await this.runBackup(policy);
  }

  private static async runOutboxReconciliation() {
    try {
      const reconciliation = await FileSystemOutboxService.processPending();
      await OperationalLogService.setState('outbox', 'ok', reconciliation);
    } catch (error) {
      await OperationalLogService.setState('outbox', 'failed', { error });
      throw error;
    }
  }

  private static async runMaintenance() {
    if (this.maintenanceRunning) return;
    this.maintenanceRunning = true;
    const startedAtMs = performance.now();
    try {
      const reconciliation = await FileSystemOutboxService.processPending();
      const sqlite = await SqliteMaintenanceService.runIfDue();
      const policy = await BackupPolicyService.get();
      let restoreTest: Awaited<ReturnType<typeof BackupService.testLatestCompleteBackup>> | null = null;
      if (policy.runRestoreTests) {
        const [latestTest] = await MaintenanceHistoryService.list({ type: 'restore_test', limit: 1 });
        const lastTestAt = latestTest?.completedAt ? Date.parse(latestTest.completedAt) : 0;
        const due = !Number.isFinite(lastTestAt)
          || lastTestAt === 0
          || Date.now() - lastTestAt >= policy.restoreTestIntervalDays * 24 * 60 * 60 * 1000;
        if (due) restoreTest = await BackupService.testLatestCompleteBackup(policy.destinationDirectory);
      }
      let purged = 0;
      try {
        const dataRoot = await FileSystemService.getRootFolder();
        const retentionDays = Math.max(1, Number(process.env.GEOGESTOR_TRASH_RETENTION_DAYS || 30));
        purged = await RecoverableFileService.purgeExpired(dataRoot, retentionDays);
      } catch (error) {
        await OperationalLogService.warn('quarantine-maintenance-skipped', { error });
      }
      const details = {
        ...reconciliation,
        purged,
        sqlite,
        restoreTest: restoreTest ? { testedAt: restoreTest.testedAt, type: restoreTest.type } : null,
        durationMs: Number((performance.now() - startedAtMs).toFixed(2))
      };
      await OperationalLogService.setState('maintenance', 'ok', details);
      await OperationalLogService.info('automatic-maintenance-completed', details);
    } catch (error) {
      await OperationalLogService.setState('maintenance', 'failed', {
        durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
        error
      });
      throw error;
    } finally {
      this.maintenanceRunning = false;
    }
  }

  public static start() {
    console.log('[SchedulerService] Iniciando tarefas em background...');

    // 1. Sincronização Google Calendar a cada 15 minutos (900000 ms)
    this.syncIntervalId = setInterval(async () => {
      try {
        await this.runSync();
      } catch (err) {
        const message = getErrorMessage(err);
        if (message.includes('sem token') || message.includes('não autenticado')) {
          console.log('[SchedulerService] Sync Ignorado: Google Agenda não está configurado ou autenticado.');
        } else {
          console.error('[SchedulerService] Erro no Sync do Google Calendar:', message);
          await OperationalLogService.setState('googleSync', 'failed', { error: err });
        }
      }
    }, SCHEDULER_DELAYS.syncIntervalMs);

    // 2. Consolida alterações recentes e também mantém o ciclo periódico de segurança.
    this.backupIntervalId = setInterval(async () => {
      try {
        console.log('[SchedulerService] Disparando Backup Automático...');
        await this.runBackupIfDue();
      } catch (err) {
        console.error('[SchedulerService] Erro no Backup Automático:', getErrorMessage(err));
      }
    }, SCHEDULER_DELAYS.backupIntervalMs);

    // A reconciliação é segura para iniciar cedo, mas nunca bloqueia o start.
    this.outboxBootTimeoutId = setTimeout(() => {
      void this.runOutboxReconciliation().catch((error) => {
        console.error('[SchedulerService] Falha na reconciliação inicial da outbox:', getErrorMessage(error));
      });
    }, SCHEDULER_DELAYS.outboxBootMs);

    // Tarefas com I/O pesado ficam fora do caminho crítico da primeira tela.
    this.backupBootTimeoutId = setTimeout(async () => {
      try {
        const policy = await BackupPolicyService.get();
        if (!policy.runOnStartup) return;
        await this.runBackupIfDue();
      } catch (err) {
        console.error('[SchedulerService] Falha no Backup Inicial:', getErrorMessage(err));
      }
    }, SCHEDULER_DELAYS.backupBootMs);

    this.maintenanceIntervalId = setInterval(async () => {
      try {
        await this.runMaintenance();
      } catch (err) {
        console.error('[SchedulerService] Erro na manutenção interna:', getErrorMessage(err));
      }
    }, SCHEDULER_DELAYS.maintenanceIntervalMs);

    this.maintenanceBootTimeoutId = setTimeout(() => {
      void this.runMaintenance().catch((error) => {
        console.error('[SchedulerService] Falha na manutenção inicial:', getErrorMessage(error));
      });
    }, SCHEDULER_DELAYS.maintenanceBootMs);
  }

  public static stop() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    if (this.backupIntervalId) clearInterval(this.backupIntervalId);
    if (this.outboxBootTimeoutId) clearTimeout(this.outboxBootTimeoutId);
    if (this.backupBootTimeoutId) clearTimeout(this.backupBootTimeoutId);
    if (this.maintenanceBootTimeoutId) clearTimeout(this.maintenanceBootTimeoutId);
    if (this.maintenanceIntervalId) clearInterval(this.maintenanceIntervalId);
    this.syncIntervalId = null;
    this.backupIntervalId = null;
    this.outboxBootTimeoutId = null;
    this.backupBootTimeoutId = null;
    this.maintenanceBootTimeoutId = null;
    this.maintenanceIntervalId = null;
    console.log('[SchedulerService] Tarefas em background interrompidas.');
  }

  public static async prepareForShutdown() {
    const policy = await BackupPolicyService.get();
    const hasPendingChanges = BackupActivityService.snapshot().pendingChanges > 0;
    if (!policy.runOnShutdown && !(policy.automaticEnabled && hasPendingChanges)) return;
    const existingBackupWasRunning = this.backupRunning;
    while (this.backupRunning) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (existingBackupWasRunning) return;
    await this.runBackup(policy, hasPendingChanges && BackupActivityService.snapshot().completeRequired, (progress) => {
      process.send?.({ type: 'shutdown-backup-progress', progress });
    });
  }
}
