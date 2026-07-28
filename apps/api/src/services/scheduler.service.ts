import { GoogleCalendarService } from './google-calendar.service';
import { BackupService } from './backup.service';
import { FileSystemOutboxService } from './filesystem-outbox.service';
import { FileSystemService } from './fs.service';
import { OperationalLogService } from './operational-log.service';
import { RecoverableFileService } from './recoverable-file.service';
import { SqliteMaintenanceService } from './sqlite-maintenance.service';

const getErrorMessage = (err: unknown) => (
  err instanceof Error ? err.message : String(err)
);

export const SCHEDULER_DELAYS = {
  outboxBootMs: 0,
  backupBootMs: 45_000,
  maintenanceBootMs: 60_000,
  syncIntervalMs: 15 * 60 * 1000,
  maintenanceIntervalMs: 15 * 60 * 1000,
  backupIntervalMs: 60 * 60 * 1000,
  backupDueMs: 24 * 60 * 60 * 1000
} as const;

export function isAutomaticBackupDue(
  state: ReturnType<typeof OperationalLogService.getState>,
  now = Date.now()
) {
  const completedAt = state.backup?.details?.completedAt;
  if (typeof completedAt !== 'string') return true;
  const completedAtMs = Date.parse(completedAt);
  return !Number.isFinite(completedAtMs) || now - completedAtMs >= SCHEDULER_DELAYS.backupDueMs;
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

  private static async runBackup() {
    if (this.backupRunning) return;
    this.backupRunning = true;
    const startedAtMs = performance.now();
    try {
      await BackupService.createLocalBackup();
      const details = {
        completedAt: new Date().toISOString(),
        durationMs: Number((performance.now() - startedAtMs).toFixed(2))
      };
      await OperationalLogService.setState('backup', 'ok', details);
      await OperationalLogService.info('automatic-backup-completed', details);
      console.log('[SchedulerService] Backup concluído com sucesso.');
    } catch (error) {
      const details = {
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
    if (!isAutomaticBackupDue(OperationalLogService.getState())) return;
    await this.runBackup();
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

    // 2. Backup Automático Diário (checado a cada 1 hora se passou de 24h)
    // Para simplificar no contexto de desktop, faremos o backup rodar a cada 24 horas a partir do momento em que o app abre.
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
}
