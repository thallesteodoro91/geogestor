import { useRef, useState } from 'react';
import { ApiError, apiClient } from '../services/apiClient';

type SetupField = 'empresaNome' | 'dadosPasta';
type SetupErrors = Partial<Record<SetupField | '_root', string>>;

const fieldClass = 'geo-focus-ring mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-950 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white';

export function ConfiguracaoInicial() {
  const [empresaNome, setEmpresaNome] = useState('');
  const [dadosPasta, setDadosPasta] = useState('~/GeoGestor');
  const [errors, setErrors] = useState<SetupErrors>({});
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const focusFirstError = (nextErrors: SetupErrors) => {
    const first = (Object.keys(nextErrors) as Array<keyof SetupErrors>).find((field) => field !== '_root');
    if (first) window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(), 0);
  };

  const validate = () => {
    const next: SetupErrors = {};
    if (!empresaNome.trim()) next.empresaNome = 'Informe o nome da empresa.';
    if (!dadosPasta.trim()) next.dadosPasta = 'Informe a pasta usada para armazenar os dados.';
    setErrors(next);
    focusFirstError(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await apiClient.post('/api/configuracoes', {
        empresaNome,
        dadosPasta
      });
      window.location.assign('/');
    } catch (error) {
      const payloadFields = error instanceof ApiError
        && error.payload
        && typeof error.payload === 'object'
        && 'fields' in error.payload
        ? (error.payload as { fields?: SetupErrors }).fields
        : undefined;
      const next = payloadFields && Object.keys(payloadFields).length > 0
        ? payloadFields
        : { _root: error instanceof Error ? error.message : 'Não foi possível concluir a configuração.' };
      setErrors(next);
      focusFirstError(next);
    } finally {
      setLoading(false);
    }
  };

  const bindError = (field: SetupField) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${field}-error` : undefined
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <section className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <header>
          <h1 className="text-center text-3xl font-extrabold text-zinc-950 dark:text-white">
            Bem-vindo ao GeoGestor
          </h1>
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-300">
            Informe apenas os dados básicos do ambiente local. O GeoGestor abrirá diretamente, sem conta e sem login.
          </p>
        </header>
        <form ref={formRef} className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          {errors._root && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {errors._root}
            </p>
          )}
          <div>
            <label htmlFor="empresaNome" className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Nome da empresa</label>
            <input id="empresaNome" name="empresaNome" type="text" autoComplete="organization" value={empresaNome} onChange={(event) => { setEmpresaNome(event.target.value); setErrors((current) => ({ ...current, empresaNome: undefined })); }} {...bindError('empresaNome')} className={fieldClass} />
            {errors.empresaNome && <p id="empresaNome-error" role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{errors.empresaNome}</p>}
          </div>
          <div>
            <label htmlFor="dadosPasta" className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Pasta de dados</label>
            <input id="dadosPasta" name="dadosPasta" type="text" autoComplete="off" spellCheck={false} value={dadosPasta} onChange={(event) => { setDadosPasta(event.target.value); setErrors((current) => ({ ...current, dadosPasta: undefined })); }} {...bindError('dadosPasta')} className={fieldClass} />
            {errors.dadosPasta && <p id="dadosPasta-error" role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{errors.dadosPasta}</p>}
          </div>
          <button type="submit" disabled={loading} aria-busy={loading} className="geo-focus-ring flex min-h-11 w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
            {loading ? 'Salvando…' : 'Concluir configuração'}
          </button>
        </form>
      </section>
    </main>
  );
}
