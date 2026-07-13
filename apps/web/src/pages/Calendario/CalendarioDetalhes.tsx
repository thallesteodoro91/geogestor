import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { motion } from 'framer-motion';
import { apiFetch } from '../../services/apiClient';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Briefcase, 
  Clock, 
  Trash, 
  CheckSquare
} from '@phosphor-icons/react';

const getGoogleCalendarUrl = (titulo: string, dataStr: string, descricao?: string) => {
  const dateParts = dataStr?.split('-');
  if (dateParts && dateParts.length === 3) {
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
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo || '')}&details=${encodeURIComponent(descricao || '')}`;
};

export function CalendarioDetalhes() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Mutation to delete the commitment (if it is a commitment)
  const deleteCompromissoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/compromissos/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao excluir compromisso');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compromissos'] });
      navigate('/calendario');
    },
    onError: () => {
      alert('Erro ao excluir compromisso.');
    }
  });

  // Query details depending on the event type
  const { data: detalhes, isLoading, error } = useQuery({
    queryKey: ['calendario-detalhe', tipo, id],
    queryFn: async () => {
      if (tipo === 'projeto') {
        const res = await apiFetch(`/api/projetos/${id}`);
        if (!res.ok) throw new Error('Projeto não encontrado');
        const proj = await res.json();
        return {
          tipo: 'projeto',
          titulo: proj.nome,
          descricao: proj.descricao,
          data: proj.dataEntrega || proj.dataInicio,
          dataInicio: proj.dataInicio,
          dataEntrega: proj.dataEntrega,
          status: proj.status,
          clienteNome: proj.clienteNome,
          clienteId: proj.clienteId,
          areaHa: proj.areaHa,
          cidade: proj.cidade,
          id: proj.id
        };
      } else if (tipo === 'tarefa') {
        const res = await apiFetch('/api/tarefas');
        if (!res.ok) throw new Error('Erro ao carregar tarefas');
        const list = await res.json() as Array<{
          id: string;
          titulo: string;
          descricao?: string;
          dataLimite?: string;
          status?: string;
          prioridade?: string;
          clienteNome?: string;
          clienteId?: string;
          projetoNome?: string;
          projetoId?: string;
        }>;
        const t = list.find((item) => item.id === id);
        if (!t) throw new Error('Tarefa não encontrada');
        return {
          tipo: 'tarefa',
          titulo: t.titulo,
          descricao: t.descricao,
          data: t.dataLimite,
          status: t.status,
          prioridade: t.prioridade,
          clienteNome: t.clienteNome,
          clienteId: t.clienteId,
          projetoNome: t.projetoNome,
          projetoId: t.projetoId,
          id: t.id
        };
      } else {
        // Default to compromisso
        const res = await apiFetch(`/api/compromissos/${id}`);
        if (!res.ok) throw new Error('Compromisso não encontrado');
        const comp = await res.json();
        return {
          tipo: 'compromisso',
          titulo: comp.titulo,
          descricao: comp.descricao,
          data: comp.data,
          tipoCompromisso: comp.tipo, // Visita de Campo, Reunião, etc
          projetoNome: comp.projetoNome,
          projetoId: comp.projetoId,
          clienteNome: comp.clienteNome,
          clienteId: comp.clienteId,
          id: comp.id
        };
      }
    },
    enabled: !!tipo && !!id
  });

  const handleDelete = () => {
    if (!confirm('Deseja realmente excluir este compromisso permanentemente?')) return;
    deleteCompromissoMutation.mutate();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !detalhes) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Compromisso não encontrado</h2>
          <button onClick={() => navigate('/calendario')} className="px-4 py-2 bg-zinc-950 text-white rounded-xl">
            Voltar para o calendário
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Top Bar with back button */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/calendario')}
          className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-950 transition-colors"
        >
          <ArrowLeft weight="bold" className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link to="/calendario" className="hover:text-zinc-900 dark:text-zinc-100 transition-colors">Calendário</Link>
          <span className="mx-2 text-zinc-300">/</span>
          <span className="text-zinc-950 dark:text-white">Detalhes do Evento</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-semibold bg-zinc-100 text-zinc-600 mb-3">
            {detalhes.tipo === 'projeto' ? 'Prazo de Projeto' : detalhes.tipo === 'tarefa' ? 'Limite de Tarefa' : detalhes.tipoCompromisso}
          </span>
          <h1 className="text-4xl font-semibold tracking-tighter text-zinc-950 dark:text-white">{detalhes.titulo}</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium">Visualização expandida do compromisso agendado no calendário.</p>
        </div>

        <div className="flex items-center gap-3">
          {detalhes.data && (
            <a
              href={getGoogleCalendarUrl(detalhes.titulo, detalhes.data, detalhes.descricao)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-zinc-900 dark:text-zinc-100 rounded-full px-5 py-3 font-semibold text-sm transition-all shadow-sm"
            >
              <svg className="w-4 h-4 text-indigo-600 fill-current" viewBox="0 0 24 24">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
              </svg>
              <span>Sincronizar Google Calendar</span>
            </a>
          )}
          {detalhes.tipo === 'compromisso' && (
            <button 
              onClick={handleDelete}
              disabled={deleteCompromissoMutation.isPending}
              className="flex items-center gap-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-full px-5 py-3 font-semibold text-sm transition-all"
            >
              <Trash weight="bold" className="w-4 h-4" />
              <span>Excluir Compromisso</span>
            </button>
          )}
        </div>
      </div>

      {/* Event Details Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">Descrição</h3>
              <p className="text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed text-base">
                {detalhes.descricao || 'Sem descrição detalhada cadastrada para este evento.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Data do Evento
                </h3>
                <p className="text-lg font-bold text-zinc-950 dark:text-white">
                  {detalhes.data ? new Date(detalhes.data).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>

              {detalhes.tipo === 'projeto' && (
                <div>
                  <h3 className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Período do Projeto
                  </h3>
                  <p className="text-sm font-semibold text-zinc-700">
                    Início: {detalhes.dataInicio ? new Date(detalhes.dataInicio).toLocaleDateString('pt-BR') : '-'}
                  </p>
                  <p className="text-sm font-semibold text-zinc-700">
                    Entrega: {detalhes.dataEntrega ? new Date(detalhes.dataEntrega).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
              )}
              
              {detalhes.tipo === 'tarefa' && (
                <div>
                  <h3 className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" /> Status & Prioridade
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      detalhes.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {detalhes.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      detalhes.prioridade === 'Alta' ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {detalhes.prioridade}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar context card */}
        <div className="space-y-6">
          {/* Related Parent Context (Project / Client) */}
          <div className="bg-zinc-950 text-white rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contexto Relacionado</h3>
            
            {detalhes.projetoId || detalhes.tipo === 'projeto' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Projeto</p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {detalhes.tipo === 'projeto' ? detalhes.titulo : detalhes.projetoNome}
                    </p>
                  </div>
                </div>

                <Link 
                  to={`/projetos/${detalhes.tipo === 'projeto' ? detalhes.id : detalhes.projetoId}`}
                  className="w-full text-center block bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-3 text-xs font-bold transition-all"
                >
                  Ver Ficha do Projeto
                </Link>
              </div>
            ) : null}

            {detalhes.clienteId || detalhes.clienteNome ? (
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Cliente</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{detalhes.clienteNome}</p>
                  </div>
                </div>

                {detalhes.clienteId && (
                  <Link 
                    to={`/clientes/${detalhes.clienteId}`}
                    className="w-full text-center block bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-3 text-xs font-bold transition-all"
                  >
                    Ver Perfil do Cliente
                  </Link>
                )}
              </div>
            ) : (
              !(detalhes.projetoId || detalhes.tipo === 'projeto') && (
                <p className="text-xs text-zinc-400 font-medium">Este compromisso é geral e não está vinculado a nenhum cliente ou projeto específico.</p>
              )
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
