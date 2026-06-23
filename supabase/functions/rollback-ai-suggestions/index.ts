import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { corsFor } from "../_shared/cors.ts";

interface RollbackRequest {
  suggestion_ids: string[];
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const body = (await req.json().catch(() => ({}))) as RollbackRequest;
    if (!Array.isArray(body.suggestion_ids) || body.suggestion_ids.length === 0) {
      return new Response(JSON.stringify({ error: "suggestion_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error } = await sb
      .from("ai_suggestions")
      .select("id, status, rollback_data")
      .in("id", body.suggestion_ids)
      .eq("status", "applied");
    if (error) throw new Error(error.message);

    const rolled: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const r of rows ?? []) {
      const data: any = r.rollback_data;
      try {
        if (!data) {
          failed.push({ id: r.id, error: "no rollback data" });
          continue;
        }
        if (data.table === "cliente_tarefas" && data.id_tarefa) {
          await sb.from("cliente_tarefas").delete().eq("id_tarefa", data.id_tarefa);
        } else if (data.table === "cliente_eventos" && data.id_evento) {
          await sb.from("cliente_eventos").delete().eq("id_evento", data.id_evento);
        } else if (data.table === "notificacoes" && data.id_notificacao) {
          await sb.from("notificacoes").delete().eq("id_notificacao", data.id_notificacao);
        } else if (data.id_field && data.column) {
          await sb
            .from(data.table)
            .update({ [data.column]: data.previous_value })
            .eq(data.id_field, data.id_value);
        } else {
          failed.push({ id: r.id, error: "unknown rollback shape" });
          continue;
        }
        await sb.from("ai_suggestions").update({ status: "rolled_back" }).eq("id", r.id);
        rolled.push(r.id);
      } catch (e) {
        failed.push({ id: r.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ rolled_back: rolled, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
