import { supabase } from '@/integrations/supabase/client';

async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
  return data;
}

export interface CategoriaEvento {
  id_categoria: string;
  nome: string;
  descricao?: string | null;
  cor: string;
  icone: string;
  tipo: 'evento' | 'tarefa' | 'ambos';
  ativo: boolean;
  tenant_id?: string | null;
  created_at?: string;
}

export async function fetchCategorias(
  tipo?: 'evento' | 'tarefa' | 'ambos'
): Promise<CategoriaEvento[]> {
  const tenantId = await getCurrentTenantId();
  
  let query = supabase
    .from('dim_categoria_evento')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .order('nome');

  if (tipo) {
    query = query.or(`tipo.eq.${tipo},tipo.eq.ambos`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as CategoriaEvento[];
}

export async function createCategoria(
  data: Omit<CategoriaEvento, 'id_categoria' | 'created_at' | 'tenant_id'>
): Promise<CategoriaEvento> {
  const tenantId = await getCurrentTenantId();

  const { data: categoria, error } = await supabase
    .from('dim_categoria_evento')
    .insert([{
      nome: data.nome,
      descricao: data.descricao,
      cor: data.cor,
      icone: data.icone,
      tipo: data.tipo,
      ativo: data.ativo,
      tenant_id: tenantId,
    }])
    .select()
    .single();

  if (error) throw error;
  return categoria as CategoriaEvento;
}

export async function updateCategoria(
  id: string,
  data: Partial<Omit<CategoriaEvento, 'id_categoria' | 'created_at' | 'tenant_id'>>
): Promise<CategoriaEvento> {
  const { data: categoria, error } = await supabase
    .from('dim_categoria_evento')
    .update(data)
    .eq('id_categoria', id)
    .select()
    .single();

  if (error) throw error;
  return categoria as CategoriaEvento;
}

export async function deleteCategoria(id: string): Promise<void> {
  const { error } = await supabase
    .from('dim_categoria_evento')
    .delete()
    .eq('id_categoria', id);

  if (error) throw error;
}
