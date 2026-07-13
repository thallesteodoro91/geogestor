import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { FormError, FormFooter, FormSection } from '../../components/Form';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Funnel, Trash, PencilSimple, CurrencyDollar, CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { apiFetch } from '../../services/apiClient';

const COLUMNS = ['Prospectado', 'Contato', 'Proposta', 'Ganho', 'Perdido'];

interface Cliente {
  id: string;
  nome: string;
}

interface Oportunidade {
  id: string;
  titulo: string;
  clienteId: string;
  clienteNome: string;
  valorEstimado?: number | null;
  estagio: string;
  ordem: number;
}

export function CRM() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedOp, setSelectedOp] = useState<Oportunidade | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchDados = () => {
    Promise.resolve().then(() => {
      setLoading(true);
    });
    Promise.all([
      apiFetch('/api/oportunidades').then(res => res.json()),
      apiFetch('/api/clientes').then(res => res.json())
    ]).then(([ops, clis]) => {
      // Sort by ordem
      const sortedOps = ops.sort((a: Oportunidade, b: Oportunidade) => a.ordem - b.ordem);
      setOportunidades(sortedOps);
      setClientes(clis);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Optimistic UI Update
    const newOportunidades = Array.from(oportunidades);
    const draggedItem = newOportunidades.find(op => op.id === draggableId);
    
    if (!draggedItem) return;

    // Remove from old array
    const sourceItems = newOportunidades.filter(op => op.estagio === source.droppableId);
    const destItems = source.droppableId === destination.droppableId 
      ? sourceItems 
      : newOportunidades.filter(op => op.estagio === destination.droppableId);

    // Reorder locally
    const [removed] = sourceItems.splice(source.index, 1);
    
    removed.estagio = destination.droppableId;
    destItems.splice(destination.index, 0, removed);

    // Assign new ordens
    const updates: { id: string, estagio: string, ordem: number }[] = [];
    
    // We only need to update the affected columns
    const allAffected = source.droppableId === destination.droppableId 
      ? [...sourceItems] 
      : [...sourceItems, ...destItems];

    allAffected.forEach((item) => {
      const itemEstagio = item.estagio;
      // Filter just to get index in the column
      const colItems = allAffected.filter(i => i.estagio === itemEstagio);
      const newOrdem = colItems.indexOf(item);
      item.ordem = newOrdem;
      updates.push({ id: item.id, estagio: item.estagio, ordem: newOrdem });
    });

    // Replace in main array
    const finalArray = newOportunidades.map(op => {
      const updated = updates.find(u => u.id === op.id);
      if (updated) {
        return { ...op, estagio: updated.estagio, ordem: updated.ordem };
      }
      return op;
    });

    // CRITICAL FIX: Sort the array locally by ordem so the visual order updates immediately
    finalArray.sort((a, b) => a.ordem - b.ordem);

    setOportunidades(finalArray);

    // Persist to backend
    try {
      await apiFetch('/api/oportunidades/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch {
      alert('Erro ao salvar nova ordem');
      fetchDados(); // rollback
    }
  };

  const handleMoveEstagio = async (opId: string, direction: 'left' | 'right') => {
    const item = oportunidades.find(o => o.id === opId);
    if (!item) return;
    const currentIndex = COLUMNS.indexOf(item.estagio);
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= COLUMNS.length) return;
    const targetEstagio = COLUMNS[targetIndex];

    const otherItemsInTarget = oportunidades.filter(o => o.estagio === targetEstagio);
    const newOrdem = otherItemsInTarget.length;

    const updates = [{ id: opId, estagio: targetEstagio, ordem: newOrdem }];

    setOportunidades(prev => {
      const newArray = prev.map(o => o.id === opId ? { ...o, estagio: targetEstagio, ordem: newOrdem } : o);
      newArray.sort((a, b) => a.ordem - b.ordem);
      return newArray;
    });

    try {
      await apiFetch('/api/oportunidades/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch {
      alert('Erro ao salvar novo estágio');
      fetchDados(); // rollback
    }
  };

  const openCreate = () => {
    setSelectedOp(null);
    setClienteId(clientes.length > 0 ? clientes[0].id : '');
    setTitulo('');
    setValorEstimado('');
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (op: Oportunidade) => {
    setSelectedOp(op);
    setClienteId(op.clienteId);
    setTitulo(op.titulo);
    setValorEstimado(op.valorEstimado ? (op.valorEstimado / 100).toString() : '');
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta oportunidade?')) return;
    const res = await apiFetch(`/api/oportunidades/${id}`, { method: 'DELETE' });
    if (res.ok) fetchDados();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!clienteId) {
      setFormError('Selecione um cliente para vincular a oportunidade.');
      return;
    }
    if (!titulo.trim()) {
      setFormError('Informe o título do negócio.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      clienteId,
      titulo,
      valorEstimado: valorEstimado ? Math.round(parseFloat(valorEstimado) * 100) : null
    };

    const url = selectedOp ? `/api/oportunidades/${selectedOp.id}` : '/api/oportunidades';
    const method = selectedOp ? 'PATCH' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Não foi possível salvar a oportunidade.');
      }
      setShowModal(false);
      fetchDados();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar a oportunidade.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null || cents === undefined) return 'Valor não definido';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getColColor = (col: string) => {
    switch (col) {
      case 'Prospectado': return 'border-t-blue-500';
      case 'Contato': return 'border-t-amber-500';
      case 'Proposta': return 'border-t-purple-500';
      case 'Ganho': return 'border-t-emerald-500';
      case 'Perdido': return 'border-t-red-500';
      default: return 'border-t-zinc-300';
    }
  };

  const filteredOportunidades = oportunidades.filter((op) => {
    const searchable = [op.titulo, op.clienteNome, op.estagio].filter(Boolean).join(' ');
    return matchesSearch(searchable, searchTerm);
  });

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            CRM Vendas
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white flex items-center gap-4">
            <Funnel weight="duotone" className="w-12 h-12 text-indigo-500" />
            Funil de Vendas
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Gerencie suas oportunidades de negócio arrastando entre as colunas.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-2xl px-6 py-3 flex flex-col items-end shadow-sm">
            <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Total em Negociação</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {formatCurrency(oportunidades.reduce((acc, curr) => acc + (curr.valorEstimado || 0), 0))}
            </span>
          </div>
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-2xl px-6 py-3 flex flex-col items-end shadow-sm">
            <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Valor Ganho</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(oportunidades.filter(op => op.estagio === 'Ganho').reduce((acc, curr) => acc + (curr.valorEstimado || 0), 0))}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={openCreate}
            className={primaryActionButtonClass}
          >
            <span>Nova Oportunidade</span>
            <div className={primaryActionIconClass}>
              <Plus weight="bold" className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-[1.5rem] border border-zinc-200/70 bg-white/85 py-3 px-5 shadow-sm ring-1 ring-zinc-950/[0.03] backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por oportunidade ou cliente..."
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-xs font-semibold text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-400 shadow-sm"
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="h-9 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white shadow-sm"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-8 hide-scrollbar">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 min-w-max items-start">
              {COLUMNS.map(coluna => {
                const colItems = filteredOportunidades.filter(op => op.estagio === coluna).sort((a,b) => a.ordem - b.ordem);
                const colTotal = colItems.reduce((acc, curr) => acc + (curr.valorEstimado || 0), 0);

                return (
                  <div key={coluna} className="w-[320px] flex-shrink-0 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50 rounded-3xl p-4 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
                    <div className={`mb-4 flex items-center justify-between border-t-4 pt-3 ${getColColor(coluna)}`}>
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-200 tracking-tight uppercase text-sm">{coluna}</h3>
                      <span className="bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold px-2 py-1 rounded-full shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10">
                        {colItems.length}
                      </span>
                    </div>
                    
                    {colTotal > 0 && (
                      <div className="mb-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl ring-1 ring-zinc-900/5 dark:ring-white/10 text-center">
                        {formatCurrency(colTotal)}
                      </div>
                    )}

                    <Droppable droppableId={coluna}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef} 
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[500px] transition-colors rounded-2xl p-1 ${snapshot.isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                        >
                          {colItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`group mb-3 bg-white dark:bg-zinc-950 p-5 rounded-2xl ring-1 ring-zinc-900/5 dark:ring-white/10 transition-all
                                    ${snapshot.isDragging ? 'shadow-2xl shadow-indigo-500/20 ring-indigo-500/50 rotate-2' : 'shadow-sm hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20 hover:-translate-y-1'}`}
                                  style={{...provided.draggableProps.style}}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                      {item.clienteNome.split(' ')[0]}
                                    </span>
                                    <div className="flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity gap-1">
                                      {coluna !== 'Prospectado' && (
                                        <button
                                          type="button"
                                          onClick={() => handleMoveEstagio(item.id, 'left')}
                                          className="p-1 text-zinc-400 hover:text-indigo-600 transition-colors"
                                          aria-label="Mover estágio para a esquerda"
                                        >
                                          <CaretLeft weight="bold" />
                                        </button>
                                      )}
                                      {coluna !== 'Perdido' && (
                                        <button
                                          type="button"
                                          onClick={() => handleMoveEstagio(item.id, 'right')}
                                          className="p-1 text-zinc-400 hover:text-indigo-600 transition-colors"
                                          aria-label="Mover estágio para a direita"
                                        >
                                          <CaretRight weight="bold" />
                                        </button>
                                      )}
                                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition-all shadow-sm" aria-label="Editar negócio" title="Editar"><PencilSimple weight="bold" /></button>
                                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all shadow-sm" aria-label="Excluir negócio" title="Excluir"><Trash weight="bold" /></button>
                                    </div>
                                  </div>
                                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-3">
                                    {item.titulo}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    <CurrencyDollar className="w-4 h-4 text-zinc-400" />
                                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                      {item.valorEstimado ? formatCurrency(item.valorEstimado) : 'A definir'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedOp ? 'Editar Oportunidade' : 'Nova Oportunidade'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormError message={formError} />
          <FormSection title="Dados da oportunidade" description="Registre o negócio no funil e estime o potencial comercial.">
          <div>
            <label htmlFor="crm-cliente" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Cliente / Lead</label>
            <select id="crm-cliente" required value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none">
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="crm-titulo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Título do Negócio</label>
            <input id="crm-titulo" type="text" required value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Loteamento Silva, Desmembramento Faz. Boa Vista" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium" />
          </div>
          <div>
            <label htmlFor="crm-valor" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Valor Estimado (Opcional)</label>
            <input id="crm-valor" type="number" step="0.01" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} placeholder="R$ 0,00" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-bold text-lg text-emerald-700 dark:text-emerald-400" />
          </div>
          </FormSection>

          <FormFooter>
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-full text-zinc-500 dark:text-zinc-400 font-semibold hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className={cn(primarySubmitButtonClass, 'px-6 py-3')}>
              {isSubmitting ? 'Salvando...' : 'Salvar Oportunidade'}
            </button>
          </FormFooter>
        </form>
      </Modal>
    </Layout>
  );
}
