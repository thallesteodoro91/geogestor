import { GoogleCalendarService } from './google-calendar.service';
import { BackupService } from './backup.service';

const getErrorMessage = (err: unknown) => (
  err instanceof Error ? err.message : String(err)
);

export class SchedulerService {
  private static syncIntervalId: NodeJS.Timeout | null = null;
  private static backupIntervalId: NodeJS.Timeout | null = null;
  private static backupBootTimeoutId: NodeJS.Timeout | null = null;
  private static syncRunning = false;
  private static backupRunning = false;

  private static async runSync() {
    if (this.syncRunning) return;
    this.syncRunning = true;
    try {
      console.log('[SchedulerService] Disparando Sincronização com Google Calendar...');
      const result = await GoogleCalendarService.sync();
      console.log(`[SchedulerService] Google Calendar Sync finalizado: Enviados=${result.sent}, Recebidos=${result.received}`);
    } finally {
      this.syncRunning = false;
    }
  }

  private static async runBackup() {
    if (this.backupRunning) return;
    this.backupRunning = true;
    try {
      const result = await BackupService.createLocalBackup();
      console.log(`[SchedulerService] Backup concluído com sucesso: ${result.bundlePath}`);
    } finally {
      this.backupRunning = false;
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
        }
      }
    }, 15 * 60 * 1000);

    // 2. Backup Automático Diário (checado a cada 1 hora se passou de 24h)
    // Para simplificar no contexto de desktop, faremos o backup rodar a cada 24 horas a partir do momento em que o app abre.
    this.backupIntervalId = setInterval(async () => {
      try {
        console.log('[SchedulerService] Disparando Backup Automático...');
        await this.runBackup();
      } catch (err) {
        console.error('[SchedulerService] Erro no Backup Automático:', getErrorMessage(err));
      }
    }, 24 * 60 * 60 * 1000); // 24 horas

    // Roda o backup inicial no boot também
    this.backupBootTimeoutId = setTimeout(async () => {
      try {
        console.log('[SchedulerService] Disparando Backup Inicial de Segurança...');
        await this.runBackup();
      } catch (err) {
        console.error('[SchedulerService] Falha no Backup Inicial:', getErrorMessage(err));
      }
    }, 5000); // 5 segundos após a inicialização para não travar a porta
  }

  public static stop() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    if (this.backupIntervalId) clearInterval(this.backupIntervalId);
    if (this.backupBootTimeoutId) clearTimeout(this.backupBootTimeoutId);
    this.syncIntervalId = null;
    this.backupIntervalId = null;
    this.backupBootTimeoutId = null;
    console.log('[SchedulerService] Tarefas em background interrompidas.');
  }
}
