/**
 * Mapping between canonical field ids and the real Supabase columns.
 *
 * Canonical fields that don't have a physical column flow into the entity's
 * `custom_fields` JSONB bag (added by the universal-importer migration).
 */

import type { CanonicalEntity } from "./canonicalSchema";

/** Target table per canonical entity. `endereco` is embedded in cliente/propriedade. */
export const ENTITY_TABLE: Record<Exclude<CanonicalEntity, "endereco" | "financeiro">, string> = {
  cliente: "dim_cliente",
  propriedade: "dim_propriedade",
  servico: "fato_servico",
  orcamento: "fato_orcamento",
};

/**
 * Canonical id → real DB column. Missing entries go into `custom_fields`.
 * Keys mirror `CanonicalField.id` from `canonicalSchema.ts`.
 */
export const CANONICAL_TO_COLUMN: Record<string, { table: string; column: string }> = {
  // CLIENTE
  "cliente.nome":            { table: "dim_cliente", column: "nome" },
  "cliente.razao_social":    { table: "dim_cliente", column: "razao_social" },
  "cliente.nome_fantasia":   { table: "dim_cliente", column: "nome_fantasia" },
  "cliente.cpf":             { table: "dim_cliente", column: "cpf" },
  "cliente.cnpj":            { table: "dim_cliente", column: "cnpj" },
  "cliente.email":           { table: "dim_cliente", column: "email" },
  "cliente.telefone":        { table: "dim_cliente", column: "telefone" },
  "cliente.celular":         { table: "dim_cliente", column: "celular" },
  "cliente.whatsapp":        { table: "dim_cliente", column: "whatsapp" },
  "cliente.data_cadastro":   { table: "dim_cliente", column: "data_cadastro" },
  "cliente.categoria":       { table: "dim_cliente", column: "categoria" },
  "cliente.origem":          { table: "dim_cliente", column: "origem" },
  "cliente.situacao":        { table: "dim_cliente", column: "situacao" },

  // ENDEREÇO (cai em dim_cliente por padrão; rowExploder pode redirecionar a propriedade)
  "endereco.logradouro":     { table: "dim_cliente", column: "endereco" },
  "endereco.numero":         { table: "dim_cliente", column: "endereco_numero" },
  "endereco.complemento":    { table: "dim_cliente", column: "endereco_complemento" },
  "endereco.bairro":         { table: "dim_cliente", column: "bairro" },
  "endereco.cidade":         { table: "dim_cliente", column: "cidade" },
  "endereco.estado":         { table: "dim_cliente", column: "estado" },
  "endereco.cep":            { table: "dim_cliente", column: "cep" },

  // PROPRIEDADE (colunas reais auditadas vs schema Supabase)
  "propriedade.nome":        { table: "dim_propriedade", column: "nome_da_propriedade" },
  "propriedade.tipo":        { table: "dim_propriedade", column: "tipo" },
  "propriedade.matricula":   { table: "dim_propriedade", column: "matricula" },
  "propriedade.car":         { table: "dim_propriedade", column: "car" },
  "propriedade.ccir":        { table: "dim_propriedade", column: "ccir" },
  "propriedade.itr":         { table: "dim_propriedade", column: "itr" },
  "propriedade.area":        { table: "dim_propriedade", column: "area_ha" },
  "propriedade.latitude":    { table: "dim_propriedade", column: "latitude" },
  "propriedade.longitude":   { table: "dim_propriedade", column: "longitude" },

  // SERVIÇO
  "servico.nome":            { table: "fato_servico", column: "nome_do_servico" },
  "servico.categoria":       { table: "fato_servico", column: "categoria" },
  "servico.status":          { table: "fato_servico", column: "situacao_do_servico" },
  "servico.data_inicio":     { table: "fato_servico", column: "data_do_servico_inicio" },
  "servico.data_fim":        { table: "fato_servico", column: "data_do_servico_fim" },

  // ORÇAMENTO (colunas reais: desconto, situacao, valor_faturado, receita_realizada)
  "orcamento.codigo":             { table: "fato_orcamento", column: "codigo_orcamento" },
  "orcamento.valor_orcado":       { table: "fato_orcamento", column: "receita_esperada" },
  "orcamento.desconto":           { table: "fato_orcamento", column: "desconto" },
  "orcamento.impostos":           { table: "fato_orcamento", column: "valor_imposto" },
  "orcamento.valor_final":        { table: "fato_orcamento", column: "receita_esperada" },
  "orcamento.forma_pagamento":    { table: "fato_orcamento", column: "forma_de_pagamento" },
  "orcamento.situacao_pagamento": { table: "fato_orcamento", column: "situacao_do_pagamento" },
  "orcamento.status":             { table: "fato_orcamento", column: "situacao" },
  "orcamento.data_emissao":       { table: "fato_orcamento", column: "data_orcamento" },
  "orcamento.data_vencimento":    { table: "fato_orcamento", column: "data_do_faturamento" },
  "orcamento.data_faturamento":   { table: "fato_orcamento", column: "data_do_faturamento" },

  // FINANCEIRO — semântica honesta: prevista≠realizada, despesas vão para fato_despesas
  "financeiro.receita":            { table: "fato_orcamento", column: "receita_esperada" },
  "financeiro.receita_prevista":   { table: "fato_orcamento", column: "receita_esperada" },
  "financeiro.receita_realizada":  { table: "fato_orcamento", column: "receita_realizada" },
  "financeiro.impostos":           { table: "fato_orcamento", column: "valor_imposto" },
  "financeiro.despesas":           { table: "fato_despesas",  column: "valor_da_despesa" },
};

/** Returns `{ table, column }` for the canonical id or `null` when it should be stored as custom field. */
export function resolveCanonicalColumn(canonicalId: string): { table: string; column: string } | null {
  return CANONICAL_TO_COLUMN[canonicalId] ?? null;
}

/** True when the canonical field has no physical column and must go to `custom_fields`. */
export function isCustomField(canonicalId: string): boolean {
  return !(canonicalId in CANONICAL_TO_COLUMN);
}
