// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  AiSuggestionRow,
  AiSuggestionActionType,
  DiffEntry,
  orderSuggestions,
  checkInvariants,
  BATCH_LIMIT,
} from "./shared.ts";

import { corsFor } from "../_shared/cors.ts";

interface ApplyRequest {
  suggestion_ids?: string[];
  dry_run?: boolean;
}

interface ApplyResult {
  applied: string[];
  failed: Array<{ id: string; error: string }>;
  skipped: Array<{ id: string; reason: string }>;
  diff: DiffEntry[];
  rolled_back?: string[];
  invariant_errors?: string[];
}

type Sb = ReturnType<typeof createClient>;

async function handleSuggestion(
  sb: Sb,
  s: AiSuggestionRow,
  dryRun: boolean,
): Promise<{ diff: DiffEntry; rollback_data: any | null }> {
  const ctx = { tenant_id: s.tenant_id };
  const payload = s.action_payload ?? {};

  switch (s.action_type as AiSuggestionActionType) {
    case "create_task": {
      const row = {
        tenant_id: ctx.tenant_id,
        id_cliente: payload.id_cliente as string,
        titulo: (payload.titulo as string) ?? s.title,
        categoria: (payload.categoria as string) ?? "geral",
        prioridade: (payload.prioridade as string) ?? "media",
        observacoes: (payload.observacoes as string) ?? null,
        data_vencimento: (payload.data_vencimento as string) ?? null,
      };
      if (dryRun) {
        return {
          diff: {
            suggestion_id: s.id,
            table: "cliente_tarefas",
            op: "insert",
            before: null,
            after: row,
          },
          rollback_data: null,
        };
      }
      const { data, error } = await sb
        .from("cliente_tarefas")
        .insert(row)
        .select("id_tarefa")
        .single();
      if (error) throw new Error(error.message);
      return {
        diff: {
          suggestion_id: s.id,
          table: "cliente_tarefas",
          op: "insert",
          before: null,
          after: { ...row, id_tarefa: data.id_tarefa },
        },
        rollback_data: { table: "cliente_tarefas", id_tarefa: data.id_tarefa },
      };
    }

    case "create_event": {
      const row = {
        tenant_id: ctx.tenant_id,
        id_cliente: payload.id_cliente as string,
        tipo: (payload.tipo as string) ?? "ai_suggestion",
        categoria: (payload.categoria as string) ?? "geral",
        titulo: (payload.titulo as string) ?? s.title,
        descricao: (payload.descricao as string) ?? null,
        manual: false,
        metadata: { from_suggestion: s.id },
      };
      if (dryRun) {
        return {
          diff: {
            suggestion_id: s.id,
            table: "cliente_eventos",
            op: "insert",
            before: null,
            after: row,
          },
          rollback_data: null,
        };
      }
      const { data, error } = await sb
        .from("cliente_eventos")
        .insert(row)
        .select("id_evento")
        .single();
      if (error) throw new Error(error.message);
      return {
        diff: {
          suggestion_id: s.id,
          table: "cliente_eventos",
          op: "insert",
          before: null,
          after: { ...row, id_evento: data.id_evento },
        },
        rollback_data: { table: "cliente_eventos", id_evento: data.id_evento },
      };
    }

    case "send_notification": {
      const row = {
        tenant_id: ctx.tenant_id,
        tipo: (payload.tipo as string) ?? "ai",
        titulo: (payload.titulo as string) ?? s.title,
        mensagem: (payload.mensagem as string) ?? "",
        prioridade: (payload.prioridade as string) ?? "normal",
        link: (payload.link as string) ?? null,
        id_referencia: (payload.id_referencia as string) ?? null,
      };
      if (dryRun) {
        return {
          diff: {
            suggestion_id: s.id,
            table: "notificacoes",
            op: "insert",
            before: null,
            after: row,
          },
          rollback_data: null,
        };
      }
      const { data, error } = await sb
        .from("notificacoes")
        .insert(row)
        .select("id_notificacao")
        .single();
      if (error) throw new Error(error.message);
      return {
        diff: {
          suggestion_id: s.id,
          table: "notificacoes",
          op: "insert",
          before: null,
          after: { ...row, id_notificacao: data.id_notificacao },
        },
        rollback_data: {
          table: "notificacoes",
          id_notificacao: data.id_notificacao,
        },
      };
    }

    case "update_status": {
      // Generic optimistic-locked update on a single column.
      const table = String(payload.table ?? "");
      const id_field = String(payload.id_field ?? "");
      const id_value = String(payload.id_value ?? "");
      const column = String(payload.column ?? "");
      const new_value = payload.new_value;
      if (!table || !id_field || !id_value || !column) {
        throw new Error("invalid update_status payload");
      }
      // Whitelist tables to avoid arbitrary mutations
      const allowed = new Set([
        "fato_orcamento",
        "fato_servico",
        "cliente_tarefas",
      ]);
      if (!allowed.has(table)) throw new Error(`table not allowed: ${table}`);

      const { data: before, error: readErr } = await sb
        .from(table)
        .select(`${id_field}, ${column}, updated_at, tenant_id`)
        .eq(id_field, id_value)
        .eq("tenant_id", ctx.tenant_id)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!before) throw new Error("target row not found");

      if (dryRun) {
        return {
          diff: {
            suggestion_id: s.id,
            table,
            op: "update",
            before: before as any,
            after: { ...(before as any), [column]: new_value },
          },
          rollback_data: null,
        };
      }
      const { error: updErr } = await sb
        .from(table)
        .update({ [column]: new_value })
        .eq(id_field, id_value)
        .eq("tenant_id", ctx.tenant_id)
        .eq("updated_at", (before as any).updated_at);
      if (updErr) throw new Error(updErr.message);
      return {
        diff: {
          suggestion_id: s.id,
          table,
          op: "update",
          before: before as any,
          after: { ...(before as any), [column]: new_value },
        },
        rollback_data: {
          table,
          id_field,
          id_value,
          column,
          previous_value: (before as any)[column],
        },
      };
    }

    case "noop_informational":
    case "update_setting":
    default:
      return {
        diff: {
          suggestion_id: s.id,
          table: "(none)",
          op: "noop",
          before: null,
          after: null,
        },
        rollback_data: null,
      };
  }
}

async function rollbackOne(sb: Sb, data: any): Promise<void> {
  if (!data || !data.table) return;
  if (data.table === "cliente_tarefas" && data.id_tarefa) {
    await sb.from("cliente_tarefas").delete().eq("id_tarefa", data.id_tarefa);
  } else if (data.table === "cliente_eventos" && data.id_evento) {
    await sb.from("cliente_eventos").delete().eq("id_evento", data.id_evento);
  } else if (data.table === "notificacoes" && data.id_notificacao) {
    await sb
      .from("notificacoes")
      .delete()
      .eq("id_notificacao", data.id_notificacao);
  } else if (data.id_field && data.column) {
    await sb
      .from(data.table)
      .update({ [data.column]: data.previous_value })
      .eq(data.id_field, data.id_value);
  }
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

    const body = (await req.json().catch(() => ({}))) as ApplyRequest;
    const dryRun = body.dry_run === true;

    let q = sb
      .from("ai_suggestions")
      .select(
        "id, tenant_id, created_by, category, priority, depends_on, status, action_type, action_payload, title",
      )
      .eq("status", "pending");
    if (body.suggestion_ids?.length) q = q.in("id", body.suggestion_ids);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const suggestions = (rows ?? []) as AiSuggestionRow[];
    const { ordered, skipped } = orderSuggestions(suggestions);

    if (ordered.length > BATCH_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "BATCH_LIMIT_EXCEEDED",
          message: `Máximo ${BATCH_LIMIT} sugestões por execução. Foram ${ordered.length}.`,
          limit: BATCH_LIMIT,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result: ApplyResult = {
      applied: [],
      failed: [],
      skipped,
      diff: [],
    };
    const appliedRollbacks: Array<{ id: string; data: any }> = [];

    for (const s of ordered) {
      try {
        const { diff, rollback_data } = await handleSuggestion(sb, s, dryRun);
        result.diff.push(diff);
        if (!dryRun) {
          await sb
            .from("ai_suggestions")
            .update({
              status: "applied",
              applied_at: new Date().toISOString(),
              rollback_data,
            })
            .eq("id", s.id);
          result.applied.push(s.id);
          appliedRollbacks.push({ id: s.id, data: rollback_data });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.failed.push({ id: s.id, error: msg });
        if (!dryRun) {
          await sb
            .from("ai_suggestions")
            .update({ status: "failed", error_message: msg })
            .eq("id", s.id);
        }
      }
    }

    // Post-apply invariants
    if (!dryRun && result.applied.length > 0) {
      const [oCount, tCount, eCount] = await Promise.all([
        sb.from("fato_orcamento").select("id_orcamento", { count: "exact", head: true }),
        sb.from("cliente_tarefas").select("id_tarefa", { count: "exact", head: true }),
        sb.from("cliente_eventos").select("id_evento", { count: "exact", head: true }),
      ]);
      const errors = checkInvariants({
        total_orcamentos_count: oCount.count ?? 0,
        total_tarefas_count: tCount.count ?? 0,
        total_eventos_count: eCount.count ?? 0,
      });
      if (errors.length > 0) {
        // Auto rollback all applied in this batch
        const rolled: string[] = [];
        for (const ar of appliedRollbacks.reverse()) {
          try {
            await rollbackOne(sb, ar.data);
            await sb
              .from("ai_suggestions")
              .update({ status: "rolled_back" })
              .eq("id", ar.id);
            rolled.push(ar.id);
          } catch {
            /* best effort */
          }
        }
        result.applied = [];
        result.rolled_back = rolled;
        result.invariant_errors = errors;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
