import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Gear, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { SettingsSaveBar, type SettingsSaveState } from '../../components/SettingsSaveBar';
import { apiClient } from '../../services/apiClient';
import { primarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoPanelClass } from '../../utils/geoTheme';

interface GoogleConfiguration {
  googleClientId?: string;
  googleClientSecretConfigured?: boolean;
}

interface GoogleStatus {
  conectado: boolean;
  syncActive: boolean;
  configured: boolean;
}

const panelClass = cn(
  geoPanelClass,
  'relative overflow-hidden rounded-3xl p-6 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
);

export function GoogleCalendarSettingsPanel() {
  const queryClient = useQueryClient();
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [googleSaveState, setGoogleSaveState] = useState<SettingsSaveState>('saved');
  const [googleSaveError, setGoogleSaveError] = useState('');
  const [googleStatusError, setGoogleStatusError] = useState('');
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ conectado: false, syncActive: false, configured: false });
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const googlePollingRef = useRef<{ interval: number; timeout: number } | null>(null);

  const { data: config } = useQuery<GoogleConfiguration>({
    queryKey: ['configuracoes'],
    queryFn: () => apiClient.get<GoogleConfiguration>('/api/configuracoes')
  });

  useEffect(() => {
    if (!config) return;
    Promise.resolve().then(() => {
      setGoogleClientId(config.googleClientId || '');
      setGoogleClientSecret('');
    });
  }, [config]);

  const fetchGoogleStatus = async () => {
    try {
      const status = await apiClient.get<GoogleStatus>('/api/google/status');
      setGoogleStatus(status);
      setGoogleStatusError('');
    } catch (error) {
      setGoogleStatusError(error instanceof Error ? error.message : 'Não foi possível consultar a integração.');
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchGoogleStatus);
    return () => {
      if (!googlePollingRef.current) return;
      window.clearInterval(googlePollingRef.current.interval);
      window.clearTimeout(googlePollingRef.current.timeout);
    };
  }, []);

  const googleDirty = googleClientId !== (config?.googleClientId || '') || Boolean(googleClientSecret);
  const effectiveSaveState: SettingsSaveState = savingGoogle
    ? 'saving'
    : googleDirty && googleSaveState !== 'error'
      ? 'dirty'
      : googleSaveState;

  const discardGoogleChanges = useCallback(() => {
    setGoogleClientId(config?.googleClientId || '');
    setGoogleClientSecret('');
    setGoogleSaveError('');
    setGoogleSaveState('saved');
  }, [config?.googleClientId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('geogestor:settings-section-state', {
      detail: { section: 'integracoes', state: effectiveSaveState }
    }));
  }, [effectiveSaveState]);

  useEffect(() => {
    const discard = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (section === 'integracoes') discardGoogleChanges();
    };
    window.addEventListener('geogestor:settings-discard', discard);
    return () => window.removeEventListener('geogestor:settings-discard', discard);
  }, [discardGoogleChanges]);

  const handleConnectGoogle = async () => {
    try {
      const result = await apiClient.get<{ url: string }>('/api/google/auth-url');
      if (!result.url) return;
      window.open(result.url, '_blank', 'noopener,noreferrer');
      if (googlePollingRef.current) {
        window.clearInterval(googlePollingRef.current.interval);
        window.clearTimeout(googlePollingRef.current.timeout);
      }
      const interval = window.setInterval(async () => {
        try {
          const status = await apiClient.get<GoogleStatus>('/api/google/status');
          if (!status.conectado) return;
          setGoogleStatus(status);
          window.clearInterval(interval);
          googlePollingRef.current = null;
          toast.success('Google Agenda conectada com sucesso!');
        } catch {
          // Polling transitório não deve interromper a tentativa de conexão.
        }
      }, 3000);
      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        googlePollingRef.current = null;
      }, 120000);
      googlePollingRef.current = { interval, timeout };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar URL de conexão do Google.');
    }
  };

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const result = await apiClient.post<{ sent?: number; received?: number }>('/api/google/sync');
      void fetchGoogleStatus();
      toast.success(`Sincronização concluída!\nEnviados para o Google: ${result.sent || 0}\nRecebidos no GeoGestor: ${result.received || 0}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar com a Google Agenda.');
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleSaveGoogleCredentials = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!googleClientSecret.trim() && !config?.googleClientSecretConfigured) {
      toast.error('Informe a Chave Secreta do Cliente para configurar a integração.');
      return;
    }
    setSavingGoogle(true);
    setGoogleSaveError('');
    try {
      await apiClient.patch('/api/configuracoes', { googleClientId, googleClientSecret });
      await queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      void fetchGoogleStatus();
      setGoogleClientSecret('');
      setGoogleSaveState('success');
      window.setTimeout(() => setGoogleSaveState('saved'), 1800);
      toast.success('Credenciais da Google Agenda salvas com sucesso!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar credenciais.';
      setGoogleSaveError(message);
      setGoogleSaveState('error');
      toast.error(message);
    } finally {
      setSavingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Deseja desconectar sua conta Google?')) return;
    try {
      await apiClient.patch('/api/configuracoes', {
        googleRefreshToken: null,
        googleAccessToken: null,
        googleSyncActive: false
      });
      void fetchGoogleStatus();
      toast.success('Conta Google desconectada!');
    } catch {
      toast.error('Erro ao desconectar conta Google.');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveGoogleCredentials} className={cn(panelClass, 'space-y-6')}>
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white"><Gear className="h-5 w-5 text-indigo-600" /> Credenciais Google API</h2>
            <p className="mt-1 text-xs text-zinc-500">Insira as chaves criadas no Google Cloud Console para sincronizar com sua Google Agenda.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="google-client-id" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ID do cliente (Client ID)</label>
            <input id="google-client-id" name="google_client_id" type="text" autoComplete="off" spellCheck={false} value={googleClientId} onChange={(event) => setGoogleClientId(event.target.value)} placeholder="Cole o Client ID aqui..." className={cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium')} />
          </div>
          <div>
            <label htmlFor="google-client-secret" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Chave secreta do cliente (Client Secret)</label>
            <input id="google-client-secret" name="google_client_secret" type="password" autoComplete="new-password" spellCheck={false} value={googleClientSecret} onChange={(event) => setGoogleClientSecret(event.target.value)} placeholder={config?.googleClientSecretConfigured ? 'Segredo já configurado; deixe vazio para preservar' : 'Cole a Client Secret aqui…'} className={cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium')} />
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500"><ShieldCheck aria-hidden="true" size={14} className="text-emerald-600" /> O segredo é protegido pelo cofre do Windows e nunca volta para esta tela, logs, diagnósticos ou backups.</p>
          </div>
        </div>
      </form>
      <SettingsSaveBar state={effectiveSaveState} errorMessage={googleSaveError} onSave={() => void handleSaveGoogleCredentials()} onDiscard={discardGoogleChanges} />

      <div className={cn(panelClass, 'space-y-6')}>
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white"><Calendar className="h-5 w-5 text-emerald-500" /> Sincronização da Agenda</h2>
            <p className="mt-1 text-xs text-zinc-500">Conecte sua conta do Google e gerencie a sincronização de seus compromissos locais e do Google Calendar.</p>
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand-primary-200/35 bg-gradient-to-r from-brand-primary-50/70 via-white to-brand-turquoise-50/65 p-4 dark:border-brand-primary-300/15 dark:from-brand-primary-400/10 dark:via-zinc-950 dark:to-brand-turquoise-400/10 md:flex-row md:items-center">
          <div>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status da Conexão</span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', googleStatus.conectado ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', googleStatus.conectado ? 'bg-emerald-500' : 'bg-zinc-400')} />
              {googleStatus.conectado ? 'Conectado à Conta Google' : 'Desconectado'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {!googleStatus.conectado ? (
              <button type="button" onClick={handleConnectGoogle} disabled={!googleStatus.configured} className={cn('flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm transition-[background-color,color,box-shadow,transform] active:scale-95', googleStatus.configured ? 'geo-button-base geo-button-revenue geo-focus-ring text-white' : 'cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600')}>Conectar Google Agenda</button>
            ) : (
              <>
                <button type="button" onClick={handleSyncGoogle} disabled={syncingGoogle} className={cn(primarySmallActionButtonClass, 'text-xs disabled:opacity-55')}>{syncingGoogle ? 'Sincronizando...' : 'Sincronização Total (Espelhada)'}</button>
                <button type="button" onClick={handleDisconnectGoogle} className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-700 transition-[background-color,border-color,color] hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">Desconectar</button>
              </>
            )}
          </div>
        </div>
        {googleStatusError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><span>Não foi possível consultar o status da Google Agenda: {googleStatusError}</span><button type="button" onClick={() => void fetchGoogleStatus()} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800">Tentar novamente</button></div>}
        {!googleStatus.configured && <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500"><WarningCircle className="h-4 w-4" /> Cadastre o ID e a Chave Secreta acima para poder conectar sua agenda.</p>}
      </div>
    </div>
  );
}
