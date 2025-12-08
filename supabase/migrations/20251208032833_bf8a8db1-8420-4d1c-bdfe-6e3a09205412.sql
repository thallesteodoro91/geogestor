-- Dropar política existente
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Recriar com verificação explícita de autenticação
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Forçar reload do PostgREST
NOTIFY pgrst, 'reload schema';