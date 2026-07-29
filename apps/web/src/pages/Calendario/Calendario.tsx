import { Briefcase, Calendar, CalendarBlank, CaretLeft, CaretRight, CheckSquare, Clock, DotsThreeCircle, MagnifyingGlass, MapPin, NotePencil, Package, Phone, Plus, Sun, Tag, Trash, User, UsersThree, Wrench
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FormError, FormField, FormFooter, FormSelect, SwitchField } from '../../components/Form';
import { CustomSelect } from '../../components/CustomSelect';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoGreenSurfaceClass } from '../../utils/geoTheme';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { apiFetch } from '../../services/apiClient';
import { AppointmentTypePicker, CalendarDatePicker, MonthYearPicker, TimePicker } from './CalendarControls';
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

interface Cliente {
  id: string;
  nome: string;
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

async function fetchCollection<T>(url: string, label: string): Promise<T[]> {
  const response = await apiFetch(url);
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
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Compromisso | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoTipo, setNovoTipo] = useState('Visita de Campo');
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoProjetoId, setNovoProjetoId] = useState('');
  const [novaData, setNovaData] = useState('');
  const [novaHora, setNovaHora] = useState('09:00');
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');
  const [filtroTipo, setFiltroTipo] = useState(searchParams.get('tipo') ?? 'Todos');
  const [filtroStatus, setFiltroStatus] = useState(searchParams.get('status') ?? 'Todos');
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const fetchDados = async () => {
    setLoading(true);
    setLoadError('');

    const results = await Promise.allSettled([
      fetchCollection<Projeto>('/api/projetos', 'os projetos'),
      fetchCollection<Cliente>('/api/clientes?limit=500', 'os clientes'),
      fetchCollection<Tarefa>('/api/tarefas', 'as tarefas'),
      fetchCollection<Compromisso>('/api/compromissos', 'os compromissos')
    ]);

    const [projetosResult, clientesResult, tarefasResult, compromissosResult] = results;
    setProjetos(projetosResult.status === 'fulfilled' ? projetosResult.value : []);
    setClientes(clientesResult.status === 'fulfilled' ? clientesResult.value : []);
    setTarefas(tarefasResult.status === 'fulfilled' ? tarefasResult.value : []);
    setCompromissos(compromissosResult.status === 'fulfilled' ? compromissosResult.value : []);

    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    if (errors.length) setLoadError(errors.join(' '));
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(fetchDados);
  }, []);

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('mes', toMonthKey(currentDate));
      next.set('data', toDateKey(selectedDate));
      if (busca) next.set('busca', busca); else next.delete('busca');
      if (filtroTipo !== 'Todos') next.set('tipo', filtroTipo); else next.delete('tipo');
      if (filtroStatus !== 'Todos') next.set('status', filtroStatus); else next.delete('status');
      return next;
    }, { replace: true });
  }, [busca, currentDate, filtroStatus, filtroTipo, selectedDate, setSearchParams]);

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

    return events.sort((left, right) => `${left.data} ${left.hora ?? '99:99'}`.localeCompare(`${right.data} ${right.hora ?? '99:99'}`));
  }, [compromissos, projetos, tarefas]);

  const eventDateKeys = useMemo(() => new Set(allEvents.map((event) => event.data)), [allEvents]);

  const filteredEvents = useMemo(() => allEvents.filter((event) => {
    const searchable = [event.titulo, event.descricao, event.tipo, event.status, event.clienteNome, event.projetoNome]
      .filter(Boolean)
      .join(' ');
    return matchesSearch(searchable, busca)
      && (filtroTipo === 'Todos' || event.tipo === filtroTipo)
      && (filtroStatus === 'Todos' || event.status === filtroStatus);
  }), [allEvents, busca, filtroStatus, filtroTipo]);

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

  const typeOptions = useMemo(() => {
    const values = new Set(['Projeto', 'Tarefa', 'Reunião', 'Visita de Campo', 'Outro']);
    compromissos.forEach((item) => values.add(item.tipo));
    return [{ label: 'Todos os tipos', value: 'Todos' }, ...Array.from(values).sort().map((value) => ({ label: value, value }))];
  }, [compromissos]);

  const statusOptions = useMemo(() => {
    const values = new Set(['Agendado', 'Início', 'Entrega', 'A Fazer', 'Em Progresso', 'Concluído']);
    tarefas.forEach((item) => values.add(item.status));
    return [{ label: 'Todos os status', value: 'Todos' }, ...Array.from(values).filter(Boolean).map((value) => ({ label: value, value }))];
  }, [tarefas]);

  const availableProjects = useMemo(() => {
    if (!novoClienteId) return projetos;
    return projetos.filter((projeto) => !projeto.clienteId || projeto.clienteId === novoClienteId);
  }, [novoClienteId, projetos]);

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

  const selectDate = (date: Date, focus = false) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(normalized);
    if (normalized.getMonth() !== currentDate.getMonth() || normalized.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(normalized.getFullYear(), normalized.getMonth(), 1));
    }
    if (focus) {
      window.requestAnimationFrame(() => dayButtonRefs.current.get(toDateKey(normalized))?.focus());
    }
  };

  const moveMonth = (amount: number) => {
    const next = addMonthsKeepingDay(selectedDate, currentDate, amount);
    setCurrentDate(next.month);
    setSelectedDate(next.selected);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const changeMonth = (value: string) => {
    const nextMonth = parseMonthKey(value);
    if (!nextMonth) return;
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setCurrentDate(nextMonth);
    setSelectedDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selectedDate.getDate(), lastDay)));
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

  const openAddModal = () => {
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
  };

  const closeAddModal = () => {
    if (creating) return;
    if (addFormDirty && !window.confirm('Descartar as alterações não salvas deste compromisso?')) return;
    setShowAddModal(false);
    resetForm();
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    if (!novoTitulo.trim()) errors.titulo = 'Informe um título para identificar o compromisso.';
    if (!parseDateKey(novaData)) errors.data = 'Escolha uma data válida.';
    if (!diaInteiro && !TIME_PATTERN.test(novaHora)) errors.hora = 'Informe um horário válido no formato 24 horas ou marque como evento de dia inteiro.';
    setFormErrors(errors);
    const firstErrorId = errors.titulo ? 'calendar-title' : errors.data ? 'calendar-date' : errors.hora ? 'calendar-time' : null;
    if (firstErrorId) window.requestAnimationFrame(() => document.getElementById(firstErrorId)?.focus());
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
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
      await fetchDados();
      const createdDate = parseDateKey(created.data) ?? selectedDate;
      setSelectedDate(createdDate);
      setCurrentDate(new Date(createdDate.getFullYear(), createdDate.getMonth(), 1));
      setShowAddModal(false);
      resetForm();
      toast.success('Compromisso agendado com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível agendar o compromisso.';
      setFormErrors({ submit: `${message} Revise os dados e tente novamente.` });
    } finally {
      setCreating(false);
    }
  };

  const restoreDeletedCompromisso = async (deleted: Compromisso) => {
    try {
      const response = await apiFetch('/api/compromissos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: deleted.titulo,
          descricao: deleted.descricao || '',
          tipo: deleted.tipo,
          data: deleted.data,
          hora: deleted.hora || null,
          clienteId: deleted.clienteId || null,
          projetoId: deleted.projetoId || null
        })
      });
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
    setCompromissos((current) => current.filter((item) => item.id !== deleted.id));

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
      setCompromissos((current) => [...current, deleted]);
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o compromisso.');
    } finally {
      setDeleting(false);
    }
  };

  const monthLabel = capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate));
  const selectedDateLabel = capitalize(new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(selectedDate));
  const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayKey = toDateKey(new Date());

  return (
    <Layout>
      <ModuleNavigation module="agenda" />
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 text-balance sm:text-4xl dark:text-white">
            Calendário
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-zinc-500 sm:text-base dark:text-zinc-400">
            Agende reuniões e visitas de campo e acompanhe automaticamente os prazos dos projetos.
          </p>
        </div>

        <button type="button" onClick={openAddModal} className={cn(primaryActionButtonClass, 'w-full md:w-auto')}>
          <span>Agendar compromisso</span>
          <span className={primaryActionIconClass} aria-hidden="true">
            <Plus weight="bold" className="h-4 w-4" />
          </span>
        </button>
      </div>

      <section aria-label="Filtros do calendário" className={cn('mb-5', filterBarClass)}>
        <div className="grid grid-cols-1 items-center gap-2.5 lg:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.7fr))_auto]">
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
              placeholder="Buscar compromisso, tarefa, projeto ou descrição…"
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={filtroTipo}
            onChange={setFiltroTipo}
            placeholder="Todos os tipos"
            ariaLabel="Filtrar por tipo de evento"
            className="min-w-0"
            options={typeOptions}
          />
          <CustomSelect
            value={filtroStatus}
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
        <p className="mt-2 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400" role="status" aria-live="polite">
          {hasActiveFilters
            ? `${filteredMonthEvents} de ${totalMonthEvents} eventos encontrados em ${monthLabel.toLocaleLowerCase('pt-BR')}.`
            : `${totalMonthEvents} ${totalMonthEvents === 1 ? 'evento' : 'eventos'} em ${monthLabel.toLocaleLowerCase('pt-BR')}.`}
        </p>
      </section>

      {loadError && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
          <span>{loadError} Os demais dados continuam disponíveis.</span>
          <button type="button" onClick={() => void fetchDados()} className="geo-focus-ring min-h-11 shrink-0 rounded-full border border-amber-300/70 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white dark:border-amber-400/30 dark:bg-zinc-900/60 dark:hover:bg-zinc-900">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
        <section aria-labelledby="calendar-month-heading" aria-busy={loading} className="flex flex-col rounded-[2rem] bg-gradient-to-br from-white via-white to-indigo-50/45 p-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-zinc-900/5 sm:p-6 lg:col-span-3 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 dark:ring-white/10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="calendar-month-heading" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {monthLabel}
            </h2>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <MonthYearPicker
                id="calendar-month-picker"
                value={toMonthKey(currentDate)}
                onChange={changeMonth}
                className="w-full sm:w-auto"
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

          <p id="calendar-keyboard-help" className="sr-only">Use as setas para navegar entre os dias, Home e End para ir ao início ou fim da semana e Page Up ou Page Down para trocar de mês.</p>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div role="grid" aria-labelledby="calendar-month-heading" aria-describedby="calendar-keyboard-help" className="grid min-w-[336px] grid-cols-7 gap-1 sm:min-w-0 sm:gap-2">
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
        </section>

        <aside
          aria-labelledby="daily-agenda-heading"
          className={cn(
            geoGreenSurfaceClass,
            'flex w-full self-start flex-col justify-between rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-emerald-300/15 sm:p-8',
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
                selectedEvents.map((item) => {
                  const cleanId = item.id.replace(/^(p-start-|p-end-|t-|c-)/, '');
                  const linkPath = item.id.startsWith('p-')
                    ? `/projetos/${cleanId}`
                    : item.id.startsWith('t-')
                      ? `/calendario/tarefa/${cleanId}`
                      : `/calendario/compromisso/${cleanId}`;

                  return (
                    <article key={item.id} className={cn('flex items-start justify-between gap-3 rounded-xl border p-4 ring-1', eventToneClasses[item.tone].card)}>
                      <Link to={linkPath} className="geo-focus-ring min-w-0 flex-1 rounded-lg transition-opacity hover:opacity-80">
                        <div className="mb-2 flex items-center gap-2">
                          <span aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm', eventToneClasses[item.tone].icon)}>
                            <EventTypeIcon type={item.tipo} className="h-4 w-4" />
                          </span>
                          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{item.tipo}</p>
                        </div>
                        <p className="break-words text-sm font-semibold leading-snug hover:underline">{item.titulo}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium opacity-80">
                          {item.hora && <span className="flex items-center gap-1 tabular-nums"><Clock aria-hidden="true" weight="duotone" className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-200" />{item.hora}</span>}
                          {item.clienteNome && <span className="flex items-center gap-1"><User aria-hidden="true" weight="duotone" className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-200" />{item.clienteNome}</span>}
                          {item.projetoNome && item.tipo !== 'Projeto' && <span className="flex items-center gap-1"><Briefcase aria-hidden="true" weight="duotone" className="h-3.5 w-3.5 text-violet-700 dark:text-violet-200" />{item.projetoNome}</span>}
                        </div>
                        {item.descricao && <p className="mt-2 break-words text-xs leading-relaxed opacity-80">{item.descricao}</p>}
                      </Link>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <a
                          href={getGoogleCalendarUrl(item)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Adicionar ${item.titulo} ao Google Agenda`}
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
                })
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-white/25 pt-6">
            <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-white/85">Legenda de cores</span>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-white/90">
              <div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">P</span>Projeto</div>
              <div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-zinc-950">T</span>Tarefa</div>
              <div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white">R</span>Reunião</div>
              <div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-zinc-950">V</span>Visita</div>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span>Novo compromisso</span>
            {addFormDirty && (
              <span className="geo-badge-base geo-badge-unsaved px-2.5 py-1 text-[11px] font-bold leading-none">
                Alterações não salvas
              </span>
            )}
          </span>
        )}
        maxWidth="max-w-2xl"
        initialFocusId="calendar-title"
      >
        <form onSubmit={handleCreate} noValidate className="space-y-5">
          <FormError message={formErrors.submit} />

          <FormField htmlFor="calendar-title" label="Título do compromisso" required error={formErrors.titulo}>
            <input
              id="calendar-title"
              name="titulo"
              type="text"
              autoComplete="off"
              required
              value={novoTitulo}
              onChange={(event) => {
                setNovoTitulo(event.target.value);
                if (formErrors.titulo) setFormErrors((current) => ({ ...current, titulo: undefined }));
              }}
              aria-invalid={Boolean(formErrors.titulo)}
              aria-describedby={formErrors.titulo ? 'calendar-title-error' : undefined}
              placeholder="Ex.: Medição da Área de Preservação"
              className={cn(geoFieldClass, 'h-12 w-full px-4 text-sm')}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField htmlFor="calendar-type" label={<FieldLabel icon={<Tag weight="duotone" className="h-3.5 w-3.5" />} tone="violet">Tipo</FieldLabel>}>
              <AppointmentTypePicker
                id="calendar-type"
                name="tipo"
                value={novoTipo}
                onChange={setNovoTipo}
              />
            </FormField>

            <FormField htmlFor="calendar-date" label={<FieldLabel icon={<CalendarBlank weight="duotone" className="h-3.5 w-3.5" />} tone="indigo">Data</FieldLabel>} required error={formErrors.data}>
              <CalendarDatePicker
                id="calendar-date"
                name="data"
                value={novaData}
                onChange={(date) => {
                  setNovaData(date);
                  if (formErrors.data) setFormErrors((current) => ({ ...current, data: undefined }));
                }}
                eventDates={eventDateKeys}
                invalid={Boolean(formErrors.data)}
                describedBy={formErrors.data ? 'calendar-date-error' : undefined}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField htmlFor="calendar-time" label={<FieldLabel icon={<Clock weight="duotone" className="h-3.5 w-3.5" />} tone="cyan">Horário</FieldLabel>} required={!diaInteiro} error={formErrors.hora}>
              <TimePicker
                id="calendar-time"
                name="hora"
                disabled={diaInteiro}
                value={novaHora}
                onChange={(time) => {
                  setNovaHora(time);
                  if (formErrors.hora) setFormErrors((current) => ({ ...current, hora: undefined }));
                }}
                invalid={Boolean(formErrors.hora)}
                describedBy={formErrors.hora ? 'calendar-time-error' : undefined}
              />
            </FormField>

            <div className="flex items-end">
              <SwitchField
                id="calendar-all-day"
                name="diaInteiro"
                label="Evento de dia inteiro"
                icon={<Sun weight="duotone" className="h-5 w-5 text-amber-500 dark:text-amber-300" />}
                checked={diaInteiro}
                onChange={(checked) => {
                  setDiaInteiro(checked);
                  if (checked) setFormErrors((current) => ({ ...current, hora: undefined }));
                }}
                className="min-h-12 px-4"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField htmlFor="calendar-client" label={<FieldLabel icon={<User weight="duotone" className="h-3.5 w-3.5" />} tone="emerald">Cliente</FieldLabel>} hint="Opcional">
              <FormSelect
                id="calendar-client"
                name="clienteId"
                value={novoClienteId}
                onChange={(event) => {
                  const clienteId = event.target.value;
                  setNovoClienteId(clienteId);
                  const selectedProject = projetos.find((projeto) => projeto.id === novoProjetoId);
                  if (selectedProject?.clienteId && selectedProject.clienteId !== clienteId) setNovoProjetoId('');
                }}
                className={cn(geoFieldClass, 'geo-native-select h-12 w-full appearance-none px-4 text-sm')}
              >
                <option value="">Sem vínculo</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
              </FormSelect>
            </FormField>

            <FormField htmlFor="calendar-project" label={<FieldLabel icon={<Briefcase weight="duotone" className="h-3.5 w-3.5" />} tone="violet">Projeto</FieldLabel>} hint="Opcional">
              <FormSelect
                id="calendar-project"
                name="projetoId"
                value={novoProjetoId}
                onChange={(event) => {
                  const projetoId = event.target.value;
                  setNovoProjetoId(projetoId);
                  const project = projetos.find((item) => item.id === projetoId);
                  if (project?.clienteId) setNovoClienteId(project.clienteId);
                }}
                className={cn(geoFieldClass, 'geo-native-select h-12 w-full appearance-none px-4 text-sm')}
              >
                <option value="">Sem vínculo</option>
                {availableProjects.map((projeto) => <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>)}
              </FormSelect>
            </FormField>
          </div>

          <FormField htmlFor="calendar-description" label={<FieldLabel icon={<NotePencil weight="duotone" className="h-3.5 w-3.5" />} tone="amber">Descrição</FieldLabel>} hint="Opcional">
            <textarea
              id="calendar-description"
              name="descricao"
              value={novaDescricao}
              onChange={(event) => setNovaDescricao(event.target.value)}
              rows={4}
              placeholder="Adicione observações, instruções ou o local do compromisso…"
              className={cn(geoFieldClass, 'w-full resize-y px-4 py-3 text-sm')}
            />
          </FormField>

          <FormFooter>
            <button type="button" disabled={creating} onClick={closeAddModal} className="geo-focus-ring min-h-11 rounded-full px-5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
              Cancelar
            </button>
            <button type="submit" disabled={creating} className={cn(primarySubmitButtonClass, 'min-h-11 px-6 text-sm disabled:cursor-wait disabled:opacity-65')}>
              {creating ? 'Agendando…' : 'Agendar compromisso'}
            </button>
          </FormFooter>
        </form>
      </Modal>
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
