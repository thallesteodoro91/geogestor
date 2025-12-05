/**
 * @fileoverview Serviço de empresas tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface Empresa {
  id_empresa: string;
  nome: string;
  receita?: number | null;
  custo?: number | null;
  despesas?: number | null;
  lucro_bruto?: number | null;
  lucro_liquido?: number | null;
  margem_de_contribuicao?: number | null;
  ponto_de_equilibrio?: number | null;
  custos_variaveis?: number | null;
  template_orcamento_url?: string | null;
  template_config?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchEmpresas() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_empresa').select('*');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('nome');
}

export async function fetchEmpresaById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_empresa').select('*').eq('id_empresa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function createEmpresa(data: Omit<Empresa, 'id_empresa' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  const { template_config, ...rest } = data;
  return supabase.from('dim_empresa').insert({ ...rest, tenant_id: tenantId } as any).select().single();
}

export async function updateEmpresa(id: string, data: Partial<Empresa>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_empresa').update(data as any).eq('id_empresa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteEmpresa(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_empresa').delete().eq('id_empresa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function fetchEmpresaPrincipal() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_empresa').select('*');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.limit(1).maybeSingle();
}
