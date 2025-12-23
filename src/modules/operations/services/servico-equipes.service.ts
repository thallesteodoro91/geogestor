/**
 * @fileoverview Serviço de equipes de serviços tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface ServicoEquipe {
  id_designacao: string;
  id_servico: string;
  user_id: string;
  funcao: string;
  created_at?: string;
  tenant_id?: string;
  // Joined fields
  profiles?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export async function fetchEquipeByServico(servicoId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_equipes')
    .select(`
      *,
      profiles:user_id(full_name, email, avatar_url)
    `)
    .eq('id_servico', servicoId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('created_at', { ascending: true });
}

export async function createDesignacao(data: Omit<ServicoEquipe, 'id_designacao' | 'created_at' | 'profiles'>) {
  const tenantId = await getCurrentTenantId();
  return supabase
    .from('servico_equipes')
    .insert({ ...data, tenant_id: tenantId })
    .select(`
      *,
      profiles:user_id(full_name, email, avatar_url)
    `)
    .single();
}

export async function updateDesignacao(id: string, data: Partial<ServicoEquipe>) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_equipes')
    .update(data)
    .eq('id_designacao', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.select().single();
}

export async function deleteDesignacao(id: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_equipes')
    .delete()
    .eq('id_designacao', id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export const FUNCOES_EQUIPE = [
  'Topógrafo',
  'Desenhista',
  'Revisor',
  'Auxiliar Técnico',
  'Coordenador',
  'Outro'
] as const;
