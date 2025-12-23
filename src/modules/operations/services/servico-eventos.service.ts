/**
 * @fileoverview Serviço de eventos/histórico de serviços tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface ServicoEvento {
  id_evento: string;
  id_servico: string;
  tipo: 'criacao' | 'status' | 'tarefa_adicionada' | 'tarefa_concluida' | 'equipe' | 'anexo';
  descricao: string;
  created_at?: string;
  tenant_id?: string;
}

export async function fetchEventosByServico(servicoId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_eventos')
    .select('*')
    .eq('id_servico', servicoId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('created_at', { ascending: false });
}

export async function createEvento(data: Omit<ServicoEvento, 'id_evento' | 'created_at'>) {
  const tenantId = await getCurrentTenantId();
  return supabase
    .from('servico_eventos')
    .insert({ ...data, tenant_id: tenantId })
    .select()
    .single();
}

// Helper functions para criar eventos comuns
export async function registrarCriacaoServico(servicoId: string, nomeServico: string) {
  return createEvento({
    id_servico: servicoId,
    tipo: 'criacao',
    descricao: `Serviço "${nomeServico}" foi criado`
  });
}

export async function registrarMudancaStatus(servicoId: string, statusAnterior: string, novoStatus: string) {
  return createEvento({
    id_servico: servicoId,
    tipo: 'status',
    descricao: `Status alterado de "${statusAnterior}" para "${novoStatus}"`
  });
}

export async function registrarTarefaAdicionada(servicoId: string, tituloTarefa: string) {
  return createEvento({
    id_servico: servicoId,
    tipo: 'tarefa_adicionada',
    descricao: `Nova tarefa adicionada: "${tituloTarefa}"`
  });
}

export async function registrarTarefaConcluida(servicoId: string, tituloTarefa: string) {
  return createEvento({
    id_servico: servicoId,
    tipo: 'tarefa_concluida',
    descricao: `Tarefa concluída: "${tituloTarefa}"`
  });
}

export async function registrarMembroEquipe(servicoId: string, nomeMembro: string, funcao: string) {
  return createEvento({
    id_servico: servicoId,
    tipo: 'equipe',
    descricao: `${nomeMembro} adicionado(a) como ${funcao}`
  });
}

export async function registrarAnexo(servicoId: string, nomeArquivo: string) {
  return createEvento({
    id_servico: servicoId,
    tipo: 'anexo',
    descricao: `Arquivo anexado: "${nomeArquivo}"`
  });
}
