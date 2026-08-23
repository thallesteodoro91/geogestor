import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowCounterClockwise, FolderOpen, HardDrives, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { apiClient } from '../services/apiClient';
import { geoFieldClass, geoPanelClass } from '../utils/geoTheme';
import { CheckboxField } from './Form';
import { NumericInput } from './form-controls/NumericInput';
import { SettingsSaveBar, type SettingsSaveState } from './SettingsSaveBar';

type BackupPolicy = {
  automaticEnabled: boolean;
  changeDebounceMinutes: number;
  databaseIntervalHours: number;
  completeIntervalDays: number;
  retention: number;
  retentionRecentHours: number;
  retentionDailyDays: number;
  retentionMonthlyMonths: number;
  destinationDirectory: string | null;
  maxStorageBytes: number;
  overdueGraceHours: number;
  runOnStartup: boolean;
  runOnShutdown: boolean;
  runRestoreTests: boolean;
  restoreTestIntervalDays: number;
};

type BackupStatus = {
  policy: BackupPolicy;
  storage: {
    backupDirectory: string;
    versions: number;
    totalBytes: number;
    availableBytes: number;
    history: Array<{ directory: string; type: 'database' | 'complete'; createdAt: string; completedAt: string; files: number; bytes: number; encrypted: boolean; integrity: 'verified' | 'legacy-unverified'; integrityState: 'verified_at_creation' | 'verified_again' | 'failed' | 'legacy_unverified'; integrityVerifiedAt: string | null; credentialsExcluded: boolean; restoreTestedAt: string | null }>;
  };
  database: BackupOperationStatus;
  complete: BackupOperationStatus;
  restoreTest: { status: 'success' | 'failed'; completedAt: string; durationMs: number; error: string | null } | null;
};

const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  automaticEnabled: true,
  changeDebounceMinutes: 5,
  databaseIntervalHours: 24,
  completeIntervalDays: 7,
  retention: 10,
  retentionRecentHours: 24,
  retentionDailyDays: 30,
  retentionMonthlyMonths: 12,
  destinationDirectory: null,
  maxStorageBytes: 0,
  overdueGraceHours: 12,
  runOnStartup: true,
  runOnShutdown: true,
  runRestoreTests: true,
  restoreTestIntervalDays: 30
};

type BackupOperationStatus = {
  attemptedAt: string | null;
  completedAt: string | null;
  nextAt: string | null;
  durationMs: number | null;
  totalBytes: number | null;
  totalFiles: number | null;
  error: string | null;
  status: 'current' | 'overdue' | 'incomplete' | 'failed' | 'running';
};

const fieldClass = `${geoFieldClass} w-full px-3 py-2 text-sm`;
const numericWrapperClass = 'mt-1.5';
const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Ainda não realizado';
const formatBytes = (bytes: number) => new Intl.NumberFormat('pt-BR', {
  style: 'unit', unit: bytes >= 1024 ** 3 ? 'gigabyte' : 'megabyte', maximumFractionDigits: 1
}).format(bytes / (bytes >= 1024 ** 3 ? 1024 ** 3 : 1024 ** 2));

export function BackupPolicyPanel() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => apiClient.get<BackupStatus>('/api/sistema/backups/status')
  });
  const [draftPolicy, setDraftPolicy] = useState<BackupPolicy | null>(null);
  const [saveState, setSaveState] = useState<SettingsSaveState>('saved');
  const [saveError, setSaveError] = useState('');
  const policy = draftPolicy ?? statusQuery.data?.policy ?? null;
  const saveMutation = useMutation({
    mutationFn: () => apiClient.put('/api/sistema/backups/politica', policy),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['backup-status'] }),
        queryClient.invalidateQueries({ queryKey: ['sistema-info'] })
      ]);
      setDraftPolicy(null);
      setSaveState('success');
      window.setTimeout(() => setSaveState('saved'), 1800);
      toast.success('Política de backup salva no banco local.');
    },
    onError: (error: Error) => {
      setSaveError(error.message);
      setSaveState('error');
      toast.error(error.message);
    }
  });
  const testDestinationMutation = useMutation({
    mutationFn: () => apiClient.post<{ availableBytes: number }>('/api/sistema/backups/testar-destino', {
      destinationDirectory: policy?.destinationDirectory
    }),
    onSuccess: (result) => toast.success(`Pasta gravável, com ${formatBytes(result.availableBytes)} livres.`),
    onError: (error: Error) => toast.error(error.message)
  });
  const effectiveSaveState: SettingsSaveState = saveMutation.isPending
    ? 'saving'
    : draftPolicy && saveState !== 'error'
      ? 'dirty'
      : saveState;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('geogestor:settings-section-state', {
      detail: { section: 'backups', state: effectiveSaveState }
    }));
  }, [effectiveSaveState]);

  useEffect(() => {
    const discard = (event: Event) => {
      if ((event as CustomEvent<{ section?: string }>).detail?.section !== 'backups') return;
      setDraftPolicy(null);
      setSaveError('');
      setSaveState('saved');
    };
    window.addEventListener('geogestor:settings-discard', discard);
    return () => window.removeEventListener('geogestor:settings-discard', discard);
  }, []);

  useEffect(() => {
    if (!draftPolicy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draftPolicy]);

  const chooseDestination = async () => {
    if (!window.electronAPI?.selectBackupDirectory) {
      toast.error('A seleção de pasta está disponível somente no aplicativo desktop.');
      return;
    }
    const directory = await window.electronAPI.selectBackupDirectory();
    if (directory) setDraftPolicy({ ...policy!, destinationDirectory: directory });
  };

  if (statusQuery.isLoading || !policy) return <p aria-live="polite" className="text-sm text-zinc-500">Carregando política de backup…</p>;
  if (statusQuery.isError) return (
    <div role="alert" className={`${geoPanelClass} flex flex-wrap items-center justify-between gap-3 rounded-2xl border-red-200 p-5 text-sm text-red-700 dark:border-red-900 dark:text-red-300`}>
      <span className="flex items-center gap-2"><WarningCircle aria-hidden="true" size={20} /> Não foi possível consultar a política e o histórico dos backups.</span>
      <button type="button" onClick={() => void statusQuery.refetch()} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800 dark:hover:bg-red-950/30">Tentar novamente</button>
    </div>
  );
  const status = statusQuery.data!;
  const nextRestoreTestAt = status.restoreTest?.completedAt
    ? new Date(Date.parse(status.restoreTest.completedAt) + policy.restoreTestIntervalDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const storageUsagePercent = policy.maxStorageBytes > 0
    ? Math.min(100, (status.storage.totalBytes / policy.maxStorageBytes) * 100)
    : null;
  const averageVersionBytes = status.storage.versions > 0 ? status.storage.totalBytes / status.storage.versions : 0;
  const estimatedVersionsPerDay = (24 / policy.databaseIntervalHours) + (1 / policy.completeIntervalDays);
  const storageLimitEstimateDays = policy.maxStorageBytes > status.storage.totalBytes && averageVersionBytes > 0
    ? Math.max(1, Math.floor((policy.maxStorageBytes - status.storage.totalBytes) / averageVersionBytes / estimatedVersionsPerDay))
    : policy.maxStorageBytes > 0 && policy.maxStorageBytes <= status.storage.totalBytes ? 0 : null;

  return (
    <section className={`${geoPanelClass} space-y-5 rounded-2xl p-5`} aria-labelledby="backup-policy-title">
      <div>
        <h3 id="backup-policy-title" className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
          <HardDrives aria-hidden="true" size={20} /> Política automática de backups
        </h3>
        <button type="button" onClick={() => {
          if (window.confirm('Restaurar os padrões desta seção?\n\nAutomático: ativado\nConsolidação: 5 minutos\nBanco: a cada 24 horas\nCompleto: a cada 7 dias\nRetenção: 24 horas, 30 dias e 12 meses\nTeste de restauração: a cada 30 dias\nBackup ao encerrar: ativado')) {
            setDraftPolicy({ ...DEFAULT_BACKUP_POLICY });
            setSaveError('');
            setSaveState('dirty');
          }
        }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
          <ArrowCounterClockwise aria-hidden="true" size={16} /> Restaurar padrões
        </button>
        <p className="mt-1 text-xs text-zinc-500">Alterações recentes são consolidadas em segundo plano e protegidas sem interromper o uso.</p>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
        <CheckboxField
          id="backup-automatic-enabled"
          name="backup_automatic_enabled"
          checked={policy.automaticEnabled}
          onChange={(checked) => setDraftPolicy({ ...policy, automaticEnabled: checked })}
          className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/20"
          label={<span><strong className="block text-sm text-zinc-900 dark:text-zinc-100">Backup automático</strong><span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">Protege as alterações depois do intervalo de consolidação.</span></span>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="text-sm font-medium">
            <label htmlFor="backup-debounce-minutes">Consolidar alterações após (minutos)</label>
            <NumericInput id="backup-debounce-minutes" name="backup_debounce_minutes" min="1" max="1440" value={policy.changeDebounceMinutes} decrementLabel="Diminuir tempo de consolidação" incrementLabel="Aumentar tempo de consolidação" onChange={(event) => setDraftPolicy({ ...policy, changeDebounceMinutes: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-database-hours">Backup do banco a cada (horas)</label>
            <NumericInput id="backup-database-hours" name="backup_database_hours" min="1" max="720" value={policy.databaseIntervalHours} decrementLabel="Diminuir intervalo do backup do banco" incrementLabel="Aumentar intervalo do backup do banco" onChange={(event) => setDraftPolicy({ ...policy, databaseIntervalHours: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-complete-days">Backup completo a cada (dias)</label>
            <NumericInput id="backup-complete-days" name="backup_complete_days" min="1" max="365" value={policy.completeIntervalDays} decrementLabel="Diminuir intervalo do backup completo" incrementLabel="Aumentar intervalo do backup completo" onChange={(event) => setDraftPolicy({ ...policy, completeIntervalDays: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-retention">Mínimo de versões mantidas</label>
            <NumericInput id="backup-retention" name="backup_retention" min="1" max="365" value={policy.retention} decrementLabel="Diminuir mínimo de versões" incrementLabel="Aumentar mínimo de versões" onChange={(event) => setDraftPolicy({ ...policy, retention: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-recent-hours">Manter versões recentes (horas)</label>
            <NumericInput id="backup-recent-hours" name="backup_recent_hours" min="1" max="720" value={policy.retentionRecentHours} decrementLabel="Diminuir retenção de versões recentes" incrementLabel="Aumentar retenção de versões recentes" onChange={(event) => setDraftPolicy({ ...policy, retentionRecentHours: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-daily-days">Uma versão diária por (dias)</label>
            <NumericInput id="backup-daily-days" name="backup_daily_days" min="1" max="3650" value={policy.retentionDailyDays} decrementLabel="Diminuir retenção diária" incrementLabel="Aumentar retenção diária" onChange={(event) => setDraftPolicy({ ...policy, retentionDailyDays: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-monthly-months">Uma versão mensal por (meses)</label>
            <NumericInput id="backup-monthly-months" name="backup_monthly_months" min="1" max="120" value={policy.retentionMonthlyMonths} decrementLabel="Diminuir retenção mensal" incrementLabel="Aumentar retenção mensal" onChange={(event) => setDraftPolicy({ ...policy, retentionMonthlyMonths: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-storage-gb">Limite de espaço (GB; 0 = sem limite)</label>
            <NumericInput id="backup-storage-gb" name="backup_storage_gb" min="0" max="10000" value={Math.round(policy.maxStorageBytes / 1024 ** 3)} decrementLabel="Diminuir limite de espaço" incrementLabel="Aumentar limite de espaço" onChange={(event) => setDraftPolicy({ ...policy, maxStorageBytes: Number(event.target.value) * 1024 ** 3 })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium">
            <label htmlFor="backup-grace-hours">Tolerância para alerta (horas)</label>
            <NumericInput id="backup-grace-hours" name="backup_grace_hours" min="0" max="720" value={policy.overdueGraceHours} decrementLabel="Diminuir tolerância para alerta" incrementLabel="Aumentar tolerância para alerta" onChange={(event) => setDraftPolicy({ ...policy, overdueGraceHours: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          <div className="text-sm font-medium sm:col-span-2 lg:col-span-3">
            <label htmlFor="backup-destination">Pasta de destino opcional</label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input id="backup-destination" name="backup_destination" autoComplete="off" value={policy.destinationDirectory || ''} onChange={(event) => setDraftPolicy({ ...policy, destinationDirectory: event.target.value || null })} placeholder={status.storage.backupDirectory} className={`${geoFieldClass} min-h-11 flex-1 px-3 py-2 text-sm`} />
              <button type="button" onClick={() => void chooseDestination()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><FolderOpen aria-hidden="true" size={17} /> Escolher pasta</button>
              <button type="button" onClick={() => testDestinationMutation.mutate()} disabled={!policy.destinationDirectory || testDestinationMutation.isPending} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">{testDestinationMutation.isPending ? 'Testando…' : 'Testar destino'}</button>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField id="backup-run-on-startup" name="backup_run_on_startup" checked={policy.runOnStartup} onChange={(checked) => setDraftPolicy({ ...policy, runOnStartup: checked })} label="Verificar ao iniciar" className="rounded-xl border border-zinc-200 dark:border-zinc-800" />
          <CheckboxField id="backup-run-on-shutdown" name="backup_run_on_shutdown" checked={policy.runOnShutdown} onChange={(checked) => setDraftPolicy({ ...policy, runOnShutdown: checked })} label="Fazer backup ao encerrar" className="rounded-xl border border-zinc-200 dark:border-zinc-800" />
        </div>
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" aria-labelledby="automatic-restore-test-title">
          <CheckboxField id="backup-run-restore-tests" name="backup_run_restore_tests" checked={policy.runRestoreTests} onChange={(checked) => setDraftPolicy({ ...policy, runRestoreTests: checked })} label={<span><strong id="automatic-restore-test-title" className="block text-sm text-zinc-900 dark:text-zinc-100">Testar restauração automaticamente</strong><span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">Abre o último backup completo em uma área isolada e remove a cópia temporária ao terminar.</span></span>} />
          <div className="mt-3 text-sm font-medium">
            <label htmlFor="backup-restore-test-days">Testar a cada (dias)</label>
            <NumericInput id="backup-restore-test-days" name="backup_restore_test_days" min="1" max="365" disabled={!policy.runRestoreTests} value={policy.restoreTestIntervalDays} decrementLabel="Diminuir intervalo do teste de restauração" incrementLabel="Aumentar intervalo do teste de restauração" onChange={(event) => setDraftPolicy({ ...policy, restoreTestIntervalDays: Number(event.target.value) })} wrapperClassName={numericWrapperClass} className={fieldClass} />
          </div>
          {!policy.runRestoreTests ? <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Ative o teste automático para alterar este intervalo.</p> : null}
          <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
            <span>Último teste: <strong className="text-zinc-700 dark:text-zinc-200">{formatDate(status.restoreTest?.completedAt || null)}</strong></span>
            <span>Próximo: <strong className="text-zinc-700 dark:text-zinc-200">{formatDate(nextRestoreTestAt)}</strong></span>
            <span>Duração observada: <strong className="text-zinc-700 dark:text-zinc-200">{status.restoreTest?.durationMs != null ? `${(status.restoreTest.durationMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : 'Ainda não medida'}</strong></span>
          </div>
          {status.restoreTest?.status === 'failed' && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">O último teste falhou. {status.restoreTest.error || 'Execute um novo teste e verifique o destino.'}</p>}
        </section>
        <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
          <span>{status.storage.versions.toLocaleString('pt-BR')} versão(ões) • {formatBytes(status.storage.totalBytes)} utilizados • {formatBytes(status.storage.availableBytes)} livres</span>
          <p className="mt-1">Retenção: todas as versões por {policy.retentionRecentHours.toLocaleString('pt-BR')} h, uma diária por {policy.retentionDailyDays.toLocaleString('pt-BR')} dias e uma mensal por {policy.retentionMonthlyMonths.toLocaleString('pt-BR')} meses.</p>
          {storageUsagePercent !== null && <div className="mt-2"><div className="mb-1 flex justify-between"><span>Uso do limite configurado</span><span className="tabular-nums">{storageUsagePercent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${storageUsagePercent}%` }} /></div></div>}
          {storageLimitEstimateDays !== null && <p className="mt-1">{storageLimitEstimateDays === 0 ? 'O uso atual já alcançou o limite configurado; a retenção preservará as versões mínimas obrigatórias.' : `Mantidos o tamanho médio e os intervalos atuais, o limite pode ser alcançado em aproximadamente ${storageLimitEstimateDays.toLocaleString('pt-BR')} dia(s).`}</p>}
        </div>
      </form>
      <SettingsSaveBar
        state={effectiveSaveState}
        errorMessage={saveError}
        onSave={() => saveMutation.mutate()}
        onDiscard={() => { setDraftPolicy(null); setSaveError(''); setSaveState('saved'); }}
      />
    </section>
  );
}
