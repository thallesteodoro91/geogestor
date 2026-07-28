import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.resolve(
  process.cwd(),
  'scratch',
  `scheduler-${process.pid}`,
  'geogestor.db'
);

test('política de backup usa estado persistido e janela de 24 horas', async () => {
  const { isAutomaticBackupDue, SCHEDULER_DELAYS } = await import('./services/scheduler.service');
  const now = Date.parse('2026-07-25T12:00:00.000Z');

  assert.equal(isAutomaticBackupDue({}, now), true);
  assert.equal(isAutomaticBackupDue({
    backup: {
      status: 'ok',
      updatedAt: '2026-07-25T11:00:00.000Z',
      details: { completedAt: 'inválido' }
    }
  }, now), true);
  assert.equal(isAutomaticBackupDue({
    backup: {
      status: 'ok',
      updatedAt: '2026-07-25T11:00:00.000Z',
      details: { completedAt: new Date(now - SCHEDULER_DELAYS.backupDueMs + 1).toISOString() }
    }
  }, now), false);
  assert.equal(isAutomaticBackupDue({
    backup: {
      status: 'ok',
      updatedAt: '2026-07-24T12:00:00.000Z',
      details: { completedAt: new Date(now - SCHEDULER_DELAYS.backupDueMs).toISOString() }
    }
  }, now), true);
});

test('start agenda outbox cedo e posterga backup e manutenção pesada', async () => {
  const scheduledTimeouts: number[] = [];
  const scheduledIntervals: number[] = [];
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearTimeout = global.clearTimeout;
  const originalClearInterval = global.clearInterval;

  global.setTimeout = ((callback: () => void, delay?: number) => {
    scheduledTimeouts.push(Number(delay));
    return { callback } as unknown as NodeJS.Timeout;
  }) as typeof setTimeout;
  global.setInterval = ((callback: () => void, delay?: number) => {
    scheduledIntervals.push(Number(delay));
    return { callback } as unknown as NodeJS.Timeout;
  }) as typeof setInterval;
  global.clearTimeout = (() => undefined) as typeof clearTimeout;
  global.clearInterval = (() => undefined) as typeof clearInterval;

  try {
    const { SchedulerService, SCHEDULER_DELAYS } = await import('./services/scheduler.service');
    SchedulerService.start();

    assert.deepEqual(scheduledTimeouts, [
      SCHEDULER_DELAYS.outboxBootMs,
      SCHEDULER_DELAYS.backupBootMs,
      SCHEDULER_DELAYS.maintenanceBootMs
    ]);
    assert.ok(SCHEDULER_DELAYS.backupBootMs >= 30_000);
    assert.ok(SCHEDULER_DELAYS.maintenanceBootMs >= 30_000);
    assert.deepEqual(scheduledIntervals, [
      SCHEDULER_DELAYS.syncIntervalMs,
      SCHEDULER_DELAYS.backupIntervalMs,
      SCHEDULER_DELAYS.maintenanceIntervalMs
    ]);
    SchedulerService.stop();
  } finally {
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    global.clearTimeout = originalClearTimeout;
    global.clearInterval = originalClearInterval;
  }
});
