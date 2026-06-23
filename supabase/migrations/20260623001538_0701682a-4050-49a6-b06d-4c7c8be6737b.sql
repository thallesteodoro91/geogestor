ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plans_stripe_price
  ON public.subscription_plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_sub
  ON public.tenant_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_cus
  ON public.tenant_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;