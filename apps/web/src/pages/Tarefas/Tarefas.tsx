import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { FormError, FormFooter, FormSection } from '../../components/Form';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Trash, BookmarkSimple, Calendar, MagnifyingGlass } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import {
  filterBarClass,
  filterClearButtonClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';
import type { Tarefa, Projeto } from '@geogestor/contracts';
import { apiFetch } from '../../services/apiClient';
export function Tarefas() {
  const location = useLocation();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjeto, setSelectedProjeto] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('Todas');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoProjetoId, setNovoProjetoId] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState('Média');
  const [novaDataLimite, setNovaDataLimite] = useState('');
  const [formError, setFormError] = useState('');
  const focusedTaskId = new URLSearchParams(location.search).get('tarefaId');

  const fetchDados = () => {
    Promise.all([
      apiFetch('/api/tarefas').then(res => res.json()),
      apiFetch('/api/projetos').then(res => res.json())
    ]).then(([tarefasData, projetosData]) => {
      setTarefas(tarefasData);
      setProjetos(projetosData);
      if (projetosData.length > 0) {
        setNovoProjetoId(projetosData[0].id);
      }
    });
  };

  useEffect(() => {
    fetchDados();
  }, []);

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
      alert('Erro ao atualizar status da tarefa');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!novoTitulo.trim()) {
      setFormError('Informe o título da tarefa.');
      return;
    }
    if (!novoProjetoId) {
      setFormError('Selecione um projeto para a tarefa.');
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
      setNovoTitulo('');
      setNovaDescricao('');
      setNovaDataLimite('');
      setFormError('');
      setShowAddForm(false);
      fetchDados();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a tarefa.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta tarefa?')) return;
    try {
      const res = await apiFetch(`/api/tarefas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTarefas(prev => prev.filter(t => t.id !== id));
      }
    } catch {
      alert('Erro ao deletar tarefa');
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

  const filteredTarefas = tarefas.filter((task) => {
    const searchable = [
      task.titulo,
      task.descricao,
      task.status,
      task.prioridade,
      task.projetoNome,
      task.clienteNome
    ].filter(Boolean).join(' ');
    const matchesProject = selectedProjeto === 'all' || task.projetoId === selectedProjeto;
    const matchesSearchTerm = matchesSearch(searchable, searchTerm);
    const matchesPrioridade = prioridadeFilter === 'Todas' || task.prioridade === prioridadeFilter;
    const matchesStart = !dataInicioFilter || (task.dataLimite && task.dataLimite >= dataInicioFilter);
    const matchesEnd = !dataFimFilter || (task.dataLimite && task.dataLimite <= dataFimFilter);
    return matchesProject && matchesSearchTerm && matchesPrioridade && matchesStart && matchesEnd;
  });
  const hasTaskFilters = Boolean(searchTerm || selectedProjeto !== 'all' || prioridadeFilter !== 'Todas' || dataInicioFilter || dataFimFilter);

  const columns = [
    { id: 'A Fazer', title: 'A Fazer', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' },
    { id: 'Em Progresso', title: 'Em Progresso', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30' },
    { id: 'Concluído', title: 'Concluído', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' }
  ];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            Gestão de Serviços
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Quadro Kanban
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Fluxo de trabalho operacional para projetos e levantamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => {
              setFormError('');
              setShowAddForm(true);
            }}
            className={primaryActionButtonClass}
          >
            <span>Nova Tarefa</span>
            <div className={primaryActionIconClass}>
              <Plus className="w-4 h-4" weight="bold" />
            </div>
          </button>
        </div>
      </div>

      <div className={cn('mb-6', filterBarClass)}>
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(140px,0.7fr))_auto] items-center">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por tarefa, projeto, cliente ou descrição..."
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={selectedProjeto} 
            onChange={setSelectedProjeto}
            placeholder="Todos os projetos"
            className="min-w-0"
            options={[{ label: 'Todos os projetos', value: 'all' }, ...projetos.map((projeto) => ({ label: projeto.nome, value: projeto.id }))]}
          />
          <CustomSelect
            value={prioridadeFilter}
            onChange={setPrioridadeFilter}
            placeholder="Todas as prioridades"
            className="min-w-0"
            options={['Todas', 'Baixa', 'Média', 'Alta'].map((value) => ({ label: value === 'Todas' ? 'Todas as prioridades' : value, value }))}
          />
          <input
            type="date"
            value={dataInicioFilter}
            onChange={(event) => setDataInicioFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Prazo inicial"
          />
          <input
            type="date"
            value={dataFimFilter}
            onChange={(event) => setDataFimFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Prazo final"
          />
          {hasTaskFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedProjeto('all');
                setPrioridadeFilter('Todas');
                setDataInicioFilter('');
                setDataFimFilter('');
              }}
              className={filterClearButtonClass}
            >
              Limpar
            </button>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {filteredTarefas.length} de {tarefas.length} tarefa(s) exibidas
        </p>
      </div>

      {/* Kanban Board Columns */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {columns.map(col => {
            const colTasks = filteredTarefas.filter(t => t.status === col.id);
            return (
              <div 
                key={col.id} 
                className="bg-zinc-100/70 dark:bg-zinc-800/60 rounded-[2.5rem] p-6 min-h-[500px] flex flex-col border border-zinc-200/80 dark:border-zinc-700/60 shadow-sm"
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
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={provided.draggableProps.style}
                              className={`bg-white dark:bg-zinc-800/95 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm transition-shadow group relative ${
                                snapshot.isDragging ? 'shadow-xl ring-2 ring-indigo-500/50 opacity-90' : 'hover:shadow-md'
                              } ${
                                focusedTaskId === task.id
                                  ? 'ring-2 ring-blue-500 bg-blue-50/70 dark:bg-blue-950/20'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <h4 className="font-semibold text-zinc-950 dark:text-white leading-tight pr-16">
                                  {task.titulo}
                                </h4>
                                <div className="flex items-center gap-1.5 absolute top-6 right-6 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    type="button"
                                    onClick={() => handleDelete(task.id)}
                                    className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all shadow-sm"
                                    aria-label="Excluir tarefa"
                                    title="Excluir tarefa"
                                  >
                                    <Trash className="w-4 h-4" />
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

      {/* Modal Nova Tarefa */}
      <Modal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="Nova Tarefa"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <FormError message={formError} />
          <FormSection title="Planejamento da tarefa" description="Defina o que precisa ser feito, o projeto associado e a prioridade operacional.">
          <div>
            <label htmlFor="tarefa-titulo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Título da Tarefa</label>
            <input 
              id="tarefa-titulo"
              type="text" 
              required 
              value={novoTitulo} 
              onChange={e => setNovoTitulo(e.target.value)} 
              placeholder="Ex: Executar levantamento RTK" 
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow" 
            />
          </div>

          <div>
            <label htmlFor="tarefa-projeto" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Projeto</label>
            <select 
              id="tarefa-projeto"
              required 
              value={novoProjetoId} 
              onChange={e => setNovoProjetoId(e.target.value)} 
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow appearance-none"
            >
              {projetos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tarefa-prioridade" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Prioridade</label>
              <select 
                id="tarefa-prioridade"
                value={novaPrioridade} 
                onChange={e => setNovaPrioridade(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow appearance-none"
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>

            <div>
              <label htmlFor="tarefa-data-limite" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Data Limite</label>
              <input 
                id="tarefa-data-limite"
                type="date" 
                value={novaDataLimite} 
                onChange={e => setNovaDataLimite(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow" 
              />
            </div>
          </div>

          <div>
            <label htmlFor="tarefa-descricao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Descrição</label>
            <textarea 
              id="tarefa-descricao"
              value={novaDescricao} 
              onChange={e => setNovaDescricao(e.target.value)} 
              rows={3} 
              placeholder="Adicione detalhes..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow resize-none"
            ></textarea>
          </div>

          </FormSection>

          <FormFooter>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
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
    </Layout>
  );
}
