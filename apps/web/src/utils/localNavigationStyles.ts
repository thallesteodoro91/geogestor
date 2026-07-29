import { cn } from './cn';
import {
  geoTabButtonClass,
  geoTabIconClass,
  type GeoTone,
} from './geoTheme';

export const localNavigationBarClass =
  'max-w-full min-w-0 overflow-x-auto overscroll-x-contain border-b border-zinc-200 pb-4 dark:border-zinc-800';

export const localNavigationItemsClass =
  'flex min-w-max items-center gap-3';

export function localNavigationButtonClass(
  active: boolean,
  tone: GeoTone = 'system',
  className?: string,
) {
  return geoTabButtonClass(
    active,
    tone,
    cn(
      'min-h-11 rounded-full px-5 py-2.5 ring-0 shadow-none sm:px-6',
      className,
    ),
  );
}

export function localNavigationIconClass(
  active: boolean,
  tone: GeoTone = 'system',
  className?: string,
) {
  return geoTabIconClass(
    active,
    tone,
    cn('h-8 w-8 rounded-xl ring-0 shadow-none', className),
  );
}
