CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  event_name text NOT NULL,
  source text,
  competencia text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_tenant_event ON public.analytics_events (tenant_id, event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user ON public.analytics_events (user_id, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant analytics"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Authenticated users can insert own events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id(auth.uid()))
);