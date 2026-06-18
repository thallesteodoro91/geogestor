import { describe, it, expect } from "vitest";
import { TOOLTIPS, getTooltip } from "./catalog";

describe("tooltips catalog", () => {
  it("não tem descrição vazia", () => {
    for (const [key, entry] of Object.entries(TOOLTIPS)) {
      expect(entry.description, `chave ${key} sem descrição`).toBeTruthy();
      expect(entry.description.trim().length, `descrição vazia em ${key}`).toBeGreaterThan(10);
    }
  });

  it("não usa textos genéricos proibidos", () => {
    const banidos = [/mais informações/i, /saiba mais/i, /clique aqui/i, /lorem ipsum/i];
    for (const [key, entry] of Object.entries(TOOLTIPS)) {
      for (const padrao of banidos) {
        expect(padrao.test(entry.description), `texto genérico em ${key}`).toBe(false);
      }
    }
  });

  it("chaves seguem o padrão dominio.campo", () => {
    const regex = /^[a-z]+\.[a-zA-Z][a-zA-Z0-9]*$/;
    for (const key of Object.keys(TOOLTIPS)) {
      expect(regex.test(key), `chave fora do padrão: ${key}`).toBe(true);
    }
  });

  it("getTooltip retorna entrada existente", () => {
    expect(getTooltip("finance.lucroLiquido")?.title).toBe("Lucro Líquido");
  });

  it("getTooltip retorna undefined para chave inexistente", () => {
    expect(getTooltip("nao.existe")).toBeUndefined();
  });
});
