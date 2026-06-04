
-- 1) Restringir SECURITY DEFINER internas
REVOKE EXECUTE ON FUNCTION public.handle_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_criar_servico_ao_converter_orcamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpar_notificacoes_antigas() FROM PUBLIC, anon, authenticated;

-- Garantir que service_role e postgres ainda têm acesso (triggers usam o owner)
GRANT EXECUTE ON FUNCTION public.handle_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_criar_servico_ao_converter_orcamento() TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_notificacoes_antigas() TO service_role;

-- 2) Tabela de idempotência para webhooks Stripe
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON public.stripe_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_created ON public.stripe_webhook_events(event_type, created_at DESC);

GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para anon/authenticated: só service_role acessa (via GRANT acima)
CREATE POLICY "service_role manages webhook events"
  ON public.stripe_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
