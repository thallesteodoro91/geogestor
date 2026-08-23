import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { apiClient } from '../services/apiClient';
import { BackupModalFooter } from './BackupModalFooter';
import {
  BackupAdvancedSections,
  BackupLoadingSkeleton,
  BackupOperationProgress,
  Disclosure,
  OperationFeedbackNotice,
  ProtectionJourney,
  ProtectionMetrics,
  ProtectionSummary
} from './BackupProtectionSections';
import { BackupRecoverySection } from './BackupRecoverySection';
import {
  formatBackupDate,
  getBackupPrimaryAction,
  type BackupSummaryState
} from './backupProtectionPresentation';
import type {
  BackupOperationFeedback,
  BackupStatus,
  NativeRecoveryStatus,
  RecoveryErrors,
  RecoveryMethod
} from './backupProtectionTypes';
import { Modal } from './Modal';

const RECOVERY_INACTIVITY_TIMEOUT_MS = 5 * 60_000;
const TOOLTIP_RETURN_SUPPRESSION_MS = 600;

const backupStateIconTone: Record<BackupSummaryState, string> = {
  protected: 'text-emerald-600 dark:text-emerald-400',
  running: 'text-indigo-600 dark:text-indigo-400',
  failed: 'text-red-600 dark:text-red-400',
  pending: 'text-amber-700 dark:text-amber-400',
  overdue: 'text-amber-700 dark:text-amber-400',
  recovery_incomplete: 'text-amber-700 dark:text-amber-400',
  restore_test_due: 'text-amber-700 dark:text-amber-400',
  local_only: 'text-amber-700 dark:text-amber-400',
  external_unverified: 'text-amber-700 dark:text-amber-400',
  empty: 'text-zinc-600 dark:text-zinc-400'
};

function feedback(
  tone: BackupOperationFeedback['tone'],
  title: string,
  description: string,
  nextStep?: string
): BackupOperationFeedback {
  return { tone, title, description, occurredAt: new Date().toISOString(), nextStep };
}

export function BackupStatusIndicator({
  compact = false,
  surface = 'indicator',
  detailsPolicy,
  onDatabaseBackup,
  databaseBackupPending = false,
  onFullBackup,
  fullBackupPending = false,
  fullBackupLabel = 'Fazer backup completo agora',
  onRestoreBackup,
  restorePending = false
}: {
  compact?: boolean;
  surface?: 'indicator' | 'details';
  detailsPolicy?: ReactNode;
  onDatabaseBackup?: () => void;
  databaseBackupPending?: boolean;
  onFullBackup?: () => void;
  fullBackupPending?: boolean;
  fullBackupLabel?: string;
  onRestoreBackup?: () => void;
  restorePending?: boolean;
}) {
  const detailsMode = surface === 'details';
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [viewNow, setViewNow] = useState(() => Date.now());
  const [operationNow, setOperationNow] = useState(() => Date.now());
  const [adminPassword, setAdminPassword] = useState('');
  const [kitPassword, setKitPassword] = useState('');
  const [kitSaved, setKitSaved] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryErrors, setRecoveryErrors] = useState<RecoveryErrors>({});
  const [operationFeedback, setOperationFeedback] = useState<BackupOperationFeedback | null>(null);
  const [nativeRecovery, setNativeRecovery] = useState<NativeRecoveryStatus | null>(null);
  const hasSeenBackup = useRef<boolean | null>(null);
  const failureNotified = useRef(false);
  const suppressNextTooltipFocus = useRef(false);
  const suppressTooltipPointerUntil = useRef(0);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => apiClient.get<BackupStatus>('/api/sistema/backups/status'),
    refetchInterval: (query) =>
      open || query.state.data?.activeOperation?.status === 'running' ? 800 : 15_000,
    refetchIntervalInBackground: false
  });

  const focusRecoveryField = useCallback((id: string) => {
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, []);

  const clearSensitiveState = useCallback(() => {
    setAdminPassword('');
    setKitPassword('');
    setRecoveryCode(null);
    setRecoveryErrors({});
  }, []);

  const backupMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/api/sistema/backup-completo', undefined, { timeoutMs: 15 * 60_000 }),
    onSuccess: async () => {
      hasSeenBackup.current = true;
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      setOperationFeedback(
        feedback(
          'success',
          'Backup concluído e verificado',
          'A nova cópia foi gravada na pasta configurada e teve sua integridade conferida.',
          'Mantenha o destino externo disponível para as próximas execuções.'
        )
      );
      toast.success('Backup criado e verificado na pasta configurada.');
    },
    onError: (error: Error) => {
      const description = `${error.message} Verifique a pasta de destino e tente novamente.`;
      setOperationFeedback(
        feedback('error', 'Não foi possível concluir o backup', description, 'Revise o destino e crie um novo backup.')
      );
      toast.error(description);
    }
  });

  const testRestoreMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/api/sistema/backups/testar-restauracao', undefined, {
        timeoutMs: 30 * 60_000
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      setOperationFeedback(
        feedback(
          'success',
          'Restauração testada com sucesso',
          'A cópia foi restaurada em uma área isolada. Seus dados em uso não foram alterados.',
          'Repita o teste conforme a política de proteção.'
        )
      );
      toast.success('Restauração testada em uma área isolada. Seus dados em uso não foram alterados.');
    },
    onError: (error: Error) => {
      setOperationFeedback(
        feedback(
          'error',
          'O teste de restauração falhou',
          error.message,
          'Verifique a integridade do backup e tente novamente.'
        )
      );
      toast.error(error.message);
    }
  });

  const integrityMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ checksumFilesVerified: number }>(
        '/api/sistema/backups/verificar-integridade',
        undefined,
        { timeoutMs: 30 * 60_000 }
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      const count = result.checksumFilesVerified.toLocaleString('pt-BR');
      setOperationFeedback(
        feedback(
          'success',
          'Integridade confirmada',
          `${count} checksum(s) foram recalculados sem divergências.`,
          'Nenhuma ação adicional é necessária agora.'
        )
      );
      toast.success(`Integridade confirmada: ${count} checksum(s) recalculado(s).`);
    },
    onError: (error: Error) => {
      setOperationFeedback(
        feedback(
          'error',
          'A verificação de integridade falhou',
          error.message,
          'Não use a cópia até criar e validar um novo backup.'
        )
      );
      toast.error(error.message);
    }
  });

  const cancelOperationMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/sistema/operacoes/${id}/cancelar`),
    onSuccess: () => {
      setOperationFeedback(
        feedback(
          'info',
          'Cancelamento solicitado',
          'O GeoGestor encerrará a operação no próximo ponto seguro.',
          'Aguarde a confirmação antes de iniciar outra operação.'
        )
      );
      void queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error: Error) => {
      setOperationFeedback(
        feedback('error', 'Não foi possível cancelar', error.message, 'Aguarde a conclusão da operação atual.')
      );
      toast.error(error.message);
    }
  });

  const revealCodeMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ recoveryCode: string }>('/api/sistema/backups/recuperacao/codigo', {
        password: adminPassword
      }),
    onSuccess: ({ recoveryCode: code }) => {
      setRecoveryCode(code);
      setAdminPassword('');
      setRecoveryErrors({});
      setOperationFeedback(
        feedback(
          'info',
          'Código de recuperação revelado',
          'O código está disponível temporariamente nesta tela.',
          'Copie e guarde o código fora deste computador.'
        )
      );
    },
    onError: (error: Error) => {
      setRecoveryErrors({ adminPassword: error.message });
      focusRecoveryField('backup-admin-password-code');
    }
  });

  const exportKitMutation = useMutation({
    mutationFn: async () => {
      const kit = await apiClient.post<Record<string, unknown>>(
        '/api/sistema/backups/recuperacao/kit',
        { password: adminPassword, kitPassword },
        { timeoutMs: 60_000 }
      );
      if (!window.electronAPI?.saveBackupRecoveryKit) {
        throw new Error('A exportação do kit está disponível no aplicativo desktop.');
      }
      return window.electronAPI.saveBackupRecoveryKit(kit);
    },
    onSuccess: (savedPath) => {
      setAdminPassword('');
      setKitPassword('');
      setRecoveryCode(null);
      setRecoveryErrors({});
      if (!savedPath) return;
      setKitSaved(true);
      setOperationFeedback(
        feedback(
          'success',
          'Kit de recuperação exportado',
          'O arquivo protegido foi salvo no local escolhido.',
          'Reimporte o arquivo com a mesma senha para confirmar que ele pode ser usado.'
        )
      );
      toast.success('Kit salvo. Reimporte o arquivo com sua senha para confirmar o uso em outro computador.');
    },
    onError: (error: Error) => {
      setRecoveryErrors({ action: error.message });
      focusRecoveryField('backup-recovery-action-error');
    }
  });

  const validateKitMutation = useMutation({
    mutationFn: async () => {
      if (!window.electronAPI?.selectBackupRecoveryKit || !window.electronAPI?.confirmBackupRecovery) {
        throw new Error('A validação do kit está disponível no aplicativo desktop.');
      }
      const selected = await window.electronAPI.selectBackupRecoveryKit();
      if (!selected) return null;
      const validation = await apiClient.post<{ valid: true; keyId: string }>(
        '/api/sistema/backups/recuperacao/kit/validar',
        { kit: selected.kit, kitPassword, purpose: 'confirm' },
        { timeoutMs: 60_000 }
      );
      return window.electronAPI.confirmBackupRecovery(validation.keyId);
    },
    onSuccess: async (confirmed) => {
      if (!confirmed) return;
      setNativeRecovery(confirmed);
      clearSensitiveState();
      setKitSaved(false);
      setRecoveryMethod(null);
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      setOperationFeedback(
        feedback(
          'success',
          'Recuperação confirmada',
          'O kit foi reimportado, descriptografado e corresponde à chave deste dispositivo.',
          'Guarde o arquivo e a senha em locais separados e seguros.'
        )
      );
      toast.success('Kit reimportado e validado. A recuperação em outro computador está confirmada.');
    },
    onError: (error: Error) => {
      setRecoveryErrors({ action: error.message });
      focusRecoveryField('backup-recovery-action-error');
    }
  });

  const status = statusQuery.data;
  const activeOperation = status?.activeOperation?.status === 'running' ? status.activeOperation : null;
  const activeOperationId = activeOperation?.id || null;

  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    window.addEventListener('geogestor:backup-invalidated', invalidate);
    return () => window.removeEventListener('geogestor:backup-invalidated', invalidate);
  }, [queryClient]);

  useEffect(() => {
    if ((!open && !detailsMode) || !window.electronAPI?.getBackupRecoveryStatus) return;
    void window.electronAPI.getBackupRecoveryStatus().then(setNativeRecovery).catch(() => undefined);
  }, [detailsMode, open]);

  const sensitiveOperationRunning =
    revealCodeMutation.isPending || exportKitMutation.isPending || validateKitMutation.isPending;

  useEffect(() => {
    if ((!open && !detailsMode) || sensitiveOperationRunning) return;
    let timeout = 0;
    const resetTimer = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(clearSensitiveState, RECOVERY_INACTIVITY_TIMEOUT_MS);
    };
    resetTimer();
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('pointerdown', resetTimer);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('pointerdown', resetTimer);
    };
  }, [clearSensitiveState, detailsMode, open, sensitiveOperationRunning]);

  useEffect(() => {
    if (!activeOperationId) return;
    const interval = window.setInterval(() => setOperationNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [activeOperationId]);

  const closeModal = useCallback(() => {
    suppressNextTooltipFocus.current = true;
    suppressTooltipPointerUntil.current = Date.now() + TOOLTIP_RETURN_SUPPRESSION_MS;
    setTooltipOpen(false);
    setOpen(false);
    clearSensitiveState();
    setKitSaved(false);
    setRecoveryMethod(null);
    setRecoveryOpen(false);
    setOperationFeedback(null);
  }, [clearSensitiveState]);

  const openModal = () => {
    setTooltipOpen(false);
    setViewNow(Date.now());
    setOpen(true);
  };

  const handleTooltipFocus = () => {
    if (suppressNextTooltipFocus.current) {
      suppressNextTooltipFocus.current = false;
      return;
    }
    setTooltipOpen(true);
  };

  const handleTooltipPointerEnter = () => {
    if (Date.now() < suppressTooltipPointerUntil.current) return;
    setTooltipOpen(true);
  };

  const openRecovery = () => {
    setRecoveryOpen(true);
    window.requestAnimationFrame(() => document.getElementById('backup-recovery-summary')?.focus());
  };

  const changeRecoveryMethod = (method: RecoveryMethod) => {
    clearSensitiveState();
    setKitSaved(false);
    setRecoveryMethod(method);
  };

  const validateRecoveryInput = (action: 'code' | 'export' | 'validate') => {
    const errors: RecoveryErrors = {};
    if ((action === 'code' || action === 'export') && !adminPassword.trim()) {
      errors.adminPassword = 'Informe a senha administrativa para continuar.';
    }
    if ((action === 'export' || action === 'validate') && kitPassword.length < 12) {
      errors.kitPassword = 'A senha do kit deve ter pelo menos 12 caracteres.';
    }
    setRecoveryErrors(errors);
    if (errors.adminPassword) {
      focusRecoveryField(
        recoveryMethod === 'code' ? 'backup-admin-password-code' : 'backup-admin-password-kit'
      );
      return false;
    }
    if (errors.kitPassword) {
      focusRecoveryField('backup-kit-password');
      return false;
    }
    return true;
  };

  const openBackupDirectory = async () => {
    const directory = status?.policy.destinationDirectory;
    if (!directory || !window.electronAPI?.openBackupDirectory) return;
    try {
      await window.electronAPI.openBackupDirectory(directory);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir a pasta de backups.';
      setOperationFeedback(
        feedback('error', 'Não foi possível abrir a pasta', message, 'Revise o destino nas configurações.')
      );
      toast.error(message);
    }
  };

  const copyText = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error('Não foi possível copiar. Selecione o conteúdo e copie manualmente.');
    }
  };

  const state = status?.summary.state || 'empty';
  const label = statusQuery.isError
    ? 'Status do backup indisponível'
    : status?.summary.label || 'Consultando backup…';
  const showSpinner = statusQuery.isLoading || state === 'running' || backupMutation.isPending;
  const isBackingUp = state === 'running' || backupMutation.isPending;
  const latestBackup = status?.storage.history.find((backup) => !backup.legacy);
  const recoveryConfirmed = nativeRecovery?.confirmed ?? status?.recovery.confirmed ?? false;
  const recoveryConfirmedAt = nativeRecovery?.confirmedAt || status?.recovery.confirmedAt || null;
  const lastBackupLabel = status?.summary.lastBackupAt
    ? `Último: ${formatBackupDate(status.summary.lastBackupAt)}`
    : 'Nenhum backup realizado';
  const nextCandidates = [status?.database.nextAt, status?.complete.nextAt].filter(
    (value): value is string => Boolean(value)
  );
  const nextBackupAt =
    nextCandidates.sort((left, right) => Date.parse(left) - Date.parse(right))[0] || null;
  const primaryAction = getBackupPrimaryAction(state, latestBackup?.integrityState);
  const operationPercent = activeOperation
    ? Math.min(
        100,
        Math.max(
          0,
          activeOperation.totalBytes > 0
            ? (activeOperation.processedBytes / activeOperation.totalBytes) * 100
            : activeOperation.totalFiles > 0
              ? (activeOperation.processedFiles / activeOperation.totalFiles) * 100
              : 0
        )
      )
    : 0;
  const operationElapsedSeconds = activeOperation
    ? Math.max(0, Math.floor((operationNow - Date.parse(activeOperation.startedAt)) / 1_000))
    : 0;

  useEffect(() => {
    if (compact || detailsMode || !status) return;
    const hasBackup = Boolean(status.summary.lastBackupAt);
    if (hasSeenBackup.current === null) {
      hasSeenBackup.current = hasBackup;
    } else if (!hasSeenBackup.current && hasBackup) {
      hasSeenBackup.current = true;
      toast.success('Primeiro backup criado e verificado com sucesso.');
    }
    if (state === 'failed' && !failureNotified.current) {
      failureNotified.current = true;
      toast.error('O backup automático precisa de atenção. Abra o indicador para ver como corrigir.');
    } else if (state !== 'failed') {
      failureNotified.current = false;
    }
  }, [compact, detailsMode, state, status]);

  const footer = status ? (
    <BackupModalFooter
      primaryAction={primaryAction}
      activeOperation={activeOperation}
      backingUp={isBackingUp}
      cancelling={cancelOperationMutation.isPending}
      onClose={closeModal}
      onBackup={() => backupMutation.mutate()}
      onCancel={() => activeOperation && cancelOperationMutation.mutate(activeOperation.id)}
    />
  ) : null;

  const errorContent = (
    <div
      role="alert"
      className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
    >
      <p>Não foi possível consultar o estado do backup. Verifique o aplicativo local e tente novamente.</p>
      <button
        type="button"
        onClick={() => void statusQuery.refetch()}
        disabled={statusQuery.isFetching}
        className="geo-focus-ring min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 disabled:cursor-wait disabled:opacity-70 dark:border-red-800 dark:hover:bg-red-950"
      >
        {statusQuery.isFetching ? 'Consultando novamente…' : 'Tentar novamente'}
      </button>
    </div>
  );

  const detailedContent = status ? (
    <div className="min-w-0 space-y-6">
      <ProtectionSummary
        status={status}
        state={state}
        showSpinner={showSpinner}
        primaryAction={primaryAction}
      />

      {operationFeedback ? <OperationFeedbackNotice feedback={operationFeedback} /> : null}

      {activeOperation ? (
        <BackupOperationProgress
          operation={activeOperation}
          percent={operationPercent}
          elapsedSeconds={operationElapsedSeconds}
        />
      ) : null}

      <ProtectionMetrics
        status={status}
        latestBackup={latestBackup}
        nextBackupAt={nextBackupAt}
        now={viewNow}
      />

      <section
        id="backup-actions"
        className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/20"
        aria-labelledby="backup-details-actions-title"
      >
        <div className="mb-3">
          <h3 id="backup-details-actions-title" tabIndex={-1} className="font-semibold text-zinc-950 dark:text-zinc-100">
            Ações de proteção
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Crie, verifique e teste cópias sem alterar os dados em uso. A restauração real fica separada abaixo.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={onFullBackup || (() => backupMutation.mutate())}
            disabled={fullBackupPending || isBackingUp || Boolean(activeOperation)}
            className="geo-focus-ring min-h-11 rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {fullBackupPending || isBackingUp ? 'Preparando backup completo…' : fullBackupLabel}
          </button>
          <button
            type="button"
            onClick={onDatabaseBackup || (() => backupMutation.mutate())}
            disabled={databaseBackupPending || isBackingUp || Boolean(activeOperation)}
            className="geo-focus-ring min-h-11 rounded-xl border border-indigo-300 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-950/30"
          >
            {databaseBackupPending ? 'Criando backup do banco…' : 'Backup somente do banco'}
          </button>
          <button
            type="button"
            onClick={() => integrityMutation.mutate()}
            disabled={!status.summary.lastBackupAt || integrityMutation.isPending || Boolean(activeOperation)}
            className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {integrityMutation.isPending ? 'Verificando integridade…' : 'Verificar integridade'}
          </button>
          <button
            type="button"
            onClick={() => testRestoreMutation.mutate()}
            disabled={!status.complete.completedAt || testRestoreMutation.isPending || Boolean(activeOperation)}
            className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {testRestoreMutation.isPending ? 'Testando restauração…' : 'Testar restauração'}
          </button>
          {status.policy.destinationDirectory && window.electronAPI?.openBackupDirectory ? (
            <button
              type="button"
              onClick={() => void openBackupDirectory()}
              className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Abrir pasta de backups
            </button>
          ) : (
            <button
              type="button"
              onClick={openRecovery}
              className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Preparar recuperação
            </button>
          )}
        </div>
        {activeOperation?.cancellable ? (
          <button
            type="button"
            onClick={() => cancelOperationMutation.mutate(activeOperation.id)}
            disabled={cancelOperationMutation.isPending || activeOperation.cancelRequested}
            className="geo-focus-ring mt-3 min-h-11 rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            {cancelOperationMutation.isPending || activeOperation.cancelRequested
              ? 'Cancelamento solicitado…'
              : 'Cancelar com segurança'}
          </button>
        ) : null}
        {onRestoreBackup ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/20">
            <div className="min-w-0">
              <strong className="block text-sm text-red-900 dark:text-red-200">Restauração real</strong>
              <p className="mt-0.5 text-xs leading-5 text-red-800 dark:text-red-300">
                Substitui os dados em uso somente após validação, autorização e confirmação explícita.
              </p>
            </div>
            <button
              type="button"
              onClick={onRestoreBackup}
              disabled={restorePending || Boolean(activeOperation)}
              className="geo-focus-ring min-h-11 shrink-0 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/60"
            >
              {restorePending ? 'Restaurando backup…' : 'Selecionar backup para restaurar'}
            </button>
          </div>
        ) : null}
      </section>

      {detailsPolicy}

      <div className="grid items-start gap-4 xl:grid-cols-2" aria-label="Configurações e informações avançadas de proteção">
        <Disclosure
          icon={<Cloud aria-hidden="true" size={20} />}
          iconTone="sky"
          title="Jornada de proteção"
          description="Destino externo, backup completo, kit de recuperação e teste de restauração."
        >
          <ProtectionJourney
            status={status}
            recoveryConfirmed={recoveryConfirmed}
            recoveryConfirmedAt={recoveryConfirmedAt}
            embedded
          />
        </Disclosure>

        <BackupRecoverySection
          open={recoveryOpen}
          confirmed={recoveryConfirmed}
          method={recoveryMethod}
          adminPassword={adminPassword}
          kitPassword={kitPassword}
          recoveryCode={recoveryCode}
          kitSaved={kitSaved}
          errors={recoveryErrors}
          revealing={revealCodeMutation.isPending}
          exporting={exportKitMutation.isPending}
          validating={validateKitMutation.isPending}
          onToggle={setRecoveryOpen}
          onMethodChange={changeRecoveryMethod}
          onAdminPasswordChange={(value) => {
            setAdminPassword(value);
            setRecoveryErrors((current) => ({ ...current, adminPassword: undefined, action: undefined }));
          }}
          onKitPasswordChange={(value) => {
            setKitPassword(value);
            setRecoveryErrors((current) => ({ ...current, kitPassword: undefined, action: undefined }));
          }}
          onRevealCode={() => {
            if (validateRecoveryInput('code')) revealCodeMutation.mutate();
          }}
          onExportKit={() => {
            if (validateRecoveryInput('export')) exportKitMutation.mutate();
          }}
          onValidateKit={() => {
            if (validateRecoveryInput('validate')) validateKitMutation.mutate();
          }}
          onCopyCode={() => {
            if (!recoveryCode) return;
            void copyText(recoveryCode, 'Código copiado. Guarde-o fora deste computador.').finally(
              () => setRecoveryCode(null)
            );
          }}
        />

        <BackupAdvancedSections
          status={status}
          latestBackup={latestBackup}
          includePolicyAndHistory={false}
          includeHistory
          onClose={closeModal}
          onCopy={(value, message) => void copyText(value, message)}
        />
      </div>
    </div>
  ) : (
    <BackupLoadingSkeleton />
  );

  if (detailsMode) {
    return (
      <section aria-labelledby="backup-protection-details-title" className="space-y-5">
        <header>
          <h2
            id="backup-protection-details-title"
            tabIndex={-1}
            className="text-pretty text-xl font-bold tracking-tight text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:text-white"
          >
            Backup e proteção de dados
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Consulte a jornada de proteção, valide a recuperação e acesse informações técnicas das suas cópias.
          </p>
        </header>
        {statusQuery.isError ? errorContent : detailedContent}
      </section>
    );
  }

  return (
    <>
      <div className="group/backup relative inline-flex">
        <button
          data-backup-status-trigger="true"
          type="button"
          onClick={openModal}
          onPointerEnter={handleTooltipPointerEnter}
          onPointerLeave={() => setTooltipOpen(false)}
          onFocus={handleTooltipFocus}
          onBlur={() => setTooltipOpen(false)}
          aria-label={`Status do backup: ${label}. ${lastBackupLabel}`}
          aria-describedby={tooltipId}
          className="geo-focus-ring motion-fast motion-gpu flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-zinc-600 hover:bg-zinc-100 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <Cloud
            aria-hidden="true"
            size={24}
            weight={state === 'protected' ? 'fill' : 'regular'}
            className={`${backupStateIconTone[state]} ${
              isBackingUp ? 'animate-pulse motion-reduce:animate-none' : ''
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${
              state === 'protected'
                ? 'bg-emerald-500'
                : state === 'failed'
                  ? 'bg-red-500'
                  : state === 'running'
                    ? 'bg-indigo-500'
                    : ['pending', 'overdue', 'recovery_incomplete', 'restore_test_due'].includes(state)
                      ? 'bg-amber-500'
                      : 'bg-amber-500'
            }`}
          />
        </button>
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-[100] w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-zinc-900 shadow-xl transition-[opacity,transform,visibility] duration-150 motion-reduce:transition-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${
            tooltipOpen ? 'visible opacity-100' : 'invisible opacity-0'
          } ${
            compact
              ? `right-0 top-full mt-2 ${tooltipOpen ? 'translate-y-0' : '-translate-y-1'}`
              : `bottom-full left-0 mb-2 ${tooltipOpen ? 'translate-y-0' : 'translate-y-1'}`
          }`}
        >
          <strong className="block break-words text-xs font-semibold">{label}</strong>
          <span className="mt-0.5 block break-words text-[11px] text-zinc-600 dark:text-zinc-400">
            {lastBackupLabel}
          </span>
          {status?.summary.description ? (
            <span className="mt-1.5 block break-words text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
              {status.summary.description}
            </span>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={closeModal}
        title="Proteção dos dados"
        maxWidth="max-w-md"
        density="compact"
        footer={footer}
        returnFocusSelector="[data-backup-status-trigger='true']"
      >
        {statusQuery.isError ? (
          errorContent
        ) : status ? (
          <div className="min-w-0 space-y-3">
            <ProtectionSummary
              status={status}
              state={state}
              showSpinner={showSpinner}
              primaryAction={primaryAction}
              compact
            />

            {operationFeedback ? <OperationFeedbackNotice feedback={operationFeedback} /> : null}

            {activeOperation ? (
              <BackupOperationProgress
                operation={activeOperation}
                percent={operationPercent}
                elapsedSeconds={operationElapsedSeconds}
              />
            ) : null}

            <ProtectionMetrics
              status={status}
              latestBackup={latestBackup}
              nextBackupAt={nextBackupAt}
              now={viewNow}
              compact
            />
            <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                Destino
              </span>
              <strong
                className="mt-1 block truncate text-sm text-zinc-900 dark:text-zinc-100"
                title={status.policy.destinationDirectory || 'Pasta externa ainda não configurada'}
              >
                {status.policy.destinationDirectory || 'Pasta externa ainda não configurada'}
              </strong>
            </div>
          </div>
        ) : (
          <BackupLoadingSkeleton />
        )}
      </Modal>
    </>
  );
}

export function BackupProtectionDetails(props: Omit<Parameters<typeof BackupStatusIndicator>[0], 'surface'>) {
  return <BackupStatusIndicator {...props} surface="details" />;
}
