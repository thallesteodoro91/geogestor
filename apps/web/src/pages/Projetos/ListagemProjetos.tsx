import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { APP_ROUTES, appLinks } from '@geogestor/contracts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { DatePickerField, FormSelect } from '../../components/Form';
import { FileUploadModal } from '../../components/FileUploadModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiClient, getDownloadUrl } from '../../services/apiClient';
import { openProjectFolder } from '../../services/projectFolders';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, FolderOpen, Folder, PresentationChart, Files, FilePdf, FileDoc, FileText, FileDashed, Trash, MapPin, Compass, DownloadSimple, MagnifyingGlass, ChartBar, Clock, CheckCircle, TrendUp, Warning, ListBullets, SquaresFour, DotsThreeVertical, CalendarBlank, FunnelSimple, CaretDown, ArrowRight, X } from '@phosphor-icons/react';
import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie } from 'recharts';
import { chartActiveBar, chartAnimationDuration, chartTextColor, chartBorder, chartLegendStyle, chartCursor, chartSegmentStyle, responsiveChartProps } from '../../utils/chartHelpers';
import { chartColors } from '../../data/chart-colors';
import { DynamicTooltip } from '../../components/charts/DynamicTooltip';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { PopoverSurface } from '../../components/form-controls/PopoverSurface';
import { cn } from '../../utils/cn';
import { useDebounce } from '../../hooks/useDebounce';
import {
  primarySmallActionButtonClass,
  secondarySmallActionButtonClass,
} from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import {
  localNavigationBarClass,
  localNavigationButtonClass,
  localNavigationIconClass,
} from '../../utils/localNavigationStyles';
import { ProjectFormModal } from './ProjectFormModal';
import { resolveProjectFormCopy, type ProjectModalContext, type ProjectModalTab } from './projectForm';

import { CustomSelect } from '../../components/CustomSelect';
import {
  filterSearchInputClass
} from '../../utils/filterStyles';
import editIcon from '../../assets/magnific-icons/writing_3215063.svg';
import pdfIcon from '../../assets/magnific-icons/notes_8079875.svg';
import windowsIcon from '../../assets/magnific-icons/laptop_5938907.svg';
import filterIcon from '../../assets/magnific-icons/filter_9757817.svg';
import statisticsTabIcon from '../../assets/magnific-icons/bar-chart_4815689.png';

interface ProjectOverview {
  total: number;
  completed: number;
  inProgress: number;
  late: number;
  other: number;
  productivityRate: number | null;
  avgCompletionDays: number | null;
  avgApprovedBudgetCents: number | null;
  typeStats: Array<{ type: string; count: number }>;
  statusStats: Array<{ status: string; count: number }>;
  topProjects: Array<{ name: string; Receita: number; Custo: number; Lucro: number; tipo: string }>;
}

type ProjectViewMode = 'list' | 'grid' | 'operacional';

const projectViewTabs: Array<{ mode: ProjectViewMode; label: string }> = [
  { mode: 'list', label: 'Lista' },
  { mode: 'grid', label: 'Grade' },
  { mode: 'operacional', label: 'Estatísticas' }
];

const projectSortOrders = [
  'updated_desc',
  'deadline_asc',
  'deadline_desc',
  'name_asc',
  'name_desc',
  'client_asc',
  'status_asc'
] as const;

interface Projeto {
  id: string;
  nome: string;
  descricao?: string | null;
  clienteId: string;
  clienteNome: string;
  status: string;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  situacaoImovel?: string | null;
  tipo?: string | null;
  averbacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string | null;
  observacoes?: string | null;
  orgaoAmbiental?: string | null;
  tipoDemanda?: string | null;
  tipoLicenca?: string | null;
  protocolo?: string | null;
  numeroProcesso?: string | null;
  tipoPericia?: string | null;
  dataVistoria?: string | null;
  updatedAt?: string;
}

interface ProjetoArquivo {
  name: string;
  extension: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

interface ProjectPage {
  items: Projeto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProjectFilterOptions {
  types: Array<{ value: string; count: number }>;
  statuses: Array<{ value: string; count: number }>;
}

const projectSelectClass = cn(geoFieldClass, 'h-12 w-full cursor-pointer px-4 font-medium');
const projectIconButtonClass = 'geo-focus-ring inline-flex h-[30px] w-[30px] shrink-0 touch-manipulation items-center justify-center rounded-md border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,border-color,color,transform] duration-150 hover:border-brand-primary-300/60 hover:bg-brand-primary-50 hover:text-brand-primary-700 active:scale-95 disabled:cursor-wait disabled:opacity-50 dark:bg-brand-surface-muted dark:text-zinc-300 dark:hover:bg-brand-primary-400/10 dark:hover:text-brand-primary-100';
const activeFilterChipClass = 'geo-focus-ring inline-flex min-h-11 max-w-full touch-manipulation items-center gap-1.5 rounded-full bg-brand-primary-50 px-3 text-xs font-semibold text-brand-primary-700 ring-1 ring-inset ring-brand-primary-200 transition-[background-color,color,transform] duration-150 hover:bg-brand-primary-100 active:scale-[0.98] dark:bg-brand-primary-400/10 dark:text-brand-primary-100 dark:ring-brand-primary-300/20 dark:hover:bg-brand-primary-400/15';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const projectPercentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const formatBRL = (cents: number) => currencyFormatter.format(cents / 100);
const formatProjectCount = (count: number) => `${numberFormatter.format(count)} ${count === 1 ? 'projeto' : 'projetos'}`;
const formatProjectDate = (value?: string | null) => value ? dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'Sem prazo';
const displayProjectType = (value?: string | null) => value?.trim() || 'Não informado';

const normalizeProjectValue = (value?: string | null) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const parseProjectDate = (value?: string | null) => {
  const match = value?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calendarDaysFromToday = (value?: string | null) => {
  const date = parseProjectDate(value);
  if (!date) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - today) / 86_400_000);
};

const formatUpdatedAt = (value?: string | null) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const differenceMs = timestamp - Date.now();
  const absoluteDifference = Math.abs(differenceMs);
  if (absoluteDifference < 60_000) return 'Atualizado agora';
  if (absoluteDifference < 3_600_000) return `Atualizado ${relativeTimeFormatter.format(Math.round(differenceMs / 60_000), 'minute')}`;
  if (absoluteDifference < 86_400_000) return `Atualizado ${relativeTimeFormatter.format(Math.round(differenceMs / 3_600_000), 'hour')}`;
  return `Atualizado ${relativeTimeFormatter.format(Math.round(differenceMs / 86_400_000), 'day')}`;
};

type ProjectStatusTone = 'danger' | 'warning' | 'success' | 'info' | 'primary' | 'neutral';

const projectStatusAccentClasses: Record<ProjectStatusTone, string> = {
  danger: 'bg-brand-red-500',
  warning: 'bg-brand-rajah-700',
  success: 'bg-brand-green-500',
  info: 'bg-brand-turquoise-600',
  primary: 'bg-brand-primary-500',
  neutral: 'bg-brand-grey-300'
};

const getProjectStatusPresentation = (projeto: Projeto) => {
  const normalizedStatus = normalizeProjectValue(projeto.status);
  const terminal = ['finalizado', 'concluido', 'cancelado', 'arquivado'].includes(normalizedStatus);
  const daysUntilDeadline = calendarDaysFromToday(projeto.dataEntrega);
  const isDelayed = !terminal && (normalizedStatus === 'atrasado' || (daysUntilDeadline !== null && daysUntilDeadline < 0));

  if (isDelayed) return { label: 'Atrasado', tone: 'danger' as const, badgeClass: 'geo-badge-danger', icon: Warning };
  if (['finalizado', 'concluido'].includes(normalizedStatus)) return { label: 'Concluído', tone: 'success' as const, badgeClass: 'geo-badge-success', icon: CheckCircle };
  if (normalizedStatus === 'em andamento') return { label: 'Em andamento', tone: 'primary' as const, badgeClass: 'geo-badge-primary', icon: Clock };
  if (normalizedStatus === 'em analise') return { label: 'Em análise', tone: 'info' as const, badgeClass: 'geo-badge-info', icon: FolderOpen };
  if (normalizedStatus === 'aguardando orgao') return { label: 'Aguardando órgão', tone: 'warning' as const, badgeClass: 'geo-badge-warning', icon: Clock };
  return { label: projeto.status, tone: 'neutral' as const, badgeClass: 'geo-badge-neutral', icon: null };
};

const getProjectDeadlinePresentation = (projeto: Projeto) => {
  const status = getProjectStatusPresentation(projeto);
  const date = formatProjectDate(projeto.dataEntrega);
  const daysUntilDeadline = calendarDaysFromToday(projeto.dataEntrega);

  if (!projeto.dataEntrega || daysUntilDeadline === null) return { label: 'Prazo', value: 'Sem prazo', helper: null, tone: 'neutral' as const };
  if (status.tone === 'success') return { label: 'Prazo final', value: date, helper: 'Projeto concluído', tone: 'success' as const };
  if (daysUntilDeadline < 0) return { label: 'Prazo', value: date, helper: `Atrasado há ${numberFormatter.format(Math.abs(daysUntilDeadline))} ${Math.abs(daysUntilDeadline) === 1 ? 'dia' : 'dias'}`, tone: 'danger' as const };
  if (daysUntilDeadline === 0) return { label: 'Prazo', value: date, helper: 'Vence hoje', tone: 'warning' as const };
  if (daysUntilDeadline === 1) return { label: 'Prazo', value: date, helper: 'Vence amanhã', tone: 'warning' as const };
  if (daysUntilDeadline <= 7) return { label: 'Prazo', value: date, helper: `Vence em ${numberFormatter.format(daysUntilDeadline)} dias`, tone: 'warning' as const };
  return { label: 'Prazo', value: date, helper: `Vence em ${numberFormatter.format(daysUntilDeadline)} dias`, tone: 'neutral' as const };
};

const deadlineToneClasses = {
  danger: 'text-red-700 dark:text-red-200',
  warning: 'text-amber-800 dark:text-amber-200',
  success: 'text-emerald-700 dark:text-emerald-200',
  neutral: 'text-zinc-500 dark:text-zinc-400'
} as const;

const getProjectIdentifiers = (projeto: Projeto) => [
  projeto.matricula ? { label: 'Matrícula', value: projeto.matricula } : null,
  projeto.car ? { label: 'CAR', value: projeto.car } : null,
  projeto.ccir ? { label: 'CCIR', value: projeto.ccir } : null,
  projeto.itr ? { label: 'ITR', value: projeto.itr } : null,
  projeto.protocolo ? { label: 'Protocolo', value: projeto.protocolo } : null
].filter((identifier): identifier is { label: string; value: string } => Boolean(identifier));

const getProjectTypeBadgeClass = (value?: string | null) => {
  const normalizedType = (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

  if (/ambient|licen|florest|saneamento/.test(normalizedType)) return 'geo-badge-success';
  if (/topograf|levantamento|locacao|aerofotogrametr/.test(normalizedType)) return 'geo-badge-info';
  if (/peric|laudo|avaliacao|regularizacao/.test(normalizedType)) return 'geo-badge-warning';
  if (/georref|cartograf|cadast|fundiari/.test(normalizedType)) return 'geo-badge-primary';
  return 'geo-badge-neutral';
};

function ProjectOpenButton({ projectId, stretch = false, responsive = false }: { projectId: string; stretch?: boolean; responsive?: boolean }) {
  return (
    <Link
      to={appLinks.project(projectId)}
      className={cn(
        'geo-focus-ring inline-flex h-11 min-h-11 touch-manipulation items-center justify-center gap-2 rounded-lg border border-brand-primary-200 bg-brand-primary-50 px-4 text-sm font-semibold text-brand-primary-700 transition-[background-color,border-color,color,transform] duration-150 hover:border-brand-primary-300 hover:bg-brand-primary-100 active:scale-[0.98] dark:border-brand-primary-300/20 dark:bg-brand-primary-400/10 dark:text-brand-primary-100 dark:hover:bg-brand-primary-400/15',
        stretch && 'w-full',
        responsive && 'w-full sm:w-auto'
      )}
    >
      {responsive ? (
        <>Ver projeto <ArrowRight aria-hidden="true" className="h-4 w-4" weight="bold" /></>
      ) : (
        <><FolderOpen aria-hidden="true" className="h-4 w-4" weight="bold" /> Abrir projeto</>
      )}
    </Link>
  );
}

function ProjectStatusBadge({ projeto }: { projeto: Projeto }) {
  const status = getProjectStatusPresentation(projeto);
  const StatusIcon = status.icon;
  return (
    <span className={cn('geo-badge-base shrink-0 px-2.5 py-1 text-xs font-semibold', status.badgeClass)}>
      {StatusIcon ? <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" /> : null}
      {status.label}
    </span>
  );
}

interface ProjectActionsMenuProps {
  project: Projeto;
  canOpenInWindows: boolean;
  editing: boolean;
  onDocuments: () => void;
  onGeneratePdf: () => void | Promise<void>;
  onEdit: () => void | Promise<void>;
  onOpenWindows: () => void | Promise<void>;
  onDelete: () => void;
}

function ProjectActionsMenu({
  project,
  canOpenInWindows,
  editing,
  onDocuments,
  onGeneratePdf,
  onEdit,
  onOpenWindows,
  onDelete
}: ProjectActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', closeFromOutside, true);
    return () => document.removeEventListener('pointerdown', closeFromOutside, true);
  }, [open]);

  const closeAndReturnFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? (currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
          : (currentIndex + 1) % items.length;
    items[nextIndex]?.focus();
  };

  const runAction = (action: () => void | Promise<void>, restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    void action();
  };

  const menuItemClass = 'geo-focus-ring flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-700 transition-[background-color,color] duration-150 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800';

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Mais ações para ${project.nome}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Mais ações"
        onClick={() => setOpen((current) => !current)}
        className={projectIconButtonClass}
      >
        <DotsThreeVertical aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
      </button>
      <PopoverSurface
        ref={menuRef}
        id={menuId}
        open={open}
        anchorRef={triggerRef}
        role="menu"
        ariaLabel={`Ações do projeto ${project.nome}`}
        minWidth={224}
        maxWidth={224}
        maxHeight={360}
        className="p-1.5"
      >
        <div onKeyDown={handleMenuKeyDown}>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => runAction(onEdit, true)} disabled={editing} aria-busy={editing} className={cn(menuItemClass, 'disabled:cursor-wait disabled:opacity-50')}>
            <img src={editIcon} alt="" aria-hidden="true" width={20} height={20} /> {editing ? 'Carregando projeto…' : 'Editar projeto'}
          </button>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => runAction(onDocuments)} className={menuItemClass}>
            <Files aria-hidden="true" className="h-5 w-5" /> Documentos
          </button>
          <div role="separator" className="my-1 border-t border-brand-border" />
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => runAction(onGeneratePdf, true)} className={menuItemClass}>
            <img src={pdfIcon} alt="" aria-hidden="true" width={20} height={20} /> Gerar relatório PDF
          </button>
          {canOpenInWindows && (
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => runAction(onOpenWindows, true)} className={menuItemClass}>
              <img src={windowsIcon} alt="" aria-hidden="true" width={20} height={20} /> Abrir no Windows
            </button>
          )}
          <div role="separator" className="my-1 border-t border-brand-border" />
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => runAction(onDelete)} className={cn(menuItemClass, 'text-red-700 hover:bg-red-50 dark:text-red-200 dark:hover:bg-red-950/50')}>
            <Trash aria-hidden="true" className="h-5 w-5" /> Excluir projeto
          </button>
        </div>
      </PopoverSurface>
    </div>
  );
}

type ProjectMetricTone = 'brand' | 'neutral' | 'positive' | 'warning' | 'danger';

const projectMetricToneClasses: Record<ProjectMetricTone, { accent: string; icon: string }> = {
  brand: {
    accent: 'bg-brand-primary-500',
    icon: 'bg-brand-primary-400/10 text-brand-primary-700 ring-brand-primary-300/30 dark:text-brand-primary-200'
  },
  neutral: {
    accent: 'bg-brand-blue-500',
    icon: 'bg-brand-blue-400/10 text-brand-blue-700 ring-brand-blue-300/30 dark:text-brand-blue-200'
  },
  positive: {
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-400/10 text-emerald-700 ring-emerald-300/30 dark:text-emerald-200'
  },
  warning: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-400/10 text-amber-700 ring-amber-300/30 dark:text-amber-200'
  },
  danger: {
    accent: 'bg-red-500',
    icon: 'bg-red-400/10 text-red-700 ring-red-300/30 dark:text-red-200'
  }
};

function ProjectMetricCard({
  label,
  value,
  helper,
  icon,
  tone = 'neutral',
  onClick,
  selected = false
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: ReactNode;
  tone?: ProjectMetricTone;
  onClick?: () => void;
  selected?: boolean;
}) {
  const toneClasses = projectMetricToneClasses[tone];
  const content = (
    <>
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0 text-sm font-medium leading-5 text-zinc-600 dark:text-zinc-300">{label}</span>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', toneClasses.icon)}>{icon}</span>
      </span>
      <span className="mt-3 min-w-0">
        <span className="block break-words text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">{value}</span>
        {helper && <span className="mt-1 block text-xs leading-5 text-zinc-600 dark:text-zinc-400">{helper}</span>}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn('geo-card geo-focus-ring relative flex min-h-[116px] min-w-0 touch-manipulation flex-col justify-between p-4 text-left transition-[border-color,background-color,box-shadow] hover:border-brand-primary-300/70 hover:bg-brand-primary-50/30 sm:p-5 dark:hover:bg-brand-primary-400/5', selected && 'border-brand-primary-400 ring-2 ring-brand-primary-500/20')}
      >
        {content}
      </button>
    );
  }

  return (
    <article className="geo-card relative flex min-h-[116px] min-w-0 flex-col justify-between p-4 sm:p-5">
      {content}
    </article>
  );
}

function ProjectsPageSkeleton({ variant = 'grid' }: { variant?: 'list' | 'grid' | 'statistics' }) {
  if (variant === 'statistics') {
    return (
      <div role="status" aria-label="Carregando estatísticas dos projetos" aria-busy="true" className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="geo-card h-[132px]" />
          ))}
        </div>
        <Skeleton className="geo-card h-40" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <Skeleton className="geo-card h-[340px] md:col-span-8" />
          <Skeleton className="geo-card h-[340px] md:col-span-4" />
        </div>
        <span className="sr-only">Carregando estatísticas…</span>
      </div>
    );
  }

  return (
    <div role="status" aria-label="Carregando projetos" aria-busy="true" className="space-y-3">
      <Skeleton className="geo-surface h-20" />
      <div className="geo-surface space-y-3 p-3 sm:p-4">
        <Skeleton className="h-11 rounded-lg" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>
      <Skeleton className="h-[60px] rounded-xl" />
      {variant === 'list' ? (
        <div className="geo-card overflow-hidden">
          <div className="hidden h-11 border-b border-brand-border bg-brand-surface-subtle/60 lg:block" />
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid min-h-[104px] grid-cols-1 gap-3 border-b border-brand-border px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.4fr)_minmax(135px,.65fr)_minmax(170px,.9fr)_minmax(150px,.7fr)_auto] lg:items-center lg:px-5">
              <span className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </span>
              <Skeleton className="h-7 w-24 rounded-full" />
              <span className="hidden space-y-2 lg:block">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </span>
              <Skeleton className="hidden h-4 w-28 lg:block" />
              <span className="flex justify-end gap-2">
                <Skeleton className="h-11 w-32 rounded-lg" />
                <Skeleton className="h-11 w-11 rounded-lg" />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="geo-card h-[300px]" />
          ))}
        </div>
      )}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function ListagemProjetos() {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRouteActionRef = useRef(false);
  const viewTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const viewNavigationRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [modalContext, setModalContext] = useState<ProjectModalContext>('projeto');
  const [initialProjectTab, setInitialProjectTab] = useState<ProjectModalTab>('projeto');
  const [initialProjectClientId, setInitialProjectClientId] = useState('');
  const [projectSuccessMessage, setProjectSuccessMessage] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => Boolean(searchParams.get('status') || searchParams.get('tipo') || searchParams.get('inicio') || searchParams.get('fim')));

  const viewParam = searchParams.get('visualizacao') || (typeof window !== 'undefined' ? window.sessionStorage.getItem('geogestor-project-view') : null);
  const viewMode: ProjectViewMode = viewParam === 'estatisticas'
      ? 'operacional'
      : viewParam === 'grade'
        ? 'grid'
        : 'list';
  const searchTerm = searchParams.get('busca') || '';
  const statusFilter = searchParams.get('status') || 'Todos';
  const tipoFilter = searchParams.get('tipo') || 'Todos';
  const dataInicioFilter = searchParams.get('inicio') || '';
  const dataFimFilter = searchParams.get('fim') || '';
  const statusCategory = searchParams.get('situacao') || '';
  const requestedPage = Number(searchParams.get('pagina'));
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const requestedPageSize = Number(searchParams.get('porPagina'));
  const pageSize = [12, 24, 48].includes(requestedPageSize) ? requestedPageSize : 24;
  const requestedSortOrder = searchParams.get('ordenar');
  const sortOrder = projectSortOrders.includes(requestedSortOrder as typeof projectSortOrders[number])
    ? requestedSortOrder as typeof projectSortOrders[number]
    : 'updated_desc';
  const delayedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedSearchTerm = searchTerm ? delayedSearchTerm : '';

  useEffect(() => {
    const value = viewMode === 'operacional' ? 'estatisticas' : viewMode === 'grid' ? 'grade' : 'lista';
    window.sessionStorage.setItem('geogestor-project-view', value);
    if (!searchParams.has('visualizacao')) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('visualizacao', value);
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, viewMode]);

  useEffect(() => {
    const visualizacao = searchParams.get('visualizacao');
    const situacao = searchParams.get('situacao');
    const validView = !visualizacao || ['lista', 'grade', 'estatisticas'].includes(visualizacao);
    const validSituation = !situacao || ['late', 'in_progress', 'completed', 'other'].includes(situacao);
    const validPage = !searchParams.has('pagina') || (Number.isInteger(requestedPage) && requestedPage >= 1);
    const validPageSize = !searchParams.has('porPagina') || [12, 24, 48].includes(requestedPageSize);
    const validSort = !requestedSortOrder || projectSortOrders.includes(requestedSortOrder as typeof projectSortOrders[number]);
    if (validView && validSituation && validPage && validPageSize && validSort) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!validView) next.set('visualizacao', 'lista');
      if (!validSituation) next.delete('situacao');
      if (!validPage) next.delete('pagina');
      if (!validPageSize) next.delete('porPagina');
      if (!validSort) next.delete('ordenar');
      return next;
    }, { replace: true });
  }, [requestedPage, requestedPageSize, requestedSortOrder, searchParams, setSearchParams]);

  const updateProjectQuery = useCallback((key: string, value: string, defaultValue = '') => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
      if (key !== 'pagina' && key !== 'visualizacao') next.delete('pagina');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setViewMode = useCallback((mode: ProjectViewMode) => {
    const urlValue = mode === 'operacional' ? 'estatisticas' : mode === 'grid' ? 'grade' : 'lista';
    updateProjectQuery('visualizacao', urlValue);
  }, [updateProjectQuery]);
  const handleViewTabKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % projectViewTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + projectViewTabs.length) % projectViewTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = projectViewTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setViewMode(projectViewTabs[nextIndex].mode);
    viewTabRefs.current[nextIndex]?.focus();
  }, [setViewMode]);
  useEffect(() => {
    const activeIndex = projectViewTabs.findIndex((tab) => tab.mode === viewMode);
    const frame = window.requestAnimationFrame(() => {
      const container = viewNavigationRef.current;
      const activeTab = viewTabRefs.current[activeIndex];
      if (!container || !activeTab) return;
      container.scrollTo({
        left: activeTab.offsetLeft - (container.clientWidth - activeTab.offsetWidth) / 2,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reduceMotion, viewMode]);
  const setSearchTerm = useCallback((value: string) => updateProjectQuery('busca', value), [updateProjectQuery]);
  const clearSearchAndFocus = useCallback(() => {
    setSearchTerm('');
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [setSearchTerm]);
  const setStatusFilter = useCallback((value: string) => updateProjectQuery('status', value, 'Todos'), [updateProjectQuery]);
  const setTipoFilter = useCallback((value: string) => updateProjectQuery('tipo', value, 'Todos'), [updateProjectQuery]);
  const setDataInicioFilter = useCallback((value: string) => updateProjectQuery('inicio', value), [updateProjectQuery]);
  const setDataFimFilter = useCallback((value: string) => updateProjectQuery('fim', value), [updateProjectQuery]);
  const setStatusCategory = useCallback((value: string) => updateProjectQuery('situacao', value), [updateProjectQuery]);
  const toggleStatusCategory = useCallback((value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (next.get('situacao') === value) next.delete('situacao');
      else next.set('situacao', value);
      next.delete('status');
      next.delete('pagina');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const setPageSize = useCallback((value: string) => updateProjectQuery('porPagina', value, '24'), [updateProjectQuery]);
  const setSortOrder = useCallback((value: string) => updateProjectQuery('ordenar', value, 'updated_desc'), [updateProjectQuery]);
  const clearProjectFilters = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      ['busca', 'status', 'tipo', 'inicio', 'fim', 'situacao', 'pagina'].forEach((key) => next.delete(key));
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const clearProjectDateFilters = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('inicio');
      next.delete('fim');
      next.delete('pagina');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Local files preview states
  const [showArquivosModal, setShowArquivosModal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Excluir',
    onConfirm: () => {}
  });

  // Queries
  const baseFilterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearchTerm.trim()) params.set('q', debouncedSearchTerm.trim());
    if (statusFilter !== 'Todos') params.set('status', statusFilter);
    if (tipoFilter !== 'Todos') params.set('tipo', tipoFilter);
    if (dataInicioFilter) params.set('inicio', dataInicioFilter);
    if (dataFimFilter) params.set('fim', dataFimFilter);
    if (statusCategory) params.set('situacao', statusCategory);
    return params.toString();
  }, [dataFimFilter, dataInicioFilter, debouncedSearchTerm, statusCategory, statusFilter, tipoFilter]);
  const [sort, direction] = sortOrder.split('_') as [string, string];

  const {
    data: projectPage,
    isLoading: projectsLoading,
    isFetching: projectsFetching,
    isError: projectsError,
    error: projectsErrorDetails,
    refetch: refetchProjects
  } = useQuery<ProjectPage>({
    queryKey: ['projetos', 'page', page, pageSize, sortOrder, baseFilterParams],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams(baseFilterParams);
      params.set('mode', 'page');
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      params.set('sort', sort || 'updated');
      params.set('direction', direction === 'asc' ? 'asc' : 'desc');
      return apiClient.get<ProjectPage>(`/api/projetos?${params}`, { signal });
    },
    placeholderData: (previous) => previous
  });
  const projetos = projectPage?.items || [];
  const loading = projectsLoading;
  const pageError = projectsError && !projectPage;
  const refreshError = projectsError && Boolean(projectPage);
  const projectsRefreshing = projectsFetching && !projectsLoading;
  const totalProjetos = projectPage?.total || 0;

  const {
    data: projectOverview,
    isLoading: operationalLoading,
    isError: operationalError,
    refetch: refetchProjectOverview
  } = useQuery<ProjectOverview>({
    queryKey: ['projetos', 'overview', baseFilterParams],
    queryFn: ({ signal }) => apiClient.get<ProjectOverview>(`/api/projetos/overview${baseFilterParams ? `?${baseFilterParams}` : ''}`, { signal }),
    staleTime: 30_000,
    placeholderData: (previous) => previous
  });

  const { data: filterOptions } = useQuery<ProjectFilterOptions>({
    queryKey: ['projetos', 'filters'],
    queryFn: ({ signal }) => apiClient.get<ProjectFilterOptions>('/api/projetos/filters', { signal }),
    staleTime: 60_000
  });

  const projetosConcluidos = projectOverview?.completed ?? 0;
  const projetosEmAndamento = projectOverview?.inProgress ?? 0;
  const projetosAtrasados = projectOverview?.late ?? 0;
  const projetosOutros = projectOverview?.other ?? 0;

  const statusPieData = useMemo(() => [
    { name: 'Concluído', value: projetosConcluidos, color: chartColors.positive },
    { name: 'Em Andamento', value: projetosEmAndamento, color: chartColors.primary },
    { name: 'Atrasado', value: projetosAtrasados, color: chartColors.negative },
    { name: 'Outros', value: projetosOutros, color: chartColors.warning }
  ].filter(d => d.value > 0), [projetosAtrasados, projetosConcluidos, projetosEmAndamento, projetosOutros]);
  const statusPieTotal = statusPieData.reduce((total, item) => total + item.value, 0);

  const avgCompletionTime = projectOverview?.avgCompletionDays ?? null;
  const productivityRate = projectOverview?.productivityRate ?? null;
  const avgTicket = projectOverview?.avgApprovedBudgetCents ?? null;
  const topProjectsData = projectOverview?.topProjects ?? [];
  const projectTypeStats = projectOverview?.typeStats ?? [];
  const projectStatuses = useMemo(() => filterOptions?.statuses.map((item) => item.value) ?? [], [filterOptions?.statuses]);
  const projectTypes = useMemo(() => filterOptions?.types.map((item) => item.value) ?? [], [filterOptions?.types]);
  const filteredProjetos = projetos;
  const hasProjectFilters = Boolean(searchTerm || statusFilter !== 'Todos' || tipoFilter !== 'Todos' || dataInicioFilter || dataFimFilter || statusCategory);
  const unfilteredProjectCount = Math.max(
    filterOptions?.statuses.reduce((sum, item) => sum + item.count, 0) ?? 0,
    filterOptions?.types.reduce((sum, item) => sum + item.count, 0) ?? 0
  );
  const hasRegisteredProjects = hasProjectFilters || totalProjetos > 0 || unfilteredProjectCount > 0;
  const activeFilterCount = [
    Boolean(searchTerm.trim()),
    statusFilter !== 'Todos',
    tipoFilter !== 'Todos',
    Boolean(dataInicioFilter || dataFimFilter),
    Boolean(statusCategory)
  ].filter(Boolean).length;
  const activeSecondaryFilterCount = [
    statusFilter !== 'Todos',
    tipoFilter !== 'Todos',
    Boolean(dataInicioFilter || dataFimFilter),
    Boolean(statusCategory)
  ].filter(Boolean).length;
  const periodSummary = dataInicioFilter && dataFimFilter
    ? `${formatProjectDate(dataInicioFilter)} a ${formatProjectDate(dataFimFilter)}`
    : dataInicioFilter
      ? `A partir de ${formatProjectDate(dataInicioFilter)}`
      : dataFimFilter
        ? `Até ${formatProjectDate(dataFimFilter)}`
        : '';
  const statusCategoryLabel = statusCategory === 'late'
    ? 'Atrasados'
    : statusCategory === 'completed'
      ? 'Concluídos'
      : 'Em andamento';
  const rangeStart = totalProjetos === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalProjetos);
  const totalPages = projectPage?.totalPages || 1;
  const paginationStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const paginationPages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => paginationStart + index);
  const filteredProjectsLabel = totalProjetos === 0
    ? 'Nenhum projeto exibido'
    : `Exibindo ${numberFormatter.format(rangeStart)}–${numberFormatter.format(rangeEnd)} de ${numberFormatter.format(totalProjetos)} ${totalProjetos === 1 ? 'projeto' : 'projetos'}`;
  const canOpenInWindows = typeof window !== 'undefined' && Boolean(window.electronAPI);

  const { data: filesData = { files: [], path: '' }, isLoading: arquivosLoading } = useQuery<{ files: ProjetoArquivo[], path: string }>({
    queryKey: ['projeto-arquivos', showArquivosModal],
    queryFn: async () => {
      if (!showArquivosModal) return { files: [], path: '' };
      try {
        const data = await apiClient.get<{ files?: ProjetoArquivo[], path?: string }>(`/api/arquivos/projeto/${showArquivosModal}`);
        return { files: data.files || [], path: data.path || '' };
      } catch {
        return { files: [], path: '' };
      }
    },
    enabled: !!showArquivosModal
  });

  const projetoArquivos = filesData.files;
  const arquivosPasta = filesData.path;

  // Mutations
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/projetos/${id}`);
    },
    onSuccess: () => {
      setConfirmData(prev => ({ ...prev, isOpen: false }));
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      queryClient.invalidateQueries({ queryKey: ['stats-geral'] });
      queryClient.invalidateQueries({ queryKey: ['projetos-notificacoes'] });
      setProjectSuccessMessage('Projeto excluído com sucesso.');
      toast.success('Projeto excluído com sucesso.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir projeto';
      toast.error(msg);
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!showArquivosModal) return;
      const formData = new FormData();
      formData.append('projetoId', showArquivosModal);
      formData.append('file', file);

      await apiClient.post('/api/arquivos/upload/stream', formData);
    },
    onSuccess: () => {
      setConfirmData(prev => ({ ...prev, isOpen: false }));
      queryClient.invalidateQueries({ queryKey: ['projeto-arquivos', showArquivosModal] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao enviar arquivo: ${msg}`);
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiClient.delete(`/api/arquivos?path=${encodeURIComponent(filePath)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto-arquivos', showArquivosModal] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir o arquivo.';
      toast.error(msg);
    }
  });

  // Action methods
  const openCreateModal = useCallback((initialClienteId?: string, initialTab: ProjectModalTab = 'projeto', contexto: ProjectModalContext = 'projeto') => {
    const nextClienteId = initialClienteId || '';
    setSelectedProjeto(null);
    setModalContext(contexto);
    setInitialProjectClientId(nextClienteId);
    setInitialProjectTab(initialTab);
    setShowModal(true);
  }, []);

  const openEditModal = async (proj: Projeto) => {
    setEditingProjectId(proj.id);
    try {
      const detailedProject = await apiClient.get<Projeto>(`/api/projetos/${proj.id}`);
      const nextContext: ProjectModalContext = detailedProject.tipo === 'Ambiental'
        ? 'ambiental'
        : detailedProject.tipo === 'Licenciamento'
          ? 'licenciamento'
          : 'projeto';
      setSelectedProjeto(detailedProject);
      setModalContext(nextContext);
      setInitialProjectClientId('');
      setInitialProjectTab('projeto');
      setShowModal(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar os dados completos do projeto.');
    } finally {
      setEditingProjectId(null);
    }
  };

  useEffect(() => {
    const routeState = location.state as { createForClienteId?: string; modalTab?: ProjectModalTab; openCreateModal?: boolean; contexto?: string } | null;
    if (handledRouteActionRef.current || (!routeState?.createForClienteId && !routeState?.openCreateModal)) return;

    handledRouteActionRef.current = true;
    const routeContext: ProjectModalContext = routeState.contexto === 'ambiental' || routeState.contexto === 'licenciamento'
      ? routeState.contexto
      : 'projeto';
    openCreateModal(routeState.createForClienteId, routeState.modalTab || 'projeto', routeContext);
  }, [location.state, openCreateModal]);

  const handleDelete = (id: string, name: string) => {
    setConfirmData({
      isOpen: true,
      title: `Excluir projeto “${name}”?`,
      description: `O projeto “${name}” será removido do GeoGestor somente se não possuir vínculos ativos. Desvincule tarefas, documentos e registros financeiros antes de continuar. Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir projeto',
      onConfirm: () => deleteProjectMutation.mutate(id)
    });
  };

  const handleGenerateProjectPdf = async (projeto: Projeto) => {
    try {
      const { gerarRelatorioProjeto } = await import('../../utils/pdfGenerator');
      await gerarRelatorioProjeto(projeto);
      setProjectSuccessMessage(`Relatório de ${projeto.nome} gerado com sucesso.`);
      toast.success('Relatório PDF gerado com sucesso.');
    } catch {
      toast.error('Erro ao gerar o PDF do projeto.');
    }
  };

  const handleAbrirPasta = async (id: string) => {
    try {
      await openProjectFolder(id);
      setProjectSuccessMessage('Pasta do projeto aberta no Windows.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao tentar abrir a pasta.';
      toast.error(msg);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      uploadFileMutation.mutate(file);
    } catch {
      toast.error('Erro ao processar o arquivo.');
      setUploading(false);
    }
  };

  const handleFileDelete = (filePath: string) => {
    setConfirmData({
      isOpen: true,
      title: `Excluir arquivo “${filePath.split(/[\\/]/).pop() || 'arquivo'}”?`,
      description: 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do projeto. Esta ação não pode ser desfeita.',
      confirmText: 'Excluir arquivo',
      onConfirm: () => deleteFileMutation.mutate(filePath)
    });
  };

  const renderProjectActions = (projeto: Projeto) => (
    <ProjectActionsMenu
      project={projeto}
      canOpenInWindows={canOpenInWindows}
      editing={editingProjectId === projeto.id}
      onDocuments={() => setShowArquivosModal(projeto.id)}
      onGeneratePdf={() => handleGenerateProjectPdf(projeto)}
      onEdit={() => openEditModal(projeto)}
      onOpenWindows={() => handleAbrirPasta(projeto.id)}
      onDelete={() => handleDelete(projeto.id, projeto.nome)}
    />
  );

  const renderProjectDateFilters = () => (
    <div aria-label="Período de início do projeto" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DatePickerField name="project-start-date" autoComplete="off" placeholder="Início a partir de" value={dataInicioFilter} onChange={(event) => setDataInicioFilter(event.target.value)} wrapperClassName="min-w-0" className="h-11 min-h-11 min-w-0 cursor-pointer text-xs font-semibold" aria-label="Projetos iniciados a partir de" />
      <DatePickerField name="project-end-date" autoComplete="off" placeholder="Início até" value={dataFimFilter} onChange={(event) => setDataFimFilter(event.target.value)} wrapperClassName="min-w-0" className="h-11 min-h-11 min-w-0 cursor-pointer text-xs font-semibold" aria-label="Projetos iniciados até" />
    </div>
  );

  const renderActiveFilterChips = () => (
    <>
      {searchTerm.trim() && <button type="button" onClick={() => setSearchTerm('')} aria-label={`Remover filtro de busca: ${searchTerm}`} title={searchTerm} className={activeFilterChipClass}><span className="max-w-[180px] truncate">Busca: {searchTerm}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button>}
      {statusFilter !== 'Todos' && <button type="button" onClick={() => setStatusFilter('Todos')} aria-label={`Remover filtro de status: ${statusFilter}`} className={activeFilterChipClass}><span className="max-w-[180px] truncate">Status: {statusFilter}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button>}
      {tipoFilter !== 'Todos' && <button type="button" onClick={() => setTipoFilter('Todos')} aria-label={`Remover filtro de tipo: ${tipoFilter}`} className={activeFilterChipClass}><span className="max-w-[180px] truncate">Tipo: {tipoFilter}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button>}
      {periodSummary && <button type="button" onClick={clearProjectDateFilters} aria-label={`Remover filtro de período: ${periodSummary}`} title={periodSummary} className={activeFilterChipClass}><span className="max-w-[220px] truncate">Período: {periodSummary}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button>}
      {statusCategory && <button type="button" onClick={() => setStatusCategory('')} aria-label={`Remover filtro de situação: ${statusCategoryLabel}`} className={activeFilterChipClass}><span className="truncate">Situação: {statusCategoryLabel}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button>}
    </>
  );

  return (
    <Layout>
      <PageHeader
        eyebrow="Operações"
        title="Projetos"
        description="Monitoramento de processos ambientais, georreferenciamento e topografia."
        action={
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="geo-focus-ring inline-flex h-11 min-h-11 touch-manipulation items-center justify-center gap-2 rounded-lg bg-brand-primary-600 px-5 text-sm font-semibold text-white shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-brand-primary-700 hover:shadow-md active:scale-[0.98] dark:bg-brand-primary-500 dark:hover:bg-brand-primary-400"
          >
            <Plus aria-hidden="true" weight="bold" className="h-4 w-4" />
            <span>Novo projeto</span>
          </button>
        }
        navigation={
          <nav ref={viewNavigationRef} aria-label="Selecionar visualização" className={localNavigationBarClass}>
            <div role="tablist" aria-label="Formato da visualização dos projetos" className="grid w-full min-w-0 grid-cols-3 gap-1 lg:w-max lg:min-w-[32rem] lg:gap-3">
              {projectViewTabs.map((tab, index) => {
                const selected = viewMode === tab.mode;
                const tone = tab.mode === 'operacional' ? 'finance' : tab.mode === 'grid' ? 'field' : 'system';
                const icon = tab.mode === 'list'
                  ? <ListBullets aria-hidden="true" className="h-4 w-4 lg:h-6 lg:w-6" weight="duotone" />
                  : tab.mode === 'grid'
                    ? <SquaresFour aria-hidden="true" className="h-4 w-4 lg:h-6 lg:w-6" weight="duotone" />
                    : <img src={statisticsTabIcon} alt="" aria-hidden="true" width={26} height={26} className="h-[18px] w-[18px] object-contain lg:h-[26px] lg:w-[26px]" />;

                return (
                  <button
                    key={tab.mode}
                    id={`project-tab-${tab.mode}`}
                    ref={(node) => { viewTabRefs.current[index] = node; }}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={selected ? `project-panel-${tab.mode}` : undefined}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setViewMode(tab.mode)}
                    onKeyDown={(event) => handleViewTabKeyDown(event, index)}
                    className={localNavigationButtonClass(selected, tone, 'w-full min-w-0 justify-center gap-1 px-1.5 text-xs sm:px-1.5 lg:justify-start lg:gap-2 lg:px-6 lg:text-sm')}
                  >
                    <span aria-hidden="true" className={localNavigationIconClass(selected, tone, 'h-5 w-5 overflow-hidden rounded-md bg-transparent p-0 lg:h-8 lg:w-8 lg:rounded-xl dark:bg-transparent')}>
                      {icon}
                    </span>
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        }
      />

      {loading ? (
        <ProjectsPageSkeleton variant={viewMode === 'operacional' ? 'statistics' : viewMode} />
      ) : pageError ? (
        <section role="alert" className="geo-card flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-400/10 text-red-600 ring-1 ring-red-400/20 dark:text-red-300">
            <Warning aria-hidden="true" weight="duotone" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-semibold text-zinc-950 dark:text-white">Não foi possível carregar os projetos</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Verifique se o serviço local está em execução e tente novamente.
            {projectsErrorDetails instanceof Error && <span className="sr-only"> {projectsErrorDetails.message}</span>}
          </p>
          <button
            type="button"
            onClick={() => void refetchProjects()}
            className={cn(secondarySmallActionButtonClass, 'mt-6 min-h-11 px-5')}
          >
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          {viewMode !== 'operacional' && hasRegisteredProjects && (
            <div className="mb-3 space-y-3">
              <section aria-label="Resumo dos projetos" className="geo-surface flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex shrink-0 items-center gap-3 px-1">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-400/10 dark:text-brand-primary-100"><Folder aria-hidden="true" className="h-4 w-4" /></span>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total de projetos</p>
                    <p className="text-lg font-semibold text-zinc-950 tabular-nums dark:text-white">{operationalLoading ? '—' : numberFormatter.format(projectOverview?.total ?? totalProjetos)}</p>
                  </div>
                </div>
                <div role="group" aria-label="Filtrar rapidamente por situação" className="grid grid-cols-3 gap-1 rounded-lg bg-brand-surface-subtle p-1 lg:min-w-[430px]">
                  {[
                    { key: 'in_progress', label: 'Em andamento', value: projetosEmAndamento, dot: 'bg-amber-500' },
                    { key: 'late', label: 'Atrasados', value: projetosAtrasados, dot: 'bg-red-500' },
                    { key: 'completed', label: 'Concluídos', value: projetosConcluidos, dot: 'bg-emerald-500' }
                  ].map((item) => (
                    <button key={item.key} type="button" aria-pressed={statusCategory === item.key} onClick={() => toggleStatusCategory(item.key)} className={cn('geo-focus-ring flex min-h-11 min-w-0 touch-manipulation items-center justify-center gap-1 rounded-md px-0.5 text-[10px] font-medium leading-4 text-zinc-600 transition-[background-color,color,box-shadow,transform] hover:bg-white active:scale-[0.98] lg:gap-2 lg:px-2 lg:text-xs dark:text-zinc-300 dark:hover:bg-zinc-800', statusCategory === item.key && 'bg-white font-semibold text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white')}>
                      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', item.dot)} />
                      <span className="min-w-0 text-center">{item.label}</span>
                      <span className="tabular-nums">{numberFormatter.format(item.value)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section aria-label="Busca e filtros de projetos" className="geo-surface p-3 sm:px-4 sm:py-3">
                <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="relative min-w-0 flex-1">
                    <label htmlFor="project-search" className="sr-only">Buscar projetos</label>
                    <MagnifyingGlass aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input ref={searchInputRef} id="project-search" name="busca-projetos" type="search" autoComplete="off" spellCheck={false} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar projeto, cliente, cidade, matrícula ou CAR…" className={cn(filterSearchInputClass, 'h-11 min-h-11 pr-12 [&::-webkit-search-cancel-button]:appearance-none')} />
                    {searchTerm && (
                      <button
                        type="button"
                        aria-label="Limpar busca"
                        title="Limpar busca"
                        onClick={clearSearchAndFocus}
                        className="geo-focus-ring absolute right-0 top-0 flex h-11 w-11 touch-manipulation items-center justify-center rounded-r-lg text-zinc-500 transition-[background-color,color,transform] hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-expanded={filtersOpen}
                    aria-controls="project-filter-panel"
                    onClick={() => setFiltersOpen((open) => !open)}
                    className="geo-button-base geo-button-secondary geo-focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm"
                  >
                    <FunnelSimple aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>Filtros</span>
                    {activeSecondaryFilterCount > 0 && <span className="rounded-full bg-brand-primary-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{activeSecondaryFilterCount}</span>}
                    <CaretDown aria-hidden="true" weight="bold" className={cn('h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none', filtersOpen && 'rotate-180')} />
                  </button>
                  <CustomSelect id="project-sort" name="ordenacao-projetos" ariaLabel="Ordenar projetos" className="w-full min-w-0 lg:w-[250px]" buttonClassName="h-11 min-h-11 w-full" highlightActive={false} value={sortOrder} onChange={setSortOrder} placeholder="Ordenar projetos" options={[{ label: 'Atualizados recentemente', value: 'updated_desc' }, { label: 'Prazo mais próximo', value: 'deadline_asc' }, { label: 'Prazo mais distante', value: 'deadline_desc' }, { label: 'Nome: A–Z', value: 'name_asc' }, { label: 'Nome: Z–A', value: 'name_desc' }, { label: 'Cliente: A–Z', value: 'client_asc' }, { label: 'Status: A–Z', value: 'status_asc' }]} />
                  <CustomSelect id="project-page-size" name="itens-por-pagina" ariaLabel="Projetos por página" className="w-full min-w-0 lg:w-[168px]" buttonClassName="h-11 min-h-11 w-full" highlightActive={false} value={String(pageSize)} onChange={setPageSize} placeholder="Projetos por página" options={[12, 24, 48].map((size) => ({ label: `${size} por página`, value: String(size) }))} />
                  {hasProjectFilters && <button type="button" onClick={clearProjectFilters} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 shrink-0 px-4 text-sm">Limpar</button>}
                </div>

                {filtersOpen && (
                  <motion.div id="project-filter-panel" initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }} className="mt-3 grid gap-3 border-t border-brand-border pt-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,0.7fr)_minmax(220px,0.7fr)_minmax(360px,1.4fr)]">
                    <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300"><span>Status</span><CustomSelect id="project-status-filter" name="status-projeto" ariaLabel="Filtrar por status" className="w-full min-w-0" buttonClassName="h-11 min-h-11 w-full" value={statusFilter} onChange={setStatusFilter} placeholder="Todos os status" options={[{ label: 'Todos os status', value: 'Todos' }, ...projectStatuses.map((value) => ({ label: value, value }))]} /></label>
                    <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300"><span>Tipo</span><CustomSelect id="project-type-filter" name="tipo-projeto" ariaLabel="Filtrar por tipo" className="w-full min-w-0" buttonClassName="h-11 min-h-11 w-full" value={tipoFilter} onChange={setTipoFilter} placeholder="Todos os tipos" options={[{ label: 'Todos os tipos', value: 'Todos' }, ...projectTypes.map((value) => ({ label: value, value }))]} /></label>
                    <div className="space-y-1.5 md:col-span-2 xl:col-span-1"><p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Período de início</p>{renderProjectDateFilters()}</div>
                  </motion.div>
                )}
                <div className="mt-2 flex min-w-0 flex-col gap-2 border-t border-brand-border pt-2 sm:flex-row sm:items-center sm:justify-between">
                  {hasProjectFilters ? <div aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-2">{renderActiveFilterChips()}</div> : <span />}
                  <div role="status" aria-live="polite" aria-atomic="true" className="flex min-h-8 shrink-0 items-center justify-end gap-3 text-right">
                    <p className="text-sm font-medium text-zinc-600 tabular-nums dark:text-zinc-300">{filteredProjectsLabel}</p>
                    {projectsRefreshing && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary-700 dark:text-brand-primary-200"><span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-primary-200 border-t-brand-primary-600 motion-reduce:animate-none" />Atualizando…</span>}
                  </div>
                </div>
                <div className="sr-only" aria-live="polite" aria-atomic="true">
                  {activeFilterCount === 0 ? 'Nenhum filtro ativo.' : `${activeFilterCount} ${activeFilterCount === 1 ? 'filtro ativo' : 'filtros ativos'}.`} {filteredProjectsLabel}.
                </div>
              </section>
            </div>
          )}

          {viewMode === 'operacional' && hasProjectFilters && (
            <section aria-label="Filtros ativos das estatísticas" className="geo-surface mb-5 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeFilterCount} {activeFilterCount === 1 ? 'filtro aplicado' : 'filtros aplicados'} às estatísticas
                </p>
                <button type="button" onClick={clearProjectFilters} className="geo-focus-ring min-h-11 touch-manipulation rounded-lg px-3 text-xs font-semibold text-zinc-500 transition-[background-color,color,transform] hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">Limpar filtros</button>
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">{renderActiveFilterChips()}</div>
            </section>
          )}

          {viewMode !== 'operacional' && refreshError && (
            <section role="alert" className="mb-3 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/50 dark:bg-red-950/30">
              <div className="flex min-w-0 items-start gap-3">
                <Warning aria-hidden="true" weight="duotone" className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-red-900 dark:text-red-100">Não foi possível atualizar os projetos</h2>
                  <p className="mt-0.5 text-xs leading-5 text-red-700 dark:text-red-200">Os resultados anteriores continuam visíveis. Verifique o serviço local e tente novamente.</p>
                </div>
              </div>
              <button type="button" onClick={() => void refetchProjects()} className={cn(secondarySmallActionButtonClass, 'min-h-11 shrink-0 px-4')}>Tentar novamente</button>
            </section>
          )}

          <AnimatePresence mode="wait">
        {viewMode === 'operacional' && (
          <motion.div
            id="project-panel-operacional"
            key="operacional"
            role="tabpanel"
            aria-labelledby="project-tab-operacional"
            tabIndex={0}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
            className="space-y-6"
          >
          {!hasRegisteredProjects ? (
            <section className="geo-card flex min-h-[380px] flex-col items-center justify-center px-6 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-400/20 dark:text-emerald-200">
                <ChartBar aria-hidden="true" weight="duotone" className="h-8 w-8" />
              </span>
              <h2 className="mt-6 text-xl font-semibold text-zinc-950 dark:text-white sm:text-2xl">Ainda não há dados para gerar estatísticas</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">
                Cadastre o primeiro projeto para acompanhar produtividade, prazos, custos, receitas e distribuição por status.
              </p>
              <button type="button" onClick={() => openCreateModal()} className={cn(primarySmallActionButtonClass, 'mt-7 min-h-11 px-5')}>
                <Plus aria-hidden="true" weight="bold" className="h-4 w-4" />
                Criar primeiro projeto
              </button>
            </section>
          ) : operationalLoading ? (
            <ProjectsPageSkeleton variant="statistics" />
          ) : operationalError ? (
            <section role="alert" className="geo-card flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <Warning aria-hidden="true" weight="duotone" className="h-8 w-8 text-red-500" />
              <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">Não foi possível carregar os indicadores financeiros</h2>
              <p className="mt-2 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">Os projetos continuam disponíveis. Tente carregar novamente os dados de custos e receitas.</p>
              <button type="button" onClick={() => void refetchProjectOverview()} className={cn(secondarySmallActionButtonClass, 'mt-5 min-h-11 px-5')}>Tentar novamente</button>
            </section>
          ) : (
            <>
          <section aria-label="Indicadores operacionais" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ProjectMetricCard label="Total de projetos" value={numberFormatter.format(totalProjetos)} helper="Cadastrados no sistema" tone="brand" icon={<Folder aria-hidden="true" className="h-5 w-5" />} />
            <ProjectMetricCard
              label="Tempo médio de entrega"
              value={avgCompletionTime === null ? '—' : `${numberFormatter.format(avgCompletionTime)} ${avgCompletionTime === 1 ? 'dia' : 'dias'}`}
              helper={avgCompletionTime === null ? 'Sem dados suficientes' : 'Média dos projetos concluídos'}
              tone="neutral"
              icon={<Clock aria-hidden="true" className="h-5 w-5" />}
            />
            <ProjectMetricCard
              label="Produtividade"
              value={productivityRate === null ? '—' : `${numberFormatter.format(productivityRate)}%`}
              helper={productivityRate === null ? 'Sem dados suficientes' : 'Taxa geral de conclusão'}
              tone="positive"
              icon={<CheckCircle aria-hidden="true" className="h-5 w-5" />}
            />
            <ProjectMetricCard
              label="Valor médio dos projetos aprovados"
              value={avgTicket === null ? '—' : formatBRL(avgTicket)}
              helper={avgTicket === null ? 'Sem dados suficientes' : 'Com base em orçamentos aprovados'}
              tone="neutral"
              icon={<TrendUp aria-hidden="true" className="h-5 w-5" />}
            />
          </section>

          <section aria-labelledby="operational-overview-title" aria-live="polite" className="geo-card border-l-4 border-l-brand-primary-500 p-5 sm:p-6">
            <h2 id="operational-overview-title" className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
              <PresentationChart aria-hidden="true" className="h-5 w-5 text-brand-primary-600 dark:text-brand-primary-200" />
              Visão Geral Operacional
            </h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <p>
                A produtividade geral é de <strong className="text-zinc-950 tabular-nums dark:text-white">{numberFormatter.format(productivityRate ?? 0)}%</strong>.{' '}
                <strong className="text-zinc-950 tabular-nums dark:text-white">{formatProjectCount(projetosConcluidos)}</strong> {projetosConcluidos === 1 ? 'foi concluído' : 'foram concluídos'} e{' '}
                <strong className="text-zinc-950 tabular-nums dark:text-white">{formatProjectCount(projetosEmAndamento)}</strong> {projetosEmAndamento === 1 ? 'está em andamento' : 'estão em andamento'}.
              </p>
              <p>
                {avgCompletionTime === null
                  ? 'Ainda não há dados suficientes para calcular o tempo médio de entrega.'
                  : <>O tempo médio de entrega é de <strong className="text-zinc-950 tabular-nums dark:text-white">{numberFormatter.format(avgCompletionTime)} {avgCompletionTime === 1 ? 'dia' : 'dias'}</strong>.</>}
                {projetosOutros > 0 && <> Outros <strong className="text-zinc-950 tabular-nums dark:text-white">{formatProjectCount(projetosOutros)}</strong> aguardam início ou estão sob revisão.</>}
              </p>
              {projectTypeStats.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {projectTypeStats.map((item) => (
                    <span key={item.type} className={cn('geo-badge-base px-2.5 py-1 text-xs', getProjectTypeBadgeClass(item.type))}>
                      {item.type}: <span className="tabular-nums">{numberFormatter.format(item.count)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            
            {/* Custo vs Receita por Projeto */}
            <section aria-labelledby="cost-revenue-title" className="geo-card col-span-1 flex min-w-0 flex-col p-5 sm:p-6 md:col-span-8">
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 id="cost-revenue-title" className="text-base font-semibold text-zinc-950 dark:text-white">Custos versus receita estimada</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-400">Comparação dos cinco projetos com maior receita estimada.</p>
                </div>
                <FormSelect
                  name="tipo-grafico-projetos"
                  aria-label="Filtrar gráfico por tipo de projeto"
                  autoComplete="off"
                  value={tipoFilter}
                  onChange={(event) => setTipoFilter(event.target.value)}
                  className={cn(projectSelectClass, 'h-11 w-full px-3 py-2 text-xs sm:w-auto')}
                >
                  <option value="Todos">Todos os tipos</option>
                  {projectTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </FormSelect>
              </div>

              {topProjectsData.length === 0 ? (
                <div className="geo-empty-state flex min-h-[180px] flex-col items-center justify-center px-5 py-7 text-center">
                  <ChartBar aria-hidden="true" weight="duotone" className="h-8 w-8 text-zinc-400" />
                  <h2 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Sem dados financeiros para exibir</h2>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">Registre custos ou uma receita estimada para gerar esta comparação.</p>
                  {tipoFilter !== 'Todos' ? (
                    <button type="button" onClick={() => setTipoFilter('Todos')} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-11 px-4 text-xs')}>Ver todos os tipos</button>
                  ) : (
                    <Link to={APP_ROUTES.finance.path} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-11 px-4 text-xs')}>Abrir Financeiro</Link>
                  )}
                </div>
              ) : (
                <>
                <div aria-hidden="true" className="h-[280px] w-full min-w-0">
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={topProjectsData} accessibilityLayer={false}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                      <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis width={72} tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))} />
                      <RechartsTooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                      <Legend wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="Receita" fill={chartColors.positive} radius={[4, 4, 0, 0]} activeBar={chartActiveBar(chartColors.positive)} isAnimationActive={!reduceMotion} animationDuration={chartAnimationDuration} />
                      <Bar dataKey="Custo" fill={chartColors.negative} radius={[4, 4, 0, 0]} activeBar={chartActiveBar(chartColors.negative)} isAnimationActive={!reduceMotion} animationDuration={chartAnimationDuration} />
                      <Bar dataKey="Lucro" fill={chartColors.primary} radius={[4, 4, 0, 0]} activeBar={chartActiveBar(chartColors.primary)} isAnimationActive={!reduceMotion} animationDuration={chartAnimationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="sr-only">
                  <h3>Resumo textual de custos, receitas e lucros</h3>
                  <ul>
                    {topProjectsData.map((item) => (
                      <li key={item.name}>{item.name}: receita {currencyFormatter.format(item.Receita)}, custo {currencyFormatter.format(item.Custo)} e lucro {currencyFormatter.format(item.Lucro)}.</li>
                    ))}
                  </ul>
                </div>
                </>
              )}
            </section>

            {/* Status dos Projetos Pie */}
            <section aria-labelledby="project-status-title" className="geo-card col-span-1 flex min-w-0 flex-col justify-between p-5 sm:p-6 md:col-span-4">
              <div>
                <h2 id="project-status-title" className="text-base font-semibold text-zinc-950 dark:text-white">Distribuição por status</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-400">Situação dos projetos ativos e entregues.</p>
              </div>

              {statusPieData.length === 0 ? (
                <div className="geo-empty-state my-5 flex min-h-[180px] flex-col items-center justify-center px-5 py-7 text-center">
                  <PresentationChart aria-hidden="true" className="h-8 w-8 text-zinc-400" />
                  <h3 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Sem status para comparar</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Edite os projetos para informar a situação de cada trabalho.</p>
                  <button type="button" onClick={() => setViewMode('list')} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-11 px-4 text-xs')}>Abrir lista de projetos</button>
                </div>
              ) : (
              <>
              <div className="relative mx-auto h-[220px] w-full max-w-[240px]" role="img" aria-label={`Distribuição de ${formatProjectCount(statusPieTotal)} por status`}>
                  <ResponsiveContainer {...responsiveChartProps}>
                    <PieChart accessibilityLayer={false}>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius="48%"
                        outerRadius="78%"
                        paddingAngle={0}
                        cornerRadius={0}
                        dataKey="value"
                        nameKey="name"
                        rootTabIndex={-1}
                        stroke="none"
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setActiveStatusIndex(index)}
                        onMouseLeave={() => setActiveStatusIndex(null)}
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            style={chartSegmentStyle(Boolean(reduceMotion), activeStatusIndex !== null && activeStatusIndex !== index)}
                          />
                        ))}
                      </Pie>
                      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--text-primary))" className="text-[2rem] font-bold tabular-nums">
                        {numberFormatter.format(statusPieTotal)}
                      </text>
                      <text x="50%" y="57%" textAnchor="middle" dominantBaseline="central" fill={chartTextColor} className="text-xs font-medium">
                        {statusPieTotal === 1 ? 'Projeto' : 'Projetos'}
                      </text>
                      <RechartsTooltip content={<DynamicTooltip formatter={(value) => {
                        const count = Number(value);
                        return `${formatProjectCount(count)} · ${projectPercentFormatter.format(count / statusPieTotal)}`;
                      }} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="sr-only">
                    {statusPieData.map((item) => <li key={item.name}>{item.name}: {formatProjectCount(item.value)} ({projectPercentFormatter.format(item.value / statusPieTotal)})</li>)}
                  </ul>
              </div>

              <dl aria-label="Resumo da distribuição por status" className="grid grid-cols-2 gap-x-3 gap-y-4 border-t border-brand-border pt-4 text-center text-xs font-semibold text-zinc-600">
                {statusPieData.map(item => (
                  <div key={item.name} className="flex flex-col items-center">
                    <span aria-hidden="true" className="mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{item.name}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-zinc-800 tabular-nums dark:text-zinc-200">{numberFormatter.format(item.value)} {item.value === 1 ? 'projeto' : 'projetos'}</dd>
                  </div>
                ))}
              </dl>
              </>
              )}
            </section>

          </div>
            </>
          )}
          </motion.div>
        )}
        
        {viewMode === 'list' && (
          <motion.div
            id="project-panel-list"
            key="list"
            role="tabpanel"
            aria-labelledby="project-tab-list"
            aria-busy={projectsRefreshing}
            tabIndex={0}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            {!hasRegisteredProjects ? (
              <section className="geo-card flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
                <FolderOpen aria-hidden="true" weight="duotone" className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-200" />
                <h2 className="mt-5 text-xl font-semibold text-zinc-950 dark:text-white">Você ainda não possui projetos cadastrados</h2>
                <p className="mt-2 max-w-lg text-sm text-zinc-600 dark:text-zinc-300">Crie seu primeiro projeto para acompanhar clientes, prazos, documentos e resultados.</p>
                <button type="button" onClick={() => openCreateModal()} className={cn(primarySmallActionButtonClass, 'mt-6 min-h-11 px-5')}><Plus aria-hidden="true" className="h-4 w-4" /> Criar primeiro projeto</button>
              </section>
            ) : filteredProjetos.length === 0 ? (
              <section className="geo-empty-state flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
                <MagnifyingGlass aria-hidden="true" className="h-9 w-9 text-zinc-400" />
                <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">Nenhum resultado</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Ajuste os filtros ou os termos pesquisados.</p>
                <button type="button" onClick={clearProjectFilters} className={cn(secondarySmallActionButtonClass, 'mt-5 min-h-11 px-5')}>Limpar filtros</button>
              </section>
            ) : (
              <section aria-label="Lista de projetos" className="geo-card overflow-visible">
                <div aria-hidden="true" className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(135px,.65fr)_minmax(170px,.9fr)_minmax(150px,.7fr)_auto] gap-4 border-b border-brand-border bg-brand-surface-subtle/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 lg:grid dark:text-zinc-400">
                  <span>Projeto e cliente</span><span>Situação</span><span>Tipo e localização</span><span>Prazo</span><span>Ações</span>
                </div>
                <ul className="divide-y divide-brand-border">
                  {filteredProjetos.map((projeto) => (
                    <li key={projeto.id} className="content-auto grid min-w-0 grid-cols-1 gap-4 px-4 py-4 [contain-intrinsic-size:auto_104px] transition-colors hover:bg-brand-surface-subtle/60 lg:grid-cols-[minmax(220px,1.4fr)_minmax(135px,.65fr)_minmax(170px,.9fr)_minmax(150px,.7fr)_auto] lg:items-center lg:px-5 dark:hover:bg-zinc-900/50">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-zinc-950 dark:text-white" title={projeto.nome}><Link to={appLinks.project(projeto.id)} className="geo-focus-ring rounded underline-offset-4 hover:text-brand-primary-700 hover:underline dark:hover:text-brand-primary-200">{projeto.nome}</Link></h2>
                        <Link to={appLinks.client(projeto.clienteId)} className="geo-focus-ring mt-1 block truncate rounded text-sm text-zinc-600 underline-offset-2 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-white">{projeto.clienteNome || 'Cliente não informado'}</Link>
                      </div>
                      <div><ProjectStatusBadge projeto={projeto} /></div>
                      <div className="min-w-0 text-sm text-zinc-700 dark:text-zinc-200">
                        <p className="truncate font-medium" title={displayProjectType(projeto.tipo)}>{displayProjectType(projeto.tipo)}</p>
                        <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{projeto.municipio || projeto.cidade || 'Localização não informada'}</p>
                      </div>
                      <div className="text-sm text-zinc-700 tabular-nums dark:text-zinc-200">
                        <p className="flex items-center gap-2"><CalendarBlank aria-hidden="true" className="h-4 w-4" /> {formatProjectDate(projeto.dataEntrega)}</p>
                        {projeto.updatedAt && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Atualizado em {formatProjectDate(projeto.updatedAt)}</p>}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <ProjectOpenButton projectId={projeto.id} />
                        {renderProjectActions(projeto)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        )}

        {viewMode === 'grid' && (
          <motion.div
            id="project-panel-grid"
            key="grid"
            role="tabpanel"
            aria-labelledby="project-tab-grid"
            aria-busy={projectsRefreshing}
            tabIndex={0}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
            className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3"
          >
        {!hasRegisteredProjects ? (
          <section className="geo-card col-span-full flex min-h-[380px] flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary-400/10 text-brand-primary-700 ring-1 ring-brand-primary-300/25 dark:text-brand-primary-200">
              <FolderOpen aria-hidden="true" weight="duotone" className="h-8 w-8" />
            </span>
            <h2 className="mt-6 max-w-full break-words text-xl font-semibold text-zinc-950 dark:text-white sm:text-2xl">Você ainda não possui projetos cadastrados</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">
              Crie seu primeiro projeto para acompanhar produtividade, custos, receitas e prazos.
            </p>
            <button type="button" onClick={() => openCreateModal()} className={cn(primarySmallActionButtonClass, 'mt-7 min-h-11 px-5')}>
              <Plus aria-hidden="true" weight="bold" className="h-4 w-4" />
              Criar primeiro projeto
            </button>
          </section>
        ) : filteredProjetos.length === 0 ? (
          <section className="geo-empty-state col-span-full flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-surface-subtle ring-1 ring-brand-border">
              <img src={filterIcon} alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8 object-contain opacity-50 grayscale" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">Nenhum resultado</h2>
            <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-300">Sua busca não encontrou projetos correspondentes. Remova um filtro ou limpe todos para ampliar os resultados.</p>
            <button
              type="button"
              onClick={clearProjectFilters}
              className={cn(secondarySmallActionButtonClass, 'mt-5 min-h-11 px-5')}
            >
              Limpar filtros
            </button>
          </section>
        ) : (
          filteredProjetos.map((projeto: Projeto, i: number) => {
            const status = getProjectStatusPresentation(projeto);
            const deadline = getProjectDeadlinePresentation(projeto);
            const updatedAt = formatUpdatedAt(projeto.updatedAt);
            const identifiers = getProjectIdentifiers(projeto);
            const visibleIdentifiers = identifiers.slice(0, 2);
            const hiddenIdentifiers = identifiers.slice(2);

            return (
              <motion.article
                key={projeto.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion || filteredProjetos.length > 12
                  ? { duration: 0 }
                  : { delay: Math.min(i * 0.03, 0.24), type: 'spring', stiffness: 100, damping: 20 }}
                className="geo-card-interactive group motion-gpu content-auto relative flex min-h-[272px] flex-col overflow-visible [contain-intrinsic-size:auto_300px]"
              >
                <span aria-hidden="true" className={cn('absolute bottom-3 left-0 top-3 w-1 rounded-r-full', projectStatusAccentClasses[status.tone])} />

                <div className="flex flex-1 flex-col p-4 pl-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 line-clamp-2 break-words text-lg font-semibold leading-6 tracking-tight text-zinc-950 dark:text-white" title={projeto.nome}>
                      <Link to={appLinks.project(projeto.id)} className="geo-focus-ring rounded underline-offset-4 hover:text-brand-primary-700 hover:underline dark:hover:text-brand-primary-200">{projeto.nome}</Link>
                    </h2>
                    {renderProjectActions(projeto)}
                  </div>

                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <Link to={appLinks.client(projeto.clienteId)} className="geo-focus-ring min-w-0 max-w-full flex-1 truncate rounded text-sm text-zinc-600 underline-offset-2 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-white">{projeto.clienteNome || 'Cliente não informado'}</Link>
                    <ProjectStatusBadge projeto={projeto} />
                  </div>

                  {projeto.descricao && <p className="mt-2.5 line-clamp-2 text-sm leading-5 text-zinc-500 dark:text-zinc-400">{projeto.descricao}</p>}

                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Identificação do projeto">
                    <span className={cn('geo-badge-base max-w-full px-2.5 py-1 text-xs', getProjectTypeBadgeClass(projeto.tipo))} title={displayProjectType(projeto.tipo)}>
                      <span className="truncate">{displayProjectType(projeto.tipo)}</span>
                    </span>
                    {visibleIdentifiers.map((identifier) => (
                      <span key={identifier.label} className="geo-badge-base geo-badge-neutral max-w-[12rem] px-2.5 py-1 text-xs" title={`${identifier.label}: ${identifier.value}`}>
                        <span className="truncate">{identifier.label} {identifier.value}</span>
                      </span>
                    ))}
                    {hiddenIdentifiers.length > 0 && (
                      <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs" title={hiddenIdentifiers.map(({ label, value }) => `${label}: ${value}`).join(' · ')}>
                        +{hiddenIdentifiers.length} {hiddenIdentifiers.length === 1 ? 'identificador' : 'identificadores'}
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 grid grid-cols-1 overflow-hidden rounded-lg bg-brand-surface-subtle/70 text-sm ring-1 ring-inset ring-brand-border/45 sm:grid-cols-3">
                    <div className="min-w-0 p-3">
                      <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400"><CalendarBlank aria-hidden="true" className="h-3.5 w-3.5" />{deadline.label}</dt>
                      <dd className="mt-1 truncate font-medium text-zinc-800 tabular-nums dark:text-zinc-100">{deadline.value}</dd>
                      {deadline.helper && <dd className={cn('mt-0.5 break-words text-xs font-medium leading-4', deadlineToneClasses[deadline.tone])}>{deadline.helper}</dd>}
                    </div>
                    <div className="min-w-0 border-t border-brand-border/55 p-3 sm:border-l sm:border-t-0">
                      <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />Localização</dt>
                      <dd className="mt-1 truncate font-medium text-zinc-800 dark:text-zinc-100" title={projeto.municipio || projeto.cidade || undefined}>{projeto.municipio || projeto.cidade || 'Não informada'}</dd>
                    </div>
                    <div className="min-w-0 border-t border-brand-border/55 p-3 sm:border-l sm:border-t-0">
                      <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400"><Compass aria-hidden="true" className="h-3.5 w-3.5" />Área</dt>
                      <dd className="mt-1 truncate font-medium text-zinc-800 tabular-nums dark:text-zinc-100">{projeto.areaHa ? `${numberFormatter.format(projeto.areaHa)} ha` : 'Não informada'}</dd>
                    </div>
                  </dl>
                </div>

                <footer className="flex flex-col gap-2.5 border-t border-brand-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  {updatedAt ? <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400"><Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{updatedAt}</span></p> : <span />}
                  <ProjectOpenButton projectId={projeto.id} responsive />
                </footer>
              </motion.article>
            );
          })
        )}
          </motion.div>
        )}

          </AnimatePresence>
        </>
      )}

      {!loading && !pageError && (viewMode === 'list' || viewMode === 'grid') && totalPages > 1 && (
        <nav aria-label="Paginação de projetos" className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-600 tabular-nums dark:text-zinc-300">{filteredProjectsLabel}</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button type="button" disabled={page <= 1 || projectsRefreshing} onClick={() => updateProjectQuery('pagina', String(page - 1), '1')} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 disabled:cursor-not-allowed disabled:opacity-50')}>Anterior</button>
            {paginationPages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                disabled={projectsRefreshing}
                aria-label={`Ir para a página ${pageNumber}`}
                aria-current={pageNumber === page ? 'page' : undefined}
                onClick={() => updateProjectQuery('pagina', String(pageNumber), '1')}
                className={cn('geo-focus-ring min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold tabular-nums disabled:cursor-wait disabled:pointer-events-none', pageNumber === page ? 'bg-brand-primary-600 text-white' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800')}
              >{pageNumber}</button>
            ))}
            <button type="button" disabled={page >= totalPages || projectsRefreshing} onClick={() => updateProjectQuery('pagina', String(page + 1), '1')} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 disabled:cursor-not-allowed disabled:opacity-50')}>Próxima</button>
          </div>
        </nav>
      )}

      {/* Cadastro e edição de projetos */}
      <ProjectFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        context={modalContext}
        project={selectedProjeto}
        initialClientId={initialProjectClientId}
        initialTab={initialProjectTab}
        onSaved={(savedProject, savedContext) => {
          const copy = resolveProjectFormCopy(savedContext, savedProject.tipo);
          setProjectSuccessMessage(selectedProjeto ? copy.updateSuccess : copy.createSuccess);
        }}
      />

      {/* Modal Arquivos Locais */}
      <Modal
        isOpen={!!showArquivosModal}
        onClose={() => setShowArquivosModal(null)}
        title="Arquivos do Projeto"
        maxWidth="max-w-5xl"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-sm -mt-4 mb-6" title={arquivosPasta}>
          {arquivosPasta || 'Buscando no disco local…'}
        </p>

        {/* Drag and Drop Zone */}
        <div className="mb-6">
          <FileUploadModal
            onUpload={uploadFile}
            uploading={uploading}
            accept=".pdf,.gpkg,.kml,.dwg,.shp,.xlsx,.csv,.docx,.png,.jpg,.jpeg"
          />
        </div>

        <div className="space-y-3">
          {arquivosLoading ? (
            <div className="py-12 flex justify-center">
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
            </div>
          ) : projetoArquivos.length === 0 ? (
            <div className="geo-empty-state py-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">Nenhum arquivo compatível encontrado nesta pasta.</p>
            </div>
          ) : (
            projetoArquivos.map((file: ProjetoArquivo, idx: number) => {
              let FileIcon = FileDashed;
              let iconColor = "text-zinc-400";
              let bgColor = "bg-zinc-50 dark:bg-zinc-950";


              if (file.extension === '.pdf') { FileIcon = FilePdf; iconColor = "text-red-500"; bgColor = "bg-red-50"; }
              if (file.extension === '.docx') { FileIcon = FileDoc; iconColor = "text-blue-500"; bgColor = "bg-blue-50"; }
              if (file.extension === '.csv' || file.extension === '.xlsx') { FileIcon = FileText; iconColor = "text-emerald-500"; bgColor = "bg-emerald-50"; }
              if (file.extension === '.gpkg' || file.extension === '.shp') { FileIcon = Files; iconColor = "text-indigo-500"; bgColor = "bg-indigo-50"; }
              if (file.extension === '.dwg') { FileIcon = Files; iconColor = "text-amber-500"; bgColor = "bg-amber-50"; }

              return (
                <motion.div 
                  key={file.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="geo-card-interactive group flex items-center gap-4 p-4"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgColor} flex-shrink-0`}>
                    <FileIcon weight="duotone" className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-950 dark:text-white truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {(file.sizeBytes / 1024).toFixed(1)} KB • {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Baixar arquivo ${file.name}`}
                      onClick={() => window.open(getDownloadUrl(file.path))}
                      className="geo-focus-ring flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg border border-brand-turquoise-200/80 bg-brand-turquoise-50 text-brand-turquoise-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-brand-turquoise-100 active:scale-95 dark:border-brand-turquoise-300/20 dark:bg-brand-turquoise-400/10 dark:text-brand-turquoise-100"
                      title="Baixar Arquivo"
                    >
                      <DownloadSimple aria-hidden="true" weight="bold" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir arquivo ${file.name}`}
                      onClick={() => handleFileDelete(file.path)}
                      className="geo-focus-ring flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg border border-brand-red-200/80 bg-brand-red-50 text-brand-red-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-brand-red-100 active:scale-95 dark:border-brand-red-300/20 dark:bg-brand-red-400/10 dark:text-brand-red-100"
                      title="Excluir Arquivo"
                    >
                      <Trash aria-hidden="true" weight="bold" className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        description={confirmData.description}
        confirmText={confirmData.confirmText}
        loading={deleteProjectMutation.isPending || deleteFileMutation.isPending}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">{projectSuccessMessage}</div>
    </Layout>
  );
}
