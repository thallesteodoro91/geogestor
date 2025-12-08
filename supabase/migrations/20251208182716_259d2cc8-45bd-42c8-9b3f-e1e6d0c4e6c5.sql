-- ================================================
-- CORREÇÃO RLS MULTI-TENANT - SKYGEO 360
-- Resolve dependência circular em tenant_members
-- ================================================

-- ============ FASE 1: tenant_members ================

-- Dropar política problemática que usa get_user_tenant_id causando loop
DROP POLICY IF EXISTS "Users can view own membership and tenant members" ON public.tenant_members;

-- Política 1: Usuário pode SEMPRE ver seu próprio registro (auto-contido)
CREATE POLICY "Users can view own membership"
ON public.tenant_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Política 2: Membros podem ver colegas do mesmo tenant (subquery auto-contido)
CREATE POLICY "Members can view same tenant"
ON public.tenant_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = tenant_members.tenant_id
  )
);

-- ============ FASE 2: tenants ================

-- Dropar política que usa get_user_tenant_id
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;

-- Criar política usando subquery direto em tenant_members
CREATE POLICY "Users can view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = tenants.id
  )
);

-- ============ FASE 3: profiles ================

-- Dropar política problemática
DROP POLICY IF EXISTS "Users can read profiles of same tenant" ON public.profiles;

-- Política 1: Pode ler próprio perfil sempre
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: Pode ler perfis do mesmo tenant
CREATE POLICY "Users can read tenant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members my_tm
    INNER JOIN tenant_members their_tm ON my_tm.tenant_id = their_tm.tenant_id
    WHERE my_tm.user_id = auth.uid()
    AND their_tm.user_id = profiles.id
  )
);

-- ============ FASE 4: RELOAD SCHEMA ================
NOTIFY pgrst, 'reload schema';