import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Operacional = lazy(() => import("./pages/Operacional"));
const Planejamento = lazy(() => import("./pages/Planejamento"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Servicos = lazy(() => import("./pages/Servicos"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
              <Route path="/operacional" element={<ProtectedRoute><Operacional /></ProtectedRoute>} />
              <Route path="/planejamento" element={<ProtectedRoute><Planejamento /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/despesas" element={<ProtectedRoute><Despesas /></ProtectedRoute>} />
              <Route path="/servicos" element={<ProtectedRoute><Servicos /></ProtectedRoute>} />
              <Route path="/orcamentos" element={<ProtectedRoute><Orcamentos /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
