import type { ManagerialReport } from '@geogestor/contracts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle,
  Coins,
  Compass,
  Hourglass,
  Warning
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { reportAlertCopy } from './reportAlertCopy';
import { executiveSummary, formatCurrency, formatNumber } from './reportPresentation';

interface RelatorioExecutivoProps {
  report: ManagerialReport;
}

function ExecutiveMetric({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{label}</p>
        <span aria-hidden="true" className="rounded-lg bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
          {icon}
        </span>
      </div>
      <p className="mt-5 truncate text-3xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{detail}</p>
    </article>
  );
}

export function RelatorioExecutivo({ report }: RelatorioExecutivoProps) {
  const { financial, operational } = report;
  const cashPositive = financial.kpis.cashResult >= 0;
  const alerts = [...financial.alerts, ...operational.alerts];

  return (
    <div className="space-y-6">
      <section aria-labelledby="executive-summary-title" className="rounded-3xl bg-zinc-950 p-6 text-white sm:p-8 dark:ring-1 dark:ring-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Leitura gerencial</p>
        <h2 id="executive-summary-title" className="mt-2 text-2xl font-semibold text-pretty">O que merece sua atenção neste período</h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {executiveSummary(report).map((summary) => (
            <li key={summary} className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-zinc-100 ring-1 ring-white/10">
              {summary}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="executive-indicators-title">
        <h2 id="executive-indicators-title" className="mb-4 text-lg font-semibold text-zinc-950 dark:text-white">Indicadores que explicam o cenário</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ExecutiveMetric
            label="Resultado de caixa"
            value={formatCurrency(financial.kpis.cashResult)}
            detail={cashPositive ? 'Entradas cobriram as saídas pagas.' : 'Saídas superaram as entradas recebidas.'}
            icon={cashPositive ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
          />
          <ExecutiveMetric
            label="Recebíveis vencidos"
            value={formatCurrency(financial.kpis.overdueRevenue)}
            detail="Saldo vencido ainda não recebido."
            icon={<Hourglass size={20} />}
          />
          <ExecutiveMetric
            label="Conversão comercial"
            value={financial.kpis.conversionRate === null ? 'Sem base' : `${formatNumber(financial.kpis.conversionRate)}%`}
            detail={`${financial.kpis.approvedBudgets} de ${financial.kpis.decidedBudgets} propostas decididas foram aprovadas.`}
            icon={<Coins size={20} />}
          />
          <ExecutiveMetric
            label="Projetos ativos"
            value={String(operational.kpis.activeProjects)}
            detail={`${operational.kpis.completedProjects} concluído(s) no recorte.`}
            icon={<Briefcase size={20} />}
          />
          <ExecutiveMetric
            label="Prazos vencidos"
            value={String(operational.kpis.overdueProjects)}
            detail={`${operational.kpis.dueSoonProjects} entrega(s) prevista(s) nos próximos 30 dias.`}
            icon={<Warning size={20} />}
          />
          <ExecutiveMetric
            label="Área ativa conhecida"
            value={operational.kpis.activeAreaHa === null ? 'Não informada' : `${formatNumber(operational.kpis.activeAreaHa)} ha`}
            detail={`${operational.kpis.projectsWithKnownArea} projeto(s) ativo(s) com área preenchida.`}
            icon={<Compass size={20} />}
          />
        </div>
      </section>

      <section aria-labelledby="executive-actions-title" className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <CheckCircle aria-hidden="true" className="text-emerald-600 dark:text-emerald-400" size={22} />
          <h2 id="executive-actions-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Próximas ações</h2>
        </div>
        {alerts.length ? (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {alerts.map((alert) => {
              const copy = reportAlertCopy(alert);
              return (
                <li key={alert.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{copy.title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy.description}</p>
                  </div>
                  <Link
                    to={alert.href}
                    className="geo-focus-ring shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
                  >
                    Ver detalhes
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Nenhuma ação crítica foi identificada no recorte atual.</p>
        )}
      </section>
    </div>
  );
}
