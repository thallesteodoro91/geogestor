import type { ReportAlert } from '@geogestor/contracts';
import { WarningCircle } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { reportAlertCopy } from './reportAlertCopy';

export function ReportAlerts({ alerts }: { alerts: ReportAlert[] }) {
  if (!alerts.length) return null;
  const styles = {
    critical: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100',
    info: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100'
  };
  return (
    <section aria-labelledby="report-alerts-title">
      <h2 id="report-alerts-title" className="mb-3 text-lg font-semibold text-zinc-950 dark:text-white">Pontos de atenção</h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => {
          const copy = reportAlertCopy(alert);
          return (
            <li key={alert.id} className={cn('rounded-2xl border p-4', styles[alert.severity])}>
              <div className="flex items-start gap-3">
                <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{copy.title}</p>
                  <p className="mt-1 break-words text-sm leading-6 opacity-80">{copy.description}</p>
                  <Link to={alert.href} className="geo-focus-ring mt-2 inline-flex rounded-md py-1 text-sm font-semibold underline underline-offset-4">
                    Ver detalhes
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
