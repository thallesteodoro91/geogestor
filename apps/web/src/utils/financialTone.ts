import { cn } from './cn';

export type FinancialTone = 'revenue' | 'cost' | 'adjustment' | 'info' | 'neutral';

const valueToneClasses: Record<FinancialTone, string> = {
  revenue: 'text-emerald-700 dark:text-emerald-300',
  cost: 'text-rose-700 dark:text-rose-300',
  adjustment: 'text-amber-800 dark:text-amber-300',
  info: 'text-cyan-700 dark:text-cyan-300',
  neutral: 'text-text-primary'
};

const accentToneClasses: Record<FinancialTone, string> = {
  revenue: 'before:bg-emerald-500 dark:before:bg-emerald-400',
  cost: 'before:bg-rose-500 dark:before:bg-rose-400',
  adjustment: 'before:bg-amber-500 dark:before:bg-amber-400',
  info: 'before:bg-cyan-500 dark:before:bg-cyan-400',
  neutral: 'before:bg-zinc-400 dark:before:bg-zinc-500'
};

export function financialValueClass(tone: FinancialTone, className?: string) {
  return cn(valueToneClasses[tone], className);
}

export function financialMetricClass(tone: FinancialTone, className?: string) {
  return cn(
    'relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface-subtle/60 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1',
    accentToneClasses[tone],
    className
  );
}

export function signedFinancialTone(value: number | null | undefined): FinancialTone {
  if (value === null || value === undefined || value === 0) return 'neutral';
  return value > 0 ? 'revenue' : 'cost';
}
