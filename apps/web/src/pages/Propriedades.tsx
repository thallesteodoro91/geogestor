import { toast } from 'sonner';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Buildings, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { apiClient } from '../services/apiClient';
import { RemoteCombobox } from '../components/RemoteCombobox';

type Client = { id: string; nome: string };
type Property = {
  id: string; clienteId: string; nome: string; matricula?: string | null;
  car?: string | null; ccir?: string | null; itr?: string | null;
  areaHa?: number | null; municipio?: string | null;
  latitude?: number | null; longitude?: number | null; observacoes?: string | null;
  clienteNome?: string | null;
};
type PropertyResponse = { items: Property[]; total: number; page: number; limit: number };
type FormState = {
  clienteId: string; nome: string; matricula: string; car: string; ccir: string;
  itr: string; areaHa: string; municipio: string; latitude: string;
  longitude: string; observacoes: string;
};

const emptyForm: FormState = {
  clienteId: '', nome: '', matricula: '', car: '', ccir: '', itr: '',
  areaHa: '', municipio: '', latitude: '', longitude: '', observacoes: '',
};
const fieldClass = 'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

function numberOrNull(value: string) {
  return value.trim() ? Number(value.replace(',', '.')) : null;
}

export function Propriedades() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isModalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [formError, setFormError] = useState('');

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (search.trim()) params.set('q', search.trim());
  if (clientFilter) params.set('clienteId', clientFilter);
  const propertiesQuery = useQuery({
    queryKey: ['properties', page, search, clientFilter],
    queryFn: () => apiClient.get<PropertyResponse>('/api/dados-operacionais/propriedades?' + params.toString()),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        clienteId: form.clienteId,
        nome: form.nome.trim(),
        matricula: form.matricula.trim() || null,
        car: form.car.trim() || null,
        ccir: form.ccir.trim() || null,
        itr: form.itr.trim() || null,
        areaHa: numberOrNull(form.areaHa),
        municipio: form.municipio.trim() || null,
        latitude: numberOrNull(form.latitude),
        longitude: numberOrNull(form.longitude),
        observacoes: form.observacoes.trim() || null,
      };
      return editing
        ? apiClient.patch('/api/dados-operacionais/propriedades/' + editing.id, payload)
        : apiClient.post('/api/dados-operacionais/propriedades', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      setModalOpen(false);
      setFormError('');
    },
    onError: (error: Error) => setFormError(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete('/api/dados-operacionais/propriedades/' + id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      setDeleteTarget(null);
    },
    onError: (error: Error) => { setDeleteTarget(null); toast.error(error.message); },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, clienteId: clientFilter });
    setFormError('');
    setModalOpen(true);
  };
  const openEdit = (property: Property) => {
    setEditing(property);
    setForm({
      clienteId: property.clienteId, nome: property.nome,
      matricula: property.matricula || '', car: property.car || '',
      ccir: property.ccir || '', itr: property.itr || '',
      areaHa: property.areaHa?.toString() || '', municipio: property.municipio || '',
      latitude: property.latitude?.toString() || '', longitude: property.longitude?.toString() || '',
      observacoes: property.observacoes || '',
    });
    setFormError('');
    setModalOpen(true);
  };
  const update = (field: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const items = propertiesQuery.data?.items || [];
  const total = propertiesQuery.data?.total || 0;
  const lastPage = Math.max(1, Math.ceil(total / 25));

  return (
    <Layout>
      <PageHeader
        eyebrow="Base patrimonial"
        title="Propriedades e imóveis"
        description="Cadastre o imóvel uma vez e mantenha cliente, projetos, orçamentos, documentos e mapas usando a mesma referência."
        action={<button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600/50"><Plus size={18} aria-hidden="true" /> Nova propriedade</button>}
      />

      <div className="mb-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.4fr)]">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Buscar propriedade
          <span className="relative block"><MagnifyingGlass className="absolute left-3 top-4 text-zinc-400" size={17} aria-hidden="true" /><input name="property_search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, matrícula, CAR ou município" className={fieldClass + ' pl-9'} /></span>
        </label>
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300"><label htmlFor="property-client-filter">Cliente</label><RemoteCombobox<Client> id="property-client-filter" name="property_client_filter" endpoint="/api/clientes/options" value={clientFilter} onChange={(nextValue) => { setClientFilter(nextValue); setPage(1); }} placeholder="Pesquisar cliente…" emptyLabel="Todos os clientes" className="mt-1.5" /></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"><span className="font-semibold tabular-nums">{total}</span> {total === 1 ? 'propriedade cadastrada' : 'propriedades cadastradas'}</div>
        {propertiesQuery.isLoading ? <p className="p-8 text-center text-sm text-zinc-500" aria-live="polite">Carregando propriedades…</p>
          : items.length === 0 ? <div className="p-10 text-center"><Buildings className="mx-auto mb-3 text-zinc-400" size={34} aria-hidden="true" /><p className="font-semibold text-zinc-900 dark:text-white">Nenhuma propriedade encontrada</p><p className="mt-1 text-sm text-zinc-500">Cadastre o imóvel antes de vinculá-lo a projetos e orçamentos.</p></div>
          : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{items.map((property) => (
            <article key={property.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><h2 className="truncate font-semibold text-zinc-950 dark:text-white">{property.nome}</h2><p className="mt-1 text-sm text-zinc-500">{property.clienteNome || 'Cliente não localizado'}{property.municipio ? ' · ' + property.municipio : ''}</p><p className="mt-1 text-xs text-zinc-500">{property.matricula ? 'Matrícula ' + property.matricula : 'Sem matrícula'}{property.areaHa !== null && property.areaHa !== undefined ? ' · ' + new Intl.NumberFormat('pt-BR').format(property.areaHa) + ' ha' : ''}</p></div>
              <div className="flex shrink-0 gap-2"><button type="button" aria-label={'Editar ' + property.nome} onClick={() => openEdit(property)} className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-zinc-700 dark:text-zinc-300"><PencilSimple size={17} aria-hidden="true" /></button><button type="button" aria-label={'Excluir ' + property.nome} onClick={() => setDeleteTarget(property)} className="rounded-lg border border-zinc-200 p-2 text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/50 dark:border-zinc-700"><Trash size={17} aria-hidden="true" /></button></div>
            </article>
          ))}</div>}
      </div>
      {lastPage > 1 && <div className="mt-4 flex items-center justify-end gap-3"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Anterior</button><span className="text-sm tabular-nums">Página {page} de {lastPage}</span><button type="button" disabled={page === lastPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Próxima</button></div>}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar propriedade' : 'Nova propriedade'} maxWidth="max-w-3xl">
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="text-sm font-medium"><label htmlFor="property-client">Cliente</label><RemoteCombobox<Client> id="property-client" name="clienteId" endpoint="/api/clientes/options" value={form.clienteId} selectedLabel={editing?.clienteNome || ''} onChange={(nextValue) => update('clienteId', nextValue)} placeholder="Pesquisar cliente…" required className="mt-1.5" /></div>
            <label className="text-sm font-medium">Nome do imóvel<input required name="nome" value={form.nome} onChange={(event) => update('nome', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">Matrícula<input name="matricula" value={form.matricula} onChange={(event) => update('matricula', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">Município<input name="municipio" value={form.municipio} onChange={(event) => update('municipio', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">CAR<input name="car" value={form.car} onChange={(event) => update('car', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">CCIR<input name="ccir" value={form.ccir} onChange={(event) => update('ccir', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">ITR<input name="itr" value={form.itr} onChange={(event) => update('itr', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">Área (ha)<input type="number" inputMode="decimal" min="0" step="any" name="areaHa" value={form.areaHa} onChange={(event) => update('areaHa', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">Latitude<input type="number" inputMode="decimal" min="-90" max="90" step="any" name="latitude" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium">Longitude<input type="number" inputMode="decimal" min="-180" max="180" step="any" name="longitude" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} className={fieldClass} /></label>
          </div>
          <label className="block text-sm font-medium">Observações<textarea name="observacoes" rows={3} value={form.observacoes} onChange={(event) => update('observacoes', event.target.value)} className={fieldClass + ' resize-y'} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600">Cancelar</button><button type="submit" disabled={saveMutation.isPending} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saveMutation.isPending ? 'Salvando…' : 'Salvar propriedade'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} title="Excluir propriedade?" description="A propriedade será arquivada. A exclusão será bloqueada se houver projeto ou orçamento vinculado." confirmText="Excluir propriedade" />
    </Layout>
  );
}
