import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Checks, Trash, WarningCircle } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ALERT_CATEGORY_LABELS,
  type AlertCategory,
  type DeadlineAlert,
  type DeadlineAlertResponse
} from '@geogestor/contracts';
import { apiClient } from '../services/apiClient';
import bellIcon from '../assets/magnific-icons/bell_10953632.svg';
import { cn } from '../utils/cn';
import { Modal } from './Modal';

type AlertStatusFilter = 'all' | 'unread' | 'read';
type AlertPeriodFilter = 'all' | 'overdue' | 'today' | '7' | '30';

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

function selectClassName() {
  return 'geo-focus-ring min-h-9 min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200';
}

function matchesPeriod(alert: DeadlineAlert, period: AlertPeriodFilter) {
  if (period === 'all') return true;
  if (period === 'overdue') return alert.daysUntilDue < 0;
  if (period === 'today') return alert.daysUntilDue === 0;
  return alert.daysUntilDue >= 0 && alert.daysUntilDue <= Number(period);
}

function alertTone(alert: DeadlineAlert) {
  if (alert.severity === 'critical') return {
    border: 'border-red-200 bg-red-50/80 dark:border-red-500/20 dark:bg-red-500/10',
    title: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500'
  };
  if (alert.severity === 'warning') return {
    border: 'border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10',
    title: 'text-amber-800 dark:text-amber-200',
    dot: 'bg-amber-500'
  };
  return {
    border: 'border-sky-200 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10',
    title: 'text-sky-800 dark:text-sky-200',
    dot: 'bg-sky-500'
  };
}

export function UnifiedNotificationCenter({ mobile = false }: { mobile?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<AlertCategory | 'all'>('all');
  const [status, setStatus] = useState<AlertStatusFilter>('all');
  const [period, setPeriod] = useState<AlertPeriodFilter>('all');
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const categoryFilterId = useId();
  const nativePending = useRef(new Set<string>());

  const alertsQuery = useQuery<DeadlineAlertResponse>({
    queryKey: ['alertas'],
    queryFn: () => apiClient.get<DeadlineAlertResponse>('/api/alertas'),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const items = useMemo(() => alertsQuery.data?.items ?? [], [alertsQuery.data]);
  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);
  const filtered = useMemo(() => items.filter((item) => (
    (category === 'all' || item.category === category)
    && (status === 'all' || (status === 'unread' ? !item.readAt : Boolean(item.readAt)))
    && matchesPeriod(item, period)
  )), [category, items, period, status]);

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['alertas'] }), [queryClient]);
  const updateIds = async (endpoint: string, ids: string[]) => {
    if (!ids.length) return;
    await apiClient.post(endpoint, { ids });
    await refresh();
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
    if (mobile || !alertsQuery.data?.settings.nativeEnabled || !window.electronAPI?.showDeadlineNotification) return;
    const pending = items.filter((item) => !item.nativeNotifiedAt && !nativePending.current.has(item.id));
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
  }, [alertsQuery.data?.settings.nativeEnabled, alertsQuery.dataUpdatedAt, items, mobile]);

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
            'absolute flex items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[11px] font-bold leading-none text-white dark:border-zinc-900',
            mobile ? 'right-0.5 top-0.5 h-4 min-w-4' : '-right-1 -top-1 h-5 min-w-5 border-2 dark:border-zinc-950'
          )}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Alertas e prazos"
        maxWidth={mobile ? 'max-w-sm' : 'max-w-lg'}
        initialFocusId={categoryFilterId}
        ariaDescribedBy={`${categoryFilterId}-summary`}
      >
            <header className="border-b border-zinc-100 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p id={`${categoryFilterId}-summary`} aria-live="polite" className="mt-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                    {unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Tudo lido'} · {items.length} ativa{items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {filtered.some((item) => !item.readAt) ? (
                    <button type="button" onClick={() => void markRead(filtered.filter((item) => !item.readAt).map((item) => item.id))} className="geo-focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10" aria-label="Marcar alertas filtrados como lidos">
                      <Checks size={14} aria-hidden="true" />Ler
                    </button>
                  ) : null}
                  {filtered.length ? (
                    <button type="button" onClick={() => void dismiss(filtered.map((item) => item.id))} className="geo-focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10" aria-label="Apagar alertas filtrados">
                      <Trash size={14} aria-hidden="true" />Apagar
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Filtros dos alertas">
                <select id={categoryFilterId} value={category} onChange={(event) => setCategory(event.target.value as AlertCategory | 'all')} className={selectClassName()} aria-label="Filtrar alertas por categoria">
                  <option value="all">Todas</option>
                  {(Object.entries(ALERT_CATEGORY_LABELS) as Array<[AlertCategory, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={status} onChange={(event) => setStatus(event.target.value as AlertStatusFilter)} className={selectClassName()} aria-label="Filtrar alertas por leitura">
                  <option value="all">Todas</option><option value="unread">Não lidas</option><option value="read">Lidas</option>
                </select>
                <select value={period} onChange={(event) => setPeriod(event.target.value as AlertPeriodFilter)} className={selectClassName()} aria-label="Filtrar alertas por período">
                  <option value="all">Todo período</option><option value="overdue">Vencidos</option><option value="today">Hoje</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option>
                </select>
              </div>
            </header>

            <div className="max-h-[26rem] space-y-2 overflow-y-auto overscroll-contain p-3" aria-busy={alertsQuery.isLoading || alertsQuery.isFetching}>
              {undoIds.length ? (
                <div role="status" className="flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <span>{undoIds.length === 1 ? 'Alerta apagado' : `${undoIds.length} alertas apagados`}</span>
                  <button type="button" onClick={() => void restore()} className="geo-focus-ring min-h-8 rounded-lg px-2 font-bold text-indigo-700 hover:bg-white dark:text-indigo-200 dark:hover:bg-zinc-900">Desfazer</button>
                </div>
              ) : null}
              {alertsQuery.isLoading ? <p role="status" aria-live="polite" className="py-10 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">Carregando alertas…</p> : null}
              {!alertsQuery.isLoading && !alertsQuery.isError && !filtered.length ? (
                <div className="py-10 text-center">
                  <Checks size={30} aria-hidden="true" className="mx-auto text-emerald-500" />
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">Nenhum alerta neste filtro</p>
                  <p className="mt-1 text-xs text-zinc-500">Os prazos aparecerão aqui conforme suas configurações.</p>
                </div>
              ) : null}
              {filtered.map((alert) => {
                const tone = alertTone(alert);
                return (
                  <article key={alert.id} className={cn('group flex items-start gap-1 rounded-xl border', tone.border, alert.readAt && 'opacity-75')}>
                    <button type="button" onClick={() => void openAlert(alert)} className="geo-focus-ring flex min-w-0 flex-1 items-start gap-2 rounded-xl p-3 text-left hover:bg-white/60 dark:hover:bg-zinc-950/30" aria-label={`${alert.categoryLabel}: ${alert.title}. ${alert.timingLabel}`}>
                      <span aria-hidden="true" className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', alert.readAt ? 'bg-zinc-300 dark:bg-zinc-600' : tone.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('text-[10px] font-bold uppercase tracking-wide', tone.title)}>{alert.categoryLabel}</span>
                          <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200">{alert.timingLabel}</span>
                        </span>
                        <span className="mt-1 block break-words text-xs font-bold text-zinc-950 dark:text-white">{alert.title}</span>
                        <span className="mt-0.5 block break-words text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">{alert.description}</span>
                        <span className="mt-1 block text-[10px] font-semibold tabular-nums text-zinc-500">Vencimento: {formatDate(alert.dueDate)}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => void dismiss([alert.id])} className="geo-focus-ring mr-1 mt-1 flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-500/20 dark:hover:text-red-200" aria-label={`Apagar alerta: ${alert.title}`} title="Apagar alerta">
                      <Trash size={15} aria-hidden="true" />
                    </button>
                  </article>
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
      </Modal>
    </>
  );
}
