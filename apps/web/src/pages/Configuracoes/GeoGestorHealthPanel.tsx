import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  FileText,
  FolderOpen,
  ShieldCheck,
  UploadSimple,
  WarningCircle,
  Wrench
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { APP_VERSION } from '../../version';
import { cn } from '../../utils/cn';
import { geoPanelClass } from '../../utils/geoTheme';
import { assessPostUpdateStatus, type PostUpdateBackupStatus } from '../postUpdateStatus';

type Health = {
  status: 'ok' | 'degraded';
  checkedAt: string;
  checks: { database: string; foreignKeyViolations: number; schemaVersion: number; residualMigrationTables: string[] };
};
type Quality = { summary: { issues: number; critical: number; warnings: number } };
type Backups = PostUpdateBackupStatus & {
  storage: { availableBytes: number; versions: number; totalBytes: number };
};

type Props = {
  enabled: boolean;
  desktopInfo?: { desktop: boolean; mode: string; databasePath: string };
  onOpenDiagnosticsFolder: () => void;
  onExportDiagnostic: () => void;
};

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Ainda não realizado';

const formatBytes = (bytes: number) => new Intl.NumberFormat('pt-BR', {
  style: 'unit',
  unit: bytes >= 1024 ** 3 ? 'gigabyte' : 'megabyte',
  maximumFractionDigits: 1
}).format(bytes / (bytes >= 1024 ** 3 ? 1024 ** 3 : 1024 ** 2));

const backupLabel: Record<PostUpdateBackupStatus['database']['status'], string> = {
  current: 'Atualizado', overdue: 'Vencido', incomplete: 'Incompleto', failed: 'Com falha', running: 'Em andamento…'
};

export function GeoGestorHealthPanel({ enabled, desktopInfo, onOpenDiagnosticsFolder, onExportDiagnostic }: Props) {
  const healthQuery = useQuery({
    queryKey: ['geogestor-health-summary'],
    enabled,
    queryFn: async () => {
      const [health, quality, backups] = await Promise.all([
        apiClient.get<Health>('/api/sistema/diagnostico'),
        apiClient.get<Quality>('/api/sistema/qualidade-dados'),
        apiClient.get<Backups>('/api/sistema/backups/status')
      ]);
      return { health, quality, backups };
    }
  });
  const data = healthQuery.data;
  const assessment = data ? assessPostUpdateStatus({
    healthOk: data.health.status === 'ok',
    qualityCritical: data.quality.summary.critical,
    backups: data.backups
  }) : null;
  const actionClass = 'geo-card-interactive geo-focus-ring flex min-h-[96px] items-start gap-3 rounded-2xl p-4 text-left';
  const tone = assessment?.level === 'critical'
    ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
    : assessment?.level === 'warning'
      ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
      : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20';

  return (
    <section className={cn(geoPanelClass, 'relative overflow-hidden rounded-3xl p-6 shadow-sm')} aria-labelledby="geogestor-health-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="geogestor-health-title" className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white">
            <Wrench aria-hidden="true" className="h-5 w-5 text-violet-600" /> Saúde do GeoGestor
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Visão operacional do aplicativo local, com atalhos seguros para investigação e correção.</p>
        </div>
        <button type="button" onClick={() => void healthQuery.refetch()} disabled={healthQuery.isFetching} className="geo-focus-ring min-h-10 rounded-xl border border-zinc-300 px-3 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">
          {healthQuery.isFetching ? 'Verificando…' : 'Verificar novamente'}
        </button>
      </div>

      {healthQuery.isLoading ? <p aria-live="polite" className="mt-5 text-sm text-zinc-500">Verificando banco, backups e qualidade dos dados…</p>
        : healthQuery.isError || !data || !assessment ? (
          <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <span>Não foi possível concluir o diagnóstico local. Evite manutenções até repetir a verificação.</span>
            <button type="button" onClick={() => void healthQuery.refetch()} className="geo-focus-ring min-h-10 rounded-xl border border-red-300 px-3 font-semibold">Tentar novamente</button>
          </div>
        ) : (
          <>
            <div className={cn('mt-5 rounded-2xl border p-4', tone)} aria-live="polite">
              <div className="flex items-start gap-3">
                {assessment.level === 'ok' ? <CheckCircle aria-hidden="true" className="h-6 w-6 shrink-0 text-emerald-700" /> : <WarningCircle aria-hidden="true" className="h-6 w-6 shrink-0 text-amber-700" />}
                <div>
                  <strong className="text-sm text-zinc-950 dark:text-white">{assessment.level === 'ok' ? 'Operação íntegra e protegida' : assessment.level === 'warning' ? 'Operação disponível com recomendações' : 'Atenção necessária antes de operações críticas'}</strong>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Verificação pós-atualização: {assessment.level === 'ok' ? 'aprovada' : 'revisão recomendada'}.</p>
                </div>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Versão e ambiente</dt><dd className="mt-1 font-semibold tabular-nums">GeoGestor {APP_VERSION}</dd><dd className="text-xs text-zinc-500">{desktopInfo?.desktop ? 'Desktop gerenciado' : desktopInfo?.mode || 'Local'}</dd></div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Integridade do banco</dt><dd className="mt-1 font-semibold">{data.health.checks.database}</dd><dd className="text-xs text-zinc-500">Schema v{data.health.checks.schemaVersion} · {data.health.checks.foreignKeyViolations} violação(ões)</dd></div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Backups recentes</dt><dd className="mt-1 text-sm font-semibold">Banco: {backupLabel[data.backups.database.status]}</dd><dd className="text-xs text-zinc-500">{formatDate(data.backups.database.completedAt)}</dd><dd className="mt-1 text-sm font-semibold">Completo: {backupLabel[data.backups.complete.status]}</dd><dd className="text-xs text-zinc-500">{formatDate(data.backups.complete.completedAt)}</dd></div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Espaço para backups</dt><dd className="mt-1 font-semibold tabular-nums">{formatBytes(data.backups.storage.availableBytes)} livres</dd><dd className="text-xs text-zinc-500">{data.backups.storage.versions.toLocaleString('pt-BR')} versão(ões) armazenada(s)</dd></div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Qualidade dos dados</dt><dd className="mt-1 font-semibold tabular-nums">{data.quality.summary.issues.toLocaleString('pt-BR')} ocorrência(s)</dd><dd className="text-xs text-zinc-500">{data.quality.summary.critical} crítica(s) · {data.quality.summary.warnings} alerta(s)</dd></div>
              <div className="min-w-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><dt className="text-xs text-zinc-500">Banco local</dt><dd className="mt-1 break-all font-mono text-xs">{desktopInfo?.databasePath || 'Não identificado'}</dd></div>
            </dl>
          </>
        )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {([
          ['/pos-atualizacao', 'Verificação pós-atualização', 'Confere banco, arquivos e serviços.', CheckCircle],
          ['/qualidade-dados', 'Qualidade dos dados', 'Localiza cadastros inconsistentes.', WarningCircle],
          ['/audit-logs', 'Logs de auditoria', 'Mostra alterações e suas origens.', FileText],
          ['/importacao', 'Importação de dados', 'Valida cadastros antes de gravar.', UploadSimple]
        ] as const).map(([to, title, description, Icon]) => <Link key={to} to={to} className={actionClass}><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-violet-600" /><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs text-zinc-500">{description}</span></span></Link>)}
        <button type="button" onClick={onOpenDiagnosticsFolder} className={actionClass}><FolderOpen aria-hidden="true" className="h-5 w-5 shrink-0 text-sky-600" /><span><strong className="block text-sm">Abrir diagnóstico local</strong><span className="mt-1 block text-xs text-zinc-500">Acessa os registros locais de suporte.</span></span></button>
        <button id="diagnostic-export-title" type="button" onClick={onExportDiagnostic} className={actionClass}><ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600" /><span><strong className="block text-sm">Exportar diagnóstico seguro</strong><span className="mt-1 block text-xs text-zinc-500">Exclui credenciais e dados pessoais.</span></span></button>
      </div>
    </section>
  );
}
