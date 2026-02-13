
-- 1. Renomear completo-mensal para completo
UPDATE subscription_plans 
SET slug = 'completo', name = 'Completo'
WHERE slug = 'completo-mensal';

-- 2. Migrar SkyGeo do Trial para o Completo com 7 dias de trial
UPDATE tenant_subscriptions 
SET plan_id = (SELECT id FROM subscription_plans WHERE slug = 'completo'),
    status = 'trialing',
    current_period_end = NOW() + INTERVAL '7 days'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- 3. Remover planos que não serão mais usados
DELETE FROM subscription_plans WHERE slug IN ('trial', 'completo-semestral', 'completo-anual');

-- 4. Recriar create_tenant_for_user para usar plano Completo
DROP FUNCTION IF EXISTS public.create_tenant_for_user(uuid, text);

CREATE FUNCTION public.create_tenant_for_user(
  p_user_id uuid,
  p_company_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id FROM subscription_plans WHERE slug = 'completo' LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano Completo não encontrado';
  END IF;

  INSERT INTO tenants (name)
  VALUES (p_company_name)
  RETURNING id INTO v_tenant_id;

  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'admin');

  INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
  VALUES (v_tenant_id, v_plan_id, 'trialing', NOW(), NOW() + INTERVAL '7 days');

  INSERT INTO dim_empresa (nome, tenant_id)
  VALUES (p_company_name, v_tenant_id);

  RETURN v_tenant_id;
END;
$$;
