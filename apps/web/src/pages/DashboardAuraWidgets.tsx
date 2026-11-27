import { ArrowRight } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { AuraAttentionWidget, AuraProgressWidget, AuraWidget } from '../components/AuraWidget';
import './dashboard-aura.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const deadlineDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const percentage = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export function DashboardDeadlineWidget({ title, context, kind, date, dateTime, days, status, href }: {
  title: string;
  context: string;
  kind: string;
  date: Date;
  dateTime: string;
  days: number;
  status: string;
  href: string;
}) {
  const distance = Math.abs(days);
  return (
    <AuraAttentionWidget
      headingId="dashboard-featured-deadline"
      className="dashboard-aura--deadline w-full max-w-[200px]"
      label={days < 0 ? 'Prazo em atraso' : 'Prazo em destaque'}
      context={`${kind} · ${context}`}
      value={<p className="aura-widget__value aura-attention__relative">
        <span aria-hidden="true">{days === 0 ? 'Hoje' : <>{number.format(distance)} <span className="text-xl tracking-normal">{distance === 1 ? 'dia' : 'dias'}</span></>}</span>
        <span className="sr-only">{status}</span>
      </p>}
      detail={title}
      date={{ iso: dateTime, label: deadlineDate.format(date) }}
      action={<Link to={href} className="geo-focus-ring aura-attention__overlay" aria-label={`Abrir ${kind.toLocaleLowerCase('pt-BR')}: ${title}`} />}
    />
  );
}

export function DashboardProjectDistributionWidget({ items, total }: {
  items: Array<{ name: string; value: number }>;
  total: number;
}) {
  return (
    <AuraWidget as="article" aria-labelledby="dashboard-project-distribution-summary" tone="blue" className="dashboard-aura dashboard-aura--distribution">
      <header className="dashboard-aura__distribution-header">
        <h3 id="dashboard-project-distribution-summary">Distribuição de projetos</h3>
        <Link to="/projetos" className="geo-focus-ring dashboard-aura__distribution-link">Ver projetos <ArrowRight size={12} aria-hidden="true" /></Link>
      </header>
      <ul className="dashboard-aura__distribution-list">
        {items.map(({ name, value }) => {
          const share = value / total;
          return (
            <li key={name}>
              <span className="dashboard-aura__distribution-label">{name}</span>
              <span className="dashboard-aura__distribution-track" aria-hidden="true">
                <span style={{ width: `${share * 100}%` }} />
              </span>
              <span className="dashboard-aura__distribution-percent">
                {percentage.format(share)}
                <span className="sr-only"> · {number.format(value)} {value === 1 ? 'projeto' : 'projetos'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </AuraWidget>
  );
}

function DashboardCashLegendRow({ cents, series, label, suffix }: {
  cents: number;
  series: 'entry' | 'exit';
  label: string;
  suffix?: string;
}) {
  const amount = currency.format(cents / 100);
  return (
    <div data-long-amount={amount.length > 13 || undefined}>
      <dt>
        <span className={`dashboard-aura__${series}`} aria-hidden="true" />
        <span>{label}{suffix && <span className="dashboard-aura__cash-label-suffix"> {suffix}</span>}</span>
      </dt>
      <dd>{amount}</dd>
    </div>
  );
}

export function DashboardCashWidget({ received, paid }: { received: number; paid: number }) {
  const totalMovement = Math.abs(received) + Math.abs(paid);
  return (
    <AuraWidget aria-labelledby="dashboard-cash-summary" tone="teal" className="dashboard-aura dashboard-aura--cash">
      <h3 id="dashboard-cash-summary">Fluxo de caixa</h3>
      <div className="dashboard-aura__stack" aria-hidden="true">
        {totalMovement > 0 && (
          <>
            {paid !== 0 && <span className="dashboard-aura__exit" style={{ flexGrow: Math.abs(paid) / totalMovement }} />}
            {received !== 0 && <span className="dashboard-aura__entry" style={{ flexGrow: Math.abs(received) / totalMovement }} />}
          </>
        )}
      </div>
      <dl className="dashboard-aura__cash-values">
        <DashboardCashLegendRow cents={received} series="entry" label="Recebido" />
        <DashboardCashLegendRow cents={paid} series="exit" label="Despesas" suffix="pagas" />
      </dl>
      <p className="sr-only">As barras comparam a magnitude dos dois valores.</p>
    </AuraWidget>
  );
}

export function DashboardCompletionWidget({ completed, pending, total, rate }: {
  completed: number;
  pending: number;
  total: number;
  rate: number;
}) {
  return (
    <AuraProgressWidget
      className="dashboard-aura--completion"
      headingId="dashboard-task-completion-value"
      label="Tarefas concluídas"
      context={total > 0 ? `${number.format(total)} no período` : undefined}
      value={total > 0 ? `${number.format(rate)}%` : 'Sem tarefas com prazo neste período.'}
      badge={total > 0 ? `${number.format(completed)} ${completed === 1 ? 'concluída' : 'concluídas'}` : undefined}
      detail={total > 0 ? `${number.format(pending)} ${pending === 1 ? 'pendente' : 'pendentes'}` : undefined}
      fraction={total > 0 ? rate / 100 : undefined}
    />
  );
}
