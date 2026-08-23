import { toast } from 'sonner';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import { DatePickerField, FormError, FormFooter, FormSection, FormSelect } from '../../components/Form';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Trash, BookmarkSimple, Calendar, Funnel, MagnifyingGlass } from '@phosphor-icons/react';
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

type TaskPage = { items: Tarefa[]; page: number; limit: number; total: number; totalPages: number };
type ProjectOption = { id: string; nome: string; clienteNome?: string | null };
export function Tarefas() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [resolvedTaskFocus, setResolvedTaskFocus] = useState<{ id: string; found: boolean } | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const handledTaskIdRef = useRef<string | null>(null);
  const focusClearTimer = useRef<number | null>(null);
  const [selectedProjeto, setSelectedProjeto] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('Todas');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoProjetoId, setNovoProjetoId] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState('Média');
  const [novaDataLimite, setNovaDataLimite] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tarefa | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const focusedTaskId = new URLSearchParams(location.search).get(APP_QUERY_KEYS.task);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchDados = useCallback(() => {
    const params = new URLSearchParams({ mode: 'page', page: String(page), limit: '100' });
    if (focusedTaskId && !debouncedSearchTerm) params.set('id', focusedTaskId);
    if (debouncedSearchTerm) params.set('q', debouncedSearchTerm);
    if (selectedProjeto !== 'all') params.set('projetoId', selectedProjeto);
    if (prioridadeFilter !== 'Todas') params.set('prioridade', prioridadeFilter);
    if (dataInicioFilter) params.set('inicio', dataInicioFilter);
    if (dataFimFilter) params.set('fim', dataFimFilter);
    apiClient.get<TaskPage>(`/api/tarefas?${params}`).then((result) => {
      setTarefas(result.items);
      setTotalTasks(result.total);
      setTotalPages(result.totalPages);
      if (focusedTaskId) {
        setResolvedTaskFocus({
          id: focusedTaskId,
          found: result.items.some((task) => task.id === focusedTaskId)
        });
      }
    });
  }, [dataFimFilter, dataInicioFilter, debouncedSearchTerm, focusedTaskId, page, prioridadeFilter, selectedProjeto]);

  useEffect(() => {
    fetchDados();
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
      const next = new URLSearchParams(location.search);
      next.delete(APP_QUERY_KEYS.task);
      navigate({
        pathname: location.pathname,
        search: next.size ? `?${next.toString()}` : ''
      }, { replace: true });

      if (!resolvedTaskFocus.found) {
        toast.info('A tarefa indicada pelo alerta não foi encontrada.');
        return;
      }

      setHighlightedTaskId(focusedTaskId);
      document.querySelector(`[data-task-id="${focusedTaskId}"]`)?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
      if (focusClearTimer.current !== null) window.clearTimeout(focusClearTimer.current);
      focusClearTimer.current = window.setTimeout(() => setHighlightedTaskId(null), 2400);
    });
  }, [focusedTaskId, location.pathname, location.search, navigate, resolvedTaskFocus]);

  const taskDraftDirty = Boolean(
    novoTitulo.trim()
    || novaDescricao.trim()
    || novoProjetoId
    || novaDataLimite
    || novaPrioridade !== 'Média'
  );

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
  };

  const closeTaskForm = () => {
    if (taskDraftDirty && !window.confirm('Descartar as alterações desta tarefa?')) return;
    resetTaskForm();
    setShowAddForm(false);
  };

  const openTaskForm = () => {
    setFormError('');
    setShowAddForm(true);
  };

  useEffect(() => {
    if (!focusedTaskId || tarefas.length === 0) return;
    const tarefa = tarefas.find((item) => item.id === focusedTaskId);
    if (!tarefa) return;
    setTimeout(() => {
      setSearchTerm(tarefa.titulo);
      setSelectedProjeto('all');
    }, 0);
  }, [focusedTaskId, tarefas]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/tarefas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }
    } catch {
      toast.error('Erro ao atualizar status da tarefa');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
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

    try {
      const res = await apiFetch('/api/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetoId: novoProjetoId,
          titulo: novoTitulo,
          descricao: novaDescricao,
          prioridade: novaPrioridade,
          dataLimite: novaDataLimite,
          status: 'A Fazer'
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Não foi possível criar a tarefa.');
      }
      resetTaskForm();
      setShowAddForm(false);
      fetchDados();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a tarefa.');
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(tarefas.find((tarefa) => tarefa.id === id) ?? null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/tarefas/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTarefas(prev => prev.filter(t => t.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        throw new Error('Não foi possível excluir a tarefa.');
      }
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

    // Optimistic UI Update
    const newTarefas = Array.from(tarefas);
    const taskIndex = newTarefas.findIndex(t => t.id === draggableId);
    
    if (taskIndex === -1) return;
    
    // Change status locally
    const originalStatus = newTarefas[taskIndex].status;
    newTarefas[taskIndex].status = destination.droppableId;
    
    setTarefas(newTarefas);

    if (originalStatus !== destination.droppableId) {
      handleUpdateStatus(draggableId, destination.droppableId);
    }
  };

  const filteredTarefas = tarefas;
  const hasTaskFilters = Boolean(searchTerm || selectedProjeto !== 'all' || prioridadeFilter !== 'Todas' || dataInicioFilter || dataFimFilter);

  const columns = [
    { id: 'A Fazer', title: 'A Fazer', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' },
    { id: 'Em Progresso', title: 'Em Progresso', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30' },
    { id: 'Concluído', title: 'Concluído', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' }
  ];

  return (
    <Layout>
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
            <span>Nova Tarefa</span>
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
        <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {filteredTarefas.length} de {totalTasks} tarefa(s) exibidas
        </p>
      </div>

      {/* Kanban Board Columns */}
      {filteredTarefas.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700" aria-labelledby="tasks-first-use-title">
          <BookmarkSimple aria-hidden="true" className="mx-auto h-9 w-9 text-zinc-400" />
          <h2 id="tasks-first-use-title" className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">{tarefas.length === 0 ? 'Nenhuma tarefa cadastrada' : 'Nenhuma tarefa encontrada'}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">{tarefas.length === 0 ? 'Crie a primeira atividade operacional e acompanhe sua evolução pelo quadro.' : 'Revise a busca ou remova os filtros para voltar a visualizar o quadro.'}</p>
          {tarefas.length === 0 ? (
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {columns.map(col => {
            const colTasks = filteredTarefas.filter(t => t.status === col.id);
            return (
              <div 
                key={col.id} 
                className="flex min-h-[500px] flex-col rounded-2xl border border-zinc-200/80 bg-zinc-100/70 p-4 dark:border-zinc-700/60 dark:bg-zinc-800/60"
              >
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="text-sm font-medium text-zinc-400">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.droppableProps}
                      className={`flex-1 space-y-4 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-zinc-200/30 dark:bg-zinc-900/40' : ''}`}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              data-task-id={task.id}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
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
                                <h4 className="font-semibold text-zinc-950 dark:text-white leading-tight pr-16">
                                  {task.titulo}
                                </h4>
                                <div className="absolute right-4 top-4 flex items-center gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                                  <button 
                                    type="button"
                                    onClick={() => handleDelete(task.id)}
                                    className="rounded-lg bg-red-50 p-1.5 text-red-600 shadow-sm transition-[background-color,color,box-shadow] hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
                                    aria-label="Excluir tarefa"
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
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  task.prioridade === 'Alta' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' :
                                  task.prioridade === 'Média' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                }`}>
                                  {task.prioridade}
                                </span>
                                
                                {task.dataLimite && (
                                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(task.dataLimite).toLocaleDateString()}
                                  </span>
                                )}

                                {(task.projetoNome || task.clienteNome) && (
                                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-auto">
                                    <BookmarkSimple className="w-3 h-3" />
                                    <span className="truncate max-w-[120px]">
                                      {task.projetoNome || task.clienteNome}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="h-40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 text-sm">
                          Solte tarefas aqui
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
        </DragDropContext>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação de tarefas" className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
          <p className="text-sm font-medium text-zinc-600 tabular-nums dark:text-zinc-300">Página {page} de {totalPages}</p>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
        </nav>
      )}

      {/* Modal Nova Tarefa */}
      <Modal
        isOpen={showAddForm}
        onClose={closeTaskForm}
        title="Nova Tarefa"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <FormError message={formError} />
          <FormSection title="Planejamento da tarefa" description="Defina o que precisa ser feito, o projeto associado e a prioridade operacional.">
          <div>
            <label htmlFor="tarefa-titulo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Título da Tarefa</label>
            <input 
              id="tarefa-titulo"
              name="titulo"
              type="text" 
              autoComplete="off"
              required 
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
              <label htmlFor="tarefa-data-limite" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Data Limite</label>
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
              className="px-6 py-3 rounded-full text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={cn(primarySubmitButtonClass, 'px-6 py-3')}
            >
              Criar Tarefa
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
