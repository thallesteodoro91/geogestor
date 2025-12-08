-- Dropar política de INSERT existente
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Criar política de INSERT mais simples - apenas verifica se está autenticado
CREATE POLICY "Allow authenticated insert"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Forçar reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';