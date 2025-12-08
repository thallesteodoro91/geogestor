import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { tenant, isLoading: tenantLoading, error: tenantError, refetchTenant } = useTenant();
  const location = useLocation();
  const redirectCountRef = useRef(0);
  const lastPathRef = useRef(location.pathname);

  // Detectar loops de redirecionamento
  useEffect(() => {
    if (location.pathname === "/onboarding" && lastPathRef.current !== "/onboarding") {
      redirectCountRef.current += 1;
      console.log('[ProtectedRoute] Redirect to onboarding count:', redirectCountRef.current);
    }
    lastPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Aguarda verificação de autenticação
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Redireciona para login se não autenticado
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Aguarda carregamento do tenant
  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Se houve erro ou loop de redirecionamento, mostrar tela de erro
  if (tenantError || redirectCountRef.current >= 3) {
    console.error('[ProtectedRoute] Tenant error or redirect loop detected:', { tenantError, redirectCount: redirectCountRef.current });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6 max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Erro ao carregar dados</h2>
          <p className="text-muted-foreground">
            {tenantError || "Não foi possível carregar os dados da sua empresa. Isso pode ser um problema temporário."}
          </p>
          <div className="flex gap-2 justify-center">
            <Button 
              onClick={() => {
                redirectCountRef.current = 0;
                refetchTenant();
              }}
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
            <Button 
              onClick={() => {
                supabase.auth.signOut();
              }}
              variant="outline"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Tenant is now auto-created in TenantContext, so we just wait for it
  // No more redirect to onboarding needed

  return <>{children}</>;
};