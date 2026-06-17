
-- 1. Fix audit_logs INSERT policy: restrict to authenticated + own user_id
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND user_id = auth.uid()
  );

-- 2. Prevent role escalation on tenant_invites acceptance via trigger
CREATE OR REPLACE FUNCTION public.prevent_invite_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Admins (creators) may modify invites freely
  IF public.has_role(auth.uid(), 'admin'::app_role)
     AND OLD.tenant_id = public.get_user_tenant_id(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- For invitees accepting: lock all sensitive columns; only accepted_at may change
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email)
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.token IS DISTINCT FROM OLD.token
     OR NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
    RAISE EXCEPTION 'Only accepted_at may be modified when accepting an invite';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invite_role_change ON public.tenant_invites;
CREATE TRIGGER trg_prevent_invite_role_change
  BEFORE UPDATE ON public.tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invite_role_change();

-- Also tighten WITH CHECK on the accept policy (defense in depth)
DROP POLICY IF EXISTS "Users can accept own invites" ON public.tenant_invites;
CREATE POLICY "Users can accept own invites"
  ON public.tenant_invites
  FOR UPDATE
  TO authenticated
  USING (
    lower(email) = lower(auth.email())
    AND accepted_at IS NULL
    AND expires_at > now()
  )
  WITH CHECK (
    lower(email) = lower(auth.email())
  );

-- 3. Add UPDATE policy on servico_eventos
CREATE POLICY "Users can update own tenant events"
  ON public.servico_eventos
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND public.get_user_tenant_id(auth.uid()) IS NOT NULL
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND public.get_user_tenant_id(auth.uid()) IS NOT NULL
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- 4. Restrict SECURITY DEFINER RPC to authenticated only
REVOKE EXECUTE ON FUNCTION public.get_orcamentos_kpis(text, text, text, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_orcamentos_kpis(text, text, text, text, date, date) TO authenticated;
