import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { geoKickerClass } from '../utils/geoTheme';

interface PageHeaderProps {
  title: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  navigation?: ReactNode;
  className?: string;
  frameClassName?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  navigationClassName?: string;
}

export function PageHeader({
  title,
  count,
  description,
  eyebrow,
  icon,
  action,
  navigation,
  className,
  frameClassName,
  iconClassName,
  titleClassName,
  descriptionClassName,
  navigationClassName,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 min-w-0 max-w-full', className)}>
      <div className={cn('mx-auto w-full min-w-0 max-w-[1400px]', frameClassName)}>
        {eyebrow ? (
          <div className="mb-3">
            {typeof eyebrow === 'string' ? <span className={geoKickerClass}>{eyebrow}</span> : eyebrow}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                'flex min-w-0 items-center gap-3 text-3xl font-semibold leading-10 tracking-tight text-zinc-950 dark:text-white sm:text-4xl',
                titleClassName,
              )}
            >
              {icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary-50 text-brand-primary-700 ring-1 ring-brand-primary-200/70 dark:bg-brand-primary-400/15 dark:text-brand-primary-100 dark:ring-brand-primary-300/20',
                    iconClassName,
                  )}
                >
                  {icon}
                </span>
              ) : null}
              <span className="min-w-0 break-words text-pretty">
                {title}
                {count !== undefined && count !== null ? (
                  <span className="text-zinc-600 dark:text-zinc-300"> · {count}</span>
                ) : null}
              </span>
            </h1>
            {description ? (
              <p
                className={cn(
                  'mt-2 max-w-3xl break-words text-sm font-medium leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base',
                  descriptionClassName,
                )}
              >
                {description}
              </p>
            ) : null}
          </div>

          {action ? <div className="min-w-0 shrink-0 self-start sm:self-auto">{action}</div> : null}
        </div>

        {navigation ? (
          <div className={cn('mt-6 min-w-0', navigationClassName)}>
            {navigation}
          </div>
        ) : null}
      </div>
    </header>
  );
}
