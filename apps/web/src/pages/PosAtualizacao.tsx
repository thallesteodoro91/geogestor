import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Database, HardDrives, ShieldWarning } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { apiClient } from '../services/apiClient';
import { APP_VERSION } from '../version';

type Health = {
  status: 'ok' | 'degraded'; checkedAt: string;
  checks: {
    database: string; foreignKeyViolations: number; schemaVersion: number;
    entityCounts: Record<string, number>; residualMigrationTables: string[];
    relationshipViolations: Record<string, number>;
  };
};
type Quality = { summary: { issues: number; critical: number; warnings: number } };
type Backups = { database: { status: string; completedAt: string | null }; complete: { status: string; completedAt: string | null } };

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
  const critical = !data || data.health.status !== 'ok' || data.quality.summary.critical > 0;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title="Verificação pós-atualização" description="Confirme a migração, a integridade dos vínculos e a proteção dos dados antes de continuar o trabalho." />
        {statusQuery.isLoading ? <p aria-live="polite" className="text-sm text-zinc-500">Verificando banco, vínculos e backups…</p>
          : statusQuery.isError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">A verificação não pôde ser concluída. Evite alterações importantes e tente novamente.</p>
            : <>
              <div className={`rounded-2xl border p-5 ${critical ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'}`}>
                <div className="flex items-center gap-3">{critical ? <ShieldWarning aria-hidden="true" size={30} className="text-red-700" /> : <CheckCircle aria-hidden="true" size={30} className="text-emerald-700" />}<div><h2 className="font-semibold">{critical ? 'A atualização exige revisão' : 'Atualização íntegra'}</h2><p className="text-sm">Aplicativo v{APP_VERSION} • banco v{data!.health.checks.schemaVersion} • {data!.quality.summary.critical} problema(s) crítico(s)</p></div></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><Database aria-hidden="true" size={24} /><h2 className="mt-2 font-semibold">Banco local</h2><p className="mt-1 text-sm text-zinc-500">Quick check: {data!.health.checks.database}</p><p className="text-sm text-zinc-500">Chaves estrangeiras: {data!.health.checks.foreignKeyViolations}</p><p className="text-sm text-zinc-500">Tabelas residuais: {data!.health.checks.residualMigrationTables.length}</p></section>
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><ShieldWarning aria-hidden="true" size={24} /><h2 className="mt-2 font-semibold">Qualidade</h2><p className="mt-1 text-sm text-zinc-500">{data!.quality.summary.issues} ocorrência(s)</p><p className="text-sm text-zinc-500">{data!.quality.summary.warnings} alerta(s)</p><Link className="mt-3 inline-block text-sm font-semibold text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-indigo-300" to="/qualidade-dados">Abrir diagnóstico</Link></section>
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><HardDrives aria-hidden="true" size={24} /><h2 className="mt-2 font-semibold">Backups</h2><p className="mt-1 text-sm text-zinc-500">Banco: {data!.backups.database.status}</p><p className="text-sm text-zinc-500">Completo: {data!.backups.complete.status}</p><Link className="mt-3 inline-block text-sm font-semibold text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-indigo-300" to="/configuracoes">Configurar backups</Link></section>
              </div>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="font-semibold">Registros preservados</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(data!.health.checks.entityCounts).map(([name, count]) => <div key={name} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950"><span className="block text-xs capitalize text-zinc-500">{name.replaceAll('_', ' ')}</span><strong className="tabular-nums">{count.toLocaleString('pt-BR')}</strong></div>)}</div></section>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Depois de confirmar os dados, faça um novo backup completo antes de alterações importantes.</p>
            </>}
      </div>
    </Layout>
  );
}
