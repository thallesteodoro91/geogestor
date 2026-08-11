import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowCounterClockwise, FolderOpen, HardDrives, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { apiClient } from '../services/apiClient';
import { geoFieldClass, geoPanelClass } from '../utils/geoTheme';
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
};

type BackupStatus = {
  policy: BackupPolicy;
  storage: {
    backupDirectory: string;
    versions: number;
    totalBytes: number;
    availableBytes: number;
    history: Array<{ directory: string; type: 'database' | 'complete'; createdAt: string; completedAt: string; files: number; bytes: number; encrypted: boolean; integrity: 'verified' | 'legacy-unverified'; credentialsExcluded: boolean; restoreTestedAt: string | null }>;
  };
  database: BackupOperationStatus;
  complete: BackupOperationStatus;
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
  runOnShutdown: true
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

const statusLabel = { current: 'Atualizado', overdue: 'Vencido', incomplete: 'Incompleto', failed: 'Com falha', running: 'Em andamento…' } as const;
const statusTone = {
  current: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  running: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  overdue: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  incomplete: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
} as const;
const fieldClass = `${geoFieldClass} mt-1.5 w-full px-3 py-2 text-sm`;
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

  return (
    <section className={`${geoPanelClass} space-y-5 rounded-2xl p-5`} aria-labelledby="backup-policy-title">
      <div>
        <h3 id="backup-policy-title" className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
          <HardDrives aria-hidden="true" size={20} /> Política automática de backups
        </h3>
        <button type="button" onClick={() => {
          if (window.confirm('Restaurar os padrões desta seção?\n\nAutomático: ativado\nConsolidação: 5 minutos\nBanco: a cada 24 horas\nCompleto: a cada 7 dias\nRetenção: 24 horas, 30 dias e 12 meses\nBackup ao encerrar: ativado')) {
            setDraftPolicy({ ...DEFAULT_BACKUP_POLICY });
            setSaveError('');
            setSaveState('dirty');
          }
        }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
          <ArrowCounterClockwise aria-hidden="true" size={16} /> Restaurar padrões
        </button>
        <p className="mt-1 text-xs text-zinc-500">Alterações recentes são consolidadas em segundo plano e protegidas sem interromper o uso.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {([['Banco', status.database], ['Completo', status.complete]] as const).map(([label, item]) => (
          <div key={label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm text-zinc-900 dark:text-white">{label}</strong>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone[item.status]}`}>{statusLabel[item.status]}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Último: {formatDate(item.completedAt)}</p>
            {item.attemptedAt && item.attemptedAt !== item.completedAt && <p className="text-xs text-zinc-500">Última tentativa: {formatDate(item.attemptedAt)}</p>}
            <p className="text-xs text-zinc-500">Próximo: {formatDate(item.nextAt)}</p>
            {item.totalBytes !== null && <p className="text-xs text-zinc-500">{formatBytes(item.totalBytes)} • {(item.totalFiles || 0).toLocaleString('pt-BR')} arquivo(s){item.durationMs !== null ? ` • ${(item.durationMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : ''}</p>}
            {item.error && <p role="alert" className="mt-2 break-words rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">Falha: {item.error}. Verifique o destino e tente novamente.</p>}
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Histórico recente</h4>
        {status.storage.history.length === 0 ? (
          <p className="mt-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">Nenhuma versão concluída encontrada nesta pasta.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-950"><tr><th scope="col" className="px-3 py-2">Data</th><th scope="col" className="px-3 py-2">Tipo</th><th scope="col" className="px-3 py-2">Conteúdo</th><th scope="col" className="px-3 py-2">Integridade</th><th scope="col" className="px-3 py-2">Restauração</th></tr></thead>
              <tbody>{status.storage.history.map((backup) => <tr key={backup.directory} className="border-t border-zinc-200 dark:border-zinc-800"><td className="px-3 py-2 tabular-nums">{formatDate(backup.completedAt)}</td><td className="px-3 py-2">{backup.type === 'complete' ? 'Completo' : 'Banco'}</td><td className="px-3 py-2 tabular-nums">{formatBytes(backup.bytes)} • {backup.files.toLocaleString('pt-BR')} arquivo(s)</td><td className="px-3 py-2">{backup.integrity === 'verified' ? 'Checksum verificado' : 'Legado sem checksum'}{backup.credentialsExcluded ? ' • sem credenciais' : ''}</td><td className="px-3 py-2">{backup.restoreTestedAt ? `Testada em ${formatDate(backup.restoreTestedAt)}` : 'Ainda não testada'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <input type="checkbox" checked={policy.automaticEnabled} onChange={(event) => setDraftPolicy({ ...policy, automaticEnabled: event.target.checked })} />
          <span><strong className="block text-sm">Backup automático</strong><span className="text-xs text-zinc-500">Protege as alterações depois do intervalo de consolidação.</span></span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Consolidar alterações após (minutos)
            <NumericInput name="backup_debounce_minutes" min="1" max="1440" value={policy.changeDebounceMinutes} onChange={(event) => setDraftPolicy({ ...policy, changeDebounceMinutes: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Backup do banco a cada (horas)
            <NumericInput name="backup_database_hours" min="1" max="720" value={policy.databaseIntervalHours} onChange={(event) => setDraftPolicy({ ...policy, databaseIntervalHours: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Backup completo a cada (dias)
            <NumericInput name="backup_complete_days" min="1" max="365" value={policy.completeIntervalDays} onChange={(event) => setDraftPolicy({ ...policy, completeIntervalDays: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Mínimo de versões mantidas
            <NumericInput name="backup_retention" min="1" max="365" value={policy.retention} onChange={(event) => setDraftPolicy({ ...policy, retention: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Manter versões recentes (horas)
            <NumericInput name="backup_recent_hours" min="1" max="720" value={policy.retentionRecentHours} onChange={(event) => setDraftPolicy({ ...policy, retentionRecentHours: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Uma versão diária por (dias)
            <NumericInput name="backup_daily_days" min="1" max="3650" value={policy.retentionDailyDays} onChange={(event) => setDraftPolicy({ ...policy, retentionDailyDays: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Uma versão mensal por (meses)
            <NumericInput name="backup_monthly_months" min="1" max="120" value={policy.retentionMonthlyMonths} onChange={(event) => setDraftPolicy({ ...policy, retentionMonthlyMonths: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Limite de espaço (GB; 0 = sem limite)
            <NumericInput name="backup_storage_gb" min="0" max="10000" value={Math.round(policy.maxStorageBytes / 1024 ** 3)} onChange={(event) => setDraftPolicy({ ...policy, maxStorageBytes: Number(event.target.value) * 1024 ** 3 })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Tolerância para alerta (horas)
            <NumericInput name="backup_grace_hours" min="0" max="720" value={policy.overdueGraceHours} onChange={(event) => setDraftPolicy({ ...policy, overdueGraceHours: Number(event.target.value) })} className={fieldClass} />
          </label>
          <div className="text-sm font-medium sm:col-span-2 lg:col-span-3">
            <label htmlFor="backup-destination">Pasta de destino opcional</label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input id="backup-destination" name="backup_destination" autoComplete="off" value={policy.destinationDirectory || ''} onChange={(event) => setDraftPolicy({ ...policy, destinationDirectory: event.target.value || null })} placeholder={status.storage.backupDirectory} className={`${geoFieldClass} min-h-11 flex-1 px-3 py-2 text-sm`} />
              <button type="button" onClick={() => void chooseDestination()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><FolderOpen aria-hidden="true" size={17} /> Escolher pasta</button>
              <button type="button" onClick={() => testDestinationMutation.mutate()} disabled={!policy.destinationDirectory || testDestinationMutation.isPending} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">{testDestinationMutation.isPending ? 'Testando…' : 'Testar destino'}</button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={policy.runOnStartup} onChange={(event) => setDraftPolicy({ ...policy, runOnStartup: event.target.checked })} /> Verificar ao iniciar</label>
          <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={policy.runOnShutdown} onChange={(event) => setDraftPolicy({ ...policy, runOnShutdown: event.target.checked })} /> Fazer backup ao encerrar</label>
        </div>
        <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
          <span>{status.storage.versions.toLocaleString('pt-BR')} versão(ões) • {formatBytes(status.storage.totalBytes)} utilizados • {formatBytes(status.storage.availableBytes)} livres</span>
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
