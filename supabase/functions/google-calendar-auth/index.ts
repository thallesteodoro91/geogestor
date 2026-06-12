import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

// Allowed origins for OAuth return redirect (prevents open-redirect via state.origin)
const DEFAULT_ALLOWED_ORIGINS = [
  "https://geogestor.lovable.app",
  "https://id-preview--d3c585eb-555b-44ef-94d6-4847914df44b.lovable.app",
];
function getAllowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  const list = env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ALLOWED_ORIGINS;
  return list;
}
function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  const list = getAllowedOrigins();
  if (list.includes(origin)) return true;
  // Accept lovable.app/lovable.dev preview subdomains
  return /^https:\/\/[a-z0-9-]+\.lovable\.(app|dev)$/i.test(origin);
}

// HMAC-SHA256 sign/verify for OAuth state (anti-CSRF + integrity)
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function getStateKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("CRON_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret) throw new Error("No HMAC secret available for OAuth state");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
async function signState(payload: Record<string, unknown>): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const key = await getStateKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return `${b64url(data)}.${b64url(sig)}`;
}
async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const [payloadB64, sigB64] = state.split(".");
  if (!payloadB64 || !sigB64) return null;
  try {
    const key = await getStateKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigB64),
      b64urlDecode(payloadB64),
    );
    if (!ok) return null;
    const json = new TextDecoder().decode(b64urlDecode(payloadB64));
    const obj = JSON.parse(json) as Record<string, unknown>;
    // Reject expired states (>10 min)
    const iat = typeof obj.iat === "number" ? obj.iat : 0;
    if (Date.now() - iat > 10 * 60 * 1000) return null;
    return obj;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Google OAuth credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;

  try {
    // Handle OAuth callback from Google
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (code && state) {
      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      // Parse + verify HMAC-signed state
      const verified = await verifyState(state);
      if (!verified) {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: "/?google-calendar=error" },
        });
      }
      const stateData = {
        user_id: String(verified.user_id ?? ""),
        tenant_id: String(verified.tenant_id ?? ""),
        origin: String(verified.origin ?? ""),
      };
      if (!stateData.user_id || !stateData.tenant_id || !isOriginAllowed(stateData.origin)) {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: "/?google-calendar=error" },
        });
      }

      if (!tokenRes.ok) {
        console.error("Token exchange failed:", tokenData);
        const redirectUrl = `${stateData.origin}/configuracoes?google-calendar=error`;
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: redirectUrl },
        });
      }

      // Store tokens using service role (bypasses RLS for upsert)
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      const { error: upsertError } = await supabaseAdmin
        .from("google_calendar_tokens")
        .upsert(
          {
            user_id: stateData.user_id,
            tenant_id: stateData.tenant_id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || "",
            token_expires_at: expiresAt,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error("Failed to store tokens:", upsertError);
        const redirectUrl = `${stateData.origin}/configuracoes?google-calendar=error`;
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: redirectUrl },
        });
      }

      // Success - redirect back to app
      const redirectUrl = `${stateData.origin}/configuracoes?google-calendar=success`;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl },
      });
    }

    // Generate auth URL (called from frontend)
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.claims.sub;
      const body = await req.json();
      const { action, tenant_id } = body;

      if (action === "get-auth-url") {
        const originParam = String(body.origin || "");
        if (!isOriginAllowed(originParam)) {
          return new Response(JSON.stringify({ error: "Origin not allowed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const state = await signState({
          user_id: userId,
          tenant_id,
          origin: originParam,
          iat: Date.now(),
          nonce: crypto.randomUUID(),
        });

        const authUrl = `${GOOGLE_AUTH_URL}?${new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: "code",
          scope: SCOPES,
          access_type: "offline",
          prompt: "consent",
          state,
        })}`;

        return new Response(JSON.stringify({ url: authUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "disconnect") {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Revoke Google token
        const { data: tokenData } = await supabaseAdmin
          .from("google_calendar_tokens")
          .select("access_token")
          .eq("user_id", userId)
          .single();

        if (tokenData?.access_token) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenData.access_token}`, {
            method: "POST",
          });
        }

        // Delete tokens and sync mappings
        await supabaseAdmin.from("google_calendar_sync").delete().eq("user_id", userId);
        await supabaseAdmin.from("google_calendar_tokens").delete().eq("user_id", userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "status") {
        const { data } = await supabase
          .from("google_calendar_tokens")
          .select(
            "created_at, last_synced_at, selected_calendar_id, calendar_label, auto_sync_enabled, sync_types, connection_status, watch_channel_id, watch_expires_at",
          )
          .eq("user_id", userId)
          .maybeSingle();

        const realtimeActive =
          !!data?.watch_channel_id &&
          !!data?.watch_expires_at &&
          new Date(data.watch_expires_at).getTime() > Date.now();

        return new Response(
          JSON.stringify({
            connected: !!data,
            last_synced_at: data?.last_synced_at,
            connected_at: data?.created_at,
            selected_calendar_id: data?.selected_calendar_id ?? "primary",
            calendar_label: data?.calendar_label ?? null,
            auto_sync_enabled: data?.auto_sync_enabled ?? true,
            sync_types: data?.sync_types ?? {},
            connection_status: data?.connection_status ?? "active",
            realtime_active: realtimeActive,
            watch_expires_at: data?.watch_expires_at ?? null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "list-calendars") {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: tokenRow } = await supabaseAdmin
          .from("google_calendar_tokens")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (!tokenRow) {
          return new Response(JSON.stringify({ error: "Not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Refresh token if needed
        let accessToken = tokenRow.access_token;
        if (new Date(tokenRow.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
          const r = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: tokenRow.refresh_token,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              grant_type: "refresh_token",
            }),
          });
          if (r.ok) {
            const j = await r.json();
            accessToken = j.access_token;
            await supabaseAdmin
              .from("google_calendar_tokens")
              .update({
                access_token: j.access_token,
                token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
              })
              .eq("id", tokenRow.id);
          }
        }
        const listRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const list = await listRes.json();
        if (!listRes.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to list calendars", details: list }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const calendars = (list.items || []).map((c: any) => ({
          id: c.id,
          summary: c.summary,
          primary: !!c.primary,
          backgroundColor: c.backgroundColor,
        }));
        return new Response(JSON.stringify({ calendars }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "update-preferences") {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const patch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (typeof body.selected_calendar_id === "string") {
          patch.selected_calendar_id = body.selected_calendar_id;
        }
        if (typeof body.calendar_label === "string") {
          patch.calendar_label = body.calendar_label;
        }
        if (typeof body.auto_sync_enabled === "boolean") {
          patch.auto_sync_enabled = body.auto_sync_enabled;
        }
        if (body.sync_types && typeof body.sync_types === "object") {
          patch.sync_types = body.sync_types;
        }
        const { error } = await supabaseAdmin
          .from("google_calendar_tokens")
          .update(patch)
          .eq("user_id", userId);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google Calendar Auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
