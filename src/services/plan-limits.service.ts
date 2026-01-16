/**
 * @fileoverview Serviço de verificação de limites do plano SaaS
 * Valida limites antes de operações de escrita para garantir compliance
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from './supabase.service';

export type ResourceType = 'users' | 'properties' | 'clients';

export interface PlanLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  resourceType: ResourceType;
  message: string;
}

/**
 * Verifica se uma operação está dentro dos limites do plano
 * Esta verificação é feita server-side para evitar manipulação client-side
 */
export async function checkPlanLimit(resourceType: ResourceType): Promise<PlanLimitCheckResult> {
  const tenantId = await getCurrentTenantId();
  
  if (!tenantId) {
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      resourceType,
      message: 'Tenant não identificado. Faça login novamente.',
    };
  }

  // Buscar limites do plano atual
  const { data: subscription, error: subError } = await supabase
    .from('tenant_subscriptions')
    .select(`
      status,
      plan:subscription_plans(
        max_users,
        max_properties,
        max_clients
      )
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (subError || !subscription) {
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      resourceType,
      message: 'Assinatura não encontrada ou inativa. Ative seu plano para continuar.',
    };
  }

  const plan = subscription.plan as { max_users: number; max_properties: number; max_clients: number } | null;
  
  if (!plan) {
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      resourceType,
      message: 'Plano não encontrado.',
    };
  }

  // Contar recursos atuais com filtro explícito de tenant_id
  let currentCount = 0;
  let maxAllowed = 0;

  switch (resourceType) {
    case 'users': {
      const { count } = await supabase
        .from('tenant_members')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      
      // Também contar convites pendentes
      const { count: pendingCount } = await supabase
        .from('tenant_invites')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());
      
      currentCount = (count || 0) + (pendingCount || 0);
      maxAllowed = plan.max_users;
      break;
    }
    case 'properties': {
      const { count } = await supabase
        .from('dim_propriedade')
        .select('id_propriedade', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      currentCount = count || 0;
      maxAllowed = plan.max_properties;
      break;
    }
    case 'clients': {
      const { count } = await supabase
        .from('dim_cliente')
        .select('id_cliente', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      currentCount = count || 0;
      maxAllowed = plan.max_clients;
      break;
    }
  }

  const allowed = currentCount < maxAllowed;
  const resourceNames: Record<ResourceType, string> = {
    users: 'usuários',
    properties: 'propriedades',
    clients: 'clientes',
  };

  return {
    allowed,
    currentCount,
    maxAllowed,
    resourceType,
    message: allowed
      ? `Dentro do limite: ${currentCount}/${maxAllowed} ${resourceNames[resourceType]}`
      : `Limite de ${resourceNames[resourceType]} atingido (${currentCount}/${maxAllowed}). Faça upgrade do seu plano para adicionar mais.`,
  };
}

/**
 * Wrapper para operações de criação com verificação de limite
 * Bloqueia a operação se o limite for atingido
 */
export async function withLimitCheck<T>(
  resourceType: ResourceType,
  operation: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const limitCheck = await checkPlanLimit(resourceType);
  
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: limitCheck.message,
    };
  }

  try {
    const result = await operation();
    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao executar operação',
    };
  }
}
