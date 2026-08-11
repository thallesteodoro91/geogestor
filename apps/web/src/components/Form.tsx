import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Check, Minus, WarningCircle } from '@phosphor-icons/react';
import { cn } from '../utils/cn';

export { ComboboxField, FormSelect, SelectField } from './form-controls/SelectField';
export { DatePickerField } from './form-controls/DatePickerField';
export { PopoverSurface } from './form-controls/PopoverSurface';
export { TimePickerField } from './form-controls/TimePickerField';
export { NumericInput } from './form-controls/NumericInput';

export type FormSectionTone = 'indigo' | 'cyan' | 'amber' | 'emerald' | 'slate';

interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  sectionId?: string;
  icon?: ReactNode;
  tone?: FormSectionTone;
  optional?: boolean;
}

const sectionToneClasses: Record<FormSectionTone, {
  accent: string;
  icon: string;
  title: string;
}> = {
  indigo: {
    accent: 'bg-indigo-500 dark:bg-indigo-400',
    icon: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-300/20',
    title: 'text-indigo-950 dark:text-indigo-100'
  },
  cyan: {
    accent: 'bg-cyan-500 dark:bg-cyan-400',
    icon: 'bg-cyan-50 text-cyan-700 ring-cyan-200/80 dark:bg-cyan-400/15 dark:text-cyan-200 dark:ring-cyan-300/20',
    title: 'text-cyan-950 dark:text-cyan-100'
  },
  amber: {
    accent: 'bg-amber-500 dark:bg-amber-400',
    icon: 'bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/20',
    title: 'text-amber-950 dark:text-amber-100'
  },
  emerald: {
    accent: 'bg-emerald-500 dark:bg-emerald-400',
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-300/20',
    title: 'text-emerald-950 dark:text-emerald-100'
  },
  slate: {
    accent: 'bg-slate-500 dark:bg-slate-400',
    icon: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-300/20',
    title: 'text-slate-950 dark:text-slate-100'
  }
};

export function FormSection({
  title,
  description,
  children,
  className,
  sectionId,
  icon,
  tone = 'slate',
  optional = false
}: FormSectionProps) {
  const toneClasses = sectionToneClasses[tone];

  if (icon) {
    const headingId = sectionId ? `${sectionId}-title` : undefined;
    return (
      <section
        id={sectionId}
        aria-labelledby={headingId}
        className={cn('relative scroll-mt-20 overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-sm', className)}
      >
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', toneClasses.accent)} />
        <header className="flex items-start gap-3 border-b border-brand-border bg-brand-surface-subtle/35 px-4 py-3.5 pl-5 sm:px-5 sm:pl-6">
          <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1', toneClasses.icon)}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {title && <h4 id={headingId} className={cn('text-base font-bold tracking-tight', toneClasses.title)}>{title}</h4>}
              {optional && (
                <span className="rounded-full border border-brand-border bg-brand-surface px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-300">
                  Opcional
                </span>
              )}
            </div>
            {description && <p className="mt-0.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
        </header>
        <div className="space-y-4 p-4 pl-5 sm:p-5 sm:pl-6">{children}</div>
      </section>
    );
  }

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
  label: ReactNode;
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
      {hint && !error && <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="mt-1.5 text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p>}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs font-semibold leading-5 text-rose-600 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface CheckboxFieldProps {
  id?: string;
  name?: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  error?: string;
  compact?: boolean;
  labelHidden?: boolean;
  className?: string;
}

export function CheckboxField({
  id,
  name,
  label,
  checked,
  onChange,
  disabled = false,
  indeterminate = false,
  error,
  compact = false,
  labelHidden = false,
  className
}: CheckboxFieldProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className={cn(compact ? 'w-fit' : 'w-full', className)}>
      <label
        htmlFor={inputId}
        className={cn(
          'group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-text-secondary transition-[background-color,color] duration-150',
          'hover:bg-brand-surface-subtle hover:text-text-primary',
          disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
          error && 'text-rose-700 dark:text-rose-200'
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border bg-brand-surface text-white shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-150',
            'border-brand-border group-hover:border-brand-primary-400 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-zinc-900',
            (checked || indeterminate) && 'border-brand-primary-600 bg-brand-primary-600 dark:border-brand-primary-400 dark:bg-brand-primary-500',
            error && 'border-rose-500 peer-focus-visible:ring-rose-500',
            !disabled && 'group-active:scale-95'
          )}
        >
          {indeterminate ? <Minus size={13} weight="bold" /> : checked ? <Check size={13} weight="bold" /> : null}
        </span>
        <span className={cn('min-w-0 leading-snug', labelHidden && 'sr-only')}>{label}</span>
      </label>
      {error && <p id={`${inputId}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{error}</p>}
    </div>
  );
}

interface SwitchFieldProps {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
  tone?: 'indigo' | 'emerald';
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function SwitchField({
  id,
  name,
  label,
  checked,
  onChange,
  disabled = false,
  disabledHint,
  tone = 'indigo',
  icon,
  compact = false,
  className
}: SwitchFieldProps) {
  const enabledTrack = tone === 'emerald'
    ? 'bg-emerald-500 dark:bg-emerald-400'
    : 'bg-indigo-600 dark:bg-indigo-400';

  return (
    <label
      htmlFor={id}
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 transition-[background-color,border-color,color,box-shadow] duration-150',
        compact ? 'w-fit' : 'w-full',
        disabled
          ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300'
          : 'cursor-pointer border-brand-border bg-brand-surface text-zinc-700 hover:border-brand-primary-300/70 hover:bg-brand-surface-subtle dark:text-zinc-200',
        className
      )}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full ring-1 ring-inset transition-[background-color,box-shadow] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-zinc-900',
          checked && !disabled ? enabledTrack : 'bg-zinc-300 ring-zinc-400/50 dark:bg-zinc-600 dark:ring-zinc-500'
        )}
      >
        <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 dark:bg-zinc-100', checked && 'translate-x-5')} />
      </span>
      {icon && (
        <span aria-hidden="true" className={cn('shrink-0', checked && !disabled && tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-500 dark:text-zinc-300')}>
          {icon}
        </span>
      )}
      <span className="min-w-0 text-sm font-semibold leading-snug">
        {label}
        {disabled && disabledHint && <span className="mt-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{disabledHint}</span>}
      </span>
    </label>
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
