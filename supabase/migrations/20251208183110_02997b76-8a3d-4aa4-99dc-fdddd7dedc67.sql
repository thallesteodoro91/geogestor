-- ================================================
-- CORREÇÃO DEFINITIVA RLS - SKYGEO 360
-- Remove todas as políticas com recursão
-- ================================================

-- ============ FASE 1: LIMPAR tenant_members ================

-- Dropar TODAS as políticas existentes
DROP POLICY IF EXISTS "Admins can manage tenant members" ON public.tenant_members;
DROP POLICY IF EXISTS "Members can view same tenant" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view own membership" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can add themselves to new tenant" ON public.tenant_members;

-- Criar política SIMPLES sem recursão: usuário vê apenas SEU registro
CREATE POLICY "tenant_members_select_own"
ON public.tenant_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: usuário pode inserir apenas seu próprio registro
CREATE POLICY "tenant_members_insert_own"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============ FASE 2: CORRIGIR tenants ================

DROP POLICY IF EXISTS "Admins can update their tenant" ON public.tenants;

-- UPDATE usando has_role (SECURITY DEFINER) + subquery simples
CREATE POLICY "tenant_update_admin"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = tenants.id
  )
);

-- ============ FASE 3: SIMPLIFICAR profiles ================

DROP POLICY IF EXISTS "Users can read tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- Apenas perfil próprio via RLS
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- ============ FASE 4: FUNÇÃO SECURITY DEFINER ================

-- Função para listar membros do tenant (bypassa RLS com segurança)
CREATE OR REPLACE FUNCTION public.get_tenant_members()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tenant_id uuid,
  role app_role,
  joined_at timestamptz,
  full_name text,
  email text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tm.id,
    tm.user_id,
    tm.tenant_id,
    tm.role,
    tm.joined_at,
    p.full_name,
    p.email,
    p.avatar_url
  FROM tenant_members tm
  LEFT JOIN profiles p ON p.id = tm.user_id
  WHERE tm.tenant_id = get_user_tenant_id(auth.uid())
$$;

-- Função para obter perfis do mesmo tenant
CREATE OR REPLACE FUNCTION public.get_tenant_profiles()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.email,
    p.avatar_url
  FROM profiles p
  INNER JOIN tenant_members tm ON tm.user_id = p.id
  WHERE tm.tenant_id = get_user_tenant_id(auth.uid())
$$;

-- ============ FASE 5: RELOAD SCHEMA ================
NOTIFY pgrst, 'reload schema';