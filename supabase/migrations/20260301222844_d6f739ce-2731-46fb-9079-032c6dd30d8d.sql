
-- Add default value for slug column as safety net
ALTER TABLE public.tenants ALTER COLUMN slug SET DEFAULT '';

-- Recreate function with slug generation
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(p_user_id uuid, p_company_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_plan_id uuid;
  v_slug text;
BEGIN
  SELECT id INTO v_plan_id FROM subscription_plans WHERE slug = 'completo' LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano Completo não encontrado';
  END IF;

  -- Gerar slug a partir do nome da empresa
  v_slug := lower(regexp_replace(
    translate(trim(p_company_name),
      'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ',
      'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'),
    '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  -- Garantir unicidade com sufixo aleatório
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO tenants (name, slug)
  VALUES (p_company_name, v_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'admin');

  INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
  VALUES (v_tenant_id, v_plan_id, 'trialing', NOW(), NOW() + INTERVAL '7 days');

  INSERT INTO dim_empresa (nome, tenant_id)
  VALUES (p_company_name, v_tenant_id);

  RETURN v_tenant_id;
END;
$function$;
