import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { Checks, List, Trash } from '@phosphor-icons/react';
import lightModeIcon from '../assets/magnific-icons/brightness_3649294.svg';
import darkModeIcon from '../assets/magnific-icons/night-mode_5510495.svg';
import bellIcon from '../assets/magnific-icons/bell_10953632.svg';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { cn } from '../utils/cn';

interface LayoutProps {
  children: ReactNode;
  contentClassName?: string;
  compactBottom?: boolean;
  printContentOnly?: boolean;
}

const LayoutShellContext = createContext(false);

interface ProjetoNotificacao {
  id: string;
  nome: string;
  status: string;
  dataEntrega?: string | null;
}

interface AppNotification {
  id: string;
  titulo: string;
  desc: string;
  link: string;
  type: 'warning' | 'info' | 'danger';
}

interface NotificationPanelProps {
  notifications: AppNotification[];
  readIds: ReadonlySet<string>;
  unreadCount: number;
  undoCount: number;
  className?: string;
  onMarkAllRead: () => void;
  onDeleteAll: () => void;
  onOpen: (notification: AppNotification) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
}

const CLEARED_NOTIFICATIONS_STORAGE_KEY = 'geogestor_cleared_notifications';
const READ_NOTIFICATIONS_STORAGE_KEY = 'geogestor_read_notifications';

function readStoredNotificationIds(key: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function NotificationPanel({
  notifications,
  readIds,
  unreadCount,
  undoCount,
  className,
  onMarkAllRead,
  onDeleteAll,
  onOpen,
  onDelete,
  onUndoDelete,
}: NotificationPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      role="dialog"
      aria-label="Central de notificações"
      className={cn(
        'absolute right-0 z-50 mt-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="text-xs font-bold text-zinc-900 dark:text-white">Notificações</p>
          <p aria-live="polite" className="mt-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            {unreadCount === 0
              ? 'Nenhuma notificação não lida'
              : `${unreadCount} ${unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'}`}
          </p>
        </div>

        {notifications.length > 0 ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="geo-focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-brand-primary-700 transition-colors hover:bg-brand-primary-50 hover:text-brand-primary-900 dark:text-brand-primary-200 dark:hover:bg-brand-primary-400/10 dark:hover:text-brand-primary-100"
                aria-label="Marcar todas as notificações como lidas"
                title="Marcar todas como lidas"
              >
                <Checks size={13} aria-hidden="true" />
                Ler tudo
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDeleteAll}
              className="geo-focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
              aria-label="Apagar todas as notificações"
              title="Apagar todas as notificações"
            >
              <Trash size={13} aria-hidden="true" />
              Apagar tudo
            </button>
          </div>
        ) : null}
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto overscroll-contain scrollbar-none">
        {undoCount > 0 ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-zinc-100 px-3 py-2 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <span>{undoCount === 1 ? 'Notificação apagada' : `${undoCount} notificações apagadas`}</span>
            <button
              type="button"
              onClick={onUndoDelete}
              className="geo-focus-ring min-h-8 rounded-lg px-2 font-bold text-brand-primary-700 hover:bg-white dark:text-brand-primary-200 dark:hover:bg-zinc-900"
            >
              Desfazer
            </button>
          </div>
        ) : null}
        {notifications.length === 0 ? (
          <p className="py-6 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            Nenhuma notificação
          </p>
        ) : (
          notifications.map((notification) => {
            const unread = !readIds.has(notification.id);
            return (
              <article
                key={notification.id}
                data-unread={unread}
                className={cn(
                  'group flex items-start gap-1 rounded-xl border transition-colors',
                  unread
                    ? 'border-brand-primary-200/80 bg-brand-primary-50/70 dark:border-brand-primary-300/20 dark:bg-brand-primary-400/10'
                    : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950',
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className="geo-focus-ring flex min-w-0 flex-1 items-start gap-2 rounded-xl p-2.5 text-left hover:bg-zinc-100/80 dark:hover:bg-zinc-900/70"
                  aria-label={`${notification.titulo}: ${notification.desc}`}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1 h-2 w-2 shrink-0 rounded-full',
                      unread
                        ? notification.type === 'danger'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                        : 'bg-transparent',
                    )}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-[11px]',
                        unread ? 'font-bold' : 'font-semibold',
                        notification.type === 'danger'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {notification.titulo}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium leading-normal text-zinc-600 line-clamp-3 dark:text-zinc-400">
                      {notification.desc}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(notification.id)}
                  className="geo-focus-ring mr-1 mt-1 flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 opacity-70 transition-colors hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={`Apagar notificação: ${notification.titulo}`}
                  title="Apagar notificação"
                >
                  <Trash size={14} aria-hidden="true" />
                </button>
              </article>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

function LayoutShell({
  children,
  contentClassName = 'max-w-[1400px]',
  compactBottom = false,
  printContentOnly = false
}: LayoutProps) {
  const navigate = useNavigate();
  const storedAlertDays = Number(localStorage.getItem('geogestor_alerta_dias') || '7');
  const alertDays = Number.isFinite(storedAlertDays) && storedAlertDays >= 0 ? storedAlertDays : 7;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const { data: projetos = [] } = useQuery<ProjetoNotificacao[]>({
    queryKey: ['projetos-prazos', alertDays],
    queryFn: () => apiClient.get<ProjetoNotificacao[]>(`/api/projetos/deadlines?days=${alertDays}`),
    staleTime: 60_000,
  });

  const [clearedNotifications, setClearedNotifications] = useState<string[]>(
    () => readStoredNotificationIds(CLEARED_NOTIFICATIONS_STORAGE_KEY),
  );
  const [readNotifications, setReadNotifications] = useState<string[]>(
    () => readStoredNotificationIds(READ_NOTIFICATIONS_STORAGE_KEY),
  );
  const [lastDeletedNotificationIds, setLastDeletedNotificationIds] = useState<string[]>([]);

  const activeNotifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: AppNotification[] = [];

    projetos.forEach(p => {
      const normalizedStatus = p.status
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (
        !p.dataEntrega
        || ['concluido', 'finalizado', 'arquivado', 'cancelado'].includes(normalizedStatus)
      ) return;

      const deliveryDate = new Date(`${p.dataEntrega}T00:00:00`);
      if (Number.isNaN(deliveryDate.getTime())) return;
      const diffTime = deliveryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const id = `proj-deadline-${p.id}-${p.dataEntrega}-${diffDays < 0 ? 'overdue' : 'upcoming'}`;
      if (clearedNotifications.includes(id)) return;

      if (diffDays < 0) {
        list.push({
          id,
          titulo: 'Projeto Atrasado!',
          desc: `O prazo de entrega de "${p.nome}" expirou há ${Math.abs(diffDays)} dia(s) (${p.dataEntrega}).`,
          link: `/projetos/${p.id}`,
          type: 'danger'
        });
      } else if (diffDays <= alertDays) {
        list.push({
          id,
          titulo: 'Prazo Próximo!',
          desc: `O projeto "${p.nome}" vence em ${diffDays} dia(s) (${p.dataEntrega}).`,
          link: `/projetos/${p.id}`,
          type: 'warning'
        });
      }
    });

    return list;
  }, [alertDays, clearedNotifications, projetos]);

  const readNotificationIds = useMemo(() => new Set(readNotifications), [readNotifications]);
  const unreadNotifications = useMemo(
    () => activeNotifications.filter((notification) => !readNotificationIds.has(notification.id)),
    [activeNotifications, readNotificationIds],
  );

  const persistNotificationIds = (
    storageKey: string,
    update: React.Dispatch<React.SetStateAction<string[]>>,
    ids: string[],
  ) => {
    update((current) => {
      const next = Array.from(new Set([...current, ...ids]));
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteNotification = (id: string) => {
    setLastDeletedNotificationIds([id]);
    persistNotificationIds(CLEARED_NOTIFICATIONS_STORAGE_KEY, setClearedNotifications, [id]);
  };

  const handleDeleteAllNotifications = () => {
    const ids = activeNotifications.map((notification) => notification.id);
    setLastDeletedNotificationIds(ids);
    persistNotificationIds(
      CLEARED_NOTIFICATIONS_STORAGE_KEY,
      setClearedNotifications,
      ids,
    );
  };

  const handleUndoDeleteNotifications = () => {
    if (lastDeletedNotificationIds.length === 0) return;
    setClearedNotifications((current) => {
      const deletedIds = new Set(lastDeletedNotificationIds);
      const next = current.filter((id) => !deletedIds.has(id));
      localStorage.setItem(CLEARED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setLastDeletedNotificationIds([]);
  };

  const handleMarkAllNotificationsRead = () => {
    persistNotificationIds(
      READ_NOTIFICATIONS_STORAGE_KEY,
      setReadNotifications,
      activeNotifications.map((notification) => notification.id),
    );
  };

  const handleNotificationClick = (notification: AppNotification) => {
    persistNotificationIds(READ_NOTIFICATIONS_STORAGE_KEY, setReadNotifications, [notification.id]);
    setIsNotificationOpen(false);
    navigate(notification.link);
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('geogestor_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      return 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      return 'light';
    }
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('geogestor_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const themeIcon = theme === 'light' ? darkModeIcon : lightModeIcon;

  return (
    <LayoutShellContext.Provider value>
    <div className={cn(
      'min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-[#121215] font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-100 dark:selection:bg-indigo-900/30',
      printContentOnly && 'print:min-h-0 print:block print:bg-white print:text-zinc-950'
    )}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:bg-zinc-900 dark:focus:text-zinc-50"
      >
        Pular para o conteúdo principal
      </a>

      {/* Mobile Header */}
      <header className="flex md:hidden print:hidden items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200/85 dark:border-zinc-800/80 sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
            <div className="w-3.5 h-3.5 rounded bg-white dark:bg-zinc-900"></div>
          </div>
          <div>
            <p className="font-heading text-sm font-semibold leading-none text-zinc-900 dark:text-white">GeoGestor</p>
            <span className="text-[9px] text-zinc-500 font-sans tracking-wide">GESTÃO</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative rounded-xl p-2 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              aria-label={`Notificações: ${unreadNotifications.length} não lida(s)`}
              aria-expanded={isNotificationOpen}
              aria-haspopup="dialog"
            >
              <img src={bellIcon} alt="" aria-hidden="true" className="h-[25px] w-[25px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
              {unreadNotifications.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white dark:border-zinc-900"
                >
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationOpen && (
                <NotificationPanel
                  notifications={activeNotifications}
                  readIds={readNotificationIds}
                  unreadCount={unreadNotifications.length}
                  undoCount={lastDeletedNotificationIds.length}
                  className="w-[min(19rem,calc(100vw-2rem))]"
                  onMarkAllRead={handleMarkAllNotificationsRead}
                  onDeleteAll={handleDeleteAllNotifications}
                  onOpen={handleNotificationClick}
                  onDelete={handleDeleteNotification}
                  onUndoDelete={handleUndoDeleteNotifications}
                />
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          >
            <img src={themeIcon} alt="" aria-hidden="true" className="h-[23px] w-[23px] object-contain transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" />
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="-mr-2 rounded-xl p-2 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label="Abrir menu de navegação"
          >
            <List size={22} weight="bold" />
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <div className="contents print:hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          'relative z-10 min-h-screen min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 focus:outline-none sm:p-6 md:p-12 md:pt-24',
          compactBottom && 'md:pb-0',
          printContentOnly && 'print:min-h-0 print:overflow-visible print:bg-white print:p-0'
        )}
      >
        <div className="hidden print:hidden md:block absolute top-8 right-12 z-30">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-full p-2.5 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          >
            <img src={themeIcon} alt="" aria-hidden="true" className="h-[23px] w-[23px] object-contain transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" />
          </button>
        </div>
        <div className="hidden print:hidden md:block absolute top-8 right-28 z-30 mr-1.5">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative flex items-center justify-center rounded-full p-2.5 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label={`Notificações: ${unreadNotifications.length} não lida(s)`}
            aria-expanded={isNotificationOpen}
            aria-haspopup="dialog"
          >
            <img src={bellIcon} alt="" aria-hidden="true" className="h-[25px] w-[25px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
            {unreadNotifications.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white dark:border-zinc-950"
              >
                {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationOpen && (
              <NotificationPanel
                notifications={activeNotifications}
                readIds={readNotificationIds}
                unreadCount={unreadNotifications.length}
                undoCount={lastDeletedNotificationIds.length}
                className="w-96"
                onMarkAllRead={handleMarkAllNotificationsRead}
                onDeleteAll={handleDeleteAllNotifications}
                onOpen={handleNotificationClick}
                onDelete={handleDeleteNotification}
                onUndoDelete={handleUndoDeleteNotifications}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="absolute right-44 top-8 z-30 hidden print:hidden md:block">
          <GlobalSearch />
        </div>

        <div
          className={cn(
            `${contentClassName} mx-auto w-full min-w-0`,
            printContentOnly && 'print:max-w-none'
          )}
        >
          {children}
        </div>
      </main>
    </div>
    </LayoutShellContext.Provider>
  );
}

export function Layout({
  children,
  contentClassName = 'max-w-[1400px]',
  compactBottom = false,
  printContentOnly = false
}: LayoutProps) {
  const hasPersistentShell = useContext(LayoutShellContext);
  if (!hasPersistentShell) {
    return (
      <LayoutShell
        contentClassName={contentClassName}
        compactBottom={compactBottom}
        printContentOnly={printContentOnly}
      >
        {children}
      </LayoutShell>
    );
  }

  return (
    <div data-page-content className={cn(
      `${contentClassName} mx-auto w-full min-w-0`,
      compactBottom && 'md:-mb-12',
      printContentOnly && 'print:max-w-none'
    )}>
      {children}
    </div>
  );
}

export function PersistentLayout({ children }: { children: ReactNode }) {
  return (
    <LayoutShell contentClassName="max-w-none" printContentOnly>
      {children}
    </LayoutShell>
  );
}
