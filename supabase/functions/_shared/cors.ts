/**
 * Shared CORS helper for all Edge Functions.
 *
 * Use `corsFor(req)` to build per-request CORS headers with an origin
 * allowlist (production domain + any *.lovable.app/*.lovable.dev preview).
 * For browser-callable functions, prefer this over wildcard `*`.
 *
 * For functions called only by external services (Stripe webhooks, Google
 * push notifications, cron schedulers), CORS is irrelevant — those handlers
 * may keep returning plain responses without using this helper.
 *
 * ALLOWED_ORIGINS env var (comma-separated) extends the allowlist; defaults
 * to the production domain.
 */

export const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-cron-secret";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://geogestor.lovable.app")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.lovable\.(app|dev)$/i;

export function corsFor(req: Request, allowHeaders: string = DEFAULT_ALLOW_HEADERS): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow =
    ALLOWED_ORIGINS.includes(origin) || LOVABLE_PREVIEW_RE.test(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  };
}

/** Convenience: returns a 204 response for OPTIONS preflight. */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsFor(req) });
}
