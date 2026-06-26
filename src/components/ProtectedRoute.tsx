import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { SubscriptionExpiredScreen } from "@/components/plan/SubscriptionExpiredScreen";

/**
 * Loader com aviso após timeout — antes ficava em "Carregando..." indefinidamente
 * quando o token/tenant não respondia, dando a impressão de tela travada.
 */
const LoadingScreen = ({ onRetry }: { onRetry?: () => void }) => {
  const [showWarn, setShowWarn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowWarn(true), 8000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-6 max-w-md">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
        {showWarn && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Está demorando mais que o normal. Verifique sua conexão.
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="default" onClick={() => (onRetry ? onRetry() : window.location.reload())}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
              <Button size="sm" variant="outline" onClick={() => { supabase.auth.signOut(); }}>
                Sair
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Reusa o listener único do useAuth — antes havia um segundo
  // onAuthStateChange aqui que disparava re-render a cada refresh de token.
  const { user, loading: authLoading } = useAuth();
  const { tenant, subscription, isLoading: tenantLoading, error: tenantError, refetchTenant } = useTenant();

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }


  if (tenantLoading) {
    return <LoadingScreen onRetry={() => refetchTenant()} />;
  }

  if (tenantError) {
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

  // Verificar se a assinatura expirou (bypass para plano Owner e status active)
  const isOwnerPlan = subscription?.plan?.slug === 'owner';
  const isActive = subscription?.status === 'active';
  
  // Owner plan NEVER expires; active (paid) subscriptions are always allowed
  // Trialing with expired period = blocked (no cron changes status automatically)
  if (!isOwnerPlan && !isActive && subscription && subscription.current_period_end) {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const isExpired = periodEnd < now;

    if (isExpired) {
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
