import { ArrowClockwise, MapTrifold } from '@phosphor-icons/react';

interface MapBaseNoticeProps {
  unavailable: boolean;
  onRetry: () => void;
}

export function MapBaseNotice({ unavailable, onRetry }: MapBaseNoticeProps) {
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
