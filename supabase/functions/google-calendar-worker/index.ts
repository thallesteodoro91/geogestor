import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
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
  if (expiresAt.getTime() - Date.now() >= 5 * 60 * 1000) return tokenRow.access_token;

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

function parseGoogleDate(field: any): { iso: string | null; allDay: boolean } {
  if (!field) return { iso: null, allDay: false };
  if (field.dateTime) return { iso: new Date(field.dateTime).toISOString(), allDay: false };
  if (field.date) return { iso: new Date(field.date + "T00:00:00Z").toISOString(), allDay: true };
  return { iso: null, allDay: false };
}

async function processPull(
  supabaseAdmin: any,
  tokenRow: any,
  accessToken: string,
  calendarId: string,
): Promise<{ pulled: number; deleted: number }> {
  let pageToken: string | undefined;
  let newSyncToken: string | undefined;
  let pulled = 0;
  let deleted = 0;

  // Build initial URL: incremental if we have a syncToken, otherwise window-based seed
  const baseParams = new URLSearchParams();
  if (tokenRow.sync_token) {
    baseParams.set("syncToken", tokenRow.sync_token);
  } else {
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
    baseParams.set("timeMin", timeMin);
    baseParams.set("timeMax", timeMax);
    baseParams.set("singleEvents", "true");
    baseParams.set("showDeleted", "true");
  }

  while (true) {
    const params = new URLSearchParams(baseParams);
    if (pageToken) params.set("pageToken", pageToken);
    params.set("maxResults", "250");

    const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (res.status === 410) {
      // syncToken invalid → reset and full re-sync next run
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({ sync_token: null })
        .eq("id", tokenRow.id);
      return { pulled, deleted };
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`events.list failed [${res.status}]: ${txt}`);
    }
    const data = await res.json();

    for (const ev of data.items || []) {
      const extPriv = ev.extendedProperties?.private || {};
      const geogestorId = extPriv.geogestor_id;
      const geogestorType = extPriv.geogestor_type as "orcamento" | "servico" | undefined;

      // Cancelled events
      if (ev.status === "cancelled") {
        if (geogestorId && geogestorType) {
          // local mapping: drop sync row (don't delete local entity, user must decide)
          await supabaseAdmin
            .from("google_calendar_sync")
            .delete()
            .eq("user_id", tokenRow.user_id)
            .eq("local_event_id", geogestorId)
            .eq("local_event_type", geogestorType);
        } else {
          await supabaseAdmin
            .from("calendar_eventos_externos")
            .delete()
            .eq("user_id", tokenRow.user_id)
            .eq("google_calendar_id", calendarId)
            .eq("google_event_id", ev.id);
        }
        deleted++;
        continue;
      }

      // Local entity event echoed back — just refresh mapping timestamp, skip writing
      // to local entities to avoid update loops.
      if (geogestorId && geogestorType) {
        await supabaseAdmin
          .from("google_calendar_sync")
          .upsert(
            {
              user_id: tokenRow.user_id,
              tenant_id: tokenRow.tenant_id,
              google_event_id: ev.id,
              local_event_id: geogestorId,
              local_event_type: geogestorType,
              event_category: extPriv.geogestor_category || null,
              origin: "local",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,local_event_id,local_event_type" },
          );
        continue;
      }

      // External event → upsert into calendar_eventos_externos
      const start = parseGoogleDate(ev.start);
      const end = parseGoogleDate(ev.end);
      await supabaseAdmin.from("calendar_eventos_externos").upsert(
        {
          tenant_id: tokenRow.tenant_id,
          user_id: tokenRow.user_id,
          google_event_id: ev.id,
          google_calendar_id: calendarId,
          summary: ev.summary || null,
          description: ev.description || null,
          start_at: start.iso,
          end_at: end.iso,
          all_day: start.allDay,
          location: ev.location || null,
          attendees: ev.attendees || null,
          html_link: ev.htmlLink || null,
          google_updated_at: ev.updated ? new Date(ev.updated).toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,google_calendar_id,google_event_id" },
      );
      pulled++;
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
      continue;
    }
    if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
    break;
  }

  if (newSyncToken) {
    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({
        sync_token: newSyncToken,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);
  }

  return { pulled, deleted };
}

function nextRetryDate(attempts: number): string {
  const minutes = [1, 5, 30, 120][Math.min(attempts, 3)];
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Claim a batch of pending jobs
    const { data: jobs } = await supabaseAdmin
      .from("calendar_sync_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    const summary = { processed: 0, failed: 0, pulled: 0, deleted: 0 };

    for (const job of jobs || []) {
      await supabaseAdmin
        .from("calendar_sync_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      try {
        if (job.operation === "pull") {
          const { data: tokenRow } = await supabaseAdmin
            .from("google_calendar_tokens")
            .select("*")
            .eq("user_id", job.user_id)
            .single();
          if (!tokenRow) throw new Error("token_not_found");
          if (tokenRow.connection_status === "needs_reconnect") {
            throw new Error("needs_reconnect");
          }
          const accessToken = await getValidAccessToken(
            supabaseAdmin,
            tokenRow,
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
          );
          if (!accessToken) throw new Error("no_access_token");

          const calendarId =
            (job.payload && job.payload.calendar_id) ||
            tokenRow.selected_calendar_id ||
            "primary";
          const result = await processPull(supabaseAdmin, tokenRow, accessToken, calendarId);
          summary.pulled += result.pulled;
          summary.deleted += result.deleted;
        } else {
          // create/update/delete retries are handled by the originating service for now;
          // mark as done to clear the queue without blocking.
        }

        await supabaseAdmin
          .from("calendar_sync_queue")
          .update({
            status: "done",
            last_error: null,
            attempts: (job.attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        summary.processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        const attempts = (job.attempts || 0) + 1;
        const giveUp = attempts >= 5;
        await supabaseAdmin
          .from("calendar_sync_queue")
          .update({
            status: giveUp ? "failed" : "pending",
            attempts,
            last_error: msg,
            scheduled_at: giveUp ? job.scheduled_at : nextRetryDate(attempts - 1),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        summary.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("worker error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
