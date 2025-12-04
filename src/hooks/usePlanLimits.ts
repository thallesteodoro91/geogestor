import { useTenant } from "@/contexts/TenantContext";

export interface PlanLimits {
  maxUsers: number;
  maxProperties: number;
  maxClients: number;
  features: Record<string, boolean>;
  planName: string;
  planSlug: string;
  isTrialing: boolean;
  isActive: boolean;
  canAccess: (feature: string) => boolean;
  isWithinLimit: (resource: 'users' | 'properties' | 'clients', currentCount: number) => boolean;
}

export function usePlanLimits(): PlanLimits {
  const { subscription } = useTenant();

  const plan = subscription?.plan;
  const status = subscription?.status || 'inactive';

  const defaultLimits: PlanLimits = {
    maxUsers: 1,
    maxProperties: 5,
    maxClients: 10,
    features: {},
    planName: 'Sem Plano',
    planSlug: 'none',
    isTrialing: false,
    isActive: false,
    canAccess: () => false,
    isWithinLimit: () => false,
  };

  if (!plan) return defaultLimits;

  const isActive = status === 'active' || status === 'trialing';
  const isTrialing = status === 'trialing';

  return {
    maxUsers: plan.max_users,
    maxProperties: plan.max_properties,
    maxClients: plan.max_clients,
    features: plan.features,
    planName: plan.name,
    planSlug: plan.slug,
    isTrialing,
    isActive,
    canAccess: (feature: string) => {
      if (!isActive) return false;
      return plan.features[feature] === true;
    },
    isWithinLimit: (resource: 'users' | 'properties' | 'clients', currentCount: number) => {
      if (!isActive) return false;
      switch (resource) {
        case 'users':
          return currentCount < plan.max_users;
        case 'properties':
          return currentCount < plan.max_properties;
        case 'clients':
          return currentCount < plan.max_clients;
        default:
          return false;
      }
    },
  };
}
