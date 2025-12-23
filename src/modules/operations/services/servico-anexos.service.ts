/**
 * @fileoverview Serviço de anexos de serviços tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

export interface ServicoAnexo {
  id_anexo: string;
  id_servico: string;
  nome_arquivo: string;
  tipo_arquivo: string | null;
  storage_path: string;
  tamanho_bytes: number | null;
  created_at?: string;
  tenant_id?: string;
}

export async function fetchAnexosByServico(servicoId: string) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from('servico_anexos')
    .select('*')
    .eq('id_servico', servicoId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query.order('created_at', { ascending: false });
}

export async function uploadAnexo(
  servicoId: string,
  file: File
): Promise<{ data: ServicoAnexo | null; error: Error | null }> {
  const tenantId = await getCurrentTenantId();
  
  // Gerar path único
  const fileExt = file.name.split('.').pop();
  const fileName = `${servicoId}/${Date.now()}_${file.name}`;
  
  // Upload para o storage
  const { error: uploadError } = await supabase.storage
    .from('servico-anexos')
    .upload(fileName, file);
  
  if (uploadError) {
    return { data: null, error: uploadError };
  }
  
  // Criar registro na tabela
  const { data, error } = await supabase
    .from('servico_anexos')
    .insert({
      id_servico: servicoId,
      nome_arquivo: file.name,
      tipo_arquivo: file.type,
      storage_path: fileName,
      tamanho_bytes: file.size,
      tenant_id: tenantId
    })
    .select()
    .single();
  
  return { data, error };
}

export async function deleteAnexo(anexo: ServicoAnexo) {
  const tenantId = await getCurrentTenantId();
  
  // Remover do storage
  await supabase.storage
    .from('servico-anexos')
    .remove([anexo.storage_path]);
  
  // Remover registro da tabela
  let query = supabase
    .from('servico_anexos')
    .delete()
    .eq('id_anexo', anexo.id_anexo);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

export function getAnexoUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('servico-anexos')
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

export function getAnexoSignedUrl(storagePath: string): Promise<string | null> {
  return supabase.storage
    .from('servico-anexos')
    .createSignedUrl(storagePath, 3600) // 1 hora
    .then(({ data }) => data?.signedUrl || null);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
