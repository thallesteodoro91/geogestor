import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, clearDraft, hasDraft, __testing } from "./importDraft";

const tenantId = "tenant-abc";

describe("importDraft", () => {
  beforeEach(() => sessionStorage.clear());

  it("round-trip salva e carrega", () => {
    saveDraft({
      tenantId,
      fileName: "planilha.xlsx",
      headers: ["nome", "cpf"],
      rows: [["A", "1"], ["B", "2"]],
      matches: [],
      overrides: { nome: "cliente.nome" },
    });
    expect(hasDraft(tenantId)).toBe(true);
    const d = loadDraft(tenantId)!;
    expect(d.fileName).toBe("planilha.xlsx");
    expect(d.headers).toEqual(["nome", "cpf"]);
    expect(d.rows).toHaveLength(2);
    expect(d.overrides.nome).toBe("cliente.nome");
    expect(d.truncated).toBe(false);
    expect(d.totalRows).toBe(2);
  });

  it("trunca acima do limite e marca truncated=true", () => {
    const big = Array.from({ length: __testing.MAX_PERSISTED_ROWS + 10 }, (_, i) => [i]);
    saveDraft({ tenantId, fileName: "big.csv", headers: ["n"], rows: big, matches: [], overrides: {} });
    const d = loadDraft(tenantId)!;
    expect(d.truncated).toBe(true);
    expect(d.totalRows).toBe(big.length);
    expect(d.rows).toHaveLength(__testing.MAX_PERSISTED_ROWS);
  });

  it("clearDraft remove a entrada", () => {
    saveDraft({ tenantId, fileName: "x", headers: ["a"], rows: [["1"]], matches: [], overrides: {} });
    clearDraft(tenantId);
    expect(loadDraft(tenantId)).toBeNull();
    expect(hasDraft(tenantId)).toBe(false);
  });

  it("isola rascunhos entre tenants", () => {
    saveDraft({ tenantId: "t1", fileName: "a", headers: ["a"], rows: [["1"]], matches: [], overrides: {} });
    saveDraft({ tenantId: "t2", fileName: "b", headers: ["b"], rows: [["2"]], matches: [], overrides: {} });
    expect(loadDraft("t1")!.fileName).toBe("a");
    expect(loadDraft("t2")!.fileName).toBe("b");
  });

  it("sem tenantId não faz nada", () => {
    saveDraft({ tenantId: null, fileName: "x", headers: [], rows: [], matches: [], overrides: {} });
    expect(loadDraft(null)).toBeNull();
    expect(hasDraft(undefined)).toBe(false);
  });
});
