
-- 1. Criar plano Owner
INSERT INTO public.subscription_plans (name, slug, price_cents, "interval", max_users, max_properties, max_clients, features, is_active)
VALUES (
  'Owner',
  'owner',
  0,
  'year',
  9999,
  99999,
  99999,
  '{"dashboard_financeiro": true, "gestao_equipe": true, "suporte_prioritario": true, "relatorios_avancados": true, "integracao_api": true, "geo_bot": true}'::jsonb,
  true
);

-- 2. Atualizar assinatura do tenant do admin
UPDATE public.tenant_subscriptions
SET 
  plan_id = (SELECT id FROM public.subscription_plans WHERE slug = 'owner' LIMIT 1),
  status = 'active',
  current_period_end = '2099-12-31T23:59:59Z'
WHERE tenant_id = '3a7ebb04-00d0-4bc3-9e16-d212ec1b65cc';
