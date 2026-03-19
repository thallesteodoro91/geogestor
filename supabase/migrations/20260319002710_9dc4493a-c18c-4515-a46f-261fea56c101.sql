
-- Table to store Google OAuth tokens per user
CREATE TABLE public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  calendar_id text DEFAULT 'primary',
  sync_token text,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
  ON public.google_calendar_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tokens"
  ON public.google_calendar_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tokens"
  ON public.google_calendar_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tokens"
  ON public.google_calendar_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Table to map local events to Google Calendar events
CREATE TABLE public.google_calendar_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  local_event_id uuid NOT NULL,
  local_event_type text NOT NULL CHECK (local_event_type IN ('orcamento', 'servico')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, local_event_id, local_event_type)
);

ALTER TABLE public.google_calendar_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync mappings"
  ON public.google_calendar_sync FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sync mappings"
  ON public.google_calendar_sync FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sync mappings"
  ON public.google_calendar_sync FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sync mappings"
  ON public.google_calendar_sync FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
