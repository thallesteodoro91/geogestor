import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackupProtectionStatus } from './services/backup-status.service';

const current = {
  hasDestination: true,
  providerConfirmation: 'confirmed' as const,
  providerMessage: 'Cópia remota confirmada.',
  pendingChanges: 0,
  lastBackupAt: '2026-08-20T12:00:00.000Z',
  hasCompleteBackup: true,
  databaseStatus: 'current' as const,
  completeStatus: 'current' as const,
  integrity: 'verified' as const,
  integrityFailed: false,
  integrityVerifiedAt: '2026-08-20T12:00:00.000Z',
  recoveryConfigured: true,
  recoveryConfirmed: true,
  restoreTest: { status: 'success' as const, completedAt: '2026-08-20T12:05:00.000Z', durationMs: 2_000 },
  restoreTestIntervalDays: 30,
  changeDebounceMinutes: 5,
  now: Date.parse('2026-08-21T12:00:00.000Z')
};

test('distingue backup local íntegro de ausência de configuração externa', () => {
  const result = buildBackupProtectionStatus({ ...current, hasDestination: false, providerConfirmation: 'unavailable' });
  assert.equal(result.summary.state, 'local_only');
  assert.equal(result.summary.label, 'Backup local íntegro');
  assert.equal(result.protection.external.state, 'not_configured');
});

test('backup vencido nunca é classificado como protegido', () => {
  const result = buildBackupProtectionStatus({ ...current, completeStatus: 'overdue' });
  assert.equal(result.summary.state, 'overdue');
  assert.notEqual(result.summary.state, 'protected');
});

test('pasta configurada sem confirmação remota permanece não verificável', () => {
  const result = buildBackupProtectionStatus({ ...current, providerConfirmation: 'unavailable' });
  assert.equal(result.summary.state, 'external_unverified');
  assert.equal(result.protection.external.state, 'configured_unverified');
});

test('estado protegido exige provedor, recuperação e teste atualizados', () => {
  assert.equal(buildBackupProtectionStatus(current).summary.state, 'protected');
  assert.equal(buildBackupProtectionStatus({ ...current, recoveryConfirmed: false }).summary.state, 'recovery_incomplete');
  assert.equal(buildBackupProtectionStatus({ ...current, restoreTest: null }).summary.state, 'restore_test_due');
});

test('troca de destino sem histórico válido exige um novo primeiro backup', () => {
  const result = buildBackupProtectionStatus({
    ...current,
    lastBackupAt: null,
    hasCompleteBackup: false,
    databaseStatus: 'incomplete',
    completeStatus: 'incomplete'
  });
  assert.equal(result.summary.state, 'empty');
  assert.equal(result.protection.local.state, 'empty');
});

test('backup somente do banco permanece com proteção incompleta', () => {
  const result = buildBackupProtectionStatus({
    ...current,
    hasCompleteBackup: false,
    completeStatus: 'incomplete'
  });
  assert.equal(result.summary.state, 'empty');
  assert.equal(result.summary.label, 'Proteção incompleta');
  assert.match(result.summary.description, /somente do banco/i);
  assert.match(result.summary.description, /documentos/i);
});

test('divergência de checksum impede qualquer estado de proteção', () => {
  const result = buildBackupProtectionStatus({ ...current, integrityFailed: true });
  assert.equal(result.summary.state, 'failed');
  assert.match(result.summary.description, /integridade/i);
});

test('matriz do resumo preserva a prioridade operacional e as lacunas de proteção', () => {
  const cases: Array<[string, Parameters<typeof buildBackupProtectionStatus>[0], string]> = [
    ['em andamento', { ...current, databaseStatus: 'running' }, 'running'],
    ['falha de execução', { ...current, completeStatus: 'failed' }, 'failed'],
    ['alterações pendentes', { ...current, pendingChanges: 3 }, 'pending'],
    ['somente local', { ...current, hasDestination: false, providerConfirmation: 'unavailable' }, 'local_only'],
    ['destino sem confirmação', { ...current, providerConfirmation: 'pending' }, 'external_unverified'],
    ['recuperação incompleta', { ...current, recoveryConfirmed: false }, 'recovery_incomplete'],
    ['teste vencido', { ...current, now: Date.parse('2026-10-01T12:00:00.000Z') }, 'restore_test_due'],
    ['teste com falha', { ...current, restoreTest: { status: 'failed', completedAt: '2026-08-20T12:05:00.000Z' } }, 'failed'],
    ['proteção completa', current, 'protected']
  ];
  for (const [label, input, expected] of cases) {
    assert.equal(buildBackupProtectionStatus(input).summary.state, expected, label);
  }
});
