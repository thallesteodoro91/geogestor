import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Checks, Funnel, Trash, WarningCircle } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ALERT_CATEGORY_LABELS,
  type AlertCategory,
  type AlertSettings,
  type DeadlineAlert
} from '@geogestor/contracts';
import { apiClient } from '../services/apiClient';
import bellIcon from '../assets/magnific-icons/bell_10953632.svg';
import { cn } from '../utils/cn';
import { Modal } from './Modal';
import { FormSelect } from './Form';

type AlertStatusFilter = 'all' | 'unread' | 'read';
type AlertPeriodFilter = 'all' | 'overdue' | 'today' | '7' | '30';
type AlertSummaryResponse = {
  summary: { activeTotal: number; unreadTotal: number };
  preview: DeadlineAlert[];
  settings: AlertSettings;
  generatedAt: string;
};
type AlertPageResponse = {
  items: DeadlineAlert[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadTotal: number;
};

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

function selectClassName() {
  return 'geo-focus-ring min-h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
}

function alertTone(alert: DeadlineAlert) {
  if (alert.severity === 'critical') return {
    badge: 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200',
    dot: 'bg-red-500',
    label: 'Vencido'
  };
  if (alert.severity === 'warning') return {
    badge: 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
    dot: 'bg-amber-500',
    label: 'Hoje'
  };
  return {
    badge: 'bg-sky-50 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200',
    dot: 'bg-sky-500',
    label: 'Em breve'
  };
}

export function UnifiedNotificationCenter({ mobile = false }: { mobile?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<AlertCategory | 'all'>('all');
  const [status, setStatus] = useState<AlertStatusFilter>('all');
  const [period, setPeriod] = useState<AlertPeriodFilter>('all');
  const [page, setPage] = useState(1);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const categoryFilterId = useId();
  const nativePending = useRef(new Set<string>());

  const summaryQuery = useQuery<AlertSummaryResponse>({
    queryKey: ['alertas', 'resumo'],
    queryFn: () => apiClient.get<AlertSummaryResponse>('/api/alertas/resumo?previewLimit=5'),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const alertParams = useMemo(() => new URLSearchParams({
    page: String(page),
    limit: '20',
    status,
    period,
    ...(category === 'all' ? {} : { category })
  }).toString(), [category, page, period, status]);
  const alertsQuery = useQuery<AlertPageResponse>({
    queryKey: ['alertas', 'pagina', alertParams],
    queryFn: () => apiClient.get<AlertPageResponse>(`/api/alertas?${alertParams}`),
    enabled: open,
    staleTime: 15_000
  });

  const items = useMemo(() => alertsQuery.data?.items ?? [], [alertsQuery.data]);
  const unreadCount = summaryQuery.data?.summary.unreadTotal ?? alertsQuery.data?.unreadTotal ?? 0;
  const activeTotal = summaryQuery.data?.summary.activeTotal ?? alertsQuery.data?.total ?? 0;
  const filtered = items;

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['alertas'] }), [queryClient]);
  const updateIds = async (endpoint: string, ids: string[]) => {
    if (!ids.length || isUpdating) return;
    setIsUpdating(true);
    try {
      await apiClient.post(endpoint, { ids });
      await refresh();
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const invalidate = () => void refresh();
    window.addEventListener('geogestor:alerts-invalidated', invalidate);
    let midnightTimer = 0;
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      midnightTimer = window.setTimeout(() => {
        void refresh();
        scheduleMidnightRefresh();
      }, Math.max(1_000, nextDay.getTime() - now.getTime()));
    };
    scheduleMidnightRefresh();
    return () => {
      window.removeEventListener('geogestor:alerts-invalidated', invalidate);
      window.clearTimeout(midnightTimer);
    };
  }, [refresh]);

  useEffect(() => window.electronAPI?.onOpenDeadlineAlert?.((link) => {
    if (typeof link === 'string' && link.startsWith('/')) navigate(link);
  }), [navigate]);

  useEffect(() => {
    if (mobile || !summaryQuery.data?.settings.nativeEnabled || !window.electronAPI?.showDeadlineNotification) return;
    const pending = (summaryQuery.data?.preview ?? []).filter((item) => !item.nativeNotifiedAt && !nativePending.current.has(item.id));
    if (!pending.length) return;
    pending.forEach((item) => nativePending.current.add(item.id));
    void (async () => {
      const completed: string[] = [];
      for (const item of pending) {
        try {
          const shown = await window.electronAPI?.showDeadlineNotification?.({
            id: item.id,
            title: `${item.categoryLabel}: ${item.timingLabel}`,
            body: `${item.title} · ${item.description}`,
            link: item.link
          });
          if (shown === true) completed.push(item.id);
        } catch {
          // Permanece elegível para uma nova tentativa no próximo refetch.
        } finally {
          nativePending.current.delete(item.id);
        }
      }
      if (completed.length) {
        try {
          await apiClient.post('/api/alertas/notificacao-nativa', { ids: completed });
        } catch {
          // Sem confirmação no banco, o alerta continua elegível para nova tentativa.
        }
      }
    })();
  }, [mobile, summaryQuery.data?.preview, summaryQuery.data?.settings.nativeEnabled, summaryQuery.dataUpdatedAt]);

  const openAlert = async (alert: DeadlineAlert) => {
    setOpen(false);
    navigate(alert.link);
    if (alert.readAt) return;
    try {
      await updateIds('/api/alertas/ler', [alert.id]);
    } catch {
      toast.warning('O alerta foi aberto, mas não foi possível marcá-lo como lido.');
    }
  };

  const dismiss = async (ids: string[]) => {
    try {
      await updateIds('/api/alertas/ocultar', ids);
      setUndoIds(ids);
    } catch {
      toast.error('Não foi possível apagar os alertas selecionados.');
    }
  };

  const restore = async () => {
    const ids = [...undoIds];
    try {
      await updateIds('/api/alertas/restaurar', ids);
      setUndoIds([]);
    } catch {
      toast.error('Não foi possível restaurar os alertas.');
    }
  };

  const markRead = async (ids: string[]) => {
    try {
      await updateIds('/api/alertas/ler', ids);
    } catch {
      toast.error('Não foi possível marcar os alertas como lidos.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'relative flex items-center justify-center text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30',
          mobile ? 'rounded-xl p-2' : 'rounded-full p-2.5'
        )}
        aria-label={`Notificações: ${unreadCount} não lida(s)`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <img src={bellIcon} alt="" aria-hidden="true" width={24} height={24} className="h-6 w-6 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className={cn(
            'absolute flex items-center justify-center rounded-full border border-white bg-red-700 px-1 text-[11px] font-bold leading-none text-white dark:border-zinc-900 dark:bg-red-700',
            mobile ? 'right-0.5 top-0.5 h-4 min-w-4' : '-right-1 -top-1 h-5 min-w-5 border-2 dark:border-zinc-950'
          )}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Alertas e prazos"
        maxWidth="max-w-2xl"
        initialFocusId={categoryFilterId}
        ariaDescribedBy={`${categoryFilterId}-summary`}
        contentScrollable={false}
        density="compact"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <p id={`${categoryFilterId}-summary`} aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-bold tabular-nums text-zinc-950 dark:text-white">{unreadCount}</span> não lida{unreadCount === 1 ? '' : 's'}
              <span aria-hidden="true" className="mx-2 text-zinc-400">·</span>
              <span className="tabular-nums">{activeTotal}</span> alerta{activeTotal === 1 ? '' : 's'} ativo{activeTotal === 1 ? '' : 's'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex max-w-full rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900" role="group" aria-label="Status de leitura">
                {([['all', 'Todos'], ['unread', 'Não lidos'], ['read', 'Lidos']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }} aria-pressed={status === value} className={cn('geo-focus-ring min-h-9 rounded-lg px-3 text-xs font-semibold transition-[background-color,color,box-shadow] hover:text-zinc-950 dark:hover:text-white', status === value ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 dark:text-zinc-300')}>{label}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {filtered.some((item) => !item.readAt) ? (
                  <button type="button" disabled={isUpdating} onClick={() => void markRead(filtered.filter((item) => !item.readAt).map((item) => item.id))} className="geo-focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10" aria-label="Marcar os alertas desta página como lidos">
                    <Checks size={16} aria-hidden="true" /> Marcar página como lida
                  </button>
                ) : null}
                {filtered.length ? (
                  <button type="button" disabled={isUpdating} onClick={() => void dismiss(filtered.map((item) => item.id))} className="geo-focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-red-500/10 dark:hover:text-red-200" aria-label="Ocultar os alertas desta página">
                    <Trash size={15} aria-hidden="true" /> Ocultar página
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3" aria-label="Filtros dos alertas">
              <div className="min-w-0">
                <label htmlFor={categoryFilterId} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300"><Funnel size={14} aria-hidden="true" /> Categoria</label>
                <FormSelect id={categoryFilterId} value={category} onChange={(event) => { setCategory(event.target.value as AlertCategory | 'all'); setPage(1); }} className={selectClassName()} wrapperClassName="w-full" aria-label="Filtrar alertas por categoria">
                  <option value="all">Todas as categorias</option>
                  {(Object.entries(ALERT_CATEGORY_LABELS) as Array<[AlertCategory, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </FormSelect>
              </div>
              <div className="min-w-0">
                <label htmlFor={`${categoryFilterId}-period`} className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Prazo</label>
                <FormSelect id={`${categoryFilterId}-period`} value={period} onChange={(event) => { setPeriod(event.target.value as AlertPeriodFilter); setPage(1); }} className={selectClassName()} wrapperClassName="w-full" aria-label="Filtrar alertas por período">
                  <option value="all">Todos os prazos</option><option value="overdue">Vencidos</option><option value="today">Vencem hoje</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option>
                </FormSelect>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain py-4 pr-1" aria-busy={alertsQuery.isLoading || alertsQuery.isFetching}>
              {undoIds.length ? (
                <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <span>{undoIds.length === 1 ? 'Alerta ocultado' : `${undoIds.length} alertas ocultados`}</span>
                  <button type="button" disabled={isUpdating} onClick={() => void restore()} className="geo-focus-ring min-h-9 rounded-lg px-2 font-bold text-indigo-700 hover:bg-white disabled:opacity-50 dark:text-indigo-200 dark:hover:bg-zinc-900">Desfazer</button>
                </div>
              ) : null}
              {alertsQuery.isLoading ? <p role="status" aria-live="polite" className="py-10 text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">Carregando alertas…</p> : null}
              {!alertsQuery.isLoading && !alertsQuery.isError && !filtered.length ? (
                <div className="py-10 text-center">
                  <Checks size={30} aria-hidden="true" className="mx-auto text-emerald-500" />
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">Nenhum alerta neste filtro</p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Ajuste os filtros para ver outros prazos.</p>
                  <button type="button" onClick={() => { setCategory('all'); setStatus('all'); setPeriod('all'); setPage(1); }} className="geo-focus-ring mt-4 min-h-9 rounded-lg px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10">Limpar filtros</button>
                </div>
              ) : null}
              {filtered.map((alert, index) => {
                const tone = alertTone(alert);
                const previous = filtered[index - 1];
                return (
                  <div key={alert.id}>
                    {!previous || previous.severity !== alert.severity ? <h3 className="mb-2 mt-4 first:mt-0 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{alert.severity === 'critical' ? 'Vencidos' : alert.severity === 'warning' ? 'Vencem hoje' : 'Próximos prazos'}</h3> : null}
                    <article className={cn('flex min-w-0 items-start gap-1 rounded-xl border border-zinc-200 bg-white transition-[border-color,background-color] hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700', alert.readAt && 'opacity-70')}>
                      <button type="button" onClick={() => void openAlert(alert)} className="geo-focus-ring flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40" aria-label={`Abrir ${alert.categoryLabel}: ${alert.title}. ${alert.timingLabel}`}>
                        <span aria-hidden="true" className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', alert.readAt ? 'bg-zinc-300 dark:bg-zinc-600' : tone.dot)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{alert.categoryLabel}</span>
                            <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', tone.badge)}>{tone.label}</span>
                          </span>
                          <span className="mt-1 block break-words text-sm font-semibold text-zinc-950 dark:text-white">{alert.title}</span>
                          <span className="mt-0.5 block break-words text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{alert.description}</span>
                          <span className="mt-2 block text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300">Vencimento: {formatDate(alert.dueDate)} <span aria-hidden="true">·</span> {alert.timingLabel}</span>
                        </span>
                        <ArrowUpRight size={17} aria-hidden="true" className="mt-1 shrink-0 text-zinc-500" />
                      </button>
                      <button type="button" disabled={isUpdating} onClick={() => void dismiss([alert.id])} className="geo-focus-ring mr-1 mt-1 flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-200" aria-label={`Ocultar alerta: ${alert.title}`} title="Ocultar alerta">
                        <Trash size={16} aria-hidden="true" />
                      </button>
                    </article>
                  </div>
                );
              })}
              {alertsQuery.isError ? (
                <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-200">
                  <WarningCircle size={17} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p>Não foi possível atualizar os alertas.</p>
                    <button
                      type="button"
                      onClick={() => void alertsQuery.refetch()}
                      className="geo-focus-ring mt-2 min-h-10 rounded-lg bg-red-700 px-3 py-2 font-bold text-white transition-[background-color,box-shadow] hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              ) : null}
          </div>
          {alertsQuery.data && alertsQuery.data.totalPages > 1 ? (
            <nav className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800" aria-label="Paginação dos alertas">
              <button type="button" disabled={page <= 1 || alertsQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} className="geo-focus-ring min-h-9 rounded-lg px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800">Anterior</button>
              <span className="text-center text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">Página {alertsQuery.data.page} de {alertsQuery.data.totalPages}</span>
              <button type="button" disabled={page >= alertsQuery.data.totalPages || alertsQuery.isFetching} onClick={() => setPage((current) => Math.min(alertsQuery.data?.totalPages ?? current, current + 1))} className="geo-focus-ring min-h-9 rounded-lg px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800">Próxima</button>
            </nav>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
