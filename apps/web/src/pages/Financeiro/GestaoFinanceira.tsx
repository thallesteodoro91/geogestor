import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileText, SuitcaseRolling, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import { DatePickerField, FormError, FormField } from '../../components/Form';
import { useFormDraftGuard } from '../../hooks/useFormDraftGuard';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import { formatDateKey } from '../../utils/localDate';
import { apiClient } from '../../services/apiClient';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';

type ClientOption = { id: string; nome: string };
type ProjectOption = { id: string; nome: string; clienteId?: string | null };

type Travel = {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  finalidade: string;
  destino: string;
  dataInicio: string;
  dataFim?: string | null;
  responsavel?: string | null;
  adiantamento: number;
  quilometragem: number;
  valorReembolsavel: number;
  status: string;
  totalGasto: number;
  saldoPrestacao: number;
  despesasQuantidade: number;
};

type FiscalNoteRow = {
  nota: {
    id: string;
    numero: string;
    dataEmissao: string;
    valor: number;
    status: string;
    municipio?: string | null;
    codigoVerificacao?: string | null;
  };
  clienteNome: string;
  projetoNome?: string | null;
  orcamentoCodigo?: string | null;
};

type LinkDiagnostic = {
  geradoEm: string;
  somenteDiagnostico: boolean;
  totais: Record<string, number>;
  orientacoes: Record<string, string>;
};

const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);

const toCents = (value: string) => Math.round((Number(value.replace(',', '.')) || 0) * 100);
const fieldClass = geoFieldClass + ' min-h-11 w-full min-w-0 px-3 text-sm';
const initialTravel = { clienteId: '', projetoId: '', finalidade: '', destino: '', dataInicio: '', dataFim: '', responsavel: '', adiantamento: '', quilometragem: '', valorReembolsavel: '' };
const initialFiscal = { clienteId: '', projetoId: '', numero: '', codigoVerificacao: '', dataEmissao: '', valor: '', municipio: '', link: '' };
const failureMessage = (action: string) => 'Não foi possível ' + action + '. Seus dados foram preservados. Tente novamente.';
function focusInvalid(errors: Record<string, string>) { requestAnimationFrame(() => { const target = document.getElementById(Object.keys(errors)[0]); target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'center', behavior: 'instant' }); }); }

function PageFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

type AuxiliaryTab = 'viagens' | 'fiscal' | 'diagnostico';
const auxiliaryTabIds: AuxiliaryTab[] = ['viagens', 'fiscal', 'diagnostico'];

export function GestaoFinanceira({
  embedded = false,
  initialTab = 'viagens',
  openCreateOnMount = false
}: {
  embedded?: boolean;
  initialTab?: AuxiliaryTab;
  openCreateOnMount?: boolean;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AuxiliaryTab>(initialTab);
  const [travelModal, setTravelModal] = useState(openCreateOnMount && initialTab === 'viagens');
  const [fiscalModal, setFiscalModal] = useState(openCreateOnMount && initialTab === 'fiscal');
  const [travelForm, setTravelForm] = useState(initialTravel);
  const [fiscalForm, setFiscalForm] = useState(initialFiscal);
  const [travelError, setTravelError] = useState('');
  const [fiscalError, setFiscalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const travelLock = useRef(false), fiscalLock = useRef(false);
  const closingIds = useRef(new Set<string>());
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({});
  const travelsQuery = useQuery<Travel[]>({ queryKey: ['viagens'], queryFn: () => apiClient.get('/api/financeiro/viagens') });
  const notesQuery = useQuery<FiscalNoteRow[]>({ queryKey: ['notas-fiscais'], queryFn: () => apiClient.get('/api/financeiro/notas-fiscais') });
  const diagnosticQuery = useQuery<LinkDiagnostic>({ queryKey: ['financeiro-diagnostico-vinculos'], queryFn: () => apiClient.get('/api/financeiro/diagnostico-vinculos'), enabled: activeTab === 'diagnostico' });
  const viagens = travelsQuery.data ?? [], notes = notesQuery.data ?? [], diagnostic = diagnosticQuery.data;
  const createTravel = useMutation({
    mutationFn: async (draft: typeof initialTravel) => {
      const result = await apiClient.post<{ id: string }>('/api/financeiro/viagens', {
        ...draft, clienteId: draft.clienteId || null, projetoId: draft.projetoId || null, dataFim: draft.dataFim || null,
        responsavel: draft.responsavel || null, adiantamento: toCents(draft.adiantamento),
        quilometragem: Number(draft.quilometragem.replace(',', '.')) || 0, valorReembolsavel: toCents(draft.valorReembolsavel)
      });
      if (!result?.id) throw new Error('Resposta incompleta do serviço local.');
      return result;
    },
    onSuccess: () => { setTravelModal(false); setTravelForm(initialTravel); setTravelError(''); void invalidateFinancialQueries(queryClient); toast.success('Viagem registrada.'); },
    onError: () => setTravelError(failureMessage('registrar a viagem')),
    onSettled: () => { travelLock.current = false; }
  });
  const createFiscalNote = useMutation({
    mutationFn: async (draft: typeof initialFiscal) => {
      const result = await apiClient.post<{ id: string }>('/api/financeiro/notas-fiscais', {
        ...draft, projetoId: draft.projetoId || null, codigoVerificacao: draft.codigoVerificacao || null,
        valor: toCents(draft.valor), municipio: draft.municipio || null, link: draft.link || null
      });
      if (!result?.id) throw new Error('Resposta incompleta do serviço local.');
      return result;
    },
    onSuccess: () => { setFiscalModal(false); setFiscalForm(initialFiscal); setFiscalError(''); void invalidateFinancialQueries(queryClient); toast.success('Documento fiscal informado.'); },
    onError: () => setFiscalError(failureMessage('registrar o documento fiscal')),
    onSettled: () => { fiscalLock.current = false; }
  });
  const closeTravel = async (id: string) => {
    if (closingIds.current.has(id)) return;
    closingIds.current.add(id); setClosing(new Set(closingIds.current));
    setCloseErrors(current => ({ ...current, [id]: '' }));
    try {
      const result = await apiClient.patch<{ id: string; status: string }>('/api/financeiro/viagens/' + id, { status: 'encerrada' });
      if (result?.id !== id || result.status !== 'encerrada') throw new Error('Resposta incompleta do serviço local.');
      void invalidateFinancialQueries(queryClient); toast.success('Prestação de contas encerrada.');
    } catch { setCloseErrors(current => ({ ...current, [id]: 'Não foi possível encerrar a prestação. O registro foi preservado. Tente novamente.' })); }
    finally { closingIds.current.delete(id); setClosing(new Set(closingIds.current)); }
  };
  const draftGuard = useFormDraftGuard({
    open: travelModal || fiscalModal,
    dirty: travelModal ? JSON.stringify(travelForm) !== JSON.stringify(initialTravel) : JSON.stringify(fiscalForm) !== JSON.stringify(initialFiscal),
    saving: createTravel.isPending || createFiscalNote.isPending, lock: travelModal ? travelLock : fiscalLock,
    onDiscard: () => { setTravelModal(false); setFiscalModal(false); setTravelForm(initialTravel); setFiscalForm(initialFiscal); setTravelError(''); setFiscalError(''); setFieldErrors({}); }
  });
  const submitTravel = () => {
    if (travelLock.current) return;
    const errors: Record<string, string> = {};
    if (!travelForm.finalidade.trim()) errors['travel-purpose'] = 'Informe a finalidade da viagem.';
    if (!travelForm.destino.trim()) errors['travel-destination'] = 'Informe o destino da viagem.';
    if (!travelForm.dataInicio) errors['travel-start-date'] = 'Selecione a data de início.';
    if (travelForm.dataFim && travelForm.dataInicio && travelForm.dataFim < travelForm.dataInicio) errors['travel-end-date'] = 'O término não pode ser anterior ao início.';
    setFieldErrors(errors); if (Object.keys(errors).length) { setTravelError('Revise os campos destacados antes de salvar.'); focusInvalid(errors); return; }
    travelLock.current = true; setTravelError(''); createTravel.mutate({ ...travelForm });
  };
  const submitFiscal = () => {
    if (fiscalLock.current) return;
    const errors: Record<string, string> = {};
    if (!fiscalForm.clienteId) errors['fiscal-client'] = 'Selecione um cliente.';
    if (!fiscalForm.numero.trim()) errors['fiscal-number'] = 'Informe o número do documento.';
    if (!fiscalForm.dataEmissao) errors['fiscal-issue-date'] = 'Selecione a data de emissão.';
    if (!fiscalForm.valor.trim() || toCents(fiscalForm.valor) <= 0) errors['fiscal-value'] = 'Informe um valor maior que zero.';
    if (fiscalForm.link && !/^https?:\/\//i.test(fiscalForm.link)) errors['fiscal-link'] = 'Informe um endereço iniciado por http:// ou https://.';
    setFieldErrors(errors); if (Object.keys(errors).length) { setFiscalError('Revise os campos destacados antes de salvar.'); focusInvalid(errors); return; }
    fiscalLock.current = true; setFiscalError(''); createFiscalNote.mutate({ ...fiscalForm });
  };
  const errorProps = (id: string) => ({ 'aria-invalid': Boolean(fieldErrors[id]), 'aria-describedby': fieldErrors[id] ? id + '-error' : undefined });
  const loadError = (message: string, refetch: () => unknown, busy: boolean) => <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"><span>{message}</span><button type="button" disabled={busy} onClick={() => void refetch()} className={secondarySmallActionButtonClass}>{busy ? 'Tentando novamente…' : 'Tentar novamente'}</button></div>;

  const handleAuxiliaryTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: AuxiliaryTab) => {
    let nextIndex: number | null = null;
    const currentIndex = auxiliaryTabIds.indexOf(current);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % auxiliaryTabIds.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + auxiliaryTabIds.length) % auxiliaryTabIds.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = auxiliaryTabIds.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = auxiliaryTabIds[nextIndex];
    setActiveTab(nextTab);
    document.getElementById(`auxiliary-tab-${nextTab}`)?.focus();
  };

  return (
    <PageFrame embedded={embedded}>
      <div className={embedded ? 'mb-8' : 'mb-10'}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Gestão operacional</p>
        <h1 className={`${embedded ? 'text-3xl' : 'text-4xl'} font-semibold tracking-tight text-zinc-950 dark:text-white`}>Viagens e notas fiscais</h1>
        <p className="mt-2 max-w-none text-sm text-zinc-500 xl:whitespace-nowrap dark:text-zinc-400">
          Viagens, documentos fiscais informados e integridade dos vínculos. Esta área não realiza apuração tributária nem substitui a contabilidade.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Controles financeiros auxiliares">
        {([
          ['viagens', 'Viagens e prestação'],
          ['fiscal', 'Documentos fiscais'],
          ['diagnostico', 'Diagnóstico de vínculos']
        ] as const).map(([id, label]) => (
          <button
            key={id}
            id={`auxiliary-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`auxiliary-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onKeyDown={(event) => handleAuxiliaryTabKeyDown(event, id)}
            onClick={() => setActiveTab(id)}
            className={`min-h-10 rounded-xl px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
              activeTab === id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'viagens' && (
        <section id="auxiliary-panel-viagens" role="tabpanel" aria-labelledby="auxiliary-tab-viagens" tabIndex={0}>
          <h2 id="travel-heading" className="sr-only">Viagens e prestação de contas</h2>
          {travelsQuery.isError && loadError(viagens.length ? 'Não foi possível atualizar as viagens. Os dados anteriores foram preservados.' : 'Não foi possível carregar as viagens.', travelsQuery.refetch, travelsQuery.isFetching)}
          {travelsQuery.isLoading ? <p className="text-sm text-zinc-500">Carregando viagens…</p> : !travelsQuery.isError && viagens.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <SuitcaseRolling className="mx-auto mb-3 h-9 w-9 text-zinc-400" aria-hidden="true" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">Nenhuma viagem registrada</p>
              <p className="mt-1 text-sm text-zinc-500">Crie uma viagem e vincule as despesas durante a prestação de contas.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {viagens.map((travel) => (
                <article key={travel.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-zinc-950 dark:text-white">{travel.finalidade}</p>
                      <p className="mt-1 text-sm text-zinc-500">{travel.destino} · {formatDateKey(travel.dataInicio)}{travel.dataFim ? ` a ${formatDateKey(travel.dataFim)}` : ''}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{travel.status.replaceAll('_', ' ')}</span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-zinc-500">Cliente/projeto</dt><dd className="mt-1 font-medium text-zinc-800 dark:text-zinc-100">{travel.clienteNome || 'Administrativo'}{travel.projetoNome ? ` · ${travel.projetoNome}` : ''}</dd></div>
                    <div><dt className="text-zinc-500">Despesas</dt><dd className="mt-1 font-medium text-zinc-800 dark:text-zinc-100">{money(travel.totalGasto)} · {travel.despesasQuantidade} lançamento(s)</dd></div>
                    <div><dt className="text-zinc-500">Adiantamento</dt><dd className="mt-1 font-medium text-zinc-800 dark:text-zinc-100">{money(travel.adiantamento)}</dd></div>
                    <div><dt className="text-zinc-500">Saldo da prestação</dt><dd className={`mt-1 font-semibold ${travel.saldoPrestacao < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(travel.saldoPrestacao)}</dd></div>
                  </dl>
                  {travel.status !== 'encerrada' && (
                    <button type="button" disabled={closing.has(travel.id)} aria-busy={closing.has(travel.id)} onClick={() => void closeTravel(travel.id)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <CheckCircle aria-hidden="true" /> <span className="inline-grid"><span aria-hidden="true" className="invisible col-start-1 row-start-1">Encerrando prestação…</span><span className="col-start-1 row-start-1">{closing.has(travel.id) ? 'Encerrando prestação…' : 'Encerrar prestação'}</span></span>
                    </button>
                  )}
                  {closeErrors[travel.id] && <FormError message={closeErrors[travel.id]} className="mt-3" />}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'fiscal' && (
        <section id="auxiliary-panel-fiscal" role="tabpanel" aria-labelledby="auxiliary-tab-fiscal" tabIndex={0}>
          <h2 id="fiscal-heading" className="sr-only">Documentos fiscais informados</h2>
          <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/20">
            O GeoGestor apenas registra os dados informados. Ele não emite NFS-e e não calcula tributos.
          </div>
          {notesQuery.isError && loadError(notes.length ? 'Não foi possível atualizar os documentos fiscais. Os dados anteriores foram preservados.' : 'Não foi possível carregar os documentos fiscais.', notesQuery.refetch, notesQuery.isFetching)}
          {notesQuery.isLoading ? <p className="text-sm text-zinc-500">Carregando documentos…</p> : !notesQuery.isError && notes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <FileText className="mx-auto mb-3 h-9 w-9 text-zinc-400" aria-hidden="true" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">Nenhum documento fiscal informado</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <tr><th className="px-5 py-4">Número</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Emissão</th><th className="px-5 py-4">Valor</th><th className="px-5 py-4">Situação</th></tr>
                </thead>
                <tbody>
                  {notes.map(({ nota, clienteNome }) => (
                    <tr key={nota.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
                      <td className="px-5 py-4 font-semibold text-zinc-900 dark:text-zinc-100">{nota.numero}</td>
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{clienteNome}</td>
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{formatDateKey(nota.dataEmissao)}</td>
                      <td className="px-5 py-4 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{money(nota.valor)}</td>
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{nota.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'diagnostico' && (
        <section id="auxiliary-panel-diagnostico" role="tabpanel" aria-labelledby="auxiliary-tab-diagnostico" tabIndex={0}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div><h2 id="diagnostic-heading" className="text-xl font-semibold text-zinc-950 dark:text-white">Integridade dos vínculos</h2><p className="mt-1 text-sm text-zinc-500">O diagnóstico não altera os registros.</p></div>
            <button type="button" disabled={diagnosticQuery.isFetching} onClick={() => void diagnosticQuery.refetch()} className="min-h-10 rounded-xl border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-700 dark:hover:bg-zinc-800">Executar novamente</button>
          </div>
          {diagnosticQuery.isError && loadError(diagnostic ? 'Não foi possível atualizar o diagnóstico. Os dados anteriores foram preservados.' : 'Não foi possível consultar os vínculos.', diagnosticQuery.refetch, diagnosticQuery.isFetching)}
          {diagnosticQuery.isLoading ? <p className="text-sm text-zinc-500">Verificando vínculos…</p> : diagnostic && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(diagnostic.totais).map(([key, value]) => (
                <article key={key} className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
                  <div className="flex items-center gap-2">
                    {value > 0 ? <WarningCircle className="text-amber-600" aria-hidden="true" /> : <CheckCircle className="text-emerald-600" aria-hidden="true" />}
                    <span className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-zinc-700 dark:text-zinc-200">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{diagnostic.orientacoes?.[key]}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal isOpen={travelModal} onClose={draftGuard.requestClose} title="Nova viagem" maxWidth="max-w-2xl" initialFocusId="travel-purpose" closeDisabled={createTravel.isPending}
        footer={<div className="space-y-3"><FormError message={travelError} /><div className="grid grid-cols-2 gap-3"><button type="button" disabled={createTravel.isPending} onClick={draftGuard.requestClose} className={secondarySmallActionButtonClass}>Cancelar</button><button type="submit" form="travel-form" disabled={createTravel.isPending} aria-busy={createTravel.isPending} className={primarySubmitButtonClass}><span className="inline-grid"><span aria-hidden="true" className="invisible col-start-1 row-start-1">Salvar viagem</span><span className="col-start-1 row-start-1">{createTravel.isPending ? 'Salvando…' : 'Salvar viagem'}</span></span></button></div></div>}>
        <p className="mb-5 text-xs text-text-secondary">Campos com * são obrigatórios. Os demais são opcionais.</p>
        <form id="travel-form" noValidate onSubmit={event => { event.preventDefault(); submitTravel(); }}>
          <fieldset disabled={createTravel.isPending} className="m-0 grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
            <FormField htmlFor="travel-client" label="Cliente — opcional"><RemoteCombobox<ClientOption> id="travel-client" name="clienteId" endpoint="/api/clientes/options" value={travelForm.clienteId} emptyLabel="Administrativo/geral" fill density="form" inModal disabled={createTravel.isPending} onChange={clienteId => setTravelForm(current => ({ ...current, clienteId, projetoId: '' }))} /></FormField>
            <FormField htmlFor="travel-project" label="Projeto — opcional"><RemoteCombobox<ProjectOption> id="travel-project" name="projetoId" endpoint={'/api/projetos/options' + (travelForm.clienteId ? '?clienteId=' + encodeURIComponent(travelForm.clienteId) : '')} value={travelForm.projetoId} emptyLabel="Sem projeto" fill density="form" inModal disabled={createTravel.isPending} onChange={projetoId => setTravelForm(current => ({ ...current, projetoId }))} /></FormField>
            <FormField htmlFor="travel-purpose" label="Finalidade" required error={fieldErrors['travel-purpose']} className="sm:col-span-2"><input id="travel-purpose" name="finalidade" required maxLength={300} autoComplete="off" className={fieldClass} value={travelForm.finalidade} onChange={event => setTravelForm({ ...travelForm, finalidade: event.target.value })} {...errorProps('travel-purpose')} /></FormField>
            <FormField htmlFor="travel-destination" label="Destino" required error={fieldErrors['travel-destination']} className="sm:col-span-2"><input id="travel-destination" name="destino" required maxLength={300} autoComplete="off" className={fieldClass} value={travelForm.destino} onChange={event => setTravelForm({ ...travelForm, destino: event.target.value })} {...errorProps('travel-destination')} /></FormField>
            <FormField htmlFor="travel-start-date" label="Início" required error={fieldErrors['travel-start-date']}><DatePickerField id="travel-start-date" name="dataInicio" required disabled={createTravel.isPending} autoComplete="off" value={travelForm.dataInicio} onChange={event => setTravelForm({ ...travelForm, dataInicio: event.target.value })} className={fieldClass} {...errorProps('travel-start-date')} /></FormField>
            <FormField htmlFor="travel-end-date" label="Término — opcional" error={fieldErrors['travel-end-date']}><DatePickerField id="travel-end-date" name="dataFim" disabled={createTravel.isPending} autoComplete="off" value={travelForm.dataFim} onChange={event => setTravelForm({ ...travelForm, dataFim: event.target.value })} className={fieldClass} {...errorProps('travel-end-date')} /></FormField>
            <FormField htmlFor="travel-owner" label="Responsável — opcional"><input id="travel-owner" name="responsavel" maxLength={200} autoComplete="off" className={fieldClass} value={travelForm.responsavel} onChange={event => setTravelForm({ ...travelForm, responsavel: event.target.value })} /></FormField>
            <FormField htmlFor="travel-advance" label="Adiantamento (R$) — opcional"><input id="travel-advance" name="adiantamento" inputMode="decimal" autoComplete="off" className={fieldClass + ' max-w-[16rem] tabular-nums'} value={travelForm.adiantamento} onChange={event => setTravelForm({ ...travelForm, adiantamento: event.target.value })} /></FormField>
            <FormField htmlFor="travel-distance" label="Quilometragem — opcional"><input id="travel-distance" name="quilometragem" inputMode="decimal" autoComplete="off" className={fieldClass + ' max-w-[12rem] tabular-nums'} value={travelForm.quilometragem} onChange={event => setTravelForm({ ...travelForm, quilometragem: event.target.value })} /></FormField>
            <FormField htmlFor="travel-refundable" label="Valor reembolsável (R$) — opcional"><input id="travel-refundable" name="valorReembolsavel" inputMode="decimal" autoComplete="off" className={fieldClass + ' max-w-[16rem] tabular-nums'} value={travelForm.valorReembolsavel} onChange={event => setTravelForm({ ...travelForm, valorReembolsavel: event.target.value })} /></FormField>
          </fieldset>
        </form>
      </Modal>
      <Modal isOpen={fiscalModal} onClose={draftGuard.requestClose} title="Informar documento fiscal" maxWidth="max-w-2xl" initialFocusId="fiscal-client" closeDisabled={createFiscalNote.isPending}
        footer={<div className="space-y-3"><FormError message={fiscalError} /><div className="grid grid-cols-2 gap-3"><button type="button" disabled={createFiscalNote.isPending} onClick={draftGuard.requestClose} className={secondarySmallActionButtonClass}>Cancelar</button><button type="submit" form="fiscal-form" disabled={createFiscalNote.isPending} aria-busy={createFiscalNote.isPending} className={primarySubmitButtonClass}><span className="inline-grid"><span aria-hidden="true" className="invisible col-start-1 row-start-1">Salvar documento</span><span className="col-start-1 row-start-1">{createFiscalNote.isPending ? 'Salvando…' : 'Salvar documento'}</span></span></button></div></div>}>
        <p className="mb-5 text-xs text-text-secondary">Campos com * são obrigatórios. Os demais são opcionais.</p>
        <form id="fiscal-form" noValidate onSubmit={event => { event.preventDefault(); submitFiscal(); }}>
          <fieldset disabled={createFiscalNote.isPending} className="m-0 grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
            <FormField htmlFor="fiscal-client" label="Cliente" required error={fieldErrors['fiscal-client']}><RemoteCombobox<ClientOption> id="fiscal-client" name="clienteId" endpoint="/api/clientes/options" value={fiscalForm.clienteId} required fill density="form" inModal disabled={createFiscalNote.isPending} onChange={clienteId => setFiscalForm(current => ({ ...current, clienteId, projetoId: '' }))} {...errorProps('fiscal-client')} /></FormField>
            <FormField htmlFor="fiscal-project" label="Projeto — opcional"><RemoteCombobox<ProjectOption> id="fiscal-project" name="projetoId" endpoint={'/api/projetos/options' + (fiscalForm.clienteId ? '?clienteId=' + encodeURIComponent(fiscalForm.clienteId) : '')} value={fiscalForm.projetoId} emptyLabel="Sem projeto" fill density="form" inModal disabled={createFiscalNote.isPending} onChange={projetoId => setFiscalForm(current => ({ ...current, projetoId }))} /></FormField>
            <FormField htmlFor="fiscal-number" label="Número do documento" required error={fieldErrors['fiscal-number']}><input id="fiscal-number" name="numero" required maxLength={100} autoComplete="off" className={fieldClass} value={fiscalForm.numero} onChange={event => setFiscalForm({ ...fiscalForm, numero: event.target.value })} {...errorProps('fiscal-number')} /></FormField>
            <FormField htmlFor="fiscal-code" label="Código de verificação — opcional"><input id="fiscal-code" name="codigoVerificacao" maxLength={200} autoComplete="off" spellCheck={false} className={fieldClass} value={fiscalForm.codigoVerificacao} onChange={event => setFiscalForm({ ...fiscalForm, codigoVerificacao: event.target.value })} /></FormField>
            <FormField htmlFor="fiscal-issue-date" label="Data de emissão" required error={fieldErrors['fiscal-issue-date']}><DatePickerField id="fiscal-issue-date" name="dataEmissao" required disabled={createFiscalNote.isPending} autoComplete="off" value={fiscalForm.dataEmissao} onChange={event => setFiscalForm({ ...fiscalForm, dataEmissao: event.target.value })} className={fieldClass} {...errorProps('fiscal-issue-date')} /></FormField>
            <FormField htmlFor="fiscal-value" label="Valor (R$)" required error={fieldErrors['fiscal-value']}><input id="fiscal-value" name="valor" required inputMode="decimal" autoComplete="off" className={fieldClass + ' max-w-[16rem] tabular-nums'} value={fiscalForm.valor} onChange={event => setFiscalForm({ ...fiscalForm, valor: event.target.value })} {...errorProps('fiscal-value')} /></FormField>
            <FormField htmlFor="fiscal-city" label="Município — opcional"><input id="fiscal-city" name="municipio" maxLength={200} autoComplete="off" className={fieldClass} value={fiscalForm.municipio} onChange={event => setFiscalForm({ ...fiscalForm, municipio: event.target.value })} /></FormField>
            <FormField htmlFor="fiscal-link" label="Link de consulta — opcional" error={fieldErrors['fiscal-link']}><input id="fiscal-link" name="link" type="url" autoComplete="off" className={fieldClass} value={fiscalForm.link} onChange={event => setFiscalForm({ ...fiscalForm, link: event.target.value })} {...errorProps('fiscal-link')} /></FormField>
          </fieldset>
        </form>
      </Modal>
      {draftGuard.confirmation}
    </PageFrame>
  );
}
