import { toast } from 'sonner';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { planningReturnPath } from '../Planejamento/planningPresentation';
import { Layout } from '../../components/Layout';
import { useListPageNavigation, useListUrlState } from '../../hooks/useListPageNavigation';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import { DatePickerField, FormError, FormFooter, FormSection, FormSelect } from '../../components/Form';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ArrowCounterClockwise, CheckCircle, DotsSixVertical, PencilSimple, Plus, Trash, BookmarkSimple, Calendar, Funnel, MagnifyingGlass } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { headerPrimaryActionButtonClass, headerPrimaryActionIconClass, primaryActionButtonClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import {
  filterBarClass,
  filterClearButtonClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';
import { APP_QUERY_KEYS, type Tarefa } from '@geogestor/contracts';
import { apiClient, apiFetch } from '../../services/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import { localDateKey } from '../../utils/localDate';

type TaskPage = {
  items: Tarefa[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  statusTotals: Record<'A Fazer' | 'Em Progresso' | 'Concluído' | 'outros', number>;
};
type ProjectOption = { id: string; nome: string; clienteNome?: string | null };
type BoardTask = Tarefa & { originalStatus?: string; originalPriority?: string };
const taskPageRequests = new Map<string, Promise<TaskPage>>();
const validTaskStatuses = new Set(['A Fazer', 'Em Progresso', 'Concluído']);
const validTaskPriorities = new Set(['Baixa', 'Média', 'Alta']);

const taskDraftKey = (draft: {
  titulo: string; descricao: string; projetoId: string; prioridade: string; dataLimite: string;
}) => JSON.stringify(draft);

function loadTaskPage(endpoint: string) {
  const existing = taskPageRequests.get(endpoint);
  if (existing) return existing;
  const request = apiClient.get<TaskPage>(endpoint).finally(() => taskPageRequests.delete(endpoint));
  taskPageRequests.set(endpoint, request);
  return request;
}

export function Tarefas() {
  const location = useLocation();
  const planningBack = planningReturnPath(new URLSearchParams(location.search).get('retorno'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listUrl = useListUrlState();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState('');
  const [resolvedTaskFocus, setResolvedTaskFocus] = useState<{ id: string; found: boolean } | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const handledTaskIdRef = useRef<string | null>(null);
  const focusClearTimer = useRef<number | null>(null);
  const selectedProjeto = listUrl.params.get('tarefasProjeto') || 'all';
  const setSelectedProjeto = (value: string) => listUrl.update({ tarefasProjeto: value === 'all' ? null : value, tarefasPagina: null });
  const searchTerm = listUrl.params.get('tarefasBusca') || '';
  const setSearchTerm = (value: string) => listUrl.update({ tarefasBusca: value === '' ? null : value, tarefasPagina: null });
  const prioridadeFilter = listUrl.params.get('tarefasPrioridade') || 'Todas';
  const setPrioridadeFilter = (value: string) => listUrl.update({ tarefasPrioridade: value === 'Todas' ? null : value, tarefasPagina: null });
  const dataInicioFilter = listUrl.params.get('tarefasInicio') || '';
  const setDataInicioFilter = (value: string) => listUrl.update({ tarefasInicio: value === '' ? null : value, tarefasPagina: null });
  const dataFimFilter = listUrl.params.get('tarefasFim') || '';
  const setDataFimFilter = (value: string) => listUrl.update({ tarefasFim: value === '' ? null : value, tarefasPagina: null });
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoProjetoId, setNovoProjetoId] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState('Média');
  const [novaDataLimite, setNovaDataLimite] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tarefa | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestedPage = Number(listUrl.params.get('tarefasPagina') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const setPage = useCallback((value: number | ((current: number) => number)) => {
    const next = typeof value === 'function' ? value(page) : value;
    listUrl.update({ tarefasPagina: next <= 1 ? null : String(next) });
  }, [page, listUrl.update]);
  const [resolvedPage, setResolvedPage] = useState<number>();
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusTotals, setStatusTotals] = useState<TaskPage['statusTotals']>({ 'A Fazer': 0, 'Em Progresso': 0, 'Concluído': 0, outros: 0 });
  const focusedTaskId = new URLSearchParams(location.search).get(APP_QUERY_KEYS.task);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const taskListRequestRef = useRef(0);
  const statusRequestVersionRef = useRef(new Map<string, number>());
  const [initialTaskDraftKey, setInitialTaskDraftKey] = useState(
    taskDraftKey({ titulo: '', descricao: '', projetoId: '', prioridade: 'Média', dataLimite: '' })
  );
  const [editingDirectClient, setEditingDirectClient] = useState(false);

  const { resultsRef: taskResultsRef, preparePage, adjustPage } = useListPageNavigation({ page, resolvedPage, ready: !loadingTasks, failed: Boolean(tasksError), scope: [searchTerm, selectedProjeto, prioridadeFilter, dataInicioFilter, dataFimFilter].join('\u001f') });
  const changePage = (next: number) => { preparePage(next); setPage(next); };
  const fetchDados = useCallback(() => {
    const requestVersion = taskListRequestRef.current + 1;
    taskListRequestRef.current = requestVersion;
    if (!focusedTaskId && dataInicioFilter && dataFimFilter && dataInicioFilter > dataFimFilter) {
      setTasksError('O prazo inicial não pode ser posterior ao prazo final. Ajuste o intervalo para continuar.');
      setLoadingTasks(false);
      return;
    }
    const params = new URLSearchParams({ mode: 'page', page: String(page), limit: '100' });
    if (focusedTaskId) {
      params.set('id', focusedTaskId);
      params.set('page', '1');
    } else {
      if (debouncedSearchTerm) params.set('q', debouncedSearchTerm);
      if (selectedProjeto !== 'all') params.set('projetoId', selectedProjeto);
      if (prioridadeFilter !== 'Todas') params.set('prioridade', prioridadeFilter);
      if (dataInicioFilter) params.set('inicio', dataInicioFilter);
      if (dataFimFilter) params.set('fim', dataFimFilter);
    }
    setLoadingTasks(true);
    setTasksError('');
    loadTaskPage(`/api/tarefas?${params}`).then((result) => {
      if (taskListRequestRef.current !== requestVersion) return;
      if (!focusedTaskId && page > result.totalPages) {
        adjustPage(result.totalPages); setPage(result.totalPages);
        return;
      }
      setResolvedPage(result.page);
      setTarefas(result.items);
      setTotalTasks(result.total);
      setTotalPages(result.totalPages);
      setStatusTotals(result.statusTotals);
      if (focusedTaskId) {
        setResolvedTaskFocus({
          id: focusedTaskId,
          found: result.items.some((task) => task.id === focusedTaskId)
        });
      }
    }).catch((error: unknown) => {
      if (taskListRequestRef.current !== requestVersion) return;
      setTasksError(error instanceof Error ? error.message : 'Não foi possível carregar as tarefas.');
    }).finally(() => {
      if (taskListRequestRef.current === requestVersion) setLoadingTasks(false);
    });
  }, [dataFimFilter, dataInicioFilter, debouncedSearchTerm, focusedTaskId, page, prioridadeFilter, selectedProjeto, setPage]);

  useEffect(() => {
    if (!focusedTaskId) return;
    const resetTimer = window.setTimeout(() => {
      setSearchTerm('');
      setSelectedProjeto('all');
      setPrioridadeFilter('Todas');
      setDataInicioFilter('');
      setDataFimFilter('');
      setPage(1);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [focusedTaskId]);

  useEffect(() => {
    const fetchTimer = window.setTimeout(fetchDados, 0);
    return () => window.clearTimeout(fetchTimer);
  }, [fetchDados]);

  useEffect(() => () => {
    if (focusClearTimer.current !== null) window.clearTimeout(focusClearTimer.current);
  }, []);

  useEffect(() => {
    if (!focusedTaskId) {
      handledTaskIdRef.current = null;
      return;
    }
    if (resolvedTaskFocus?.id !== focusedTaskId || handledTaskIdRef.current === focusedTaskId) return;

    handledTaskIdRef.current = focusedTaskId;
    window.requestAnimationFrame(() => {
      if (!resolvedTaskFocus.found) {
        toast.info('A tarefa indicada pelo alerta não foi encontrada.');
        const next = new URLSearchParams(location.search);
        next.delete(APP_QUERY_KEYS.task);
        navigate({ pathname: location.pathname, search: next.size ? `?${next.toString()}` : '' }, { replace: true });
        return;
      }

      setHighlightedTaskId(focusedTaskId);
      const taskElement = document.querySelector<HTMLElement>(`[data-task-id="${focusedTaskId}"]`);
      taskElement?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
      taskElement?.focus({ preventScroll: true });
      if (focusClearTimer.current !== null) window.clearTimeout(focusClearTimer.current);
      focusClearTimer.current = window.setTimeout(() => {
        setHighlightedTaskId(null);
        const next = new URLSearchParams(location.search);
        next.delete(APP_QUERY_KEYS.task);
        navigate({ pathname: location.pathname, search: next.size ? `?${next.toString()}` : '' }, { replace: true });
      }, 2400);
    });
  }, [focusedTaskId, location.pathname, location.search, navigate, resolvedTaskFocus]);

  const currentTaskDraftKey = taskDraftKey({
    titulo: novoTitulo,
    descricao: novaDescricao,
    projetoId: novoProjetoId,
    prioridade: novaPrioridade,
    dataLimite: novaDataLimite
  });
  const taskDraftDirty = currentTaskDraftKey !== initialTaskDraftKey;

  useEffect(() => {
    if (!showAddForm || !taskDraftDirty) return undefined;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [showAddForm, taskDraftDirty]);

  const resetTaskForm = () => {
    setNovoTitulo('');
    setNovaDescricao('');
    setNovoProjetoId('');
    setNovaPrioridade('Média');
    setNovaDataLimite('');
    setFormError('');
    setEditingTaskId(null);
    setEditingDirectClient(false);
    setInitialTaskDraftKey(taskDraftKey({ titulo: '', descricao: '', projetoId: '', prioridade: 'Média', dataLimite: '' }));
  };

  const closeTaskForm = () => {
    if (taskDraftDirty && !window.confirm('Descartar as alterações desta tarefa?')) return;
    resetTaskForm();
    setShowAddForm(false);
  };

  const openTaskForm = () => {
    resetTaskForm();
    setShowAddForm(true);
  };

  const openEditTaskForm = (task: Tarefa) => {
    setEditingTaskId(task.id);
    setNovoTitulo(task.titulo);
    setNovaDescricao(task.descricao || '');
    setNovoProjetoId(task.projetoId || '');
    setNovaPrioridade(task.prioridade || 'Média');
    setNovaDataLimite(task.dataLimite || '');
    setFormError('');
    setEditingDirectClient(Boolean(task.clienteId && !task.projetoId));
    setInitialTaskDraftKey(taskDraftKey({
      titulo: task.titulo,
      descricao: task.descricao || '',
      projetoId: task.projetoId || '',
      prioridade: task.prioridade || 'Média',
      dataLimite: task.dataLimite || ''
    }));
    setShowAddForm(true);
  };

  const invalidateTaskIntegrations = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
    queryClient.invalidateQueries({ queryKey: ['stats-geral'] }),
    queryClient.invalidateQueries({ queryKey: ['tarefas'] }),
    queryClient.invalidateQueries({ queryKey: ['recent-audit-logs'] }),
  ]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const previousTask = tarefas.find((task) => task.id === id);
    if (!previousTask || previousTask.status === newStatus) return;
    const requestVersion = (statusRequestVersionRef.current.get(id) || 0) + 1;
    statusRequestVersionRef.current.set(id, requestVersion);
    setTarefas((current) => current.map((task) => task.id === id ? { ...task, status: newStatus } : task));
    try {
      const res = await apiFetch(`/api/tarefas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Não foi possível atualizar o status da tarefa.');
      if (statusRequestVersionRef.current.get(id) === requestVersion) await invalidateTaskIntegrations();
    } catch {
      if (statusRequestVersionRef.current.get(id) === requestVersion) {
        setTarefas((current) => current.map((task) => task.id === id ? previousTask : task));
        toast.error('Não foi possível atualizar o status da tarefa. A alteração foi desfeita.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!novoTitulo.trim()) {
      setFormError('Informe o título da tarefa.');
      window.requestAnimationFrame(() => document.getElementById('tarefa-titulo')?.focus());
      return;
    }
    if (!novoProjetoId) {
      setFormError('Selecione um projeto para a tarefa.');
      window.requestAnimationFrame(() => document.getElementById('tarefa-projeto')?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        projetoId: novoProjetoId,
        titulo: novoTitulo,
        descricao: novaDescricao,
        prioridade: novaPrioridade,
        dataLimite: novaDataLimite,
        ...(editingTaskId ? {} : { status: 'A Fazer' })
      };
      if (editingTaskId) await apiClient.patch(`/api/tarefas/${editingTaskId}`, payload);
      else await apiClient.post('/api/tarefas', payload);
      resetTaskForm();
      setShowAddForm(false);
      fetchDados();
      await invalidateTaskIntegrations();
      toast.success(editingTaskId ? 'Tarefa atualizada.' : 'Tarefa criada.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : `Não foi possível ${editingTaskId ? 'atualizar' : 'criar'} a tarefa.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(tarefas.find((tarefa) => tarefa.id === id) ?? null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/tarefas/${deleteTarget.id}`);
      setTarefas(prev => prev.filter(t => t.id !== deleteTarget.id));
      setTotalTasks((current) => Math.max(0, current - 1));
      setDeleteTarget(null);
      await invalidateTaskIntegrations();
      fetchDados();
      toast.success('Tarefa excluída.');
    } catch {
      toast.error('Não foi possível excluir a tarefa. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  // Drag and Drop implementation with @hello-pangea/dnd
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    void handleUpdateStatus(draggableId, destination.droppableId);
  };

  const filteredTarefas: BoardTask[] = tarefas.map((task) => ({
    ...task,
    ...(validTaskStatuses.has(task.status) ? {} : { originalStatus: task.status, status: 'A Fazer' }),
    ...(validTaskPriorities.has(task.prioridade) ? {} : { originalPriority: task.prioridade, prioridade: 'Média' })
  }));
  const hasTaskFilters = Boolean(searchTerm || selectedProjeto !== 'all' || prioridadeFilter !== 'Todas' || dataInicioFilter || dataFimFilter);

  const columns = [
    { id: 'A Fazer', title: 'A Fazer', color: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30' },
    { id: 'Em Progresso', title: 'Em Progresso', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30' },
    { id: 'Concluído', title: 'Concluído', color: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30' }
  ];

  return (
    <Layout>
      {planningBack ? <Link to={planningBack} className="geo-focus-ring mb-4 inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-brand-primary-700 hover:bg-brand-primary-50 dark:text-brand-primary-200 dark:hover:bg-brand-primary-400/10">Voltar ao planejamento</Link> : null}
      <PageHeader
        eyebrow="Fluxo operacional"
        title="Tarefas"
        description="Fluxo de trabalho operacional para projetos e levantamentos."
        action={(
          <button
            type="button"
            onClick={openTaskForm}
            className={cn(headerPrimaryActionButtonClass, 'w-full sm:w-auto')}
          >
            <span>Nova tarefa</span>
            <span aria-hidden="true" className={headerPrimaryActionIconClass}>
              <Plus className="h-3.5 w-3.5" weight="bold" />
            </span>
          </button>
        )}
        navigation={<ModuleNavigation module="agenda" className="mb-0" />}
      />

      <div className={cn('mb-6', filterBarClass)}>
        <div className="grid grid-cols-1 items-center gap-2.5 lg:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(160px,0.7fr))_auto_auto]">
          <div className="relative">
            <label htmlFor="task-search" className="sr-only">Buscar tarefas</label>
            <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="task-search"
              name="task-search"
              type="search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
              placeholder="Buscar por tarefa, projeto, cliente ou descrição…"
              className={filterSearchInputClass}
            />
          </div>
          <RemoteCombobox<ProjectOption>
            id="task-project-filter"
            name="projectFilter"
            endpoint="/api/projetos/options"
            value={selectedProjeto === 'all' ? '' : selectedProjeto}
            onChange={(value) => { setSelectedProjeto(value || 'all'); setPage(1); }}
            placeholder="Pesquisar projeto…"
            emptyLabel="Todos os projetos"
            className="min-w-0"
          />
          <CustomSelect
            value={prioridadeFilter}
            onChange={(value) => { setPrioridadeFilter(value); setPage(1); }}
            placeholder="Todas as prioridades"
            className="min-w-0"
              options={['Todas', 'Baixa', 'Média', 'Alta'].map((value) => ({ label: value === 'Todas' ? 'Todas as prioridades' : value, value }))}
          />
          <button
            type="button"
            aria-expanded={advancedFiltersOpen}
            aria-controls="task-advanced-filters"
            onClick={() => setAdvancedFiltersOpen((current) => !current)}
            className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-3 text-sm"
          >
            <Funnel aria-hidden="true" className="h-4 w-4" />
            Filtros
            {(dataInicioFilter || dataFimFilter) && <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-950">{[dataInicioFilter, dataFimFilter].filter(Boolean).length}</span>}
          </button>
          {hasTaskFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedProjeto('all');
                setPrioridadeFilter('Todas');
                setDataInicioFilter('');
                setDataFimFilter('');
                setPage(1);
              }}
              className={filterClearButtonClass}
            >
              Limpar
            </button>
          )}
        </div>
        {advancedFiltersOpen && (
          <div id="task-advanced-filters" className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <span>Prazo inicial</span>
              <DatePickerField
                name="task-deadline-start"
                value={dataInicioFilter}
                onChange={(event) => { setDataInicioFilter(event.target.value); setPage(1); }}
                className={cn(filterControlClass, 'w-full')}
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <span>Prazo final</span>
              <DatePickerField
                name="task-deadline-end"
                value={dataFimFilter}
                onChange={(event) => { setDataFimFilter(event.target.value); setPage(1); }}
                className={cn(filterControlClass, 'w-full')}
              />
            </label>
          </div>
        )}
        <p ref={taskResultsRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="geo-focus-ring scroll-mt-28 mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {filteredTarefas.length} {filteredTarefas.length === 1 ? 'tarefa exibida' : 'tarefas exibidas'} nesta página · {totalTasks} {totalTasks === 1 ? 'tarefa no conjunto filtrado' : 'tarefas no conjunto filtrado'} · Página {resolvedPage ?? page} de {totalPages} · Intervalo {tarefas.length ? ((resolvedPage ?? page) - 1) * 100 + 1 : 0}–{tarefas.length ? ((resolvedPage ?? page) - 1) * 100 + tarefas.length : 0}
        </p>
        {statusTotals.outros > 0 && (
          <p role="status" className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
            {statusTotals.outros} {statusTotals.outros === 1 ? 'tarefa possui' : 'tarefas possuem'} status legado. Para impedir perda silenciosa, {statusTotals.outros === 1 ? 'ela foi exibida' : 'elas foram exibidas'} em “A Fazer” com identificação própria.
          </p>
        )}
      </div>

      {/* Kanban Board Columns */}
      {tasksError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <span>{tarefas.length ? 'Não foi possível atualizar as tarefas. Os dados anteriores foram preservados.' : 'Não foi possível carregar as tarefas.'}</span>
          <button type="button" onClick={fetchDados} className="geo-button-base geo-focus-ring min-h-10 border border-current px-3 text-xs font-bold">Tentar novamente</button>
        </div>
      )}
      {loadingTasks && tarefas.length === 0 ? (
        <div role="status" aria-live="polite" className="rounded-2xl border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">Carregando tarefas…</div>
      ) : !tasksError && filteredTarefas.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700" aria-labelledby="tasks-first-use-title">
          <BookmarkSimple aria-hidden="true" className="mx-auto h-9 w-9 text-zinc-400" />
          <h2 id="tasks-first-use-title" className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">{hasTaskFilters ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa cadastrada'}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">{hasTaskFilters ? 'Revise a busca ou remova os filtros para voltar a visualizar o quadro.' : 'Crie a primeira atividade operacional e acompanhe sua evolução pelo quadro.'}</p>
          {!hasTaskFilters ? (
            <button type="button" onClick={openTaskForm} className={cn(primaryActionButtonClass, 'mx-auto mt-5')}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Nova tarefa
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedProjeto('all');
                setPrioridadeFilter('Todas');
                setDataInicioFilter('');
                setDataFimFilter('');
              }}
              className="geo-button-base geo-button-secondary geo-focus-ring mt-5 min-h-11 px-4 text-sm"
            >
              Limpar filtros
            </button>
          )}
        </section>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3" aria-busy={loadingTasks}>
          {columns.map(col => {
            const colTasks = filteredTarefas.filter(t => t.status === col.id);
            const columnHeadingId = `task-column-${col.id.replace(/\s+/g, '-').toLowerCase()}`;
            return (
              <section
                key={col.id} 
                aria-labelledby={columnHeadingId}
                className="flex min-h-[500px] flex-col rounded-2xl border border-zinc-200/80 bg-zinc-100/70 p-4 dark:border-zinc-700/60 dark:bg-zinc-800/60"
              >
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <h2 id={columnHeadingId} className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${col.color}`}>
                      {col.title}
                    </h2>
                    <span className="text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-300" aria-label={`${colTasks.length} ${colTasks.length === 1 ? 'tarefa nesta coluna' : 'tarefas nesta coluna'}`}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.droppableProps}
                      role="group"
                      aria-label={`Tarefas em ${col.title}`}
                      className={`flex-1 space-y-4 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-zinc-200/30 dark:bg-zinc-900/40' : ''}`}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <article
                              ref={provided.innerRef}
                              data-task-id={task.id}
                              tabIndex={-1}
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                              className={`group relative rounded-xl border border-zinc-200/70 bg-white p-4 transition-[border-color,box-shadow] dark:border-zinc-700/60 dark:bg-zinc-800/95 ${
                                snapshot.isDragging ? 'opacity-90 shadow-xl ring-2 ring-indigo-500/50' : 'hover:border-zinc-300 dark:hover:border-zinc-600'
                              } ${
                                highlightedTaskId === task.id
                                  ? 'ring-2 ring-blue-500 bg-blue-50/70 transition-[background-color,box-shadow] motion-reduce:transition-none dark:bg-blue-950/20'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <h3 className="font-semibold text-zinc-950 dark:text-white leading-tight pr-28">
                                  {task.titulo}
                                </h3>
                                <div className="absolute right-4 top-4 flex items-center gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    {...provided.dragHandleProps}
                                    className="geo-focus-ring cursor-grab rounded-lg bg-zinc-100 p-1.5 text-zinc-700 shadow-sm transition-[background-color,color,box-shadow] hover:bg-zinc-200 active:cursor-grabbing dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                    aria-label={`Mover tarefa: ${task.titulo}`}
                                    title="Mover tarefa"
                                  >
                                    <DotsSixVertical aria-hidden="true" className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateStatus(task.id, task.status === 'Concluído' ? 'A Fazer' : 'Concluído')}
                                    className="geo-focus-ring rounded-lg bg-emerald-50 p-1.5 text-emerald-700 shadow-sm transition-[background-color,color,box-shadow] hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    aria-label={`${task.status === 'Concluído' ? 'Reabrir' : 'Concluir'} tarefa: ${task.titulo}`}
                                    title={task.status === 'Concluído' ? 'Reabrir tarefa' : 'Concluir tarefa'}
                                  >
                                    {task.status === 'Concluído'
                                      ? <ArrowCounterClockwise aria-hidden="true" className="h-4 w-4" />
                                      : <CheckCircle aria-hidden="true" className="h-4 w-4" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditTaskForm(task)}
                                    className="geo-focus-ring rounded-lg bg-zinc-100 p-1.5 text-zinc-700 shadow-sm transition-[background-color,color,box-shadow] hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                    aria-label={`Editar tarefa: ${task.titulo}`}
                                    title="Editar tarefa"
                                  >
                                    <PencilSimple aria-hidden="true" className="h-4 w-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDelete(task.id)}
                                    className="geo-focus-ring rounded-lg bg-red-50 p-1.5 text-red-600 shadow-sm transition-[background-color,color,box-shadow] hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
                                    aria-label={`Excluir tarefa: ${task.titulo}`}
                                    title="Excluir tarefa"
                                  >
                                    <Trash aria-hidden="true" className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {task.descricao && (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">
                                  {task.descricao}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 mt-4">
                                {task.originalStatus && (
                                  <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
                                    Status legado: {task.originalStatus} · exibida em A Fazer
                                  </span>
                                )}
                                {task.originalPriority && (
                                  <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
                                    Prioridade legada: {task.originalPriority}
                                  </span>
                                )}
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  task.prioridade === 'Alta' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' :
                                  task.prioridade === 'Média' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                }`}>
                                  {task.prioridade}
                                </span>
                                
                                {task.dataLimite && (
                                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                    <Calendar aria-hidden="true" className="w-3 h-3" />
                                    {new Intl.DateTimeFormat('pt-BR').format((() => {
                                      const [year, month, day] = task.dataLimite!.slice(0, 10).split('-').map(Number);
                                      return new Date(year, month - 1, day);
                                    })())}
                                  </span>
                                )}
                                {task.dataLimite && task.status !== 'Concluído' && task.dataLimite.slice(0, 10) < localDateKey() && (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 dark:bg-red-500/15 dark:text-red-200">Atrasada</span>
                                )}

                                {(task.projetoNome || task.clienteNome) && (
                                  <span className="ml-auto flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                    <BookmarkSimple aria-hidden="true" className="w-3 h-3" />
                                    <span className="truncate max-w-[120px]">
                                      {task.projetoNome || task.clienteNome}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </article>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                          Solte tarefas aqui
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </section>
            );
          })}
        </div>
        </DragDropContext>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação de tarefas" className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <button type="button" disabled={page <= 1} onClick={() => changePage(Math.max(1, page - 1))} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
          <p className="text-sm font-medium text-zinc-600 tabular-nums dark:text-zinc-300">Página {page} de {totalPages}</p>
          <button type="button" disabled={page >= totalPages} onClick={() => changePage(Math.min(totalPages, page + 1))} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
        </nav>
      )}

      {/* Modal Nova Tarefa */}
      <Modal
        isOpen={showAddForm}
        onClose={closeTaskForm}
        title={editingTaskId ? 'Editar tarefa' : 'Nova tarefa'}
        initialFocusId="tarefa-titulo"
        closeDisabled={submitting}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormError message={formError} />
          {editingDirectClient && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              Esta tarefa está ligada diretamente ao cliente. Para editá-la nesta tela, selecione conscientemente um projeto; o vínculo passará a ser o cliente desse projeto.
            </p>
          )}
          <FormSection title="Planejamento da tarefa" description="Defina o que precisa ser feito, o projeto associado e a prioridade operacional.">
          <div>
            <label htmlFor="tarefa-titulo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Título da tarefa</label>
            <input 
              id="tarefa-titulo"
              name="titulo"
              type="text" 
              autoComplete="off"
              required 
              maxLength={180}
              value={novoTitulo} 
              onChange={e => setNovoTitulo(e.target.value)} 
              placeholder="Ex: Executar levantamento RTK" 
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label htmlFor="tarefa-projeto" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Projeto</label>
            <RemoteCombobox<ProjectOption>
              id="tarefa-projeto"
              name="projetoId"
              endpoint="/api/projetos/options"
              required
              value={novoProjetoId}
              onChange={setNovoProjetoId}
              placeholder="Pesquisar projeto…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tarefa-prioridade" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Prioridade</label>
              <FormSelect
                id="tarefa-prioridade"
                name="prioridade"
                value={novaPrioridade} 
                onChange={e => setNovaPrioridade(e.target.value)} 
                className="w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </FormSelect>
            </div>

            <div>
              <label htmlFor="tarefa-data-limite" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Data limite</label>
              <DatePickerField
                id="tarefa-data-limite"
                name="dataLimite"
                value={novaDataLimite} 
                onChange={e => setNovaDataLimite(e.target.value)} 
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tarefa-descricao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Descrição</label>
            <textarea 
              id="tarefa-descricao"
              name="descricao"
              value={novaDescricao} 
              onChange={e => setNovaDescricao(e.target.value)} 
              maxLength={2000}
              rows={3} 
              placeholder="Adicione detalhes…"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            ></textarea>
          </div>

          </FormSection>

          <FormFooter>
            <button 
              type="button" 
              onClick={closeTaskForm}
              disabled={submitting}
              className="px-6 py-3 rounded-full text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className={cn(primarySubmitButtonClass, 'px-6 py-3')}
            >
              {submitting ? 'Salvando…' : editingTaskId ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </FormFooter>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir tarefa${deleteTarget?.titulo ? ` “${deleteTarget.titulo}”` : ''}?`}
        description="A tarefa será removida do quadro e deixará de aparecer no projeto e nos demais contextos vinculados. O projeto será preservado. Esta ação não pode ser desfeita."
        confirmText="Excluir tarefa"
        loading={deleting}
      />
    </Layout>
  );
}
