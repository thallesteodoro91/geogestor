/**
 * @fileoverview Serviço de propriedades tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import { registrarPropriedadeAdicionada } from './cliente-eventos.service';

export interface Propriedade {
  id_propriedade: string;
  nome_da_propriedade: string;
  id_cliente?: string | null;
  municipio?: string | null;
  cidade?: string | null;
  area_ha?: number | null;
  tipo?: string | null;
  situacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  averbacao?: string | null;
  usucapiao?: string | null;
  marco?: string | null;
  memorial_descritivo?: string | null;
  possui_memorial_descritivo?: string | null;
  documentacao?: string | null;
  tipo_de_documento?: string | null;
  situacao_imovel?: string | null;
  anotacoes?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchPropriedades() {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_propriedade').select('*, dim_cliente(nome)');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('nome_da_propriedade');
}

export async function fetchPropriedadeById(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_propriedade').select('*, dim_cliente(nome)').eq('id_propriedade', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.single();
}

export async function fetchPropriedadesByCliente(clienteId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_propriedade').select('*').eq('id_cliente', clienteId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('nome_da_propriedade');
}

export async function createPropriedade(data: Omit<Propriedade, 'id_propriedade' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  const result = await supabase.from('dim_propriedade').insert({ ...data, tenant_id: tenantId }).select().single();
  
  // Registrar evento na timeline do cliente se houver cliente vinculado
  if (result.data && !result.error && data.id_cliente) {
    try {
      await registrarPropriedadeAdicionada(
        data.id_cliente,
        result.data.id_propriedade,
        result.data.nome_da_propriedade
      );
    } catch (e) {
      console.error('Erro ao registrar evento de propriedade:', e);
    }
  }
  
  return result;
}

export async function updatePropriedade(id: string, data: Partial<Propriedade>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_propriedade').update(data).eq('id_propriedade', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deletePropriedade(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('dim_propriedade').delete().eq('id_propriedade', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}
