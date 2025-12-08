-- Notificar o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';

-- Garantir que a política de INSERT está correta (idempotente)
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Garantir que o trigger handle_new_user existe para criar roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();