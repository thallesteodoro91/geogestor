-- 1. Adicionar coluna tenant_id à tabela fato_orcamento_itens
ALTER TABLE public.fato_orcamento_itens 
ADD COLUMN tenant_id uuid;

-- 2. Atualizar registros existentes com tenant_id baseado na relação com fato_orcamento
UPDATE public.fato_orcamento_itens foi
SET tenant_id = fo.tenant_id
FROM public.fato_orcamento fo
WHERE foi.id_orcamento = fo.id_orcamento;

-- 3. Dropar políticas RLS antigas que não verificam tenant
DROP POLICY IF EXISTS "Admins can delete fato_orcamento_itens" ON public.fato_orcamento_itens;
DROP POLICY IF EXISTS "Authenticated users can insert fato_orcamento_itens" ON public.fato_orcamento_itens;
DROP POLICY IF EXISTS "Authenticated users can read fato_orcamento_itens" ON public.fato_orcamento_itens;
DROP POLICY IF EXISTS "Authenticated users can update fato_orcamento_itens" ON public.fato_orcamento_itens;

-- 4. Criar novas políticas RLS com isolamento de tenant
CREATE POLICY "Users can read own tenant budget items"
ON public.fato_orcamento_itens
FOR SELECT
USING (
  (tenant_id IS NOT NULL) 
  AND (get_user_tenant_id(auth.uid()) IS NOT NULL) 
  AND (tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE POLICY "Users can insert own tenant budget items"
ON public.fato_orcamento_itens
FOR INSERT
WITH CHECK (
  (tenant_id IS NOT NULL) 
  AND (get_user_tenant_id(auth.uid()) IS NOT NULL) 
  AND (tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE POLICY "Users can update own tenant budget items"
ON public.fato_orcamento_itens
FOR UPDATE
USING (
  (tenant_id IS NOT NULL) 
  AND (get_user_tenant_id(auth.uid()) IS NOT NULL) 
  AND (tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE POLICY "Admins can delete own tenant budget items"
ON public.fato_orcamento_itens
FOR DELETE
USING (
  (tenant_id IS NOT NULL) 
  AND (get_user_tenant_id(auth.uid()) IS NOT NULL) 
  AND (tenant_id = get_user_tenant_id(auth.uid()))
  AND has_role(auth.uid(), 'admin'::app_role)
);