-- =============================================
-- FASE 5: Sistema de Convites e Nova Estrutura de Planos
-- =============================================

-- 1. Desativar planos antigos
UPDATE public.subscription_plans 
SET is_active = false 
WHERE slug IN ('starter', 'professional', 'enterprise', 'free');

-- 2. Atualizar plano Trial para 7 dias com todas funcionalidades
UPDATE public.subscription_plans 
SET 
  name = 'Trial',
  max_users = 5,
  max_clients = 50,
  max_properties = 25,
  price_cents = 0,
  interval = 'week',
  features = '{
    "dashboard_financeiro": true,
    "dashboard_operacional": true,
    "geobot_ai": true,
    "calendario": true,
    "notificacoes": true,
    "relatorios": true,
    "exportacao_pdf": true,
    "gestao_equipe": true,
    "suporte_prioritario": false
  }'::jsonb
WHERE slug = 'trial';

-- 3. Criar plano Completo Mensal
INSERT INTO public.subscription_plans (name, slug, price_cents, interval, max_users, max_clients, max_properties, features, is_active)
VALUES (
  'Completo',
  'completo-mensal',
  19700,
  'month',
  10,
  9999,
  9999,
  '{
    "dashboard_financeiro": true,
    "dashboard_operacional": true,
    "geobot_ai": true,
    "calendario": true,
    "notificacoes": true,
    "relatorios": true,
    "exportacao_pdf": true,
    "gestao_equipe": true,
    "suporte_prioritario": true
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  interval = EXCLUDED.interval,
  max_users = EXCLUDED.max_users,
  max_clients = EXCLUDED.max_clients,
  max_properties = EXCLUDED.max_properties,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- 4. Criar plano Completo Semestral (15% desconto)
INSERT INTO public.subscription_plans (name, slug, price_cents, interval, max_users, max_clients, max_properties, features, is_active)
VALUES (
  'Completo Semestral',
  'completo-semestral',
  100500,
  'semester',
  10,
  9999,
  9999,
  '{
    "dashboard_financeiro": true,
    "dashboard_operacional": true,
    "geobot_ai": true,
    "calendario": true,
    "notificacoes": true,
    "relatorios": true,
    "exportacao_pdf": true,
    "gestao_equipe": true,
    "suporte_prioritario": true
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  interval = EXCLUDED.interval,
  max_users = EXCLUDED.max_users,
  max_clients = EXCLUDED.max_clients,
  max_properties = EXCLUDED.max_properties,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- 5. Criar plano Completo Anual (25% desconto)
INSERT INTO public.subscription_plans (name, slug, price_cents, interval, max_users, max_clients, max_properties, features, is_active)
VALUES (
  'Completo Anual',
  'completo-anual',
  177300,
  'year',
  10,
  9999,
  9999,
  '{
    "dashboard_financeiro": true,
    "dashboard_operacional": true,
    "geobot_ai": true,
    "calendario": true,
    "notificacoes": true,
    "relatorios": true,
    "exportacao_pdf": true,
    "gestao_equipe": true,
    "suporte_prioritario": true
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  interval = EXCLUDED.interval,
  max_users = EXCLUDED.max_users,
  max_clients = EXCLUDED.max_clients,
  max_properties = EXCLUDED.max_properties,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- 6. Criar tabela de convites
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Evitar convites duplicados para mesmo email no mesmo tenant
  UNIQUE(tenant_id, email)
);

-- 7. Habilitar RLS na tabela de convites
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para convites
-- Admins podem ver convites do seu tenant
CREATE POLICY "Admins can view tenant invites"
ON public.tenant_invites
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin')
);

-- Admins podem criar convites
CREATE POLICY "Admins can create invites"
ON public.tenant_invites
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin')
);

-- Admins podem deletar convites pendentes
CREATE POLICY "Admins can delete pending invites"
ON public.tenant_invites
FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin')
  AND accepted_at IS NULL
);

-- Qualquer um pode atualizar convite (para aceitar - validação feita na edge function)
CREATE POLICY "Anyone can update invite to accept"
ON public.tenant_invites
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant_id ON public.tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_token ON public.tenant_invites(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON public.tenant_invites(email);

-- 10. Função para verificar limite de usuários do plano
CREATE OR REPLACE FUNCTION public.check_user_limit(p_tenant_id UUID)
RETURNS TABLE(
  current_users INTEGER,
  max_users INTEGER,
  can_invite BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_users INTEGER;
  v_max_users INTEGER;
BEGIN
  -- Contar usuários atuais + convites pendentes
  SELECT COUNT(*)::INTEGER INTO v_current_users
  FROM (
    SELECT user_id FROM tenant_members WHERE tenant_id = p_tenant_id
    UNION
    SELECT NULL FROM tenant_invites WHERE tenant_id = p_tenant_id AND accepted_at IS NULL AND expires_at > now()
  ) combined;
  
  -- Buscar limite do plano
  SELECT sp.max_users INTO v_max_users
  FROM tenant_subscriptions ts
  JOIN subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = p_tenant_id
  AND ts.status IN ('active', 'trialing')
  LIMIT 1;
  
  IF v_max_users IS NULL THEN
    v_max_users := 1;
  END IF;
  
  RETURN QUERY SELECT 
    v_current_users,
    v_max_users,
    (v_current_users < v_max_users);
END;
$$;