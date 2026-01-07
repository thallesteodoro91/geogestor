/**
 * @fileoverview Serviço de serviços/operações tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import { registrarServicoIniciado, registrarServicoConcluido } from '@/modules/crm/services/cliente-eventos.service';

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
  const result = await supabase.from('fato_servico').insert({ ...data, tenant_id: tenantId }).select().single();
  
  // Registrar evento na timeline do cliente se houver cliente vinculado
  if (result.data && !result.error && data.id_cliente) {
    try {
      await registrarServicoIniciado(
        data.id_cliente,
        result.data.id_servico,
        result.data.nome_do_servico
      );
    } catch (e) {
      console.error('Erro ao registrar evento de serviço:', e);
    }
  }
  
  return result;
}

export async function updateServico(id: string, data: Partial<Servico>) {
  const tenantId = await getCurrentTenantId();
  
  // Buscar dados atuais do serviço para verificar mudança de status
  const { data: servicoAtual } = await supabase
    .from('fato_servico')
    .select('situacao_do_servico, id_cliente, nome_do_servico')
    .eq('id_servico', id)
    .single();
  
  let query = supabase.from('fato_servico').update(data).eq('id_servico', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const result = await query.select().single();
  
  // Registrar evento se o serviço foi concluído
  if (
    result.data && 
    !result.error && 
    servicoAtual?.id_cliente &&
    data.situacao_do_servico === 'Concluído' && 
    servicoAtual.situacao_do_servico !== 'Concluído'
  ) {
    try {
      await registrarServicoConcluido(
        servicoAtual.id_cliente,
        id,
        servicoAtual.nome_do_servico
      );
    } catch (e) {
      console.error('Erro ao registrar evento de serviço concluído:', e);
    }
  }
  
  return result;
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
