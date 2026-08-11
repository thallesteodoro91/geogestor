import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Database, HardDrives, ShieldWarning, WarningCircle } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { apiClient } from '../services/apiClient';
import { APP_VERSION } from '../version';
import { assessPostUpdateStatus, type PostUpdateBackupStatus } from './postUpdateStatus';

type Health = {
  status: 'ok' | 'degraded'; checkedAt: string;
  checks: {
    database: string; foreignKeyViolations: number; schemaVersion: number;
    entityCounts: Record<string, number>; residualMigrationTables: string[];
    relationshipViolations: Record<string, number>;
  };
};
type Quality = { summary: { issues: number; critical: number; warnings: number } };
type Backups = PostUpdateBackupStatus;

const formatBackupDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Ainda não realizado';

const backupStatusLabel: Record<Backups['database']['status'], string> = {
  current: 'Atualizado', overdue: 'Vencido', incomplete: 'Incompleto', failed: 'Com falha', running: 'Em andamento…'
};

export function PosAtualizacao() {
  const statusQuery = useQuery({
    queryKey: ['post-update-review'],
    queryFn: async () => {
      const [health, quality, backups] = await Promise.all([
        apiClient.get<Health>('/api/sistema/diagnostico'),
        apiClient.get<Quality>('/api/sistema/qualidade-dados'),
        apiClient.get<Backups>('/api/sistema/backups/status')
      ]);
      return { health, quality, backups };
    }
  });
  const data = statusQuery.data;
  const assessment = data ? assessPostUpdateStatus({
    healthOk: data.health.status === 'ok',
    qualityCritical: data.quality.summary.critical,
    backups: data.backups
  }) : null;
  const statusTone = assessment?.level === 'critical'
    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
    : assessment?.level === 'warning'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
      : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30';
  const statusTitle = assessment?.level === 'critical'
    ? 'A atualização exige revisão'
    : assessment?.level === 'warning'
      ? 'Atualização concluída com recomendações'
      : 'Atualização íntegra e protegida';

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title="Verificação pós-atualização" description="Confirme a migração, a integridade dos vínculos e a proteção dos dados antes de continuar o trabalho." />
        {statusQuery.isLoading ? <p aria-live="polite" className="text-sm text-zinc-500">Verificando banco, vínculos e backups…</p>
          : statusQuery.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-950/30 dark:text-red-200"><span>A verificação não pôde ser concluída. Evite alterações importantes e tente novamente.</span><button type="button" onClick={() => void statusQuery.refetch()} className="min-h-10 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800 dark:hover:bg-red-950">Tentar novamente</button></div>
            : data && assessment && <>
              <section className={`rounded-2xl border p-5 ${statusTone}`} aria-live="polite">
                <div className="flex items-start gap-3">
                  {assessment.level === 'ok' ? <CheckCircle aria-hidden="true" size={30} className="shrink-0 text-emerald-700" /> : assessment.level === 'warning' ? <WarningCircle aria-hidden="true" size={30} className="shrink-0 text-amber-700" /> : <ShieldWarning aria-hidden="true" size={30} className="shrink-0 text-red-700" />}
                  <div className="min-w-0">
                    <h2 className="font-semibold">{statusTitle}</h2>
                    <p className="text-sm">Aplicativo v{APP_VERSION} • banco v{data.health.checks.schemaVersion} • {data.quality.summary.critical} problema(s) crítico(s)</p>
                    {(assessment.criticalReasons.length > 0 || assessment.warnings.length > 0) && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{assessment.criticalReasons.map((reason) => <li key={reason}>{reason}</li>)}{assessment.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
                  </div>
                </div>
              </section>
              <div className="grid gap-4 md:grid-cols-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><Database aria-hidden="true" size={24} /><h2 className="mt-2 font-semibold">Banco local</h2><p className="mt-1 text-sm text-zinc-500">Quick check: {data.health.checks.database}</p><p className="text-sm text-zinc-500">Chaves estrangeiras: {data.health.checks.foreignKeyViolations}</p><p className="text-sm text-zinc-500">Tabelas residuais: {data.health.checks.residualMigrationTables.length}</p></section>
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><ShieldWarning aria-hidden="true" size={24} /><h2 className="mt-2 font-semibold">Qualidade</h2><p className="mt-1 text-sm text-zinc-500">{data.quality.summary.issues} ocorrência(s)</p><p className="text-sm text-zinc-500">{data.quality.summary.warnings} alerta(s)</p><Link className="mt-3 inline-block rounded-lg text-sm font-semibold text-indigo-700 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-indigo-300" to="/qualidade-dados">Abrir diagnóstico</Link></section>
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><HardDrives aria-hidden="true" size={24} /><h2 className="mt-2 font-semibold">Backups</h2><p className="mt-1 text-sm text-zinc-500">Banco: {backupStatusLabel[data.backups.database.status]} • {formatBackupDate(data.backups.database.completedAt)}</p><p className="text-sm text-zinc-500">Completo: {backupStatusLabel[data.backups.complete.status]} • {formatBackupDate(data.backups.complete.completedAt)}</p><p className="mt-1 text-sm text-zinc-500">Integridade: {data.backups.summary.integrity === 'verified' ? 'Verificada' : 'Não verificada'}</p><Link className="mt-3 inline-block rounded-lg text-sm font-semibold text-indigo-700 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-indigo-300" to="/configuracoes?secao=backups&foco=backup-policy-title">Configurar backups</Link></section>
              </div>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="font-semibold">Registros preservados</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(data.health.checks.entityCounts).map(([name, count]) => <div key={name} className="min-w-0 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950"><span className="block truncate text-xs capitalize text-zinc-500">{name.replaceAll('_', ' ')}</span><strong className="tabular-nums">{count.toLocaleString('pt-BR')}</strong></div>)}</div></section>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Depois de confirmar os dados, mantenha um backup completo verificado e uma cópia externa atualizada.</p>
            </>}
      </div>
    </Layout>
  );
}
