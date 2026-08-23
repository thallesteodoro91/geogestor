import { CaretDown, CheckCircle, Key } from '@phosphor-icons/react';
import type { RecoveryErrors, RecoveryMethod } from './backupProtectionTypes';

type Props = {
  open: boolean;
  confirmed: boolean;
  method: RecoveryMethod | null;
  adminPassword: string;
  kitPassword: string;
  recoveryCode: string | null;
  kitSaved: boolean;
  errors: RecoveryErrors;
  revealing: boolean;
  exporting: boolean;
  validating: boolean;
  onToggle: (open: boolean) => void;
  onMethodChange: (method: RecoveryMethod) => void;
  onAdminPasswordChange: (value: string) => void;
  onKitPasswordChange: (value: string) => void;
  onRevealCode: () => void;
  onExportKit: () => void;
  onValidateKit: () => void;
  onCopyCode: () => void;
};

const inputClass =
  'geo-focus-ring min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600 dark:border-zinc-700 dark:bg-zinc-950';

const secondaryButtonClass =
  'geo-focus-ring min-h-11 rounded-xl border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 disabled:cursor-wait disabled:bg-zinc-100 disabled:text-zinc-600 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400';

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      tabIndex={-1}
      className="text-xs font-medium text-red-700 dark:text-red-300"
    >
      {children}
    </p>
  );
}

export function BackupRecoverySection({
  open,
  confirmed,
  method,
  adminPassword,
  kitPassword,
  recoveryCode,
  kitSaved,
  errors,
  revealing,
  exporting,
  validating,
  onToggle,
  onMethodChange,
  onAdminPasswordChange,
  onKitPasswordChange,
  onRevealCode,
  onExportKit,
  onValidateKit,
  onCopyCode
}: Props) {
  return (
    <details
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className="group self-start rounded-2xl border border-zinc-200 bg-zinc-50/80 open:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-900/70 dark:open:bg-zinc-900"
    >
      <summary
        id="backup-recovery-summary"
        className="geo-focus-ring flex min-h-28 cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 touch-manipulation [&::-webkit-details-marker]:hidden"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25">
          <Key aria-hidden="true" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-base text-zinc-900 dark:text-zinc-100">
            Recuperação de emergência
          </strong>
          <span className="mt-1 block break-words text-sm leading-5 text-zinc-600 dark:text-zinc-400">
            {confirmed
              ? 'Kit validado para uso em outro computador.'
              : 'Código e kit ficam ocultos até você escolher uma opção.'}
          </span>
        </span>
        <CaretDown
          aria-hidden="true"
          className="shrink-0 text-zinc-500 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          size={18}
        />
      </summary>

      <div className="border-t border-zinc-200 px-5 py-5 dark:border-zinc-800">
        {confirmed ? (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <CheckCircle aria-hidden="true" className="mt-0.5 shrink-0" size={20} weight="fill" />
            <p>
              <strong className="block">Recuperação confirmada</strong>
              O kit foi reimportado e corresponde à chave deste computador.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              Escolha como deseja preparar a recuperação. Guardar o código ou o kit no mesmo computador
              não protege contra perda total.
            </p>

            <fieldset>
              <legend className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Método de recuperação
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 touch-manipulation ${
                    method === 'code'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="backup_recovery_method"
                    value="code"
                    checked={method === 'code'}
                    onChange={() => onMethodChange('code')}
                  />
                  <span>
                    <strong className="block text-sm">Usar código de recuperação</strong>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      Copie e guarde em local seguro.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 touch-manipulation ${
                    method === 'kit'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="backup_recovery_method"
                    value="kit"
                    checked={method === 'kit'}
                    onChange={() => onMethodChange('kit')}
                  />
                  <span>
                    <strong className="block text-sm">Usar kit de recuperação</strong>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      Arquivo JSON protegido por senha.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {method === 'code' ? (
              <div className="grid gap-2">
                <label htmlFor="backup-admin-password-code" className="text-xs font-semibold">
                  Senha administrativa
                </label>
                <input
                  id="backup-admin-password-code"
                  name="backup_admin_password_code"
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => onAdminPasswordChange(event.target.value)}
                  aria-invalid={Boolean(errors.adminPassword)}
                  aria-describedby={
                    errors.adminPassword
                      ? 'backup-code-password-help backup-code-password-error'
                      : 'backup-code-password-help'
                  }
                  className={inputClass}
                />
                <p id="backup-code-password-help" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Informe sua senha administrativa para revelar o código.
                </p>
                <FieldError id="backup-code-password-error">{errors.adminPassword}</FieldError>
                <button
                  type="button"
                  onClick={onRevealCode}
                  disabled={revealing}
                  className={secondaryButtonClass}
                >
                  {revealing ? 'Validando acesso…' : 'Mostrar código de recuperação'}
                </button>
                {recoveryCode ? (
                  <div className="rounded-xl bg-zinc-100 p-3 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                    <code className="block break-all text-xs font-semibold" translate="no">
                      {recoveryCode}
                    </code>
                    <button
                      type="button"
                      onClick={onCopyCode}
                      className="geo-focus-ring mt-2 min-h-11 rounded-lg border border-zinc-300 px-3 text-xs font-semibold hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      Copiar código
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {method === 'kit' ? (
              <div className="grid gap-2">
                <label htmlFor="backup-admin-password-kit" className="text-xs font-semibold">
                  Senha administrativa
                </label>
                <input
                  id="backup-admin-password-kit"
                  name="backup_admin_password_kit"
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => onAdminPasswordChange(event.target.value)}
                  aria-invalid={Boolean(errors.adminPassword)}
                  aria-describedby={
                    errors.adminPassword
                      ? 'backup-kit-admin-help backup-kit-admin-error'
                      : 'backup-kit-admin-help'
                  }
                  className={inputClass}
                />
                <p id="backup-kit-admin-help" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Necessária somente para exportar um novo kit.
                </p>
                <FieldError id="backup-kit-admin-error">{errors.adminPassword}</FieldError>

                <label htmlFor="backup-kit-password" className="mt-1 text-xs font-semibold">
                  Senha do kit
                </label>
                <input
                  id="backup-kit-password"
                  name="backup_kit_password"
                  type="password"
                  autoComplete="new-password"
                  value={kitPassword}
                  onChange={(event) => onKitPasswordChange(event.target.value)}
                  aria-invalid={Boolean(errors.kitPassword)}
                  aria-describedby={
                    errors.kitPassword
                      ? 'backup-kit-password-help backup-kit-password-error'
                      : 'backup-kit-password-help'
                  }
                  className={inputClass}
                />
                <p id="backup-kit-password-help" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Use pelo menos 12 caracteres. Para validar um kit salvo, informe a mesma senha usada na
                  exportação.
                </p>
                <FieldError id="backup-kit-password-error">{errors.kitPassword}</FieldError>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={onExportKit}
                    disabled={exporting}
                    className={secondaryButtonClass}
                  >
                    {exporting ? 'Protegendo kit…' : 'Exportar novo kit'}
                  </button>
                  <button
                    type="button"
                    onClick={onValidateKit}
                    disabled={validating}
                    className="geo-focus-ring min-h-11 rounded-xl border border-emerald-500 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-wait disabled:border-zinc-300 disabled:bg-zinc-100 disabled:text-zinc-600 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/30 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
                  >
                    {validating
                      ? 'Validando kit…'
                      : kitSaved
                        ? 'Reimportar o kit salvo'
                        : 'Validar um kit existente'}
                  </button>
                </div>

                <FieldError id="backup-recovery-action-error">{errors.action}</FieldError>
                {kitSaved ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="rounded-lg bg-sky-50 p-3 text-xs font-medium text-sky-900 dark:bg-sky-950/30 dark:text-sky-200"
                  >
                    Kit salvo. Reimporte o arquivo com sua senha para confirmar que ele pode ser usado em
                    outro computador.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </details>
  );
}
