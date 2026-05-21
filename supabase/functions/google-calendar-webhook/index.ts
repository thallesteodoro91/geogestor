import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-channel-token, x-goog-resource-id, x-goog-resource-state",
};

// Google Calendar push notification webhook.
// Headers we care about:
//   X-Goog-Channel-ID, X-Goog-Channel-Token, X-Goog-Resource-ID,
//   X-Goog-Resource-State (sync | exists | not_exists)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const channelId = req.headers.get("X-Goog-Channel-ID");
  const channelToken = req.headers.get("X-Goog-Channel-Token");
  const resourceState = req.headers.get("X-Goog-Resource-State");

  // Always consume body to avoid resource leaks
  await req.text();

  if (!channelId) {
    return new Response("ok", { headers: corsHeaders });
  }

  // Sync handshake — nothing to do, Google just confirms the watch
  if (resourceState === "sync") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: tokenRow } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("id, user_id, tenant_id, watch_channel_token, selected_calendar_id")
      .eq("watch_channel_id", channelId)
      .maybeSingle();

    if (!tokenRow) {
      console.warn("Webhook: no token found for channel", channelId);
      return new Response("ok", { headers: corsHeaders });
    }

    // Verify channel token (shared secret) if stored
    if (tokenRow.watch_channel_token && tokenRow.watch_channel_token !== channelToken) {
      console.warn("Webhook: channel token mismatch");
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }

    // Avoid duplicate pending pulls for the same user
    const { data: existing } = await supabaseAdmin
      .from("calendar_sync_queue")
      .select("id")
      .eq("user_id", tokenRow.user_id)
      .eq("operation", "pull")
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("calendar_sync_queue").insert({
        tenant_id: tokenRow.tenant_id,
        user_id: tokenRow.user_id,
        operation: "pull",
        entity_type: "google_calendar",
        payload: {
          calendar_id: tokenRow.selected_calendar_id || "primary",
          resource_state: resourceState,
        },
        status: "pending",
        scheduled_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("webhook enqueue error:", e);
  }

  return new Response("ok", { headers: corsHeaders });
});
