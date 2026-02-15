-- Reescrever has_role para consultar tenant_members em vez de user_roles
-- Isso mantém todas as RLS policies funcionando sem alteração
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Remover trigger que insere na user_roles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover função handle_new_user que alimentava user_roles
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Dropar tabela user_roles (agora seguro pois has_role aponta para tenant_members)
DROP TABLE IF EXISTS public.user_roles;
