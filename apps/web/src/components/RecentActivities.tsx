import { useId, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { Plus, PencilSimple, Trash, ArrowSquareOut, Info, ArrowsClockwise, type Icon } from '@phosphor-icons/react';
import { getClientCategoryIcon } from '../utils/clientIcons';

import clockIcon from '../assets/magnific-icons/clock_2924574.svg';
import projectFolderIcon from '../assets/magnific-icons/project_folder.svg';
import invoiceIcon from '../assets/magnific-icons/invoice_9510031.svg';
import diversifyIcon from '../assets/magnific-icons/diversify_8858143.svg';
import stopwatchIcon from '../assets/magnific-icons/stopwatch_9527988.svg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  userId: string;
  oldData: string | null;
  newData: string | null;
  createdAt: string;
}

type EntityFilter = 'Tudo' | 'Clientes' | 'Projetos' | 'Finanças' | 'Tarefas';
type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'DELETE (SOFT)';
type ActionConfigKey = AuditAction | 'UNKNOWN';

interface ActionVisualConfig {
  badgeLabel: string;
  actionVerb: string;
  ariaLabel: string;
  icon: Icon;
  borderClass: string;
  badgeClass: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_FILTERS: EntityFilter[] = ['Tudo', 'Clientes', 'Projetos', 'Finanças', 'Tarefas'];

const ENTITY_FILTER_MAP: Record<EntityFilter, string[]> = {
  Tudo: [],
  Clientes: ['Cliente'],
  Projetos: ['Projeto'],
  Finanças: ['Orcamento', 'Despesa', 'Fatura'],
  Tarefas: ['Tarefa'],
};

const ENTITY_ICON_MAP: Record<string, string> = {
  Projeto: projectFolderIcon,
  Orcamento: invoiceIcon,
  Despesa: diversifyIcon,
  Tarefa: stopwatchIcon,
  Fatura: invoiceIcon,
};

/**
 * Returns the icon element for a given audit log.
 * For clients, uses the category-specific icon (empresa → skyscraper, rural → farmer, etc.).
 * For other entities, uses the static ENTITY_ICON_MAP.
 */
function getEntityIconElement(log: AuditLog): ReactNode {
  if (log.entity === 'Cliente') {
    const data = safeJsonParse(log.newData) ?? safeJsonParse(log.oldData);
    const categoria = (data?.categoria ?? '') as string;
    return getClientCategoryIcon(categoria, 'w-6 h-6 object-contain');
  }

  const src = ENTITY_ICON_MAP[log.entity] ?? projectFolderIcon;
  return <img src={src} alt="" className="w-6 h-6 object-contain" />;
}

const ENTITY_LABEL_MAP: Record<string, string> = {
  Cliente: 'o cliente',
  Projeto: 'o projeto',
  Orcamento: 'o orçamento',
  Despesa: 'a despesa',
  Tarefa: 'a tarefa',
  Contato: 'o lead/contato',
  Fatura: 'a fatura',
};

const ACTION_VISUAL_CONFIG: Record<ActionConfigKey, ActionVisualConfig> = {
  INSERT: {
    badgeLabel: 'Novo',
    actionVerb: 'cadastrou',
    ariaLabel: 'Criação',
    icon: Plus,
    borderClass: 'border-l-emerald-500 dark:border-l-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/40',
  },
  UPDATE: {
    badgeLabel: 'Editado',
    actionVerb: 'editou',
    ariaLabel: 'Edição',
    icon: PencilSimple,
    borderClass: 'border-l-amber-500 dark:border-l-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/40',
  },
  DELETE: {
    badgeLabel: 'Removido',
    actionVerb: 'removeu',
    ariaLabel: 'Remoção',
    icon: Trash,
    borderClass: 'border-l-rose-500 dark:border-l-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/40',
  },
  'DELETE (SOFT)': {
    badgeLabel: 'Removido',
    actionVerb: 'removeu',
    ariaLabel: 'Remoção',
    icon: Trash,
    borderClass: 'border-l-rose-500 dark:border-l-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/40',
  },
  UNKNOWN: {
    badgeLabel: 'Alteração',
    actionVerb: 'alterou',
    ariaLabel: 'Alteração',
    icon: ArrowsClockwise,
    borderClass: 'border-l-zinc-400 dark:border-l-zinc-500',
    badgeClass: 'bg-zinc-100 text-zinc-700 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/70',
  },
};

const VISIBLE_ITEMS = 12;
const POLLING_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Helpers — pure functions, no JSX
// ---------------------------------------------------------------------------

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  const normalized = dateStr.includes('T') || dateStr.includes('Z')
    ? dateStr
    : dateStr.replace(' ', 'T') + 'Z';
  return new Date(normalized);
}

function getDateGroupLabel(date: Date, today: Date): string {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays <= 7) return 'Esta Semana';
  return 'Anteriores';
}

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function safeJsonParse(str: string | null): Record<string, unknown> | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getActionConfig(action: string): ActionVisualConfig {
  if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE' || action === 'DELETE (SOFT)') {
    return ACTION_VISUAL_CONFIG[action];
  }
  return ACTION_VISUAL_CONFIG.UNKNOWN;
}

function getEntityLabel(entity: string): string {
  return ENTITY_LABEL_MAP[entity] ?? entity;
}

function extractRecordName(log: AuditLog): string {
  const data = safeJsonParse(log.newData) ?? safeJsonParse(log.oldData);
  if (!data) return '';

  const raw = (data.nome ?? data.titulo ?? data.descricao ?? '') as string;

  if (log.entity === 'Despesa' || log.entity === 'Orcamento') {
    const val = Number(data.valor ?? 0) / 100;
    const formatted = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const label = (data.descricao ?? data.titulo ?? '') as string;
    return label ? `${formatted} — "${label}"` : formatted;
  }

  return raw;
}

/**
 * Computes a human-readable summary of field changes for UPDATE actions.
 * Ignores timestamp fields and returns the top 2 most meaningful changes.
 */
function computeChangeSummary(log: AuditLog): string | null {
  if (log.action !== 'UPDATE') return null;

  const oldObj = safeJsonParse(log.oldData);
  const newObj = safeJsonParse(log.newData);
  if (!oldObj || !newObj) return null;

  const IGNORE_KEYS = new Set(['updatedAt', 'createdAt', 'updated_at', 'created_at', 'id', 'deletedAt']);

  const FRIENDLY_KEYS: Record<string, string> = {
    nome: 'nome',
    status: 'status',
    situacao: 'situação',
    email: 'e-mail',
    telefone: 'telefone',
    endereco: 'endereço',
    categoria: 'categoria',
    valor: 'valor',
    tipo: 'tipo',
    origem: 'origem',
    prioridade: 'prioridade',
    descricao: 'descrição',
    titulo: 'título',
    clienteNome: 'cliente',
  };

  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (IGNORE_KEYS.has(key)) continue;
    const oldVal = String(oldObj[key] ?? '');
    const newVal = String(newObj[key] ?? '');
    if (oldVal === newVal) continue;

    const label = FRIENDLY_KEYS[key] ?? key;

    if (key === 'valor') {
      const oldNum = Number(oldObj[key] ?? 0) / 100;
      const newNum = Number(newObj[key] ?? 0) / 100;
      const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      changes.push(`${label}: ${fmt(oldNum)} → ${fmt(newNum)}`);
    } else {
      const from = oldVal || '(vazio)';
      const to = newVal || '(vazio)';
      changes.push(`${label}: ${from} → ${to}`);
    }
  }

  if (changes.length === 0) return null;
  return changes.slice(0, 2).join(' · ');
}

function getUserInitials(userId: string): string {
  if (!userId || userId === 'admin' || userId === 'system') return 'AD';
  const parts = userId.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return userId.substring(0, 2).toUpperCase();
}

function getUserDisplayName(userId: string): string {
  if (!userId || userId === 'admin') return 'Admin';
  if (userId === 'system') return 'Sistema';
  return userId.charAt(0).toUpperCase() + userId.slice(1);
}

function getEntityRoute(log: AuditLog): string | null {
  const data = safeJsonParse(log.newData) ?? safeJsonParse(log.oldData);
  const id = data?.id as string | undefined;

  if (log.action.includes('DELETE')) return null;

  switch (log.entity) {
    case 'Cliente':
      return id ? `/clientes/${id}` : '/clientes';
    case 'Projeto':
      return id ? `/projetos/${id}` : '/projetos';
    case 'Orcamento':
      return '/orcamentos';
    case 'Despesa':
      return '/financeiro?tab=pagar';
    case 'Tarefa':
      return '/tarefas';
    case 'Fatura':
      return '/financeiro?tab=faturas';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Grouped list type
// ---------------------------------------------------------------------------

interface GroupedLogs {
  label: string;
  logs: AuditLog[];
}

function groupLogsByDate(logs: AuditLog[], today: Date): GroupedLogs[] {
  const groups = new Map<string, AuditLog[]>();

  for (const log of logs) {
    const date = parseDate(log.createdAt);
    const label = getDateGroupLabel(date, today);
    const existing = groups.get(label);
    if (existing) {
      existing.push(log);
    } else {
      groups.set(label, [log]);
    }
  }

  const ORDER = ['Hoje', 'Ontem', 'Esta Semana', 'Anteriores'];
  const result: GroupedLogs[] = [];
  for (const label of ORDER) {
    const logs = groups.get(label);
    if (logs && logs.length > 0) {
      result.push({ label, logs });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionBadge({ config }: { config: ActionVisualConfig }) {
  const ActionIcon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ring-1 ${config.badgeClass}`}
      aria-label={config.ariaLabel}
    >
      <ActionIcon weight="bold" className="h-3 w-3" aria-hidden="true" />
      {config.badgeLabel}
    </span>
  );
}

function ActivityRow({ log, now }: { log: AuditLog; now: Date }) {
  const iconElement = getEntityIconElement(log);
  const route = getEntityRoute(log);
  const changeSummary = computeChangeSummary(log);
  const recordName = extractRecordName(log);
  const date = parseDate(log.createdAt);
  const initials = getUserInitials(log.userId);
  const userName = getUserDisplayName(log.userId);
  const actionConfig = getActionConfig(log.action);

  const content = (
    <>
      {/* Entity icon */}
      <div className="w-11 h-11 flex items-center justify-center shrink-0">
        {iconElement}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base text-zinc-600 dark:text-zinc-400 leading-snug">
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{userName}</strong>
            {' '}{actionConfig.actionVerb} {getEntityLabel(log.entity)}{' '}
            {recordName && <strong className="font-semibold text-zinc-900 dark:text-white">{recordName}</strong>}
          </span>
          <ActionBadge config={actionConfig} />
          {route && (
            <ArrowSquareOut weight="bold" className="h-4 w-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
          )}
        </div>

        {/* Diff summary for edits */}
        {changeSummary && (
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate leading-snug" title={changeSummary}>
            {changeSummary}
          </p>
        )}
      </div>

      {/* Metadata column */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
        <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap tabular-nums">
          {formatRelativeTime(date, now)}
        </span>
        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center" title={userName}>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 leading-none">{initials}</span>
        </div>
      </div>
    </>
  );

  const cardClassName = `group flex items-start gap-4 rounded-2xl border border-l-[4px] border-zinc-200/60 bg-zinc-50/55 p-4 transition-colors dark:border-zinc-800/80 dark:bg-zinc-800/30 ${actionConfig.borderClass}`;

  if (route) {
    return (
      <Link
        to={route}
        className={`${cardClassName} cursor-pointer hover:bg-zinc-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:hover:bg-zinc-800/60`}
      >
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RecentActivities() {
  const now = useMemo(() => new Date(), []);
  const colorHelpId = useId();
  const [activeFilter, setActiveFilter] = useState<EntityFilter>('Tudo');

  const { data: auditLogs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['recent-audit-logs'],
    queryFn: () => apiClient.get<AuditLog[]>('/api/audit-logs'),
    refetchInterval: POLLING_INTERVAL_MS,
  });

  // Filter logs by selected entity category
  const filteredLogs = useMemo(() => {
    const entities = ENTITY_FILTER_MAP[activeFilter];
    const source = entities.length === 0
      ? auditLogs
      : auditLogs.filter((l) => entities.includes(l.entity));
    return source.slice(0, VISIBLE_ITEMS);
  }, [auditLogs, activeFilter]);

  // Group filtered logs by date
  const groupedLogs = useMemo(() => groupLogsByDate(filteredLogs, now), [filteredLogs, now]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <img
              src={clockIcon}
              alt=""
              className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
            />
          </div>
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-text-muted block">
              Atividades Recentes
            </span>
            <span className="text-[10px] text-text-secondary font-medium block mt-0.5">
              Atualizado automaticamente a cada 15s
            </span>
          </div>
        </div>
      </div>

      {/* Filter pills and color help */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filtrar atividades por tipo">
          {ENTITY_FILTERS.map((filter) => (
            <button
              key={filter}
              role="tab"
              aria-selected={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              className={`geo-focus-ring rounded-lg px-3 py-1 text-[11px] font-semibold transition-[color,background-color,box-shadow] ${
                activeFilter === filter
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="group/activity-help relative shrink-0">
          <button
            type="button"
            aria-label="Entenda as cores das atividades"
            aria-describedby={colorHelpId}
            className="geo-focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-[color,background-color] hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Info className="h-4 w-4" weight="bold" aria-hidden="true" />
          </button>
          <div
            id={colorHelpId}
            role="tooltip"
            className="pointer-events-none invisible absolute right-0 top-full z-50 mt-2 w-64 -translate-y-1 rounded-xl border border-zinc-200 bg-white p-3 text-left opacity-0 shadow-xl transition-[opacity,transform,visibility] duration-150 group-hover/activity-help:visible group-hover/activity-help:translate-y-0 group-hover/activity-help:opacity-100 group-focus-within/activity-help:visible group-focus-within/activity-help:translate-y-0 group-focus-within/activity-help:opacity-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <strong className="block text-xs font-semibold text-zinc-800 dark:text-zinc-100">Cores das atividades</strong>
            <span className="mt-1 block text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
              A faixa lateral indica a ação: verde para criação, laranja para edição e vermelho para remoção.
            </span>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-sm text-zinc-400 dark:text-zinc-400">Carregando atividades…</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-sm text-zinc-400 italic">Nenhuma atividade encontrada.</span>
          </div>
        ) : (
          groupedLogs.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="space-y-2">
                {group.logs.map((log) => (
                  <ActivityRow key={log.id} log={log} now={now} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
