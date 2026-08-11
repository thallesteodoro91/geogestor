import crypto from 'node:crypto';

export type MaintenanceOperationType = 'backup_database' | 'backup_complete' | 'data_migration' | 'restore_test';

export type MaintenanceOperationSnapshot = {
  id: string;
  type: MaintenanceOperationType;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  stage: string;
  startedAt: string;
  completedAt: string | null;
  processedFiles: number;
  processedBytes: number;
  totalFiles: number;
  totalBytes: number;
  cancelRequested: boolean;
  cancellable: boolean;
  error: string | null;
};

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Falha desconhecida.');
  return message
    .replace(/(?:[A-Za-z]:\\|\\\\)[^\r\n,;]*/g, '[REDACTED_PATH]')
    .replace(/(token|secret|bearer)\s*[=:]?\s*[^\s&,]+/gi, '$1 [REDACTED]')
    .slice(0, 600);
}

export class MaintenanceOperationService {
  private static current: MaintenanceOperationSnapshot | null = null;

  static begin(type: MaintenanceOperationType, totals: { totalFiles: number; totalBytes: number }, stage = 'Preparando operação') {
    if (this.current?.status === 'running') {
      throw new Error('Já existe uma operação de manutenção em andamento. Aguarde a conclusão ou solicite o cancelamento seguro.');
    }
    this.current = {
      id: crypto.randomUUID(),
      type,
      status: 'running',
      stage,
      startedAt: new Date().toISOString(),
      completedAt: null,
      processedFiles: 0,
      processedBytes: 0,
      totalFiles: Math.max(0, totals.totalFiles),
      totalBytes: Math.max(0, totals.totalBytes),
      cancelRequested: false,
      cancellable: true,
      error: null
    };
    return this.controller(this.current.id);
  }

  static snapshot() {
    return this.current ? structuredClone(this.current) : null;
  }

  static requestCancel(id: string) {
    if (!this.current || this.current.id !== id || this.current.status !== 'running') return false;
    if (!this.current.cancellable) return false;
    this.current.cancelRequested = true;
    this.current.stage = 'Cancelamento solicitado; aguardando ponto seguro';
    return true;
  }

  static resetForTests() {
    this.current = null;
  }

  private static controller(id: string) {
    const assertCurrent = () => {
      if (!this.current || this.current.id !== id) throw new Error('A operação de manutenção não está mais ativa.');
      return this.current;
    };
    return {
      id,
      shouldCancel: () => Boolean(assertCurrent().cancelRequested),
      update: (progress: { stage: string; processedFiles: number; processedBytes: number; totalFiles: number; totalBytes: number }) => {
        const current = assertCurrent();
        current.stage = progress.stage;
        current.processedFiles = Math.max(0, progress.processedFiles);
        current.processedBytes = Math.max(0, progress.processedBytes);
        current.totalFiles = Math.max(current.processedFiles, progress.totalFiles);
        current.totalBytes = Math.max(current.processedBytes, progress.totalBytes);
      },
      setCancellable: (cancellable: boolean) => { assertCurrent().cancellable = cancellable; },
      finish: () => {
        const current = assertCurrent();
        current.status = 'success';
        current.stage = 'Operação concluída e validada';
        current.completedAt = new Date().toISOString();
        current.cancellable = false;
      },
      fail: (error: unknown) => {
        const current = assertCurrent();
        current.status = current.cancelRequested ? 'cancelled' : 'failed';
        current.stage = current.cancelRequested ? 'Operação cancelada com segurança' : 'Operação não concluída';
        current.completedAt = new Date().toISOString();
        current.cancellable = false;
        current.error = safeError(error);
      }
    };
  }
}
