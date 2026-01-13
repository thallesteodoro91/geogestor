/**
 * @fileoverview Serviço de despesas tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import { registrarDespesaAdicionada } from '@/modules/crm/services/cliente-eventos.service';

export interface Despesa {
  id_despesas: string;
  id_tipodespesa?: string | null;
  id_servico?: string | null;
  id_orcamento?: string | null;
  data_da_despesa: string;
  valor_da_despesa: number;
  observacoes?: string | null;
  status?: string | null; // 'pendente', 'confirmada', 'cancelada'
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchDespesas() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`
    *,
    dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(categoria, subcategoria),
    fato_servico:fato_servico!fk_despesas_servico(nome_do_servico)
  `);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_da_despesa', { ascending: false });
}

export async function fetchDespesaById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`
    *,
    dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(categoria, subcategoria),
    fato_servico:fato_servico!fk_despesas_servico(nome_do_servico)
  `).eq('id_despesas', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function fetchDespesasByPeriodo(dataInicio: string, dataFim: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`*, dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(categoria, subcategoria)`)
    .gte('data_da_despesa', dataInicio)
    .lte('data_da_despesa', dataFim);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_da_despesa', { ascending: false });
}

export async function createDespesa(data: Omit<Despesa, 'id_despesas' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  const result = await supabase.from('fato_despesas').insert({ ...data, tenant_id: tenantId }).select().single();
  
  // Registrar evento na timeline se a despesa estiver vinculada a um serviço
  if (result.data && !result.error && data.id_servico) {
    try {
      // Buscar dados do serviço (cliente + nome)
      const { data: servico } = await supabase
        .from('fato_servico')
        .select('id_cliente, nome_do_servico')
        .eq('id_servico', data.id_servico)
        .single();
      
      if (servico?.id_cliente) {
        // Buscar categoria da despesa
        let categoriaDespesa: string | undefined;
        if (data.id_tipodespesa) {
          const { data: tipo } = await supabase
            .from('dim_tipodespesa')
            .select('categoria')
            .eq('id_tipodespesa', data.id_tipodespesa)
            .single();
          categoriaDespesa = tipo?.categoria;
        }
        
        await registrarDespesaAdicionada(
          servico.id_cliente,
          data.id_servico,
          data.valor_da_despesa,
          categoriaDespesa,
          servico.nome_do_servico
        );
      }
    } catch (e) {
      console.error('Erro ao registrar evento de despesa:', e);
    }
  }
  
  return result;
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
  let query = supabase.from('fato_despesas').select(`valor_da_despesa, dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(categoria)`).not('id_tipodespesa', 'is', null);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function fetchDespesasByOrcamento(orcamentoId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`
    *,
    dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(categoria, subcategoria)
  `).eq('id_orcamento', orcamentoId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('data_da_despesa', { ascending: false });
}
