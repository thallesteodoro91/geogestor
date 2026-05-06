-- Helper to upsert the CRON_SECRET into Vault (callable only by service_role)
CREATE OR REPLACE FUNCTION public.upsert_cron_secret(p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Restrict to service_role
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'CRON_SECRET';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_value, 'CRON_SECRET', 'Shared secret for pg_cron -> edge functions');
  ELSE
    PERFORM vault.update_secret(v_id, p_value, 'CRON_SECRET', 'Shared secret for pg_cron -> edge functions');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_cron_secret(text) TO service_role;

-- Reschedule cron to read from vault
SELECT cron.unschedule('generate-ai-suggestions-weekly');

SELECT cron.schedule(
  'generate-ai-suggestions-weekly',
  '0 9 * * 1',
  $job$
  SELECT net.http_post(
    url := 'https://itbgesjofnprqcsrukos.supabase.co/functions/v1/generate-ai-suggestions-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $job$
);