-- Remover política RESTRICTIVE atual
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Criar nova política PERMISSIVE para INSERT
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);