import { CheckCircle, Info, Prohibit } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

export type TechnicalReliability = 'technical' | 'review' | 'blocked';

const config = {
  technical: { label: 'Técnico', icon: CheckCircle, className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' },
  review: { label: 'Conferência', icon: Info, className: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-200' },
  blocked: { label: 'Bloqueado', icon: Prohibit, className: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-500/10 dark:text-red-200' },
} as const;

export function TechnicalResultBadge({ reliability, description }: { reliability: TechnicalReliability; description: string }) {
  const resolved = config[reliability];
  const Icon = resolved.icon;
  return <span title={description} aria-label={`${resolved.label}: ${description}`} className={cn('inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-wide', resolved.className)}><Icon className="h-4 w-4" aria-hidden="true" />{resolved.label}</span>;
}
