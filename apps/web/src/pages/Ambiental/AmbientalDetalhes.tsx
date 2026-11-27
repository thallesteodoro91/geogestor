import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowCounterClockwise, CalendarBlank, CheckCircle, FileArrowUp, FileText, FolderOpen, Leaf, NotePencil, PencilSimple, Plus, Scales, WarningCircle } from '@phosphor-icons/react';
import { ENVIRONMENTAL_PHASES, EnvironmentalPhaseSchema, EnvironmentalProgressPayloadSchema, isEnvironmentalWorkCompleted, environmentalRecordedAtTime, type EnvironmentalDemandDetail, type EnvironmentalProgressPayload } from '@geogestor/contracts';
import { DatePickerField, FormSelect } from '../../components/Form';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GeradorLaudoModal } from '../../components/GeradorLaudoModal';
import { EnvironmentalDocumentHistory } from '../../components/EnvironmentalDocumentHistory';
import type { LaudoOptions } from '../../utils/laudoPdfGenerator';
import { useDraftNavigationGuard } from '../../hooks/useDraftNavigationGuard';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { environmentalProjectLink, environmentalReturn } from './environmentalNavigation';
import './environmental-detail.css';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const formatDate = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'Não informada';
const formatDateTime = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : Number.isFinite(environmentalRecordedAtTime(value)) ? dateTimeFormatter.format(new Date(environmentalRecordedAtTime(value))) : 'Não informada';
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const emptyProgress = (): EnvironmentalProgressPayload => ({ titulo: '', descricao: '', data: todayKey(), categoria: 'Andamento ambiental' });
const sectionClass = 'min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900';
const fieldClass = 'geo-focus-ring min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';
const actionClass = cn(secondarySmallActionButtonClass, 'min-h-11 whitespace-normal text-left');
const editClass = cn(actionClass, 'border-indigo-200/80 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50');
const documentClass = cn(actionClass, 'border-sky-200/80 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50');
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.';

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return <div className="min-w-0"><dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value || 'Não informado'}</dd></div>;
}

export function AmbientalDetalhes() {
  const { id } = useParams();
  return <DemandDetail key={id} id={id} />;
}

function DemandDetail({ id }: { id?: string }) {
  const [searchParams] = useSearchParams();
  const returnTo = environmentalReturn(searchParams.get('retorno'));
  const detailReturn = `/ambiental/${id}?${new URLSearchParams({ retorno: returnTo })}`;
  const queryClient = useQueryClient();
  const [showLaudo, setShowLaudo] = useState(false);
  const [documentRevision, setDocumentRevision] = useState<{ id: string; options: LaudoOptions } | null>(null);
  const [laudoDraft, setLaudoDraft] = useState({ dirty: false, saving: false });
  const [showPhase, setShowPhase] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [confirmWork, setConfirmWork] = useState<'concluir' | 'reabrir' | null>(null);
  const [phase, setPhase] = useState('');
  const [phaseError, setPhaseError] = useState('');
  const [progress, setProgress] = useState(emptyProgress);
  const [progressBaseline, setProgressBaseline] = useState(() => JSON.stringify(progress));
  const [progressErrors, setProgressErrors] = useState<Partial<Record<keyof EnvironmentalProgressPayload, string>>>({});
  const progressTrigger = useRef<HTMLElement | null>(null);
  const restoreActionFocus = (target = 'demand-work-action') => window.requestAnimationFrame(() => document.getElementById(target)?.focus());
  const restoreProgressFocus = () => window.requestAnimationFrame(() => {
    const target = progressTrigger.current;
    if (target?.isConnected && !target.matches(':disabled')) target.focus();
    else document.getElementById('demand-work-action')?.focus();
  });
  const demandQuery = useQuery<EnvironmentalDemandDetail>({ queryKey: ['ambiental-detail', id], queryFn: () => apiClient.get(`/api/ambiental/${id}`), enabled: Boolean(id) });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ambiental-detail', id] }),
      queryClient.invalidateQueries({ queryKey: ['ambiental-demandas'] }),
      queryClient.invalidateQueries({ queryKey: ['projeto', id] }),
      queryClient.invalidateQueries({ queryKey: ['projetos'] })
    ]);
  };
  const phaseMutation = useMutation({
    mutationFn: (statusFase: string) => apiClient.patch(`/api/ambiental/${id}/fase`, { statusFase }),
    onSuccess: async () => { await refresh(); setPhase(''); setShowPhase(false); restoreActionFocus('demand-phase-action'); toast.success('Fase do processo ambiental atualizada.'); },
    onError: () => { void refresh(); }
  });
  const progressMutation = useMutation({
    mutationFn: (payload: EnvironmentalProgressPayload) => apiClient.post(`/api/ambiental/${id}/andamentos`, payload),
    onSuccess: async () => {
      await refresh();
      const blank = emptyProgress(); setProgress(blank); setProgressBaseline(JSON.stringify(blank)); setProgressErrors({}); setShowProgress(false);
      restoreProgressFocus(); toast.success('Andamento registrado no histórico.');
    },
    onError: () => { void refresh(); }
  });
  const workMutation = useMutation({
    mutationFn: (action: 'concluir' | 'reabrir') => apiClient.post(`/api/ambiental/${id}/${action}`),
    onSuccess: async (_result, action) => { await refresh(); setConfirmWork(null); restoreActionFocus(); toast.success(action === 'reabrir' ? 'Trabalho reaberto. As ações estão disponíveis.' : 'Trabalho concluído.'); },
    onError: () => { void refresh(); }
  });
  const saving = phaseMutation.isPending || progressMutation.isPending || workMutation.isPending || laudoDraft.saving;
  const phaseDirty = Boolean(phase && phase !== demandQuery.data?.statusFase);
  const draftConfirmation = useDraftNavigationGuard(JSON.stringify(progress) !== progressBaseline || phaseDirty || laudoDraft.dirty, saving);
  const completed = isEnvironmentalWorkCompleted(demandQuery.data?.status);
  const blocked = completed || saving;
  const openProgress = () => { if (blocked) return; progressTrigger.current = document.activeElement as HTMLElement; progressMutation.reset(); setShowProgress(true); };
  const submitProgress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked) return;
    const parsed = EnvironmentalProgressPayloadSchema.safeParse(progress);
    if (!parsed.success) {
      const errors: Partial<Record<keyof EnvironmentalProgressPayload, string>> = {};
      parsed.error.issues.forEach(issue => { const key = issue.path[0] as keyof EnvironmentalProgressPayload; if (!errors[key]) errors[key] = issue.message; });
      setProgressErrors(errors);
      const ids = { titulo: 'progress-title', descricao: 'progress-description', data: 'progress-date', categoria: 'progress-category' };
      document.getElementById(ids[Object.keys(errors)[0] as keyof typeof ids])?.focus();
      return;
    }
    setProgressErrors({}); progressMutation.mutate(parsed.data);
  };

  if (demandQuery.isLoading) return <Layout><p role="status" className="py-16 text-center text-sm text-zinc-600 dark:text-zinc-400">Carregando detalhes da demanda…</p></Layout>;
  if (demandQuery.isError || !demandQuery.data) return <Layout><div role="alert" className="py-16 text-center"><WarningCircle aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-red-600" /><h1 className="text-lg font-semibold text-zinc-950 dark:text-white">Não foi possível carregar a demanda</h1><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Verifique o servidor local e tente novamente.</p><button type="button" onClick={() => demandQuery.refetch()} className={cn(actionClass, 'mx-auto mt-4')}>Tentar novamente</button></div>{draftConfirmation}</Layout>;
  const demand = demandQuery.data;
  const projectLink = (action?: 'editar' | 'nova-tarefa' | 'anexar') => environmentalProjectLink(demand.id, detailReturn, action);
  const deadline = demand.dataEntrega;
  const overdue = Boolean(!completed && deadline && deadline < todayKey());
  const absent = [['Órgão ambiental', demand.orgaoAmbiental], [demand.tipo === 'Perícia' ? 'Processo' : 'Protocolo', demand.protocolo], ['Propriedade', demand.propriedadeNome]].filter(([, value]) => !value).map(([label]) => label);
  const openWorkConfirmation = (action: 'concluir' | 'reabrir') => { workMutation.reset(); setConfirmWork(action); };

  return <Layout contentClassName="max-w-none">
    <div className="environmental-detail min-w-0">
      <header className="mb-6 flex flex-col gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <Link to={returnTo} aria-label="Voltar para demandas ambientais" className={cn(actionClass, 'h-11 w-11 shrink-0 justify-center p-0')}><ArrowLeft aria-hidden="true" className="h-5 w-5" /></Link>
          <div className="min-w-0"><span className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><Leaf aria-hidden="true" className="h-4 w-4" />{demand.tipoDemanda || demand.tipo}</span><h1 className="break-words text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{demand.nome}</h1><p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-400">{demand.clienteNome}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {completed ? <button id="demand-work-action" type="button" onClick={() => openWorkConfirmation('reabrir')} disabled={saving} className={cn(primaryActionButtonClass, 'px-4 py-2.5')}><ArrowCounterClockwise aria-hidden="true" className="h-4 w-4" />Reabrir trabalho</button> : <button id="demand-work-action" type="button" onClick={openProgress} disabled={blocked} className={cn(primaryActionButtonClass, 'px-4 py-2.5')}><NotePencil aria-hidden="true" className="h-4 w-4" />Registrar andamento</button>}
          {demand.tipo === 'Ambiental' && <button id="demand-phase-action" type="button" disabled={blocked} aria-describedby={completed ? 'completed-policy' : undefined} onClick={() => { phaseMutation.reset(); setPhaseError(''); setPhase(current => current || demand.statusFase || ''); setShowPhase(true); }} className={editClass}><Scales aria-hidden="true" className="h-4 w-4" />Alterar fase</button>}
          <Link to={projectLink('editar')} className={editClass}><PencilSimple aria-hidden="true" className="h-4 w-4" />Editar demanda</Link>
          <button type="button" onClick={() => { setDocumentRevision(null); setShowLaudo(true); }} className={documentClass}><FileText aria-hidden="true" className="h-4 w-4" />Gerar relatório</button>
        </div>
      </header>
      <section aria-labelledby="demand-situation" className={cn(sectionClass, 'mb-6')}>
        <h2 id="demand-situation" className="mb-4 text-base font-semibold text-zinc-950 dark:text-white">Situação da demanda</h2>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Status do trabalho</dt><dd className={cn('mt-1 text-lg font-semibold', completed ? 'text-emerald-800 dark:text-emerald-300' : 'text-zinc-950 dark:text-white')}>{demand.status || 'Não informado'}</dd></div>
          <DetailItem label={demand.tipo === 'Perícia' ? 'Fase da perícia' : 'Fase do processo ambiental'} value={demand.statusFase || 'Não informada'} />
          <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">{completed ? 'Prazo registrado do trabalho' : 'Prazo de entrega'}</dt><dd className={cn('mt-1 text-lg font-semibold tabular-nums', overdue ? 'text-red-700 dark:text-red-300' : 'text-zinc-950 dark:text-white')}><span>{formatDate(deadline)}</span><p className="mt-1 text-sm font-normal text-zinc-600 dark:text-zinc-400">{completed ? 'Referência histórica; o trabalho está concluído.' : !deadline ? 'Defina o prazo no editor da demanda.' : overdue ? 'Prazo ultrapassado. Revise a entrega.' : deadline === todayKey() ? 'Entrega prevista para hoje.' : 'Entrega prevista para esta demanda.'}</p></dd></div>
        </dl>
        {completed ? <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800"><h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><CheckCircle aria-hidden="true" className="h-5 w-5" />Trabalho concluído</h3>{demand.encerramento && <p className="mt-2 break-words text-sm text-zinc-700 dark:text-zinc-300">Encerramento registrado em {formatDateTime(demand.encerramento.data)}. {demand.encerramento.descricao}</p>}<p id="completed-policy" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Dados, histórico e documentos seguem disponíveis para consulta. Reabra o trabalho para alterar a fase ou registrar novos andamentos.</p>{!demand.encerramento && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Este registro não possui data ou evidência de encerramento no histórico.</p>}</div> : null}
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"><p className="text-sm text-zinc-700 dark:text-zinc-300">{demand.pendingTaskCount ? `${demand.pendingTaskCount} ${demand.pendingTaskCount === 1 ? 'tarefa pendente vinculada' : 'tarefas pendentes vinculadas'}${completed ? ' ao trabalho concluído. Revise o checklist.' : '.'}` : 'Nenhuma tarefa pendente vinculada.'}</p>{demand.proximaAcao && <p className="mt-2 break-words text-sm text-zinc-700 dark:text-zinc-300">Próxima tarefa: <Link to={projectLink()} className="geo-focus-ring inline-flex min-h-11 items-center rounded font-semibold underline underline-offset-2">{demand.proximaAcao}</Link> · {demand.proximaAcaoEm ? `Prazo: ${formatDate(demand.proximaAcaoEm)}` : 'Sem prazo definido'}</p>}</div>
      </section>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
        <div className="min-w-0 space-y-6">
          <section className={sectionClass}><h2 className="mb-4 text-base font-semibold text-zinc-950 dark:text-white">Dados complementares</h2><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{demand.orgaoAmbiental && <DetailItem label="Órgão ambiental" value={demand.orgaoAmbiental} />}{demand.protocolo && <DetailItem label={demand.tipo === 'Perícia' ? 'Processo' : 'Protocolo'} value={demand.protocolo} />}{demand.propriedadeNome && <DetailItem label="Propriedade" value={demand.propriedadeNome} />}<DetailItem label="Data de início do trabalho" value={formatDate(demand.dataInicio)} /></dl>{absent.length > 0 && <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Não informados: {absent.join(', ')}. <Link to={projectLink('editar')} className="geo-focus-ring inline-flex min-h-11 items-center rounded font-semibold text-indigo-800 underline underline-offset-2 dark:text-indigo-300">Completar dados</Link></p>}<div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"><h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Descrição</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{demand.descricao || 'Nenhuma descrição registrada.'}</p></div><dl className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800"><DetailItem label="Cadastrada no GeoGestor em" value={formatDateTime(demand.createdAt)} /><DetailItem label="Última atualização" value={formatDateTime(demand.updatedAt)} /></dl></section>
          <section className={sectionClass}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-zinc-950 dark:text-white">Histórico do processo</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Eventos vinculados a esta demanda.</p></div><button type="button" disabled={blocked} onClick={openProgress} className={actionClass}><Plus aria-hidden="true" className="h-4 w-4" />Adicionar andamento</button></div>{!demand.history.length ? <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">{completed ? 'Nenhum andamento foi registrado para este trabalho.' : 'Nenhum andamento registrado. Use “Registrar andamento” para iniciar o histórico.'}</p> : <ol className="mt-5 space-y-5 border-l border-zinc-200 pl-5 dark:border-zinc-700">{demand.history.map(item => <li key={item.id} className="relative min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_100px]"><span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-emerald-700 dark:bg-emerald-400" /><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold text-zinc-950 dark:text-white">{item.titulo || item.tipo}</h3><span className="break-words text-xs text-zinc-600 dark:text-zinc-400">{item.categoria || item.tipo}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{item.descricao}</p><time dateTime={item.data} className="mt-2 flex items-center gap-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400"><CalendarBlank aria-hidden="true" className="h-3.5 w-3.5" />{formatDate(item.data)}</time></li>)}</ol>}</section>
        </div>
        <aside className="min-w-0 space-y-4">
          <section className={sectionClass}><h2 className="text-base font-semibold text-zinc-950 dark:text-white">Ações da demanda</h2><div className="mt-4 grid gap-2"><Link to={projectLink('nova-tarefa')} className={editClass}><Plus aria-hidden="true" className="h-4 w-4 shrink-0" />Adicionar tarefa ou prazo</Link><Link to={projectLink('anexar')} className={documentClass}><FileArrowUp aria-hidden="true" className="h-4 w-4 shrink-0" />Anexar documento</Link><Link to={projectLink()} className={actionClass}><FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0" />Abrir projeto completo</Link></div></section>
          {!completed && <section className={sectionClass}><h2 className="text-base font-semibold text-zinc-950 dark:text-white">Encerramento</h2><p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Revise os documentos e as tarefas pendentes antes de concluir o trabalho.</p><button type="button" disabled={saving} onClick={() => openWorkConfirmation('concluir')} className={cn(actionClass, 'mt-4 w-full justify-center border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200')}><CheckCircle aria-hidden="true" className="h-4 w-4" />Concluir demanda</button></section>}
        </aside>
      </div>
    </div>
    <Modal isOpen={showPhase} onClose={() => setShowPhase(false)} closeDisabled={phaseMutation.isPending} title="Alterar fase do processo ambiental" initialFocusId="environmental-phase">
      <form noValidate onSubmit={event => { event.preventDefault(); if (blocked) return; if (!EnvironmentalPhaseSchema.safeParse(phase).success) { setPhaseError('Selecione uma fase do processo ambiental.'); document.getElementById('environmental-phase')?.focus(); return; } setPhaseError(''); phaseMutation.mutate(phase); }} className="space-y-5">
        <div><label htmlFor="environmental-phase" className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Nova fase</label><FormSelect id="environmental-phase" name="statusFase" autoComplete="off" value={phase} disabled={blocked} onChange={event => { setPhase(event.target.value); setPhaseError(''); }} aria-invalid={Boolean(phaseError)} aria-describedby={phaseError ? 'phase-error' : undefined} className={fieldClass}><option value="">Selecione uma fase…</option>{phase && !ENVIRONMENTAL_PHASES.includes(phase as typeof ENVIRONMENTAL_PHASES[number]) && <option value={phase}>{phase} (registro anterior)</option>}{ENVIRONMENTAL_PHASES.map(item => <option key={item} value={item}>{item}</option>)}</FormSelect>{phaseError && <p id="phase-error" role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{phaseError}</p>}</div>
        {phaseMutation.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errorText(phaseMutation.error)} Seu preenchimento foi preservado.</p>}
        {completed && <p role="alert" className="text-sm text-zinc-700 dark:text-zinc-300">Reabra o trabalho antes de alterar a fase.</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={phaseMutation.isPending} onClick={() => setShowPhase(false)} className={actionClass}>Fechar</button><button type="submit" disabled={blocked} aria-busy={phaseMutation.isPending} className={primarySubmitButtonClass}><span aria-live="polite">{phaseMutation.isPending ? 'Salvando fase…' : 'Salvar fase'}</span></button></div>
      </form>
    </Modal>
    <Modal isOpen={showProgress} onClose={() => setShowProgress(false)} closeDisabled={progressMutation.isPending} title="Registrar andamento" maxWidth="max-w-lg" initialFocusId="progress-title">
      <form noValidate onSubmit={submitProgress} className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Ao fechar este formulário, o rascunho permanece nesta demanda até você salvar ou sair da página.</p>
        {(['titulo', 'descricao', 'data', 'categoria'] as const).map(key => {
          const metadata = { titulo: ['progress-title', 'Título', 180], descricao: ['progress-description', 'Descrição', 3000], data: ['progress-date', 'Data do andamento', 0], categoria: ['progress-category', 'Categoria', 120] } as const;
          const [fieldId, label, maxLength] = metadata[key];
          const props = { id: fieldId, name: key, required: true, disabled: progressMutation.isPending, autoComplete: 'off', value: progress[key], 'aria-invalid': Boolean(progressErrors[key]), 'aria-describedby': `${fieldId}-hint${progressErrors[key] ? ` ${fieldId}-error` : ''}`, onChange: (event: { target: { value: string } }) => { setProgress(current => ({ ...current, [key]: event.target.value })); setProgressErrors(current => ({ ...current, [key]: undefined })); }, className: fieldClass };
          return <div key={key}><label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</label>{key === 'descricao' ? <textarea {...props} maxLength={maxLength} rows={4} className={cn(fieldClass, 'resize-y')} /> : key === 'data' ? <DatePickerField {...props} /> : <input {...props} type="text" maxLength={maxLength} />}<p id={`${fieldId}-hint`} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{key === 'data' ? 'Data do evento; pode ser anterior ao cadastro no GeoGestor.' : `Até ${new Intl.NumberFormat('pt-BR').format(maxLength)} caracteres.`}</p>{progressErrors[key] && <p id={`${fieldId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{progressErrors[key]}</p>}</div>;
        })}
        {progressMutation.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errorText(progressMutation.error)} Seu preenchimento foi preservado. Revise os dados e tente novamente.</p>}
        {completed && <p role="alert" className="text-sm text-zinc-700 dark:text-zinc-300">Reabra o trabalho antes de registrar um andamento.</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowProgress(false)} disabled={progressMutation.isPending} className={actionClass}>Fechar</button><button type="submit" disabled={blocked} aria-busy={progressMutation.isPending} className={primarySubmitButtonClass}><span aria-live="polite">{progressMutation.isPending ? 'Registrando…' : 'Registrar andamento'}</span></button></div>
      </form>
    </Modal>
    <ConfirmDialog returnFocusSelector="#demand-work-action" isOpen={Boolean(confirmWork)} onClose={() => setConfirmWork(null)} onConfirm={() => { if (confirmWork) workMutation.mutate(confirmWork); }} loading={workMutation.isPending} error={workMutation.isError ? errorText(workMutation.error) : undefined} variant={confirmWork === 'reabrir' ? 'info' : 'success'} title={confirmWork === 'reabrir' ? 'Reabrir trabalho?' : 'Concluir demanda ambiental?'} description={confirmWork === 'reabrir' ? 'O status do trabalho voltará a Em Andamento. A fase atual, os documentos e todo o histórico serão preservados. Você poderá alterar a fase e registrar novos andamentos; a reabertura ficará no histórico.' : `O status do trabalho será alterado para Concluído. A fase, o histórico e os documentos serão preservados. Alterações de fase e novos andamentos exigirão reabertura.${demand.pendingTaskCount ? ` Há ${demand.pendingTaskCount} tarefa(s) pendente(s) para revisar no checklist.` : ''}`} confirmText={confirmWork === 'reabrir' ? 'Reabrir trabalho' : 'Concluir demanda'} loadingText={confirmWork === 'reabrir' ? 'Reabrindo…' : 'Concluindo…'} />
    <EnvironmentalDocumentHistory projetoId={demand.id} onRevision={revision => { setDocumentRevision(revision); setShowLaudo(true); }} />
    <GeradorLaudoModal isOpen={showLaudo} onClose={() => setShowLaudo(false)} projetoId={demand.id} projetoNome={demand.nome} clienteNome={demand.clienteNome} tipoDemanda={demand.tipoDemanda || demand.nome} propriedadeNome={demand.propriedadeNome} protocolo={demand.protocolo} orgaoAmbiental={demand.orgaoAmbiental} situacaoTrabalho={demand.status} faseAmbiental={demand.statusFase} onDraftStateChange={setLaudoDraft} revision={documentRevision} />
    {draftConfirmation}
  </Layout>;
}
