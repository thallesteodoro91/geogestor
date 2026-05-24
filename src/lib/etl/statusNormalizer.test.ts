import { describe, it, expect } from "vitest";
import {
  normalizeStatusPagamento,
  normalizeFormaPagamento,
  normalizeStatusOrcamento,
  isFormaPagamentoToken,
  isStatusOrcamentoToken,
} from "./statusNormalizer";

describe("normalizeStatusPagamento", () => {
  it("maps common variants to canonical values", () => {
    expect(normalizeStatusPagamento("pago")).toBe("Pago");
    expect(normalizeStatusPagamento("PAID")).toBe("Pago");
    expect(normalizeStatusPagamento("em aberto")).toBe("Pendente");
    expect(normalizeStatusPagamento("vencido")).toBe("Atrasado");
    expect(normalizeStatusPagamento("faturado")).toBe("Faturado");
    expect(normalizeStatusPagamento("parcial")).toBe("Parcial");
  });
  it("returns null for unknown values", () => {
    expect(normalizeStatusPagamento("xpto")).toBeNull();
    expect(normalizeStatusPagamento("")).toBeNull();
  });
});

describe("normalizeFormaPagamento", () => {
  it("normalizes payment methods", () => {
    expect(normalizeFormaPagamento("pix")).toBe("PIX");
    expect(normalizeFormaPagamento("Boleto Bancário")).toBe("Boleto");
    expect(normalizeFormaPagamento("crédito")).toBe("Cartão de Crédito");
    expect(normalizeFormaPagamento("Cartão de Débito")).toBe("Cartão de Débito");
    expect(normalizeFormaPagamento("TED")).toBe("Transferência");
    expect(normalizeFormaPagamento("à vista")).toBe("Dinheiro");
    expect(normalizeFormaPagamento("Parcelado em 3x")).toBe("Parcelado");
  });
  it("returns null for unknown methods", () => {
    expect(normalizeFormaPagamento("xpto")).toBeNull();
    expect(normalizeFormaPagamento(null)).toBeNull();
  });
});

describe("normalizeStatusOrcamento", () => {
  it("maps budget statuses", () => {
    expect(normalizeStatusOrcamento("aprovado")).toBe("Aprovado");
    expect(normalizeStatusOrcamento("Em Análise")).toBe("Em Analise");
    expect(normalizeStatusOrcamento("enviado")).toBe("Em Analise");
    expect(normalizeStatusOrcamento("Rejeitado")).toBe("Recusado");
    expect(normalizeStatusOrcamento("concluído")).toBe("Aprovado");
    expect(normalizeStatusOrcamento("Cancelado")).toBe("Cancelado");
  });
});

describe("token detection", () => {
  it("isFormaPagamentoToken detects payment method tokens", () => {
    expect(isFormaPagamentoToken("PIX")).toBe(true);
    expect(isFormaPagamentoToken("Boleto")).toBe(true);
    expect(isFormaPagamentoToken("R$ 100,00")).toBe(false);
  });
  it("isStatusOrcamentoToken detects budget status tokens", () => {
    expect(isStatusOrcamentoToken("Aprovado")).toBe(true);
    expect(isStatusOrcamentoToken("Em Análise")).toBe(true);
    expect(isStatusOrcamentoToken("R$ 100,00")).toBe(false);
  });
});
