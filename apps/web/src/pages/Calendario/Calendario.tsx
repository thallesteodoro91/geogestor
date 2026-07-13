import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretLeft, CaretRight, Plus, Calendar, Trash, MagnifyingGlass } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { geoGreenSurfaceClass } from '../../utils/geoTheme';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { apiFetch } from '../../services/apiClient';
import {
  filterBarClass,
  filterClearButtonClass,
  filterSearchInputClass
} from '../../utils/filterStyles';

interface Projeto {
  id: string;
  nome: string;
  dataInicio: string;
  dataEntrega: string;
}

interface Tarefa {
  id: string;
  titulo: string;
  status: string;
  dataLimite: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
}

interface Compromisso {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  data: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
}

interface CalendarioEvento {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  status?: string;
  color: string;
  canDelete?: boolean;
  data?: string;
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

  if (
    payload
    && typeof payload === 'object'
    && 'data' in payload
    && Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }

  throw new Error(`A resposta de ${label} está em um formato inválido.`);
}

const getGoogleCalendarUrl = (titulo: string, dataStr: string, descricao?: string) => {
  const dateParts = dataStr.split('-');
  if (dateParts.length === 3) {
    const y = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10);
    const d = parseInt(dateParts[2], 10);
    const nextDay = new Date(y, m - 1, d + 1);
    const nextY = nextDay.getFullYear();
    const nextM = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nextD = String(nextDay.getDate()).padStart(2, '0');
    const datesParam = `${dateParts[0]}${dateParts[1]}${dateParts[2]}/${nextY}${nextM}${nextD}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&details=${encodeURIComponent(descricao || '')}&dates=${datesParam}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&details=${encodeURIComponent(descricao || '')}`;
};

export function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoTipo, setNovoTipo] = useState('Visita de Campo');
  const [novoProjetoId, setNovoProjetoId] = useState('');
  const [novaData, setNovaData] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('Todos');

  const fetchDados = async () => {
    Promise.resolve().then(() => {
      setLoading(true);
    });

    setLoadError('');

    try {
      const [projetosResult, tarefasResult, compromissosResult] = await Promise.allSettled([
        fetchCollection<Projeto>('/api/projetos', 'os projetos'),
        fetchCollection<Tarefa>('/api/tarefas', 'as tarefas'),
        fetchCollection<Compromisso>('/api/compromissos', 'os compromissos')
      ]);

      const projetosData = projetosResult.status === 'fulfilled' ? projetosResult.value : [];
      const tarefasData = tarefasResult.status === 'fulfilled' ? tarefasResult.value : [];
      const compromissosData = compromissosResult.status === 'fulfilled' ? compromissosResult.value : [];

      setProjetos(projetosData);
      setTarefas(tarefasData);
      setCompromissos(compromissosData);

      if (projetosData.length > 0) {
        setNovoProjetoId(projetosData[0].id);
      }

      const errors = [projetosResult, tarefasResult, compromissosResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));

      if (errors.length > 0) {
        setLoadError(errors.join(' '));
      }
    } catch (error) {
      setProjetos([]);
      setTarefas([]);
      setCompromissos([]);
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o calendário.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchDados);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo || !novaData) return;

    try {
      const res = await apiFetch('/api/compromissos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novoTitulo,
          descricao: novaDescricao,
          tipo: novoTipo,
          data: novaData,
          projetoId: novoProjetoId || null
        })
      });

      if (res.ok) {
        setNovoTitulo('');
        setNovaDescricao('');
        setShowAddModal(false);
        fetchDados();
      }
    } catch {
      alert('Erro ao criar compromisso');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este compromisso?')) return;
    try {
      const res = await apiFetch(`/api/compromissos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDados();
      }
    } catch {
      alert('Erro ao deletar compromisso');
    }
  };

  // Month navigation helpers
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const emptyBoxes = Array.from({ length: firstDayIndex }, () => null);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Helper to format date key YYYY-MM-DD
  const formatDateKey = (dayNum: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const eventMatchesFilters = (evt: CalendarioEvento) => {
    const searchable = [evt.titulo, evt.descricao, evt.tipo, evt.status].filter(Boolean).join(' ');
    const searchMatch = matchesSearch(searchable, busca);
    const matchesType = filtroTipo === 'Todos' || evt.tipo === filtroTipo;
    const matchesStatus = filtroStatus === 'Todos' || evt.status === filtroStatus;
    return searchMatch && matchesType && matchesStatus;
  };

  // Aggregate all events for a given day
  const getEventsForDay = (dayNum: number) => {
    const key = formatDateKey(dayNum);
    const dayEvents: CalendarioEvento[] = [];

    // 1. Projetos start/end
    projetos.forEach(p => {
      if (p.dataInicio === key) {
        dayEvents.push({ id: `p-start-${p.id}`, titulo: `Início: ${p.nome}`, tipo: 'Projeto', status: 'Início', color: 'bg-blue-50 text-blue-700 ring-blue-100', data: key });
      }
      if (p.dataEntrega === key) {
        dayEvents.push({ id: `p-end-${p.id}`, titulo: `Entrega: ${p.nome}`, tipo: 'Projeto', status: 'Entrega', color: 'bg-purple-50 text-purple-700 ring-purple-100', data: key });
      }
    });

    // 2. Tarefas
    tarefas.forEach(t => {
      if (t.dataLimite === key) {
        dayEvents.push({ id: `t-${t.id}`, titulo: `Tarefa: ${t.titulo}`, tipo: 'Tarefa', status: t.status, color: 'bg-amber-50 text-amber-700 ring-amber-100', data: key });
      }
    });

    // 3. Compromissos
    compromissos.forEach(c => {
      if (c.data === key) {
        dayEvents.push({
          id: `c-${c.id}`,
          titulo: c.titulo,
          descricao: c.descricao,
          tipo: c.tipo,
          status: 'Agendado',
          color: c.tipo === 'Reunião' ? 'bg-indigo-50 text-indigo-700 ring-indigo-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100',
          canDelete: true,
          data: key
        });
      }
    });

    return dayEvents.filter(eventMatchesFilters);
  };

  const isSelectedDateInCurrentMonth = selectedDate 
    ? selectedDate.getMonth() === month && selectedDate.getFullYear() === year
    : false;

  const selectedEvents = (selectedDate && isSelectedDateInCurrentMonth)
    ? getEventsForDay(selectedDate.getDate())
    : [];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-5">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            Gestão de Agendas
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Calendário
          </h1>
          <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Agende reuniões, campo e acompanhe prazos de entregas de forma automática.
          </p>
        </div>

        <button 
          onClick={() => {
            if (selectedDate) {
              setNovaData(formatDateKey(selectedDate.getDate()));
            }
            setShowAddModal(true);
          }}
          className={primaryActionButtonClass}
        >
          <span>Agendar Compromisso</span>
          <div className={primaryActionIconClass}>
            <Plus weight="bold" className="w-4 h-4" />
          </div>
        </button>
      </div>

      <div className={cn('mb-5', filterBarClass)}>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.7fr))_auto] items-center">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por compromisso, tarefa, projeto ou descrição..."
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={filtroTipo}
            onChange={setFiltroTipo}
            placeholder="Todos os tipos"
            className="min-w-0"
            options={['Todos', 'Projeto', 'Tarefa', 'Reunião', 'Visita de Campo', 'Outro'].map((value) => ({ label: value === 'Todos' ? 'Todos os tipos' : value, value }))}
          />
          <CustomSelect
            value={filtroStatus}
            onChange={setFiltroStatus}
            placeholder="Todos os status"
            className="min-w-0"
            options={['Todos', 'Agendado', 'Início', 'Entrega', 'A Fazer', 'Em Progresso', 'Concluído'].map((value) => ({ label: value === 'Todos' ? 'Todos os status' : value, value }))}
          />
          {(busca || filtroTipo !== 'Todos' || filtroStatus !== 'Todos') && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setFiltroTipo('Todos');
                setFiltroStatus('Todos');
              }}
              className={filterClearButtonClass}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <span>{loadError} O calendário foi mantido disponível, sem os dados que falharam.</span>
          <button
            type="button"
            onClick={fetchDados}
            className="shrink-0 rounded-full border border-amber-300/70 bg-white/70 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white dark:border-amber-400/30 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-gradient-to-br from-white via-white to-indigo-50/45 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 rounded-[2.5rem] p-6 ring-1 ring-zinc-900/5 dark:ring-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col justify-between">
          <div>
            {/* Header / Month toggle */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {monthNames[month]} {year}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="w-10 h-10 rounded-full hover:bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
                  <CaretLeft weight="bold" className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                </button>
                <button onClick={nextMonth} className="w-10 h-10 rounded-full hover:bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
                  <CaretRight weight="bold" className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                </button>
              </div>
            </div>

            {/* Weekdays header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {emptyBoxes.map((_, idx) => (
                <div key={`empty-${idx}`} className="h-[clamp(5.75rem,10vh,7rem)] bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl" />
              ))}
              
              {daysArray.map(day => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === month && selectedDate?.getFullYear() === year;
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`h-[clamp(5.75rem,10vh,7rem)] p-3 rounded-2xl border transition-all flex flex-col justify-between text-left relative group ${
                      isSelected 
                        ? 'border-indigo-600 ring-2 ring-indigo-500/10 bg-indigo-50/10' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50 dark:bg-zinc-900/50 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${
                      isToday ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs' :
                      isSelected ? 'text-indigo-600' : 'text-zinc-900 dark:text-zinc-100'
                    }`}>
                      {day}
                    </span>

                    {/* Dots / Event indicators */}
                    <div className="flex gap-1 overflow-hidden mt-1 max-w-full">
                      {dayEvents.slice(0, 3).map(evt => {
                        let dotColor = 'bg-zinc-400';
                        if (evt.tipo === 'Projeto') dotColor = 'bg-blue-500';
                        if (evt.tipo === 'Tarefa') dotColor = 'bg-amber-500';
                        if (evt.tipo === 'Reunião') dotColor = 'bg-indigo-500';
                        if (evt.tipo === 'Visita de Campo') dotColor = 'bg-emerald-500';

                        return (
                          <span key={evt.id} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] font-bold text-zinc-400">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day events details */}
        <div className={cn(geoGreenSurfaceClass, 'rounded-[2.5rem] p-8 ring-1 ring-emerald-300/15 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col justify-between min-h-[420px]')}>
          <div>
            <h3 className="mb-6 flex items-center gap-3 text-xl font-semibold text-white">
              <Calendar className="h-6 w-6 text-emerald-100/80" /> Agenda do Dia
            </h3>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-zinc-400">Buscando compromissos...</p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-zinc-400 text-sm">Nenhum compromisso ou entrega agendada para este dia.</p>
              ) : (
                selectedEvents.map(evt => {
                  const cleanId = evt.id.replace(/^(p-start-|p-end-|t-|c-)/, '');
                  const linkPath = evt.id.startsWith('p-') 
                    ? `/projetos/${cleanId}` 
                    : evt.id.startsWith('t-') 
                      ? `/calendario/tarefa/${cleanId}` 
                      : `/calendario/compromisso/${cleanId}`;

                  return (
                    <div key={evt.id} className={`p-4 rounded-2xl border ring-1 flex justify-between items-start gap-4 ${evt.color}`}>
                      <Link to={linkPath} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                        <p className="font-semibold text-xs uppercase tracking-wider mb-1 opacity-70">{evt.tipo}</p>
                        <p className="font-semibold text-sm leading-tight truncate hover:underline">{evt.titulo}</p>
                        {evt.descricao && <p className="text-xs mt-1.5 opacity-80 leading-relaxed">{evt.descricao}</p>}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {evt.data && (
                          <a
                            href={getGoogleCalendarUrl(evt.titulo, evt.data, evt.descricao)}
                            target="_blank"
                            rel="noreferrer"
                            title="Sincronizar com Google Calendar"
                            className="p-1.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white transition-all border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
                            </svg>
                          </a>
                        )}
                        {evt.canDelete && (
                          <button 
                            onClick={() => handleDelete(evt.id.replace('c-', ''))}
                            className="p-1.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 text-zinc-400 hover:text-red-600 hover:bg-white transition-all border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm flex items-center justify-center"
                            title="Excluir compromisso"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-50">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Legenda de Cores</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Projeto</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Tarefa</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Reunião</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Visita</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo Compromisso */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-10 shadow-[0_0_80px_rgba(0,0,0,0.1)] ring-1 ring-zinc-900/5"
            >
              <h3 className="text-3xl font-semibold tracking-tighter text-zinc-950 dark:text-white mb-8">Novo Compromisso</h3>
              
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Título do Compromisso</label>
                  <input 
                    type="text" 
                    required 
                    value={novoTitulo} 
                    onChange={e => setNovoTitulo(e.target.value)} 
                    placeholder="Ex: Medição da Área de Preservação" 
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Tipo</label>
                    <select 
                      value={novoTipo} 
                      onChange={e => setNovoTipo(e.target.value)} 
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none appearance-none"
                    >
                      <option value="Visita de Campo">Visita de Campo</option>
                      <option value="Reunião">Reunião</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Data</label>
                    <input 
                      type="date" 
                      required
                      value={novaData} 
                      onChange={e => setNovaData(e.target.value)} 
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Projeto Vinculado (Opcional)</label>
                  <select 
                    value={novoProjetoId} 
                    onChange={e => setNovoProjetoId(e.target.value)} 
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none appearance-none"
                  >
                    <option value="">Sem vínculo</option>
                    {projetos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Descrição</label>
                  <textarea 
                    value={novaDescricao} 
                    onChange={e => setNovaDescricao(e.target.value)} 
                    rows={3} 
                    placeholder="Adicione observações..."
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none resize-none"
                  ></textarea>
                </div>

                <div className="pt-6 flex items-center justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)} 
                    className="px-6 py-3 rounded-full text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className={cn(primarySubmitButtonClass, 'px-6 py-3 font-medium')}
                  >
                    Agendar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
