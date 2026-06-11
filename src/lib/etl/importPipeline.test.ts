/**
 * Phase 1 — acceptance tests for the Universal Importer pipeline.
 *
 * Cobre os critérios obrigatórios:
 *  1. Datas BR (dd/mm/yyyy) não invertem.
 *  2. Valores monetários BR ("R$ 1.234,56") parseiam corretamente.
 *  3. Valores não numéricos geram warning em vez de virar 0 silencioso.
 *  4. Statuses livres normalizam (pago/pendente/aprovado/forma de pagamento).
 *  5. Mapeamento canonical→DB usa colunas reais do schema (sem inválidas).
 *  6. explodeRow + resolveRelations criam plano consistente para
 *     cliente → propriedade → orçamento → serviço → despesa.
 */

import { describe, it, expect } from "vitest";
import { parseDateBRFirst, coerce } from "./importCoercion";
import {
  normalizeStatusPagamento,
  normalizeFormaPagamento,
  normalizeStatusOrcamento,
  normalizeStatusServico,
} from "./statusNormalizer";
import { CANONICAL_TO_COLUMN } from "./canonicalToDb";
import { CANONICAL_FIELDS } from "./canonicalSchema";
import { explodeRow } from "./rowExploder";
import { resolveRelations } from "./relationResolver";
import type { HybridMatch } from "./hybridMatcher";

describe("parseDateBRFirst", () => {
  it("parseia dd/mm/yyyy sem inverter", () => {
    expect(parseDateBRFirst("07/03/2025")).toBe("2025-03-07");
    expect(parseDateBRFirst("31/12/2024")).toBe("2024-12-31");
  });
  it("aceita dd-mm-yyyy e dd.mm.yyyy", () => {
    expect(parseDateBRFirst("07-03-2025")).toBe("2025-03-07");
    expect(parseDateBRFirst("07.03.2025")).toBe("2025-03-07");
  });
  it("aceita ISO yyyy-mm-dd sem alterar", () => {
    expect(parseDateBRFirst("2025-03-07")).toBe("2025-03-07");
  });
  it("rejeita datas inválidas", () => {
    expect(parseDateBRFirst("99/99/9999")).toBeNull();
    expect(parseDateBRFirst("texto qualquer")).toBeNull();
    expect(parseDateBRFirst("")).toBeNull();
    expect(parseDateBRFirst(null)).toBeNull();
  });
  it("aceita ano com 2 dígitos", () => {
    expect(parseDateBRFirst("07/03/25")).toBe("2025-03-07");
  });
});

describe("coerce", () => {
  it("converte monetário BR sem virar 0 silencioso", () => {
    const r = coerce("orcamento.valor_orcado", "R$ 1.234,56");
    expect(r.value).toBeCloseTo(1234.56, 2);
    expect(r.warning).toBeUndefined();
  });
  it("gera warning quando monetário é não-numérico", () => {
    const r = coerce("orcamento.valor_orcado", "abc");
    expect(r.value).toBeNull();
    expect(r.warning).toContain("Valor Orçado");
  });
  it("converte data BR", () => {
    const r = coerce("orcamento.data_emissao", "15/06/2025");
    expect(r.value).toBe("2025-06-15");
  });
  it("gera warning em data inválida", () => {
    const r = coerce("orcamento.data_emissao", "99/99/9999");
    expect(r.warning).toContain("Data de Emissão");
  });
  it("normaliza CPF/CNPJ/telefone removendo não-dígitos", () => {
    expect(coerce("cliente.cpf", "123.456.789-00").value).toBe("12345678900");
    expect(coerce("cliente.telefone", "(11) 99999-1234").value).toBe("11999991234");
  });
});

describe("statusNormalizer (sinônimos PT/EN)", () => {
  it("status de pagamento", () => {
    expect(normalizeStatusPagamento("pago")).toBeTruthy();
    expect(normalizeStatusPagamento("PAID")).toBeTruthy();
    expect(normalizeStatusPagamento("aguardando")).toBeTruthy();
    expect(normalizeStatusPagamento("vencido")).toBeTruthy();
    expect(normalizeStatusPagamento("xyz")).toBeNull();
  });
  it("forma de pagamento aceita variantes", () => {
    expect(normalizeFormaPagamento("Pix")).toBeTruthy();
    expect(normalizeFormaPagamento("Cartão de Crédito Visa")).toBeTruthy();
    expect(normalizeFormaPagamento("boleto bancário")).toBeTruthy();
    expect(normalizeFormaPagamento("TED")).toBeTruthy();
  });
  it("status de orçamento", () => {
    expect(normalizeStatusOrcamento("aprovado")).toBeTruthy();
    expect(normalizeStatusOrcamento("em negociação")).toBeTruthy();
    expect(normalizeStatusOrcamento("recusado")).toBeTruthy();
  });
  it("status de serviço", () => {
    expect(normalizeStatusServico("concluido")).toBe("Concluído");
    expect(normalizeStatusServico("EM ANDAMENTO")).toBe("Em andamento");
  });
});

describe("canonicalToDb mapping integrity", () => {
  it("usa apenas colunas reais conhecidas (sem mapeamentos inválidos)", () => {
    const allowed: Record<string, string[]> = {
      dim_cliente: [
        "nome","razao_social","nome_fantasia","cpf","cnpj","email","telefone",
        "celular","whatsapp","data_cadastro","categoria","origem","situacao",
        "endereco","endereco_numero","endereco_complemento","bairro","cidade","estado","cep",
      ],
      dim_propriedade: [
        "nome_da_propriedade","tipo","matricula","car","ccir","itr","area_ha","latitude","longitude",
      ],
      fato_servico: [
        "nome_do_servico","categoria","situacao_do_servico","data_do_servico_inicio","data_do_servico_fim",
      ],
      fato_orcamento: [
        "codigo_orcamento","receita_esperada","desconto","valor_imposto","forma_de_pagamento",
        "situacao_do_pagamento","situacao","data_orcamento","data_do_faturamento",
        "receita_realizada","valor_faturado",
      ],
      fato_despesas: ["valor_da_despesa"],
    };
    for (const [canonId, mapping] of Object.entries(CANONICAL_TO_COLUMN)) {
      expect(allowed[mapping.table], `tabela ${mapping.table} (${canonId})`).toBeDefined();
      expect(
        allowed[mapping.table].includes(mapping.column),
        `coluna inválida ${mapping.table}.${mapping.column} para ${canonId}`,
      ).toBe(true);
    }
  });

  it("não mapeia para colunas inexistentes conhecidas (regressão)", () => {
    const bad = ["valor_desconto", "status_do_orcamento", "tipo_propriedade", "area"];
    for (const m of Object.values(CANONICAL_TO_COLUMN)) {
      expect(bad).not.toContain(m.column);
    }
  });

  it("CANONICAL_FIELDS cobre todas as chaves de CANONICAL_TO_COLUMN", () => {
    const ids = new Set(CANONICAL_FIELDS.map(f => f.id));
    for (const k of Object.keys(CANONICAL_TO_COLUMN)) {
      expect(ids.has(k), `canonical id ausente em schema: ${k}`).toBe(true);
    }
  });
});

describe("pipeline integration — cliente → propriedade → orçamento → serviço → despesa", () => {
  const headers = [
    "Cliente","CPF","Propriedade","Matrícula","Área (ha)",
    "Código Orçamento","Valor Orçado","Status Orçamento","Forma Pagamento","Situação Pagamento",
    "Data Emissão","Serviço","Status Serviço","Data Início Serviço","Despesas",
  ];
  const matches: HybridMatch[] = [
    { header: "Cliente", field: byId("cliente.nome"), score: 1, isCustomField: false, reason: "" },
    { header: "CPF", field: byId("cliente.cpf"), score: 1, isCustomField: false, reason: "" },
    { header: "Propriedade", field: byId("propriedade.nome"), score: 1, isCustomField: false, reason: "" },
    { header: "Matrícula", field: byId("propriedade.matricula"), score: 1, isCustomField: false, reason: "" },
    { header: "Área (ha)", field: byId("propriedade.area"), score: 1, isCustomField: false, reason: "" },
    { header: "Código Orçamento", field: byId("orcamento.codigo"), score: 1, isCustomField: false, reason: "" },
    { header: "Valor Orçado", field: byId("orcamento.valor_orcado"), score: 1, isCustomField: false, reason: "" },
    { header: "Status Orçamento", field: byId("orcamento.status"), score: 1, isCustomField: false, reason: "" },
    { header: "Forma Pagamento", field: byId("orcamento.forma_pagamento"), score: 1, isCustomField: false, reason: "" },
    { header: "Situação Pagamento", field: byId("orcamento.situacao_pagamento"), score: 1, isCustomField: false, reason: "" },
    { header: "Data Emissão", field: byId("orcamento.data_emissao"), score: 1, isCustomField: false, reason: "" },
    { header: "Serviço", field: byId("servico.nome"), score: 1, isCustomField: false, reason: "" },
    { header: "Status Serviço", field: byId("servico.status"), score: 1, isCustomField: false, reason: "" },
    { header: "Data Início Serviço", field: byId("servico.data_inicio"), score: 1, isCustomField: false, reason: "" },
    { header: "Despesas", field: byId("financeiro.despesas"), score: 1, isCustomField: false, reason: "" },
  ];

  it("explodeRow distribui colunas pelas entidades corretas", () => {
    const row = [
      "João Silva","123.456.789-00","Fazenda Boa Vista","MAT-001","250",
      "JS001","R$ 12.500,00","Aprovado","Pix","Pago",
      "15/06/2025","Topografia","Concluído","20/06/2025","R$ 800,00",
    ];
    const ex = explodeRow(headers, matches, row);
    expect(ex.cliente?.nome).toBe("João Silva");
    expect(ex.cliente?.cpf).toBe("123.456.789-00");
    expect(ex.propriedade?.nome).toBe("Fazenda Boa Vista");
    expect(ex.propriedade?.matricula).toBe("MAT-001");
    expect(ex.orcamento?.codigo).toBe("JS001");
    expect(ex.orcamento?.valor_orcado).toBe("R$ 12.500,00");
    expect(ex.servico?.nome).toBe("Topografia");
    expect(ex.financeiro?.despesas).toBe("R$ 800,00");
  });

  it("resolveRelations gera 1 cliente novo e 1 propriedade nova para 1 linha", () => {
    const row = [
      "Maria Souza","987.654.321-00","Sítio Esperança","MAT-002","80",
      "MS001","5000","Aprovado","Boleto","Pendente",
      "01/07/2025","Levantamento","Pendente","05/07/2025","",
    ];
    const ex = explodeRow(headers, matches, row);
    const resolved = resolveRelations([ex], [], []);
    expect(resolved.clientesNovos).toHaveLength(1);
    expect(resolved.propriedadesNovas).toHaveLength(1);
    expect(resolved.propriedadesNovas[0].__clienteRef).toBe(resolved.clientesNovos[0].__tempId);
    expect(resolved.rows[0].propriedade?.nome).toBe("Sítio Esperança");
  });

  it("dedup: mesmo cliente em 2 linhas vira 1 inserção", () => {
    const r1 = ["Carlos","111.111.111-11","P1","M1","10","C1","100","","","","","","","",""];
    const r2 = ["Carlos","111.111.111-11","P2","M2","20","C2","200","","","","","","","",""];
    const ex1 = explodeRow(headers, matches, r1);
    const ex2 = explodeRow(headers, matches, r2);
    const resolved = resolveRelations([ex1, ex2], [], []);
    expect(resolved.clientesNovos).toHaveLength(1);
    expect(resolved.propriedadesNovas).toHaveLength(2);
  });
});

function byId(id: string) {
  const f = CANONICAL_FIELDS.find(x => x.id === id);
  if (!f) throw new Error(`canonical ${id} not found`);
  return f;
}
