import { useEffect, useState } from 'react';
import { ArrowCounterClockwise, Palette } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';
import { geoPanelClass } from '../../utils/geoTheme';

type ThemePreference = 'light' | 'dark' | 'system';

function applyTheme(preference: ThemePreference) {
  const shouldUseDark = preference === 'dark'
    || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', shouldUseDark);
  document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
}

export function AppearanceSettingsPanel() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('geogestor_theme');
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });

  const handleSetTheme = (newTheme: ThemePreference) => {
    setTheme(newTheme);
    localStorage.setItem('geogestor_theme', newTheme);
    applyTheme(newTheme);
    window.dispatchEvent(new Event('geogestor:theme-change'));
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  const panelClass = cn(
    geoPanelClass,
    'relative overflow-hidden rounded-2xl p-5 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
  );

  return (
    <div className={cn(panelClass, 'space-y-4')} aria-labelledby="appearance-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <h2 id="appearance-title" className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
          <Palette aria-hidden="true" className="h-5 w-5 text-zinc-400" /> Preferências visuais
        </h2>
        <button
          type="button"
          onClick={() => {
            if (theme === 'system') return;
            if (window.confirm('Restaurar o tema padrão do GeoGestor e acompanhar o tema do Windows?')) {
              handleSetTheme('system');
              toast.success('Tema padrão restaurado.');
            }
          }}
          disabled={theme === 'system'}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-default disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <ArrowCounterClockwise aria-hidden="true" size={16} /> Restaurar padrão
        </button>
      </div>

      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tema do Sistema</span>
        <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Tema do sistema">
          <button
            type="button"
            onClick={() => handleSetTheme('light')}
            aria-pressed={theme === 'light'}
            className={`rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] ${
              theme === 'light'
                ? 'border-brand-primary-200 bg-gradient-to-br from-brand-primary-50 via-white to-brand-turquoise-50 ring-2 ring-brand-primary-300/45 dark:border-brand-primary-300/20 dark:from-brand-primary-400/15 dark:via-zinc-900 dark:to-brand-turquoise-400/10 dark:ring-brand-primary-300/20'
                : 'border-zinc-100 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-950 dark:text-white">Claro</span>
            <span className="mt-1 block text-xs text-zinc-400">Aparência clássica minimalista em tons de branco.</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetTheme('dark')}
            aria-pressed={theme === 'dark'}
            className={`rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] ${
              theme === 'dark'
                ? 'border-brand-indigo-200 bg-gradient-to-br from-brand-indigo-50 via-white to-brand-blue-50 ring-2 ring-brand-indigo-300/45 dark:border-brand-indigo-300/20 dark:from-brand-indigo-400/15 dark:via-zinc-900 dark:to-brand-blue-400/10 dark:ring-brand-indigo-300/20'
                : 'border-zinc-100 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-950 dark:text-white">Tema Escuro</span>
            <span className="mt-1 block text-xs text-zinc-400">Modo escuro para melhor legibilidade noturna.</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetTheme('system')}
            aria-pressed={theme === 'system'}
            className={`rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] ${
              theme === 'system'
                ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-300/45 dark:border-sky-700 dark:bg-sky-950/30 dark:ring-sky-700/40'
                : 'border-zinc-100 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-950 dark:text-white">Usar o sistema</span>
            <span className="mt-1 block text-xs text-zinc-400">Acompanha automaticamente o tema do Windows.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
