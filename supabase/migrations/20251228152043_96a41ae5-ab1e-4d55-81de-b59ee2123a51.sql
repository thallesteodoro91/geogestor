-- Tabela para armazenar geometrias das propriedades (polígonos KML/KMZ)
CREATE TABLE public.propriedade_geometria (
  id_geometria uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_propriedade uuid NOT NULL REFERENCES public.dim_propriedade(id_propriedade) ON DELETE CASCADE,
  geojson jsonb NOT NULL,
  area_calculada_ha numeric,
  perimetro_m numeric,
  centroide_lat numeric,
  centroide_lng numeric,
  glebas jsonb DEFAULT '[]'::jsonb,
  arquivo_original_nome text,
  arquivo_original_path text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índice para busca por propriedade
CREATE INDEX idx_propriedade_geometria_propriedade ON public.propriedade_geometria(id_propriedade);
CREATE INDEX idx_propriedade_geometria_tenant ON public.propriedade_geometria(tenant_id);

-- Enable RLS
ALTER TABLE public.propriedade_geometria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (tenant-aware)
CREATE POLICY "Users can read own tenant geometries"
ON public.propriedade_geometria FOR SELECT
USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can insert own tenant geometries"
ON public.propriedade_geometria FOR INSERT
WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can update own tenant geometries"
ON public.propriedade_geometria FOR UPDATE
USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can delete own tenant geometries"
ON public.propriedade_geometria FOR DELETE
USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_propriedade_geometria_updated_at
BEFORE UPDATE ON public.propriedade_geometria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();