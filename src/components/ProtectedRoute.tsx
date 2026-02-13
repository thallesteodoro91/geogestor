import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { SubscriptionExpiredScreen } from "@/components/plan/SubscriptionExpiredScreen";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { tenant, subscription, isLoading: tenantLoading, error: tenantError, refetchTenant } = useTenant();
  const location = useLocation();
  const redirectCountRef = useRef(0);
  const lastPathRef = useRef(location.pathname);

  // Detectar loops de redirecionamento
  useEffect(() => {
    if (location.pathname === "/onboarding" && lastPathRef.current !== "/onboarding") {
      redirectCountRef.current += 1;
    }
    lastPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => authSub.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (tenantError || redirectCountRef.current >= 3) {
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
              onClick={() => { supabase.auth.signOut(); }}
              variant="outline"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se a assinatura expirou (bypass para plano Owner)
  const isOwnerPlan = subscription?.plan?.slug === 'owner';
  if (!isOwnerPlan && subscription && subscription.current_period_end) {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const isExpired = periodEnd < now;
    const status = subscription.status;

    if (isExpired && status !== 'active') {
      return (
        <SubscriptionExpiredScreen
          planName={subscription.plan?.name || 'Completo'}
          expiredAt={subscription.current_period_end}
        />
      );
    }
  }

  return <>{children}</>;
};
