import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  settings: Record<string, unknown>;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  plan?: SubscriptionPlan;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  interval: string;
  features: Record<string, boolean>;
  max_users: number;
  max_properties: number;
  max_clients: number;
  is_active: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  subscription: TenantSubscription | null;
  isLoading: boolean;
  error: string | null;
  refetchTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenantData = async () => {
    if (!user) {
      setTenant(null);
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Buscar tenant do usuário
      const { data: memberData, error: memberError } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) {
        throw memberError;
      }

      if (!memberData) {
        // Usuário não tem tenant associado ainda
        setTenant(null);
        setSubscription(null);
        setIsLoading(false);
        return;
      }

      // Buscar dados do tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', memberData.tenant_id)
        .single();

      if (tenantError) throw tenantError;

      setTenant({
        id: tenantData.id,
        name: tenantData.name,
        slug: tenantData.slug,
        logo_url: tenantData.logo_url,
        settings: (tenantData.settings as Record<string, unknown>) || {},
      });

      // Buscar assinatura do tenant
      const { data: subData, error: subError } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('tenant_id', memberData.tenant_id)
        .maybeSingle();

      if (subError) throw subError;

      if (subData) {
        const planData = subData.plan as unknown as SubscriptionPlan;
        setSubscription({
          id: subData.id,
          tenant_id: subData.tenant_id,
          plan_id: subData.plan_id,
          status: subData.status,
          current_period_start: subData.current_period_start,
          current_period_end: subData.current_period_end,
          plan: planData ? {
            id: planData.id,
            name: planData.name,
            slug: planData.slug,
            price_cents: planData.price_cents,
            interval: planData.interval,
            features: (planData.features as Record<string, boolean>) || {},
            max_users: planData.max_users,
            max_properties: planData.max_properties,
            max_clients: planData.max_clients,
            is_active: planData.is_active,
          } : undefined,
        });
      }
    } catch (err) {
      console.error('Error fetching tenant data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do tenant');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [user]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        subscription,
        isLoading,
        error,
        refetchTenant: fetchTenantData,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
