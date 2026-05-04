// Shared types/constants for the apply-ai-suggestions edge function.
// Kept inline because edge functions cannot import from src/.

export type AiSuggestionStatus =
  | "pending"
  | "applied"
  | "skipped"
  | "failed"
  | "rolled_back";

export type AiSuggestionCategory =
  | "erro"
  | "teste"
  | "fallback"
  | "ux"
  | "financeiro"
  | "operacional";

export type AiSuggestionActionType =
  | "create_task"
  | "update_status"
  | "create_event"
  | "send_notification"
  | "update_setting"
  | "noop_informational";

export interface AiSuggestionRow {
  id: string;
  tenant_id: string;
  created_by: string;
  category: AiSuggestionCategory;
  priority: number;
  depends_on: string[];
  status: AiSuggestionStatus;
  action_type: AiSuggestionActionType;
  action_payload: Record<string, unknown>;
  title: string;
}

export interface DiffEntry {
  suggestion_id: string;
  table: string;
  op: "insert" | "update" | "noop";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export const CATEGORY_WEIGHT: Record<AiSuggestionCategory, number> = {
  erro: 0,
  teste: 1,
  fallback: 2,
  ux: 3,
  financeiro: 4,
  operacional: 4,
};

export const BATCH_LIMIT = 20;

/** Same algorithm as src/lib/aiBatchApply.ts — duplicated for edge runtime. */
export function orderSuggestions(suggestions: AiSuggestionRow[]) {
  const skipped: Array<{ id: string; reason: string }> = [];
  const pool = new Map<string, AiSuggestionRow>();
  for (const s of suggestions) {
    if (s.status !== "pending") continue;
    pool.set(s.id, s);
  }

  const cleanDeps = new Map<string, string[]>();
  for (const [id, s] of pool) {
    const deps = (s.depends_on ?? []).filter((d) => d !== id);
    const unknown = deps.find((d) => !pool.has(d));
    // Treat deps not in pool as already-satisfied unless they're missing entirely
    // (we can't tell from here; assume satisfied for resilience).
    if (unknown && deps.every((d) => !pool.has(d))) {
      // all deps outside pool — treat as no deps
    }
    cleanDeps.set(id, deps.filter((d) => pool.has(d)));
  }

  const indegree = new Map<string, number>();
  for (const id of pool.keys()) indegree.set(id, 0);
  for (const [id, deps] of cleanDeps) indegree.set(id, deps.length);

  const ready: string[] = [];
  for (const [id, deg] of indegree) if (deg === 0) ready.push(id);

  const reverseDeps = new Map<string, string[]>();
  for (const [id, deps] of cleanDeps) {
    for (const d of deps) {
      if (!reverseDeps.has(d)) reverseDeps.set(d, []);
      reverseDeps.get(d)!.push(id);
    }
  }

  const ordered: AiSuggestionRow[] = [];
  while (ready.length) {
    ready.sort((a, b) => {
      const sa = pool.get(a)!;
      const sb = pool.get(b)!;
      const wa = CATEGORY_WEIGHT[sa.category];
      const wb = CATEGORY_WEIGHT[sb.category];
      if (wa !== wb) return wa - wb;
      if (sa.priority !== sb.priority) return sa.priority - sb.priority;
      return a.localeCompare(b);
    });
    const id = ready.shift()!;
    ordered.push(pool.get(id)!);
    for (const child of reverseDeps.get(id) ?? []) {
      indegree.set(child, (indegree.get(child) ?? 1) - 1);
      if ((indegree.get(child) ?? 0) === 0) ready.push(child);
    }
  }

  for (const [id, deg] of indegree) {
    if (deg > 0) skipped.push({ id, reason: "cycle" });
  }
  return { ordered, skipped };
}

/** Domain invariants checked after a batch apply. Returns array of broken rules. */
export interface InvariantInput {
  total_orcamentos_count: number;
  total_tarefas_count: number;
  total_eventos_count: number;
}
export function checkInvariants(input: InvariantInput): string[] {
  const errors: string[] = [];
  if (input.total_orcamentos_count < 0) errors.push("orcamentos_count_negative");
  if (input.total_tarefas_count < 0) errors.push("tarefas_count_negative");
  if (input.total_eventos_count < 0) errors.push("eventos_count_negative");
  return errors;
}
