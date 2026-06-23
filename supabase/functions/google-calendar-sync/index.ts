import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsFor } from "../_shared/cors.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ---------- Category / color metadata (mirror src/lib/calendar/eventCategories.ts) ----------
type EventCategory =
  | "servico"
  | "visita"
  | "orcamento"
  | "vencimento"
  | "financeiro"
  | "reuniao"
  | "tarefa";

const COLOR_BY_CATEGORY: Record<EventCategory, string> = {
  servico: "9",
  visita: "7",
  orcamento: "3",
  vencimento: "11",
  financeiro: "10",
  reuniao: "5",
  tarefa: "8",
};

function defaultReminders(cat: EventCategory): number[] {
  switch (cat) {
    case "vencimento":
      return [60 * 24, 60];
    case "visita":
    case "servico":
      return [60];
    case "reuniao":
      return [30, 10];
    case "orcamento":
      return [60 * 24];
    default:
      return [];
  }
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; expires_in: number } | { invalid_grant: true } | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("Token refresh failed:", txt);
    if (txt.includes("invalid_grant")) return { invalid_grant: true };
    return null;
  }
  return res.json();
}

async function getValidAccessToken(
  supabaseAdmin: any,
  tokenRow: any,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const expiresAt = new Date(tokenRow.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const result = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
    if (!result) return null;
    if ("invalid_grant" in result) {
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({ connection_status: "needs_reconnect", updated_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
      return null;
    }
    const newExpiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({
        access_token: result.access_token,
        token_expires_at: newExpiresAt,
        connection_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);
    return result.access_token;
  }
  return tokenRow.access_token;
}

function inferCategory(
  type: "orcamento" | "servico",
  item: any,
): EventCategory {
  if (type === "orcamento") {
    // Vencimento = orçamento com prazo de faturamento; usuário pode marcar via campo
    if (item.is_vencimento) return "vencimento";
    return "orcamento";
  }
  const cat = (item.categoria || "").toLowerCase();
  if (cat.includes("visita")) return "visita";
  if (cat.includes("reuni")) return "reuniao";
  return "servico";
}

function buildGoogleEvent(item: any, type: "orcamento" | "servico", category: EventCategory) {
  const reminders = defaultReminders(category);
  const remindersObj = reminders.length
    ? {
        useDefault: false,
        overrides: reminders.map((m) => ({ method: "popup", minutes: m })),
      }
    : { useDefault: true };

  if (type === "orcamento") {
    const startDate = item.data_inicio || item.data_orcamento;
    const endDate = item.data_termino || startDate;
    const clienteNome = item.dim_cliente?.nome || "Cliente";
    const propNome = item.dim_propriedade?.nome_da_propriedade || "";
    const municipio = item.dim_propriedade?.municipio || "";

    return {
      summary: `📋 Orçamento: ${item.codigo_orcamento || clienteNome}`,
      description: [
        `Cliente: ${clienteNome}`,
        propNome ? `Propriedade: ${propNome}` : null,
        municipio ? `Município: ${municipio}` : null,
        item.receita_esperada
          ? `Valor: R$ ${Number(item.receita_esperada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : null,
        item.situacao ? `Situação: ${item.situacao}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { date: startDate },
      end: { date: endDate },
      colorId: COLOR_BY_CATEGORY[category],
      reminders: remindersObj,
      extendedProperties: {
        private: {
          geogestor_id: item.id_orcamento,
          geogestor_type: "orcamento",
          geogestor_category: category,
        },
      },
    };
  }

  // servico
  const startDate = item.data_do_servico_inicio;
  const endDate = item.data_do_servico_fim || startDate;
  const clienteNome = item.dim_cliente?.nome || "";
  const propNome = item.dim_propriedade?.nome_da_propriedade || "";

  return {
    summary: `🛠️ ${category === "visita" ? "Visita" : "Serviço"}: ${item.nome_do_servico}`,
    description: [
      clienteNome ? `Cliente: ${clienteNome}` : null,
      propNome ? `Propriedade: ${propNome}` : null,
      item.situacao_do_servico ? `Status: ${item.situacao_do_servico}` : null,
      item.categoria ? `Categoria: ${item.categoria}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { date: startDate },
    end: { date: endDate },
    colorId: COLOR_BY_CATEGORY[category],
    reminders: remindersObj,
    extendedProperties: {
      private: {
        geogestor_id: item.id_servico,
        geogestor_type: "servico",
        geogestor_category: category,
      },
    },
  };
}

function nextRetryDate(retryCount: number): string {
  // backoff: 1m, 5m, 30m, 2h, depois desiste
  const minutes = [1, 5, 30, 120][Math.min(retryCount, 3)];
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function enqueueRetry(
  supabaseAdmin: any,
  tenantId: string,
  userId: string,
  operation: "create" | "update" | "delete",
  entityType: string,
  entityId: string,
  payload: any,
  error: string,
  attempts: number,
) {
  if (attempts >= 4) {
    console.error(`Giving up on ${operation} ${entityType}/${entityId}: ${error}`);
    return;
  }
  await supabaseAdmin.from("calendar_sync_queue").insert({
    tenant_id: tenantId,
    user_id: userId,
    operation,
    entity_type: entityType,
    entity_id: entityId,
    payload,
    status: "pending",
    attempts,
    last_error: error,
    scheduled_at: nextRetryDate(attempts),
  });
}

async function pushOne(
  supabase: any,
  supabaseAdmin: any,
  accessToken: string,
  tokenRow: any,
  userId: string,
  eventType: "orcamento" | "servico",
  eventId: string,
): Promise<{ ok: boolean; reason?: string; google_event_id?: string }> {
  const calendarId = tokenRow.selected_calendar_id || "primary";

  // Fetch local event
  let localEvent: any;
  if (eventType === "orcamento") {
    const { data } = await supabase
      .from("fato_orcamento")
      .select(
        "*, dim_cliente:dim_cliente!fk_orcamento_cliente(nome), dim_propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)",
      )
      .eq("id_orcamento", eventId)
      .single();
    localEvent = data;
  } else {
    const { data } = await supabase
      .from("fato_servico")
      .select(
        "*, dim_cliente:dim_cliente!fato_servico_id_cliente_fkey(nome), dim_propriedade:dim_propriedade!fato_servico_id_propriedade_fkey(nome_da_propriedade, municipio)",
      )
      .eq("id_servico", eventId)
      .single();
    localEvent = data;
  }

  if (!localEvent) return { ok: false, reason: "not_found" };

  const hasDate =
    eventType === "orcamento"
      ? localEvent.data_inicio || localEvent.data_orcamento
      : localEvent.data_do_servico_inicio;
  if (!hasDate) return { ok: false, reason: "no_date" };

  const category = inferCategory(eventType, localEvent);

  // Respect sync_types preference
  const syncTypes = tokenRow.sync_types || {};
  if (syncTypes[category] === false) return { ok: false, reason: "category_disabled" };

  const googleEvent = buildGoogleEvent(localEvent, eventType, category);

  const { data: existingSync } = await supabaseAdmin
    .from("google_calendar_sync")
    .select("google_event_id")
    .eq("user_id", userId)
    .eq("local_event_id", eventId)
    .eq("local_event_type", eventType)
    .maybeSingle();

  let googleEventId: string;

  if (existingSync?.google_event_id) {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${existingSync.google_event_id}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(googleEvent),
      },
    );

    if (res.status === 404) {
      // Recreate
      const createRes = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(googleEvent),
        },
      );
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(created)}`);
      googleEventId = created.id;
      await supabaseAdmin
        .from("google_calendar_sync")
        .update({
          google_event_id: googleEventId,
          event_category: category,
          color_id: COLOR_BY_CATEGORY[category],
          last_error: null,
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("local_event_id", eventId)
        .eq("local_event_type", eventType);
    } else if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Update failed [${res.status}]: ${errText}`);
    } else {
      const updated = await res.json();
      googleEventId = updated.id;
      await supabaseAdmin
        .from("google_calendar_sync")
        .update({
          event_category: category,
          color_id: COLOR_BY_CATEGORY[category],
          last_error: null,
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("local_event_id", eventId)
        .eq("local_event_type", eventType);
    }
  } else {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(googleEvent),
      },
    );
    const created = await res.json();
    if (!res.ok) throw new Error(`Create failed [${res.status}]: ${JSON.stringify(created)}`);
    googleEventId = created.id;

    await supabaseAdmin.from("google_calendar_sync").insert({
      user_id: userId,
      tenant_id: tokenRow.tenant_id,
      google_event_id: googleEventId,
      local_event_id: eventId,
      local_event_type: eventType,
      event_category: category,
      color_id: COLOR_BY_CATEGORY[category],
      origin: "local",
    });
  }

  await supabaseAdmin
    .from("google_calendar_tokens")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { ok: true, google_event_id: googleEventId };
}

async function deleteOne(
  supabaseAdmin: any,
  accessToken: string,
  tokenRow: any,
  userId: string,
  eventType: "orcamento" | "servico",
  eventId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const calendarId = tokenRow.selected_calendar_id || "primary";
  const { data: existing } = await supabaseAdmin
    .from("google_calendar_sync")
    .select("id, google_event_id")
    .eq("user_id", userId)
    .eq("local_event_id", eventId)
    .eq("local_event_type", eventType)
    .maybeSingle();
  if (!existing?.google_event_id) return { ok: true, reason: "no_mapping" };

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${existing.google_event_id}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const txt = await res.text();
    throw new Error(`Delete failed [${res.status}]: ${txt}`);
  }
  await supabaseAdmin.from("google_calendar_sync").delete().eq("id", existing.id);
  return { ok: true };
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
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
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRow } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenRow.connection_status === "needs_reconnect") {
      return new Response(
        JSON.stringify({ error: "needs_reconnect", message: "Reconecte sua conta Google" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getValidAccessToken(
      supabaseAdmin,
      tokenRow,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
    );
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to refresh Google token. Please reconnect." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "push") {
      const { event_type, event_id } = body as {
        event_type: "orcamento" | "servico";
        event_id: string;
      };

      if (!tokenRow.auto_sync_enabled && !body.force) {
        return new Response(JSON.stringify({ skipped: true, reason: "auto_sync_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await pushOne(
          supabase,
          supabaseAdmin,
          accessToken,
          tokenRow,
          userId,
          event_type,
          event_id,
        );
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await enqueueRetry(
          supabaseAdmin,
          tokenRow.tenant_id,
          userId,
          "update",
          event_type,
          event_id,
          {},
          e?.message || "unknown",
          0,
        );
        throw e;
      }
    }

    if (action === "delete") {
      const { event_type, event_id } = body as {
        event_type: "orcamento" | "servico";
        event_id: string;
      };
      const result = await deleteOne(
        supabaseAdmin,
        accessToken,
        tokenRow,
        userId,
        event_type,
        event_id,
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "full-sync") {
      const tenantId = tokenRow.tenant_id;
      let synced = 0;
      let errors = 0;

      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select("id_orcamento")
        .eq("tenant_id", tenantId);

      for (const orc of orcamentos || []) {
        try {
          const r = await pushOne(
            supabase,
            supabaseAdmin,
            accessToken,
            tokenRow,
            userId,
            "orcamento",
            orc.id_orcamento,
          );
          if (r.ok) synced++;
        } catch (e) {
          console.error("Sync orcamento error:", e);
          errors++;
        }
      }

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select("id_servico")
        .eq("tenant_id", tenantId);

      for (const svc of servicos || []) {
        try {
          const r = await pushOne(
            supabase,
            supabaseAdmin,
            accessToken,
            tokenRow,
            userId,
            "servico",
            svc.id_servico,
          );
          if (r.ok) synced++;
        } catch (e) {
          console.error("Sync servico error:", e);
          errors++;
        }
      }

      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true, synced, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google Calendar Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
