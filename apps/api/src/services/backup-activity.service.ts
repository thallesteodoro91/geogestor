import { OperationalLogService } from './operational-log.service';

type BackupActivityDetails = {
  changeSequence: number;
  protectedSequence: number;
  completeChangeSequence: number;
  pendingChanges: number;
  completeRequired: boolean;
  firstPendingAt: string | null;
  lastChangeAt: string | null;
  lastProtectedAt: string | null;
  lastBundleName: string | null;
};

const EMPTY_ACTIVITY: BackupActivityDetails = {
  changeSequence: 0,
  protectedSequence: 0,
  completeChangeSequence: 0,
  pendingChanges: 0,
  completeRequired: false,
  firstPendingAt: null,
  lastChangeAt: null,
  lastProtectedAt: null,
  lastBundleName: null
};

function finiteInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export class BackupActivityService {
  private static updateQueue: Promise<void> = Promise.resolve();

  static snapshot(): BackupActivityDetails {
    const component = OperationalLogService.getState().backupActivity;
    const details = component?.details || {};
    const changeSequence = finiteInteger(details.changeSequence);
    const protectedSequence = Math.min(changeSequence, finiteInteger(details.protectedSequence));
    const completeChangeSequence = Math.min(changeSequence, finiteInteger(details.completeChangeSequence));
    return {
      changeSequence,
      protectedSequence,
      completeChangeSequence,
      pendingChanges: Math.max(0, changeSequence - protectedSequence),
      completeRequired: completeChangeSequence > protectedSequence,
      firstPendingAt: typeof details.firstPendingAt === 'string' ? details.firstPendingAt : null,
      lastChangeAt: typeof details.lastChangeAt === 'string' ? details.lastChangeAt : null,
      lastProtectedAt: typeof details.lastProtectedAt === 'string' ? details.lastProtectedAt : null,
      lastBundleName: typeof details.lastBundleName === 'string' ? details.lastBundleName : null
    };
  }

  static captureSequence() {
    return this.snapshot().changeSequence;
  }

  static markChanged(scope: 'database' | 'complete' = 'database') {
    return this.enqueue(async () => {
      const current = this.snapshot();
      const now = new Date().toISOString();
      const next: BackupActivityDetails = {
        ...current,
        changeSequence: current.changeSequence + 1,
        completeChangeSequence: scope === 'complete' ? current.changeSequence + 1 : current.completeChangeSequence,
        pendingChanges: current.pendingChanges + 1,
        completeRequired: scope === 'complete' || current.completeRequired,
        firstPendingAt: current.pendingChanges > 0 ? current.firstPendingAt : now,
        lastChangeAt: now
      };
      await OperationalLogService.setState('backupActivity', 'degraded', next);
    });
  }

  static markProtected(protectedSequence: number, input: { completedAt: string; bundleName: string }) {
    return this.enqueue(async () => {
      const current = this.snapshot();
      const nextProtectedSequence = Math.min(
        current.changeSequence,
        Math.max(current.protectedSequence, finiteInteger(protectedSequence))
      );
      const pendingChanges = Math.max(0, current.changeSequence - nextProtectedSequence);
      const next: BackupActivityDetails = {
        ...current,
        protectedSequence: nextProtectedSequence,
        pendingChanges,
        completeRequired: current.completeChangeSequence > nextProtectedSequence,
        firstPendingAt: pendingChanges > 0 ? current.lastChangeAt : null,
        lastProtectedAt: input.completedAt,
        lastBundleName: input.bundleName
      };
      await OperationalLogService.setState('backupActivity', pendingChanges > 0 ? 'degraded' : 'ok', next);
    });
  }

  static isDue(debounceMinutes: number, now = Date.now()) {
    const activity = this.snapshot();
    if (activity.pendingChanges <= 0 || !activity.firstPendingAt) return false;
    const firstPendingAt = Date.parse(activity.firstPendingAt);
    return !Number.isFinite(firstPendingAt) || now - firstPendingAt >= Math.max(1, debounceMinutes) * 60_000;
  }

  static resetForTests() {
    this.updateQueue = Promise.resolve();
  }

  private static enqueue(operation: () => Promise<void>) {
    const task = this.updateQueue.then(operation, operation);
    this.updateQueue = task.catch(() => undefined);
    return task;
  }
}
