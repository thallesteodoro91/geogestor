import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { apiFetch } from '../../services/apiClient';
import { primarySmallActionButtonClass } from '../../utils/actionStyles';

interface CacheStatus {
  activeFiles: number;
  activeBytes: number;
  orphanCount: number;
  orphanBytes: number;
  removedFiles: number;
}

const formatBytes = (bytes: number) => new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1
}).format(bytes >= 1024 * 1024 ? bytes / (1024 * 1024) : bytes / 1024)
  + (bytes >= 1024 * 1024 ? ' MB' : ' KB');

export function GeospatialCacheSettingsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<CacheStatus>({
    queryKey: ['geospatial-cache-status'],
    queryFn: async () => {
      const response = await apiFetch('/api/arquivos/geospatial/cache/maintenance');
      if (!response.ok) throw new Error('Não foi possível consultar o cache geoespacial.');
      return response.json();
    }
  });
  const cleanup = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/arquivos/geospatial/cache/orphans', { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível limpar o cache geoespacial.');
      return result as CacheStatus;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['geospatial-cache-status'] });
      toast.success(`${result.removedFiles} arquivo(s) órfão(s) removido(s).`);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  return (
    <section aria-labelledby="geospatial-cache-title" className="geo-card space-y-5 p-5">
      <div>
        <h2 id="geospatial-cache-title" className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white"><Database aria-hidden="true" size={20} /> Dados e armazenamento</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Cache geoespacial usado para exibir os levantamentos. Os arquivos originais permanecem preservados.</p>
      </div>
      {isLoading && <p className="text-sm text-zinc-500" aria-live="polite">Consultando cache…</p>}
      {isError && <div role="alert" className="flex items-center gap-3 text-sm text-red-700 dark:text-red-300">Não foi possível consultar o cache. <button type="button" onClick={() => void refetch()} className="geo-focus-ring underline">Tentar novamente</button></div>}
      {data && <>
        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Arquivos em uso</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{data.activeFiles.toLocaleString('pt-BR')}</dd></div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Espaço em uso</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatBytes(data.activeBytes)}</dd></div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Arquivos órfãos</dt><dd className="mt-1"><span className="block text-xl font-semibold tabular-nums">{data.orphanCount.toLocaleString('pt-BR')}</span><span className="block text-xs text-text-secondary">{formatBytes(data.orphanBytes)}</span></dd></div>
        </dl>
        <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">A limpeza remove somente cópias de cache sem vínculo com camadas ativas.</p>
          <button type="button" disabled={data.orphanCount === 0 || cleanup.isPending} onClick={() => {
            if (window.confirm(`Remover ${data.orphanCount} arquivo(s) órfão(s) do cache (${formatBytes(data.orphanBytes)})? Os documentos originais e as camadas ativas serão preservados.`)) cleanup.mutate();
          }} className={`${primarySmallActionButtonClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}><Trash aria-hidden="true" size={16} /> {cleanup.isPending ? 'Limpando…' : 'Limpar arquivos órfãos'}</button>
        </div>
      </>}
    </section>
  );
}
