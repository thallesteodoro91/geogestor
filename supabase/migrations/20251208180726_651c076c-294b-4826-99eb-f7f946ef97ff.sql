-- Dropar a política atual que causa dependência circular
DROP POLICY IF EXISTS "Users can view own membership and tenant members" ON public.tenant_members;

-- Criar política simples: usuário pode ver seu próprio registro OU membros do mesmo tenant
CREATE POLICY "Users can view own membership and tenant members"
ON public.tenant_members
FOR SELECT
USING (
  (user_id = auth.uid())  -- Sempre pode ver seu próprio registro (sem dependência)
  OR 
  (tenant_id = get_user_tenant_id(auth.uid()))  -- Pode ver colegas do tenant
);

-- Forçar reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';