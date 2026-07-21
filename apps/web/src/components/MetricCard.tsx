import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../utils/cn';
import {
  geoGreenAccentClass,
  geoGreenIconClass,
  geoGreenLabelClass,
  geoGreenSurfaceClass,
  geoGreenValueClass,
  geoOrangeAccentClass,
  geoOrangeIconClass,
  geoOrangeLabelClass,
  geoOrangeSurfaceClass,
  geoOrangeValueClass,
  geoPurpleAccentClass,
  geoPurpleIconClass,
  geoPurpleLabelClass,
  geoPurpleSurfaceClass,
  geoPurpleValueClass
} from '../utils/geoTheme';

export type MetricTone =
  | 'ambiental'
  | 'topografia'
  | 'geral'
  | 'positive'
  | 'warning'
  | 'danger';

export type MetricSurfaceTone = 'semantic' | 'brand' | 'success';

const toneClasses: Record<MetricTone, { card: string; accent: string; icon: string; label: string; value: string }> = {
  ambiental: {
    card: geoGreenSurfaceClass,
    accent: geoGreenAccentClass,
    icon: geoGreenIconClass,
    label: geoGreenLabelClass,
    value: geoGreenValueClass
  },
  topografia: {
    card: geoOrangeSurfaceClass,
    accent: geoOrangeAccentClass,
    icon: 'bg-brand-rajah-50 text-brand-rajah-800 ring-brand-rajah-300/80 dark:bg-brand-rajah-500/12 dark:text-brand-rajah-100 dark:ring-brand-rajah-300/20',
    label: 'text-zinc-500 dark:text-zinc-400',
    value: 'text-zinc-950 dark:text-white'
  },
  geral: {
    card: geoOrangeSurfaceClass,
    accent: geoOrangeAccentClass,
    icon: geoOrangeIconClass,
    label: geoOrangeLabelClass,
    value: geoOrangeValueClass
  },
  positive: {
    card: geoGreenSurfaceClass,
    accent: geoGreenAccentClass,
    icon: geoGreenIconClass,
    label: geoGreenLabelClass,
    value: geoGreenValueClass
  },
  warning: {
    card: geoOrangeSurfaceClass,
    accent: geoOrangeAccentClass,
    icon: 'bg-brand-rajah-50 text-brand-rajah-800 ring-brand-rajah-300/80 dark:bg-brand-rajah-500/12 dark:text-brand-rajah-100 dark:ring-brand-rajah-300/20',
    label: 'text-zinc-500 dark:text-zinc-400',
    value: 'text-zinc-950 dark:text-white'
  },
  danger: {
    card: geoPurpleSurfaceClass,
    accent: geoPurpleAccentClass,
    icon: geoPurpleIconClass,
    label: geoPurpleLabelClass,
    value: geoPurpleValueClass
  }
};
const surfaceToneClasses: Record<Exclude<MetricSurfaceTone, 'semantic'>, { card: string; accent: string }> = {
  brand: {
    card: geoPurpleSurfaceClass,
    accent: geoPurpleAccentClass
  },
  success: {
    card: geoGreenSurfaceClass,
    accent: geoGreenAccentClass
  }
};

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: MetricTone;
  surfaceTone?: MetricSurfaceTone;
  delay?: number;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  tone = 'geral',
  surfaceTone = 'semantic',
  delay = 0,
  className
}: MetricCardProps) {
  const reduceMotion = useReducedMotion();
  const styles = toneClasses[tone];
  const surfaceStyles = surfaceTone === 'semantic' ? styles : surfaceToneClasses[surfaceTone];
  const isOrangeSurface = surfaceStyles.card === geoOrangeSurfaceClass;
  const isGreenSurface = surfaceStyles.card === geoGreenSurfaceClass;
  const labelClass = isOrangeSurface ? geoOrangeLabelClass : isGreenSurface ? geoGreenLabelClass : styles.label;
  const valueClass = isOrangeSurface ? geoOrangeValueClass : isGreenSurface ? geoGreenValueClass : styles.value;
  const iconClass = isOrangeSurface ? geoOrangeIconClass : isGreenSurface ? geoGreenIconClass : styles.icon;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
      className={cn(
        'geo-card-interactive group relative flex min-h-[140px] min-w-0 flex-col justify-between overflow-hidden p-6',
        surfaceStyles.card,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 h-1',
          surfaceStyles.accent === geoPurpleAccentClass || surfaceStyles.accent === geoOrangeAccentClass || surfaceStyles.accent === geoGreenAccentClass
            ? surfaceStyles.accent
            : cn('bg-gradient-to-r', surfaceStyles.accent)
        )}
      />
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
        <span className={cn('block min-w-0 break-words text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]', labelClass)}>
          {label}
        </span>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 sm:h-10 sm:w-10', iconClass)}>
          {icon}
        </span>
      </div>
      <span className="min-w-0">
        <span className={cn('block truncate text-3xl font-semibold tracking-tight tabular-nums', valueClass)}>
          {value}
        </span>
      </span>
    </motion.article>
  );
}
