-- Google Calendar v2: preferências, fila de sync, eventos externos

-- 1) Estender google_calendar_tokens com preferências e watch channels
ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS selected_calendar_id text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS calendar_label text,
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_types jsonb NOT NULL DEFAULT
    '{"servico":true,"orcamento":true,"visita":true,"vencimento":true,"reuniao":true,"tarefa":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS watch_channel_id text,
  ADD COLUMN IF NOT EXISTS watch_channel_token text,
  ADD COLUMN IF NOT EXISTS watch_resource_id text,
  ADD COLUMN IF NOT EXISTS watch_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'active';

-- 2) Estender google_calendar_sync com categoria, cor, origem e retry
ALTER TABLE public.google_calendar_sync
  ADD COLUMN IF NOT EXISTS event_category text,
  ADD COLUMN IF NOT EXISTS color_id text,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- 3) Eventos externos do Google (não vinculados a entidades do GeoGestor)
CREATE TABLE IF NOT EXISTS public.calendar_eventos_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  summary text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  attendees jsonb,
  html_link text,
  google_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_calendar_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_eventos_externos_tenant_start
  ON public.calendar_eventos_externos (tenant_id, start_at);

ALTER TABLE public.calendar_eventos_externos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view external events"
  ON public.calendar_eventos_externos FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can manage own external events"
  ON public.calendar_eventos_externos FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER trg_calendar_eventos_externos_updated_at
  BEFORE UPDATE ON public.calendar_eventos_externos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Fila de sincronização
CREATE TABLE IF NOT EXISTS public.calendar_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('create','update','delete','pull')),
  entity_type text,
  entity_id uuid,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_queue_status_sched
  ON public.calendar_sync_queue (status, scheduled_at);

ALTER TABLE public.calendar_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view queue"
  ON public.calendar_sync_queue FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can enqueue own jobs"
  ON public.calendar_sync_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER trg_calendar_sync_queue_updated_at
  BEFORE UPDATE ON public.calendar_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();