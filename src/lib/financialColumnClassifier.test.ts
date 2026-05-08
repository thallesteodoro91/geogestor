import { describe, it, expect } from "vitest";
import { classifyColumn, classifyExpenseCategory } from "./financialColumnClassifier";

describe("classifyColumn", () => {
  it("identifies receita variants", () => {
    expect(classifyColumn("Receita").role).toBe("receita_bruta");
    expect(classifyColumn("Faturamento").role).toBe("receita_bruta");
    expect(classifyColumn("Valor Recebido").role).toBe("receita_bruta");
    expect(classifyColumn("Receita Líquida").role).toBe("receita_liquida");
  });
  it("separates valor orçado from receita", () => {
    expect(classifyColumn("Valor Orçado").role).toBe("valor_orcado");
    expect(classifyColumn("Valor do Serviço").role).toBe("valor_orcado");
    expect(classifyColumn("Preço Unitário").role).toBe("valor_orcado");
  });
  it("identifies custos vs despesas", () => {
    expect(classifyColumn("Custo do Serviço").role).toBe("custo_obra");
    expect(classifyColumn("Custo Operacional").role).toBe("custo_obra");
    expect(classifyColumn("Despesa").role).toBe("despesa_operacional");
    expect(classifyColumn("Gasto").role).toBe("despesa_operacional");
    expect(classifyColumn("Valor Pago").role).toBe("despesa_operacional");
  });
  it("recognizes lucro/margem as informational", () => {
    expect(classifyColumn("Lucro Líquido").role).toBe("lucro_informado");
    expect(classifyColumn("Margem").role).toBe("margem_informada");
  });
  it("recognizes pipeline", () => {
    expect(classifyColumn("Previsão").role).toBe("pipeline");
    expect(classifyColumn("Potencial").role).toBe("pipeline");
  });
  it("recognizes entities", () => {
    expect(classifyColumn("Cliente").role).toBe("cliente_nome");
    expect(classifyColumn("Fazenda").role).toBe("propriedade_nome");
    expect(classifyColumn("Município").role).toBe("municipio");
  });
  it("ignores unrelated columns", () => {
    expect(classifyColumn("Foo Bar").role).toBe("ignorar");
  });
});

describe("classifyExpenseCategory", () => {
  it("flags variable costs", () => {
    expect(classifyExpenseCategory("Combustível")).toBe("VARIAVEL");
    expect(classifyExpenseCategory("Diárias de campo")).toBe("VARIAVEL");
  });
  it("defaults to fixed", () => {
    expect(classifyExpenseCategory("Aluguel")).toBe("FIXA");
    expect(classifyExpenseCategory("Salário")).toBe("FIXA");
  });
});
