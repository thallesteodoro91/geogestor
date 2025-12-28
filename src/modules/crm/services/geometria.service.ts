/**
 * @fileoverview Serviço de geometrias de propriedades tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import { Json } from '@/integrations/supabase/types';

export interface PropriedadeGeometria {
  id_geometria: string;
  id_propriedade: string;
  geojson: Json;
  area_calculada_ha: number | null;
  perimetro_m: number | null;
  centroide_lat: number | null;
  centroide_lng: number | null;
  glebas: Json;
  arquivo_original_nome: string | null;
  arquivo_original_path: string | null;
  tenant_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function fetchGeometriaByPropriedade(propriedadeId: string) {
  const tenantId = await getCurrentTenantId();
  
  const { data, error } = await supabase
    .from('propriedade_geometria')
    .select('*')
    .eq('id_propriedade', propriedadeId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  
  if (error) throw error;
  return data as PropriedadeGeometria | null;
}

export async function createGeometria(data: {
  id_propriedade: string;
  geojson: Json;
  area_calculada_ha: number;
  perimetro_m: number;
  centroide_lat: number;
  centroide_lng: number;
  glebas: Json;
  arquivo_original_nome?: string;
}) {
  const tenantId = await getCurrentTenantId();
  
  // Deletar geometria existente se houver
  await supabase
    .from('propriedade_geometria')
    .delete()
    .eq('id_propriedade', data.id_propriedade)
    .eq('tenant_id', tenantId);
  
  const { data: result, error } = await supabase
    .from('propriedade_geometria')
    .insert({
      ...data,
      tenant_id: tenantId
    })
    .select()
    .single();
  
  if (error) throw error;
  return result as PropriedadeGeometria;
}

export async function deleteGeometria(propriedadeId: string) {
  const tenantId = await getCurrentTenantId();
  
  const { error } = await supabase
    .from('propriedade_geometria')
    .delete()
    .eq('id_propriedade', propriedadeId)
    .eq('tenant_id', tenantId);
  
  if (error) throw error;
}
