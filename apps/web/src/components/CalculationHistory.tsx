import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClockCounterClockwise, FloppyDisk } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { apiClient } from '../services/apiClient';
import { RemoteCombobox } from './RemoteCombobox';

type CalculationType = 'topografico' | 'ambiental';
type Client = { id: string; nome: string };
type Project = { id: string; nome: string; clienteId: string };
export type SavedCalculation = {
  id: string; nome: string; clienteId?: string | null; projetoId?: string | null;
  dataCalculo: string; unidade?: string | null; metodo?: string | null;
  observacoes?: string | null; entradas: unknown; resultado: unknown;
};

interface CalculationHistoryProps {
  type: CalculationType;
  suggestedName: string;
  inputs: unknown;
  result: unknown;
  unit?: string;
  method?: string;
  disabled?: boolean;
  onReopen?: (calculation: SavedCalculation) => void;
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

export function CalculationHistory({
  type, suggestedName, inputs, result, unit, method, disabled = false, onReopen,
}: CalculationHistoryProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const date = new Date().toISOString().slice(0, 10);

  const historyQuery = useQuery({
    queryKey: ['saved-calculations', type],
    queryFn: () => apiClient.get<SavedCalculation[]>('/api/dados-operacionais/calculos?tipo=' + type),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: () => apiClient.post('/api/dados-operacionais/calculos', {
      tipo: type,
      nome: name.trim(),
      clienteId: clientId || null,
      projetoId: projectId || null,
      dataCalculo: date,
      entradas: inputs,
      resultado: result,
      unidade: unit || null,
      metodo: method || null,
      observacoes: notes.trim() || null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-calculations', type] });
      setError('');
      setNotes('');
    },
    onError: (saveError: Error) => setError(saveError.message),
  });

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => { setName(suggestedName); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
        <FloppyDisk size={18} aria-hidden="true" /> Salvar cálculo
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Salvar e consultar cálculos" maxWidth="max-w-2xl">
        <div className="space-y-5">
          <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <label className="block text-sm font-medium">Nome do cálculo<input required name="calculation_name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="text-sm font-medium"><label htmlFor="calculation-client">Cliente opcional</label><RemoteCombobox<Client> id="calculation-client" name="calculation_client" endpoint="/api/clientes/options" value={clientId} onChange={(nextValue) => { setClientId(nextValue); setProjectId(''); }} placeholder="Pesquisar cliente…" emptyLabel="Sem cliente" className="mt-1.5" /></div>
              <div className="text-sm font-medium"><label htmlFor="calculation-project">Projeto opcional</label><RemoteCombobox<Project> id="calculation-project" name="calculation_project" endpoint={`/api/projetos/options${clientId ? `?clienteId=${encodeURIComponent(clientId)}` : ''}`} value={projectId} onChange={setProjectId} placeholder="Pesquisar projeto…" emptyLabel="Sem projeto" className="mt-1.5" /></div>
            </div>
            <label className="block text-sm font-medium">Observações<textarea name="calculation_notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} /></label>
            <div className="flex justify-end"><button type="submit" disabled={saveMutation.isPending || !name.trim()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saveMutation.isPending ? 'Salvando…' : 'Confirmar salvamento'}</button></div>
          </form>
          <section aria-labelledby="calculation-history-title" className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 id="calculation-history-title" className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white"><ClockCounterClockwise size={18} aria-hidden="true" /> Histórico recente</h3>
            {historyQuery.isLoading ? <p className="mt-3 text-sm text-zinc-500" aria-live="polite">Carregando histórico…</p>
              : !historyQuery.data?.length ? <p className="mt-3 text-sm text-zinc-500">Nenhum cálculo salvo deste tipo.</p>
              : <div className="mt-3 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">{historyQuery.data.slice(0, 20).map((item) => (
                <button key={item.id} type="button" onClick={() => {
                  if (onReopen) {
                    onReopen(item);
                    setOpen(false);
                    return;
                  }
                  setName(item.nome);
                  setClientId(item.clienteId || '');
                  setProjectId(item.projetoId || '');
                  setNotes(item.observacoes || '');
                }} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 dark:hover:bg-zinc-800/60">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">{item.nome}</span><span className="block text-xs text-zinc-500">{new Intl.DateTimeFormat('pt-BR').format(new Date(item.dataCalculo + 'T12:00:00'))}{item.metodo ? ' · ' + item.metodo : ''}</span></span>
                  <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">Reabrir dados</span>
                </button>
              ))}</div>}
          </section>
        </div>
      </Modal>
    </>
  );
}
