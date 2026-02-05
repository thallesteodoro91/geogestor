-- Função SECURITY DEFINER para criar tenant de forma atômica
-- Contorna limitações de RLS durante o onboarding

CREATE OR REPLACE FUNCTION public.create_tenant_for_user(
  p_user_id UUID,
  p_company_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
  v_trial_plan_id UUID;
  v_trial_end TIMESTAMPTZ;
BEGIN
  -- Verificar se usuário já tem tenant
  IF EXISTS (SELECT 1 FROM tenant_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  -- Gerar slug único
  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 8);

  -- Criar tenant
  INSERT INTO tenants (name, slug)
  VALUES (p_company_name, v_slug)
  RETURNING id INTO v_tenant_id;

  -- Adicionar usuário como admin
  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'admin');

  -- Buscar plano trial
  SELECT id INTO v_trial_plan_id
  FROM subscription_plans
  WHERE slug = 'trial'
  LIMIT 1;

  IF v_trial_plan_id IS NOT NULL THEN
    v_trial_end := NOW() + INTERVAL '7 days';
    
    INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
    VALUES (v_tenant_id, v_trial_plan_id, 'trialing', NOW(), v_trial_end);
  END IF;

  -- Criar empresa
  INSERT INTO dim_empresa (nome, tenant_id)
  VALUES (p_company_name, v_tenant_id);

  RETURN jsonb_build_object(
    'id', v_tenant_id,
    'name', p_company_name,
    'slug', v_slug
  );
END;
$$;