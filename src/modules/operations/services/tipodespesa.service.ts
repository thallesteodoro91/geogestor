/**
 * @fileoverview Serviço de tipos de despesa tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface TipoDespesa {
  id_tipodespesa: string;
  categoria: string;
  subcategoria?: string | null;
  descricao?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchTiposDespesa() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_tipodespesa').select('*');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('categoria');
}

export async function fetchTipoDespesaById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_tipodespesa').select('*').eq('id_tipodespesa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function createTipoDespesa(data: Omit<TipoDespesa, 'id_tipodespesa' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase.from('dim_tipodespesa').insert({ ...data, tenant_id: tenantId }).select().single();
}

export async function updateTipoDespesa(id: string, data: Partial<TipoDespesa>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_tipodespesa').update(data).eq('id_tipodespesa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteTipoDespesa(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_tipodespesa').delete().eq('id_tipodespesa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function fetchCategoriasDespesa() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_tipodespesa').select('categoria');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data } = await query;
  if (!data) return [];
  return [...new Set(data.map(t => t.categoria))] as string[];
}
