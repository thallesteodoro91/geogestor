import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { orderSuggestions, checkInvariants, AiSuggestionRow } from "./shared.ts";

const make = (id: string, o: Partial<AiSuggestionRow> = {}): AiSuggestionRow => ({
  id,
  tenant_id: "t1",
  created_by: "u1",
  category: "operacional",
  priority: 100,
  depends_on: [],
  status: "pending",
  action_type: "noop_informational",
  action_payload: {},
  title: id,
  ...o,
});

Deno.test("orderSuggestions: respects category weight", () => {
  const list = [
    make("a", { category: "ux" }),
    make("b", { category: "erro" }),
    make("c", { category: "fallback" }),
  ];
  const { ordered, skipped } = orderSuggestions(list);
  assertEquals(skipped, []);
  assertEquals(ordered.map((s) => s.id), ["b", "c", "a"]);
});

Deno.test("orderSuggestions: detects cycle", () => {
  const list = [
    make("a", { depends_on: ["b"] }),
    make("b", { depends_on: ["a"] }),
  ];
  const { ordered, skipped } = orderSuggestions(list);
  assertEquals(ordered.length, 0);
  assertEquals(skipped.length, 2);
  assertEquals(skipped[0].reason, "cycle");
});

Deno.test("orderSuggestions: ignores non-pending", () => {
  const list = [
    make("done", { status: "applied" }),
    make("p", { category: "erro" }),
  ];
  const { ordered } = orderSuggestions(list);
  assertEquals(ordered.map((s) => s.id), ["p"]);
});

Deno.test("checkInvariants: all positive counts pass", () => {
  assertEquals(
    checkInvariants({
      total_orcamentos_count: 10,
      total_tarefas_count: 5,
      total_eventos_count: 3,
    }),
    [],
  );
});

Deno.test("checkInvariants: negative counts flagged", () => {
  const errs = checkInvariants({
    total_orcamentos_count: -1,
    total_tarefas_count: 0,
    total_eventos_count: 0,
  });
  assertEquals(errs, ["orcamentos_count_negative"]);
});
