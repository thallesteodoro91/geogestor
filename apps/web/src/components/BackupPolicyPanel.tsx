import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FloppyDisk, HardDrives } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { apiClient } from '../services/apiClient';
import { geoFieldClass, geoPanelClass } from '../utils/geoTheme';

type BackupPolicy = {
  databaseIntervalHours: number;
  completeIntervalDays: number;
  retention: number;
  destinationDirectory: string | null;
  maxStorageBytes: number;
  overdueGraceHours: number;
  runOnStartup: boolean;
  runOnShutdown: boolean;
};

type BackupStatus = {
  policy: BackupPolicy;
  storage: { backupDirectory: string; versions: number; totalBytes: number; availableBytes: number };
  database: { completedAt: string | null; nextAt: string | null; status: 'current' | 'overdue' | 'incomplete' | 'failed' };
  complete: { completedAt: string | null; nextAt: string | null; status: 'current' | 'overdue' | 'incomplete' | 'failed' };
};

const statusLabel = { current: 'Atualizado', overdue: 'Vencido', incomplete: 'Incompleto', failed: 'Com falha' } as const;
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
  const policy = draftPolicy ?? statusQuery.data?.policy ?? null;
  const saveMutation = useMutation({
    mutationFn: () => apiClient.put('/api/sistema/backups/politica', policy),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['backup-status'] }),
        queryClient.invalidateQueries({ queryKey: ['sistema-info'] })
      ]);
      setDraftPolicy(null);
      toast.success('Política de backup salva no banco local.');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (statusQuery.isLoading || !policy) return <p aria-live="polite" className="text-sm text-zinc-500">Carregando política de backup…</p>;
  if (statusQuery.isError) return <p role="alert" className="text-sm text-red-700">Não foi possível consultar os backups. Tente novamente.</p>;
  const status = statusQuery.data!;

  return (
    <section className={`${geoPanelClass} space-y-5 rounded-2xl p-5`} aria-labelledby="backup-policy-title">
      <div>
        <h3 id="backup-policy-title" className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
          <HardDrives aria-hidden="true" size={20} /> Política automática de backups
        </h3>
        <p className="mt-1 text-xs text-zinc-500">Frequência, retenção e destino ficam persistidos no SQLite.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {([['Banco', status.database], ['Completo', status.complete]] as const).map(([label, item]) => (
          <div key={label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm text-zinc-900 dark:text-white">{label}</strong>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold dark:bg-zinc-800">{statusLabel[item.status]}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Último: {formatDate(item.completedAt)}</p>
            <p className="text-xs text-zinc-500">Próximo: {formatDate(item.nextAt)}</p>
          </div>
        ))}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Backup do banco a cada (horas)
            <input name="backup_database_hours" type="number" min="1" max="720" value={policy.databaseIntervalHours} onChange={(event) => setDraftPolicy({ ...policy, databaseIntervalHours: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Backup completo a cada (dias)
            <input name="backup_complete_days" type="number" min="1" max="365" value={policy.completeIntervalDays} onChange={(event) => setDraftPolicy({ ...policy, completeIntervalDays: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Versões mantidas
            <input name="backup_retention" type="number" min="1" max="365" value={policy.retention} onChange={(event) => setDraftPolicy({ ...policy, retention: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Limite de espaço (GB; 0 = sem limite)
            <input name="backup_storage_gb" type="number" min="0" max="10000" value={Math.round(policy.maxStorageBytes / 1024 ** 3)} onChange={(event) => setDraftPolicy({ ...policy, maxStorageBytes: Number(event.target.value) * 1024 ** 3 })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Tolerância para alerta (horas)
            <input name="backup_grace_hours" type="number" min="0" max="720" value={policy.overdueGraceHours} onChange={(event) => setDraftPolicy({ ...policy, overdueGraceHours: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Pasta de destino opcional
            <input name="backup_destination" autoComplete="off" value={policy.destinationDirectory || ''} onChange={(event) => setDraftPolicy({ ...policy, destinationDirectory: event.target.value || null })} placeholder={status.storage.backupDirectory} className={fieldClass} />
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={policy.runOnStartup} onChange={(event) => setDraftPolicy({ ...policy, runOnStartup: event.target.checked })} /> Verificar ao iniciar</label>
          <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={policy.runOnShutdown} onChange={(event) => setDraftPolicy({ ...policy, runOnShutdown: event.target.checked })} /> Fazer backup ao encerrar</label>
        </div>
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <span>{status.storage.versions.toLocaleString('pt-BR')} versão(ões) • {formatBytes(status.storage.totalBytes)} utilizados • {formatBytes(status.storage.availableBytes)} livres</span>
          <button type="submit" disabled={saveMutation.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50">
            <FloppyDisk aria-hidden="true" size={17} /> {saveMutation.isPending ? 'Salvando…' : 'Salvar política'}
          </button>
        </div>
      </form>
    </section>
  );
}
