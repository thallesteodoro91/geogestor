import { APP_PATHS, type ManagerialReport } from '@geogestor/contracts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle,
  Coins,
  Warning
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { AuraAttentionWidget, AuraBalanceSummary, AuraNumericValue, AuraProgressWidget, AuraSmallBalance, AuraWidget } from '../../components/AuraWidget';
import { WidgetSection } from '../../components/WidgetSection';
import { cashBalancePresentation } from '../../utils/financialAnalytics';
import { reportAlertCopy } from './reportAlertCopy';
import { executiveSummary, executiveCashCopy, executiveAlerts, executiveAlertAction, executiveCriteria, formatPeriod, formatGeneratedAt, formatNumber } from './reportPresentation';

import './executive-report.css';

interface RelatorioExecutivoProps {
  report: ManagerialReport;
}

function ExecutiveDeadline({ id, label, value, currency, detail, attention }: {
  id: string;
  label: string;
  value: number;
  currency?: boolean;
  detail: string;
  attention: boolean;
}) {
  return (
    <AuraAttentionWidget
      headingId={id}
      label={label}
      context={attention ? 'Requer atenção' : undefined}
      value={<AuraNumericValue value={value} currency={currency} />}
      detail={detail}
    />
  );
}

export function RelatorioExecutivo({ report }: RelatorioExecutivoProps) {
  const { financial, operational } = report;
  const cashBalance = cashBalancePresentation(financial.kpis.cashResult);
  const alerts = executiveAlerts(report);
  const conversion = financial.kpis.conversionRate;
  const areaValue = operational.kpis.activeAreaHa;
  const areaReading = areaValue === null ? null : formatNumber(areaValue);
  const areaCoverage = areaValue !== null && operational.kpis.activeProjects > 0
    ? Math.min(1, operational.kpis.projectsWithKnownArea / operational.kpis.activeProjects)
    : null;
  const knownAreas = formatNumber(operational.kpis.projectsWithKnownArea);
  const activeProjects = formatNumber(operational.kpis.activeProjects);
  // Long readings need more than the 96px available inside the ring.
  const areaNeedsSpace = areaCoverage !== null && ((areaReading?.length ?? 0) > 8 || knownAreas.length + activeProjects.length > 10);

  return (
    <div className="executive-report grid gap-8 sm:gap-10">
      <section aria-labelledby="executive-summary-title" className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
        <h2 id="executive-summary-title" className="text-2xl font-semibold text-pretty">Resumo do período</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{formatPeriod(report)} · Gerado em {formatGeneratedAt(report.generatedAt)}</p>
        <ul className="executive-summary-grid mt-4 grid gap-3">
          {executiveSummary(report).map((summary) => (
            <li key={summary} className="rounded-2xl bg-white p-3 text-sm leading-6 text-zinc-800 ring-1 ring-zinc-200 dark:bg-white/5 dark:text-white dark:ring-white/10">
              {summary}
            </li>
          ))}
        </ul>
      </section>

      <WidgetSection id="executive-indicators-title" title="Financeiro e comercial" contentClassName="min-w-0">
        <div className="executive-metrics-grid grid gap-5 lg:gap-6">
          <AuraSmallBalance
            headingId="executive-cash-result"
            label="Resultado de caixa"
            value={financial.kpis.cashResult}
            currency
            status={cashBalance}
            detail={cashBalance.tone === 'neutral' ? executiveCashCopy(report) : cashBalance.detail}
            icon={cashBalance.tone === 'neutral' ? <Coins size={16} /> : cashBalance.tone === 'positive' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          />
          <ExecutiveDeadline
            id="executive-overdue-receivables"
            label="Recebíveis vencidos"
            value={financial.kpis.overdueRevenue}
            currency
            detail="Saldo a receber em atraso"
            attention={financial.kpis.overdueRevenue > 0}
          />
          <AuraProgressWidget
            as="article"
            headingId="executive-conversion"
            label="Conversão comercial"
            context={`${formatNumber(financial.kpis.decidedBudgets)} ${financial.kpis.decidedBudgets === 1 ? 'decidida' : 'decididas'}`}
            value={conversion === null ? 'Sem base comparável' : `${formatNumber(conversion)}%`}
            badge={conversion === null ? undefined : `${formatNumber(financial.kpis.approvedBudgets)} ${financial.kpis.approvedBudgets === 1 ? 'aprovada' : 'aprovadas'}`}
            fraction={conversion === null ? undefined : conversion / 100}
          />
        </div>
      </WidgetSection>

      <WidgetSection id="executive-operational-indicators-title" title="Projetos e área" contentClassName="min-w-0">
        <div className="executive-metrics-grid grid gap-5 lg:gap-6">
          <AuraBalanceSummary
            headingId="executive-active-projects"
            label="Projetos ativos"
            value={operational.kpis.activeProjects}
            detail={`${formatNumber(operational.kpis.completedProjects)} ${operational.kpis.completedProjects === 1 ? 'projeto concluído' : 'projetos concluídos'} no recorte.`}
            icon={<Briefcase size={17} />}
            action={<Link className="geo-focus-ring aura-balance-summary__action" to={APP_PATHS.projects}>Ver projetos</Link>}
          />
          <ExecutiveDeadline
            id="executive-overdue-projects"
            label="Prazos vencidos"
            value={operational.kpis.overdueProjects}
            detail={`${operational.kpis.dueSoonProjects} ${operational.kpis.dueSoonProjects === 1 ? 'entrega prevista' : 'entregas previstas'} nos próximos 30 dias.`}
            attention={operational.kpis.overdueProjects > 0}
          />
          <AuraWidget as="article" tone="blue" className="executive-aura executive-aura--area" aria-labelledby="executive-known-area">
            <div className="executive-aura__area-dial" data-expanded={areaNeedsSpace || undefined}>
              {areaCoverage !== null && <span className="executive-aura__area-ring" aria-hidden="true" style={{ '--area-coverage': `${areaCoverage * 100}%` } as React.CSSProperties} />}
              <div className="executive-aura__area-reading">
                <h3 id="executive-known-area">Área ativa conhecida</h3>
                <p className="aura-widget__value">{areaReading === null ? 'Não informada' : <><span className="executive-aura__area-number">{areaReading}</span> ha</>}</p>
                <p className="executive-aura__area-coverage">
                  {knownAreas} de {activeProjects}<span className="sr-only"> projetos ativos</span> com área<span className="sr-only"> preenchida</span>.
                </p>
              </div>
            </div>
          </AuraWidget>
        </div>
      </WidgetSection>

      <section aria-labelledby="executive-actions-title" className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          {alerts.length ? <Warning aria-hidden="true" className="text-amber-700 dark:text-amber-300" size={22} /> : <CheckCircle aria-hidden="true" className="text-emerald-600 dark:text-emerald-400" size={22} />}
          <h2 id="executive-actions-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Próximas ações</h2>
        </div>
        {alerts.length ? (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {alerts.map((alert) => {
              const copy = reportAlertCopy(alert);
              return (
                <li key={alert.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${alert.severity === 'critical' ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200' : alert.severity === 'warning' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200'}`}>
                      <Warning aria-hidden="true" className="mr-1" size={14} />
                      {alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Aviso' : 'Informação'}
                    </span>
                    <p className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">{copy.title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy.description}</p>
                  </div>
                  <Link
                    to={alert.code === "overdue_revenue" && alert.href === "/financeiro" ? "/financeiro?tab=faturas" : alert.href}
                    className="geo-focus-ring shrink-0 max-w-full rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
                  >
                    {executiveAlertAction(alert)}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Nenhuma ação crítica foi identificada no recorte atual.</p>
        )}
      </section>
      <details className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="geo-focus-ring cursor-pointer rounded font-semibold text-zinc-900 dark:text-white">Como interpretar este recorte</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-600 dark:text-zinc-300">
          {executiveCriteria(report).map((criterion) => <li key={criterion}>{criterion}</li>)}
        </ul>
      </details>
    </div>
  );
}
