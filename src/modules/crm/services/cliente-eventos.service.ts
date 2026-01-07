import { supabase } from '@/integrations/supabase/client';

async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
  return data;
}
export interface ClienteEvento {
  id_evento: string;
  id_cliente: string;
  id_servico?: string | null;
  id_propriedade?: string | null;
  tipo: string;
  categoria: string;
  titulo: string;
  descricao?: string | null;
  metadata?: Record<string, unknown> | null;
  manual: boolean;
  created_at: string;
  data_evento?: string | null;
  tenant_id?: string | null;
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface FiltrosEvento {
  categoria?: string;
  id_servico?: string;
  id_propriedade?: string;
}

export async function fetchEventosByCliente(
  clienteId: string,
  filtros?: FiltrosEvento
): Promise<ClienteEvento[]> {
  const tenantId = await getCurrentTenantId();
  
  let query = supabase
    .from('cliente_eventos')
    .select('*')
    .eq('id_cliente', clienteId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filtros?.categoria) {
    query = query.eq('categoria', filtros.categoria);
  }
  if (filtros?.id_servico) {
    query = query.eq('id_servico', filtros.id_servico);
  }
  if (filtros?.id_propriedade) {
    query = query.eq('id_propriedade', filtros.id_propriedade);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ClienteEvento[];
}

export async function createEvento(
  data: Omit<ClienteEvento, 'id_evento' | 'created_at' | 'tenant_id'>
): Promise<ClienteEvento> {
  const tenantId = await getCurrentTenantId();

  const insertData: {
    id_cliente: string;
    id_servico?: string | null;
    id_propriedade?: string | null;
    tipo: string;
    categoria: string;
    titulo: string;
    descricao?: string | null;
    metadata?: Json | null;
    manual?: boolean;
    tenant_id: string | null;
  } = {
    id_cliente: data.id_cliente,
    id_servico: data.id_servico,
    id_propriedade: data.id_propriedade,
    tipo: data.tipo,
    categoria: data.categoria,
    titulo: data.titulo,
    descricao: data.descricao,
    metadata: data.metadata as Json | null,
    manual: data.manual,
    tenant_id: tenantId,
  };

  const { data: evento, error } = await supabase
    .from('cliente_eventos')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;
  return evento as ClienteEvento;
}

export async function deleteEvento(eventoId: string): Promise<void> {
  const { error } = await supabase
    .from('cliente_eventos')
    .delete()
    .eq('id_evento', eventoId);

  if (error) throw error;
}

// Helper functions for automatic event registration
export async function registrarCadastroCliente(
  clienteId: string,
  nomeCliente: string
): Promise<ClienteEvento> {
  return createEvento({
    id_cliente: clienteId,
    tipo: 'cadastro',
    categoria: 'cliente',
    titulo: 'Cliente cadastrado',
    descricao: `${nomeCliente} foi cadastrado no sistema`,
    manual: false,
  });
}

export async function registrarPropriedadeAdicionada(
  clienteId: string,
  propriedadeId: string,
  nomePropriedade: string
): Promise<ClienteEvento> {
  return createEvento({
    id_cliente: clienteId,
    id_propriedade: propriedadeId,
    tipo: 'propriedade',
    categoria: 'cliente',
    titulo: 'Nova propriedade adicionada',
    descricao: `Propriedade "${nomePropriedade}" foi vinculada ao cliente`,
    manual: false,
  });
}

export async function registrarServicoIniciado(
  clienteId: string,
  servicoId: string,
  nomeServico: string
): Promise<ClienteEvento> {
  return createEvento({
    id_cliente: clienteId,
    id_servico: servicoId,
    tipo: 'servico',
    categoria: 'trabalho',
    titulo: 'Serviço iniciado',
    descricao: `Serviço "${nomeServico}" foi iniciado`,
    manual: false,
  });
}

export async function registrarServicoConcluido(
  clienteId: string,
  servicoId: string,
  nomeServico: string
): Promise<ClienteEvento> {
  return createEvento({
    id_cliente: clienteId,
    id_servico: servicoId,
    tipo: 'servico',
    categoria: 'trabalho',
    titulo: 'Serviço concluído',
    descricao: `Serviço "${nomeServico}" foi finalizado com sucesso`,
    manual: false,
  });
}

export async function registrarDocumentoRecebido(
  clienteId: string,
  nomeDocumento: string,
  categoria: string
): Promise<ClienteEvento> {
  return createEvento({
    id_cliente: clienteId,
    tipo: 'documento',
    categoria,
    titulo: 'Documento recebido',
    descricao: `Documento "${nomeDocumento}" foi recebido`,
    manual: false,
  });
}

export async function registrarOrcamentoEmitido(
  clienteId: string,
  codigoOrcamento: string,
  servicoId?: string
): Promise<ClienteEvento> {
  return createEvento({
    id_cliente: clienteId,
    id_servico: servicoId || null,
    tipo: 'orcamento',
    categoria: 'financeiro',
    titulo: 'Orçamento emitido',
    descricao: `Orçamento ${codigoOrcamento} foi emitido`,
    manual: false,
  });
}

export async function registrarNotaManual(
  clienteId: string,
  titulo: string,
  descricao?: string,
  servicoId?: string,
  categoria: string = 'interno',
  dataEvento?: string
): Promise<ClienteEvento> {
  const tenantId = await getCurrentTenantId();
  
  const insertData: {
    id_cliente: string;
    id_servico?: string | null;
    tipo: string;
    categoria: string;
    titulo: string;
    descricao?: string | null;
    manual: boolean;
    data_evento?: string | null;
    tenant_id: string | null;
  } = {
    id_cliente: clienteId,
    id_servico: servicoId || null,
    tipo: 'nota',
    categoria,
    titulo,
    descricao: descricao || null,
    manual: true,
    data_evento: dataEvento || null,
    tenant_id: tenantId,
  };

  const { data: evento, error } = await supabase
    .from('cliente_eventos')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;
  return evento as ClienteEvento;
}
