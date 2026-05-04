-- Enums
CREATE TYPE public.ai_suggestion_status AS ENUM ('pending','applied','skipped','failed','rolled_back');
CREATE TYPE public.ai_suggestion_category AS ENUM ('erro','teste','fallback','ux','financeiro','operacional');
CREATE TYPE public.ai_suggestion_source AS ENUM ('dashboard_insights','geobot_chat','manual');
CREATE TYPE public.ai_suggestion_action_type AS ENUM (
  'create_task','update_status','create_event','send_notification','update_setting','noop_informational'
);

-- Table
CREATE TABLE public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  source public.ai_suggestion_source NOT NULL DEFAULT 'dashboard_insights',
  category public.ai_suggestion_category NOT NULL DEFAULT 'operacional',
  priority integer NOT NULL DEFAULT 100,
  title text NOT NULL,
  description text NOT NULL,
  rationale text,
  action_type public.ai_suggestion_action_type NOT NULL DEFAULT 'noop_informational',
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  depends_on uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status public.ai_suggestion_status NOT NULL DEFAULT 'pending',
  applied_at timestamptz,
  error_message text,
  rollback_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_suggestions_tenant_status ON public.ai_suggestions(tenant_id, status);
CREATE INDEX idx_ai_suggestions_tenant_category ON public.ai_suggestions(tenant_id, category);
CREATE INDEX idx_ai_suggestions_created_at ON public.ai_suggestions(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_ai_suggestions_updated_at
  BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant suggestions"
  ON public.ai_suggestions FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Members can insert tenant suggestions"
  ON public.ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update own suggestions"
  ON public.ai_suggestions FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can delete tenant suggestions"
  ON public.ai_suggestions FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );