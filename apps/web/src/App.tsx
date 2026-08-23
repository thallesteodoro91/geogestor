import { createBrowserRouter, Navigate, Route, RouterProvider, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthenticatedLayout } from './components/Layout';
import { Toaster, toast } from 'sonner';
import { APP_LEGACY_REDIRECTS, APP_ROUTES, resolveLegacyRedirect } from '@geogestor/contracts';

// Converte alertas globais legados em notificações consistentes com o GeoGestor.
if (typeof window !== 'undefined') {
  window.alert = (message?: unknown) => {
    const msg = String(message);
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('erro') || lowerMsg.includes('falha') || lowerMsg.includes('não foi possível') || lowerMsg.includes('preencha')) {
      toast.error(msg);
    } else if (lowerMsg.includes('sucesso') || lowerMsg.includes('concluíd')) {
      toast.success(msg);
    } else {
      toast.info(msg);
    }
  };
}

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { apiClient } from './services/apiClient';
import { clearLocalSessionToken } from './services/apiClient';
import { hydrateOperationalSettingsCache } from './services/operationalSettings';
import { ApiAvailability } from './components/ApiAvailability';
import { DesbloqueioLocal } from './pages/DesbloqueioLocal';
import { AppSessionProvider, type AppIdentity } from './contexts/AppSessionContext';
import { scheduleCommonRoutePreload } from './utils/routePreloaders';
import {
  initializeNavigationMetrics,
  markNavigationUrlChanged,
  markNavigationUsable,
  recordGlobalFallback
} from './utils/navigationMetrics';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const ListagemClientes = lazy(() => import('./pages/Clientes/ListagemClientes').then((module) => ({ default: module.ListagemClientes })));
const ClienteDetalhes = lazy(() => import('./pages/Clientes/ClienteDetalhes').then((module) => ({ default: module.ClienteDetalhes })));
const ListagemProjetos = lazy(() => import('./pages/Projetos/ListagemProjetos').then((module) => ({ default: module.ListagemProjetos })));
const ProjetoDetalhes = lazy(() => import('./pages/Projetos/ProjetoDetalhes').then((module) => ({ default: module.ProjetoDetalhes })));
const Orcamentos = lazy(() => import('./pages/Orcamentos/Orcamentos').then((module) => ({ default: module.Orcamentos })));
const BudgetEditorPage = lazy(() => import('./pages/Orcamentos/BudgetEditorPage').then((module) => ({ default: module.BudgetEditorPage })));
const Financeiro = lazy(() => import('./pages/Financeiro/Financeiro').then((module) => ({ default: module.Financeiro })));
const ImportacaoDados = lazy(() => import('./pages/Importacao/ImportacaoDados').then((module) => ({ default: module.ImportacaoDados })));
const EsquemasImportacao = lazy(() => import('./pages/Importacao/EsquemasImportacao').then((module) => ({ default: module.EsquemasImportacao })));
const Tarefas = lazy(() => import('./pages/Tarefas/Tarefas').then((module) => ({ default: module.Tarefas })));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios').then((module) => ({ default: module.Relatorios })));
const CalculadoraTopografica = lazy(() => import('./pages/Topografia/CalculadoraTopografica').then((module) => ({ default: module.CalculadoraTopografica })));
const Calendario = lazy(() => import('./pages/Calendario/Calendario').then((module) => ({ default: module.Calendario })));
const CalendarioDetalhes = lazy(() => import('./pages/Calendario/CalendarioDetalhes').then((module) => ({ default: module.CalendarioDetalhes })));
const ListagemAmbiental = lazy(() => import('./pages/Ambiental/ListagemAmbiental').then((module) => ({ default: module.ListagemAmbiental })));
const AmbientalDetalhes = lazy(() => import('./pages/Ambiental/AmbientalDetalhes').then((module) => ({ default: module.AmbientalDetalhes })));
const LicencaDetalhes = lazy(() => import('./pages/Licenciamento/LicencaDetalhes').then((module) => ({ default: module.LicencaDetalhes })));
const CRM = lazy(() => import('./pages/CRM/CRM').then((module) => ({ default: module.CRM })));
const Configuracoes = lazy(() => import('./pages/Configuracoes').then((module) => ({ default: module.Configuracoes })));
const Cadastros = lazy(() => import('./pages/Cadastros').then((module) => ({ default: module.Cadastros })));
const Propriedades = lazy(() => import('./pages/Propriedades').then((module) => ({ default: module.Propriedades })));
const QualidadeDados = lazy(() => import('./pages/QualidadeDados').then((module) => ({ default: module.QualidadeDados })));
const PosAtualizacao = lazy(() => import('./pages/PosAtualizacao').then((module) => ({ default: module.PosAtualizacao })));
const AuditLogs = lazy(() => import('./pages/Relatorios/AuditLogs').then((module) => ({ default: module.AuditLogs })));
const Ajuda = lazy(() => import('./pages/Ajuda/Ajuda').then((module) => ({ default: module.Ajuda })));
const Planejamento = lazy(() => import('./pages/Planejamento').then((module) => ({ default: module.Planejamento })));
const ConfiguracaoInicial = lazy(() => import('./pages/ConfiguracaoInicial').then((module) => ({ default: module.ConfiguracaoInicial })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));
const DevTypeUIPanel = import.meta.env.DEV
  ? lazy(() => import('./components/TypeUIPanel').then((module) => ({ default: module.TypeUIPanel })))
  : null;

let hasReportedFirstRouteUsable = false;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    },
  },
});

function AppLoading() {
  useEffect(() => recordGlobalFallback(), []);

  return (
    <div role="status" aria-live="polite" className="flex h-screen w-full items-center justify-center bg-zinc-50 text-sm font-semibold text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
      Carregando GeoGestor…
    </div>
  );
}

function RouteTransition({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reportStartupMilestone = (
      window.electronAPI as typeof window.electronAPI & {
        reportStartupMilestone?: (milestone: string) => void;
      }
    )?.reportStartupMilestone;

    if (!reportStartupMilestone || hasReportedFirstRouteUsable) return;

    requestAnimationFrame(() => {
      if (hasReportedFirstRouteUsable) return;
      hasReportedFirstRouteUsable = true;
      reportStartupMilestone('first-route-usable');
    });
  }, []);

  return (
    <Suspense
      fallback={(
        <div role="status" aria-live="polite" className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Carregando tela…
        </div>
      )}
    >
      <div className="h-full w-full">{children}</div>
    </Suspense>
  );
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={resolveLegacyRedirect(to, location.search)} replace />;
}

function AppRoutes() {
  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);

  useEffect(() => {
    markNavigationUrlChanged(location.pathname);
  }, [location.key, location.pathname]);

  useEffect(() => {
    if (previousPathnameRef.current === location.pathname) return;
    previousPathnameRef.current = location.pathname;

    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
      window.requestAnimationFrame(() => markNavigationUsable(location.pathname));
    });
  }, [location.pathname]);

  const routes = (
      <Routes location={location}>
        <Route path={APP_ROUTES.setup.path} element={<ConfiguracaoInicial />} />
        <Route element={<AuthenticatedLayout />}>
          <Route path={APP_ROUTES.dashboard.path} element={<RouteTransition><Dashboard /></RouteTransition>} />
          <Route path={APP_ROUTES.clients.path} element={<RouteTransition><ListagemClientes /></RouteTransition>} />
          <Route path={APP_ROUTES.clientDetails.path} element={<RouteTransition><ClienteDetalhes /></RouteTransition>} />
          <Route path={APP_ROUTES.projects.path} element={<RouteTransition><ListagemProjetos /></RouteTransition>} />
          <Route path={APP_ROUTES.projectDetails.path} element={<RouteTransition><ProjetoDetalhes /></RouteTransition>} />
          <Route path={APP_ROUTES.budgets.path} element={<RouteTransition><Orcamentos /></RouteTransition>} />
          <Route path={APP_ROUTES.budgetNew.path} element={<RouteTransition><BudgetEditorPage /></RouteTransition>} />
          <Route path={APP_ROUTES.budgetEdit.path} element={<RouteTransition><BudgetEditorPage /></RouteTransition>} />
          <Route path={APP_ROUTES.finance.path} element={<RouteTransition><Financeiro /></RouteTransition>} />
          <Route path={APP_ROUTES.importData.path} element={<RouteTransition><ImportacaoDados /></RouteTransition>} />
          <Route path={APP_ROUTES.importSchemas.path} element={<RouteTransition><EsquemasImportacao /></RouteTransition>} />
          <Route path={APP_ROUTES.tasks.path} element={<RouteTransition><Tarefas /></RouteTransition>} />
          <Route path={APP_ROUTES.reports.path} element={<RouteTransition><Relatorios /></RouteTransition>} />
          <Route path={APP_ROUTES.topography.path} element={<RouteTransition><CalculadoraTopografica /></RouteTransition>} />
          <Route path={APP_ROUTES.environmental.path} element={<RouteTransition><ListagemAmbiental /></RouteTransition>} />
          <Route path={APP_ROUTES.licenseDetails.path} element={<RouteTransition><LicencaDetalhes /></RouteTransition>} />
          <Route path={APP_ROUTES.environmentalDetails.path} element={<RouteTransition><AmbientalDetalhes /></RouteTransition>} />
          <Route path={APP_ROUTES.calendar.path} element={<RouteTransition><Calendario /></RouteTransition>} />
          <Route path={APP_ROUTES.calendarDetails.path} element={<RouteTransition><CalendarioDetalhes /></RouteTransition>} />
          <Route path={APP_ROUTES.crm.path} element={<RouteTransition><CRM /></RouteTransition>} />
          <Route path={APP_ROUTES.settings.path} element={<RouteTransition><Configuracoes /></RouteTransition>} />
          <Route path={APP_ROUTES.auxiliaryRecords.path} element={<RouteTransition><Cadastros /></RouteTransition>} />
          <Route path={APP_ROUTES.properties.path} element={<RouteTransition><Propriedades /></RouteTransition>} />
          <Route path={APP_ROUTES.dataQuality.path} element={<RouteTransition><QualidadeDados /></RouteTransition>} />
          <Route path={APP_ROUTES.postUpdate.path} element={<RouteTransition><PosAtualizacao /></RouteTransition>} />
          <Route path={APP_ROUTES.auditLogs.path} element={<RouteTransition><AuditLogs /></RouteTransition>} />
          <Route path={APP_ROUTES.help.path} element={<RouteTransition><Ajuda /></RouteTransition>} />
          <Route path={APP_ROUTES.planning.path} element={<RouteTransition><Planejamento /></RouteTransition>} />
          {APP_LEGACY_REDIRECTS.map((redirect) => (
            <Route key={redirect.id} path={redirect.from} element={<LegacyRedirect to={redirect.to} />} />
          ))}
          <Route path="*" element={<RouteTransition><NotFound /></RouteTransition>} />
        </Route>
      </Routes>
  );

  return routes;
}

function SetupGate() {
  useEffect(() => {
    const marker = 'geogestor_operational_storage_migrated_v1';
    void (async () => {
      if (localStorage.getItem(marker) !== 'true') {
        const keys = [
          'geogestor_tipos_servico',
          'geogestor_tipos_despesa',
          'geogestor_jornada_categorias',
          'geogestor_empresa_template',
          'import_schemas',
          'geogestor_alerta_dias'
        ];
        const values: Record<string, unknown> = {};
        for (const key of keys) {
          const stored = localStorage.getItem(key);
          if (stored === null) continue;
          try {
            values[key] = JSON.parse(stored);
          } catch {
            values[key] = stored;
          }
        }
        if (Object.keys(values).length) {
          await apiClient.put('/api/dados-operacionais/configuracoes-operacionais/migrar', { values });
        }
        localStorage.setItem(marker, 'true');
      }
      await hydrateOperationalSettingsCache();
    })().catch(() => undefined);
  }, []);
  const location = useLocation();
  const [forcedLocked, setForcedLocked] = useState(false);
  const [connectionError, setConnectionError] = useState<unknown>(null);
  const statusQuery = useQuery<{
    setupRequired: boolean;
    locked: boolean;
    idleMinutes: number;
    identity: AppIdentity | null;
  }>({
    queryKey: ['auth-status'],
    queryFn: () => apiClient.get('/api/auth/status', { timeoutMs: 2_500 }),
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const retryConnection = useCallback(async () => {
    setConnectionError(connectionError || new Error('Reconexão solicitada.'));
    const result = await statusQuery.refetch();
    if (result.isSuccess) {
      setConnectionError(null);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'auth-status'
      });
    }
  }, [connectionError, statusQuery]);

  useEffect(() => {
    const handleUnavailable = () => {
      setConnectionError(new Error('O serviço local interrompeu a resposta durante o uso.'));
      void statusQuery.refetch().then(async (result) => {
        if (!result.isSuccess) return;
        setConnectionError(null);
        await queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== 'auth-status'
        });
      });
    };
    const handleLocked = () => setForcedLocked(true);
    window.addEventListener('geogestor:api-unavailable', handleUnavailable);
    window.addEventListener('geogestor:session-locked', handleLocked);
    return () => {
      window.removeEventListener('geogestor:api-unavailable', handleUnavailable);
      window.removeEventListener('geogestor:session-locked', handleLocked);
    };
  }, [statusQuery]);

  const lock = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/lock');
    } finally {
      clearLocalSessionToken();
      setForcedLocked(true);
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth-status'
      });
    }
  }, []);

  const sessionValue = useMemo(() => ({
    identity: statusQuery.data?.identity || null,
    lock
  }), [lock, statusQuery.data?.identity]);

  if (statusQuery.isLoading) return <AppLoading />;

  const unavailableError = statusQuery.error || connectionError;
  if (unavailableError && !statusQuery.data) {
    return (
      <ApiAvailability
        error={unavailableError}
        reconnecting={statusQuery.isFetching}
        onRetry={() => void retryConnection()}
        fullScreen
      />
    );
  }

  const isSetupRoute = location.pathname === APP_ROUTES.setup.path;
  if (statusQuery.data?.setupRequired && !isSetupRoute) {
    return <Navigate to={APP_ROUTES.setup.path} replace />;
  }
  if (!statusQuery.data?.setupRequired && isSetupRoute) {
    return <Navigate to={APP_ROUTES.dashboard.path} replace />;
  }

  if (!statusQuery.data?.setupRequired && (forcedLocked || statusQuery.data?.locked)) {
    return (
      <DesbloqueioLocal
        idleMinutes={statusQuery.data?.idleMinutes || 15}
        onUnlocked={async () => {
          setForcedLocked(false);
          await statusQuery.refetch();
          await queryClient.invalidateQueries();
        }}
      />
    );
  }

  return (
    <AppSessionProvider value={sessionValue}>
      {Boolean(unavailableError) && (
        <ApiAvailability
          error={unavailableError}
          reconnecting={statusQuery.isFetching}
          onRetry={() => void retryConnection()}
        />
      )}
      <AppRoutes />
    </AppSessionProvider>
  );
}

const appRouter = createBrowserRouter([{
  path: '*',
  element: (
    <Suspense fallback={<AppLoading />}>
      <ErrorBoundary>
        <SetupGate />
      </ErrorBoundary>
    </Suspense>
  )
}]);

export default function App() {
  const [shutdownProgress, setShutdownProgress] = useState<{ message: string; processedFiles?: number; processedBytes?: number; totalFiles?: number; totalBytes?: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const savedTheme = localStorage.getItem('geogestor_theme');
      const preference = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'system';
      const dark = preference === 'dark' || (preference === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    window.addEventListener('geogestor:theme-change', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('geogestor:theme-change', apply);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onShutdownBackupStatus?.((payload) => {
      if (payload.running) setShutdownProgress({ ...payload, message: payload.message || 'Salvando antes de fechar…' });
      else setShutdownProgress(null);
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => scheduleCommonRoutePreload(), []);
  useEffect(() => initializeNavigationMetrics(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <Toaster position="top-right" richColors closeButton />
        {shutdownProgress && (
          <div role="status" aria-live="assertive" className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/70 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-zinc-900">
              <div aria-hidden="true" className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 motion-reduce:animate-none" />
              <h2 className="mt-4 font-semibold text-zinc-950 dark:text-white">Fechando com segurança</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{shutdownProgress.message}</p>
              {Boolean(shutdownProgress.totalFiles) && (
                <div className="mt-4 text-left">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
                    <div className="h-full rounded-full bg-sky-600 transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.round(((shutdownProgress.processedFiles || 0) / (shutdownProgress.totalFiles || 1)) * 100))}%` }} />
                  </div>
                  <p className="mt-2 text-xs tabular-nums text-zinc-500">{(shutdownProgress.processedFiles || 0).toLocaleString('pt-BR')} de {(shutdownProgress.totalFiles || 0).toLocaleString('pt-BR')} arquivos · {new Intl.NumberFormat('pt-BR', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format((shutdownProgress.processedBytes || 0) / 1024 ** 2)}</p>
                </div>
              )}
              <p className="mt-2 text-xs text-zinc-500">Não desligue o computador até esta janela fechar.</p>
            </div>
          </div>
        )}
        {DevTypeUIPanel && (
          <Suspense fallback={null}>
            <DevTypeUIPanel />
          </Suspense>
        )}
        <RouterProvider router={appRouter} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
