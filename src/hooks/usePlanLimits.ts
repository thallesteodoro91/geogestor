import { useTenant, ResourceType } from "@/contexts/TenantContext";
import { useResourceCounts } from "./useResourceCounts";
import { toast } from "sonner";

export interface PlanLimits {
  maxUsers: number;
  maxProperties: number;
  maxClients: number;
  features: Record<string, boolean>;
  planName: string;
  planSlug: string;
  isTrialing: boolean;
  isActive: boolean;
  isLoading: boolean;
  isWithinLimit: (resource: ResourceType, currentCount: number) => boolean;
  /**
   * Verifica limite e mostra toast de erro se atingido
   * @returns true se pode adicionar, false se limite atingido
   */
  checkAndNotify: (resource: ResourceType) => boolean;
}

/**
 * DEBUG ONLY: allows QA to force plan limits regardless of the actual plan
 * (including owner bypass). Reads from URL `?debugLimits=clients:N,properties:N,users:N`
 * and persists to sessionStorage as `debug_plan_limits`. To clear:
 * `sessionStorage.removeItem('debug_plan_limits')` or visit `?debugLimits=off`.
 */
function readDebugLimits(): { maxUsers?: number; maxProperties?: number; maxClients?: number } | null {
  if (typeof window === 'undefined') return null;
  // Production hard-guard: debug overrides are dev-only.
  if (!import.meta.env.DEV) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('debugLimits');
    if (raw === 'off') {
      sessionStorage.removeItem('debug_plan_limits');
      return null;
    }
    if (raw) {
      const parsed: Record<string, number> = {};
      raw.split(',').forEach((pair) => {
        const [k, v] = pair.split(':');
        if (k && v && !isNaN(Number(v))) parsed[k.trim()] = Number(v);
      });
      const result = {
        maxClients: parsed.clients,
        maxProperties: parsed.properties,
        maxUsers: parsed.users,
      };
      sessionStorage.setItem('debug_plan_limits', JSON.stringify(result));
      return result;
    }
    const stored = sessionStorage.getItem('debug_plan_limits');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function usePlanLimits(): PlanLimits {
  const { subscription, canAddResource, getResourceLimit, isSubscriptionActive, isLoading: tenantLoading } = useTenant();
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();

  const plan = subscription?.plan;
  const isActive = isSubscriptionActive();
  const isTrialing = subscription?.status === 'trialing';
  const isOwner = plan?.slug === 'owner';
  const debug = readDebugLimits();

  // DEBUG override: short-circuits owner bypass and DB limits for QA validation
  if (debug && plan) {
    const maxUsers = debug.maxUsers ?? plan.max_users;
    const maxProperties = debug.maxProperties ?? plan.max_properties;
    const maxClients = debug.maxClients ?? plan.max_clients;
    const counts: Record<ResourceType, number> = {
      users: usersCount,
      properties: propertiesCount,
      clients: clientsCount,
    };
    const maxes: Record<ResourceType, number> = {
      users: maxUsers,
      properties: maxProperties,
      clients: maxClients,
    };
    const resourceNames: Record<ResourceType, string> = {
      users: 'usuários',
      properties: 'propriedades',
      clients: 'clientes',
    };
    return {
      maxUsers,
      maxProperties,
      maxClients,
      features: plan.features || {},
      planName: `${plan.name} (debug)`,
      planSlug: plan.slug,
      isTrialing,
      isActive: true,
      isLoading: false,
      isWithinLimit: (resource, currentCount) => currentCount < maxes[resource],
      checkAndNotify: (resource) => {
        const ok = counts[resource] < maxes[resource];
        if (!ok) {
          toast.error(
            `Limite de ${resourceNames[resource]} atingido (${counts[resource]}/${maxes[resource]})`,
            {
              description: 'Faça upgrade do seu plano para adicionar mais.',
              action: { label: 'Ver Planos', onClick: () => (window.location.href = '/assinatura') },
              duration: 6000,
            }
          );
        }
        return ok;
      },
    };
  }

  // Owner plan: unlimited everything, never blocked
  if (plan && isOwner) {
    return {
      maxUsers: 99999,
      maxProperties: 99999,
      maxClients: 99999,
      features: plan.features || {},
      planName: plan.name,
      planSlug: plan.slug,
      isTrialing: false,
      isActive: true,
      isLoading: false,
      isWithinLimit: () => true,
      checkAndNotify: () => true,
    };
  }

  // While loading, be permissive to avoid false "limit reached" alerts
  if (tenantLoading || !plan) {
    return {
      maxUsers: 9999,
      maxProperties: 99999,
      maxClients: 99999,
      features: {},
      planName: tenantLoading ? 'Carregando...' : 'Sem Plano',
      planSlug: 'none',
      isTrialing: false,
      isActive: true,
      isLoading: tenantLoading,
      isWithinLimit: () => true,
      checkAndNotify: () => true,
    };
  }

  const getCurrentCount = (resource: ResourceType): number => {
    switch (resource) {
      case 'users':
        return usersCount;
      case 'properties':
        return propertiesCount;
      case 'clients':
        return clientsCount;
      default:
        return 0;
    }
  };

  const resourceNames: Record<ResourceType, string> = {
    users: 'usuários',
    properties: 'propriedades',
    clients: 'clientes',
  };

  const checkAndNotify = (resource: ResourceType): boolean => {
    const currentCount = getCurrentCount(resource);
    const maxAllowed = getResourceLimit(resource);
    const canAdd = canAddResource(resource, currentCount);

    if (!canAdd) {
      toast.error(
        `Limite de ${resourceNames[resource]} atingido (${currentCount}/${maxAllowed})`,
        {
          description: 'Faça upgrade do seu plano para adicionar mais.',
          action: {
            label: 'Ver Planos',
            onClick: () => window.location.href = '/assinatura',
          },
          duration: 6000,
        }
      );
    }

    return canAdd;
  };

  return {
    maxUsers: plan.max_users,
    maxProperties: plan.max_properties,
    maxClients: plan.max_clients,
    features: plan.features,
    planName: plan.name,
    planSlug: plan.slug,
    isTrialing,
    isActive,
    isLoading: false,
    isWithinLimit: (resource: ResourceType, currentCount: number) => {
      return canAddResource(resource, currentCount);
    },
    checkAndNotify,
  };
}
