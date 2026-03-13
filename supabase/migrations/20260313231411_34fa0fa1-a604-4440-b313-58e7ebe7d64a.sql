
-- Fortalecer has_role para validar apenas no tenant do próprio usuário (defesa em profundidade)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = _user_id
      AND role = _role
      AND tenant_id = get_user_tenant_id(_user_id)
  )
$$;
