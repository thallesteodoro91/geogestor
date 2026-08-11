import { FileSystemOutboxService } from './filesystem-outbox.service';
import { persistPostCommitResult } from './import-run.service';
import { OperationalLogService } from './operational-log.service';

export async function finalizeImportFilesystem<T extends Record<string, unknown>>(runId: string, result: T) {
  let pending = false;
  try {
    const processing = await FileSystemOutboxService.processPending();
    pending = processing.failed > 0;
  } catch (error) {
    pending = true;
    await OperationalLogService.error('import-filesystem-post-commit-failed', { importId: runId, error });
  }
  if (!pending) return result;
  const warning = 'Os dados foram gravados, mas uma ou mais pastas ficaram pendentes para nova tentativa automática.';
  const finalized = {
    ...result,
    status: result.status === 'completed' ? 'completed_with_warnings' : result.status,
    filesystemPending: true,
    warnings: [...(Array.isArray(result.warnings) ? result.warnings : []), warning]
  } as T & { filesystemPending: true; warnings: string[] };
  await persistPostCommitResult(runId, finalized);
  return finalized;
}
