// Weekly cron: generate AI suggestions for paid tenants without pending ones.
// Triggered by pg_cron via net.http_post. Uses service role to bypass RLS.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CRON_SECRET fetched from vault on each cold start
let CACHED_CRON_SECRET: string | null = null;

interface SuggestionDraft {
  category: "erro" | "teste" | "fallback" | "ux" | "financeiro" | "operacional";
  title: string;
  description: string;
  priority: number;
  rationale?: string;
}

async function generateForTenant(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  createdBy: string,
): Promise<{ tenant_id: string; status: string; inserted: number; skipped_reason?: string }> {
  // Skip if any pending suggestion exists
  const { count, error: countErr } = await admin
    .from("ai_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "pending");
  if (countErr) return { tenant_id: tenantId, status: "error", inserted: 0, skipped_reason: countErr.message };
  if ((count ?? 0) > 0) return { tenant_id: tenantId, status: "skipped", inserted: 0, skipped_reason: "has_pending" };

  // Pull aggregated metrics (RPC respects auth.uid; here we run as service so use direct queries)
  const [{ data: orcCount }, { data: despCount }, { data: cliCount }] = await Promise.all([
    admin.from("fato_orcamento").select("id_orcamento", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("fato_despesas").select("id_despesas", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("dim_cliente").select("id_cliente", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  const prompt = `Você é consultor de gestão para uma empresa de topografia/serviços rurais.
Contexto do tenant:
- Orçamentos cadastrados: ${(orcCount as unknown as { count?: number })?.count ?? "?"}
- Despesas registradas: ${(despCount as unknown as { count?: number })?.count ?? "?"}
- Clientes ativos: ${(cliCount as unknown as { count?: number })?.count ?? "?"}

Gere de 3 a 6 sugestões acionáveis, ordenadas por importância. Use apenas estas categorias:
"erro" (correção urgente), "teste" (validação), "fallback" (mitigação), "ux", "financeiro", "operacional".

Responda APENAS com um array JSON válido. Cada item:
{ "category": "<uma das acima>", "title": "máx 80 chars", "description": "máx 250 chars", "priority": 1-200, "rationale": "máx 200 chars" }`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });
  if (!aiResp.ok) {
    const t = await aiResp.text();
    return { tenant_id: tenantId, status: "ai_error", inserted: 0, skipped_reason: `${aiResp.status}:${t.slice(0, 120)}` };
  }
  const aiJson = await aiResp.json();
  const raw = aiJson.choices?.[0]?.message?.content ?? "[]";
  let drafts: SuggestionDraft[] = [];
  try {
    drafts = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  } catch {
    return { tenant_id: tenantId, status: "parse_error", inserted: 0, skipped_reason: raw.slice(0, 120) };
  }
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return { tenant_id: tenantId, status: "empty", inserted: 0 };
  }

  const allowedCategories = new Set(["erro", "teste", "fallback", "ux", "financeiro", "operacional"]);
  const rows = drafts
    .filter((d) => d && allowedCategories.has(d.category) && d.title && d.description)
    .slice(0, 6)
    .map((d) => ({
      tenant_id: tenantId,
      created_by: createdBy,
      category: d.category,
      title: String(d.title).slice(0, 200),
      description: String(d.description).slice(0, 1000),
      priority: Math.max(1, Math.min(200, Number(d.priority) || 100)),
      rationale: d.rationale ? String(d.rationale).slice(0, 500) : null,
      action_type: "noop_informational",
      action_payload: {},
      source: "dashboard_insights",
      status: "pending",
    }));

  if (rows.length === 0) return { tenant_id: tenantId, status: "filtered_out", inserted: 0 };

  const { error: insErr } = await admin.from("ai_suggestions").insert(rows);
  if (insErr) return { tenant_id: tenantId, status: "insert_error", inserted: 0, skipped_reason: insErr.message };
  return { tenant_id: tenantId, status: "ok", inserted: rows.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: shared secret OR service-role key
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ok = (CRON_SECRET && provided === CRON_SECRET) || (serviceKey && provided === serviceKey);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey,
      { auth: { persistSession: false } },
    );

    // Bootstrap: ensure CRON_SECRET exists in vault so pg_cron can read it.
    if (CRON_SECRET) {
      try {
        await admin.rpc("upsert_cron_secret", { p_value: CRON_SECRET });
      } catch (e) {
        console.warn("[generate-ai-suggestions-cron] vault bootstrap failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // Eligible tenants: paid plan (slug != 'trial' optional) and status active/trialing.
    // Per user spec: only PAID plans → exclude trialing.
    const { data: subs, error: subErr } = await admin
      .from("tenant_subscriptions")
      .select("tenant_id, status, plan_id, subscription_plans!inner(slug, price_cents)")
      .eq("status", "active");
    if (subErr) throw subErr;

    const paidTenants = (subs ?? []).filter((s: any) => (s.subscription_plans?.price_cents ?? 0) > 0);

    const results: Array<Awaited<ReturnType<typeof generateForTenant>>> = [];
    for (const sub of paidTenants) {
      const tenantId = (sub as any).tenant_id as string;
      // Pick an admin user in the tenant as created_by
      const { data: members } = await admin
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenantId)
        .eq("role", "admin")
        .limit(1);
      const createdBy = members?.[0]?.user_id;
      if (!createdBy) {
        results.push({ tenant_id: tenantId, status: "no_admin", inserted: 0 });
        continue;
      }
      try {
        results.push(await generateForTenant(admin, tenantId, createdBy));
      } catch (e) {
        results.push({
          tenant_id: tenantId,
          status: "exception",
          inserted: 0,
          skipped_reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    console.log("[generate-ai-suggestions-cron] results", JSON.stringify(results));
    return new Response(
      JSON.stringify({ tenants: paidTenants.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-ai-suggestions-cron] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
