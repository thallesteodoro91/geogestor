import { Link, useLocation } from 'react-router-dom';
import clientsIcon from '../assets/magnific-icons/user_3237472.svg';
import crmIcon from '../assets/magnific-icons/filter_9757817.svg';
import budgetsIcon from '../assets/magnific-icons/profit_6919960.svg';
import calendarIcon from '../assets/magnific-icons/calendar_5684639.svg';
import tasksIcon from '../assets/magnific-icons/list_5406211.svg';
import topographyIcon from '../assets/magnific-icons/theodolite_7504749.svg';
import importIcon from '../assets/magnific-icons/upload_5406245.svg';
import { cn } from '../utils/cn';
import {
  geoTabButtonClass,
  geoTabIconClass,
  geoTabListClass,
  type GeoTone,
} from '../utils/geoTheme';

type ModuleNavigationKind = 'commercial' | 'agenda' | 'tools';

interface ModuleNavigationProps {
  module: ModuleNavigationKind;
  className?: string;
}

interface ModuleNavigationItem {
  label: string;
  path: string;
  icon: string;
  tone: GeoTone;
  activePaths?: string[];
}

const MODULE_LABELS: Record<ModuleNavigationKind, string> = {
  commercial: 'Áreas do módulo Comercial',
  agenda: 'Áreas de Agenda',
  tools: 'Áreas de Ferramentas',
};

const MODULE_ITEMS: Record<ModuleNavigationKind, ModuleNavigationItem[]> = {
  commercial: [
    {
      label: 'Clientes',
      path: '/clientes',
      icon: clientsIcon,
      tone: 'system',
      activePaths: ['/clientes'],
    },
    {
      label: 'CRM e Funil',
      path: '/crm',
      icon: crmIcon,
      tone: 'field',
      activePaths: ['/crm'],
    },
    {
      label: 'Orçamentos',
      path: '/orcamentos',
      icon: budgetsIcon,
      tone: 'finance',
      activePaths: ['/orcamentos'],
    },
  ],
  agenda: [
    {
      label: 'Calendário',
      path: '/calendario',
      icon: calendarIcon,
      tone: 'system',
      activePaths: ['/calendario'],
    },
    {
      label: 'Tarefas',
      path: '/tarefas',
      icon: tasksIcon,
      tone: 'warning',
      activePaths: ['/tarefas'],
    },
  ],
  tools: [
    {
      label: 'Topografia',
      path: '/topografia',
      icon: topographyIcon,
      tone: 'field',
      activePaths: ['/topografia'],
    },
    {
      label: 'Importação',
      path: '/importacao',
      icon: importIcon,
      tone: 'success',
      activePaths: ['/importacao'],
    },
  ],
};

export function ModuleNavigation({ module, className }: ModuleNavigationProps) {
  const location = useLocation();
  const items = MODULE_ITEMS[module];

  return (
    <nav
      aria-label={MODULE_LABELS[module]}
      className={cn(geoTabListClass, 'mb-6 max-w-full min-w-0 overflow-x-auto', className)}
    >
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = (item.activePaths ?? [item.path]).some(
            (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
          );

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={geoTabButtonClass(active, item.tone, 'min-h-12 px-3 sm:px-4')}
            >
              <span
                aria-hidden="true"
                className={geoTabIconClass(active, item.tone, 'h-8 w-8 overflow-hidden bg-transparent p-0')}
              >
                <img
                  src={item.icon}
                  alt=""
                  width={26}
                  height={26}
                  className="h-[26px] w-[26px] object-contain"
                />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
