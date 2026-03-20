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

      // Parse state to get user info
      let stateData: { user_id: string; tenant_id: string; origin: string };
      try {
        stateData = JSON.parse(atob(state));
      } catch {
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
        const state = btoa(
          JSON.stringify({
            user_id: userId,
            tenant_id,
            origin: body.origin || "",
          })
        );

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
          .select("created_at, last_synced_at")
          .eq("user_id", userId)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            connected: !!data,
            last_synced_at: data?.last_synced_at,
            connected_at: data?.created_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
