/**
 * @fileoverview Serviço de orçamentos tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface Orcamento {
  id_orcamento: string;
  id_cliente?: string | null;
  id_propriedade?: string | null;
  id_servico?: string | null;
  data_orcamento: string;
  data_inicio?: string | null;
  data_termino?: string | null;
  quantidade: number;
  valor_unitario: number;
  desconto?: number | null;
  receita_esperada?: number | null;
  receita_esperada_imposto?: number | null;
  receita_realizada?: number | null;
  lucro_esperado?: number | null;
  margem_esperada?: number | null;
  valor_imposto?: number | null;
  orcamento_convertido?: boolean | null;
  faturamento?: boolean | null;
  data_do_faturamento?: string | null;
  valor_faturado?: number | null;
  situacao?: string | null;
  situacao_do_pagamento?: string | null;
  forma_de_pagamento?: string | null;
  incluir_marco?: boolean | null;
  marco_quantidade?: number | null;
  marco_valor_unitario?: number | null;
  marco_valor_total?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchOrcamentos() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').select(`
    *,
    dim_cliente(nome),
    dim_propriedade(nome_da_propriedade),
    fato_servico(nome_do_servico)
  `);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_orcamento', { ascending: false });
}

export async function fetchOrcamentoById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').select(`
    *,
    dim_cliente(nome, telefone, celular, endereco),
    dim_propriedade(nome_da_propriedade, municipio),
    fato_servico(nome_do_servico)
  `).eq('id_orcamento', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function fetchOrcamentosByCliente(clienteId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').select(`*, fato_servico(nome_do_servico)`).eq('id_cliente', clienteId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_orcamento', { ascending: false });
}

export async function createOrcamento(data: Omit<Orcamento, 'id_orcamento' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase.from('fato_orcamento').insert({ ...data, tenant_id: tenantId }).select().single();
}

export async function updateOrcamento(id: string, data: Partial<Orcamento>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').update(data).eq('id_orcamento', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteOrcamento(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').delete().eq('id_orcamento', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function fetchOrcamentosPendentes() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').select(`*, dim_cliente(nome)`)
    .eq('situacao_do_pagamento', 'Pendente')
    .not('data_do_faturamento', 'is', null);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_do_faturamento');
}
