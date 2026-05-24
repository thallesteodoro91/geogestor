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

  it("detects forma de pagamento from values", () => {
    const r = inferColumnType("Pagamento", ["PIX", "Boleto", "Cartão", "PIX", "Transferência"]);
    expect(r.type).toBe("forma_pagamento");
  });

  it("detects forma de pagamento with explicit header even with mixed values", () => {
    const r = inferColumnType("Forma de Pagamento", ["pix", "boleto", "Crédito", "Outros"]);
    expect(r.type).toBe("forma_pagamento");
  });

  it("does not classify monetary column as forma de pagamento", () => {
    const r = inferColumnType("Pagamento", ["R$ 1.500,00", "R$ 800,00", "2000"]);
    expect(r.type).toBe("monetario");
  });

  it("detects status do orçamento when header hints + values match", () => {
    const r = inferColumnType("Status do Orçamento", ["Aprovado", "Em Análise", "Recusado", "Enviado"]);
    expect(r.type).toBe("status_orcamento");
  });
});

