/**
 * @fileoverview Serviço base para queries Supabase tenant-aware
 * Centraliza a lógica de filtragem por tenant_id
 * 
 * IMPORTANTE: Todas as queries devem incluir explicitamente o tenant_id
 * para garantir isolamento de dados entre empresas, mesmo com RLS ativo.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Cache do tenant_id do usuário atual
 */
let cachedTenantId: string | null = null;

/**
 * Obtém o tenant_id do usuário atual
 * @throws Error se não houver tenant associado ao usuário
 */
export async function getCurrentTenantId(): Promise<string | null> {
  if (cachedTenantId) return cachedTenantId;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  cachedTenantId = data?.tenant_id || null;
  return cachedTenantId;
}

/**
 * Obtém o tenant_id obrigatoriamente - lança erro se não existir
 * Use esta função quando o tenant_id é obrigatório para a operação
 */
export async function requireTenantId(): Promise<string> {
  const tenantId = await getCurrentTenantId();
  
  if (!tenantId) {
    throw new Error('Sessão inválida: tenant não identificado. Por favor, faça login novamente.');
  }
  
  return tenantId;
}

/**
 * Limpa o cache do tenant_id (usar no logout)
 */
export function clearTenantCache(): void {
  cachedTenantId = null;
}

/**
 * Valida se um registro pertence ao tenant atual
 * Usado para verificação extra de segurança antes de updates/deletes
 */
export async function validateTenantOwnership(
  table: string,
  recordId: string,
  idColumn: string
): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return false;

  const { data, error } = await supabase
    .from(table as any)
    .select('tenant_id')
    .eq(idColumn, recordId)
    .single();

  if (error || !data) return false;
  return (data as any).tenant_id === tenantId;
}

// Limpar cache no logout
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    clearTenantCache();
  }
});
