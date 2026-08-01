import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { LockKey, X } from '@phosphor-icons/react';
import { PreloadLink } from './PreloadLink';
import { useAppSession } from '../contexts/AppSessionContext';
import { APP_VERSION } from '../version';
import dashboardIcon from '../assets/magnific-icons/laptop_5938907.svg';
import projectsIcon from '../assets/magnific-icons/project_folder.svg';
import crmIcon from '../assets/magnific-icons/filter_9757817.svg';
import calendarIcon from '../assets/magnific-icons/calendar_5684639.svg';
import topographyIcon from '../assets/magnific-icons/theodolite_7504749.svg';
import ambientalIcon from '../assets/magnific-icons/plant_2786614.svg';
import financeIcon from '../assets/magnific-icons/money_7190332.svg';
import reportsIcon from '../assets/magnific-icons/invoice_9510031.svg';
import planningIcon from '../assets/magnific-icons/objective_5799225.svg';
import recordsIcon from '../assets/magnific-icons/notes_8079875.svg';
import settingsIcon from '../assets/magnific-icons/settings_4415587.svg';
import auditIcon from '../assets/magnific-icons/auditor_5807551.svg';
import helpIcon from '../assets/magnific-icons/question_8288345.svg';

interface SidebarItem {
  name: string;
  path?: string;
  icon: string;
  created: boolean;
  activePaths?: string[];
}

interface SidebarSection {
  title: string;
  tone: 'field' | 'finance' | 'system';
  items: SidebarItem[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const SIDEBAR_SCROLL_STORAGE_KEY = 'geogestor_sidebar_scroll_top';
let sidebarScrollTop = 0;

const SECTION_ACTIVE_CLASSES: Record<SidebarSection['tone'], string> = {
  field:
    'bg-zinc-50 text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800/70 dark:text-white dark:ring-zinc-700/70',
  finance:
    'bg-zinc-50 text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800/70 dark:text-white dark:ring-zinc-700/70',
  system:
    'bg-zinc-50 text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800/70 dark:text-white dark:ring-zinc-700/70',
};

const SECTION_MARKER_CLASSES: Record<SidebarSection['tone'], string> = {
  field: 'bg-brand-turquoise-600 dark:bg-brand-turquoise-300',
  finance: 'bg-brand-green-600 dark:bg-brand-green-300',
  system: 'bg-brand-primary-600 dark:bg-brand-primary-300',
};

const SECTION_FOCUS_CLASSES: Record<SidebarSection['tone'], string> = {
  field: 'focus-visible:ring-brand-turquoise-500/35',
  finance: 'focus-visible:ring-brand-green-500/35',
  system: 'focus-visible:ring-brand-primary-500/35',
};

function SidebarIcon({
  src,
  isActive = false,
  disabled = false,
}: {
  src: string;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isActive ? 'scale-105' : ''
      } ${disabled ? 'opacity-45 grayscale' : ''}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.035] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
      />
    </span>
  );
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { identity, lock } = useAppSession();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;

    const storedScrollTop = Number(sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY) ?? sidebarScrollTop);
    if (Number.isFinite(storedScrollTop) && storedScrollTop > 0) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = storedScrollTop;
        }
      });
    }

    return () => {
      sidebarScrollTop = node.scrollTop;
      sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(sidebarScrollTop));
    };
  }, []);

  const handleScroll = () => {
    const nextScrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    sidebarScrollTop = nextScrollTop;
    sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(nextScrollTop));
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sections: SidebarSection[] = [
    {
      title: 'NAVEGAÇÃO',
      tone: 'field',
      items: [
        { name: 'Visão Geral', path: '/', icon: dashboardIcon, created: true },
        {
          name: 'Comercial',
          path: '/clientes',
          icon: crmIcon,
          created: true,
          activePaths: ['/clientes', '/crm', '/orcamentos'],
        },
        { name: 'Projetos', path: '/projetos', icon: projectsIcon, created: true },
        { name: 'Ambiental', path: '/ambiental', icon: ambientalIcon, created: true },
        { name: 'Financeiro', path: '/financeiro', icon: financeIcon, created: true },
        {
          name: 'Agenda',
          path: '/calendario',
          icon: calendarIcon,
          created: true,
          activePaths: ['/calendario', '/tarefas'],
        },
        {
          name: 'Ferramentas',
          path: '/topografia',
          icon: topographyIcon,
          created: true,
          activePaths: ['/topografia', '/importacao'],
        },
      ],
    },
  ];

  const administrationItems: SidebarItem[] = [
    { name: 'Relatórios', path: '/relatorios', icon: reportsIcon, created: true },
    { name: 'Planejamento', path: '/planejamento', icon: planningIcon, created: true },
    { name: 'Cadastros', path: '/cadastros', icon: recordsIcon, created: true },
    { name: 'Propriedades', path: '/propriedades', icon: recordsIcon, created: true },
    { name: 'Qualidade dos dados', path: '/qualidade-dados', icon: auditIcon, created: true },
    { name: 'Configurações', path: '/configuracoes', icon: settingsIcon, created: true },
    { name: 'Logs de Auditoria', path: '/audit-logs', icon: auditIcon, created: true },
    { name: 'Ajuda', path: '/ajuda', icon: helpIcon, created: true },
  ];

  const isItemActive = (item: SidebarItem) => {
    const paths = item.activePaths ?? (item.path ? [item.path] : []);
    return paths.some((path) => (
      path === '/'
        ? location.pathname === '/'
        : location.pathname === path || location.pathname.startsWith(`${path}/`)
    ));
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 dark:bg-black/85 md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-shrink-0 select-none flex-col bg-white shadow-[6px_0_24px_-20px_rgba(15,23,42,0.45)] ring-1 ring-zinc-200/80 transition-transform duration-300 ease-out dark:bg-zinc-900 dark:ring-zinc-800/90 md:sticky md:inset-y-auto md:top-0 md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl md:shadow-[6px_0_24px_-20px_rgba(15,23,42,0.45)]' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-md">
              <div className="h-4 w-4 rounded bg-white dark:bg-zinc-900" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="font-heading text-lg font-semibold leading-none text-zinc-900 dark:text-white">
                  GeoGestor
                </div>
                <span className="rounded-md border border-emerald-600/30 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-extrabold tracking-tighter text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-300">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                Gestão Topográfica
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 outline-none motion-fast motion-gpu hover:bg-zinc-100 hover:text-zinc-600 active:scale-[0.96] dark:hover:bg-zinc-800 dark:hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-indigo-500/30 md:hidden"
            aria-label="Fechar menu de navegação"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        <nav
          aria-label="Navegação principal do GeoGestor"
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 space-y-6 overflow-y-auto px-4 py-5"
        >
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <span className="block px-3 font-heading text-[11px] font-bold tracking-[0.16em] text-zinc-600 dark:text-zinc-400">
                {section.title}
              </span>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = isItemActive(item);

                  if (item.created && item.path) {
                    return (
                      <PreloadLink
                        key={item.name}
                        to={item.path}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex min-h-[58px] items-center justify-between rounded-lg py-2.5 pl-3 pr-3 text-[14.5px] font-semibold leading-5 outline-none motion-fast motion-gpu active:scale-[0.99] focus-visible:ring-2 ${SECTION_FOCUS_CLASSES[section.tone]} ${
                          isActive
                            ? SECTION_ACTIVE_CLASSES[section.tone]
                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-white'
                        }`}
                      >
                        {isActive ? (
                          <span aria-hidden="true" className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${SECTION_MARKER_CLASSES[section.tone]}`} />
                        ) : null}
                        <div className="flex min-w-0 items-center gap-3.5">
                          <SidebarIcon src={item.icon} isActive={isActive} />
                          <span className="truncate">{item.name}</span>
                        </div>
                      </PreloadLink>
                    );
                  }

                  return (
                    <div
                      key={item.name}
                      aria-disabled="true"
                      className="group flex min-h-[58px] cursor-not-allowed items-center justify-between rounded-lg py-2.5 pl-3 pr-3 text-[14.5px] font-semibold leading-5 text-zinc-400/85 dark:text-zinc-500"
                      title="Esta ferramenta ainda não foi criada"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <SidebarIcon src={item.icon} disabled />
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="ml-2 rounded-md border border-zinc-200/70 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        Pendente
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <span className="block px-3 font-heading text-[11px] font-bold tracking-[0.16em] text-zinc-600 dark:text-zinc-400">
              GESTÃO E SISTEMA
            </span>

            <div className="space-y-1">
              {administrationItems.map((item) => {
                const isActive = isItemActive(item);
                return (
                  <PreloadLink
                    key={item.name}
                    to={item.path!}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex min-h-[50px] items-center rounded-lg px-2.5 text-[13px] font-semibold outline-none motion-fast motion-gpu active:scale-[0.99] focus-visible:ring-2 ${SECTION_FOCUS_CLASSES.system} ${
                      isActive
                        ? SECTION_ACTIVE_CLASSES.system
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <span aria-hidden="true" className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${SECTION_MARKER_CLASSES.system}`} />
                    )}
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                        <img
                          src={item.icon}
                          alt=""
                          aria-hidden="true"
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                        />
                      </span>
                      <span className="truncate">{item.name}</span>
                    </span>
                  </PreloadLink>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200/70 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-heading text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {(identity?.name || 'GG').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold leading-5 text-zinc-800 dark:text-zinc-200">
                {identity?.name || 'Administrador'}
              </p>
              <span className="block truncate text-xs leading-4 text-zinc-600 dark:text-zinc-400">{identity?.email || 'Sessão local'}</span>
            </div>
            <button
              type="button"
              onClick={() => void lock()}
              className="geo-focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              aria-label="Bloquear sessão"
              title="Bloquear sessão"
            >
              <LockKey aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
