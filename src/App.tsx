import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Financeiro from "./pages/Financeiro";
import Operacional from "./pages/Operacional";
import Planejamento from "./pages/Planejamento";
import Clientes from "./pages/Clientes";
import Cadastros from "./pages/Cadastros";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Despesas from "./pages/Despesas";
import Servicos from "./pages/Servicos";
import Orcamentos from "./pages/Orcamentos";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
