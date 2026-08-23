import type { ReactNode } from 'react';
import {
  CaretDown,
  CheckCircle,
  Clock,
  Cloud,
  Gear,
  HardDrives,
  ListChecks,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
  XCircle
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { appLinks } from '@geogestor/contracts';
import {
  formatBackupDate,
  formatBackupMoment,
  formatIntegrity,
  formatNextBackup,
  type BackupPrimaryAction,
  type BackupSummaryState
} from './backupProtectionPresentation';
import type {
  BackupHistoryItem,
  BackupOperationFeedback,
  BackupStatus,
  MaintenanceOperation
} from './backupProtectionTypes';

type StepTone = 'complete' | 'warning' | 'failed' | 'running';

const stateTone: Record<BackupSummaryState, string> = {
  protected:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
  external_unverified:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  local_only:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  recovery_incomplete:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  restore_test_due:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  pending:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  overdue:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  running:
    'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100',
  failed:
    'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100',
  empty:
    'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
};

function formatBackupBytes(bytes: number) {
  const useGigabytes = bytes >= 1024 ** 3;
  return new Intl.NumberFormat('pt-BR', {
    style: 'unit',
    unit: useGigabytes ? 'gigabyte' : 'megabyte',
    maximumFractionDigits: 1
  }).format(bytes / (useGigabytes ? 1024 ** 3 : 1024 ** 2));
}

function StepIcon({ tone }: { tone: StepTone }) {
  if (tone === 'complete') {
    return (
      <CheckCircle
        aria-hidden="true"
        className="text-emerald-600 dark:text-emerald-400"
        size={22}
        weight="fill"
      />
    );
  }
  if (tone === 'failed') {
    return (
      <XCircle
        aria-hidden="true"
        className="text-red-600 dark:text-red-400"
        size={22}
        weight="fill"
      />
    );
  }
  if (tone === 'running') {
    return (
      <SpinnerGap
        aria-hidden="true"
        className="animate-spin text-indigo-600 motion-reduce:animate-none dark:text-indigo-400"
        size={22}
      />
    );
  }
  return (
    <WarningCircle
      aria-hidden="true"
      className="text-amber-700 dark:text-amber-400"
      size={22}
      weight="fill"
    />
  );
}

function JourneyStep({
  tone,
  title,
  status,
  description
}: {
  tone: StepTone;
  title: string;
  status: string;
  description: string;
}) {
  const statusClass =
    tone === 'complete'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
      : tone === 'failed'
        ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
        : tone === 'running'
          ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
          : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200';

  return (
    <li className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-zinc-200 py-3 last:border-b-0 dark:border-zinc-800">
      <span className="mt-0.5">
        <StepIcon tone={tone} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-zinc-900 dark:text-zinc-100">{title}</strong>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
            {status}
          </span>
        </div>
        <p className="mt-1 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = 'default'
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'default' | 'failed';
}) {
  return (
    <div
      className={`min-w-0 rounded-xl px-3 py-2.5 ${
        tone === 'failed'
          ? 'bg-red-50 text-red-950 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-100 dark:ring-red-900'
          : 'bg-zinc-50 text-zinc-950 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-800'
      }`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold" title={detail || value}>
        {value}
      </dd>
    </div>
  );
}

export function BackupLoadingSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
      <span className="sr-only">Consultando o estado do backup…</span>
      <div className="animate-pulse space-y-3 rounded-2xl bg-zinc-100 p-5 motion-reduce:animate-none dark:bg-zinc-900">
        <div className="h-5 w-2/5 rounded bg-zinc-300 dark:bg-zinc-700" />
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            aria-hidden="true"
            className="h-16 animate-pulse rounded-xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}

export function ProtectionSummary({
  status,
  state,
  showSpinner,
  primaryAction,
  compact = false
}: {
  status: BackupStatus;
  state: BackupSummaryState;
  showSpinner: boolean;
  primaryAction: BackupPrimaryAction;
  compact?: boolean;
}) {
  return (
    <section
      aria-labelledby="backup-summary-title"
      className={`${compact ? 'rounded-xl p-3' : 'rounded-2xl p-4 sm:p-5'} border ${stateTone[state]}`}
    >
      <div className="flex items-start gap-3">
        {showSpinner ? (
          <SpinnerGap
            aria-hidden="true"
            className="mt-0.5 h-7 w-7 shrink-0 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Cloud
            aria-hidden="true"
            className="mt-0.5 h-7 w-7 shrink-0"
            weight={state === 'protected' ? 'fill' : 'regular'}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 id="backup-summary-title" className="text-pretty text-base font-semibold">
            {status.summary.label}
          </h3>
          <p className="mt-1 max-w-2xl break-words text-sm leading-6 opacity-90">
            {status.summary.description}
          </p>
          <p className="mt-3 text-xs font-semibold">
            Próximo passo: {primaryAction.label}.
          </p>
          {primaryAction.kind === 'restore_test' && !status.complete.completedAt ? (
            <p className="mt-1 text-xs">Crie um backup completo antes de testar a restauração.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OperationFeedbackNotice({ feedback }: { feedback: BackupOperationFeedback }) {
  const toneClass =
    feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
      : feedback.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
        : 'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100';
  const Icon = feedback.tone === 'success' ? CheckCircle : feedback.tone === 'error' ? XCircle : ShieldCheck;

  return (
    <section
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      aria-atomic="true"
      className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${toneClass}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={20} weight="fill" />
      <div className="min-w-0">
        <strong className="block">{feedback.title}</strong>
        <p className="mt-0.5 break-words leading-5">{feedback.description}</p>
        <p className="mt-1 text-xs opacity-80">
          {formatBackupDate(feedback.occurredAt)}
          {feedback.nextStep ? ` · Próximo passo: ${feedback.nextStep}` : ''}
        </p>
      </div>
    </section>
  );
}

export function BackupOperationProgress({
  operation,
  percent,
  elapsedSeconds
}: {
  operation: MaintenanceOperation;
  percent: number;
  elapsedSeconds: number;
}) {
  return (
    <section
      aria-labelledby="backup-progress-title"
      className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="backup-progress-title" className="break-words text-sm font-semibold">
            {operation.stage}
          </h3>
          <p aria-live="polite" className="mt-1 break-words text-xs tabular-nums opacity-85">
            {operation.processedFiles.toLocaleString('pt-BR')} de{' '}
            {operation.totalFiles.toLocaleString('pt-BR')} arquivos ·{' '}
            {formatBackupBytes(operation.processedBytes)} de {formatBackupBytes(operation.totalBytes)} ·{' '}
            {elapsedSeconds.toLocaleString('pt-BR')} s
          </p>
        </div>
        <strong className="shrink-0 text-sm tabular-nums">
          {percent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
        </strong>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso da operação de backup"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={`${Math.round(percent).toLocaleString('pt-BR')}% concluído. ${operation.processedFiles.toLocaleString('pt-BR')} de ${operation.totalFiles.toLocaleString('pt-BR')} arquivos.`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-950"
      >
        <div
          className="h-full rounded-full bg-indigo-700 transition-[width] duration-300 motion-reduce:transition-none dark:bg-indigo-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!operation.cancellable ? (
        <p className="mt-2 text-xs font-medium">Finalizando com segurança…</p>
      ) : null}
    </section>
  );
}

export function ProtectionJourney({
  status,
  recoveryConfirmed,
  recoveryConfirmedAt,
  embedded = false
}: {
  status: BackupStatus;
  recoveryConfirmed: boolean;
  recoveryConfirmedAt: string | null;
  embedded?: boolean;
}) {
  const externalTone: StepTone =
    status.cloud.confirmation === 'confirmed'
      ? 'complete'
      : status.cloud.confirmation === 'failed'
        ? 'failed'
        : status.cloud.confirmation === 'pending'
          ? 'running'
          : 'warning';
  const completeTone: StepTone =
    status.complete.status === 'running'
      ? 'running'
      : status.complete.error
        ? 'failed'
        : status.complete.completedAt
          ? 'complete'
          : 'warning';
  const restoreTone: StepTone =
    status.protection.restoreTest.state === 'tested'
      ? 'complete'
      : status.protection.restoreTest.state === 'failed'
        ? 'failed'
        : 'warning';

  return (
    <section aria-labelledby={embedded ? undefined : 'protection-checklist-title'} aria-label={embedded ? 'Etapas da jornada de proteção' : undefined}>
      {!embedded ? <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id="protection-checklist-title" className="font-semibold text-zinc-950 dark:text-zinc-100">
            Jornada de proteção
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Veja o que já está seguro e qual é o próximo passo.
          </p>
        </div>
        <ListChecks aria-hidden="true" className="shrink-0 text-zinc-500" size={24} />
      </div> : null}
      <ol className="mt-2">
        <JourneyStep
          tone={externalTone}
          title="Escolher e testar destino externo"
          status={
            status.cloud.confirmation === 'confirmed'
              ? 'Confirmado'
              : status.policy.destinationDirectory
                ? 'Não verificável'
                : 'Pendente'
          }
          description={`${status.cloud.message}${
            status.cloud.confirmedAt ? ` Confirmado em ${formatBackupDate(status.cloud.confirmedAt)}.` : ''
          }${
            status.cloud.error
              ? ` Erro: ${status.cloud.error} Verifique o acesso e teste novamente.`
              : ''
          }`}
        />
        <JourneyStep
          tone={completeTone}
          title="Criar o primeiro backup completo"
          status={status.complete.completedAt ? 'Concluído' : status.complete.error ? 'Falhou' : 'Pendente'}
          description={
            status.complete.completedAt
              ? `Última conclusão: ${formatBackupDate(status.complete.completedAt)}.`
              : status.complete.error
                ? `Falha: ${status.complete.error} Corrija o destino e tente novamente.`
                : 'Inclua o banco e os arquivos dos clientes em uma cópia verificada.'
          }
        />
        <JourneyStep
          tone={recoveryConfirmed ? 'complete' : 'warning'}
          title="Exportar e validar o kit"
          status={recoveryConfirmed ? 'Confirmado' : 'Pendente'}
          description={
            recoveryConfirmed
              ? `Validado${recoveryConfirmedAt ? ` em ${formatBackupDate(recoveryConfirmedAt)}` : ''}.`
              : 'Exporte, guarde fora deste computador e reimporte o kit com a senha correta.'
          }
        />
        <JourneyStep
          tone={restoreTone}
          title="Executar teste de restauração"
          status={
            status.protection.restoreTest.state === 'tested'
              ? 'Testado'
              : status.protection.restoreTest.state === 'failed'
                ? 'Falhou'
                : status.protection.restoreTest.state === 'due'
                  ? 'Vencido'
                  : 'Pendente'
          }
          description={
            status.protection.restoreTest.state === 'tested'
              ? `Testado em ${formatBackupDate(status.protection.restoreTest.completedAt)}.`
              : status.protection.restoreTest.state === 'failed'
                ? `Falha: ${
                    status.restoreTest?.error ||
                    status.restoreTest?.errorMessage ||
                    'verifique o bundle e o destino antes de testar novamente.'
                  }`
                : status.protection.restoreTest.state === 'due'
                  ? `Último teste em ${formatBackupDate(status.protection.restoreTest.completedAt)}; execute um novo teste.`
                  : 'Confirme em uma área isolada que a cópia pode ser restaurada.'
          }
        />
      </ol>
    </section>
  );
}

export function ProtectionMetrics({
  status,
  latestBackup,
  nextBackupAt,
  now,
  compact = false
}: {
  status: BackupStatus;
  latestBackup?: BackupHistoryItem;
  nextBackupAt: string | null;
  now: number;
  compact?: boolean;
}) {
  const integrityLabel =
    latestBackup?.integrityState === 'failed'
      ? 'Falha de integridade'
      : latestBackup?.integrityState === 'verified_again'
        ? 'Verificado novamente'
        : latestBackup?.integrityState === 'verified_at_creation'
          ? 'Verificado na criação'
          : latestBackup?.integrityState === 'legacy_unverified'
            ? 'Legado sem checksums'
            : 'Sem backup';

  return (
    <section aria-labelledby="backup-essential-metrics-title">
      <h3 id="backup-essential-metrics-title" className="sr-only">
        Resumo essencial
      </h3>
      <dl className={`grid grid-cols-2 gap-2 ${compact ? '' : 'lg:grid-cols-4'}`}>
        <Metric
          label="Último backup"
          value={formatBackupMoment(status.summary.lastBackupAt, now)}
          detail={formatBackupDate(status.summary.lastBackupAt)}
        />
        <Metric
          label="Integridade"
          value={integrityLabel}
          detail={formatIntegrity({
            integrityState: latestBackup?.integrityState,
            integrityVerifiedAt: latestBackup?.integrityVerifiedAt
          })}
          tone={latestBackup?.integrityState === 'failed' ? 'failed' : 'default'}
        />
        <Metric
          label="Pendências"
          value={
            status.activity.pendingChanges === 0
              ? 'Nenhuma alteração'
              : `${status.activity.pendingChanges.toLocaleString('pt-BR')} ${
                  status.activity.pendingChanges === 1 ? 'alteração' : 'alterações'
                }`
          }
        />
        <Metric
          label="Próxima execução"
          value={formatNextBackup(nextBackupAt, now)}
          detail={nextBackupAt ? formatBackupDate(nextBackupAt) : undefined}
        />
      </dl>
      {latestBackup?.integrityState === 'failed' ? (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          A verificação encontrou uma divergência. Não use esta cópia até criar e validar um novo backup.
        </p>
      ) : null}
      {!compact ? (
        <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          Em caso de falha, você pode perder até{' '}
          {status.protection.objectives.maximumUnprotectedMinutes.toLocaleString('pt-BR')} minuto(s) de
          alterações.
          {status.protection.objectives.observedRestoreTimeMs !== null
            ? ` O último teste restaurou em ${(status.protection.objectives.observedRestoreTimeMs / 1000).toLocaleString(
                'pt-BR',
                { maximumFractionDigits: 1 }
              )} s.`
            : ' O tempo de recuperação ainda não foi medido.'}
        </p>
      ) : null}
    </section>
  );
}

export function Disclosure({
  icon,
  iconTone = 'neutral',
  title,
  description,
  children
}: {
  icon: ReactNode;
  iconTone?: 'neutral' | 'indigo' | 'sky' | 'amber' | 'violet' | 'emerald';
  title: string;
  description: string;
  children: ReactNode;
}) {
  const iconToneClass = {
    neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700',
    indigo: 'bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/25',
    sky: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
    violet: 'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/25',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25'
  }[iconTone];

  return (
    <details className="group self-start rounded-2xl border border-zinc-200 bg-zinc-50/80 open:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-900/70 dark:open:bg-zinc-900">
      <summary className="geo-focus-ring flex min-h-28 cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 touch-manipulation [&::-webkit-details-marker]:hidden">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${iconToneClass}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <strong className="block text-base text-zinc-900 dark:text-zinc-100">{title}</strong>
          <span className="mt-1 block break-words text-sm leading-5 text-zinc-600 dark:text-zinc-400">
            {description}
          </span>
        </span>
        <CaretDown
          aria-hidden="true"
          className="shrink-0 text-zinc-500 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          size={18}
        />
      </summary>
      <div className="border-t border-zinc-200 px-5 py-5 dark:border-zinc-800">{children}</div>
    </details>
  );
}

export function BackupAdvancedSections({
  status,
  latestBackup,
  includePolicyAndHistory = true,
  includePolicy = includePolicyAndHistory,
  includeHistory = includePolicyAndHistory,
  onClose,
  onCopy
}: {
  status: BackupStatus;
  latestBackup?: BackupHistoryItem;
  includePolicyAndHistory?: boolean;
  includePolicy?: boolean;
  includeHistory?: boolean;
  onClose: () => void;
  onCopy: (value: string, message: string) => void;
}) {
  return (
    <>
      {includePolicy ? <Disclosure
        icon={<HardDrives aria-hidden="true" size={20} />}
        iconTone="indigo"
        title="Política e retenção"
        description={
          status.policy.automaticEnabled
            ? `Automático: banco a cada ${status.policy.databaseIntervalHours} h e completo a cada ${status.policy.completeIntervalDays} dia(s).`
            : 'Backups automáticos desativados.'
        }
      >
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">Consolidação de alterações</span>
            <strong>{status.policy.changeDebounceMinutes.toLocaleString('pt-BR')} min</strong>
          </div>
          <div>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">Versões mínimas</span>
            <strong>{status.policy.retention.toLocaleString('pt-BR')}</strong>
          </div>
          <div>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">Teste automático</span>
            <strong>
              {status.policy.runRestoreTests
                ? `A cada ${status.policy.restoreTestIntervalDays} dia(s)`
                : 'Desativado'}
            </strong>
          </div>
          <div className="sm:text-right">
            <Link
              to={appLinks.settings('backups', 'backup-policy-title')}
              onClick={onClose}
              className="geo-focus-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
            >
              Editar política
            </Link>
          </div>
        </div>
      </Disclosure> : null}

      {includeHistory ? <Disclosure
        icon={<Clock aria-hidden="true" size={20} />}
        iconTone="violet"
        title="Histórico recente"
        description={
          latestBackup
            ? `Última versão: ${formatBackupDate(latestBackup.completedAt)}.`
            : 'Nenhuma versão concluída.'
        }
      >
        {status.storage.history.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nenhuma versão concluída encontrada nesta pasta.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {status.storage.history.slice(0, 5).map((backup) => (
              <li key={backup.directory} className="grid min-w-0 gap-1 py-3 text-xs sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <strong className="text-sm text-zinc-900 dark:text-zinc-100">
                    {backup.legacy ? 'Backup legado do banco' : backup.type === 'complete' ? 'Backup completo' : 'Backup do banco'}
                  </strong>
                  <p className="mt-1 break-words text-zinc-600 dark:text-zinc-400">
                    {formatIntegrity(backup)}
                    {backup.type === 'database' ? ' · Somente banco; documentos não incluídos.' : ''}
                  </p>
                </div>
                <div className="break-words tabular-nums text-zinc-600 dark:text-zinc-400 sm:text-right">
                  <span className="block">{formatBackupDate(backup.completedAt)}</span>
                  <span>
                    {backup.files.toLocaleString('pt-BR')} arquivo(s) · {formatBackupBytes(backup.bytes)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Disclosure> : null}

      <Disclosure
        icon={<Gear aria-hidden="true" size={20} />}
        iconTone="emerald"
        title="Detalhes técnicos"
        description="Destino, dispositivo e identificadores locais."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">Dispositivo</dt>
            <dd className="mt-1 break-words font-semibold">{status.device.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">Identificação</dt>
            <dd className="mt-1 break-all font-mono text-xs" translate="no">
              {status.device.id}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">Destino</dt>
            <dd className="mt-1 break-all font-mono text-xs" translate="no">
              {status.policy.destinationDirectory || 'Pasta externa ainda não configurada'}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {status.policy.destinationDirectory ? (
            <button
              type="button"
              onClick={() =>
                onCopy(status.policy.destinationDirectory as string, 'Caminho copiado.')
              }
              className="geo-focus-ring min-h-11 rounded-lg border border-zinc-300 px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Copiar caminho
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onCopy(status.device.id, 'Identificação do dispositivo copiada.')}
            className="geo-focus-ring min-h-11 rounded-lg border border-zinc-300 px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Copiar identificação
          </button>
        </div>
      </Disclosure>
    </>
  );
}
