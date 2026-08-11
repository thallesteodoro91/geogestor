import { CheckCircle, FloppyDisk, WarningCircle, X } from '@phosphor-icons/react';
import { cn } from '../utils/cn';

export type SettingsSaveState = 'saved' | 'dirty' | 'saving' | 'success' | 'error';

const labels: Record<SettingsSaveState, string> = {
  saved: 'Tudo salvo',
  dirty: 'Alterações não salvas',
  saving: 'Salvando…',
  success: 'Salvo com sucesso',
  error: 'Não foi possível salvar'
};

export function SettingsSaveBar({
  state,
  onSave,
  onDiscard,
  saveDisabled = false,
  errorMessage,
  className
}: {
  state: SettingsSaveState;
  onSave: () => void;
  onDiscard: () => void;
  saveDisabled?: boolean;
  errorMessage?: string;
  className?: string;
}) {
  const busy = state === 'saving';
  const canAct = state === 'dirty' || state === 'error';
  const Icon = state === 'error' ? WarningCircle : CheckCircle;

  return (
    <div
      className={cn(
        'sticky bottom-3 z-30 mt-5 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white/95 px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.16)] backdrop-blur dark:border-zinc-700/90 dark:bg-zinc-900/95',
        state === 'dirty' && 'border-amber-300 dark:border-amber-700',
        state === 'error' && 'border-red-300 dark:border-red-800',
        className
      )}
      aria-busy={busy}
    >
      <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
        <p className={cn(
          'flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100',
          state === 'dirty' && 'text-amber-800 dark:text-amber-300',
          state === 'error' && 'text-red-700 dark:text-red-300'
        )}>
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {labels[state]}
        </p>
        {state === 'error' && errorMessage && <p className="mt-0.5 break-words text-xs text-red-600 dark:text-red-300">{errorMessage} Revise os campos ou tente novamente.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={!canAct || busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500/40 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <X aria-hidden="true" size={15} /> Descartar alterações
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canAct || busy || saveDisabled}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-500 bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FloppyDisk aria-hidden="true" size={16} /> {busy ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
