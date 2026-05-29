import { describe, it, expect } from "vitest";
import { normalizeText, fuzzyMatch, levenshtein } from "./textNormalize";

describe("normalizeText", () => {
  it("strips accents, separators and lowercases", () => {
    expect(normalizeText("Razão Social")).toBe("razaosocial");
    expect(normalizeText("E-Mail / Contato")).toBe("emailcontato");
  });
});

describe("levenshtein + fuzzyMatch", () => {
  it("matches near-identical strings", () => {
    expect(levenshtein("celular", "celular")).toBe(0);
    expect(fuzzyMatch("Celular", "celular")).toBe(true);
    expect(fuzzyMatch("Telefon", "telefone")).toBe(true);
    expect(fuzzyMatch("xyz", "telefone")).toBe(false);
  });
});
