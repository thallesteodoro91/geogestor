import { describe, it, expect } from "vitest";
import { synonymMatch } from "./synonymsDictionary";

describe("synonymMatch", () => {
  it("matches a direct alias", () => {
    expect(synonymMatch("Contratante")?.field.id).toBe("cliente.nome");
    expect(synonymMatch("Fazenda")?.field.id).toBe("propriedade.nome");
    expect(synonymMatch("Forma de Pagamento")?.field.id).toBe("orcamento.forma_pagamento");
    expect(synonymMatch("Município")?.field.id).toBe("endereco.cidade");
    expect(synonymMatch("Faturamento")?.field.id).toBe("financeiro.receita_realizada");
  });

  it("tolerates typos", () => {
    expect(synonymMatch("Telefon")?.field.id).toBe("cliente.telefone");
  });

  it("returns null for unrelated headers", () => {
    expect(synonymMatch("xyz qrs zzz")).toBeNull();
  });
});
