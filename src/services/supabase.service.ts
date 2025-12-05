/**
 * @fileoverview Serviço base para queries Supabase tenant-aware
 * Centraliza a lógica de filtragem por tenant_id
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Cache do tenant_id do usuário atual
 */
let cachedTenantId: string | null = null;

/**
 * Obtém o tenant_id do usuário atual
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
 * Limpa o cache do tenant_id (usar no logout)
 */
export function clearTenantCache(): void {
  cachedTenantId = null;
}

// Limpar cache no logout
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    clearTenantCache();
  }
});
