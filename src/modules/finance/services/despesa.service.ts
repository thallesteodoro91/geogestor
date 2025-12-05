/**
 * @fileoverview Serviço de despesas tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface Despesa {
  id_despesas: string;
  id_tipodespesa?: string | null;
  id_servico?: string | null;
  data_da_despesa: string;
  valor_da_despesa: number;
  observacoes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchDespesas() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`
    *,
    dim_tipodespesa(categoria, subcategoria),
    fato_servico(nome_do_servico)
  `);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_da_despesa', { ascending: false });
}

export async function fetchDespesaById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`
    *,
    dim_tipodespesa(categoria, subcategoria),
    fato_servico(nome_do_servico)
  `).eq('id_despesas', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function fetchDespesasByPeriodo(dataInicio: string, dataFim: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`*, dim_tipodespesa(categoria, subcategoria)`)
    .gte('data_da_despesa', dataInicio)
    .lte('data_da_despesa', dataFim);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_da_despesa', { ascending: false });
}

export async function createDespesa(data: Omit<Despesa, 'id_despesas' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase.from('fato_despesas').insert({ ...data, tenant_id: tenantId }).select().single();
}

export async function updateDespesa(id: string, data: Partial<Despesa>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').update(data).eq('id_despesas', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteDespesa(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').delete().eq('id_despesas', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function fetchDespesasPorCategoria() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`valor_da_despesa, dim_tipodespesa!inner(categoria)`);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}
