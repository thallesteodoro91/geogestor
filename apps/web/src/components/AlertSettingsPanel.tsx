import { useEffect, useState } from 'react';
import { ArrowCounterClockwise, Bell, Info } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ALERT_CATEGORY_LABELS,
  DEFAULT_ALERT_SETTINGS,
  type AlertCategoryConfig,
  type AlertRecurrence,
  type AlertSettings
} from '@geogestor/contracts';
import { apiClient } from '../services/apiClient';
import { CheckboxField, NumericInput } from './Form';
import { cn } from '../utils/cn';
import { geoFieldClass, geoPanelClass } from '../utils/geoTheme';
import { secondarySmallActionButtonClass } from '../utils/actionStyles';
import { SettingsSaveBar, type SettingsSaveState } from './SettingsSaveBar';

const recurrenceLabels: Record<AlertRecurrence, string> = {
  daily: 'Diariamente',
  interval: 'A cada X dias',
  once: 'Somente uma vez'
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <CheckboxField label={label} checked={checked} onChange={onChange} compact />;
}

export function AlertSettingsPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [saveState, setSaveState] = useState<SettingsSaveState>('saved');
  const [saveError, setSaveError] = useState('');
  const settingsQuery = useQuery<AlertSettings>({
    queryKey: ['alertas-configuracoes'],
    queryFn: () => apiClient.get('/api/alertas/configuracoes')
  });

  const currentSettings = draft ?? settingsQuery.data ?? null;

  const refreshAlerts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['alertas'] }),
      queryClient.invalidateQueries({ queryKey: ['alertas-configuracoes'] })
    ]);
    window.dispatchEvent(new CustomEvent('geogestor:alerts-invalidated'));
  };

  const saveMutation = useMutation({
    mutationFn: (settings: AlertSettings) => apiClient.put<AlertSettings>('/api/alertas/configuracoes', settings),
    onSuccess: async (saved) => {
      setDraft(null);
      setSaveState('success');
      window.setTimeout(() => setSaveState('saved'), 1800);
      const project = saved.categories.find((item) => item.category === 'project');
      if (project) localStorage.setItem('geogestor_alerta_dias', String(project.daysBefore));
      await refreshAlerts();
      toast.success('Configurações de alertas salvas.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar os alertas.';
      setSaveError(message);
      setSaveState('error');
      toast.error(message);
    }
  });

  const effectiveSaveState: SettingsSaveState = saveMutation.isPending
    ? 'saving'
    : draft && saveState !== 'error'
      ? 'dirty'
      : saveState;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('geogestor:settings-section-state', {
      detail: { section: 'alertas', state: effectiveSaveState }
    }));
  }, [effectiveSaveState]);

  useEffect(() => {
    const discard = (event: Event) => {
      if ((event as CustomEvent<{ section?: string }>).detail?.section !== 'alertas') return;
      setDraft(null);
      setSaveError('');
      setSaveState('saved');
    };
    window.addEventListener('geogestor:settings-discard', discard);
    return () => window.removeEventListener('geogestor:settings-discard', discard);
  }, []);

  const updateCategory = (category: string, patch: Partial<AlertCategoryConfig>) => {
    setDraft((current) => {
      const base = current ?? settingsQuery.data;
      return base ? {
        ...base,
        categories: base.categories.map((item) => item.category === category ? { ...item, ...patch } : item)
      } : current;
    });
  };

  const panelClass = cn(
    geoPanelClass,
    'relative overflow-hidden rounded-2xl p-5 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
  );
  const fieldClass = cn(geoFieldClass, 'min-h-9 w-full bg-white px-3 text-xs font-semibold dark:bg-zinc-950');

  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);

  return (
    <section className={cn(panelClass, 'space-y-4')} aria-labelledby="alert-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div>
          <h2 id="alert-settings-title" className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
            <Bell className="h-5 w-5 text-indigo-500" aria-hidden="true" />Alertas e prazos
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Defina a antecedência e a recorrência de cada obrigação.</p>
        </div>
        <button type="button" onClick={() => {
          if (window.confirm('Restaurar os padrões desta seção?\n\nTodas as categorias voltarão à antecedência, recorrência e comportamento originais. Você poderá revisar antes de salvar.')) {
            setDraft(structuredClone(DEFAULT_ALERT_SETTINGS));
            setSaveError('');
            setSaveState('dirty');
          }
        }} disabled={!currentSettings} className={cn(secondarySmallActionButtonClass, 'shrink-0')}>
          <ArrowCounterClockwise className="h-4 w-4" aria-hidden="true" />Restaurar padrão
        </button>
      </div>

      {settingsQuery.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <span>Não foi possível consultar as regras de alertas.</span>
          <button type="button" onClick={() => void settingsQuery.refetch()} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800">Tentar novamente</button>
        </div>
      ) : settingsQuery.isLoading || !currentSettings ? <p aria-live="polite" className="py-8 text-center text-xs font-medium text-zinc-500">Carregando configurações…</p> : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-500/15 dark:bg-indigo-500/10">
            <Toggle checked={currentSettings.enabled} onChange={(enabled) => setDraft({ ...currentSettings, enabled })} label="Ativar central de alertas" />
            <Toggle checked={currentSettings.nativeEnabled} onChange={(nativeEnabled) => setDraft({ ...currentSettings, nativeEnabled })} label="Notificações do Windows" />
          </div>

          <div className="space-y-3">
            {currentSettings.categories.map((category) => (
              <article key={category.category} className={cn('rounded-xl border p-4', category.enabled ? 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40' : 'border-zinc-200/70 bg-zinc-50 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/40')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Toggle checked={category.enabled} onChange={(enabled) => updateCategory(category.category, { enabled })} label={ALERT_CATEGORY_LABELS[category.category]} />
                  <span className="text-[10px] font-semibold text-zinc-400">0–365 dias de antecedência</span>
                </div>
                <fieldset disabled={!category.enabled} className="mt-3 grid grid-cols-1 gap-3 disabled:opacity-50 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    <span className="mb-1 block">Dias de antecedência</span>
                    <NumericInput name={`alert-days-${category.category}`} min="0" max="365" inputMode="numeric" value={String(category.daysBefore)} onChange={(event) => updateCategory(category.category, { daysBefore: Math.min(365, Math.max(0, Number(event.target.value) || 0)) })} className={fieldClass} />
                  </label>
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    <span className="mb-1 block">Recorrência</span>
                    <select name={`alert-recurrence-${category.category}`} value={category.recurrence} onChange={(event) => updateCategory(category.category, { recurrence: event.target.value as AlertRecurrence })} className={fieldClass}>
                      {(Object.entries(recurrenceLabels) as Array<[AlertRecurrence, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    <span className="mb-1 block">Intervalo em dias</span>
                    <NumericInput name={`alert-interval-${category.category}`} min="1" max="90" inputMode="numeric" disabled={category.recurrence !== 'interval'} value={String(category.intervalDays)} onChange={(event) => updateCategory(category.category, { intervalDays: Math.min(90, Math.max(1, Number(event.target.value) || 1)) })} className={fieldClass} />
                  </label>
                  <div className="flex flex-col justify-end">
                    <Toggle checked={category.alertOnDueDate} onChange={(alertOnDueDate) => updateCategory(category.category, { alertOnDueDate })} label="Alertar no vencimento" />
                    <Toggle checked={category.keepOverdue} onChange={(keepOverdue) => updateCategory(category.category, { keepOverdue })} label="Manter vencidos" />
                  </div>
                </fieldset>
              </article>
            ))}
          </div>

          <div className="rounded-xl border border-brand-primary-200/45 bg-brand-primary-50/50 p-3 dark:border-brand-primary-300/15 dark:bg-brand-primary-400/10">
            <p className="flex max-w-2xl items-start gap-2 text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />As regras ficam salvas no banco local. Alertas concluídos, pagos, cancelados ou arquivados são removidos automaticamente.
            </p>
          </div>
          <SettingsSaveBar
            state={effectiveSaveState}
            errorMessage={saveError}
            onSave={() => saveMutation.mutate(currentSettings)}
            onDiscard={() => { setDraft(null); setSaveError(''); setSaveState('saved'); }}
          />
        </>
      )}
    </section>
  );
}
