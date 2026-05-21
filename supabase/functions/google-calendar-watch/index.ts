import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function getValidAccessToken(
  supabaseAdmin: any,
  tokenRow: any,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const expiresAt = new Date(tokenRow.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: tokenRow.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (txt.includes("invalid_grant")) {
        await supabaseAdmin
          .from("google_calendar_tokens")
          .update({ connection_status: "needs_reconnect" })
          .eq("id", tokenRow.id);
      }
      return null;
    }
    const j = await res.json();
    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({
        access_token: j.access_token,
        token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
        connection_status: "active",
      })
      .eq("id", tokenRow.id);
    return j.access_token;
  }
  return tokenRow.access_token;
}

async function stopChannel(accessToken: string, channelId: string, resourceId: string) {
  try {
    await fetch(`${GOOGLE_CALENDAR_API}/channels/stop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: channelId, resourceId }),
    });
  } catch (e) {
    console.error("stopChannel error:", e);
  }
}

async function startChannelForToken(
  supabaseAdmin: any,
  supabaseUrl: string,
  tokenRow: any,
  clientId: string,
  clientSecret: string,
): Promise<{ ok: boolean; reason?: string }> {
  const accessToken = await getValidAccessToken(supabaseAdmin, tokenRow, clientId, clientSecret);
  if (!accessToken) return { ok: false, reason: "no_token" };

  const calendarId = tokenRow.selected_calendar_id || "primary";

  // Stop existing channel first (best-effort)
  if (tokenRow.watch_channel_id && tokenRow.watch_resource_id) {
    await stopChannel(accessToken, tokenRow.watch_channel_id, tokenRow.watch_resource_id);
  }

  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomUUID();
  const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`;
  // Google requires TTL <= 30 days for events watch; we ask for 7 days
  const ttlSeconds = 7 * 24 * 60 * 60;

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token: channelToken,
        params: { ttl: String(ttlSeconds) },
      }),
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    console.error("watch failed:", res.status, txt);
    return { ok: false, reason: `google_${res.status}` };
  }
  const data = await res.json();

  await supabaseAdmin
    .from("google_calendar_tokens")
    .update({
      watch_channel_id: channelId,
      watch_channel_token: channelToken,
      watch_resource_id: data.resourceId,
      watch_expires_at: data.expiration
        ? new Date(Number(data.expiration)).toISOString()
        : new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    })
    .eq("id", tokenRow.id);

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || new URL(req.url).searchParams.get("action") || "start";

    // CRON renewal: renew watches expiring in <24h for all tokens
    if (action === "renew-all") {
      const cronHeader = req.headers.get("x-cron-secret");
      if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabaseAdmin
        .from("google_calendar_tokens")
        .select("*")
        .eq("connection_status", "active")
        .or(`watch_expires_at.is.null,watch_expires_at.lte.${threshold}`);

      let renewed = 0;
      let failed = 0;
      for (const row of rows || []) {
        const r = await startChannelForToken(
          supabaseAdmin,
          SUPABASE_URL,
          row,
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
        );
        if (r.ok) renewed++;
        else failed++;
      }
      return new Response(JSON.stringify({ renewed, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-user actions require auth
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
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

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

    if (action === "stop") {
      const accessToken = await getValidAccessToken(
        supabaseAdmin,
        tokenRow,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
      );
      if (accessToken && tokenRow.watch_channel_id && tokenRow.watch_resource_id) {
        await stopChannel(accessToken, tokenRow.watch_channel_id, tokenRow.watch_resource_id);
      }
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({
          watch_channel_id: null,
          watch_channel_token: null,
          watch_resource_id: null,
          watch_expires_at: null,
        })
        .eq("id", tokenRow.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // start / renew for this user
    const result = await startChannelForToken(
      supabaseAdmin,
      SUPABASE_URL,
      tokenRow,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
    );
    return new Response(JSON.stringify({ success: result.ok, reason: result.reason }), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("watch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
