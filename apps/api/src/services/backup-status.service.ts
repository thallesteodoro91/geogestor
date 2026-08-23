export type BackupSummaryState =
  | 'empty'
  | 'running'
  | 'failed'
  | 'pending'
  | 'overdue'
  | 'local_only'
  | 'external_unverified'
  | 'recovery_incomplete'
  | 'restore_test_due'
  | 'protected';

type OperationState = 'current' | 'overdue' | 'incomplete' | 'failed' | 'running';
type ProviderConfirmation = 'unavailable' | 'pending' | 'confirmed' | 'failed';

export function buildBackupProtectionStatus(input: {
  hasDestination: boolean;
  providerConfirmation: ProviderConfirmation;
  providerMessage: string;
  pendingChanges: number;
  lastBackupAt: string | null;
  hasCompleteBackup: boolean;
  databaseStatus: OperationState;
  completeStatus: OperationState;
  integrity: 'verified' | 'legacy-unverified' | null;
  integrityFailed: boolean;
  integrityVerifiedAt: string | null;
  recoveryConfigured: boolean;
  recoveryConfirmed: boolean;
  restoreTest: { status: 'success' | 'failed'; completedAt: string; durationMs?: number | null } | null;
  restoreTestIntervalDays: number;
  changeDebounceMinutes: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const running = input.databaseStatus === 'running' || input.completeStatus === 'running';
  const failed = input.databaseStatus === 'failed'
    || input.completeStatus === 'failed'
    || input.integrityFailed
    || input.restoreTest?.status === 'failed';
  const overdue = input.databaseStatus === 'overdue' || input.completeStatus === 'overdue';
  const restoreTestAt = input.restoreTest?.status === 'success' ? Date.parse(input.restoreTest.completedAt) : 0;
  const restoreTestDue = !restoreTestAt
    || !Number.isFinite(restoreTestAt)
    || now - restoreTestAt >= Math.max(1, input.restoreTestIntervalDays) * 24 * 60 * 60 * 1000;
  const externalState = !input.hasDestination
    ? 'not_configured'
    : input.providerConfirmation === 'confirmed'
      ? 'confirmed'
      : input.providerConfirmation === 'failed'
        ? 'failed'
        : input.providerConfirmation === 'pending'
          ? 'pending'
          : 'configured_unverified';
  const localState = running ? 'running'
    : failed ? 'failed'
      : !input.hasCompleteBackup ? 'empty'
        : overdue ? 'overdue'
          : input.pendingChanges > 0 ? 'pending'
            : 'current';
  const recoveryState = !input.recoveryConfigured ? 'device_only' : input.recoveryConfirmed ? 'confirmed' : 'not_confirmed';
  const restoreState = input.restoreTest?.status === 'failed' ? 'failed'
    : !input.restoreTest ? 'never_tested'
      : restoreTestDue ? 'due'
        : 'tested';

  const state: BackupSummaryState = running ? 'running'
    : failed ? 'failed'
      : !input.hasCompleteBackup ? 'empty'
        : overdue ? 'overdue'
          : input.pendingChanges > 0 ? 'pending'
            : !input.hasDestination ? 'local_only'
              : externalState !== 'confirmed' ? 'external_unverified'
                : recoveryState !== 'confirmed' ? 'recovery_incomplete'
                  : restoreState !== 'tested' ? 'restore_test_due'
                    : 'protected';

  const copy: Record<BackupSummaryState, { label: string; description: string }> = {
    empty: input.lastBackupAt
      ? { label: 'Proteção incompleta', description: 'Existe uma cópia somente do banco. Crie um backup completo para incluir também os documentos dos clientes.' }
      : { label: 'Primeiro backup pendente', description: 'Crie um backup completo para iniciar a proteção dos dados.' },
    running: { label: 'Criando backup…', description: 'O GeoGestor está protegendo e verificando seus dados.' },
    failed: {
      label: 'Atenção necessária',
      description: input.integrityFailed
        ? 'A verificação de integridade encontrou uma divergência. Não use esta cópia até criar e validar um novo backup.'
        : input.restoreTest?.status === 'failed'
          ? 'O último teste de restauração falhou. Verifique o destino e teste novamente.'
          : 'A última operação de backup falhou. Verifique o destino e tente novamente.'
    },
    pending: { label: `${input.pendingChanges} ${input.pendingChanges === 1 ? 'alteração pendente' : 'alterações pendentes'}`, description: `As alterações serão consolidadas em até ${Math.max(1, input.changeDebounceMinutes)} minuto(s).` },
    overdue: { label: 'Backup vencido', description: 'A última cópia ultrapassou o intervalo configurado. Execute um backup agora.' },
    local_only: { label: 'Backup local íntegro', description: 'Existe uma cópia local verificada, mas seus dados ainda não estão protegidos contra perda deste computador.' },
    external_unverified: { label: 'Destino separado configurado', description: input.providerMessage || 'A cópia foi criada no destino configurado, mas a sincronização remota não pode ser confirmada.' },
    recovery_incomplete: { label: 'Recuperação pendente', description: 'Valide o kit de recuperação antes de considerar os dados recuperáveis em outro computador.' },
    restore_test_due: { label: 'Teste de restauração pendente', description: 'Execute um teste isolado para confirmar que a cópia pode ser restaurada.' },
    protected: { label: 'Backup protegido', description: 'Cópia confirmada, recuperação validada e restauração testada dentro do prazo.' }
  };

  return {
    summary: {
      state,
      configured: input.hasDestination,
      pendingChanges: input.pendingChanges,
      lastBackupAt: input.lastBackupAt,
      integrity: input.integrity,
      label: copy[state].label,
      description: copy[state].description
    },
    protection: {
      local: { state: localState, lastBackupAt: input.lastBackupAt, integrity: input.integrity, verifiedAt: input.integrityVerifiedAt },
      external: { state: externalState, message: input.providerMessage },
      recovery: { state: recoveryState },
      restoreTest: { state: restoreState, completedAt: input.restoreTest?.completedAt || null, durationMs: input.restoreTest?.durationMs ?? null },
      objectives: {
        maximumUnprotectedMinutes: Math.max(1, input.changeDebounceMinutes),
        observedRestoreTimeMs: input.restoreTest?.status === 'success' ? input.restoreTest.durationMs ?? null : null
      }
    }
  };
}
