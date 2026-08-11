import { commitFullSpreadsheetImport, type FullImportInput } from './full-spreadsheet-import.service';
import {
  failImportRun,
  nextQueuedFullImport,
  persistPostCommitResult,
  updateImportProgress,
  type ImportRowResult
} from './import-run.service';
import { OperationalLogService } from './operational-log.service';

export class FullImportWorkerService {
  private static running = false;

  static kick() {
    setImmediate(() => {
      void this.drain().catch(error => OperationalLogService.error('full-import-worker-failed', { error }));
    });
  }

  static async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const run = await nextQueuedFullImport();
        if (!run) break;
        await this.process(run);
      }
    } finally {
      this.running = false;
    }
  }

  private static async process(run: Awaited<ReturnType<typeof nextQueuedFullImport>> & {}) {
    const payload = run.payload as FullImportInput | null;
    if (!payload) {
      await failImportRun(run.importId, new Error('O conteúdo temporário da importação não está disponível.'));
      return;
    }
    try {
      await updateImportProgress(run.importId, 'validating', 'Validando estrutura', 10);
      await updateImportProgress(run.importId, 'validating', 'Validando registros', 25);
      await updateImportProgress(run.importId, 'processing', 'Resolvendo associações', 40);
      await updateImportProgress(run.importId, 'processing', 'Gravando dados', 55);
      const result = await commitFullSpreadsheetImport({ ...payload, fileHash: run.requestDigest });
      await updateImportProgress(run.importId, 'processing', 'Criando operações de pastas', 90);
      await updateImportProgress(run.importId, 'processing', 'Finalizando auditoria', 95);

      const issues = Array.isArray(result.warnings) ? result.warnings : [];
      const rowResults: ImportRowResult[] = issues
        .filter(issue => typeof issue?.row === 'number')
        .map(issue => ({
          index: Math.max(0, Number(issue.row) - 2),
          row: Number(issue.row),
          status: issue.severity === 'blocking' ? 'failed' : 'success',
          action: issue.severity === 'blocking' ? 'rejected' : 'review',
          errors: issue.severity === 'blocking' ? [String(issue.message)] : undefined,
          warnings: issue.severity === 'blocking' ? undefined : [String(issue.message)]
        }));
      const persisted = {
        ...result,
        importId: run.importId,
        domainImportId: result.importId,
        imported: result.counts.imported,
        updated: result.counts.updated,
        reused: 0,
        ignored: result.counts.ignored,
        failed: result.counts.rejected,
        pendingReview: result.counts.pendingReview,
        results: rowResults
      };
      await persistPostCommitResult(run.importId, persisted);
      await OperationalLogService.info('full-import-worker-completed', {
        importId: run.importId,
        status: persisted.status,
        rows: run.totalRows,
        imported: persisted.imported,
        pendingReview: persisted.pendingReview
      });
    } catch (error) {
      await failImportRun(run.importId, error);
      await OperationalLogService.error('full-import-worker-run-failed', { importId: run.importId, error });
    }
  }

  static resetForTests() {
    if (process.env.NODE_ENV !== 'test') throw new Error('Reinicialização permitida somente em testes.');
    this.running = false;
  }
}
