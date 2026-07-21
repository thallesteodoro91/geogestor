import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiFetch } from '../../services/apiClient';
import { primaryActionButtonClass, secondaryActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { geoGreenSurfaceClass, geoKickerClass } from '../../utils/geoTheme';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Briefcase, 
  Clock, 
  Trash, 
  CheckSquare
} from '@phosphor-icons/react';

const localDateFormatter = new Intl.DateTimeFormat('pt-BR');

const formatLocalDate = (value?: string | null) => {
  if (!value) return '-';

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? '-' : localDateFormatter.format(date);
};

const getGoogleCalendarUrl = (titulo: string, dataStr: string, descricao?: string, hora?: string | null) => {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataStr);
  if (dateParts) {
    const [, year, month, day] = dateParts;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const nextDay = new Date(y, m - 1, d + 1);
    const nextY = nextDay.getFullYear();
    const nextM = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nextD = String(nextDay.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    let datesParam = `${year}${month}${day}/${nextY}${nextM}${nextD}`;
    if (hora) {
      const start = new Date(`${dateKey}T${hora}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const compact = (date: Date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`;
      datesParam = `${compact(start)}/${compact(end)}`;
    }
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&details=${encodeURIComponent(descricao || '')}&dates=${datesParam}&ctz=America%2FSao_Paulo`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo || '')}&details=${encodeURIComponent(descricao || '')}`;
};

export function CalendarioDetalhes() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteCompromissoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/compromissos/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao excluir compromisso');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compromissos'] });
      toast.success('Compromisso excluído com sucesso.');
      navigate('/calendario');
    },
    onError: () => {
      toast.error('Não foi possível excluir o compromisso. Tente novamente.');
    }
  });

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
        const res = await apiFetch(`/api/compromissos/${id}`);
        if (!res.ok) throw new Error('Compromisso não encontrado');
        const comp = await res.json();
        return {
          tipo: 'compromisso',
          titulo: comp.titulo,
          descricao: comp.descricao,
          data: comp.data,
          hora: comp.hora,
          tipoCompromisso: comp.tipo,
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
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Layout>
        <div role="status" aria-live="polite" className="flex min-h-64 flex-col items-center justify-center gap-3 py-24 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <span aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-600 motion-reduce:animate-none dark:border-zinc-800 dark:border-t-indigo-400" />
          <span>Carregando detalhes do evento…</span>
        </div>
      </Layout>
    );
  }

  if (error || !detalhes) {
    return (
      <Layout>
        <section role="alert" className="geo-surface mx-auto max-w-xl rounded-[2rem] p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Evento não encontrado</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
            O evento pode ter sido excluído ou não estar mais disponível.
          </p>
          <Link to="/calendario" className={cn(primaryActionButtonClass, 'mx-auto mt-6 w-fit')}>
            Voltar para o calendário
          </Link>
        </section>
      </Layout>
    );
  }

  const eventTypeLabel = detalhes.tipo === 'projeto'
    ? 'Prazo de projeto'
    : detalhes.tipo === 'tarefa'
      ? 'Limite de tarefa'
      : detalhes.tipoCompromisso;

  return (
    <Layout>
      <nav aria-label="Navegação estrutural" className="mb-8 flex min-w-0 items-center gap-3">
        <Link
          to="/calendario"
          aria-label="Voltar para o calendário"
          className="geo-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-[background-color,border-color,color] hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-200"
        >
          <ArrowLeft aria-hidden="true" weight="bold" className="h-4 w-4" />
        </Link>
        <div className="min-w-0 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link to="/calendario" className="geo-focus-ring rounded-md transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">Calendário</Link>
          <span aria-hidden="true" className="mx-2 text-zinc-300 dark:text-zinc-700">/</span>
          <span aria-current="page" className="text-zinc-950 dark:text-white">Detalhes do evento</span>
        </div>
      </nav>

      <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <span className={cn(geoKickerClass, 'mb-2')}>{eventTypeLabel}</span>
          <h1 className="break-words text-4xl font-semibold tracking-tighter text-zinc-950 text-balance sm:text-5xl dark:text-white">{detalhes.titulo}</h1>
          <p className="mt-2 max-w-3xl text-base font-medium leading-relaxed text-zinc-500 sm:text-lg dark:text-zinc-400">
            Consulte a data, o contexto e os vínculos deste evento.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:justify-end">
          {detalhes.data && (
            <a
              href={getGoogleCalendarUrl(detalhes.titulo, detalhes.data, detalhes.descricao, detalhes.hora)}
              target="_blank"
              rel="noreferrer"
              aria-label="Adicionar ao Google Agenda; abre em uma nova guia"
              className={cn(secondaryActionButtonClass, 'w-full justify-center sm:w-auto')}
            >
              <Calendar aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
              <span>Adicionar ao Google Agenda</span>
            </a>
          )}
          {detalhes.tipo === 'compromisso' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteCompromissoMutation.isPending}
              className="geo-focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition-[background-color,border-color,color] hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:border-red-400/45 dark:hover:bg-red-500/15"
            >
              <Trash aria-hidden="true" weight="bold" className="h-4 w-4" />
              <span>{deleteCompromissoMutation.isPending ? 'Excluindo…' : 'Excluir compromisso'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <section aria-labelledby="event-information-heading" className="space-y-6 rounded-[2rem] bg-gradient-to-br from-white via-white to-indigo-50/45 p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-zinc-900/5 sm:p-8 lg:col-span-2 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 dark:ring-white/10">
          <div>
            <h2 id="event-information-heading" className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Informações do evento</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Dados principais registrados no calendário.</p>
          </div>

          <div className="space-y-6 border-t border-zinc-200/80 pt-6 dark:border-zinc-800">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Descrição</h3>
              <p className="break-words text-base font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
                {detalhes.descricao || 'Sem descrição detalhada cadastrada para este evento.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-zinc-200/80 pt-6 sm:grid-cols-2 dark:border-zinc-800">
              <div className="rounded-2xl border border-zinc-200/80 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <Calendar aria-hidden="true" className="h-4 w-4" /> Data do evento
                </h3>
                <p className="text-lg font-bold tabular-nums text-zinc-950 dark:text-white">
                  {formatLocalDate(detalhes.data)}
                </p>
              </div>

              {detalhes.tipo === 'projeto' && (
                <div className="rounded-2xl border border-zinc-200/80 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <Clock aria-hidden="true" className="h-4 w-4" /> Período do projeto
                  </h3>
                  <p className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    Início: {formatLocalDate(detalhes.dataInicio)}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    Entrega: {formatLocalDate(detalhes.dataEntrega)}
                  </p>
                </div>
              )}

              {detalhes.tipo === 'compromisso' && detalhes.hora && (
                <div className="rounded-2xl border border-zinc-200/80 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <Clock aria-hidden="true" className="h-4 w-4" /> Horário
                  </h3>
                  <p className="text-lg font-bold tabular-nums text-zinc-950 dark:text-white">{detalhes.hora}</p>
                </div>
              )}
              
              {detalhes.tipo === 'tarefa' && (
                <div className="rounded-2xl border border-zinc-200/80 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <CheckSquare aria-hidden="true" className="h-4 w-4" /> Status e prioridade
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      detalhes.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200'
                    }`}>
                      {detalhes.status}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      detalhes.prioridade === 'Alta' ? 'bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                      {detalhes.prioridade}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside aria-labelledby="related-context-heading" className={cn(geoGreenSurfaceClass, 'space-y-6 rounded-[2rem] p-6 text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-emerald-300/15 sm:p-8')}>
          <div>
            <h2 id="related-context-heading" className="text-xl font-semibold text-white">Contexto relacionado</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-emerald-50/80">Vínculos usados para navegar entre os registros.</p>
          </div>
            
          {detalhes.projetoId || detalhes.tipo === 'projeto' ? (
              <div className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                    <Briefcase aria-hidden="true" className="h-5 w-5 text-emerald-100" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-50/70">Projeto</p>
                    <p className="mt-0.5 break-words text-sm font-semibold text-white">
                      {detalhes.tipo === 'projeto' ? detalhes.titulo : detalhes.projetoNome}
                    </p>
                  </div>
                </div>

                <Link 
                  to={`/projetos/${detalhes.tipo === 'projeto' ? detalhes.id : detalhes.projetoId}`}
                  className="geo-focus-ring block min-h-11 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-xs font-semibold text-white transition-[background-color,border-color] hover:border-white/30 hover:bg-white/15"
                >
                  Ver ficha do projeto
                </Link>
              </div>
            ) : null}

            {detalhes.clienteId || detalhes.clienteNome ? (
              <div className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                    <User aria-hidden="true" className="h-5 w-5 text-emerald-100" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-50/70">Cliente</p>
                    <p className="mt-0.5 break-words text-sm font-semibold text-white">{detalhes.clienteNome}</p>
                  </div>
                </div>

                {detalhes.clienteId && (
                  <Link 
                    to={`/clientes/${detalhes.clienteId}`}
                    className="geo-focus-ring block min-h-11 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-xs font-semibold text-white transition-[background-color,border-color] hover:border-white/30 hover:bg-white/15"
                  >
                    Ver perfil do cliente
                  </Link>
                )}
              </div>
            ) : (
              !(detalhes.projetoId || detalhes.tipo === 'projeto') && (
                <p className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-sm font-medium leading-relaxed text-emerald-50/85">
                  Este evento é geral e não está vinculado a nenhum cliente ou projeto específico.
                </p>
              )
            )}
        </aside>
      </div>
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteCompromissoMutation.mutate()}
        title={`Excluir compromisso${detalhes.titulo ? ` “${detalhes.titulo}”` : ''}?`}
        description="O compromisso será removido do calendário. Os cadastros de cliente e projeto vinculados serão preservados. Esta ação não pode ser desfeita."
        confirmText="Excluir compromisso"
        loading={deleteCompromissoMutation.isPending}
      />
    </Layout>
  );
}
