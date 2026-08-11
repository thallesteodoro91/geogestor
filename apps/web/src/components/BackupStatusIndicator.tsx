import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, FolderOpen, Gear, SpinnerGap } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '../services/apiClient';
import cloudIcon from '../assets/magnific-icons/cloud_5247060.png';
import { Modal } from './Modal';

type BackupSummaryState = 'not_configured' | 'running' | 'failed' | 'pending' | 'protected' | 'created' | 'incomplete';

type BackupStatus = {
  policy: { destinationDirectory: string | null };
  storage: { backupDirectory: string; history: Array<{ completedAt: string; files: number; bytes: number; integrity: string }> };
  activity: { pendingChanges: number; lastChangeAt: string | null; lastProtectedAt: string | null };
  device: { id: string; name: string };
  cloud: { confirmation: 'unavailable' | 'pending' | 'confirmed' | 'failed'; message: string };
  recovery: { configured: boolean; confirmed: boolean; keyId: string | null; state: 'configured' | 'not_confirmed' | 'device_only' };
  restoreTest: { status: 'success' | 'failed'; completedAt: string; errorMessage?: string | null } | null;
  summary: {
    state: BackupSummaryState;
    configured: boolean;
    pendingChanges: number;
    lastBackupAt: string | null;
    integrity: string | null;
    label: string;
    description: string;
  };
};

const stateTone: Record<BackupSummaryState, string> = {
  protected: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  created: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  pending: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  running: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
  failed: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  not_configured: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  incomplete: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
};

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Ainda não realizado';

const formatBytes = (bytes: number) => new Intl.NumberFormat('pt-BR', {
  style: 'unit',
  unit: bytes >= 1024 ** 3 ? 'gigabyte' : 'megabyte',
  maximumFractionDigits: 1
}).format(bytes / (bytes >= 1024 ** 3 ? 1024 ** 3 : 1024 ** 2));

const restoreTestLabel = (value: string | null | undefined) => {
  if (!value) return 'restauração ainda não testada';
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / (24 * 60 * 60 * 1000)));
  return days === 0 ? 'restauração testada hoje' : `restauração testada há ${days} ${days === 1 ? 'dia' : 'dias'}`;
};

export function BackupStatusIndicator({ compact = false }: { compact?: boolean }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [kitPassword, setKitPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [nativeRecovery, setNativeRecovery] = useState<{ configured: boolean; confirmed: boolean; keyId: string } | null>(null);
  const hasSeenBackup = useRef<boolean | null>(null);
  const failureNotified = useRef(false);
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => apiClient.get<BackupStatus>('/api/sistema/backups/status'),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false
  });
  const backupMutation = useMutation({
    mutationFn: () => apiClient.post('/api/sistema/backup-completo', undefined, { timeoutMs: 15 * 60_000 }),
    onSuccess: async () => {
      hasSeenBackup.current = true;
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      toast.success('Backup criado e verificado na pasta configurada.');
    },
    onError: (error: Error) => toast.error(`${error.message} Verifique a pasta de destino e tente novamente.`)
  });
  const testRestoreMutation = useMutation({
    mutationFn: () => apiClient.post('/api/sistema/backups/testar-restauracao', undefined, { timeoutMs: 30 * 60_000 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      toast.success('Restauração testada em uma área isolada. Seus dados em uso não foram alterados.');
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const revealCodeMutation = useMutation({
    mutationFn: () => apiClient.post<{ recoveryCode: string }>('/api/sistema/backups/recuperacao/codigo', { password: adminPassword }),
    onSuccess: ({ recoveryCode: code }) => setRecoveryCode(code),
    onError: (error: Error) => toast.error(error.message)
  });
  const exportKitMutation = useMutation({
    mutationFn: async () => {
      const kit = await apiClient.post<Record<string, unknown>>('/api/sistema/backups/recuperacao/kit', { password: adminPassword, kitPassword }, { timeoutMs: 60_000 });
      if (!window.electronAPI?.saveBackupRecoveryKit) throw new Error('A exportação do kit está disponível no aplicativo desktop.');
      const savedPath = await window.electronAPI.saveBackupRecoveryKit(kit);
      if (!savedPath) return null;
      const confirmed = await window.electronAPI.confirmBackupRecovery?.();
      if (confirmed) setNativeRecovery(confirmed);
      return savedPath;
    },
    onSuccess: (savedPath) => {
      if (savedPath) toast.success('Kit protegido por senha salvo. Guarde-o fora deste computador.');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const status = statusQuery.data;
  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    window.addEventListener('geogestor:backup-invalidated', invalidate);
    return () => window.removeEventListener('geogestor:backup-invalidated', invalidate);
  }, [queryClient]);
  useEffect(() => {
    if (!open || !window.electronAPI?.getBackupRecoveryStatus) return;
    void window.electronAPI.getBackupRecoveryStatus().then(setNativeRecovery).catch(() => undefined);
  }, [open]);
  const state = status?.summary.state || 'incomplete';
  const label = statusQuery.isError ? 'Status do backup indisponível' : status?.summary.label || 'Consultando backup…';
  const showSpinner = statusQuery.isLoading || state === 'running' || backupMutation.isPending;
  const isBackingUp = state === 'running' || backupMutation.isPending;
  const lastBackupLabel = status?.summary.lastBackupAt
    ? `Último: ${formatDate(status.summary.lastBackupAt)}`
    : 'Nenhum backup realizado';
  useEffect(() => {
    if (compact || !status) return;
    const hasBackup = Boolean(status.summary.lastBackupAt);
    if (hasSeenBackup.current === null) hasSeenBackup.current = hasBackup;
    else if (!hasSeenBackup.current && hasBackup) {
      hasSeenBackup.current = true;
      toast.success('Primeiro backup criado e verificado com sucesso.');
    }
    if (state === 'failed' && !failureNotified.current) {
      failureNotified.current = true;
      toast.error('O backup automático precisa de atenção. Abra o indicador para ver como corrigir.');
    } else if (state !== 'failed') {
      failureNotified.current = false;
    }
  }, [compact, state, status]);
  const openBackupDirectory = async () => {
    const directory = status?.policy.destinationDirectory;
    if (!directory || !window.electronAPI?.openBackupDirectory) return;
    try {
      await window.electronAPI.openBackupDirectory(directory);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a pasta de backups.');
    }
  };
  const copyText = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };
  const recoveryConfirmed = nativeRecovery?.confirmed ?? status?.recovery.confirmed ?? false;

  return (
    <>
      <div className="group/backup relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Status do backup: ${label}. ${lastBackupLabel}`}
          aria-describedby={tooltipId}
          className="geo-focus-ring motion-fast motion-gpu flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-zinc-500 outline-none hover:bg-zinc-100 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <img
            src={cloudIcon}
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className={`h-6 w-6 shrink-0 object-contain ${isBackingUp ? 'animate-pulse motion-reduce:animate-none' : ''}`}
          />
        </button>

        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-[100] w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-zinc-800 opacity-0 shadow-xl transition-[opacity,transform,visibility] duration-150 invisible group-hover/backup:visible group-hover/backup:opacity-100 group-focus-within/backup:visible group-focus-within/backup:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${compact ? 'right-0 top-full mt-2 -translate-y-1 group-hover/backup:translate-y-0 group-focus-within/backup:translate-y-0' : 'bottom-full left-0 mb-2 translate-y-1 group-hover/backup:translate-y-0 group-focus-within/backup:translate-y-0'}`}
        >
          <strong className="block text-xs font-semibold">{label}</strong>
          <span className="mt-0.5 block text-[11px] text-zinc-500 dark:text-zinc-400">{lastBackupLabel}</span>
          {status?.summary.description && (
            <span className="mt-1.5 block text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
              {status.summary.description}
            </span>
          )}
        </div>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Proteção dos dados" maxWidth="max-w-lg" closeDisabled={backupMutation.isPending}>
        {statusQuery.isError ? (
          <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <p>Não foi possível consultar o estado do backup.</p>
            <button type="button" onClick={() => void statusQuery.refetch()} className="geo-focus-ring min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950">Tentar novamente</button>
          </div>
        ) : status ? (
          <div className="space-y-5">
            <div role="status" aria-live="polite" className={`rounded-xl border p-4 ${stateTone[state]}`}>
              <div className="flex items-start gap-3">
                {showSpinner ? <SpinnerGap aria-hidden="true" className="mt-0.5 h-6 w-6 animate-spin motion-reduce:animate-none" /> : <Cloud aria-hidden="true" className="mt-0.5 h-6 w-6" />}
                <div className="min-w-0"><strong className="block">{status.summary.label}</strong><p className="mt-1 text-sm opacity-85">{status.summary.description}</p></div>
              </div>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Último backup verificado</dt><dd className="mt-1 font-semibold tabular-nums">{formatDate(status.summary.lastBackupAt)}</dd></div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Alterações pendentes</dt><dd className="mt-1 font-semibold tabular-nums">{status.activity.pendingChanges.toLocaleString('pt-BR')}</dd></div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Dispositivo</dt><dd className="mt-1 break-words font-semibold">{status.device.name}</dd></div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Integridade</dt><dd className="mt-1 font-semibold">{status.summary.integrity === 'verified' ? 'Checksums verificados' : 'Aguardando primeiro backup completo'}</dd></div>
            </dl>

            <section aria-labelledby="emergency-recovery-title" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 id="emergency-recovery-title" className="font-semibold">Recuperação de emergência</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {recoveryConfirmed
                  ? 'Configurada. Os novos backups podem ser recuperados em outro computador.'
                  : 'Código ainda não guardado. Até confirmar, não considere o backup preparado para perda total.'}
              </p>
              {!recoveryConfirmed && (
                <div className="mt-3 grid gap-2">
                  <label htmlFor="backup-admin-password" className="text-xs font-semibold">Senha administrativa</label>
                  <input id="backup-admin-password" name="backup_admin_password" type="password" autoComplete="current-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700" />
                  <button type="button" onClick={() => revealCodeMutation.mutate()} disabled={!adminPassword || revealCodeMutation.isPending} className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Mostrar código</button>
                  {recoveryCode && (
                    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                      <code className="block break-all text-xs font-semibold">{recoveryCode}</code>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void copyText(recoveryCode, 'Código copiado. Guarde-o em local seguro.')} className="geo-focus-ring min-h-10 rounded-lg border border-zinc-300 px-3 text-xs font-semibold dark:border-zinc-700">Copiar código</button>
                        <button type="button" onClick={() => void window.electronAPI?.confirmBackupRecovery?.().then(setNativeRecovery)} className="geo-focus-ring min-h-10 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800">Já guardei o código</button>
                      </div>
                    </div>
                  )}
                  <label htmlFor="backup-kit-password" className="mt-1 text-xs font-semibold">Senha do kit (mínimo de 12 caracteres)</label>
                  <input id="backup-kit-password" name="backup_kit_password" type="password" autoComplete="new-password" value={kitPassword} onChange={(event) => setKitPassword(event.target.value)} className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700" />
                  <button type="button" onClick={() => exportKitMutation.mutate()} disabled={!adminPassword || kitPassword.length < 12 || exportKitMutation.isPending} className="geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">{exportKitMutation.isPending ? 'Protegendo kit…' : 'Exportar kit de recuperação'}</button>
                </div>
              )}
            </section>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Destino</span>
              <code className="mt-1 block break-all rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">{status.policy.destinationDirectory || 'Pasta externa ainda não configurada'}</code>
              <div className="mt-2 flex flex-wrap gap-2">
                {status.policy.destinationDirectory && <button type="button" onClick={() => void copyText(status.policy.destinationDirectory!, 'Caminho copiado.')} className="geo-focus-ring min-h-10 rounded-lg border border-zinc-300 px-3 text-xs font-semibold dark:border-zinc-700">Copiar caminho</button>}
                <button type="button" onClick={() => void copyText(status.device.id, 'Identificação do dispositivo copiada.')} className="geo-focus-ring min-h-10 rounded-lg border border-zinc-300 px-3 text-xs font-semibold dark:border-zinc-700">Copiar identificação</button>
              </div>
            </div>

            {status.storage.history[0] && <p className="text-xs text-zinc-500">Última versão: {status.storage.history[0].files.toLocaleString('pt-BR')} {status.storage.history[0].files === 1 ? 'arquivo' : 'arquivos'} · {formatBytes(status.storage.history[0].bytes)} · {restoreTestLabel(status.restoreTest?.status === 'success' ? status.restoreTest.completedAt : null)}</p>}

            <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
              <Link to="/configuracoes?secao=backups" onClick={() => setOpen(false)} className="geo-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"><Gear aria-hidden="true" size={18} /> Configurações</Link>
              {status.policy.destinationDirectory && window.electronAPI?.openBackupDirectory && <button type="button" onClick={() => void openBackupDirectory()} className="geo-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"><FolderOpen aria-hidden="true" size={18} /> Abrir pasta</button>}
              <button type="button" onClick={() => testRestoreMutation.mutate()} disabled={testRestoreMutation.isPending} className="geo-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">{testRestoreMutation.isPending ? 'Testando restauração…' : 'Testar restauração agora'}</button>
              <button type="button" onClick={() => backupMutation.mutate()} disabled={backupMutation.isPending} className="geo-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
                {backupMutation.isPending ? <SpinnerGap aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <Cloud aria-hidden="true" size={18} />}
                {backupMutation.isPending ? 'Criando backup…' : 'Fazer backup agora'}
              </button>
            </div>
          </div>
        ) : <p aria-live="polite" className="text-sm text-zinc-500">Consultando o estado do backup…</p>}
      </Modal>
    </>
  );
}
