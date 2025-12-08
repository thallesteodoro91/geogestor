-- Corrigir política RLS de tenant_members para quebrar dependência circular

-- Dropar política SELECT atual
DROP POLICY IF EXISTS "Users can view members of their tenant" ON public.tenant_members;

-- Criar nova política que permite:
-- 1. Usuário ver seu próprio registro (para descobrir seu tenant_id)
-- 2. Usuário ver membros do seu tenant (para gestão de equipe)
CREATE POLICY "Users can view own membership and tenant members"
ON public.tenant_members
FOR SELECT
USING (
  user_id = auth.uid()  -- Pode ver seu próprio registro diretamente
  OR 
  tenant_id = get_user_tenant_id(auth.uid())  -- Pode ver colegas do tenant
);

-- Forçar reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';