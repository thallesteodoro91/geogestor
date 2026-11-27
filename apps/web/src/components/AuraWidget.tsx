import { useId, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { cn } from '../utils/cn';
import './aura-widget.css';

export type AuraTone = 'rose' | 'coral' | 'blue' | 'violet' | 'amber' | 'magenta' | 'plum' | 'teal' | 'gold';

export function AuraWidget({
  as: Element = 'section',
  tone,
  size,
  className,
  children,
  ...attributes
}: {
  as?: 'section' | 'article';
  tone: AuraTone;
  size?: 'medium' | 'large';
  className?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return <Element {...attributes} className={cn('aura-widget', className)} data-aura-tone={tone} data-aura-size={size}>{children}</Element>;
}

export function AuraProgressWidget({
  as,
  headingAs: Heading = 'h3',
  headingId,
  className,
  label,
  context,
  value,
  badge,
  detail,
  fraction,
}: {
  as?: 'section' | 'article';
  headingAs?: 'h3' | 'h5';
  headingId?: string;
  className?: string;
  label: string;
  context?: ReactNode;
  value: string;
  badge?: string;
  detail?: string;
  fraction?: number;
}) {
  const generatedId = useId();
  const id = headingId ?? generatedId;
  return (
    <AuraWidget as={as} size="medium" tone="coral" className={cn('aura-progress-widget', className)} aria-labelledby={id}>
      <header className="aura-progress-widget__header">
        <Heading id={id}>{label}</Heading>
        {context && <p className="aura-progress-widget__context">{context}</p>}
      </header>
      <div className="aura-progress-widget__reading">
        <p className="aura-widget__value" data-unmeasured={fraction === undefined}>{value}</p>
        {badge && <p className="aura-progress-widget__badge">{badge}</p>}
        {detail && <p className="aura-progress-widget__context">{detail}</p>}
      </div>
      {fraction !== undefined && <AuraSteppedProgress fraction={fraction} />}
    </AuraWidget>
  );
}

export function AuraBalanceSummary({ className, headingId, label, value, currency = false, detail, icon, action }: {
  className?: string;
  headingId?: string;
  label: string;
  value: number;
  currency?: boolean;
  detail?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const generatedId = useId();
  const id = headingId ?? generatedId;

  return (
    <AuraWidget as="article" size="medium" tone="plum" className={cn('aura-balance-summary', className)} aria-labelledby={id}>
      {icon && <span className="aura-balance-summary__icon" aria-hidden="true">{icon}</span>}
      <div className="aura-balance-summary__footer">
        <div className="aura-balance-summary__reading">
          <h3 id={id}>{label}</h3>
          <AuraNumericValue value={value} currency={currency} />
        </div>
        {detail && <p className="aura-balance-summary__detail">{detail}</p>}
        {action}
      </div>
    </AuraWidget>
  );
}

const balanceCountFormat = new Intl.NumberFormat('pt-BR');
const balanceCurrencyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function AuraNumericValue({ value, currency = false }: { value: number; currency?: boolean }) {
  const parts = currency ? balanceCurrencyFormat.formatToParts((Number(value) || 0) / 100) : balanceCountFormat.formatToParts(value);
  const readParts = (...types: Intl.NumberFormatPartTypes[]) => parts.filter(part => types.includes(part.type)).map(part => part.value).join('');
  const integer = readParts('integer', 'group');
  const sign = readParts('minusSign', 'plusSign').replace('-', '−');
  const main = integer ? `${sign}${integer}` : parts.map(part => part.value).join('');
  const fraction = readParts('decimal', 'fraction');
  const prefix = readParts('currency');
  const numberWidth = [...main].reduce((width, character) => width + (character === '.' ? 0.26 : 0.6), 0);

  return (
    <p className="aura-amount" style={{ '--aura-number-width': numberWidth } as CSSProperties}>
      <span className="sr-only">{parts.map(part => part.value).join('')}</span>
      {prefix && <span className="aura-amount__unit" aria-hidden="true">{prefix}</span>}
      <span className="aura-amount__number" aria-hidden="true">
        <span className="aura-amount__integer">{main}</span>
        {fraction && <span className="aura-amount__fraction">{fraction}</span>}
      </span>
    </p>
  );
}

export function AuraMediumMetric({ className, label, value, currency = false, context, icon }: {
  className?: string;
  label: string;
  value: number;
  currency?: boolean;
  context?: string;
  icon: ReactNode;
}) {
  const headingId = useId();
  return (
    <AuraWidget as="article" size="medium" tone="blue" className={cn('aura-medium-metric', className)} aria-labelledby={headingId}>
      <header className="aura-medium-metric__header">
        <div>
          <h3 id={headingId}>{label}</h3>
          {context && <p className="aura-medium-metric__context">{context}</p>}
        </div>
        <span className="aura-medium-metric__icon" aria-hidden="true">{icon}</span>
      </header>
      <AuraNumericValue value={value} currency={currency} />
    </AuraWidget>
  );
}

export function AuraReceivedWidget({ value, context, className, compact = false, action }: {
  value: number;
  context: string;
  className?: string;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  const headingId = useId();
  return (
    <AuraWidget as="article" tone="rose" className={cn('aura-received', compact && 'aura-received--compact', className)} aria-labelledby={headingId}>
      <div className="aura-small-content">
        <div className="aura-received__reading">
          <h3 id={headingId}>Recebido</h3>
          <p className="aura-received__context">{context}</p>
          <AuraNumericValue value={value} currency />
        </div>
        {action && <button type="button" className="aura-received__action geo-focus-ring" onClick={action.onClick}>{action.label}</button>}
      </div>
    </AuraWidget>
  );
}

export function AuraSmallBalance({ className, headingId, label, value, currency = false, compact = false, icon, context, status, detail }: {
  className?: string;
  headingId?: string;
  label: string;
  value: number;
  currency?: boolean;
  compact?: boolean;
  icon: ReactNode;
  context?: string;
  status?: { label: string; tone: 'positive' | 'negative' | 'neutral' };
  detail?: string;
}) {
  const id = useId();
  const labelId = headingId ?? id;
  return (
    <AuraWidget as="article" tone="coral" className={cn('aura-small-balance', compact && 'aura-small-balance--compact', className)} aria-labelledby={labelId}>
      <div className="aura-small-content">
        <header className="aura-small-balance__header">
          <span className="aura-small-balance__icon" aria-hidden="true">{icon}</span>
          {status ? <p className="aura-small-balance__status" data-status={status.tone}>{status.label}</p> : context && <p className="aura-small-balance__context">{context}</p>}
        </header>
        <div className="aura-small-balance__reading">
          <AuraNumericValue value={value} currency={currency} />
          <h3 id={labelId}>{label}</h3>
          {detail && <p className="aura-small-balance__detail">{detail}</p>}
        </div>
      </div>
    </AuraWidget>
  );
}

export function AuraAttentionWidget({ as = 'article', headingAs: Heading = 'h3', headingId, className, label, context, value, detail, date, compact = false, action }: {
  as?: 'section' | 'article';
  headingAs?: 'h2' | 'h3';
  headingId?: string;
  className?: string;
  label: string;
  context?: string;
  value: ReactNode;
  detail?: string;
  date?: { iso: string; label: string };
  compact?: boolean;
  action?: ReactNode;
}) {
  const id = useId();
  const labelId = headingId ?? id;
  return (
    <AuraWidget as={as} tone="amber" className={cn('aura-attention', compact && 'aura-attention--compact', className)} aria-labelledby={labelId}>
      <div className="aura-small-content">
        <header className="aura-attention__header">
          <Heading id={labelId}>{label}</Heading>
          {context && <p className="aura-attention__context">{context}</p>}
        </header>
        <div className="aura-attention__reading">
          {value}
          {detail && <p className="aura-attention__detail">{detail}</p>}
          {date && (
            <div className="aura-attention__date">
              <time dateTime={date.iso}>{date.label}</time>
              <ArrowRight aria-hidden="true" size={16} />
            </div>
          )}
          {action}
        </div>
      </div>
    </AuraWidget>
  );
}

export function AuraProgress({ fraction }: { fraction: number }) {
  return (
    <div className="aura-widget__track" aria-hidden="true">
      <div className="aura-widget__fill" style={{ width: `${Math.min(1, Math.max(0, fraction)) * 100}%` }} />
    </div>
  );
}

function AuraSteppedProgress({ fraction }: { fraction: number }) {
  const progress = Math.min(1, Math.max(0, fraction));
  return (
    <div className="aura-stepped-progress" aria-hidden="true">
      <div className="aura-stepped-progress__steps" data-filled={progress > 0}>
        <span /><span /><span />
      </div>
      <div className="aura-stepped-progress__track">
        {progress > 0 && <span className="aura-stepped-progress__fill" style={{ flexGrow: progress }} />}
        {progress < 1 && <span style={{ flexGrow: 1 - progress }} />}
      </div>
    </div>
  );
}
