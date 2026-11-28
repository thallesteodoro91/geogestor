import { secondarySmallActionButtonClass } from '../../utils/actionStyles';

export function ClientLoadState({ label, error = false, onRetry }: { label: string; error?: boolean; onRetry?: () => void }) {
  return <div role={error ? 'alert' : 'status'} aria-live="polite" className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
    <p>{error ? `Não foi possível carregar ${label}. Seus registros não foram alterados.` : `Carregando ${label}…`}</p>
    {error && onRetry && <button type="button" onClick={onRetry} className={secondarySmallActionButtonClass + ' mt-3 min-h-11'}>Tentar novamente</button>}
  </div>;
}
