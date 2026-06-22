-- 1) Convert all public-schema policies from role "public" to "authenticated"
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- 2) Explicit deny for non-service roles on stripe_webhook_events
DROP POLICY IF EXISTS "Deny non-service access to stripe_webhook_events" ON public.stripe_webhook_events;
CREATE POLICY "Deny non-service access to stripe_webhook_events"
ON public.stripe_webhook_events
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 3) Realtime Authorization — require authenticated users to subscribe to any channel
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated can read realtime messages"
             ON realtime.messages FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can broadcast realtime messages" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated can broadcast realtime messages"
             ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END$$;