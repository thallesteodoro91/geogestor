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
  canAccess: (feature: string) => boolean;
  isWithinLimit: (resource: ResourceType, currentCount: number) => boolean;
  /**
   * Verifica limite e mostra toast de erro se atingido
   * @returns true se pode adicionar, false se limite atingido
   */
  checkAndNotify: (resource: ResourceType) => boolean;
}

export function usePlanLimits(): PlanLimits {
  const { subscription, canAddResource, getResourceLimit, isSubscriptionActive } = useTenant();
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();

  const plan = subscription?.plan;
  const isActive = isSubscriptionActive();
  const isTrialing = subscription?.status === 'trialing';

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
    checkAndNotify: () => false,
  };

  if (!plan) return defaultLimits;

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
    canAccess: (feature: string) => {
      if (!isActive) return false;
      return plan.features[feature] === true;
    },
    isWithinLimit: (resource: ResourceType, currentCount: number) => {
      return canAddResource(resource, currentCount);
    },
    checkAndNotify,
  };
}
