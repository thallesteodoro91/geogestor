import { Briefcase, Calendar, CalendarBlank, CaretLeft, CaretRight, CheckSquare, Clock, DotsThreeCircle, MagnifyingGlass, MapPin, NotePencil, Package, Phone, Plus, Sun, Tag, Trash, User, UsersThree, Wrench
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { FormField, SwitchField } from '../../components/Form';
import { CustomSelect } from '../../components/CustomSelect';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoGreenSurfaceClass } from '../../utils/geoTheme';
import { headerPrimaryActionButtonClass, headerPrimaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { apiClient, apiFetch } from '../../services/apiClient';
import { AppointmentTypePicker, CalendarDatePicker, MonthYearPicker, TimePicker } from './CalendarControls';
import { appointmentRequestError, appointmentTextErrors, calendarStatuses, calendarTypes, normalizeCalendarFilter } from './calendarPresentation';
import './calendar-workspace.css';
import {
  filterBarClass,
  filterClearButtonClass,
  filterSearchInputClass
} from '../../utils/filterStyles';

interface Projeto {
  id: string;
  nome: string;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
}

interface Tarefa {
  id: string;
  titulo: string;
  status: string;
  dataLimite?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
}

interface Compromisso {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  data: string;
  hora?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
}

type CalendarQueryData = {
  projetos: Projeto[];
  tarefas: Tarefa[];
  compromissos: Compromisso[];
  error: string;
};

type EventTone = 'blue' | 'amber' | 'indigo' | 'emerald' | 'violet' | 'cyan' | 'rose' | 'zinc';

interface CalendarioEvento {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  status?: string;
  tone: EventTone;
  canDelete?: boolean;
  data: string;
  hora?: string | null;
  clienteNome?: string | null;
  projetoNome?: string | null;
}

interface FormErrors {
  titulo?: string;
  descricao?: string;
  data?: string;
  hora?: string;
  submit?: string;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const eventToneClasses: Record<EventTone, { dot: string; chip: string; card: string; icon: string }> = {
  blue: {
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-800 ring-blue-200/70 dark:bg-blue-400/15 dark:text-blue-100 dark:ring-blue-300/20',
    card: 'border-blue-200/80 bg-blue-50 text-blue-900 ring-blue-100 dark:border-blue-300/20 dark:bg-blue-400/15 dark:text-blue-100 dark:ring-blue-300/10',
    icon: 'bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950'
  },
  amber: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200/70 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-300/20',
    card: 'border-amber-200/80 bg-amber-50 text-amber-950 ring-amber-100 dark:border-amber-300/20 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-300/10',
    icon: 'bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
  },
  indigo: {
    dot: 'bg-indigo-500',
    chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200/70 dark:bg-indigo-400/15 dark:text-indigo-100 dark:ring-indigo-300/20',
    card: 'border-indigo-200/80 bg-indigo-50 text-indigo-950 ring-indigo-100 dark:border-indigo-300/20 dark:bg-indigo-400/15 dark:text-indigo-100 dark:ring-indigo-300/10',
    icon: 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950'
  },
  emerald: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-400/15 dark:text-emerald-100 dark:ring-emerald-300/20',
    card: 'border-emerald-200/80 bg-emerald-50 text-emerald-950 ring-emerald-100 dark:border-emerald-300/20 dark:bg-emerald-400/15 dark:text-emerald-100 dark:ring-emerald-300/10',
    icon: 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950'
  },
  violet: {
    dot: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-800 ring-violet-200/70 dark:bg-violet-400/15 dark:text-violet-100 dark:ring-violet-300/20',
    card: 'border-violet-200/80 bg-violet-50 text-violet-950 ring-violet-100 dark:border-violet-300/20 dark:bg-violet-400/15 dark:text-violet-100 dark:ring-violet-300/10',
    icon: 'bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950'
  },
  cyan: {
    dot: 'bg-cyan-500',
    chip: 'bg-cyan-50 text-cyan-800 ring-cyan-200/70 dark:bg-cyan-400/15 dark:text-cyan-100 dark:ring-cyan-300/20',
    card: 'border-cyan-200/80 bg-cyan-50 text-cyan-950 ring-cyan-100 dark:border-cyan-300/20 dark:bg-cyan-400/15 dark:text-cyan-100 dark:ring-cyan-300/10',
    icon: 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-cyan-950'
  },
  rose: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-800 ring-rose-200/70 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-300/20',
    card: 'border-rose-200/80 bg-rose-50 text-rose-950 ring-rose-100 dark:border-rose-300/20 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-300/10',
    icon: 'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950'
  },
  zinc: {
    dot: 'bg-zinc-500',
    chip: 'bg-zinc-100 text-zinc-800 ring-zinc-200/80 dark:bg-zinc-400/15 dark:text-zinc-100 dark:ring-zinc-300/20',
    card: 'border-zinc-200 bg-zinc-100 text-zinc-900 ring-zinc-200/70 dark:border-zinc-300/20 dark:bg-zinc-400/15 dark:text-zinc-100 dark:ring-zinc-300/10',
    icon: 'bg-zinc-600 text-white dark:bg-zinc-400 dark:text-zinc-950'
  }
};

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  return toDateKey(date).slice(0, 7);
}

function parseDateKey(value: string | null): Date | null {
  if (!value || !DATE_KEY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function parseMonthKey(value: string | null): Date | null {
  if (!value || !MONTH_KEY_PATTERN.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonthsKeepingDay(date: Date, monthAnchor: Date, amount: number) {
  const targetMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + amount, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  return {
    month: targetMonth,
    selected: new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), lastDay))
  };
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function getEventTone(tipo: string): EventTone {
  if (tipo === 'Projeto') return 'blue';
  if (tipo === 'Tarefa') return 'amber';
  if (tipo === 'Reunião') return 'indigo';
  if (tipo === 'Visita de Campo') return 'emerald';
  if (tipo === 'Ligação') return 'violet';
  if (tipo === 'Serviço') return 'cyan';
  if (tipo === 'Entrega') return 'rose';
  return 'zinc';
}

function EventTypeIcon({ type, className = 'h-4 w-4' }: { type: string; className?: string }) {
  const Icon = type === 'Projeto'
    ? Briefcase
    : type === 'Tarefa'
      ? CheckSquare
      : type === 'Reunião'
        ? UsersThree
        : type === 'Visita de Campo'
          ? MapPin
          : type === 'Ligação'
            ? Phone
            : type === 'Administrativo'
              ? NotePencil
              : type === 'Serviço'
                ? Wrench
                : type === 'Entrega'
                  ? Package
                  : DotsThreeCircle;
  return <Icon aria-hidden="true" weight="duotone" className={className} />;
}

const fieldLabelToneClasses = {
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200'
};

function FieldLabel({ icon, tone, children }: { icon: ReactNode; tone: keyof typeof fieldLabelToneClasses; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md', fieldLabelToneClasses[tone])}>{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function getGoogleCalendarUrl(event: CalendarioEvento) {
  const compactDate = event.data.replaceAll('-', '');
  let datesParam: string;

  if (event.hora) {
    const [hour, minute] = event.hora.split(':').map(Number);
    const start = new Date(`${event.data}T${event.hora}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const endDate = toDateKey(end).replaceAll('-', '');
    const endTime = `${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}00`;
    const startTime = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00`;
    datesParam = `${compactDate}T${startTime}/${endDate}T${endTime}`;
  } else {
    datesParam = `${compactDate}/${toDateKey(addDays(parseDateKey(event.data) ?? new Date(), 1)).replaceAll('-', '')}`;
  }

  const details = [event.descricao, event.clienteNome && `Cliente: ${event.clienteNome}`, event.projetoNome && `Projeto: ${event.projetoNome}`]
    .filter(Boolean)
    .join('\n');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.titulo)}&details=${encodeURIComponent(details)}&dates=${datesParam}&ctz=America%2FSao_Paulo`;
}

async function fetchCollection<T>(url: string, label: string, signal?: AbortSignal): Promise<T[]> {
  const response = await apiFetch(url, { signal });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiMessage = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error || '')
      : '';
    throw new Error(apiMessage || `Não foi possível carregar ${label}.`);
  }

  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }

  throw new Error(`A resposta de ${label} está em um formato inválido.`);
}

async function getResponseError(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && 'error' in payload) {
    return String((payload as { error?: unknown }).error || fallback);
  }
  return fallback;
}

export function Calendario() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = parseDateKey(searchParams.get('data'));
  const requestedMonth = parseMonthKey(searchParams.get('mes'));
  const initialSelectedDate = requestedDate
    ?? (requestedMonth ? new Date(requestedMonth.getFullYear(), requestedMonth.getMonth(), 1) : new Date());
  const initialMonth = requestedDate
    ? new Date(requestedDate.getFullYear(), requestedDate.getMonth(), 1)
    : requestedMonth ?? new Date(initialSelectedDate.getFullYear(), initialSelectedDate.getMonth(), 1);

  const [currentDate, setCurrentDate] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [deleteTarget, setDeleteTarget] = useState<Compromisso | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const appointmentTrigger = useRef<HTMLElement | null>(null);
  const returnAppointmentFocus = useRef(false);
  useEffect(() => {
    if (showAddModal) {returnAppointmentFocus.current = true;return;}
    if (!returnAppointmentFocus.current) return;
    // Nested discard and editor dialogs can finish their exit in either order.
    const restore = () => {
      if (document.querySelector('.calendar-appointment-modal, [role="alertdialog"]')) return;
      returnAppointmentFocus.current = false;
      observer.disconnect();
      appointmentTrigger.current?.focus({preventScroll:true});
    };
    const observer = new MutationObserver(restore);
    observer.observe(document.body,{childList:true,subtree:true});
    restore();
    return () => observer.disconnect();
  },[showAddModal]);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [linkNotice, setLinkNotice] = useState('');
  const [createdNotice, setCreatedNotice] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoTipo, setNovoTipo] = useState('Visita de Campo');
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoProjetoId, setNovoProjetoId] = useState('');
  const [novaData, setNovaData] = useState('');
  const [novaHora, setNovaHora] = useState('09:00');
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  useEffect(() => {
    if (formErrors.submit && !creating) document.getElementById('calendar-submit-error')?.focus({preventScroll:true});
  },[creating,formErrors.submit]);
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');
  const [filtroTipo, setFiltroTipo] = useState(searchParams.get('tipo') ?? 'Todos');
  const [filtroStatus, setFiltroStatus] = useState(searchParams.get('status') ?? 'Todos');
  useEffect(() => {setCreatedNotice('');},[busca,filtroTipo,filtroStatus]);
  const [view, setView] = useState<'mes' | 'lista'>(() => searchParams.get('visao') === 'lista' ? 'lista'
    : searchParams.get('visao') === 'mes' ? 'mes' : window.matchMedia('(max-width: 767px)').matches ? 'lista' : 'mes');
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingDayFocus = useRef(false);
  const canonicalFallback = useRef({ month: initialMonth, date: initialSelectedDate });

  const calendarRange = useMemo(() => {
    const inicio = toDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    const fim = toDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    return new URLSearchParams({ inicio, fim }).toString();
  }, [currentDate]);
  const calendarQueryKey = useMemo(() => ['calendar', calendarRange] as const, [calendarRange]);

  const calendarQuery = useQuery<CalendarQueryData>({
    queryKey: calendarQueryKey,
    queryFn: async ({ signal }) => {
      const loadPart = async <T,>(request: Promise<T[]>) => {
        try {
          return { items: await request, error: '' };
        } catch (error) {
          if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
          return { items: [] as T[], error: error instanceof Error ? error.message : String(error) };
        }
      };
      const [projectResult, taskResult, appointmentResult] = await Promise.all([
        loadPart(apiClient.get<Projeto[]>(`/api/projetos/calendar?${calendarRange}`, { signal })),
        loadPart(apiClient.get<Tarefa[]>(`/api/tarefas/calendar?${calendarRange}`, { signal })),
        loadPart(fetchCollection<Compromisso>(`/api/compromissos?${calendarRange}`, 'os compromissos', signal))
      ]);
      return {
        projetos: projectResult.items,
        tarefas: taskResult.items,
        compromissos: appointmentResult.items,
        error: [projectResult.error, taskResult.error, appointmentResult.error].filter(Boolean).join(' ')
      };
    },
    staleTime: 30_000
  });
  const loading = calendarQuery.isFetching;
  const fetchDados = useCallback(async () => { await calendarQuery.refetch(); }, [calendarQuery]);
  const projetos = useMemo(() => calendarQuery.data?.projetos ?? [], [calendarQuery.data?.projetos]);
  const tarefas = useMemo(() => calendarQuery.data?.tarefas ?? [], [calendarQuery.data?.tarefas]);
  const compromissos = useMemo(() => calendarQuery.data?.compromissos ?? [], [calendarQuery.data?.compromissos]);
  const loadError = calendarQuery.data?.error ?? '';

  useLayoutEffect(() => {
    const readBrowserHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const urlDate = parseDateKey(params.get('data'));
      const urlMonth = parseMonthKey(params.get('mes'));
      if (urlDate) {
        setSelectedDate(urlDate);
        setCurrentDate(new Date(urlDate.getFullYear(), urlDate.getMonth(), 1));
      } else if (urlMonth) {
        setCurrentDate(urlMonth);
        setSelectedDate((current) => {
          const lastDay = new Date(urlMonth.getFullYear(), urlMonth.getMonth() + 1, 0).getDate();
          return new Date(urlMonth.getFullYear(), urlMonth.getMonth(), Math.min(current.getDate(), lastDay));
        });
      }
      setBusca(params.get('busca') ?? '');
      setFiltroTipo(params.get('tipo') ?? 'Todos');
      setFiltroStatus(params.get('status') ?? 'Todos');
      setView(params.get('visao') === 'lista' ? 'lista' : params.get('visao') === 'mes' ? 'mes'
        : window.matchMedia('(max-width: 767px)').matches ? 'lista' : 'mes');
    };
    window.addEventListener('popstate', readBrowserHistory);
    return () => window.removeEventListener('popstate', readBrowserHistory);
  }, []);

  const normalizedFiltroTipo = normalizeCalendarFilter(filtroTipo, calendarTypes);
  const normalizedFiltroStatus = normalizeCalendarFilter(filtroStatus, calendarStatuses);
  const invalidFilters = normalizedFiltroTipo !== filtroTipo || normalizedFiltroStatus !== filtroStatus;

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      const urlDate = parseDateKey(next.get('data'));
      const urlMonth = parseMonthKey(next.get('mes'));
      if (urlDate) {
        next.set('mes', toMonthKey(urlDate));
      } else {
        const canonicalMonth = urlMonth ?? canonicalFallback.current.month;
        const canonicalDate = toMonthKey(canonicalFallback.current.date) === toMonthKey(canonicalMonth)
          ? canonicalFallback.current.date
          : new Date(canonicalMonth.getFullYear(), canonicalMonth.getMonth(), 1);
        next.set('mes', toMonthKey(canonicalMonth));
        next.set('data', toDateKey(canonicalDate));
      }
      if (busca) next.set('busca', busca); else next.delete('busca');
      if (filtroTipo !== 'Todos') next.set('tipo', filtroTipo); else next.delete('tipo');
      if (filtroStatus !== 'Todos') next.set('status', filtroStatus); else next.delete('status');
      return next.toString() === previous.toString() ? previous : next;
    }, { replace: true });
  }, [busca, filtroStatus, filtroTipo, setSearchParams]);

  const allEvents = useMemo<CalendarioEvento[]>(() => {
    const events: CalendarioEvento[] = [];

    projetos.forEach((projeto) => {
      if (projeto.dataInicio) {
        events.push({
          id: `p-start-${projeto.id}`,
          titulo: `Início: ${projeto.nome}`,
          tipo: 'Projeto',
          status: 'Início',
          tone: 'blue',
          data: projeto.dataInicio,
          clienteNome: projeto.clienteNome,
          projetoNome: projeto.nome
        });
      }
      if (projeto.dataEntrega) {
        events.push({
          id: `p-end-${projeto.id}`,
          titulo: `Entrega: ${projeto.nome}`,
          tipo: 'Projeto',
          status: 'Entrega',
          tone: 'blue',
          data: projeto.dataEntrega,
          clienteNome: projeto.clienteNome,
          projetoNome: projeto.nome
        });
      }
    });

    tarefas.forEach((tarefa) => {
      if (!tarefa.dataLimite) return;
      events.push({
        id: `t-${tarefa.id}`,
        titulo: tarefa.titulo,
        tipo: 'Tarefa',
        status: tarefa.status,
        tone: 'amber',
        data: tarefa.dataLimite,
        clienteNome: tarefa.clienteNome,
        projetoNome: tarefa.projetoNome
      });
    });

    compromissos.forEach((compromisso) => {
      events.push({
        id: `c-${compromisso.id}`,
        titulo: compromisso.titulo,
        descricao: compromisso.descricao,
        tipo: compromisso.tipo,
        status: 'Agendado',
        tone: getEventTone(compromisso.tipo),
        canDelete: true,
        data: compromisso.data,
        hora: compromisso.hora,
        clienteNome: compromisso.clienteNome,
        projetoNome: compromisso.projetoNome
      });
    });

    return events.sort((left, right) => {
      const chronological = `${left.data} ${left.hora ?? '99:99'}`.localeCompare(`${right.data} ${right.hora ?? '99:99'}`);
      if (chronological) return chronological;
      return left.tipo.localeCompare(right.tipo, 'pt-BR')
        || left.titulo.localeCompare(right.titulo, 'pt-BR')
        || left.id.localeCompare(right.id);
    });
  }, [compromissos, projetos, tarefas]);

  const eventDateKeys = useMemo(() => new Set(allEvents.map((event) => event.data)), [allEvents]);

  const filteredEvents = useMemo(() => allEvents.filter((event) => {
    const searchable = [event.titulo, event.descricao, event.tipo, event.status, event.clienteNome, event.projetoNome]
      .filter(Boolean)
      .join(' ');
    return matchesSearch(searchable, busca)
      && (normalizedFiltroTipo === 'Todos' || event.tipo === normalizedFiltroTipo)
      && (normalizedFiltroStatus === 'Todos' || event.status === normalizedFiltroStatus);
  }), [allEvents, busca, normalizedFiltroStatus, normalizedFiltroTipo]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarioEvento[]>();
    filteredEvents.forEach((event) => map.set(event.data, [...(map.get(event.data) ?? []), event]));
    return map;
  }, [filteredEvents]);

  const rawEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarioEvento[]>();
    allEvents.forEach((event) => map.set(event.data, [...(map.get(event.data) ?? []), event]));
    return map;
  }, [allEvents]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const gridStart = addDays(firstDay, -firstDay.getDay());
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const visibleCellCount = Math.ceil((firstDay.getDay() + daysInMonth) / 7) * 7;
    return Array.from({ length: visibleCellCount }, (_, index) => addDays(gridStart, index));
  }, [currentDate]);

  const calendarWeeks = useMemo(() => Array.from({ length: calendarCells.length / 7 }, (_, weekIndex) => (
    calendarCells.slice(weekIndex * 7, weekIndex * 7 + 7)
  )), [calendarCells]);

  const selectedKey = toDateKey(selectedDate);
  useLayoutEffect(() => {
    if (!pendingDayFocus.current) return;
    pendingDayFocus.current = false;
    dayButtonRefs.current.get(selectedKey)?.focus();
  },[selectedKey,currentDate]);
  const selectedEvents = eventsByDate.get(selectedKey) ?? [];
  const selectedRawEvents = rawEventsByDate.get(selectedKey) ?? [];
  const monthKey = toMonthKey(currentDate);
  const totalMonthEvents = allEvents.filter((event) => event.data.startsWith(monthKey)).length;
  const filteredMonthEvents = filteredEvents.filter((event) => event.data.startsWith(monthKey)).length;
  const hasActiveFilters = Boolean(busca || filtroTipo !== 'Todos' || filtroStatus !== 'Todos');
  const addFormDirty = showAddModal && Boolean(
    novoTitulo
    || novaDescricao
    || novoTipo !== 'Visita de Campo'
    || novoClienteId
    || novoProjetoId
    || novaData !== selectedKey
    || novaHora !== '09:00'
    || diaInteiro
  );

  const typeOptions = [{ label: 'Todos os tipos', value: 'Todos' }, ...calendarTypes.map(value => ({label: value, value}))];
  const statusOptions = [{ label: 'Todos os status', value: 'Todos' }, ...calendarStatuses.map(value => ({label: value, value}))];
  const monthEvents = filteredEvents.filter(event => event.data.startsWith(monthKey));
  const changeView = (nextView: 'mes' | 'lista') => {
    setView(nextView);
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('visao', nextView); return next; });
  };

  useEffect(() => {
    if (!addFormDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [addFormDirty]);

  const clearFilters = () => {
    setBusca('');
    setFiltroTipo('Todos');
    setFiltroStatus('Todos');
  };

  const publishTemporalUrl = (month: Date, date: Date) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('mes', toMonthKey(month));
      next.set('data', toDateKey(date));
      return next;
    }, { replace: false });
  };

  const selectDate = (date: Date, focus = false) => {
    if (focus) pendingDayFocus.current = true;
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const month = normalized.getMonth() !== currentDate.getMonth() || normalized.getFullYear() !== currentDate.getFullYear()
      ? new Date(normalized.getFullYear(), normalized.getMonth(), 1)
      : currentDate;
    if (toDateKey(normalized) !== toDateKey(selectedDate)) publishTemporalUrl(month, normalized);
    setSelectedDate(normalized);
    if (month !== currentDate) setCurrentDate(month);
  };

  const moveMonth = (amount: number) => {
    setCreatedNotice('');
    const next = addMonthsKeepingDay(selectedDate, currentDate, amount);
    publishTemporalUrl(next.month, next.selected);
    setCurrentDate(next.month);
    setSelectedDate(next.selected);
  };

  const goToToday = () => {
    setCreatedNotice('');
    const today = new Date();
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    publishTemporalUrl(month, today);
    setCurrentDate(month);
    setSelectedDate(today);
  };

  const changeMonth = (value: string) => {
    setCreatedNotice('');
    const nextMonth = parseMonthKey(value);
    if (!nextMonth) return;
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextSelected = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selectedDate.getDate(), lastDay));
    publishTemporalUrl(nextMonth, nextSelected);
    setCurrentDate(nextMonth);
    setSelectedDate(nextSelected);
  };

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let nextDate: Date | null = null;
    if (event.key === 'ArrowLeft') nextDate = addDays(date, -1);
    if (event.key === 'ArrowRight') nextDate = addDays(date, 1);
    if (event.key === 'ArrowUp') nextDate = addDays(date, -7);
    if (event.key === 'ArrowDown') nextDate = addDays(date, 7);
    if (event.key === 'Home') nextDate = addDays(date, -date.getDay());
    if (event.key === 'End') nextDate = addDays(date, 6 - date.getDay());
    if (event.key === 'PageUp') nextDate = addMonthsKeepingDay(date, date, -1).selected;
    if (event.key === 'PageDown') nextDate = addMonthsKeepingDay(date, date, 1).selected;
    if (!nextDate) return;
    event.preventDefault();
    selectDate(nextDate, true);
  };

  const openAddModal = (event: React.MouseEvent<HTMLButtonElement>) => {
    appointmentTrigger.current = event.currentTarget;
    setNovaData(selectedKey);
    setFormErrors({});
    setShowAddModal(true);
  };

  const resetForm = () => {
    setNovoTitulo('');
    setNovaDescricao('');
    setNovoTipo('Visita de Campo');
    setNovoClienteId('');
    setNovoProjetoId('');
    setNovaHora('09:00');
    setDiaInteiro(false);
    setFormErrors({});
    setLinkNotice('');
  };

  const closeAddModal = () => {
    if (creatingRef.current) return;
    if (addFormDirty) { setDiscardOpen(true); return; }
    setShowAddModal(false);
    resetForm();
  };

  const validateForm = () => {
    const errors: FormErrors = appointmentTextErrors(novoTitulo, novaDescricao);
    if (!parseDateKey(novaData)) errors.data = 'Escolha uma data válida.';
    if (!diaInteiro && !TIME_PATTERN.test(novaHora)) errors.hora = 'Informe um horário válido no formato 24 horas ou marque como evento de dia inteiro.';
    setFormErrors(errors);
    const firstErrorId = errors.titulo ? 'calendar-title' : errors.data ? 'calendar-date' : errors.hora ? 'calendar-time' : errors.descricao ? 'calendar-description' : null;
    if (firstErrorId) window.requestAnimationFrame(() => document.getElementById(firstErrorId)?.focus());
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingRef.current) return;
    if (!validateForm()) return;
    creatingRef.current = true;
    setCreating(true);
    setFormErrors({});

    try {
      const response = await apiFetch('/api/compromissos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novoTitulo.trim(),
          descricao: novaDescricao.trim(),
          tipo: novoTipo,
          data: novaData,
          hora: diaInteiro ? null : novaHora,
          clienteId: novoClienteId || null,
          projetoId: novoProjetoId || null
        })
      });

      if (!response.ok) throw new Error(await getResponseError(response, 'Não foi possível agendar o compromisso.'));
      const created = await response.json() as Compromisso;
      const createdDate = parseDateKey(created.data) ?? selectedDate;
      // A confirmed POST must never be retried just because refreshing a list fails.
      const createdRange = new URLSearchParams({
        inicio: toDateKey(new Date(createdDate.getFullYear(), createdDate.getMonth(), 1)),
        fim: toDateKey(new Date(createdDate.getFullYear(), createdDate.getMonth() + 1, 0))
      }).toString();
      queryClient.setQueryData<CalendarQueryData>(['calendar', createdRange], current => ({
        projetos: current?.projetos ?? [], tarefas: current?.tarefas ?? [], error: current?.error ?? '',
        compromissos: [...(current?.compromissos ?? []).filter(item => item.id !== created.id), created]
      }));
      publishTemporalUrl(new Date(createdDate.getFullYear(), createdDate.getMonth(), 1), createdDate);
      setSelectedDate(createdDate);
      setCurrentDate(new Date(createdDate.getFullYear(), createdDate.getMonth(), 1));
      setShowAddModal(false);
      resetForm();
      const hiddenByFilters = !matchesSearch([created.titulo, created.descricao, created.tipo, 'Agendado', created.clienteNome, created.projetoNome].filter(Boolean).join(' '), busca)
        || (normalizedFiltroTipo !== 'Todos' && normalizedFiltroTipo !== created.tipo)
        || (normalizedFiltroStatus !== 'Todos' && normalizedFiltroStatus !== 'Agendado');
      setCreatedNotice(hiddenByFilters ? 'Compromisso agendado. Ele não aparece com os filtros atuais, que foram preservados. Limpe os filtros para consultá-lo.' : '');
      toast.success('Compromisso agendado com sucesso.');
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
    } catch (error) {
      setFormErrors({ submit: appointmentRequestError(error) });
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const restoreDeletedCompromisso = async (deleted: Compromisso) => {
    try {
      const response = await apiFetch(`/api/compromissos/${deleted.id}/restaurar`, { method: 'POST' });
      if (!response.ok) throw new Error(await getResponseError(response, 'Não foi possível restaurar o compromisso.'));
      await fetchDados();
      toast.success('Compromisso restaurado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível restaurar o compromisso.');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(compromissos.find((item) => item.id === id) ?? null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    setDeleting(true);
    queryClient.setQueryData<CalendarQueryData>(calendarQueryKey, (current) => current
      ? { ...current, compromissos: current.compromissos.filter((item) => item.id !== deleted.id) }
      : current);

    try {
      const response = await apiFetch(`/api/compromissos/${deleted.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await getResponseError(response, 'Não foi possível excluir o compromisso.'));
      setDeleteTarget(null);
      toast.success('Compromisso excluído.', {
        duration: 8000,
        action: {
          label: 'Desfazer',
          onClick: () => void restoreDeletedCompromisso(deleted)
        }
      });
    } catch (error) {
      queryClient.setQueryData<CalendarQueryData>(calendarQueryKey, (current) => current
        ? { ...current, compromissos: [...current.compromissos, deleted] }
        : current);
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o compromisso.');
    } finally {
      setDeleting(false);
    }
  };

  const renderEventCard = (item: CalendarioEvento) => {
    const cleanId = item.id.replace(/^(p-start-|p-end-|t-|c-)/, '');
    const linkPath = item.id.startsWith('p-')
      ? `/projetos/${cleanId}`
      : item.id.startsWith('t-')
        ? `/calendario/tarefa/${cleanId}`
        : `/calendario/compromisso/${cleanId}`;

    return (
      <article key={item.id} className={cn('calendar-event-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 ring-1', eventToneClasses[item.tone].card)}>
        <Link
          to={linkPath}
          state={{ calendarReturnTo: `/calendario?${searchParams.toString()}` }}
          className="geo-focus-ring min-w-0 flex-1 rounded-lg transition-opacity hover:opacity-80"
        >
          <p className="mb-3 flex items-center gap-2 text-base font-bold tabular-nums"><Clock aria-hidden="true" className="h-4 w-4 shrink-0" />{item.hora ?? (item.canDelete ? 'Dia inteiro' : 'Prazo do dia')}</p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm', eventToneClasses[item.tone].icon)}>
              <EventTypeIcon type={item.tipo} className="h-4 w-4" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{item.tipo}</p>
            {item.status && <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold">{item.status}</span>}
          </div>
          <p className="break-words text-sm font-semibold leading-snug hover:underline">{item.titulo}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium opacity-80">

            {item.clienteNome && <span className="flex items-center gap-1"><User aria-hidden="true" weight="duotone" className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-200" />{item.clienteNome}</span>}
            {item.projetoNome && item.tipo !== 'Projeto' && <span className="flex items-center gap-1"><Briefcase aria-hidden="true" weight="duotone" className="h-3.5 w-3.5 text-violet-700 dark:text-violet-200" />{item.projetoNome}</span>}
          </div>
          {!item.canDelete && <p className="mt-2 text-xs font-medium">Prazo do {item.tipo === 'Projeto' ? 'projeto' : 'cadastro de tarefa'} · abra a origem para consultar.</p>}
          {item.descricao && <p className="mt-2 break-words text-xs leading-relaxed opacity-80">{item.descricao}</p>}
        </Link>
        <div className="calendar-event-actions flex flex-wrap items-center justify-end gap-1.5 border-t border-current/10 pt-3">
          <a
            href={getGoogleCalendarUrl(item)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Adicionar ${item.titulo} ao Google Agenda`} title={item.hora ? "Preparar no Google Agenda com duração de uma hora" : "Preparar no Google Agenda como dia inteiro"}
            className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/60 bg-white/85 text-zinc-600 shadow-sm transition-[background-color,color] hover:bg-white hover:text-indigo-700 dark:border-zinc-700/60 dark:bg-zinc-900/85 dark:text-zinc-300 dark:hover:text-indigo-300"
          >
            <Calendar aria-hidden="true" className="h-4 w-4" />
          </a>
          {item.canDelete && (
            <button
              type="button"
              onClick={() => void handleDelete(cleanId)}
              aria-label={`Excluir ${item.titulo}`}
              className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/60 bg-white/85 text-zinc-500 shadow-sm transition-[background-color,color] hover:bg-white hover:text-red-700 dark:border-zinc-700/60 dark:bg-zinc-900/85 dark:text-zinc-300 dark:hover:text-red-300"
            >
              <Trash aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </article>
    );
  };

  const monthLabel = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate));
  const selectedDateLabel = capitalize(new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(selectedDate));
  const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayKey = toDateKey(new Date());

  return (
    <Layout>
      <PageHeader
        eyebrow="Agenda"
        title="Calendário"
        description="Agende reuniões e visitas de campo e acompanhe automaticamente os prazos dos projetos."
        action={(
          <button type="button" onClick={openAddModal} className={cn(headerPrimaryActionButtonClass, 'w-full md:w-auto')}>
            <span>Agendar compromisso</span>
            <span className={headerPrimaryActionIconClass} aria-hidden="true">
              <Plus weight="bold" className="h-3.5 w-3.5" />
            </span>
          </button>
        )}
        navigation={<ModuleNavigation module="agenda" className="mb-0" />}
      />

      <div className="calendar-workspace">
      <section aria-label="Filtros do calendário" className={cn('mb-5', filterBarClass)}>
        <div className="grid grid-cols-1 items-center gap-2.5 calendar-filter-grid">
          <div className="relative">
            <label htmlFor="calendar-search" className="sr-only">Buscar eventos no calendário</label>
            <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="calendar-search"
              name="calendar-search"
              type="search"
              autoComplete="off"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Ex.: reunião, cliente ou projeto…" aria-describedby="calendar-search-hint"
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={normalizedFiltroTipo}
            onChange={setFiltroTipo}
            placeholder="Todos os tipos"
            ariaLabel="Filtrar por tipo de evento"
            className="min-w-0"
            options={typeOptions}
          />
          <CustomSelect
            value={normalizedFiltroStatus}
            onChange={setFiltroStatus}
            placeholder="Todos os status"
            ariaLabel="Filtrar por status do evento"
            className="min-w-0"
            options={statusOptions}
          />
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className={filterClearButtonClass}>
              Limpar filtros
            </button>
          )}
        </div>
        <p id="calendar-search-hint" className="mt-2 px-1 text-xs text-zinc-600 dark:text-zinc-300">Busca no mês exibido: título, descrição, tipo, situação, cliente e projeto.</p>
        <p className="mt-2 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400" role="status" aria-live="polite">
          {hasActiveFilters
            ? `${filteredMonthEvents} de ${totalMonthEvents} eventos encontrados em ${monthLabel.toLocaleLowerCase('pt-BR')}.`
            : `${totalMonthEvents} ${totalMonthEvents === 1 ? 'evento' : 'eventos'} em ${monthLabel.toLocaleLowerCase('pt-BR')}.`}
        </p>
      </section>

      {invalidFilters && <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">Há um tipo ou situação não reconhecido no endereço. Esse critério não foi aplicado. Use os seletores ou “Limpar filtros” para corrigir.</p>}
      {createdNotice && <p role="status" className="mb-4 rounded-xl border border-brand-border bg-brand-surface-subtle p-3 text-sm text-text-primary">{createdNotice}</p>}
      {loadError && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
          <span>{loadError} Os demais dados continuam disponíveis.</span>
          <button type="button" onClick={() => void fetchDados()} className="geo-focus-ring min-h-11 shrink-0 rounded-full border border-amber-300/70 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white dark:border-amber-400/30 dark:bg-zinc-900/60 dark:hover:bg-zinc-900">
            Tentar novamente
          </button>
        </div>
      )}

      <div className={cn("calendar-body", view === "lista" && "calendar-body-list")}>
        <section aria-labelledby="calendar-month-heading" aria-busy={loading} className="calendar-month-panel min-w-0 flex flex-col rounded-[2rem] bg-gradient-to-br from-white via-white to-indigo-50/45 p-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-zinc-900/5 sm:p-6 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 dark:ring-white/10">
          <div className="calendar-period mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="calendar-month-heading" className="sr-only">
              {monthLabel}
            </h2>
            <div className="calendar-period-actions flex min-w-0 flex-wrap items-center gap-2">
              <MonthYearPicker
                id="calendar-month-picker"
                value={toMonthKey(currentDate)}
                onChange={changeMonth}
                className="calendar-month-select"
              />
              <button type="button" onClick={goToToday} className="geo-focus-ring min-h-11 rounded-full border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 transition-[background-color,color,border-color] hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-100">
                Hoje
              </button>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior" className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 transition-[background-color,border-color,color] hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10">
                <CaretLeft aria-hidden="true" weight="bold" className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês" className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 transition-[background-color,border-color,color] hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10">
                <CaretRight aria-hidden="true" weight="bold" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Visualização da agenda" className="calendar-view-switch">
              <button type="button" aria-pressed={view === 'mes'} onClick={() => changeView('mes')} className="geo-focus-ring">Mês</button>
              <button type="button" aria-pressed={view === 'lista'} onClick={() => changeView('lista')} className="geo-focus-ring">Lista</button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">{view === 'lista' ? 'Todos os eventos encontrados no mês' : 'Selecione um dia para ver os eventos'}</p>
          </div>
          {view === 'lista' ? <div aria-label="Eventos do mês" aria-busy={loading} className="calendar-month-list">
            {monthEvents.length === 0 ? <p className="rounded-xl border border-brand-border p-4 text-sm text-text-secondary">{loading ? 'Buscando eventos…' : hasActiveFilters ? 'Nenhum evento do mês corresponde aos filtros aplicados.' : 'Nenhum evento neste mês.'}</p>
              : [...new Set(monthEvents.map(event => event.data))].map(date => <section key={date} aria-labelledby={'calendar-list-' + date} className="calendar-date-group">
                  <h3 id={'calendar-list-' + date} className="mb-3 border-b border-brand-border pb-2 text-sm font-bold text-text-primary">{capitalize(fullDateFormatter.format(parseDateKey(date)!))} <span className="font-normal text-text-secondary">· {eventsByDate.get(date)?.length} eventos</span></h3>
                  <div className="calendar-list-cards">{eventsByDate.get(date)?.map(renderEventCard)}</div>
                </section>)}
          </div> : <>
          <p id="calendar-keyboard-help" className="sr-only">Use as setas para navegar entre os dias, Home e End para ir ao início ou fim da semana e Page Up ou Page Down para trocar de mês.</p>
          <div className="px-1 pb-1">
            <div role="grid" aria-labelledby="calendar-month-heading" aria-describedby="calendar-keyboard-help" className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">
              <div role="row" className="contents">
                {weekdayLabels.map((label) => (
                  <div key={label} role="columnheader" aria-label={label} className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs dark:text-zinc-400">
                    {label}
                  </div>
                ))}
              </div>

              {calendarWeeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} role="row" className="contents">
                  {week.map((date) => {
                    const dateKey = toDateKey(date);
                    const dayEvents = eventsByDate.get(dateKey) ?? [];
                    const isSelected = dateKey === selectedKey;
                    const isToday = dateKey === todayKey;
                    const isOutsideMonth = date.getMonth() !== currentDate.getMonth();
                    const eventCountLabel = dayEvents.length === 0
                      ? 'nenhum evento'
                      : `${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`;
                    const accessibleLabel = `${fullDateFormatter.format(date)}, ${eventCountLabel}`;

                    return (
                      <div key={dateKey} role="gridcell" aria-selected={isSelected} className="min-w-0">
                        <button
                          ref={(element) => {
                            if (element) dayButtonRefs.current.set(dateKey, element);
                            else dayButtonRefs.current.delete(dateKey);
                          }}
                          type="button"
                          tabIndex={isSelected ? 0 : -1}
                          aria-label={accessibleLabel}
                          aria-pressed={isSelected}
                          aria-current={isToday ? 'date' : undefined}
                          onClick={() => selectDate(date)}
                          onKeyDown={(event) => handleDayKeyDown(event, date)}
                          className={cn(
                            'geo-focus-ring group relative flex min-h-12 w-full min-w-0 flex-col rounded-xl border p-1.5 text-left transition-[background-color,border-color,box-shadow,color,opacity] sm:p-2',
                            calendarWeeks.length >= 6
                              ? 'sm:min-h-[4.5rem]'
                              : calendarWeeks.length === 5
                                ? 'sm:min-h-[5.5rem]'
                                : 'sm:min-h-[6.5rem]',
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/15 dark:border-indigo-400 dark:bg-indigo-400/15 dark:ring-indigo-300/15'
                              : 'border-zinc-200/80 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10',
                            isOutsideMonth && !isSelected && 'bg-zinc-50/60 text-zinc-400 opacity-65 dark:bg-zinc-950/55 dark:text-zinc-500'
                          )}
                        >
                          <span className={cn(
                            'flex h-7 min-w-7 items-center justify-center self-start rounded-full px-1 text-xs font-bold sm:text-sm',
                            isToday ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-700 dark:text-indigo-200' : 'text-zinc-900 dark:text-zinc-100',
                            isOutsideMonth && !isSelected && 'text-zinc-400 dark:text-zinc-500'
                          )}>
                            {date.getDate()}
                          </span>

                          <div className="mt-auto flex min-w-0 items-center gap-1 overflow-hidden sm:hidden" aria-hidden="true">
                            {dayEvents.slice(0, 3).map((item) => (
                              <span key={item.id} className={cn('h-1.5 w-1.5 shrink-0 rounded-full', eventToneClasses[item.tone].dot)} />
                            ))}
                            {dayEvents.length > 3 && <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">+{dayEvents.length - 3}</span>}
                          </div>

                          <div className="mt-1 hidden min-w-0 space-y-1 sm:block" aria-hidden="true">
                            {dayEvents.slice(0, 2).map((item) => (
                              <span key={item.id} className={cn('flex min-w-0 items-center gap-1 truncate rounded-md px-1.5 py-1 text-[10px] font-semibold leading-none ring-1', eventToneClasses[item.tone].chip)}>
                                <EventTypeIcon type={item.tipo} className="h-2.5 w-2.5 shrink-0" />
                                {item.hora && <span className="mr-1 tabular-nums opacity-75">{item.hora}</span>}
                                <span className="min-w-0 truncate">{item.titulo}</span>
                              </span>
                            ))}
                            {dayEvents.length > 2 && <span className="block px-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">+{dayEvents.length - 2} eventos</span>}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          </>}
        </section>

        {view === 'mes' && <aside
          aria-labelledby="daily-agenda-heading"
          className={cn(
            geoGreenSurfaceClass,
            'calendar-daily-panel min-w-0 flex w-full self-start flex-col justify-between rounded-[2rem] p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-emerald-300/15 sm:p-5',
            (loading || selectedEvents.length > 0) && 'min-h-[420px]'
          )}
        >
          <div className="min-w-0">
            <div className="mb-6">
              <h2 id="daily-agenda-heading" className="flex items-center gap-3 text-xl font-semibold text-white">
                <Calendar aria-hidden="true" className="h-6 w-6 text-emerald-100" /> Agenda do dia
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-emerald-50/85">{selectedDateLabel}</p>
            </div>

            <div className="space-y-3" aria-live="polite" aria-busy={loading}>
              {loading ? (
                <p className="text-sm font-medium text-emerald-50/85">Buscando compromissos…</p>
              ) : selectedEvents.length === 0 ? (
                <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
                  <p className="text-sm font-medium leading-relaxed text-emerald-50/90">
                    {hasActiveFilters && selectedRawEvents.length > 0
                      ? 'Nenhum evento deste dia corresponde aos filtros aplicados.'
                      : 'Nenhum compromisso ou entrega está agendado para este dia.'}
                  </p>
                  {hasActiveFilters && (
                    <button type="button" onClick={clearFilters} className="geo-focus-ring mt-3 min-h-11 rounded-full border border-white/25 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10">
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                selectedEvents.map(renderEventCard)
              )}
            </div>
          </div>

        </aside>}
      </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title={<span className="flex flex-wrap items-center gap-2"><span>Agendar compromisso</span>{addFormDirty && <span className="geo-badge-base geo-badge-unsaved px-2.5 py-1 text-[11px] font-bold leading-none">Alterações não salvas</span>}</span>}
        maxWidth="max-w-3xl"
        panelClassName="calendar-appointment-modal"
        density="compact"
        initialFocusId="calendar-title"
        closeDisabled={creating}
        ariaDescribedBy="calendar-required-hint"
        footer={<div className="calendar-appointment-footer">
          {formErrors.submit && <p id="calendar-submit-error" role="alert" tabIndex={-1} className="geo-focus-ring mb-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm leading-relaxed text-rose-900 dark:border-rose-400/40 dark:bg-rose-950/40 dark:text-rose-100">{formErrors.submit}</p>}
          <div className="calendar-footer-actions">
            <button type="button" disabled={creating} onClick={closeAddModal} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5 text-sm disabled:opacity-60">Cancelar</button>
            <button type="submit" form="calendar-appointment-form" disabled={creating} aria-busy={creating} className={cn(primarySubmitButtonClass,'calendar-submit min-h-11 px-6 text-sm disabled:cursor-wait disabled:opacity-65')}>
              <span className={creating ? 'invisible' : ''}>Agendar compromisso</span><span className={creating ? '' : 'invisible'} aria-hidden={!creating}>{creating ? 'Agendando…' : ''}</span>
            </button>
          </div>
          <span className="sr-only" role="status">{creating ? 'Agendando compromisso. Aguarde a confirmação do serviço local.' : ''}</span>
        </div>}
      >
        <form id="calendar-appointment-form" onSubmit={handleCreate} noValidate aria-busy={creating}>
          <p id="calendar-required-hint" className="mb-4 text-xs text-text-secondary">Campos com * são obrigatórios.</p>
          <fieldset disabled={creating} className="calendar-form-fields min-w-0 disabled:opacity-70">
            <section aria-labelledby="calendar-group-appointment" className="calendar-form-group">
              <h3 id="calendar-group-appointment"><NotePencil aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />Compromisso</h3>
              <div className="calendar-form-identity">
                <FormField htmlFor="calendar-title" label="Título do compromisso" required error={formErrors.titulo}>
                  <input id="calendar-title" name="titulo" type="text" autoComplete="off" required maxLength={180} value={novoTitulo}
                    onChange={event => {setNovoTitulo(event.target.value);if(formErrors.titulo)setFormErrors(current => ({...current,titulo:undefined}));}}
                    aria-invalid={Boolean(formErrors.titulo)} aria-describedby={formErrors.titulo ? 'calendar-title-error calendar-title-hint' : 'calendar-title-hint'}
                    placeholder="Ex.: Visita para levantamento" className={cn(geoFieldClass,'h-12 w-full px-4 text-sm')} />
                  <p id="calendar-title-hint" className="mt-1.5 text-xs text-text-secondary">Até 180 caracteres.</p>
                </FormField>
                <FormField htmlFor="calendar-type" label={<FieldLabel icon={<Tag aria-hidden="true" weight="duotone" className="h-3.5 w-3.5" />} tone="violet">Tipo</FieldLabel>}>
                  <AppointmentTypePicker id="calendar-type" name="tipo" value={novoTipo} onChange={setNovoTipo} />
                </FormField>
              </div>
            </section>
            <section aria-labelledby="calendar-group-when" className="calendar-form-group">
              <h3 id="calendar-group-when"><CalendarBlank aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />Quando</h3>
              <div className="calendar-form-when">
                <FormField htmlFor="calendar-date" label="Data" required error={formErrors.data}>
                  <CalendarDatePicker id="calendar-date" name="data" value={novaData} onChange={date => {setNovaData(date);if(formErrors.data)setFormErrors(current => ({...current,data:undefined}));}}
                    eventDates={eventDateKeys} invalid={Boolean(formErrors.data)} describedBy={formErrors.data ? 'calendar-date-error' : undefined} />
                </FormField>
                <FormField htmlFor="calendar-time" label="Horário" required={!diaInteiro} error={formErrors.hora}>
                  <TimePicker id="calendar-time" name="hora" disabled={diaInteiro || creating} value={novaHora}
                    onChange={time => {setNovaHora(time);if(formErrors.hora)setFormErrors(current => ({...current,hora:undefined}));}}
                    invalid={Boolean(formErrors.hora)} describedBy={formErrors.hora ? 'calendar-time-error' : 'calendar-time-hint'} />
                </FormField>
                <div className="calendar-all-day">
                  <SwitchField id="calendar-all-day" name="diaInteiro" label="Evento de dia inteiro" icon={<Sun aria-hidden="true" weight="duotone" className="h-5 w-5 text-amber-600 dark:text-amber-300" />} checked={diaInteiro} disabled={creating}
                    onChange={checked => {setDiaInteiro(checked);if(checked)setFormErrors(current => ({...current,hora:undefined}));}} className="min-h-12 px-3" />
                </div>
              </div>
              <p id="calendar-time-hint" className="mt-2 text-xs text-text-secondary">Formato de 24 horas. O horário preenchido é mantido ao alternar dia inteiro.</p>
            </section>
            <section aria-labelledby="calendar-group-links" className="calendar-form-group">
              <h3 id="calendar-group-links"><Briefcase aria-hidden="true" className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />Vínculos e observações</h3>
              <p id="calendar-links-hint" className="mb-3 text-xs leading-relaxed text-text-secondary">Vínculos opcionais. Selecionar um projeto preenche seu cliente. Trocar o cliente remove a seleção de projeto.</p>
              <div className="calendar-form-links">
                <FormField htmlFor="calendar-client" label="Cliente" hint="Opcional">
                  <RemoteCombobox<{id:string;nome:string}> id="calendar-client" name="clienteId" endpoint="/api/clientes/options" value={novoClienteId} fill inModal density="formLarge" disabled={creating} aria-describedby="calendar-links-hint"
                    onChange={clienteId => {if(clienteId !== novoClienteId){if(novoProjetoId)setLinkNotice('A seleção de projeto foi removida porque o cliente foi alterado.');setNovoClienteId(clienteId);setNovoProjetoId('');}}} emptyLabel="Sem vínculo" placeholder="Pesquisar cliente…" />
                </FormField>
                <FormField htmlFor="calendar-project" label="Projeto" hint="Opcional">
                  <RemoteCombobox<Projeto> id="calendar-project" name="projetoId" endpoint={`/api/projetos/options${novoClienteId ? `?clienteId=${encodeURIComponent(novoClienteId)}` : ''}`} value={novoProjetoId} fill inModal density="formLarge" disabled={creating} aria-describedby="calendar-links-hint"
                    onChange={(projetoId,project) => {setNovoProjetoId(projetoId);setLinkNotice('');if(project?.clienteId)setNovoClienteId(project.clienteId);}} emptyLabel="Sem vínculo" placeholder="Pesquisar projeto…" />
                </FormField>
              </div>
              {linkNotice && <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">{linkNotice}</p>}
              <div className="mt-4">
                <FormField htmlFor="calendar-description" label="Descrição" hint="Opcional" error={formErrors.descricao}>
                  <textarea id="calendar-description" name="descricao" value={novaDescricao} onChange={event => {setNovaDescricao(event.target.value);if(formErrors.descricao)setFormErrors(current => ({...current,descricao:undefined}));}} rows={4} maxLength={4000}
                    aria-invalid={Boolean(formErrors.descricao)} aria-describedby={formErrors.descricao ? 'calendar-description-error calendar-description-hint' : 'calendar-description-hint'}
                    placeholder="Ex.: Ponto de encontro e orientações para a visita…" className={cn(geoFieldClass,'min-h-28 w-full resize-y px-4 py-3 text-sm')} />
                  <p id="calendar-description-hint" className="mt-1.5 text-right text-xs tabular-nums text-text-secondary">{novaDescricao.length.toLocaleString('pt-BR')} / 4.000 caracteres</p>
                </FormField>
              </div>
            </section>
          </fieldset>
        </form>
      </Modal>
      <ConfirmDialog isOpen={discardOpen} onClose={() => setDiscardOpen(false)}
        onConfirm={() => {setDiscardOpen(false);setShowAddModal(false);resetForm();}}
        title="Descartar compromisso não salvo?" description="Os campos preenchidos serão descartados. Você pode continuar preenchendo para manter suas alterações."
        confirmText="Descartar compromisso" cancelText="Continuar preenchendo" variant="warning" />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir compromisso${deleteTarget?.titulo ? ` “${deleteTarget.titulo}”` : ''}?`}
        description="O compromisso será removido do calendário. Os cadastros de cliente e projeto vinculados serão preservados. Após a exclusão, você ainda poderá usar “Desfazer” por alguns segundos."
        confirmText="Excluir compromisso"
        loading={deleting}
      />
    </Layout>
  );
}
