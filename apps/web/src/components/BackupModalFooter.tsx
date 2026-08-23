import { Cloud, Gear, ShieldCheck, SpinnerGap } from '@phosphor-icons/react';
import { appLinks } from '@geogestor/contracts';
import { Link } from 'react-router-dom';
import type { BackupPrimaryAction } from './backupProtectionPresentation';
import type { MaintenanceOperation } from './backupProtectionTypes';

type Props = {
  primaryAction: BackupPrimaryAction;
  activeOperation: MaintenanceOperation | null;
  backingUp: boolean;
  cancelling: boolean;
  onClose: () => void;
  onBackup: () => void;
  onCancel: () => void;
};

const secondaryClass =
  'geo-focus-ring inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-wait disabled:bg-zinc-100 disabled:text-zinc-600 sm:flex-none dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400';

const primaryClass =
  'geo-focus-ring inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:bg-indigo-300 disabled:text-indigo-950 sm:flex-none dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:disabled:bg-indigo-950 dark:disabled:text-indigo-300';

export function BackupModalFooter({
  primaryAction,
  activeOperation,
  backingUp,
  cancelling,
  onClose,
  onBackup,
  onCancel
}: Props) {
  if (activeOperation) {
    return (
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs text-zinc-600 dark:text-zinc-400">
          {activeOperation.cancellable
            ? 'A operação continua em segundo plano. Você pode solicitar um cancelamento seguro.'
            : 'A operação está na etapa final e não pode ser interrompida com segurança.'}
        </p>
        <Link
          to={appLinks.settings('backups', 'backup-protection-details-title')}
          onClick={onClose}
          className={secondaryClass}
        >
          Ver detalhes
        </Link>
        {activeOperation.cancellable ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling || activeOperation.cancelRequested}
            className="geo-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:cursor-wait disabled:bg-zinc-100 disabled:text-zinc-600 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          >
            {cancelling || activeOperation.cancelRequested
              ? 'Cancelamento solicitado…'
              : 'Cancelar com segurança'}
          </button>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-300">
            <SpinnerGap
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
              size={18}
            />
            Finalizando com segurança…
          </span>
        )}
      </div>
    );
  }

  const primaryControl =
    primaryAction.kind === 'configure' ? (
      <Link
        data-backup-primary-action="true"
        to={appLinks.settings('backups', 'backup-policy-title')}
        onClick={onClose}
        className={primaryClass}
      >
        <Gear aria-hidden="true" size={18} />
        <span className="break-words text-center">{primaryAction.label}</span>
      </Link>
    ) : primaryAction.kind === 'recovery' || primaryAction.kind === 'restore_test' ? (
      <Link
        data-backup-primary-action="true"
        to={appLinks.settings('backups',
          primaryAction.kind === 'recovery'
            ? 'backup-recovery-summary'
            : 'backup-details-actions-title'
        )}
        onClick={onClose}
        className={primaryClass}
      >
        <ShieldCheck aria-hidden="true" size={18} />
        <span className="break-words">{primaryAction.label}</span>
      </Link>
    ) : (
      <button
        data-backup-primary-action="true"
        type="button"
        onClick={onBackup}
        disabled={backingUp}
        className={primaryClass}
      >
        {backingUp ? (
          <SpinnerGap aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
        ) : (
          <Cloud aria-hidden="true" size={18} />
        )}
        <span className="break-words">{backingUp ? 'Criando backup…' : primaryAction.label}</span>
      </button>
    );

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
      <Link
        to={appLinks.settings('backups', 'backup-protection-details-title')}
        onClick={onClose}
        aria-label="Ver detalhes do backup"
        className={secondaryClass}
      >
        <Gear aria-hidden="true" size={18} />
        Ver detalhes
      </Link>
      {primaryControl}
    </div>
  );
}
