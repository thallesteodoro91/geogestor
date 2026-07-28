import { useState } from 'react';
import { ArrowClockwise, CaretDown, FolderOpen, WarningCircle } from '@phosphor-icons/react';

interface ApiAvailabilityProps {
  error: unknown;
  reconnecting: boolean;
  onRetry: () => void;
  fullScreen?: boolean;
}

function technicalDetail(error: unknown) {
  if (error && typeof error === 'object' && 'payload' in error) {
    return JSON.stringify((error as { payload?: unknown }).payload, null, 2);
  }
  return error instanceof Error ? error.message : 'O serviço local não respondeu.';
}

export function ApiAvailability({
  error,
  reconnecting,
  onRetry,
  fullScreen = false
}: ApiAvailabilityProps) {
  const [showDetails, setShowDetails] = useState(false);
  const content = (
    <section
      role="alert"
      aria-live="assertive"
      className="w-full rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-lg dark:border-amber-700/70 dark:bg-amber-950/95 dark:text-amber-50"
    >
      <div className="flex items-start gap-3">
        <WarningCircle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" weight="fill" />
        <div className="min-w-0 flex-1">
          <h1 className={fullScreen ? 'text-xl font-bold' : 'text-sm font-bold'}>
            Não foi possível conectar ao serviço local do GeoGestor
          </h1>
          <p className="mt-1 text-sm leading-6">
            Seus dados não foram necessariamente perdidos. O aplicativo está tentando restabelecer a conexão com o serviço e o banco locais.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={reconnecting}
              className="geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950 disabled:cursor-wait disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
            >
              <ArrowClockwise aria-hidden="true" className={reconnecting ? 'animate-spin' : ''} />
              {reconnecting ? 'Tentando reconectar…' : 'Tentar novamente'}
            </button>
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              aria-expanded={showDetails}
              className="geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-500/70 px-4 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <CaretDown aria-hidden="true" className={showDetails ? 'rotate-180' : ''} />
              Detalhes técnicos
            </button>
            {window.electronAPI?.openDiagnosticsFolder && (
              <button
                type="button"
                onClick={() => void window.electronAPI?.openDiagnosticsFolder?.()}
                className="geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-500/70 px-4 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                <FolderOpen aria-hidden="true" />
                Abrir logs locais
              </button>
            )}
          </div>
          {showDetails && (
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/10 p-3 text-xs" tabIndex={0}>
              {technicalDetail(error)}
            </pre>
          )}
        </div>
      </div>
    </section>
  );

  if (!fullScreen) {
    return <div className="fixed inset-x-3 top-3 z-[250] mx-auto max-w-4xl">{content}</div>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-2xl">{content}</div>
    </main>
  );
}
