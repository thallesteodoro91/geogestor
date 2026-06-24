import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { SubscriptionExpiredScreen } from "@/components/plan/SubscriptionExpiredScreen";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Reusa o listener único do useAuth — antes havia um segundo
  // onAuthStateChange aqui que disparava re-render a cada refresh de token.
  const { user, loading: authLoading } = useAuth();
  const { tenant, subscription, isLoading: tenantLoading, error: tenantError, refetchTenant } = useTenant();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }


  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
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
