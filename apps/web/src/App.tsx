import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TypeUIPanel } from './components/TypeUIPanel';
import { Toaster, toast } from 'sonner';

// Intercept global alert to use Sonner (Lovable style)
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

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const ListagemClientes = lazy(() => import('./pages/Clientes/ListagemClientes').then((module) => ({ default: module.ListagemClientes })));
const Contatos = lazy(() => import('./pages/Contatos/Contatos').then((module) => ({ default: module.Contatos })));
const ClienteDetalhes = lazy(() => import('./pages/Clientes/ClienteDetalhes').then((module) => ({ default: module.ClienteDetalhes })));
const ListagemProjetos = lazy(() => import('./pages/Projetos/ListagemProjetos').then((module) => ({ default: module.ListagemProjetos })));
const ProjetoDetalhes = lazy(() => import('./pages/Projetos/ProjetoDetalhes').then((module) => ({ default: module.ProjetoDetalhes })));
const Orcamentos = lazy(() => import('./pages/Orcamentos/Orcamentos').then((module) => ({ default: module.Orcamentos })));
const Financeiro = lazy(() => import('./pages/Financeiro/Financeiro').then((module) => ({ default: module.Financeiro })));
const DashboardFinanceiro = lazy(() => import('./pages/Financeiro/DashboardFinanceiro').then((module) => ({ default: module.DashboardFinanceiro })));
const Despesas = lazy(() => import('./pages/Despesas/Despesas').then((module) => ({ default: module.Despesas })));
const ImportacaoDados = lazy(() => import('./pages/Importacao/ImportacaoDados').then((module) => ({ default: module.ImportacaoDados })));
const EsquemasImportacao = lazy(() => import('./pages/Importacao/EsquemasImportacao').then((module) => ({ default: module.EsquemasImportacao })));
const Operacional = lazy(() => import('./pages/Operacional/Operacional').then((module) => ({ default: module.Operacional })));
const Tarefas = lazy(() => import('./pages/Tarefas/Tarefas').then((module) => ({ default: module.Tarefas })));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios').then((module) => ({ default: module.Relatorios })));
const CalculadoraTopografica = lazy(() => import('./pages/Topografia/CalculadoraTopografica').then((module) => ({ default: module.CalculadoraTopografica })));
const CalculadoraAmbiental = lazy(() => import('./pages/Calculadoras/CalculadoraAmbiental').then((module) => ({ default: module.CalculadoraAmbiental })));
const Calendario = lazy(() => import('./pages/Calendario/Calendario').then((module) => ({ default: module.Calendario })));
const CalendarioDetalhes = lazy(() => import('./pages/Calendario/CalendarioDetalhes').then((module) => ({ default: module.CalendarioDetalhes })));
const ListagemAmbiental = lazy(() => import('./pages/Ambiental/ListagemAmbiental').then((module) => ({ default: module.ListagemAmbiental })));
const AmbientalDetalhes = lazy(() => import('./pages/Ambiental/AmbientalDetalhes').then((module) => ({ default: module.AmbientalDetalhes })));
const Faturas = lazy(() => import('./pages/Faturas/Faturas').then((module) => ({ default: module.Faturas })));
const CRM = lazy(() => import('./pages/CRM/CRM').then((module) => ({ default: module.CRM })));
const Configuracoes = lazy(() => import('./pages/Configuracoes').then((module) => ({ default: module.Configuracoes })));
const Cadastros = lazy(() => import('./pages/Cadastros').then((module) => ({ default: module.Cadastros })));
const RelatorioExecutivo = lazy(() => import('./pages/Relatorios/RelatorioExecutivo').then((module) => ({ default: module.RelatorioExecutivo })));
const AuditLogs = lazy(() => import('./pages/Relatorios/AuditLogs').then((module) => ({ default: module.AuditLogs })));
const Ajuda = lazy(() => import('./pages/Ajuda/Ajuda').then((module) => ({ default: module.Ajuda })));
const Planejamento = lazy(() => import('./pages/Planejamento').then((module) => ({ default: module.Planejamento })));
const ConfiguracaoInicial = lazy(() => import('./pages/ConfiguracaoInicial').then((module) => ({ default: module.ConfiguracaoInicial })));

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
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50 text-sm font-semibold text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
      Carregando GeoGestor...
    </div>
  );
}

function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/configuracoes-iniciais" element={<ConfiguracaoInicial />} />
        <Route path="/" element={<RouteTransition><Dashboard /></RouteTransition>} />
        <Route path="/clientes" element={<RouteTransition><ListagemClientes /></RouteTransition>} />
        <Route path="/clientes/:id" element={<RouteTransition><ClienteDetalhes /></RouteTransition>} />
        <Route path="/contatos" element={<RouteTransition><Contatos /></RouteTransition>} />
        <Route path="/projetos" element={<RouteTransition><ListagemProjetos /></RouteTransition>} />
        <Route path="/projetos/:id" element={<RouteTransition><ProjetoDetalhes /></RouteTransition>} />
        <Route path="/orcamentos" element={<RouteTransition><Orcamentos /></RouteTransition>} />
        <Route path="/financeiro" element={<RouteTransition><Financeiro /></RouteTransition>} />
        <Route path="/dashboard-financeiro" element={<RouteTransition><DashboardFinanceiro /></RouteTransition>} />
        <Route path="/despesas" element={<RouteTransition><Despesas /></RouteTransition>} />
        <Route path="/importacao" element={<RouteTransition><ImportacaoDados /></RouteTransition>} />
        <Route path="/importacao/esquemas" element={<RouteTransition><EsquemasImportacao /></RouteTransition>} />
        <Route path="/operacional" element={<RouteTransition><Operacional /></RouteTransition>} />
        <Route path="/tarefas" element={<RouteTransition><Tarefas /></RouteTransition>} />
        <Route path="/relatorios" element={<RouteTransition><Relatorios /></RouteTransition>} />
        <Route path="/topografia" element={<RouteTransition><CalculadoraTopografica /></RouteTransition>} />
        <Route path="/calculadora-ambiental" element={<RouteTransition><CalculadoraAmbiental /></RouteTransition>} />
        <Route path="/ambiental" element={<RouteTransition><ListagemAmbiental /></RouteTransition>} />
        <Route path="/ambiental/:id" element={<RouteTransition><AmbientalDetalhes /></RouteTransition>} />
        <Route path="/licenciamento" element={<Navigate to="/ambiental?tab=licenciamento" replace />} />
        <Route path="/calendario" element={<RouteTransition><Calendario /></RouteTransition>} />
        <Route path="/calendario/:tipo/:id" element={<RouteTransition><CalendarioDetalhes /></RouteTransition>} />
        <Route path="/faturas" element={<RouteTransition><Faturas /></RouteTransition>} />
        <Route path="/crm" element={<RouteTransition><CRM /></RouteTransition>} />
        <Route path="/configuracoes" element={<RouteTransition><Configuracoes /></RouteTransition>} />
        <Route path="/cadastros" element={<RouteTransition><Cadastros /></RouteTransition>} />
        <Route path="/relatorio-executivo" element={<RouteTransition><RelatorioExecutivo /></RouteTransition>} />
        <Route path="/audit-logs" element={<RouteTransition><AuditLogs /></RouteTransition>} />
        <Route path="/ajuda" element={<RouteTransition><Ajuda /></RouteTransition>} />
        <Route path="/planejamento" element={<RouteTransition><Planejamento /></RouteTransition>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function SetupGate() {
  const location = useLocation();
  const { data: config, isLoading, isError } = useQuery<unknown | null>({
    queryKey: ['configuracoes-bootstrap'],
    queryFn: () => apiClient.get<unknown | null>('/api/configuracoes'),
    retry: 1
  });

  if (isLoading) return <AppLoading />;

  const isSetupRoute = location.pathname === '/configuracoes-iniciais';
  if (!isError && !config && !isSetupRoute) {
    return <Navigate to="/configuracoes-iniciais" replace />;
  }
  if (!isError && config && isSetupRoute) {
    return <Navigate to="/" replace />;
  }

  return <AppRoutes />;
}

export default function App() {
  useEffect(() => {
    // Apply local theme preference on startup
    const savedTheme = localStorage.getItem('geogestor_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors closeButton />
      <TypeUIPanel />
      <BrowserRouter>
        <Suspense fallback={<AppLoading />}>
          <ErrorBoundary>
            <SetupGate />
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
