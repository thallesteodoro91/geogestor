import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { List, Trash, Check } from '@phosphor-icons/react';
import { geoViewTransition } from '../utils/motion';
import lightModeIcon from '../assets/magnific-icons/brightness_3649294.svg';
import darkModeIcon from '../assets/magnific-icons/night-mode_5510495.svg';
import bellIcon from '../assets/magnific-icons/bell_10953632.svg';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';

interface LayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

interface ProjetoNotificacao {
  id: string;
  nome: string;
  status: string;
  dataEntrega?: string | null;
}

export function Layout({ children, contentClassName = 'max-w-[1400px]' }: LayoutProps) {
  const navigate = useNavigate();
  const alertDays = Number(localStorage.getItem('geogestor_alerta_dias') || '7');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const { data: projetos = [] } = useQuery<ProjetoNotificacao[]>({
    queryKey: ['projetos-notificacoes'],
    queryFn: () => apiClient.get<ProjetoNotificacao[]>('/api/projetos'),
    staleTime: 60_000,
  });

  const [clearedNotifications, setClearedNotifications] = useState<string[]>(() => {
    const saved = localStorage.getItem('geogestor_cleared_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const activeNotifications = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: Array<{ id: string; titulo: string; desc: string; link: string; type: 'warning' | 'info' | 'danger' }> = [];

    projetos.forEach(p => {
      if (!p.dataEntrega || p.status === 'Concluído' || p.status === 'Arquivado') return;

      const deliveryDate = new Date(`${p.dataEntrega}T00:00:00`);
      const diffTime = deliveryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const id = `proj-deadline-${p.id}`;
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
  })();

  const handleClearNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...clearedNotifications, id];
    setClearedNotifications(next);
    localStorage.setItem('geogestor_cleared_notifications', JSON.stringify(next));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = activeNotifications.map(n => n.id);
    const next = [...clearedNotifications, ...allIds];
    setClearedNotifications(next);
    localStorage.setItem('geogestor_cleared_notifications', JSON.stringify(next));
  };

  const handleNotificationClick = (link: string) => {
    setIsNotificationOpen(false);
    navigate(link);
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
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-[#121215] font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:bg-zinc-900 dark:focus:text-zinc-50"
      >
        Pular para o conteúdo principal
      </a>

      {/* Mobile Header */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200/85 dark:border-zinc-800/80 sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
            <div className="w-3.5 h-3.5 rounded bg-white dark:bg-zinc-900"></div>
          </div>
          <div>
            <h1 className="font-heading font-semibold text-zinc-900 dark:text-white leading-none text-sm">GeoGestor</h1>
            <span className="text-[9px] text-zinc-500 font-sans tracking-wide">GESTÃO</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative rounded-xl p-2 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              aria-label="Notificações"
            >
              <img src={bellIcon} alt="" className="h-[25px] w-[25px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
              {activeNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-zinc-900"></span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                    <span className="font-bold text-xs text-zinc-900 dark:text-white">Notificações</span>
                    {activeNotifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                        title="Limpar tudo"
                      >
                        <Trash size={12} />
                        Limpar tudo
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 scrollbar-none">
                    {activeNotifications.length === 0 ? (
                      <p className="py-6 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500">Nenhuma notificação</p>
                    ) : (
                      activeNotifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n.link)}
                          className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 cursor-pointer flex items-start justify-between gap-2 transition-colors group"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className={`text-[10px] font-bold ${n.type === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>{n.titulo}</p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-normal line-clamp-2">{n.desc}</p>
                          </div>
                          <button
                            onClick={(e) => handleClearNotification(n.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-all shrink-0"
                            title="Limpar"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
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
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="relative z-10 min-h-screen min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 focus:outline-none">
        <div className="hidden md:block absolute top-8 right-12 z-30">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-full p-2.5 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          >
            <img src={themeIcon} alt="" aria-hidden="true" className="h-[23px] w-[23px] object-contain transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" />
          </button>
        </div>
        <div className="hidden md:block absolute top-8 right-28 z-30 mr-1.5">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative flex items-center justify-center rounded-full p-2.5 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label="Notificações"
          >
            <img src={bellIcon} alt="" className="h-[25px] w-[25px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
            {activeNotifications.length > 0 && (
              <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-zinc-950"></span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                  <span className="font-bold text-xs text-zinc-900 dark:text-white">Notificações</span>
                  {activeNotifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                      title="Limpar tudo"
                    >
                      <Trash size={12} />
                      Limpar tudo
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 scrollbar-none">
                  {activeNotifications.length === 0 ? (
                    <p className="py-6 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500">Nenhuma notificação</p>
                  ) : (
                    activeNotifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n.link)}
                        className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 cursor-pointer flex items-start justify-between gap-2.5 transition-colors group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className={`text-[10px] font-bold ${n.type === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>{n.titulo}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-normal line-clamp-2">{n.desc}</p>
                        </div>
                        <button
                          onClick={(e) => handleClearNotification(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-all shrink-0"
                          title="Limpar"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="absolute right-44 top-8 z-30 hidden md:block">
          <GlobalSearch />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={geoViewTransition}
          className={`${contentClassName} mx-auto w-full min-w-0`}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
