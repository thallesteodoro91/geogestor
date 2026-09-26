import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { FormSelect } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { primarySmallActionButtonClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass, geoPanelClass } from '../../utils/geoTheme';

interface ChecklistStep {
  id?: string;
  titulo: string;
  descricao?: string | null;
  prioridade: 'Baixa' | 'Média' | 'Alta';
}

interface ChecklistModel {
  id: string;
  nome: string;
  descricao?: string | null;
  tipoProjeto?: string | null;
  ativo: boolean;
  etapas: ChecklistStep[];
}

const emptyModel = (): Omit<ChecklistModel, 'id'> => ({
  nome: '', descricao: '', tipoProjeto: '', ativo: true,
  etapas: [{ titulo: '', descricao: '', prioridade: 'Média' }]
});

const modelForm = (model: ChecklistModel): Omit<ChecklistModel, 'id'> => ({
  nome: model.nome,
  descricao: model.descricao || '',
  tipoProjeto: model.tipoProjeto || '',
  ativo: model.ativo,
  etapas: model.etapas.map((step) => ({ ...step }))
});

const modelFormKey = (value: Omit<ChecklistModel, 'id'>) => JSON.stringify(value);

export function ChecklistTemplateSettingsPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ChecklistModel | null | 'new'>(null);
  const [form, setForm] = useState(emptyModel());
  const [pendingDelete, setPendingDelete] = useState<ChecklistModel | null>(null);
  const [initialFormKey, setInitialFormKey] = useState(modelFormKey(emptyModel()));
  const { data: models = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['checklist-models'],
    queryFn: () => apiClient.get<ChecklistModel[]>('/api/tarefas/modelos')
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['checklist-models'] });
  const formDirty = Boolean(editing) && modelFormKey(form) !== initialFormKey;
  const openNewModel = () => {
    const next = emptyModel();
    setForm(next);
    setInitialFormKey(modelFormKey(next));
    setEditing('new');
  };
  const openModel = (model: ChecklistModel) => {
    const next = modelForm(model);
    setForm(next);
    setInitialFormKey(modelFormKey(next));
    setEditing(model);
  };
  const closeEditor = () => {
    if (formDirty && !window.confirm('Descartar as alterações deste modelo?')) return;
    setEditing(null);
  };

  useEffect(() => {
    if (!editing || !formDirty) return undefined;
    const protectDraft = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [editing, formDirty]);
  const saveMutation = useMutation({
    mutationFn: () => editing === 'new'
      ? apiClient.post<ChecklistModel>('/api/tarefas/modelos', form)
      : apiClient.patch<ChecklistModel>(`/api/tarefas/modelos/${editing!.id}`, form),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      toast.success('Modelo de checklist salvo.');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.')
  });
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<ChecklistModel>(`/api/tarefas/modelos/${id}/duplicar`, {}),
    onSuccess: async (model) => {
      await refresh();
      const next = modelForm(model);
      setForm(next);
      setInitialFormKey(modelFormKey(next));
      setEditing(model);
      toast.success('Cópia criada como inativa. Revise antes de ativar.');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Não foi possível duplicar o modelo.')
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/tarefas/modelos/${id}`),
    onSuccess: async () => {
      await refresh();
      setPendingDelete(null);
      toast.success('Modelo removido. O histórico de aplicações foi preservado.');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o modelo.')
  });

  const updateStep = (index: number, patch: Partial<ChecklistStep>) => setForm((current) => ({
    ...current,
    etapas: current.etapas.map((step, position) => position === index ? { ...step, ...patch } : step)
  }));
  const moveStep = (index: number, direction: -1 | 1) => setForm((current) => {
    const next = [...current.etapas];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, etapas: next };
  });

  return (
    <section id="checklist-template-settings" className={`${geoPanelClass} mt-6 rounded-3xl p-6`} aria-labelledby="checklist-template-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="checklist-template-title" className="text-lg font-bold text-zinc-950 dark:text-white">Modelos de checklist</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Configure etapas reutilizáveis para novos projetos. Aplicar um modelo nunca duplica uma tarefa com o mesmo título, mesmo com diferenças de acento ou espaços.
          </p>
        </div>
        <button type="button" onClick={openNewModel} className={primarySmallActionButtonClass}>
          <Plus aria-hidden="true" /> Novo modelo
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {isLoading && <p role="status" className="text-sm text-zinc-500">Carregando modelos…</p>}
        {isError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <span>Não foi possível carregar os modelos de checklist.</span>
            <button type="button" onClick={() => void refetch()} disabled={isFetching} className="geo-button-base geo-focus-ring min-h-10 border border-current px-3 text-xs font-bold">{isFetching ? 'Tentando novamente…' : 'Tentar novamente'}</button>
          </div>
        )}
        {!isLoading && !isError && models.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">Nenhum modelo cadastrado.</p>}
        {models.map((model) => (
          <article key={model.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words font-semibold text-zinc-950 dark:text-white">{model.nome}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${model.ativo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>{model.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{model.etapas.length} etapa(s){model.tipoProjeto ? ` · Projeto: ${model.tipoProjeto}` : ' · Todos os tipos de projeto'}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => openModel(model)} className={secondarySmallActionButtonClass}><PencilSimple aria-hidden="true" /> Editar</button>
              <button type="button" onClick={() => duplicateMutation.mutate(model.id)} disabled={duplicateMutation.isPending} className={secondarySmallActionButtonClass}><Copy aria-hidden="true" /> Duplicar</button>
              <button type="button" onClick={() => setPendingDelete(model)} className="geo-button-base geo-focus-ring min-h-10 border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-500/10"><Trash aria-hidden="true" /> Excluir</button>
            </div>
          </article>
        ))}
      </div>

      <Modal isOpen={Boolean(editing)} onClose={closeEditor} title={editing === 'new' ? 'Novo modelo de checklist' : 'Editar modelo de checklist'} maxWidth="max-w-4xl" initialFocusId="checklist-model-name" closeDisabled={saveMutation.isPending}>
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-5" aria-busy={saveMutation.isPending}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Nome *
              <input id="checklist-model-name" name="nome" required maxLength={160} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} className={`${geoFieldClass} mt-1.5 w-full`} />
            </label>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Tipo de projeto
              <input name="tipoProjeto" maxLength={120} value={form.tipoProjeto || ''} onChange={(event) => setForm({ ...form, tipoProjeto: event.target.value })} placeholder="Ex.: Topografia" className={`${geoFieldClass} mt-1.5 w-full`} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Descrição
            <textarea name="descricao" rows={2} maxLength={1000} value={form.descricao || ''} onChange={(event) => setForm({ ...form, descricao: event.target.value })} className={`${geoFieldClass} mt-1.5 w-full resize-y`} />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3 dark:border-zinc-700">
            <input type="checkbox" name="ativo" checked={form.ativo} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Disponível para aplicar em projetos</span>
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-zinc-900 dark:text-white">Etapas do modelo</legend>
            {form.etapas.map((step, index) => (
              <div key={step.id || index} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-zinc-500">Etapa {index + 1}</span>
                  <div className="flex gap-1">
                    <button type="button" aria-label={`Mover etapa ${index + 1} para cima`} disabled={index === 0} onClick={() => moveStep(index, -1)} className="geo-focus-ring rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"><ArrowUp aria-hidden="true" /></button>
                    <button type="button" aria-label={`Mover etapa ${index + 1} para baixo`} disabled={index === form.etapas.length - 1} onClick={() => moveStep(index, 1)} className="geo-focus-ring rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"><ArrowDown aria-hidden="true" /></button>
                    <button type="button" aria-label={`Remover etapa ${index + 1}`} disabled={form.etapas.length === 1} onClick={() => setForm({ ...form, etapas: form.etapas.filter((_, position) => position !== index) })} className="geo-focus-ring rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-500/10"><X aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Título *
                    <input required name={`etapa-${index}-titulo`} maxLength={180} value={step.titulo} onChange={(event) => updateStep(index, { titulo: event.target.value })} className={`${geoFieldClass} mt-1 w-full`} />
                  </label>
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Prioridade
                    <FormSelect name={`etapa-${index}-prioridade`} value={step.prioridade} onChange={(event) => updateStep(index, { prioridade: event.target.value as ChecklistStep['prioridade'] })} className={`${geoFieldClass} mt-1 w-full`}><option>Baixa</option><option>Média</option><option>Alta</option></FormSelect>
                  </label>
                </div>
                <label className="mt-3 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Orientação opcional
                  <input name={`etapa-${index}-descricao`} maxLength={1000} value={step.descricao || ''} onChange={(event) => updateStep(index, { descricao: event.target.value })} className={`${geoFieldClass} mt-1 w-full`} />
                </label>
              </div>
            ))}
            <button type="button" disabled={form.etapas.length >= 100} onClick={() => setForm({ ...form, etapas: [...form.etapas, { titulo: '', descricao: '', prioridade: 'Média' }] })} className={secondarySmallActionButtonClass}><Plus aria-hidden="true" /> {form.etapas.length >= 100 ? 'Limite de 100 etapas atingido' : 'Adicionar etapa'}</button>
          </fieldset>

          <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button type="button" onClick={closeEditor} disabled={saveMutation.isPending} className={secondarySmallActionButtonClass}>Cancelar</button>
            <button type="submit" disabled={saveMutation.isPending} className={primarySubmitButtonClass}>{saveMutation.isPending ? 'Salvando…' : 'Salvar modelo'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) deleteMutation.mutate(pendingDelete.id); }} title="Excluir modelo de checklist?" description="O modelo sairá das opções de uso. Tarefas já criadas e o histórico de aplicações serão preservados." loading={deleteMutation.isPending} />
    </section>
  );
}
