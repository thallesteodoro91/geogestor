import { type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileText, SuitcaseRolling, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import { DatePickerField } from '../../components/Form';
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
const fieldClass = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300';

function PageFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

type AuxiliaryTab = 'viagens' | 'fiscal' | 'diagnostico';

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
  const [travelForm, setTravelForm] = useState({
    clienteId: '', projetoId: '', finalidade: '', destino: '', dataInicio: '',
    dataFim: '', responsavel: '', adiantamento: '', quilometragem: '', valorReembolsavel: ''
  });
  const [fiscalForm, setFiscalForm] = useState({
    clienteId: '', projetoId: '', numero: '', codigoVerificacao: '', dataEmissao: '',
    valor: '', municipio: '', link: ''
  });

  const { data: viagens = [], isLoading: loadingTravels } = useQuery<Travel[]>({
    queryKey: ['viagens'],
    queryFn: () => apiClient.get('/api/financeiro/viagens')
  });
  const { data: notes = [], isLoading: loadingNotes } = useQuery<FiscalNoteRow[]>({
    queryKey: ['notas-fiscais'],
    queryFn: () => apiClient.get('/api/financeiro/notas-fiscais')
  });
  const { data: diagnostic, refetch: refetchDiagnostic, isFetching: loadingDiagnostic } = useQuery<LinkDiagnostic>({
    queryKey: ['financeiro-diagnostico-vinculos'],
    queryFn: () => apiClient.get('/api/financeiro/diagnostico-vinculos'),
    enabled: activeTab === 'diagnostico'
  });
  const createTravel = useMutation({
    mutationFn: () => apiClient.post('/api/financeiro/viagens', {
      ...travelForm,
      clienteId: travelForm.clienteId || null,
      projetoId: travelForm.projetoId || null,
      dataFim: travelForm.dataFim || null,
      responsavel: travelForm.responsavel || null,
      adiantamento: toCents(travelForm.adiantamento),
      quilometragem: Number(travelForm.quilometragem.replace(',', '.')) || 0,
      valorReembolsavel: toCents(travelForm.valorReembolsavel)
    }),
    onSuccess: async () => {
      setTravelModal(false);
      setTravelForm({ clienteId: '', projetoId: '', finalidade: '', destino: '', dataInicio: '', dataFim: '', responsavel: '', adiantamento: '', quilometragem: '', valorReembolsavel: '' });
      await invalidateFinancialQueries(queryClient);
      toast.success('Viagem registrada.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a viagem.')
  });

  const createFiscalNote = useMutation({
    mutationFn: () => apiClient.post('/api/financeiro/notas-fiscais', {
      ...fiscalForm,
      clienteId: fiscalForm.clienteId,
      projetoId: fiscalForm.projetoId || null,
      codigoVerificacao: fiscalForm.codigoVerificacao || null,
      valor: toCents(fiscalForm.valor),
      municipio: fiscalForm.municipio || null,
      link: fiscalForm.link || null
    }),
    onSuccess: async () => {
      setFiscalModal(false);
      setFiscalForm({ clienteId: '', projetoId: '', numero: '', codigoVerificacao: '', dataEmissao: '', valor: '', municipio: '', link: '' });
      await invalidateFinancialQueries(queryClient);
      toast.success('Documento fiscal informado.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o documento fiscal.')
  });

  const closeTravel = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/financeiro/viagens/${id}`, { status: 'encerrada' }),
    onSuccess: async () => {
      await invalidateFinancialQueries(queryClient);
      toast.success('Prestação de contas encerrada.');
    }
  });

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
            type="button"
            role="tab"
            aria-selected={activeTab === id}
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
        <section aria-labelledby="travel-heading">
          <h2 id="travel-heading" className="sr-only">Viagens e prestação de contas</h2>
          {loadingTravels ? <p className="text-sm text-zinc-500">Carregando viagens…</p> : viagens.length === 0 ? (
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
                      <p className="mt-1 text-sm text-zinc-500">{travel.destino} · {travel.dataInicio}{travel.dataFim ? ` a ${travel.dataFim}` : ''}</p>
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
                    <button type="button" onClick={() => closeTravel.mutate(travel.id)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <CheckCircle aria-hidden="true" /> Encerrar prestação
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'fiscal' && (
        <section aria-labelledby="fiscal-heading">
          <h2 id="fiscal-heading" className="sr-only">Documentos fiscais informados</h2>
          <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/20">
            O GeoGestor apenas registra os dados informados. Ele não emite NFS-e e não calcula tributos.
          </div>
          {loadingNotes ? <p className="text-sm text-zinc-500">Carregando documentos…</p> : notes.length === 0 ? (
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
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{nota.dataEmissao}</td>
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
        <section aria-labelledby="diagnostic-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div><h2 id="diagnostic-heading" className="text-xl font-semibold text-zinc-950 dark:text-white">Integridade dos vínculos</h2><p className="mt-1 text-sm text-zinc-500">O diagnóstico não altera os registros.</p></div>
            <button type="button" onClick={() => refetchDiagnostic()} className="min-h-10 rounded-xl border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-700 dark:hover:bg-zinc-800">Executar novamente</button>
          </div>
          {loadingDiagnostic ? <p className="text-sm text-zinc-500">Verificando vínculos…</p> : diagnostic && (
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

      <Modal isOpen={travelModal} onClose={() => setTravelModal(false)} title="Nova viagem" maxWidth="max-w-2xl">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createTravel.mutate(); }}>
          <label><span className={labelClass}>Cliente</span><RemoteCombobox<ClientOption> id="travel-client" name="clienteId" endpoint="/api/clientes/options" value={travelForm.clienteId} emptyLabel="Administrativo/geral" onChange={(clienteId) => setTravelForm((current) => ({ ...current, clienteId, projetoId: '' }))} /></label>
          <label><span className={labelClass}>Projeto</span><RemoteCombobox<ProjectOption> id="travel-project" name="projetoId" endpoint={`/api/projetos/options${travelForm.clienteId ? `?clienteId=${encodeURIComponent(travelForm.clienteId)}` : ''}`} value={travelForm.projetoId} emptyLabel="Sem projeto" onChange={(projetoId) => setTravelForm((current) => ({ ...current, projetoId }))} /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Finalidade</span><input required className={fieldClass} value={travelForm.finalidade} onChange={(event) => setTravelForm({ ...travelForm, finalidade: event.target.value })} /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Destino</span><input required className={fieldClass} value={travelForm.destino} onChange={(event) => setTravelForm({ ...travelForm, destino: event.target.value })} /></label>
          <div><label htmlFor="travel-start-date" className={labelClass}>Início</label><DatePickerField id="travel-start-date" name="dataInicio" required autoComplete="off" value={travelForm.dataInicio} onChange={(event) => setTravelForm({ ...travelForm, dataInicio: event.target.value })} className={fieldClass} /></div>
          <div><label htmlFor="travel-end-date" className={labelClass}>Término</label><DatePickerField id="travel-end-date" name="dataFim" autoComplete="off" value={travelForm.dataFim} onChange={(event) => setTravelForm({ ...travelForm, dataFim: event.target.value })} className={fieldClass} /></div>
          <label><span className={labelClass}>Responsável</span><input className={fieldClass} value={travelForm.responsavel} onChange={(event) => setTravelForm({ ...travelForm, responsavel: event.target.value })} /></label>
          <label><span className={labelClass}>Adiantamento (R$)</span><input inputMode="decimal" className={fieldClass} value={travelForm.adiantamento} onChange={(event) => setTravelForm({ ...travelForm, adiantamento: event.target.value })} /></label>
          <label><span className={labelClass}>Quilometragem</span><input inputMode="decimal" className={fieldClass} value={travelForm.quilometragem} onChange={(event) => setTravelForm({ ...travelForm, quilometragem: event.target.value })} /></label>
          <label><span className={labelClass}>Valor reembolsável (R$)</span><input inputMode="decimal" className={fieldClass} value={travelForm.valorReembolsavel} onChange={(event) => setTravelForm({ ...travelForm, valorReembolsavel: event.target.value })} /></label>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-3"><button type="button" onClick={() => setTravelModal(false)} className="min-h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold dark:border-zinc-700">Cancelar</button><button disabled={createTravel.isPending} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{createTravel.isPending ? 'Salvando…' : 'Salvar viagem'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={fiscalModal} onClose={() => setFiscalModal(false)} title="Informar documento fiscal" maxWidth="max-w-2xl">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createFiscalNote.mutate(); }}>
          <label><span className={labelClass}>Cliente</span><RemoteCombobox<ClientOption> id="fiscal-client" name="clienteId" endpoint="/api/clientes/options" value={fiscalForm.clienteId} required onChange={(clienteId) => setFiscalForm((current) => ({ ...current, clienteId, projetoId: '' }))} /></label>
          <label><span className={labelClass}>Projeto</span><RemoteCombobox<ProjectOption> id="fiscal-project" name="projetoId" endpoint={`/api/projetos/options${fiscalForm.clienteId ? `?clienteId=${encodeURIComponent(fiscalForm.clienteId)}` : ''}`} value={fiscalForm.projetoId} emptyLabel="Sem projeto" onChange={(projetoId) => setFiscalForm((current) => ({ ...current, projetoId }))} /></label>
          <label><span className={labelClass}>Número</span><input required className={fieldClass} value={fiscalForm.numero} onChange={(event) => setFiscalForm({ ...fiscalForm, numero: event.target.value })} /></label>
          <label><span className={labelClass}>Código de verificação</span><input className={fieldClass} value={fiscalForm.codigoVerificacao} onChange={(event) => setFiscalForm({ ...fiscalForm, codigoVerificacao: event.target.value })} /></label>
          <div><label htmlFor="fiscal-issue-date" className={labelClass}>Data de emissão</label><DatePickerField id="fiscal-issue-date" name="dataEmissao" required autoComplete="off" value={fiscalForm.dataEmissao} onChange={(event) => setFiscalForm({ ...fiscalForm, dataEmissao: event.target.value })} className={fieldClass} /></div>
          <label><span className={labelClass}>Valor (R$)</span><input required inputMode="decimal" className={fieldClass} value={fiscalForm.valor} onChange={(event) => setFiscalForm({ ...fiscalForm, valor: event.target.value })} /></label>
          <label><span className={labelClass}>Município</span><input className={fieldClass} value={fiscalForm.municipio} onChange={(event) => setFiscalForm({ ...fiscalForm, municipio: event.target.value })} /></label>
          <label><span className={labelClass}>Link de consulta</span><input type="url" className={fieldClass} value={fiscalForm.link} onChange={(event) => setFiscalForm({ ...fiscalForm, link: event.target.value })} /></label>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-3"><button type="button" onClick={() => setFiscalModal(false)} className="min-h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold dark:border-zinc-700">Cancelar</button><button disabled={createFiscalNote.isPending} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{createFiscalNote.isPending ? 'Salvando…' : 'Salvar documento'}</button></div>
        </form>
      </Modal>
    </PageFrame>
  );
}
