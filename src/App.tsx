import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TenantProvider } from "./contexts/TenantContext";
import { ChartSettingsProvider } from "./contexts/ChartSettingsContext";
import { AppSkeleton } from "./components/layout/AppSkeleton";
import { PWAPrompt } from "./components/pwa/PWAPrompt";

const GestaoEmpresa = lazy(() => import("./pages/GestaoEmpresa"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro"));
const Operacional = lazy(() => import("./pages/Operacional"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Servicos = lazy(() => import("./pages/Servicos"));
const ServicoDetalhes = lazy(() => import("./pages/ServicoDetalhes"));
const ServicosOrcamentos = lazy(() => import("./pages/ServicosOrcamentos"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const ClienteDetalhes = lazy(() => import("./pages/ClienteDetalhes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const GeoBotPage = lazy(() => import("./pages/GeoBot"));
const Calendario = lazy(() => import("./pages/Calendario"));
const CalendarioDetalhes = lazy(() => import("./pages/CalendarioDetalhes"));
const AceitarConvite = lazy(() => import("./pages/AceitarConvite"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Assinatura = lazy(() => import("./pages/Assinatura"));
const Faturas = lazy(() => import("./pages/Faturas"));
const CheckoutSucesso = lazy(() => import("./pages/CheckoutSucesso"));
const CheckoutCancelado = lazy(() => import("./pages/CheckoutCancelado"));
const RelatorioExecutivo = lazy(() => import("./pages/RelatorioExecutivo"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const ImportacaoDados = lazy(() => import("./pages/ImportacaoDados"));
const EsquemasImportacao = lazy(() => import("./pages/EsquemasImportacao"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));


// Defaults conservadores para evitar refetch em cascata após refresh
// de token / foco da janela (causa raiz da explosão de chamadas a
// calcular_kpis_v2 e dim_cliente vistas no pg_stat_statements).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});


const App = () => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TenantProvider>
          <ChartSettingsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PWAPrompt />
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <Suspense fallback={<AppSkeleton />}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/aceitar-convite" element={<AceitarConvite />} />
                    <Route path="/" element={<ProtectedRoute><GestaoEmpresa /></ProtectedRoute>} />
                    <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
                    <Route path="/dashboard-financeiro" element={<ProtectedRoute><DashboardFinanceiro /></ProtectedRoute>} />
                    <Route path="/geobot" element={<ProtectedRoute><GeoBotPage /></ProtectedRoute>} />
                    <Route path="/calendario" element={<ProtectedRoute><Calendario /></ProtectedRoute>} />
                    <Route path="/calendario/:tipo/:id" element={<ProtectedRoute><CalendarioDetalhes /></ProtectedRoute>} />
                    <Route path="/operacional" element={<ProtectedRoute><Operacional /></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
                    <Route path="/clientes/:id" element={<ProtectedRoute><ClienteDetalhes /></ProtectedRoute>} />
                    {/* Projetos (renamed from Serviços) */}
                    <Route path="/projetos" element={<ProtectedRoute><Servicos /></ProtectedRoute>} />
                    <Route path="/projetos/:id" element={<ProtectedRoute><ServicoDetalhes /></ProtectedRoute>} />
                    {/* Orçamentos (simplified from /servicos-orcamentos) */}
                    <Route path="/orcamentos" element={<ProtectedRoute><ServicosOrcamentos /></ProtectedRoute>} />
                    <Route path="/despesas" element={<ProtectedRoute><Despesas /></ProtectedRoute>} />
                    <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
                    <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                    <Route path="/perfil" element={<Navigate to="/configuracoes?tab=conta" replace />} />
                    <Route path="/importacao" element={<ProtectedRoute><ImportacaoDados /></ProtectedRoute>} />
                    <Route path="/importacao/esquemas" element={<ProtectedRoute><EsquemasImportacao /></ProtectedRoute>} />
                    <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                    <Route path="/relatorio-executivo" element={<ProtectedRoute><RelatorioExecutivo /></ProtectedRoute>} />
                    <Route path="/ajuda" element={<ProtectedRoute><Ajuda /></ProtectedRoute>} />
                    <Route path="/assinatura" element={<Assinatura />} />
                    <Route path="/faturas" element={<ProtectedRoute><Faturas /></ProtectedRoute>} />
                    <Route path="/checkout-sucesso" element={<ProtectedRoute><CheckoutSucesso /></ProtectedRoute>} />
                    <Route path="/checkout-cancelado" element={<CheckoutCancelado />} />
                    <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                    {/* Redirects from old routes */}
                    <Route path="/servicos" element={<Navigate to="/projetos" replace />} />
                    <Route path="/servicos/:id" element={<Navigate to="/projetos" replace />} />
                    <Route path="/servicos-orcamentos" element={<Navigate to="/orcamentos" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ChartSettingsProvider>
        </TenantProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
