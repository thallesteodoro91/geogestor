import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
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
    console.error("Token refresh failed:", await res.text());
    return null;
  }
  return res.json();
}

async function getValidAccessToken(
  supabaseAdmin: any,
  tokenRow: any,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const expiresAt = new Date(tokenRow.token_expires_at);
  // Refresh if expires in less than 5 minutes
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
    if (!newTokens) return null;

    const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({ access_token: newTokens.access_token, token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return newTokens.access_token;
  }
  return tokenRow.access_token;
}

function buildGoogleEvent(item: any, type: "orcamento" | "servico"): any {
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
        item.receita_esperada ? `Valor: R$ ${Number(item.receita_esperada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null,
        item.situacao ? `Situação: ${item.situacao}` : null,
      ].filter(Boolean).join("\n"),
      start: { date: startDate },
      end: { date: endDate },
      extendedProperties: {
        private: { geogestor_id: item.id_orcamento, geogestor_type: "orcamento" },
      },
    };
  }

  // servico
  const startDate = item.data_do_servico_inicio;
  const endDate = item.data_do_servico_fim || startDate;
  const clienteNome = item.dim_cliente?.nome || "";
  const propNome = item.dim_propriedade?.nome_da_propriedade || "";

  return {
    summary: `🛠️ Serviço: ${item.nome_do_servico}`,
    description: [
      clienteNome ? `Cliente: ${clienteNome}` : null,
      propNome ? `Propriedade: ${propNome}` : null,
      item.situacao_do_servico ? `Status: ${item.situacao_do_servico}` : null,
      item.categoria ? `Categoria: ${item.categoria}` : null,
    ].filter(Boolean).join("\n"),
    start: { date: startDate },
    end: { date: endDate },
    extendedProperties: {
      private: { geogestor_id: item.id_servico, geogestor_type: "servico" },
    },
  };
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
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's Google tokens
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

    const accessToken = await getValidAccessToken(supabaseAdmin, tokenRow, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Failed to refresh Google token. Please reconnect." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // PUSH: sync a single event to Google Calendar
    if (action === "push") {
      const { event_type, event_id } = body;

      // Fetch the local event data
      let localEvent;
      if (event_type === "orcamento") {
        const { data } = await supabase
          .from("fato_orcamento")
          .select("*, dim_cliente:dim_cliente!fk_orcamento_cliente(nome), dim_propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)")
          .eq("id_orcamento", event_id)
          .single();
        localEvent = data;
      } else {
        const { data } = await supabase
          .from("fato_servico")
          .select("*, dim_cliente:dim_cliente!fato_servico_id_cliente_fkey(nome), dim_propriedade:dim_propriedade!fato_servico_id_propriedade_fkey(nome_da_propriedade, municipio)")
          .eq("id_servico", event_id)
          .single();
        localEvent = data;
      }

      if (!localEvent) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if we need a date for the event
      const hasDate = event_type === "orcamento"
        ? localEvent.data_inicio || localEvent.data_orcamento
        : localEvent.data_do_servico_inicio;

      if (!hasDate) {
        return new Response(JSON.stringify({ skipped: true, reason: "No date set" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const googleEvent = buildGoogleEvent(localEvent, event_type);

      // Check if mapping exists
      const { data: existingSync } = await supabaseAdmin
        .from("google_calendar_sync")
        .select("google_event_id")
        .eq("user_id", userId)
        .eq("local_event_id", event_id)
        .eq("local_event_type", event_type)
        .maybeSingle();

      let googleEventId: string;

      if (existingSync?.google_event_id) {
        // Update existing Google event
        const res = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/primary/events/${existingSync.google_event_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          // If 404, event was deleted on Google side, create new
          if (res.status === 404) {
            const createRes = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(googleEvent),
              }
            );
            const created = await createRes.json();
            if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(created)}`);
            googleEventId = created.id;

            await supabaseAdmin
              .from("google_calendar_sync")
              .update({ google_event_id: googleEventId, updated_at: new Date().toISOString() })
              .eq("user_id", userId)
              .eq("local_event_id", event_id)
              .eq("local_event_type", event_type);
          } else {
            throw new Error(`Update failed [${res.status}]: ${errText}`);
          }
        } else {
          const updated = await res.json();
          googleEventId = updated.id;
        }
      } else {
        // Create new Google event
        const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleEvent),
        });

        const created = await res.json();
        if (!res.ok) throw new Error(`Create failed [${res.status}]: ${JSON.stringify(created)}`);
        googleEventId = created.id;

        // Save mapping
        await supabaseAdmin.from("google_calendar_sync").insert({
          user_id: userId,
          tenant_id: tokenRow.tenant_id,
          google_event_id: googleEventId,
          local_event_id: event_id,
          local_event_type: event_type,
        });
      }

      // Update last_synced_at
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true, google_event_id: googleEventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FULL SYNC: push all orcamentos and servicos to Google
    if (action === "full-sync") {
      const tenantId = tokenRow.tenant_id;
      let synced = 0;
      let errors = 0;

      // Sync orcamentos with dates
      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select("id_orcamento, data_orcamento, data_inicio, data_termino, codigo_orcamento, receita_esperada, situacao, dim_cliente:dim_cliente!fk_orcamento_cliente(nome), dim_propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)")
        .eq("tenant_id", tenantId);

      for (const orc of orcamentos || []) {
        try {
          const hasDate = orc.data_inicio || orc.data_orcamento;
          if (!hasDate) continue;

          const googleEvent = buildGoogleEvent({ ...orc }, "orcamento");

          const { data: existingSync } = await supabaseAdmin
            .from("google_calendar_sync")
            .select("google_event_id")
            .eq("user_id", userId)
            .eq("local_event_id", orc.id_orcamento)
            .eq("local_event_type", "orcamento")
            .maybeSingle();

          if (existingSync?.google_event_id) {
            const res = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/primary/events/${existingSync.google_event_id}`,
              {
                method: "PUT",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(googleEvent),
              }
            );
            await res.text();
          } else {
            const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(googleEvent),
            });
            const created = await res.json();
            if (res.ok) {
              await supabaseAdmin.from("google_calendar_sync").insert({
                user_id: userId,
                tenant_id: tenantId,
                google_event_id: created.id,
                local_event_id: orc.id_orcamento,
                local_event_type: "orcamento",
              });
            }
          }
          synced++;
        } catch (e) {
          console.error("Sync orcamento error:", e);
          errors++;
        }
      }

      // Sync servicos with dates
      const { data: servicos } = await supabase
        .from("fato_servico")
        .select("id_servico, nome_do_servico, data_do_servico_inicio, data_do_servico_fim, situacao_do_servico, categoria, dim_cliente:dim_cliente!fato_servico_id_cliente_fkey(nome), dim_propriedade:dim_propriedade!fato_servico_id_propriedade_fkey(nome_da_propriedade, municipio)")
        .eq("tenant_id", tenantId);

      for (const svc of servicos || []) {
        try {
          if (!svc.data_do_servico_inicio) continue;

          const googleEvent = buildGoogleEvent(svc, "servico");

          const { data: existingSync } = await supabaseAdmin
            .from("google_calendar_sync")
            .select("google_event_id")
            .eq("user_id", userId)
            .eq("local_event_id", svc.id_servico)
            .eq("local_event_type", "servico")
            .maybeSingle();

          if (existingSync?.google_event_id) {
            const res = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/primary/events/${existingSync.google_event_id}`,
              {
                method: "PUT",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(googleEvent),
              }
            );
            await res.text();
          } else {
            const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(googleEvent),
            });
            const created = await res.json();
            if (res.ok) {
              await supabaseAdmin.from("google_calendar_sync").insert({
                user_id: userId,
                tenant_id: tenantId,
                google_event_id: created.id,
                local_event_id: svc.id_servico,
                local_event_type: "servico",
              });
            }
          }
          synced++;
        } catch (e) {
          console.error("Sync servico error:", e);
          errors++;
        }
      }

      // Update last_synced_at
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
