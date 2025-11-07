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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/operacional" element={<Operacional />} />
          <Route path="/planejamento" element={<Planejamento />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cadastros" element={<Cadastros />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
