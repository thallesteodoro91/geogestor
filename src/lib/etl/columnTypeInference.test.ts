import { describe, it, expect } from "vitest";
import { inferColumnType } from "./columnTypeInference";

describe("inferColumnType", () => {
  it("classifies status column even when header has 'pagamento'", () => {
    const r = inferColumnType("Situação do Pagamento", ["Pago", "Pendente", "Cancelado", "Pago", "Pendente"]);
    expect(r.type).toBe("status");
  });

  it("classifies date even when header has 'faturamento'", () => {
    const r = inferColumnType("Data do Faturamento", ["12/05/2026", "01/01/2025", "2024-10-10"]);
    expect(r.type).toBe("data");
  });

  it("classifies monetary with R$", () => {
    const r = inferColumnType("Receita", ["R$ 5.000,00", "R$ 12.000,00", "1500"]);
    expect(r.type).toBe("monetario");
  });

  it("does NOT classify Pendente as monetary", () => {
    const r = inferColumnType("Despesa", ["Pendente", "Pago", "Cancelado"]);
    expect(r.type).toBe("status");
  });

  it("recognizes subcategoria header pattern", () => {
    const r = inferColumnType("SubCategoria", ["Combustível", "Mão de obra", "Diária", "Combustível", "Material"]);
    expect(r.type).toBe("subcategoria");
  });
});
