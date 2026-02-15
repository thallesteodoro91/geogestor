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

export function usePlanLimits(): PlanLimits {
  const { subscription, canAddResource, getResourceLimit, isSubscriptionActive, isLoading: tenantLoading } = useTenant();
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();

  const plan = subscription?.plan;
  const isActive = isSubscriptionActive();
  const isTrialing = subscription?.status === 'trialing';
  const isOwner = plan?.slug === 'owner';

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
            onClick: () => window.location.href = '/configuracoes',
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
