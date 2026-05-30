import { describe, it, expect } from "vitest";
import { resolveRelations } from "./relationResolver";
import type { ExplodedRow } from "./rowExploder";

const mkRow = (data: Partial<ExplodedRow>): ExplodedRow => ({
  customFieldsByEntity: {},
  ...data,
});

describe("resolveRelations", () => {
  it("dedups clients by natural key across rows", () => {
    const exploded = [
      mkRow({ cliente: { nome: "João Silva", cpf: "12345678901" } }),
      mkRow({ cliente: { nome: "Joao  Silva", cpf: "123.456.789-01" } }),
      mkRow({ cliente: { nome: "Maria", cpf: "98765432100" } }),
    ];
    const res = resolveRelations(exploded, [], []);
    expect(res.clientesNovos).toHaveLength(2);
    expect(res.stats.clientesNovos).toBe(2);
  });

  it("matches existing client and reuses its id", () => {
    const exploded = [mkRow({ cliente: { nome: "Pedro", cpf: "11122233344" } })];
    const res = resolveRelations(
      exploded,
      [{ id_cliente: "cli-1", nome: "Pedro", cpf: "111.222.333-44" }],
      [],
    );
    expect(res.rows[0].id_cliente).toBe("cli-1");
    expect(res.clientesNovos).toHaveLength(0);
  });

  it("dedups propriedades by matricula and links to client", () => {
    const exploded = [
      mkRow({
        cliente: { nome: "Ana", cpf: "55566677788" },
        propriedade: { nome: "Fazenda Boa Vista", matricula: "MAT-001" },
      }),
      mkRow({
        cliente: { nome: "Ana", cpf: "55566677788" },
        propriedade: { nome: "Fazenda Boa Vista", matricula: "MAT-001" },
      }),
    ];
    const res = resolveRelations(exploded, [], []);
    expect(res.clientesNovos).toHaveLength(1);
    expect(res.propriedadesNovas).toHaveLength(1);
    expect(res.propriedadesNovas[0].__clienteRef).toBe(res.clientesNovos[0].__tempId);
  });
});
