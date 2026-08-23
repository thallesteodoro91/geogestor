import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatBackupMoment,
  formatIntegrity,
  formatNextBackup,
  getBackupPrimaryAction,
  type BackupSummaryState
} from './backupProtectionPresentation';

test('cada estado relevante oferece uma próxima ação específica', () => {
  const expected: Record<BackupSummaryState, string> = {
    empty: 'Fazer primeiro backup',
    running: 'Operação em andamento…',
    failed: 'Criar novo backup',
    pending: 'Proteger alterações agora',
    overdue: 'Criar novo backup',
    local_only: 'Configurar cópia externa',
    external_unverified: 'Revisar destino externo',
    recovery_incomplete: 'Validar kit de recuperação',
    restore_test_due: 'Testar restauração',
    protected: 'Fazer backup agora'
  };
  for (const [state, label] of Object.entries(expected) as Array<[BackupSummaryState, string]>) {
    assert.equal(getBackupPrimaryAction(state).label, label, state);
  }
  assert.equal(getBackupPrimaryAction('protected', 'failed').label, 'Criar novo backup');
});

test('datas humanas preservam uma representação absoluta disponível', () => {
  const now = Date.parse('2026-08-22T15:00:00-03:00');
  assert.match(formatBackupMoment('2026-08-22T12:30:00-03:00', now), /^Hoje,/);
  assert.match(formatBackupMoment('2026-08-20T12:30:00-03:00', now), /^Há 2 dias$/);
  assert.match(formatNextBackup('2026-08-22T19:00:00-03:00', now), /^Em aproximadamente 4 h$/);
});

test('integridade distingue criação, nova verificação, falha e legado', () => {
  assert.match(formatIntegrity({ integrityState: 'verified_at_creation', integrityVerifiedAt: '2026-08-22T12:00:00.000Z' }), /Verificado na criação/);
  assert.match(formatIntegrity({ integrityState: 'verified_again', integrityVerifiedAt: '2026-08-22T12:00:00.000Z' }), /Verificado novamente/);
  assert.equal(formatIntegrity({ integrityState: 'failed' }), 'Falha de integridade');
  assert.equal(formatIntegrity({ integrityState: 'legacy_unverified' }), 'Legado sem checksums');
});
