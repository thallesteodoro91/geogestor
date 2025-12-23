/**
 * @fileoverview Serviço de tarefas de serviços tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface ServicoTarefa {
  id_tarefa: string;
  id_servico: string;
  titulo: string;
  concluida: boolean;
  ordem: number;
  created_at?: string;
  updated_at?: string;
  tenant_id?: string;
}

export async function fetchTarefasByServico(servicoId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_tarefas')
    .select('*')
    .eq('id_servico', servicoId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('ordem', { ascending: true });
}

export async function createTarefa(data: Omit<ServicoTarefa, 'id_tarefa' | 'created_at' | 'updated_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase
    .from('servico_tarefas')
    .insert({ ...data, tenant_id: tenantId })
    .select()
    .single();
}

export async function updateTarefa(id: string, data: Partial<ServicoTarefa>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_tarefas')
    .update(data)
    .eq('id_tarefa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteTarefa(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_tarefas')
    .delete()
    .eq('id_tarefa', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export async function calcularProgressoServico(servicoId: string): Promise<number> {
  const { data: tarefas } = await fetchTarefasByServico(servicoId);
  if (!tarefas || tarefas.length === 0) return 0;
  const concluidas = tarefas.filter(t => t.concluida).length;
  return Math.round((concluidas / tarefas.length) * 100);
}
