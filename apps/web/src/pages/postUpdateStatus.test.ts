import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPostUpdateStatus, type PostUpdateBackupStatus } from './postUpdateStatus';

const protectedBackups: PostUpdateBackupStatus = {
  database: { status: 'current', completedAt: '2026-08-09T12:00:00.000Z' },
  complete: { status: 'current', completedAt: '2026-08-09T12:00:00.000Z' },
  activity: { pendingChanges: 0 },
  cloud: { confirmation: 'confirmed' },
  recovery: { configured: true, confirmed: true },
  summary: { state: 'protected', configured: true, integrity: 'verified' }
};

test('classifica atualização íntegra somente com banco, backups e recuperação protegidos', () => {
  assert.equal(assessPostUpdateStatus({ healthOk: true, qualityCritical: 0, backups: protectedBackups }).level, 'ok');
});

test('classifica backups vencidos, ausentes, com falha ou alterações pendentes como críticos', () => {
  for (const status of ['overdue', 'incomplete', 'failed'] as const) {
    const result = assessPostUpdateStatus({
      healthOk: true,
      qualityCritical: 0,
      backups: { ...protectedBackups, complete: { status, completedAt: null } }
    });
    assert.equal(result.level, 'critical');
  }
  const pending = assessPostUpdateStatus({
    healthOk: true,
    qualityCritical: 0,
    backups: { ...protectedBackups, activity: { pendingChanges: 2 }, summary: { ...protectedBackups.summary, state: 'pending' } }
  });
  assert.equal(pending.level, 'critical');
});

test('classifica cópia externa ou kit de recuperação ausentes como atenção', () => {
  const result = assessPostUpdateStatus({
    healthOk: true,
    qualityCritical: 0,
    backups: {
      ...protectedBackups,
      cloud: { confirmation: 'unavailable' },
      recovery: { configured: false, confirmed: false },
      summary: { ...protectedBackups.summary, configured: false, state: 'local_only' }
    }
  });
  assert.equal(result.level, 'warning');
  assert.equal(result.warnings.length, 2);
});
