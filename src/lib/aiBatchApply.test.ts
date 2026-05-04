import { describe, it, expect } from "vitest";
import {
  orderSuggestions,
  enforceBatchLimit,
  BATCH_LIMIT,
  type AiSuggestion,
} from "./aiBatchApply";

const make = (
  id: string,
  overrides: Partial<AiSuggestion> = {},
): AiSuggestion => ({
  id,
  category: "operacional",
  priority: 100,
  depends_on: [],
  status: "pending",
  action_type: "noop_informational",
  ...overrides,
});

describe("orderSuggestions", () => {
  it("orders by category weight (erro → teste → fallback → ux → others)", () => {
    const list = [
      make("a", { category: "ux" }),
      make("b", { category: "erro" }),
      make("c", { category: "fallback" }),
      make("d", { category: "teste" }),
      make("e", { category: "operacional" }),
    ];
    const { ordered, skipped } = orderSuggestions(list);
    expect(skipped).toEqual([]);
    expect(ordered.map((s) => s.id)).toEqual(["b", "d", "c", "a", "e"]);
  });

  it("respects depends_on (parent before child)", () => {
    const list = [
      make("child", { category: "erro", depends_on: ["parent"] }),
      make("parent", { category: "ux" }),
    ];
    const { ordered } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["parent", "child"]);
  });

  it("uses priority as tiebreaker within same category", () => {
    const list = [
      make("low", { category: "ux", priority: 200 }),
      make("hi", { category: "ux", priority: 10 }),
    ];
    const { ordered } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["hi", "low"]);
  });

  it("detects cycles and skips affected items", () => {
    const list = [
      make("a", { depends_on: ["b"] }),
      make("b", { depends_on: ["a"] }),
      make("c"),
    ];
    const { ordered, skipped } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["c"]);
    expect(skipped.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(skipped.every((s) => s.reason === "cycle")).toBe(true);
  });

  it("skips items with unknown deps", () => {
    const list = [make("a", { depends_on: ["ghost"] }), make("b")];
    const { ordered, skipped } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["b"]);
    expect(skipped[0]).toEqual({ id: "a", reason: "dependency_missing:ghost" });
  });

  it("ignores non-pending items entirely", () => {
    const list = [
      make("done", { status: "applied" }),
      make("p", { category: "erro" }),
    ];
    const { ordered, skipped } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["p"]);
    expect(skipped).toEqual([]);
  });

  it("treats deps on already-applied items as satisfied (in-pool only)", () => {
    const list = [
      make("done", { status: "applied" }),
      make("a", { depends_on: ["done"] }),
    ];
    const { ordered, skipped } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["a"]);
    expect(skipped).toEqual([]);
  });

  it("ignores self-dependencies", () => {
    const list = [make("a", { depends_on: ["a"] })];
    const { ordered, skipped } = orderSuggestions(list);
    expect(ordered.map((s) => s.id)).toEqual(["a"]);
    expect(skipped).toEqual([]);
  });

  it("returns empty plan for empty input", () => {
    expect(orderSuggestions([])).toEqual({ ordered: [], skipped: [] });
  });
});

describe("enforceBatchLimit", () => {
  it("passes through when below limit", () => {
    const list = [make("a"), make("b")];
    const { execute, deferred } = enforceBatchLimit(list);
    expect(execute).toEqual(list);
    expect(deferred).toEqual([]);
  });

  it("splits when above limit", () => {
    const list = Array.from({ length: BATCH_LIMIT + 5 }, (_, i) =>
      make(`s${i}`),
    );
    const { execute, deferred } = enforceBatchLimit(list);
    expect(execute).toHaveLength(BATCH_LIMIT);
    expect(deferred).toHaveLength(5);
  });

  it("respects custom limit", () => {
    const list = [make("a"), make("b"), make("c")];
    const { execute, deferred } = enforceBatchLimit(list, 2);
    expect(execute.map((s) => s.id)).toEqual(["a", "b"]);
    expect(deferred.map((s) => s.id)).toEqual(["c"]);
  });
});
