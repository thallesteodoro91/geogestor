import { describe, it, expect } from "vitest";
import { matchColumn } from "./hybridMatcher";

describe("hybrid matcher", () => {
  it("agrees and boosts when header + content point to the same field", () => {
    const m = matchColumn("Situação do Pagamento", ["Pago", "Pendente", "Cancelado", "Pago"]);
    expect(m.field?.id).toBe("orcamento.situacao_pagamento");
    expect(m.score).toBeGreaterThan(0.8);
  });

  it("rescues a misnamed header via content", () => {
    const m = matchColumn("Coluna X", ["PIX", "Boleto", "Cartão", "PIX"]);
    expect(m.field?.id).toBe("orcamento.forma_pagamento");
  });

  it("flags untyped columns as custom fields", () => {
    const m = matchColumn("Observação Interna", ["foo", "bar", "baz"]);
    expect(m.isCustomField).toBe(true);
  });
});
