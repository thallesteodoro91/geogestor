
-- Fix: tenant_members INSERT policy is too permissive.
-- Currently allows any user to INSERT with just user_id = auth.uid(),
-- meaning they could add themselves to ANY tenant.
-- Since all legitimate inserts go through:
--   1. create_tenant_for_user() (SECURITY DEFINER, bypasses RLS)
--   2. accept-invite edge function (service role, bypasses RLS)
-- We can safely block all direct client-side inserts.

DROP POLICY IF EXISTS "tenant_members_insert_own" ON public.tenant_members;

CREATE POLICY "tenant_members_insert_blocked"
ON public.tenant_members
FOR INSERT
WITH CHECK (false);
