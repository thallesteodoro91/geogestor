import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export function WidgetSection({ id, title, className, contentClassName, children }: {
  id: string;
  title: string;
  className?: string;
  contentClassName: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 border-t border-brand-border pt-5 sm:pt-6', className)}>
      <h2 id={id} className="mb-4 text-lg font-semibold text-text-primary sm:mb-5">{title}</h2>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
