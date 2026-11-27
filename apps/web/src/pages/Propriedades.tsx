import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Buildings, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import type { PropertyPayload } from '@geogestor/contracts/src/properties';
import { Layout } from '../components/Layout';
import { useListPageNavigation, useListUrlState } from '../hooks/useListPageNavigation';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError, FormField, FormFooter, FormSection, FormSelect, NumericInput } from '../components/Form';
import { apiClient, ApiError } from '../services/apiClient';
import { RemoteCombobox } from '../components/RemoteCombobox';
import { cn } from '../utils/cn';
import { headerPrimaryActionButtonClass, headerPrimaryActionIconClass, primarySubmitButtonClass } from '../utils/actionStyles';
import { propertyFormToPayload, type PropertyFormState } from './propertyForm';
import { QuickClientModal, type CreatedProjectClient } from './Projetos/QuickClientModal';

type Client = { id: string; nome: string };
type Property = {
  editToken: string;
  id: string;
  clienteId: string;
  nome: string;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  areaHa?: number | null;
  cidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  situacaoImovel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  observacoes?: string | null;
  clienteNome?: string | null;
};
type PropertyResponse = { items: Property[]; total: number; page: number; limit: number };
const emptyForm: PropertyFormState = {
  clienteId: '', nome: '', matricula: '', car: '', ccir: '', itr: '', areaHa: '', cidade: '',
  municipio: '', uf: '', situacaoImovel: '', latitude: '', longitude: '', observacoes: ''
};
const fieldClass = 'geo-field min-h-11 w-full';
const propertyFieldLabels: Record<keyof PropertyFormState, string> = {
  clienteId: 'Cliente', nome: 'Nome do imóvel', matricula: 'Matrícula', car: 'CAR', ccir: 'CCIR', itr: 'ITR',
  areaHa: 'Área (ha)', cidade: 'Localidade ou distrito', municipio: 'Município', uf: 'UF',
  situacaoImovel: 'Situação do imóvel', latitude: 'Latitude', longitude: 'Longitude', observacoes: 'Observações'
};
const propertyFieldIds: Partial<Record<keyof PropertyFormState, string>> = {
  clienteId: 'property-client',
  nome: 'property-name',
  matricula: 'property-matricula',
  car: 'property-car',
  ccir: 'property-ccir',
  itr: 'property-itr',
  areaHa: 'property-area-ha',
  cidade: 'property-city',
  municipio: 'property-municipality',
  uf: 'property-state',
  situacaoImovel: 'property-status',
  latitude: 'property-latitude',
  longitude: 'property-longitude',
  observacoes: 'property-notes'
};

function propertyToForm(property: Property): PropertyFormState {
  return {
    clienteId: property.clienteId,
    nome: property.nome,
    matricula: property.matricula || '',
    car: property.car || '',
    ccir: property.ccir || '',
    itr: property.itr || '',
    areaHa: property.areaHa?.toString() || '',
    cidade: property.cidade || '',
    municipio: property.municipio || '',
    uf: property.uf || '',
    situacaoImovel: property.situacaoImovel || '',
    latitude: property.latitude?.toString() || '',
    longitude: property.longitude?.toString() || '',
    observacoes: property.observacoes || ''
  };
}

export function Propriedades() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const handledRouteActionRef = useRef(false);
  const routeState = location.state as { createForClienteId?: string; clientName?: string; editPropertyId?: string; clientFilterId?: string } | null;
  const listUrl = useListUrlState();
  const search = listUrl.params.get('propriedadesBusca') || '';
  const clientFilter = listUrl.params.get('propriedadesCliente') || '';
  const setSearch = (value: string) => listUrl.update({ propriedadesBusca: value, propriedadesPagina: null });
  const setClientFilter = (value: string) => listUrl.update({ propriedadesCliente: value, propriedadesPagina: null });
  const requestedPage = Number(listUrl.params.get('propriedadesPagina') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const setPage = (value: number | ((current: number) => number)) => { const next = typeof value === 'function' ? value(page) : value; listUrl.update({ propriedadesPagina: next <= 1 ? null : String(next) }); };
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<PropertyFormState>(emptyForm);
  const [initialFingerprint, setInitialFingerprint] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [propertyInitialFocusId, setPropertyInitialFocusId] = useState('property-client');
  const [selectedClientLabel, setSelectedClientLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [formError, setFormError] = useState('');
  const [currentConflict, setCurrentConflict] = useState<Property | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PropertyFormState, string>>>({});

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (search.trim()) params.set('q', search.trim());
  if (clientFilter) params.set('clienteId', clientFilter);
  const propertiesQuery = useQuery({
    queryKey: ['properties', page, search, clientFilter],
    queryFn: () => apiClient.get<PropertyResponse>('/api/dados-operacionais/propriedades?' + params.toString()),
    placeholderData: (previous) => previous
  });
  const listNavigation = useListPageNavigation({ page, resolvedPage: propertiesQuery.data?.page, ready: !propertiesQuery.isFetching && !propertiesQuery.isPlaceholderData, failed: propertiesQuery.isError, scope: [search, clientFilter].join('|') });
  const changePage = (next: number) => { listNavigation.preparePage(next); setPage(next); };
  useEffect(() => { if (!propertiesQuery.data || propertiesQuery.isFetching || propertiesQuery.isPlaceholderData || propertiesQuery.isError || page <= Math.max(1, Math.ceil(propertiesQuery.data.total / propertiesQuery.data.limit))) return; listNavigation.adjustPage(Math.max(1, Math.ceil(propertiesQuery.data.total / propertiesQuery.data.limit))); listUrl.update({ propriedadesPagina: Math.max(1, Math.ceil(propertiesQuery.data.total / propertiesQuery.data.limit)) <= 1 ? null : String(Math.max(1, Math.ceil(propertiesQuery.data.total / propertiesQuery.data.limit))) }); }, [propertiesQuery.data, propertiesQuery.isFetching, propertiesQuery.isPlaceholderData, propertiesQuery.isError, page, listUrl.update]);
  const requestedPropertyQuery = useQuery({
    queryKey: ['property', routeState?.editPropertyId],
    queryFn: () => apiClient.get<Property>(`/api/dados-operacionais/propriedades/${routeState?.editPropertyId}`),
    enabled: Boolean(routeState?.editPropertyId),
    retry: false
  });
  const firstClientQuery = useQuery<Client[]>({
    queryKey: ['property-client-first-use'],
    queryFn: () => apiClient.get<Client[]>('/api/clientes/options?limit=1'),
    staleTime: 30_000
  });

  const formFingerprint = JSON.stringify(form);
  const hasUnsavedChanges = isModalOpen && Boolean(initialFingerprint) && formFingerprint !== initialFingerprint;
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [hasUnsavedChanges]);

  const saveMutation = useMutation({
    mutationFn: (payload: PropertyPayload) => editing
      ? apiClient.patch<Property>('/api/dados-operacionais/propriedades/' + editing.id, payload, { headers: { 'if-match': editing.editToken } })
      : apiClient.post<Property>('/api/dados-operacionais/propriedades', payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['properties'] }),
        ...(editing ? [queryClient.invalidateQueries({ queryKey: ['property', editing.id] })] : []),
        queryClient.invalidateQueries({ queryKey: ['budget-options'] }),
        queryClient.invalidateQueries({ queryKey: ['remote-options'] })
      ]);
      setInitialFingerprint('');
      setModalOpen(false);
      setFormError('');
      setFieldErrors({});
      toast.success(editing ? 'Cadastro de propriedade atualizado.' : 'Cadastro de propriedade criado.');
    },
    onError: (error: Error) => setFormError(error.message || 'Não foi possível salvar a propriedade. Tente novamente.')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete('/api/dados-operacionais/propriedades/' + id, { headers: { 'if-match': deleteTarget?.editToken || '' } }),
    onSuccess: async () => {
      if ((propertiesQuery.data?.items.length || 0) === 1 && page > 1) setPage((current) => current - 1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['properties'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-options'] }),
        queryClient.invalidateQueries({ queryKey: ['remote-options'] })
      ]);
      setDeleteTarget(null);
      toast.success('Propriedade excluída.');
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível excluir a propriedade.')
  });

  const openCreate = () => {
    setCurrentConflict(null);
    const next = { ...emptyForm, clienteId: clientFilter };
    setEditing(null);
    setForm(next);
    setInitialFingerprint(JSON.stringify(next));
    setFormError('');
    setFieldErrors({});
    setSelectedClientLabel('');
    setPropertyInitialFocusId(firstClientQuery.data?.length === 0 ? 'property-add-client' : 'property-client');
    setModalOpen(true);
  };

  const openEdit = (property: Property) => {
    setCurrentConflict(null);
    const next = propertyToForm(property);
    setEditing(property);
    setForm(next);
    setInitialFingerprint(JSON.stringify(next));
    setFormError('');
    setFieldErrors({});
    setSelectedClientLabel(property.clienteNome || '');
    setPropertyInitialFocusId('property-client');
    setModalOpen(true);
  };

  useEffect(() => {
    if (handledRouteActionRef.current) return;
    if (!routeState) return;
    if (routeState.createForClienteId) {
      handledRouteActionRef.current = true;
      const next = { ...emptyForm, clienteId: routeState.createForClienteId };
      window.setTimeout(() => {
        setClientFilter(routeState.createForClienteId || '');
        setSelectedClientLabel(routeState.clientName || '');
        setEditing(null);
        setForm(next);
        setInitialFingerprint(JSON.stringify(next));
        setModalOpen(true);
        navigate(location.pathname, { replace: true, state: {} });
      }, 0);
      return;
    }
    if (routeState.editPropertyId) {
      if (requestedPropertyQuery.isLoading) return;
      handledRouteActionRef.current = true;
      if (requestedPropertyQuery.isError || !requestedPropertyQuery.data) {
        toast.error('Não foi possível abrir a propriedade solicitada. Ela pode ter sido excluída.');
        navigate(location.pathname, { replace: true, state: {} });
        return;
      }
      const property = requestedPropertyQuery.data;
      window.setTimeout(() => {
        if (routeState.clientFilterId) setClientFilter(routeState.clientFilterId);
        const next = propertyToForm(property);
        setEditing(property);
        setForm(next);
        setInitialFingerprint(JSON.stringify(next));
        setFormError('');
        setFieldErrors({});
        setSelectedClientLabel(property.clienteNome || '');
        setPropertyInitialFocusId('property-client');
        setModalOpen(true);
        navigate(location.pathname, { replace: true, state: {} });
      }, 0);
    }
  }, [location.pathname, navigate, requestedPropertyQuery.data, requestedPropertyQuery.isError, requestedPropertyQuery.isLoading, routeState]);

  const update = (field: keyof PropertyFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const closeEditor = () => {
    if (saveMutation.isPending) return;
    if (hasUnsavedChanges) setShowDiscardDialog(true);
    else setModalOpen(false);
  };

  const openQuickClient = () => {
    setPropertyInitialFocusId('property-add-client');
    setShowQuickClientModal(true);
  };

  const closeQuickClient = () => {
    setShowQuickClientModal(false);
    setPropertyInitialFocusId('property-add-client');
  };

  const selectCreatedClient = async (client: CreatedProjectClient) => {
    setForm((current) => ({ ...current, clienteId: client.id }));
    setFieldErrors((current) => ({ ...current, clienteId: undefined }));
    setSelectedClientLabel(client.nome);
    setPropertyInitialFocusId('property-client');
    setShowQuickClientModal(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['property-client-first-use'] }),
      queryClient.invalidateQueries({ queryKey: ['remote-options'] })
    ]);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const parsed = propertyFormToPayload(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof PropertyFormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof PropertyFormState;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      setFormError('Revise os campos indicados antes de salvar.');
      const firstField = parsed.error.issues[0]?.path[0] as keyof PropertyFormState | undefined;
      window.requestAnimationFrame(() => firstField && document.getElementById(propertyFieldIds[firstField] || '')?.focus());
      return;
    }
    saveMutation.mutate(parsed.data);
  };

  const items = propertiesQuery.data?.items || [];
  const total = propertiesQuery.data?.total || 0;
  const lastPage = Math.max(1, Math.ceil(total / 25));
  const hasFilters = Boolean(search.trim() || clientFilter);
  const resultLabel = useMemo(() => `${new Intl.NumberFormat('pt-BR').format(total)} ${total === 1 ? 'propriedade cadastrada' : 'propriedades cadastradas'}`, [total]);

  return (
    <Layout>
      <PageHeader
        eyebrow="Base patrimonial"
        title="Propriedades e imóveis"
        description="Cadastre o imóvel uma vez e mantenha projetos, orçamentos, documentos e mapas usando a mesma referência."
        action={<button type="button" onClick={openCreate} className={headerPrimaryActionButtonClass}><span>Novo cadastro de propriedade</span><span className={headerPrimaryActionIconClass} aria-hidden="true"><Plus className="h-4 w-4" /></span></button>}
      />

      <section aria-label="Filtros de propriedades" className="mb-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.4fr)]">
        <FormField htmlFor="property-search" label="Buscar propriedade"><div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} aria-hidden="true" /><input id="property-search" name="property_search" type="search" autoComplete="off" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, matrícula, CAR ou município…" className={cn(fieldClass, 'pl-9')} /></div></FormField>
        <FormField htmlFor="property-client-filter" label="Cliente"><RemoteCombobox<Client> id="property-client-filter" name="property_client_filter" endpoint="/api/clientes/options" value={clientFilter} onChange={(nextValue) => { setClientFilter(nextValue); setPage(1); }} placeholder="Pesquisar cliente…" emptyLabel="Todos os clientes" /></FormField>
      </section>

      <section aria-labelledby="property-list-title" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800"><h2 id="property-list-title" className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Cadastros de propriedade</h2><span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300" role="status" aria-live="polite">{resultLabel}</span></div>
        <p ref={listNavigation.resultsAnchor} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="geo-focus-ring scroll-mt-28 px-4 py-3 text-xs text-text-secondary">{propertiesQuery.data?.total ?? 0} propriedades encontradas · Página {propertiesQuery.data?.page ?? page} de {lastPage} · Intervalo {items.length ? ((propertiesQuery.data?.page ?? page) - 1) * 25 + 1 : 0}–{items.length ? ((propertiesQuery.data?.page ?? page) - 1) * 25 + items.length : 0}</p>
        {propertiesQuery.isLoading ? <p className="p-8 text-center text-sm text-zinc-600" role="status">Carregando propriedades…</p>
          : propertiesQuery.isError ? <div className="p-10 text-center"><p className="font-semibold text-red-700 dark:text-red-200">Não foi possível carregar as propriedades.</p><button type="button" onClick={() => propertiesQuery.refetch()} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-11 px-4">Tentar novamente</button></div>
          : items.length === 0 ? <div className="p-10 text-center"><Buildings className="mx-auto mb-3 text-zinc-500" size={34} aria-hidden="true" /><p className="font-semibold text-zinc-900 dark:text-white">{hasFilters ? 'Nenhuma propriedade corresponde aos filtros' : 'Nenhuma propriedade cadastrada'}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{hasFilters ? 'Limpe a busca ou selecione outro cliente.' : 'Cadastre o imóvel antes de vinculá-lo a projetos e orçamentos.'}</p>{hasFilters && <button type="button" onClick={() => { setSearch(''); setClientFilter(''); setPage(1); }} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-11 px-4">Limpar filtros</button>}</div>
          : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{items.map((property) => (
            <article key={property.id} className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><h3 className="break-words font-semibold text-zinc-950 dark:text-white">{property.nome}</h3><p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-300">{property.clienteNome || 'Cliente não localizado'}{property.municipio ? ` · ${property.municipio}` : ''}</p><p className="mt-1 break-words text-xs text-zinc-600 dark:text-zinc-400">{property.matricula ? `Matrícula ${property.matricula}` : property.car ? `CAR ${property.car}` : property.ccir ? `CCIR ${property.ccir}` : `ITR ${property.itr}`}{property.areaHa !== null && property.areaHa !== undefined ? ` · ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(property.areaHa)} ha` : ''}</p></div>
              <div className="flex shrink-0 justify-end gap-2"><button type="button" aria-label={`Editar ${property.nome}`} onClick={() => openEdit(property)} className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50 text-indigo-700 transition-[background-color,border-color,color] hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200"><PencilSimple size={17} aria-hidden="true" /></button><button type="button" aria-label={`Excluir ${property.nome}`} onClick={() => setDeleteTarget(property)} className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-700 transition-[background-color,border-color,color] hover:bg-red-100 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"><Trash size={17} aria-hidden="true" /></button></div>
            </article>
          ))}</div>}
      </section>

      {lastPage > 1 && <nav aria-label="Paginação de propriedades" className="mt-4 flex flex-wrap items-center justify-end gap-3"><button type="button" disabled={page === 1} onClick={() => changePage(page - 1)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-40">Anterior</button><span className="text-sm tabular-nums">Página {page} de {lastPage}</span><button type="button" disabled={page === lastPage} onClick={() => changePage(page + 1)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-40">Próxima</button></nav>}

      {!showDiscardDialog && !showQuickClientModal && <Modal isOpen={isModalOpen} onClose={closeEditor} closeDisabled={saveMutation.isPending} title={editing ? 'Editar cadastro de propriedade' : 'Novo cadastro de propriedade'} maxWidth="max-w-3xl" initialFocusId={propertyInitialFocusId}>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <FormError message={formError} />
          {formError && editing && <div aria-live="polite" className="space-y-3">
            <button type="button" className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={async () => {
              try { setCurrentConflict(await apiClient.get<Property>('/api/dados-operacionais/propriedades/' + editing.id)); }
              catch (error) { setFormError(error instanceof ApiError && error.status === 404 ? 'A propriedade foi excluída. Seu rascunho permanece nesta tela; copie-o antes de fechar.' : 'Não foi possível consultar a propriedade. Seu rascunho está preservado; tente novamente.'); setCurrentConflict(null); }
            }}>Consultar versão atual</button>
            {currentConflict && <><dl className="max-h-64 overflow-auto break-words rounded-lg border p-3">{Object.entries(propertyToForm(currentConflict)).map(([key, value]) => <div key={key} className="grid gap-1 border-b py-2 sm:grid-cols-2"><dt className="font-semibold">{propertyFieldLabels[key as keyof PropertyFormState]}</dt><dd>{key === 'clienteId' ? (currentConflict.clienteNome || 'Cliente vinculado') : (value || 'Não informado')}</dd></div>)}</dl>
              <p>Compare os campos acima com seu rascunho. Revise os dados antes de salvar novamente.</p>
              <button type="button" className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={() => { setEditing(currentConflict); setCurrentConflict(null); setFormError('Versão atual consultada. Revise seu rascunho e use “Salvar alterações” para reaplicá-lo.'); }}>Revisar rascunho com esta versão</button></>}
          </div>}
          <FormSection title="Identificação principal" description="Vincule o imóvel ao cliente e informe uma identificação oficial." className="bg-white/70 dark:border-zinc-700/80 dark:bg-zinc-800/35">
            <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="property-client" label="Cliente" required error={fieldErrors.clienteId}><RemoteCombobox<Client> id="property-client" name="clienteId" endpoint="/api/clientes/options" value={form.clienteId} selectedLabel={selectedClientLabel} onChange={(nextValue, option) => { update('clienteId', nextValue); setSelectedClientLabel(option?.nome || ''); }} placeholder="Pesquisar cliente…" required aria-invalid={Boolean(fieldErrors.clienteId)} aria-describedby={fieldErrors.clienteId ? 'property-client-error' : 'property-client-help'} /><div id="property-client-help" className={cn('mt-2 flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between', firstClientQuery.data?.length === 0 ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300')}><span>{firstClientQuery.data?.length === 0 ? 'Cadastre o primeiro cliente para vincular esta propriedade.' : 'Não encontrou o cliente? Cadastre-o sem perder este formulário.'}</span><button id="property-add-client" type="button" onClick={openQuickClient} className="geo-focus-ring min-h-11 shrink-0 rounded-lg px-3 font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10">Cadastrar cliente</button></div></FormField><FormField htmlFor="property-name" label="Nome do imóvel" required error={fieldErrors.nome}><input id="property-name" required name="nome" autoComplete="off" value={form.nome} onChange={(event) => update('nome', event.target.value)} className={fieldClass} aria-invalid={Boolean(fieldErrors.nome)} aria-describedby={fieldErrors.nome ? 'property-name-error' : undefined} /></FormField></div>
            <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="property-matricula" label="Matrícula" required error={fieldErrors.matricula} hint="Informe ao menos matrícula, CAR, CCIR ou ITR."><input id="property-matricula" name="matricula" autoComplete="off" spellCheck={false} value={form.matricula} onChange={(event) => update('matricula', event.target.value)} className={fieldClass} aria-invalid={Boolean(fieldErrors.matricula)} aria-describedby={fieldErrors.matricula ? 'property-matricula-error' : 'property-matricula-hint'} /></FormField><FormField htmlFor="property-car" label="CAR" error={fieldErrors.car}><input id="property-car" name="car" autoComplete="off" spellCheck={false} value={form.car} onChange={(event) => update('car', event.target.value)} className={fieldClass} /></FormField><FormField htmlFor="property-ccir" label="CCIR" error={fieldErrors.ccir}><input id="property-ccir" name="ccir" autoComplete="off" spellCheck={false} value={form.ccir} onChange={(event) => update('ccir', event.target.value)} className={fieldClass} /></FormField><FormField htmlFor="property-itr" label="ITR" error={fieldErrors.itr}><input id="property-itr" name="itr" autoComplete="off" spellCheck={false} value={form.itr} onChange={(event) => update('itr', event.target.value)} className={fieldClass} /></FormField></div>
          </FormSection>
          <FormSection title="Localização e situação" description="Use município como localização principal; coordenadas devem ser informadas em conjunto." className="bg-white/70 dark:border-zinc-700/80 dark:bg-zinc-800/35">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="property-municipality" label="Município" required error={fieldErrors.municipio}><input id="property-municipality" name="municipio" required autoComplete="address-level2" value={form.municipio} onChange={(event) => update('municipio', event.target.value)} className={fieldClass} aria-invalid={Boolean(fieldErrors.municipio)} aria-describedby={fieldErrors.municipio ? 'property-municipality-error' : undefined} /></FormField>
              <FormField htmlFor="property-state" label="UF" required error={fieldErrors.uf}><input id="property-state" name="uf" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoComplete="address-level1" value={form.uf} onChange={(event) => update('uf', event.target.value.toUpperCase())} className={fieldClass} aria-invalid={Boolean(fieldErrors.uf)} aria-describedby={fieldErrors.uf ? 'property-state-error' : undefined} /></FormField>
              <FormField htmlFor="property-city" label="Localidade ou distrito" error={fieldErrors.cidade}><input id="property-city" name="cidade" autoComplete="address-line2" value={form.cidade} onChange={(event) => update('cidade', event.target.value)} className={fieldClass} /></FormField>
              <FormField htmlFor="property-status" label="Situação do imóvel" error={fieldErrors.situacaoImovel}><FormSelect id="property-status" name="situacaoImovel" value={form.situacaoImovel} onChange={(event) => update('situacaoImovel', event.target.value)}><option value="">Não informada</option><option>Regular</option><option>Em regularização</option><option>Pendente de documentação</option><option>Em análise</option><option>Outro</option></FormSelect></FormField>
              <FormField htmlFor="property-area-ha" label="Área (ha)" error={fieldErrors.areaHa}><NumericInput id="property-area-ha" inputMode="decimal" min="0" step="any" name="areaHa" autoComplete="off" value={form.areaHa} onChange={(event) => update('areaHa', event.target.value)} className="tabular-nums" aria-invalid={Boolean(fieldErrors.areaHa)} aria-describedby={fieldErrors.areaHa ? 'property-area-ha-error' : undefined} /></FormField>
              <FormField htmlFor="property-latitude" label="Latitude" error={fieldErrors.latitude}><NumericInput id="property-latitude" inputMode="decimal" min="-90" max="90" step="any" name="latitude" autoComplete="off" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} className="tabular-nums" aria-invalid={Boolean(fieldErrors.latitude)} aria-describedby={fieldErrors.latitude ? 'property-latitude-error' : undefined} /></FormField>
              <FormField htmlFor="property-longitude" label="Longitude" error={fieldErrors.longitude}><NumericInput id="property-longitude" inputMode="decimal" min="-180" max="180" step="any" name="longitude" autoComplete="off" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} className="tabular-nums" aria-invalid={Boolean(fieldErrors.longitude)} aria-describedby={fieldErrors.longitude ? 'property-longitude-error' : undefined} /></FormField>
            </div>
          </FormSection>
          <FormSection title="Observações" description="Registre informações complementares sem duplicar dados dos projetos." className="bg-white/70 dark:border-zinc-700/80 dark:bg-zinc-800/35"><FormField htmlFor="property-notes" label="Observações" error={fieldErrors.observacoes}><textarea id="property-notes" name="observacoes" rows={3} value={form.observacoes} onChange={(event) => update('observacoes', event.target.value)} className={cn(fieldClass, 'resize-y')} /></FormField></FormSection>
          <FormFooter><button type="button" onClick={closeEditor} disabled={saveMutation.isPending} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5 disabled:opacity-50">Cancelar</button><button type="submit" disabled={saveMutation.isPending} aria-busy={saveMutation.isPending} className={cn(primarySubmitButtonClass, 'min-h-11 px-5 disabled:opacity-50')}>{saveMutation.isPending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar propriedade'}</button></FormFooter>
        </form>
      </Modal>}
      <QuickClientModal isOpen={showQuickClientModal} onClose={closeQuickClient} onCreated={selectCreatedClient} contextLabel="cadastro de propriedade" />
      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null); }} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} loading={deleteMutation.isPending} loadingText="Excluindo…" title={`Excluir propriedade${deleteTarget ? ` “${deleteTarget.nome}”` : ''}?`} description="A propriedade será excluída somente se não possuir vínculos. Projetos, orçamentos e registros ambientais nunca serão alterados." confirmText="Excluir propriedade" />
      <ConfirmDialog isOpen={showDiscardDialog} onClose={() => setShowDiscardDialog(false)} onConfirm={() => { setShowDiscardDialog(false); setInitialFingerprint(''); setModalOpen(false); }} variant="warning" title="Descartar alterações?" description="As informações preenchidas neste cadastro de propriedade ainda não foram salvas." confirmText="Descartar alterações" />
    </Layout>
  );
}
