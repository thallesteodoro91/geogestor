import { useEffect, useRef, useState } from 'react';
import { LockKey, ShieldCheck } from '@phosphor-icons/react';
import { ApiError, apiClient, setLocalSessionToken } from '../services/apiClient';
import type { AppIdentity } from '../contexts/AppSessionContext';

interface UnlockResponse {
  token: string;
  expiresAt: string;
  idleMinutes: number;
  identity: AppIdentity;
  notice: string;
}

interface DesbloqueioLocalProps {
  idleMinutes: number;
  onUnlocked: (identity: AppIdentity) => void;
}

export function DesbloqueioLocal({ idleMinutes, onUnlocked }: DesbloqueioLocalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Informe a senha local.');
      passwordRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.post<UnlockResponse>('/api/auth/unlock', { password }, { timeoutMs: 4_000 });
      setLocalSessionToken(result.token);
      setPassword('');
      onUnlocked(result.identity);
    } catch (unlockError) {
      setError(unlockError instanceof ApiError ? unlockError.message : 'Não foi possível desbloquear o GeoGestor.');
      passwordRef.current?.focus();
      passwordRef.current?.select();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <LockKey aria-hidden="true" size={30} weight="duotone" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold text-zinc-950 dark:text-white">Desbloquear GeoGestor</h1>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Informe a senha local configurada neste computador.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="local-password" className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Senha local
            </label>
            <input
              ref={passwordRef}
              id="local-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'local-password-error' : 'local-password-help'}
              className="geo-focus-ring mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
            {error ? (
              <p id="local-password-error" role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            ) : (
              <p id="local-password-help" className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                A sessão será bloqueada após {idleMinutes} minutos de inatividade.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="geo-focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
          >
            <ShieldCheck aria-hidden="true" />
            {loading ? 'Verificando…' : 'Desbloquear'}
          </button>
        </form>
        <p className="mt-5 rounded-lg bg-zinc-100 p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          A senha bloqueia o acesso pelo aplicativo, mas não equivale à criptografia integral do arquivo SQLite.
        </p>
      </section>
    </main>
  );
}
