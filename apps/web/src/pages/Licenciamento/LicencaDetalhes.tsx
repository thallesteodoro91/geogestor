import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  FileText,
  FolderOpen,
  Note,
  PencilSimple,
  Plus,
  Repeat,
  Trash,
  Warning,
  WarningCircle
} from '@phosphor-icons/react';
import {
  APP_QUERY_KEYS,
  appLinks,
  type ConditionPayload,
  type LicenseCondition,
  type LicenseDetail,
  type LicensePayload
} from '@geogestor/contracts';
import { Layout } from '../../components/Layout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { getWorkStatusPresentation } from '../../utils/workStatus';
import { primaryActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { LicenseFormModal } from './LicenseFormModal';
import { ConditionFormModal } from './ConditionFormModal';
import { ConditionReadDetails } from './ConditionReadDetails';
import { conditionStatusClass, formatLicenseDate, getLicenseExpirationPresentation, getSafeLicenseReturnTo, licenseStatusClass } from './licensePresentation';
import './licensing.css';

const formatDate = formatLicenseDate;
const localToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const tabs = ['overview', 'conditions', 'documents', 'history'] as const;
type DetailTab = typeof tabs[number];
const tabLabels: Record<DetailTab, string> = { overview: 'Visão geral', conditions: 'Condicionantes', documents: 'Documentos', history: 'Histórico' };

export function LicencaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const returnTo = getSafeLicenseReturnTo(searchParams.get('retorno'));
  const requestedTab = searchParams.get('tab');
  const activeTab: DetailTab = tabs.includes(requestedTab as DetailTab) ? requestedTab as DetailTab : 'overview';
  const setActiveTab = (tab: DetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const handledConditionIdRef = useRef<string | null>(null);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [editingCondition, setEditingCondition] = useState<LicenseCondition | null>(null);
  const [deleteCondition, setDeleteCondition] = useState<LicenseCondition | null>(null);
  const [confirmDeleteLicense, setConfirmDeleteLicense] = useState(false);
  const [highlightedConditionId, setHighlightedConditionId] = useState<string | null>(null);

  const licenseQuery = useQuery<LicenseDetail>({
    queryKey: ['licenca', id],
    queryFn: ({ signal }) => apiClient.get<LicenseDetail>(`/api/licencas/${id}`, { signal }),
    enabled: Boolean(id)
  });

  const requestedConditionId = searchParams.get(APP_QUERY_KEYS.condition);
  useEffect(() => {
    if (!requestedConditionId) {
      handledConditionIdRef.current = null;
      return;
    }
    if (licenseQuery.isLoading || handledConditionIdRef.current === requestedConditionId) return;

    handledConditionIdRef.current = requestedConditionId;
    queueMicrotask(() => {
      const condition = licenseQuery.data?.condicionantes.find((item) => item.id === requestedConditionId);
      if (condition) {
        setHighlightedConditionId(condition.id);
        toast.info(`Condicionante aberta: ${condition.titulo}`);
      }
      else toast.info('A condicionante indicada pelo alerta não foi encontrada.');

      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete(APP_QUERY_KEYS.condition);
        if (condition) next.set('tab', 'conditions');
        return next;
      }, { replace: true });
    });
  }, [licenseQuery.data, licenseQuery.isLoading, requestedConditionId, setSearchParams]);

  useEffect(() => {
    if (activeTab !== 'conditions' || !highlightedConditionId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`condition-${highlightedConditionId}`);
      target?.scrollIntoView({ block: 'center' });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, highlightedConditionId]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['licenca', id] }),
      queryClient.invalidateQueries({ queryKey: ['licencas'] })
    ]);
  };

  const updateLicenseMutation = useMutation({
    mutationFn: (payload: LicensePayload) => apiClient.put(`/api/licencas/${id}`, payload),
    onSuccess: async () => { await invalidate(); setShowLicenseForm(false); toast.success('Licença atualizada com sucesso.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a licença.')
  });
  const renewalMutation = useMutation({
    mutationFn: () => apiClient.patch(`/api/licencas/${id}`, { status: 'Em renovação' }),
    onSuccess: async () => { await invalidate(); toast.success('Renovação iniciada.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a renovação.')
  });
  const deleteLicenseMutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/licencas/${id}`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['licencas'] }); toast.success('Licença excluída.'); navigate(returnTo); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a licença.')
  });
  const saveConditionMutation = useMutation({
    mutationFn: (payload: ConditionPayload) => editingCondition
      ? apiClient.patch(`/api/licencas/${id}/condicionantes/${editingCondition.id}`, payload)
      : apiClient.post(`/api/licencas/${id}/condicionantes`, payload),
    onSuccess: async () => { await invalidate(); setShowConditionForm(false); setEditingCondition(null); toast.success('Condicionante salva com sucesso.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a condicionante.')
  });
  const fulfillConditionMutation = useMutation({
    mutationFn: (condition: LicenseCondition) => apiClient.patch(`/api/licencas/${id}/condicionantes/${condition.id}`, { status: 'Cumprida', dataCumprimento: localToday() }),
    onSuccess: async () => { await invalidate(); toast.success('Condicionante marcada como cumprida.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível cumprir a condicionante.')
  });
  const deleteConditionMutation = useMutation({
    mutationFn: (conditionId: string) => apiClient.delete(`/api/licencas/${id}/condicionantes/${conditionId}`),
    onSuccess: async () => { await invalidate(); setDeleteCondition(null); toast.success('Condicionante excluída.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a condicionante.')
  });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[next]);
    tabRefs.current[next]?.focus();
  };

  if (licenseQuery.isLoading) return <Layout><div role="status" className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">Carregando licença…</div></Layout>;
  if (licenseQuery.isError || !licenseQuery.data) return <Layout><div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center text-center"><WarningCircle aria-hidden="true" className="mb-3 h-9 w-9 text-red-600" /><h1 className="text-lg font-semibold text-zinc-950 dark:text-white">Não foi possível carregar a licença</h1><Link to={returnTo} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Voltar ao licenciamento</Link></div></Layout>;
  const license = licenseQuery.data;
  const expiration = getLicenseExpirationPresentation(license);

  return (
    <Layout contentClassName="max-w-none"><div className="licensing-surface">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <Link to={returnTo} aria-label="Voltar ao licenciamento" className="geo-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"><ArrowLeft aria-hidden="true" className="h-5 w-5" /></Link>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">{license.tipoLicenca || 'Licença ambiental'}</span><span className={cn('rounded-full px-2 py-1 text-xs font-semibold', licenseStatusClass(license.status))}>Licença: {license.status}</span><span className={cn('rounded-full px-2 py-1 text-xs font-semibold', getWorkStatusPresentation(license.trabalhoStatus).badgeClass)}>Trabalho: {getWorkStatusPresentation(license.trabalhoStatus).label}</span>{license.statusRegistrado !== license.status && <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', licenseStatusClass(license.statusRegistrado))}>{license.statusRegistradoReconhecido ? 'Registrado' : 'Registrado (legado não reconhecido)'}: {license.statusRegistrado}</span>}</div><h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{license.numero}</h1><p className="mt-1 break-words text-sm text-zinc-500 dark:text-zinc-400">{license.projetoNome} · {license.clienteNome}</p></div>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => renewalMutation.mutate()} aria-busy={renewalMutation.isPending} disabled={renewalMutation.isPending || license.statusRegistrado === 'Em renovação' || license.status === 'Encerrada'} className={cn(secondarySmallActionButtonClass, 'license-action license-tone-success')}><Repeat aria-hidden="true" className="h-4 w-4" />{renewalMutation.isPending ? 'Iniciando renovação…' : 'Iniciar renovação'}</button><button type="button" onClick={() => setShowLicenseForm(true)} className={cn(secondarySmallActionButtonClass, 'license-action license-tone-info')}><PencilSimple aria-hidden="true" className="h-4 w-4" />Editar</button><button type="button" onClick={() => setConfirmDeleteLicense(true)} className="geo-button-base geo-focus-ring license-action min-h-11 gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"><Trash aria-hidden="true" className="h-4 w-4" />Excluir</button></div>
      </div>

      <div role="status" className={cn('mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium', `license-tone-${expiration.tone}`)}>{expiration.tone === 'danger' || expiration.tone === 'warning' ? <Warning aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : expiration.tone === 'success' ? <CheckCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<span>{expiration.message}</span></div>

      <div role="tablist" aria-label="Detalhes da licença" className="mb-5 flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab, index) => <button key={tab} ref={(element) => { tabRefs.current[index] = element; }} id={`license-tab-${tab}`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`license-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onKeyDown={(event) => handleTabKeyDown(event, index)} onClick={() => setActiveTab(tab)} className={cn('min-h-11 shrink-0 border-b-2 px-4 text-xs font-semibold transition-[border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', activeTab === tab ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white')}>{tabLabels[tab]}{tab === 'conditions' && <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">{license.condicionantes.length}</span>}</button>)}
      </div>

      <section id="license-panel-overview" role="tabpanel" aria-labelledby="license-tab-overview" hidden={activeTab !== 'overview'} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="text-base font-semibold text-zinc-950 dark:text-white">Dados da licença</h2><dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2"><div><dt className="text-xs font-medium text-zinc-500">Projeto ou empreendimento</dt><dd className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-white">{license.projetoNome}</dd></div><div><dt className="text-xs font-medium text-zinc-500">Cliente</dt><dd className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-white">{license.clienteNome}</dd></div><div><dt className="text-xs font-medium text-zinc-500">Órgão ambiental</dt><dd className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-white">{license.orgao}</dd></div><div><dt className="text-xs font-medium text-zinc-500">Processo ou protocolo</dt><dd className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-white">{license.protocolo || 'Não informado'}</dd></div><div><dt className="text-xs font-medium text-zinc-500">Emissão</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{formatDate(license.dataEmissao)}</dd></div><div><dt className="text-xs font-medium text-zinc-500">Vencimento</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{formatDate(license.dataVencimento)}</dd></div></dl>{license.observacoes && <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800"><h3 className="text-xs font-medium text-zinc-500">Observações</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200">{license.observacoes}</p></div>}</article>
        <aside className="space-y-4"><article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Condicionantes</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="license-tone-warning rounded-xl p-3"><span className="block text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-200">{license.condicionantesPendentes}</span><span className="text-xs text-amber-950 dark:text-white">Pendentes</span></div><div className="license-tone-danger rounded-xl p-3"><span className="block text-2xl font-bold tabular-nums text-red-900 dark:text-red-200">{license.condicionantesVencidas}</span><span className="text-[11px] text-red-800 dark:text-red-300">Vencidas</span></div></div><button type="button" onClick={() => setActiveTab('conditions')} className={cn(secondarySmallActionButtonClass, 'mt-4 w-full')}>Ver condicionantes</button></article><Link to={appLinks.projectSection(license.projetoId, 'documentos')} className={cn(secondarySmallActionButtonClass, 'flex w-full items-center justify-center')}><FolderOpen aria-hidden="true" className="h-4 w-4" />Abrir projeto e documentos</Link></aside>
      </section>

      <section id="license-panel-conditions" role="tabpanel" aria-labelledby="license-tab-conditions" hidden={activeTab !== 'conditions'} className="min-w-0">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Condicionantes ambientais</h2><p className="text-xs text-zinc-500">Controle prazos, responsáveis, cumprimento e comprovantes.</p></div><button type="button" onClick={() => { setEditingCondition(null); setShowConditionForm(true); }} className={cn(primaryActionButtonClass, 'gap-2 px-4 py-2.5 text-sm')}><Plus aria-hidden="true" className="h-4 w-4" />Nova condicionante</button></div>
        {!license.condicionantes.length ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center dark:border-zinc-800 dark:bg-zinc-900"><FileText aria-hidden="true" className="mx-auto mb-2 h-9 w-9 text-zinc-300" /><h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Nenhuma condicionante cadastrada</h3><p className="mt-1 text-xs text-zinc-500">Registre obrigações e seus respectivos prazos.</p></div> : <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{license.condicionantes.map((condition) => <article id={`condition-${condition.id}`} tabIndex={-1} key={condition.id} className={cn('rounded-2xl border bg-white p-5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-zinc-900', highlightedConditionId === condition.id ? 'border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400' : 'border-zinc-200 dark:border-zinc-800')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', conditionStatusClass(condition.status))}>{condition.status}</span><h3 className="mt-2 break-words text-sm font-semibold text-zinc-950 dark:text-white">{condition.titulo}</h3>{condition.descricao && <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{condition.descricao}</p>}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setEditingCondition(condition); setShowConditionForm(true); }} aria-label={`Editar condicionante ${condition.titulo}`} className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg border border-brand-primary-200 bg-brand-primary-50 text-brand-primary-800 hover:bg-brand-primary-100 dark:border-brand-primary-600 dark:bg-brand-primary-900 dark:text-brand-primary-100"><PencilSimple aria-hidden="true" className="h-4 w-4" /></button><button type="button" onClick={() => setDeleteCondition(condition)} aria-label={`Excluir condicionante ${condition.titulo}`} className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg border license-tone-danger hover:brightness-95 dark:hover:brightness-110"><Trash aria-hidden="true" className="h-4 w-4" /></button></div></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-zinc-400">Data limite</dt><dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300">{formatDate(condition.dataLimite)}</dd></div><div><dt className="text-zinc-400">Responsável</dt><dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300">{condition.responsavel || 'Não definido'}</dd></div>{condition.periodicidade && <div><dt className="text-zinc-400">Periodicidade</dt><dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300">{condition.periodicidade}</dd></div>}{condition.comprovante && <div><dt className="text-zinc-400">Comprovante</dt><dd className="mt-0.5 truncate font-semibold text-zinc-700 dark:text-zinc-300">{condition.comprovante}</dd></div>}</dl><ConditionReadDetails condition={condition} />{condition.status !== 'Cumprida' && condition.status !== 'Dispensada' && <button type="button" aria-busy={fulfillConditionMutation.isPending && fulfillConditionMutation.variables?.id === condition.id} disabled={fulfillConditionMutation.isPending} onClick={() => fulfillConditionMutation.mutate(condition)} className={cn(secondarySmallActionButtonClass, 'license-action license-tone-success mt-4')}><CheckCircle aria-hidden="true" className="h-4 w-4" />{fulfillConditionMutation.isPending && fulfillConditionMutation.variables?.id === condition.id ? 'Registrando cumprimento…' : 'Marcar como cumprida'}</button>}</article>)}</div>}
      </section>

      <section id="license-panel-documents" role="tabpanel" aria-labelledby="license-tab-documents" hidden={activeTab !== 'documents'} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><FolderOpen aria-hidden="true" className="h-9 w-9 text-blue-600 dark:text-blue-300" /><h2 className="mt-3 text-lg font-semibold text-zinc-950 dark:text-white">Documentos da licença</h2><p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">Os documentos permanecem vinculados ao projeto para preservar a organização de pastas e backups do GeoGestor.</p><Link to={appLinks.projectSection(license.projetoId, 'documentos')} className={cn(primaryActionButtonClass, 'mt-5 inline-flex w-fit gap-2 px-4 py-2.5 text-sm')}><FolderOpen aria-hidden="true" className="h-4 w-4" />Abrir documentos do projeto</Link></section>

      <section id="license-panel-history" role="tabpanel" aria-labelledby="license-tab-history" hidden={activeTab !== 'history'}><div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Histórico do processo</h2>{!license.history.length ? <div className="py-12 text-center"><Note aria-hidden="true" className="mx-auto mb-2 h-9 w-9 text-zinc-300" /><p className="text-sm text-zinc-500">Nenhum andamento vinculado a este projeto.</p></div> : <ol className="mt-6 space-y-5 border-l border-zinc-200 pl-6 dark:border-zinc-700">{license.history.map((item) => <li key={item.id} className="relative"><span aria-hidden="true" className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 dark:border-zinc-900" /><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{item.titulo || item.tipo}</h3><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{item.categoria || item.tipo}</span></div><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{item.descricao}</p><time dateTime={item.data} className="mt-2 flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400"><CalendarBlank aria-hidden="true" className="h-3.5 w-3.5" />{formatDate(item.data)}</time></li>)}</ol>}</div></section>

      <LicenseFormModal isOpen={showLicenseForm} onClose={() => !updateLicenseMutation.isPending && setShowLicenseForm(false)} license={license} loading={updateLicenseMutation.isPending} onSubmit={(payload) => updateLicenseMutation.mutateAsync(payload).then(() => undefined)} />
      <ConditionFormModal isOpen={showConditionForm} onClose={() => !saveConditionMutation.isPending && setShowConditionForm(false)} condition={editingCondition} loading={saveConditionMutation.isPending} onSubmit={(payload) => saveConditionMutation.mutateAsync(payload).then(() => undefined)} />
      <ConfirmDialog isOpen={Boolean(deleteCondition)} onClose={() => setDeleteCondition(null)} onConfirm={() => { if (deleteCondition) deleteConditionMutation.mutate(deleteCondition.id); }} loading={deleteConditionMutation.isPending} title="Excluir condicionante?" description={`A condicionante “${deleteCondition?.titulo || ''}” será removida. Esta ação não pode ser desfeita.`} confirmText="Excluir condicionante" />
      <ConfirmDialog isOpen={confirmDeleteLicense} onClose={() => setConfirmDeleteLicense(false)} onConfirm={() => deleteLicenseMutation.mutate()} loading={deleteLicenseMutation.isPending} title="Excluir licença ambiental?" description={`A licença “${license.numero}” será removida da operação. Revise suas condicionantes e documentos antes de continuar.`} confirmText="Excluir licença" />
    </div></Layout>
  );
}
