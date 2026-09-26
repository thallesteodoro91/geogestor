import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKey, ShieldCheck, ShieldSlash, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { apiClient, clearLocalSessionToken, setLocalSessionToken } from '../../services/apiClient';
import { SwitchField } from '../../components/Form';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoPanelClass } from '../../utils/geoTheme';
import { primarySubmitButtonClass } from '../../utils/actionStyles';

type LocalAuthPolicy = {
  enabled: boolean;
  idleMinutes: number;
};

type LocalAuthPolicyResult = LocalAuthPolicy & {
  passwordChanged: boolean;
  session: { token: string; expiresAt: string; idleMinutes: number } | null;
};

export function SecuritySettingsPanel() {
  const queryClient = useQueryClient();
  const policyQuery = useQuery<LocalAuthPolicy>({
    queryKey: ['local-auth-policy'],
    queryFn: () => apiClient.get('/api/auth/policy')
  });
  const [enabledDraft, setEnabledDraft] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => apiClient.put<LocalAuthPolicyResult>('/api/auth/policy', {
      enabled: enabledDraft ?? policyQuery.data?.enabled ?? false,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined
    }),
    onSuccess: async (result) => {
      if (result.session?.token) setLocalSessionToken(result.session.token);
      else clearLocalSessionToken();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEnabledDraft(null);
      setError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['local-auth-policy'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-status'] })
      ]);
      toast.success(result.enabled
        ? result.passwordChanged ? 'Bloqueio local ativado e nova senha salva.' : 'Configuração de segurança salva.'
        : result.passwordChanged ? 'Nova senha salva; abertura sem senha mantida.' : 'Solicitação de senha ao abrir removida.');
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a segurança local.')
  });

  if (policyQuery.isLoading) return <p aria-live="polite" className="text-sm text-zinc-500">Carregando segurança local…</p>;
  if (policyQuery.isError || !policyQuery.data) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        <WarningCircle aria-hidden="true" size={20} /> Não foi possível consultar a segurança local.
      </div>
    );
  }

  const wasEnabled = policyQuery.data.enabled;
  const enabled = enabledDraft ?? wasEnabled;
  const changingMode = enabled !== wasEnabled;
  const passwordMismatch = Boolean(newPassword && newPassword !== confirmPassword);
  const passwordTooShort = Boolean(newPassword && newPassword.length < 8);
  const enablingWithoutPassword = !wasEnabled && enabled && !newPassword;
  const currentPasswordRequired = wasEnabled && (changingMode || Boolean(newPassword));
  const canSubmit = (changingMode || Boolean(newPassword))
    && !passwordMismatch
    && !passwordTooShort
    && !enablingWithoutPassword
    && (!currentPasswordRequired || Boolean(currentPassword));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      if (passwordMismatch) setError('A confirmação não corresponde à nova senha.');
      else if (passwordTooShort) setError('A nova senha deve ter pelo menos 8 caracteres.');
      else if (enablingWithoutPassword) setError('Defina uma nova senha para ativar o bloqueio.');
      else if (currentPasswordRequired) setError('Informe a senha atual para confirmar a alteração.');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className={cn(geoPanelClass, 'space-y-5 rounded-2xl p-5')} aria-labelledby="local-security-title">
        <div className="flex items-start gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', enabled ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300')}>
            {enabled ? <ShieldCheck aria-hidden="true" size={24} /> : <ShieldSlash aria-hidden="true" size={24} />}
          </span>
          <div className="min-w-0">
            <h2 id="local-security-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Acesso e senha local</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Escolha se o GeoGestor deve pedir uma senha ao abrir neste computador.
            </p>
          </div>
        </div>

        <SwitchField
          id="local-auth-enabled"
          name="local_auth_enabled"
          label="Pedir senha ao abrir o GeoGestor"
          description={enabled ? `A sessão será bloqueada após ${policyQuery.data.idleMinutes} minutos sem uso.` : 'Desativado: o aplicativo abre diretamente, sem tela de desbloqueio.'}
          checked={enabled}
          onChange={(checked) => { setEnabledDraft(checked); setError(''); }}
          className="min-h-16 rounded-xl p-4"
        />
      </section>

      <section className={cn(geoPanelClass, 'space-y-4 rounded-2xl p-5')} aria-labelledby="change-local-password-title">
        <div>
          <h2 id="change-local-password-title" className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white"><LockKey aria-hidden="true" size={20} /> Definir ou redefinir senha</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">A senha continua sendo usada para confirmar operações sensíveis, mesmo quando não é exigida na abertura.</p>
        </div>

        {currentPasswordRequired && (
          <div>
            <label htmlFor="current-local-password" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Senha atual</label>
            <input id="current-local-password" name="current_password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(''); }} className={cn(geoFieldClass, 'w-full px-3 py-2.5')} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-local-password" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Nova senha</label>
            <input id="new-local-password" name="new_password" type="password" minLength={8} maxLength={200} autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(''); }} aria-describedby="new-local-password-help" className={cn(geoFieldClass, 'w-full px-3 py-2.5')} />
            <p id="new-local-password-help" className="mt-1 text-xs text-zinc-500">Use pelo menos 8 caracteres.</p>
          </div>
          <div>
            <label htmlFor="confirm-local-password" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Confirmar nova senha</label>
            <input id="confirm-local-password" name="confirm_password" type="password" minLength={8} maxLength={200} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} className={cn(geoFieldClass, 'w-full px-3 py-2.5')} />
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={!canSubmit || mutation.isPending} className={cn(primarySubmitButtonClass, 'min-h-11 disabled:cursor-not-allowed disabled:opacity-50')}>
            <ShieldCheck aria-hidden="true" size={18} /> {mutation.isPending ? 'Salvando…' : 'Salvar segurança'}
          </button>
        </div>
      </section>
    </form>
  );
}
