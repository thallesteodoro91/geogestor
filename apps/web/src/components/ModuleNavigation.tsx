import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PreloadLink } from './PreloadLink';
import clientsIcon from '../assets/magnific-icons/user_3237472.svg';
import crmIcon from '../assets/magnific-icons/filter_9757817.svg';
import budgetsIcon from '../assets/magnific-icons/profit_6919960.svg';
import calendarIcon from '../assets/magnific-icons/calendar_5684639.svg';
import tasksIcon from '../assets/magnific-icons/list_5406211.svg';
import { cn } from '../utils/cn';
import {
  type GeoTone,
} from '../utils/geoTheme';
import {
  localNavigationBarClass,
  localNavigationButtonClass,
  localNavigationIconClass,
  localNavigationItemsClass,
} from '../utils/localNavigationStyles';

type ModuleNavigationKind = 'commercial' | 'agenda';

interface ModuleNavigationProps {
  module: ModuleNavigationKind;
  className?: string;
  trailing?: ReactNode;
  trailingLayout?: 'inline' | 'responsive';
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
};

export function ModuleNavigation({ module, className, trailing, trailingLayout = 'inline' }: ModuleNavigationProps) {
  const location = useLocation();
  const items = MODULE_ITEMS[module];

  const navigationItems = items.map((item) => {
    const active = (item.activePaths ?? [item.path]).some(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    );

    return (
      <PreloadLink
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className={localNavigationButtonClass(active, item.tone)}
      >
        <span
          aria-hidden="true"
          className={localNavigationIconClass(
            active,
            item.tone,
            'overflow-hidden bg-transparent p-0 dark:bg-transparent',
          )}
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
      </PreloadLink>
    );
  });

  if (trailing && trailingLayout === 'responsive') {
    return (
      <nav
        aria-label={MODULE_LABELS[module]}
        className={cn('mb-6 min-w-0 max-w-full', className)}
      >
        <div className="min-w-0 2xl:flex 2xl:items-start 2xl:gap-4">
          <div className={cn(localNavigationBarClass, '2xl:flex-1')}>
            <div className={localNavigationItemsClass}>{navigationItems}</div>
          </div>
          <div className="mt-3 min-w-0 2xl:mt-0 2xl:shrink-0">{trailing}</div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={MODULE_LABELS[module]}
      className={cn(localNavigationBarClass, 'mb-6', className)}
    >
      <div className={localNavigationItemsClass}>
        {navigationItems}
        {trailing}
      </div>
    </nav>
  );
}
