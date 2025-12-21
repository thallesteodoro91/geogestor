/**
 * @fileoverview Serviço de clientes tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface Cliente {
  id_cliente: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  celular?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  categoria?: string | null;
  situacao?: string | null;
  origem?: string | null;
  anotacoes?: string | null;
  data_cadastro?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchClientes() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_cliente').select('*');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('nome');
}

export async function fetchClienteById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_cliente').select('*').eq('id_cliente', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function createCliente(data: Omit<Cliente, 'id_cliente' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase.from('dim_cliente').insert({ ...data, tenant_id: tenantId }).select().single();
}

export async function updateCliente(id: string, data: Partial<Cliente>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_cliente').update(data).eq('id_cliente', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteCliente(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_cliente').delete().eq('id_cliente', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

/**
 * Sanitizes search term for safe use in ILIKE queries
 * Escapes special PostgreSQL ILIKE pattern characters (% and _)
 */
function sanitizeSearchTerm(term: string): string {
  // Escape ILIKE special characters to prevent pattern injection
  return term.replace(/[%_\\]/g, '\\$&');
}

export async function searchClientes(searchTerm: string) {
  const tenantId = await getCurrentTenantId();
  
  // Validate and sanitize search term
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm || trimmedTerm.length > 100) {
    // Return empty result for invalid input
    return { data: [], error: null };
  }
  
  const sanitizedTerm = sanitizeSearchTerm(trimmedTerm);
  let query = supabase.from('dim_cliente').select('*').ilike('nome', `%${sanitizedTerm}%`);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('nome').limit(20);
}
