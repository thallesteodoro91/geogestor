import { useEffect, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { List } from '@phosphor-icons/react';
import lightModeIcon from '../assets/magnific-icons/brightness_3649294.svg';
import darkModeIcon from '../assets/magnific-icons/night-mode_5510495.svg';
import { cn } from '../utils/cn';
import { UnifiedNotificationCenter } from './UnifiedNotificationCenter';
import { BackupStatusIndicator } from './BackupStatusIndicator';

interface LayoutProps {
  children: ReactNode;
  contentClassName?: string;
  compactBottom?: boolean;
  printContentOnly?: boolean;
}

function LayoutShell({
  children,
  contentClassName = 'max-w-[1400px]',
  compactBottom = false,
  printContentOnly = false
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('geogestor_theme');
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextTheme = isCurrentlyDark ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('geogestor_theme', nextTheme);
    window.dispatchEvent(new Event('geogestor:theme-change'));
  };

  const themeIcon = theme === 'dark'
    ? lightModeIcon
    : theme === 'light'
      ? darkModeIcon
      : document.documentElement.classList.contains('dark') ? lightModeIcon : darkModeIcon;

  return (
    <div
      data-app-layout
      className={cn(
      'min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-[#121215] font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-200 selection:text-zinc-950 dark:selection:bg-indigo-700 dark:selection:text-white',
      printContentOnly && 'print:min-h-0 print:block print:bg-white print:text-zinc-950'
      )}
    >
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
            <span className="text-[11px] text-zinc-500 font-sans tracking-wide">GESTÃO</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <UnifiedNotificationCenter mobile />

          <BackupStatusIndicator compact />

          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          >
            <img src={themeIcon} alt="" aria-hidden="true" width={24} height={24} className="h-6 w-6 object-contain transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" />
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="-mr-2 rounded-xl p-2 text-zinc-500 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label="Abrir menu de navegação"
          >
            <List aria-hidden="true" size={22} weight="bold" />
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
            <img src={themeIcon} alt="" aria-hidden="true" width={24} height={24} className="h-6 w-6 object-contain transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" />
          </button>
        </div>
        <div className="hidden print:hidden md:block absolute top-8 right-28 z-30 mr-1.5">
          <BackupStatusIndicator compact />
        </div>
        <div className="hidden print:hidden md:block absolute top-8 right-44 z-30 mr-1.5">
          <UnifiedNotificationCenter />
        </div>
        <div className="absolute right-60 top-8 z-30 hidden print:hidden md:block">
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
  );
}

export function Layout({
  children,
  contentClassName = 'max-w-[1400px]',
  compactBottom = false,
  printContentOnly = false
}: LayoutProps) {
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

export function AuthenticatedLayout() {
  return (
    <LayoutShell contentClassName="max-w-none" printContentOnly>
      <Outlet />
    </LayoutShell>
  );
}
