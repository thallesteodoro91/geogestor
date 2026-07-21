import { DatePickerField, FormSelect } from '../../components/Form';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  ClipboardText,
  FileArrowUp,
  FileText,
  FolderOpen,
  Leaf,
  NotePencil,
  PencilSimple,
  Plus,
  Scales,
  WarningCircle
} from '@phosphor-icons/react';
import type { EnvironmentalDemandDetail } from '@geogestor/contracts';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GeradorLaudoModal } from '../../components/GeradorLaudoModal';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import {
  primaryActionButtonClass,
  primarySubmitButtonClass,
  secondarySmallActionButtonClass
} from '../../utils/actionStyles';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
});
const formatDate = (value?: string | null) => value
  ? dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
  : 'Não informado';
const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));
const todayKey = () => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

const environmentalPhases = [
  'Levantamento inicial',
  'Documentação',
  'Protocolo',
  'Em análise',
  'Atendimento de exigência',
  'Vistoria',
  'Deferido',
  'Indeferido',
  'Concluído'
];

interface ProgressPayload {
  titulo: string;
  descricao: string;
  data: string;
  categoria: string;
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value || 'Não informado'}
      </dd>
    </div>
  );
}

export function AmbientalDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLaudo, setShowLaudo] = useState(false);
  const [showPhase, setShowPhase] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [confirmCompletion, setConfirmCompletion] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState<ProgressPayload>({
    titulo: '',
    descricao: '',
    data: todayKey(),
    categoria: 'Andamento ambiental'
  });

  const demandQuery = useQuery<EnvironmentalDemandDetail>({
    queryKey: ['ambiental-detail', id],
    queryFn: () => apiClient.get<EnvironmentalDemandDetail>(`/api/ambiental/${id}`),
    enabled: Boolean(id)
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ambiental-detail', id] }),
      queryClient.invalidateQueries({ queryKey: ['ambiental-demands'] })
    ]);
  };

  const phaseMutation = useMutation({
    mutationFn: (statusFase: string) => apiClient.patch(`/api/ambiental/${id}/fase`, { statusFase }),
    onSuccess: async () => {
      await refresh();
      setShowPhase(false);
      toast.success('Fase da demanda atualizada.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a fase.')
  });

  const progressMutation = useMutation({
    mutationFn: (payload: ProgressPayload) => apiClient.post(`/api/ambiental/${id}/andamentos`, payload),
    onSuccess: async () => {
      await refresh();
      setShowProgress(false);
      setProgress({ titulo: '', descricao: '', data: todayKey(), categoria: 'Andamento ambiental' });
      toast.success('Andamento registrado no histórico.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o andamento.')
  });

  const completionMutation = useMutation({
    mutationFn: () => apiClient.patch(`/api/projetos/${id}`, { status: 'Concluído' }),
    onSuccess: async () => {
      await refresh();
      setConfirmCompletion(false);
      toast.success('Demanda concluída.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a demanda.')
  });

  const submitProgress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    progressMutation.mutate(progress);
  };

  if (demandQuery.isLoading) {
    return (
      <Layout>
        <div aria-live="polite" className="flex min-h-[50vh] items-center justify-center">
          <p className="text-sm text-zinc-500">Carregando detalhes da demanda…</p>
        </div>
      </Layout>
    );
  }

  if (demandQuery.isError || !demandQuery.data) {
    return (
      <Layout>
        <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <WarningCircle aria-hidden="true" className="mb-3 h-9 w-9 text-red-600" />
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">Não foi possível carregar a demanda</h1>
          <p className="mt-1 text-sm text-zinc-500">Verifique o servidor local e tente novamente.</p>
          <button type="button" onClick={() => demandQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>
            Tentar novamente
          </button>
        </div>
      </Layout>
    );
  }

  const demand = demandQuery.data;
  const canChangePhase = demand.tipo === 'Ambiental';

  return (
    <Layout contentClassName="max-w-none">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/ambiental')}
            aria-label="Voltar para demandas ambientais"
            className="geo-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-[background-color,color,border-color] hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Leaf aria-hidden="true" className="h-3.5 w-3.5" />{demand.tipoDemanda || demand.tipo}
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {demand.status || 'Em andamento'}
              </span>
            </div>
            <h1 className="break-words text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{demand.nome}</h1>
            <p className="mt-1 break-words text-sm text-zinc-500 dark:text-zinc-400">{demand.clienteNome}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/projetos/${demand.id}`} className={secondarySmallActionButtonClass}>
            <PencilSimple aria-hidden="true" className="h-4 w-4" />Editar demanda
          </Link>
          {canChangePhase && (
            <button type="button" onClick={() => { setPhase(demand.statusFase || environmentalPhases[0]); setShowPhase(true); }} className={secondarySmallActionButtonClass}>
              <Scales aria-hidden="true" className="h-4 w-4" />Alterar fase
            </button>
          )}
          <button type="button" onClick={() => setShowProgress(true)} className={secondarySmallActionButtonClass}>
            <NotePencil aria-hidden="true" className="h-4 w-4" />Registrar andamento
          </button>
          <button type="button" onClick={() => setShowLaudo(true)} className={cn(primaryActionButtonClass, 'px-4 py-2.5')}>
            <FileText aria-hidden="true" className="h-4 w-4" />Gerar laudo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.42fr)]">
        <main className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-2">
              <Scales aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Dados da demanda</h2>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Tipo da demanda" value={demand.tipoDemanda || demand.tipo} />
              <DetailItem label="Órgão ambiental" value={demand.orgaoAmbiental} />
              <DetailItem label={demand.tipo === 'Perícia' ? 'Processo' : 'Protocolo'} value={demand.protocolo} />
              <DetailItem label="Fase atual" value={demand.statusFase} />
              <DetailItem label="Cliente" value={demand.clienteNome} />
              <DetailItem label="Propriedade" value={demand.propriedadeNome} />
              <DetailItem label="Data de início" value={formatDate(demand.dataInicio)} />
              <DetailItem label="Prazo" value={formatDate(demand.dataEntrega)} />
              <DetailItem label="Criada em" value={formatDate(demand.createdAt)} />
              <DetailItem label="Última atualização" value={formatDateTime(demand.updatedAt)} />
            </dl>
            <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Descrição</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {demand.descricao || 'Nenhuma descrição registrada.'}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Histórico do processo</h2>
                <p className="mt-1 text-xs text-zinc-500">Somente eventos vinculados a esta demanda.</p>
              </div>
              <button type="button" onClick={() => setShowProgress(true)} className={secondarySmallActionButtonClass}>
                <Plus aria-hidden="true" className="h-4 w-4" />Adicionar
              </button>
            </div>
            {demand.history.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardText aria-hidden="true" className="mx-auto mb-2 h-9 w-9 text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nenhum andamento registrado</h3>
                <p className="mt-1 text-xs text-zinc-500">Registre a primeira movimentação desta demanda.</p>
              </div>
            ) : (
              <ol className="mt-6 space-y-5 border-l border-zinc-200 pl-6 dark:border-zinc-700">
                {demand.history.map((item) => (
                  <li key={item.id} className="relative">
                    <span aria-hidden="true" className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 dark:border-zinc-900" />
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-sm font-semibold text-zinc-950 dark:text-white">{item.titulo || item.tipo}</h3>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {item.categoria || item.tipo}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{item.descricao}</p>
                    <time dateTime={item.data} className="mt-2 flex items-center gap-1 text-[11px] text-zinc-400">
                      <CalendarBlank aria-hidden="true" className="h-3.5 w-3.5" />{formatDate(item.data)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Próximas ações</h2>
            <div className="mt-4 grid gap-2">
              <Link to={`/projetos/${demand.id}`} className={secondarySmallActionButtonClass}>
                <Plus aria-hidden="true" className="h-4 w-4" />Adicionar tarefa ou prazo
              </Link>
              <Link to={`/projetos/${demand.id}`} className={secondarySmallActionButtonClass}>
                <FileArrowUp aria-hidden="true" className="h-4 w-4" />Anexar documento
              </Link>
              <Link to={`/projetos/${demand.id}`} className={secondarySmallActionButtonClass}>
                <FolderOpen aria-hidden="true" className="h-4 w-4" />Abrir projeto completo
              </Link>
            </div>
          </section>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Encerramento</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">Conclua a demanda somente após revisar os documentos e prazos pendentes.</p>
            <button
              type="button"
              onClick={() => setConfirmCompletion(true)}
              disabled={demand.status === 'Concluído'}
              className={cn(secondarySmallActionButtonClass, 'mt-4 w-full justify-center')}
            >
              <CheckCircle aria-hidden="true" className="h-4 w-4" />
              {demand.status === 'Concluído' ? 'Demanda concluída' : 'Concluir demanda'}
            </button>
          </section>
        </aside>
      </div>

      <Modal isOpen={showPhase} onClose={() => !phaseMutation.isPending && setShowPhase(false)} title="Alterar fase da demanda" initialFocusId="environmental-phase">
        <form onSubmit={(event) => { event.preventDefault(); phaseMutation.mutate(phase); }} className="space-y-5">
          <div>
            <label htmlFor="environmental-phase" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Nova fase</label>
            <FormSelect id="environmental-phase" name="statusFase" value={phase} onChange={(event) => setPhase(event.target.value)} className="geo-focus-ring min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
              {environmentalPhases.map((item) => <option key={item} value={item}>{item}</option>)}
            </FormSelect>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowPhase(false)} disabled={phaseMutation.isPending} className={secondarySmallActionButtonClass}>Cancelar</button>
            <button type="submit" disabled={!phase || phaseMutation.isPending} aria-busy={phaseMutation.isPending} className={primarySubmitButtonClass}>
              {phaseMutation.isPending ? 'Salvando…' : 'Salvar fase'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showProgress} onClose={() => !progressMutation.isPending && setShowProgress(false)} title="Registrar andamento" maxWidth="max-w-lg" initialFocusId="progress-title">
        <form onSubmit={submitProgress} className="space-y-4">
          <div>
            <label htmlFor="progress-title" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Título</label>
            <input id="progress-title" name="titulo" autoComplete="off" required value={progress.titulo} onChange={(event) => setProgress((current) => ({ ...current, titulo: event.target.value }))} className="geo-focus-ring min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>
          <div>
            <label htmlFor="progress-description" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Descrição</label>
            <textarea id="progress-description" name="descricao" autoComplete="off" required rows={5} value={progress.descricao} onChange={(event) => setProgress((current) => ({ ...current, descricao: event.target.value }))} className="geo-focus-ring w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="progress-date" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Data</label>
              <DatePickerField id="progress-date" name="data" required value={progress.data} onChange={(event) => setProgress((current) => ({ ...current, data: event.target.value }))} className="geo-focus-ring min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
            </div>
            <div>
              <label htmlFor="progress-category" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Categoria</label>
              <input id="progress-category" name="categoria" autoComplete="off" required value={progress.categoria} onChange={(event) => setProgress((current) => ({ ...current, categoria: event.target.value }))} className="geo-focus-ring min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowProgress(false)} disabled={progressMutation.isPending} className={secondarySmallActionButtonClass}>Cancelar</button>
            <button type="submit" disabled={progressMutation.isPending} aria-busy={progressMutation.isPending} className={primarySubmitButtonClass}>
              {progressMutation.isPending ? 'Registrando…' : 'Registrar andamento'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmCompletion}
        onClose={() => setConfirmCompletion(false)}
        onConfirm={() => completionMutation.mutate()}
        loading={completionMutation.isPending}
        title="Concluir demanda ambiental?"
        description="O status do projeto será alterado para Concluído. O histórico e os documentos serão preservados."
        confirmText="Concluir demanda"
      />
      <GeradorLaudoModal isOpen={showLaudo} onClose={() => setShowLaudo(false)} projetoId={demand.id} projetoNome={demand.nome} />
    </Layout>
  );
}
