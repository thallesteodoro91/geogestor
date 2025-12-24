/**
 * @fileoverview Serviço de serviços/operações tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface Servico {
  id_servico: string;
  nome_do_servico: string;
  descricao?: string | null;
  id_cliente?: string | null;
  id_propriedade?: string | null;
  id_empresa?: string | null;
  id_orcamento?: string | null;
  categoria?: string | null;
  data_do_servico_inicio?: string | null;
  data_do_servico_fim?: string | null;
  situacao_do_servico?: string | null;
  progresso?: number | null;
  receita_servico?: number | null;
  custo_servico?: number | null;
  numero_de_servicos_concluidos?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchServicos() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').select(`
    *,
    dim_cliente(nome),
    dim_propriedade(nome_da_propriedade, municipio),
    dim_empresa(nome)
  `);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('created_at', { ascending: false });
}

export async function fetchServicoById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').select(`
    *,
    dim_cliente(nome),
    dim_propriedade(nome_da_propriedade, municipio),
    dim_empresa(nome)
  `).eq('id_servico', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function fetchServicosByCliente(clienteId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').select(`*, dim_propriedade(nome_da_propriedade), dim_empresa(nome)`)
    .eq('id_cliente', clienteId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_do_servico_inicio', { ascending: false });
}

export async function fetchServicosByPropriedade(propriedadeId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').select(`*, dim_cliente(nome), dim_empresa(nome)`)
    .eq('id_propriedade', propriedadeId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_do_servico_inicio', { ascending: false });
}

export async function createServico(data: Omit<Servico, 'id_servico' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase.from('fato_servico').insert({ ...data, tenant_id: tenantId }).select().single();
}

export async function updateServico(id: string, data: Partial<Servico>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').update(data).eq('id_servico', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteServico(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').delete().eq('id_servico', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function fetchServicosCategorias() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_servico').select('categoria');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data } = await query;
  if (!data) return [];
  return [...new Set(data.map(s => s.categoria).filter(Boolean))] as string[];
}
