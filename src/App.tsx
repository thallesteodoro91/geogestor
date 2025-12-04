import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TenantProvider } from "./contexts/TenantContext";

const GestaoEmpresa = lazy(() => import("./pages/GestaoEmpresa"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro"));
const Operacional = lazy(() => import("./pages/Operacional"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ServicosOrcamentos = lazy(() => import("./pages/ServicosOrcamentos"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const ClienteDetalhes = lazy(() => import("./pages/ClienteDetalhes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const GeoBotPage = lazy(() => import("./pages/GeoBot"));
const Calendario = lazy(() => import("./pages/Calendario"));
const CalendarioDetalhes = lazy(() => import("./pages/CalendarioDetalhes"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));


const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/" element={<ProtectedRoute><GestaoEmpresa /></ProtectedRoute>} />
                <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
                <Route path="/dashboard-financeiro" element={<ProtectedRoute><DashboardFinanceiro /></ProtectedRoute>} />
                <Route path="/geobot" element={<ProtectedRoute><GeoBotPage /></ProtectedRoute>} />
                <Route path="/calendario" element={<ProtectedRoute><Calendario /></ProtectedRoute>} />
                <Route path="/calendario/:tipo/:id" element={<ProtectedRoute><CalendarioDetalhes /></ProtectedRoute>} />
                <Route path="/operacional" element={<ProtectedRoute><Operacional /></ProtectedRoute>} />
                <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
                <Route path="/clientes/:id" element={<ProtectedRoute><ClienteDetalhes /></ProtectedRoute>} />
                <Route path="/servicos-orcamentos" element={<ProtectedRoute><ServicosOrcamentos /></ProtectedRoute>} />
                <Route path="/despesas" element={<ProtectedRoute><Despesas /></ProtectedRoute>} />
                <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
};

export default App;
