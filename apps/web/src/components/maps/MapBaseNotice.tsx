import { ArrowClockwise, MapTrifold } from '@phosphor-icons/react';

interface MapBaseNoticeProps {
  unavailable: boolean;
  onRetry: () => void;
  mode?: 'online' | 'offline' | 'neutral';
}

export function MapBaseNotice({ unavailable, onRetry, mode = 'online' }: MapBaseNoticeProps) {
  if (mode === 'offline') return (
    <div role="status" className="absolute left-3 top-3 z-[1000] rounded-lg border border-emerald-300 bg-emerald-50/95 px-3 py-2 text-xs font-semibold text-emerald-900 shadow dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100">
      Mapa-base MBTiles local · offline
    </div>
  );
  if (mode === 'neutral') return (
    <div role="status" className="absolute left-3 top-3 z-[1000] rounded-lg border border-sky-300 bg-sky-50/95 px-3 py-2 text-xs font-semibold text-sky-900 shadow dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100">
      Grade de referência local · sem mapa-base
    </div>
  );
  if (!unavailable) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-x-3 top-3 z-[1000] rounded-lg border border-amber-300 bg-amber-50/95 p-3 text-amber-950 shadow-lg backdrop-blur-sm dark:border-amber-700 dark:bg-amber-950/95 dark:text-amber-50"
    >
      <div className="flex items-start gap-2">
        <MapTrifold aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Mapa-base indisponível</p>
          <p className="mt-0.5 text-xs leading-5">
            A camada do OpenStreetMap depende da internet. Marcadores, geometrias e dados próprios continuam visíveis quando disponíveis.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="geo-focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-amber-500 px-3 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <ArrowClockwise aria-hidden="true" />
          Recarregar
        </button>
      </div>
    </div>
  );
}
