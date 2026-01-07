import { supabase } from '@/integrations/supabase/client';

async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
  return data;
}

export interface ClienteTarefa {
  id_tarefa: string;
  id_cliente: string;
  id_servico?: string | null;
  id_propriedade?: string | null;
  titulo: string;
  categoria: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  concluida: boolean;
  data_conclusao?: string | null;
  data_vencimento?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
  tenant_id?: string | null;
}

export interface FiltrosTarefa {
  categoria?: string;
  id_servico?: string;
  concluida?: boolean;
}

export async function fetchTarefasByCliente(
  clienteId: string,
  filtros?: FiltrosTarefa
): Promise<ClienteTarefa[]> {
  const tenantId = await getCurrentTenantId();

  let query = supabase
    .from('cliente_tarefas')
    .select('*')
    .eq('id_cliente', clienteId)
    .eq('tenant_id', tenantId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false });

  if (filtros?.categoria) {
    query = query.eq('categoria', filtros.categoria);
  }
  if (filtros?.id_servico) {
    query = query.eq('id_servico', filtros.id_servico);
  }
  if (filtros?.concluida !== undefined) {
    query = query.eq('concluida', filtros.concluida);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ClienteTarefa[];
}

export async function createTarefa(
  data: Omit<ClienteTarefa, 'id_tarefa' | 'created_at' | 'updated_at' | 'tenant_id'>
): Promise<ClienteTarefa> {
  const tenantId = await getCurrentTenantId();

  const { data: tarefa, error } = await supabase
    .from('cliente_tarefas')
    .insert({ ...data, tenant_id: tenantId })
    .select()
    .single();

  if (error) throw error;
  return tarefa as ClienteTarefa;
}

export async function updateTarefa(
  id: string,
  data: Partial<Omit<ClienteTarefa, 'id_tarefa' | 'created_at' | 'updated_at' | 'tenant_id'>>
): Promise<ClienteTarefa> {
  const { data: tarefa, error } = await supabase
    .from('cliente_tarefas')
    .update(data)
    .eq('id_tarefa', id)
    .select()
    .single();

  if (error) throw error;
  return tarefa as ClienteTarefa;
}

export async function deleteTarefa(id: string): Promise<void> {
  const { error } = await supabase
    .from('cliente_tarefas')
    .delete()
    .eq('id_tarefa', id);

  if (error) throw error;
}

export async function getTarefasPendentes(clienteId: string): Promise<number> {
  const tenantId = await getCurrentTenantId();

  const { count, error } = await supabase
    .from('cliente_tarefas')
    .select('*', { count: 'exact', head: true })
    .eq('id_cliente', clienteId)
    .eq('tenant_id', tenantId)
    .eq('concluida', false);

  if (error) throw error;
  return count || 0;
}

export async function marcarTarefaConcluida(
  id: string,
  concluida: boolean
): Promise<ClienteTarefa> {
  return updateTarefa(id, {
    concluida,
    data_conclusao: concluida ? new Date().toISOString() : null,
  });
}
