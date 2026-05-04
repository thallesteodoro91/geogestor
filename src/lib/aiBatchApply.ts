/**
 * Pure utilities for ordering AI suggestions before batch apply.
 * No side effects — fully testable.
 */

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

export interface AiSuggestion {
  id: string;
  category: AiSuggestionCategory;
  priority: number;
  depends_on: string[];
  status: AiSuggestionStatus;
  action_type: AiSuggestionActionType;
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

export interface OrderedPlan<T extends AiSuggestion = AiSuggestion> {
  /** Sorted execution order. */
  ordered: T[];
  /** IDs that could not be ordered due to missing deps or cycles. */
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * Topological sort by dependency, with category weight + priority as tiebreakers.
 * - Drops items pointing to unknown deps (skipped: dependency_missing).
 * - Detects cycles and skips the entire cyclic component (skipped: cycle).
 */
export function orderSuggestions<T extends AiSuggestion>(
  suggestions: T[],
): OrderedPlan<T> {
  const byId = new Map<string, T>(suggestions.map((s) => [s.id, s]));
  const skipped: Array<{ id: string; reason: string }> = [];

  // Filter: only pending; resolve deps within set
  const pool = new Map<string, T>();
  for (const s of suggestions) {
    if (s.status !== "pending") continue;
    pool.set(s.id, s);
  }

  // Sanitize deps and drop unknown
  const cleanDeps = new Map<string, string[]>();
  for (const [id, s] of pool) {
    const deps = (s.depends_on ?? []).filter((d) => d !== id);
    const unknown = deps.find((d) => !pool.has(d) && !byId.has(d));
    if (unknown) {
      skipped.push({ id, reason: `dependency_missing:${unknown}` });
      continue;
    }
    // Keep only deps that are also in the pool (others are already applied/skipped)
    cleanDeps.set(id, deps.filter((d) => pool.has(d)));
  }

  for (const id of skipped.map((s) => s.id)) pool.delete(id);

  // Kahn's algorithm
  const indegree = new Map<string, number>();
  for (const id of pool.keys()) indegree.set(id, 0);
  for (const [id, deps] of cleanDeps) {
    if (!pool.has(id)) continue;
    indegree.set(id, deps.length);
  }

  const ready: string[] = [];
  for (const [id, deg] of indegree) if (deg === 0) ready.push(id);

  const sortReady = () =>
    ready.sort((a, b) => {
      const sa = pool.get(a)!;
      const sb = pool.get(b)!;
      const wa = CATEGORY_WEIGHT[sa.category];
      const wb = CATEGORY_WEIGHT[sb.category];
      if (wa !== wb) return wa - wb;
      if (sa.priority !== sb.priority) return sa.priority - sb.priority;
      return a.localeCompare(b);
    });

  const ordered: T[] = [];
  const reverseDeps = new Map<string, string[]>();
  for (const [id, deps] of cleanDeps) {
    for (const d of deps) {
      if (!reverseDeps.has(d)) reverseDeps.set(d, []);
      reverseDeps.get(d)!.push(id);
    }
  }

  while (ready.length) {
    sortReady();
    const id = ready.shift()!;
    ordered.push(pool.get(id)!);
    for (const child of reverseDeps.get(id) ?? []) {
      indegree.set(child, (indegree.get(child) ?? 1) - 1);
      if ((indegree.get(child) ?? 0) === 0) ready.push(child);
    }
  }

  // Anything remaining in indegree > 0 is in a cycle
  for (const [id, deg] of indegree) {
    if (deg > 0) skipped.push({ id, reason: "cycle" });
  }

  return { ordered, skipped };
}

/**
 * Enforces the batch limit. Returns the executable slice + the deferred IDs.
 */
export function enforceBatchLimit<T extends AiSuggestion>(
  ordered: T[],
  limit = BATCH_LIMIT,
): { execute: T[]; deferred: T[] } {
  if (ordered.length <= limit) return { execute: ordered, deferred: [] };
  return { execute: ordered.slice(0, limit), deferred: ordered.slice(limit) };
}
