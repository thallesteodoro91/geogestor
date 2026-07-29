import { cn } from './cn';

export type GeoTone = 'system' | 'field' | 'finance' | 'success' | 'warning' | 'danger';

const activeTabTone: Record<GeoTone, string> = {
  system:
    'bg-gradient-to-r from-brand-primary-50 via-brand-indigo-50 to-brand-blue-50 text-brand-primary-700 ring-brand-primary-200/70 dark:from-brand-primary-400/15 dark:via-brand-indigo-400/10 dark:to-brand-blue-400/15 dark:text-brand-primary-100 dark:ring-brand-primary-300/15',
  field:
    'bg-gradient-to-r from-brand-turquoise-50 via-brand-blue-50 to-brand-green-50 text-brand-turquoise-800 ring-brand-turquoise-200/70 dark:from-brand-turquoise-400/15 dark:via-brand-blue-400/10 dark:to-brand-green-400/15 dark:text-brand-turquoise-100 dark:ring-brand-turquoise-300/15',
  finance:
    'bg-gradient-to-r from-brand-green-50 via-brand-turquoise-50 to-brand-blue-50 text-brand-green-700 ring-brand-green-200/70 dark:from-brand-green-400/15 dark:via-brand-turquoise-400/10 dark:to-brand-blue-400/15 dark:text-brand-green-100 dark:ring-brand-green-300/15',
  success:
    'bg-gradient-to-r from-brand-green-50 via-brand-turquoise-50 to-brand-green-100 text-brand-green-700 ring-brand-green-200/70 dark:from-brand-green-400/15 dark:via-brand-turquoise-400/10 dark:to-brand-green-300/15 dark:text-brand-green-100 dark:ring-brand-green-300/15',
  warning:
    'bg-gradient-to-r from-brand-rajah-50 via-brand-rajah-100 to-brand-coral-50 text-brand-rajah-900 ring-brand-rajah-300/70 dark:from-brand-rajah-400/15 dark:via-brand-rajah-500/10 dark:to-brand-coral-400/15 dark:text-brand-rajah-100 dark:ring-brand-rajah-300/15',
  danger:
    'bg-gradient-to-r from-brand-red-50 via-brand-coral-50 to-brand-red-100 text-brand-red-700 ring-brand-red-200/70 dark:from-brand-red-400/15 dark:via-brand-coral-400/10 dark:to-brand-red-500/15 dark:text-brand-red-100 dark:ring-brand-red-300/15',
};

export const geoTabListClass =
  'geo-surface p-1.5 backdrop-blur';

export function geoTabButtonClass(active: boolean, tone: GeoTone = 'system', className?: string) {
  return cn(
    'geo-focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold outline-none ring-1 ring-transparent',
    active
      ? cn('shadow-sm', activeTabTone[tone])
      : 'text-zinc-600 hover:bg-brand-surface hover:text-zinc-950 hover:shadow-brand dark:text-zinc-300 dark:hover:bg-brand-surface-muted dark:hover:text-zinc-100',
    className
  );
}

const tabIconTone: Record<GeoTone, string> = {
  system:
    'bg-brand-indigo-100/80 text-brand-indigo-700 ring-brand-indigo-200/80 dark:bg-brand-indigo-400/15 dark:text-brand-indigo-200 dark:ring-brand-indigo-300/20',
  field:
    'bg-brand-turquoise-100/80 text-brand-turquoise-800 ring-brand-turquoise-200/80 dark:bg-brand-turquoise-400/15 dark:text-brand-turquoise-200 dark:ring-brand-turquoise-300/20',
  finance:
    'bg-brand-green-100/80 text-brand-green-700 ring-brand-green-200/80 dark:bg-brand-green-400/15 dark:text-brand-green-200 dark:ring-brand-green-300/20',
  success:
    'bg-brand-green-100/80 text-brand-green-700 ring-brand-green-200/80 dark:bg-brand-green-400/15 dark:text-brand-green-200 dark:ring-brand-green-300/20',
  warning:
    'bg-brand-rajah-100/80 text-brand-rajah-900 ring-brand-rajah-300/70 dark:bg-brand-rajah-400/15 dark:text-brand-rajah-100 dark:ring-brand-rajah-300/20',
  danger:
    'bg-brand-red-100/80 text-brand-red-700 ring-brand-red-200/80 dark:bg-brand-red-400/15 dark:text-brand-red-200 dark:ring-brand-red-300/20',
};

const activeTabIconTone: Record<GeoTone, string> = {
  system: 'bg-brand-indigo-200 text-brand-indigo-800 dark:bg-brand-indigo-400/25 dark:text-brand-indigo-100',
  field: 'bg-brand-turquoise-200 text-brand-turquoise-900 dark:bg-brand-turquoise-400/25 dark:text-brand-turquoise-100',
  finance: 'bg-brand-green-200 text-brand-green-800 dark:bg-brand-green-400/25 dark:text-brand-green-100',
  success: 'bg-brand-green-200 text-brand-green-800 dark:bg-brand-green-400/25 dark:text-brand-green-100',
  warning: 'bg-brand-rajah-200 text-brand-rajah-950 dark:bg-brand-rajah-400/25 dark:text-brand-rajah-50',
  danger: 'bg-brand-red-200 text-brand-red-800 dark:bg-brand-red-400/25 dark:text-brand-red-100',
};

export function geoTabIconClass(active: boolean, tone: GeoTone = 'system', className?: string) {
  return cn(
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
    active ? activeTabIconTone[tone] : tabIconTone[tone],
    active && 'shadow-sm ring-current/20',
    className
  );
}

export const geoFieldClass =
  'geo-field outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:placeholder:text-zinc-400';

export const geoPanelClass =
  'geo-surface backdrop-blur';

export const geoKickerClass =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent bg-[#5146e8] px-3 text-sm font-semibold leading-none tracking-normal text-white shadow-none before:text-[12px] before:font-bold before:leading-none before:text-white before:content-['✓'] dark:bg-[#5146e8] dark:text-white";

export const geoPurpleSurfaceClass = 'geo-purple-surface';
export const geoPurpleSurfaceWithAccentClass = 'geo-purple-surface geo-purple-top-accent';
export const geoPurpleAccentClass = 'geo-purple-accent';
export const geoPurpleIconClass = 'geo-purple-icon ring-white/15';
export const geoPurpleLabelClass = 'text-violet-100/85';
export const geoPurpleValueClass = 'text-white';
export const geoOrangeSurfaceClass = 'geo-orange-surface';
export const geoOrangeSurfaceWithAccentClass = 'geo-orange-surface geo-orange-top-accent';
export const geoOrangeAccentClass = 'geo-orange-accent';
export const geoOrangeIconClass = 'geo-orange-icon ring-white/15';
export const geoOrangeLabelClass = 'text-orange-100/85';
export const geoOrangeValueClass = 'text-white';
export const geoGreenSurfaceClass = 'geo-green-surface';
export const geoGreenSurfaceWithAccentClass = 'geo-green-surface geo-green-top-accent';
export const geoGreenAccentClass = 'geo-green-accent';
export const geoGreenIconClass = 'geo-green-icon ring-white/15';
export const geoGreenLabelClass = 'text-emerald-100/85';
export const geoGreenValueClass = 'text-white';
