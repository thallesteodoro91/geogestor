import { Info, Question } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { readSharedDataNoticePreference, writeSharedDataNoticePreference } from './sharedDataNoticePreference';

export function SharedDataNotice({
  title = 'Informações compartilhadas',
  children,
  action,
  preferenceKey
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  preferenceKey?: string;
}) {
  const [hidden, setHidden] = useState(() => preferenceKey ? readSharedDataNoticePreference(preferenceKey) : false);
  const setPreference = (nextHidden: boolean) => {
    setHidden(nextHidden);
    if (preferenceKey) writeSharedDataNoticePreference(preferenceKey, nextHidden);
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setPreference(false)}
        aria-label={`Mostrar novamente: ${title}`}
        className="geo-button-base geo-focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-400/20 dark:bg-sky-400/[0.08] dark:text-sky-200"
      >
        <Question aria-hidden="true" className="h-4 w-4" />
        Como estes dados funcionam?
      </button>
    );
  }

  return (
    <aside
      aria-label={title}
      className="flex flex-col gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sky-950 shadow-sm dark:border-sky-400/20 dark:bg-sky-400/[0.08] dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Info aria-hidden="true" weight="duotone" className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <div className="mt-0.5 text-xs leading-relaxed text-sky-800 dark:text-sky-200/80">{children}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {action}
        {preferenceKey && (
          <button type="button" onClick={() => setPreference(true)} className="geo-button-base geo-focus-ring min-h-9 rounded-lg border border-sky-300/70 px-3 text-xs font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-300/25 dark:text-sky-100 dark:hover:bg-sky-300/10">
            Entendi, ocultar
          </button>
        )}
      </div>
    </aside>
  );
}
