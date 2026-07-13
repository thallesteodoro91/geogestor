import type { ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { cn } from '../utils/cn';

interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn('geo-surface p-4', className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 text-wrap dark:text-zinc-200">
              {title}
            </h4>
          )}
          {description && (
            <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-500 text-pretty dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface FormFieldProps {
  htmlFor?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ htmlFor, label, required, hint, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
        {required && (
          <>
            <span className="ml-1 text-rose-500" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> obrigatório</span>
          </>
        )}
      </label>
      <div className="min-w-0">{children}</div>
      {hint && !error && <p className="mt-1.5 text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs font-semibold leading-5 text-rose-600 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface FormErrorProps {
  message?: string;
  className?: string;
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-lg border border-brand-red-200 bg-brand-red-50 px-4 py-3 text-sm font-semibold leading-5 text-brand-red-700 dark:border-brand-red-400/25 dark:bg-brand-red-500/10 dark:text-brand-red-100',
        className
      )}
      role="alert"
    >
      <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="bold" aria-hidden="true" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

interface FormFooterProps {
  children: ReactNode;
  className?: string;
}

export function FormFooter({ children, className }: FormFooterProps) {
  return (
    <div className={cn('sticky bottom-0 z-10 -mx-1 mt-2 flex items-center justify-end gap-3 border-t border-brand-border bg-brand-surface/95 px-1 py-4 backdrop-blur', className)}>
      {children}
    </div>
  );
}
