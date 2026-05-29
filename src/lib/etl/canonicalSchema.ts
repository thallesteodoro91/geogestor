/**
 * Catalog of canonical fields the universal importer can populate.
 * Each field declares its entity, type and the human-friendly aliases the
 * synonym dictionary should recognize.
 */

export type CanonicalEntity =
  | "cliente"
  | "endereco"
  | "propriedade"
  | "servico"
  | "orcamento"
  | "financeiro";

export type CanonicalType =
  | "text"
  | "number"
  | "monetary"
  | "percent"
  | "date"
  | "cpf"
  | "cnpj"
  | "doc"
  | "phone"
  | "email"
  | "geo"
  | "enum";

export interface CanonicalField {
  id: string;                  // e.g. "cliente.nome"
  entity: CanonicalEntity;
  key: string;                 // e.g. "nome"
  label: string;
  type: CanonicalType;
  required?: boolean;
  /** Header-side synonyms. Always normalized via textNormalize. */
  aliases: string[];
  /** Acceptable enum values (lowercase, sem acento) when type === "enum". */
  enumValues?: string[];
}

export const CANONICAL_FIELDS: CanonicalField[] = [
  // ===== CLIENTE =====
  { id: "cliente.nome", entity: "cliente", key: "nome", label: "Nome", type: "text",
    aliases: ["nome", "cliente", "contratante", "nome do cliente", "razao social", "razão social", "nome fantasia"] },
  { id: "cliente.razao_social", entity: "cliente", key: "razao_social", label: "Razão Social", type: "text",
    aliases: ["razao social", "razão social"] },
  { id: "cliente.nome_fantasia", entity: "cliente", key: "nome_fantasia", label: "Nome Fantasia", type: "text",
    aliases: ["nome fantasia", "fantasia"] },
  { id: "cliente.cpf", entity: "cliente", key: "cpf", label: "CPF", type: "cpf",
    aliases: ["cpf", "cpf do cliente"] },
  { id: "cliente.cnpj", entity: "cliente", key: "cnpj", label: "CNPJ", type: "cnpj",
    aliases: ["cnpj", "cnpj da empresa"] },
  { id: "cliente.email", entity: "cliente", key: "email", label: "Email", type: "email",
    aliases: ["email", "e-mail", "correio eletronico"] },
  { id: "cliente.telefone", entity: "cliente", key: "telefone", label: "Telefone", type: "phone",
    aliases: ["telefone", "fone", "tel"] },
  { id: "cliente.celular", entity: "cliente", key: "celular", label: "Celular", type: "phone",
    aliases: ["celular", "cel", "movel"] },
  { id: "cliente.whatsapp", entity: "cliente", key: "whatsapp", label: "WhatsApp", type: "phone",
    aliases: ["whatsapp", "whats", "zap"] },
  { id: "cliente.data_cadastro", entity: "cliente", key: "data_cadastro", label: "Data de Cadastro", type: "date",
    aliases: ["data cadastro", "data de cadastro", "cadastrado em"] },
  { id: "cliente.categoria", entity: "cliente", key: "categoria", label: "Categoria", type: "text",
    aliases: ["categoria", "tipo cliente", "segmento"] },
  { id: "cliente.origem", entity: "cliente", key: "origem", label: "Origem", type: "text",
    aliases: ["origem", "como chegou", "fonte"] },
  { id: "cliente.situacao", entity: "cliente", key: "situacao", label: "Situação", type: "text",
    aliases: ["situacao cliente", "status cliente"] },

  // ===== ENDEREÇO =====
  { id: "endereco.logradouro", entity: "endereco", key: "logradouro", label: "Endereço", type: "text",
    aliases: ["endereco", "endereço", "logradouro", "rua", "avenida"] },
  { id: "endereco.numero", entity: "endereco", key: "numero", label: "Número", type: "text",
    aliases: ["numero", "número", "num"] },
  { id: "endereco.complemento", entity: "endereco", key: "complemento", label: "Complemento", type: "text",
    aliases: ["complemento", "compl"] },
  { id: "endereco.bairro", entity: "endereco", key: "bairro", label: "Bairro", type: "text",
    aliases: ["bairro"] },
  { id: "endereco.cidade", entity: "endereco", key: "cidade", label: "Cidade", type: "text",
    aliases: ["cidade", "municipio", "município", "localidade"] },
  { id: "endereco.estado", entity: "endereco", key: "estado", label: "Estado", type: "text",
    aliases: ["estado", "uf"] },
  { id: "endereco.cep", entity: "endereco", key: "cep", label: "CEP", type: "text",
    aliases: ["cep", "codigo postal"] },

  // ===== PROPRIEDADE =====
  { id: "propriedade.nome", entity: "propriedade", key: "nome", label: "Propriedade", type: "text",
    aliases: ["propriedade", "nome da propriedade", "fazenda", "chacara", "chácara", "sitio", "sítio", "imovel", "imóvel", "imovel rural", "estabelecimento"] },
  { id: "propriedade.tipo", entity: "propriedade", key: "tipo", label: "Tipo de Propriedade", type: "enum",
    aliases: ["tipo propriedade", "tipo imovel", "tipo de imovel"],
    enumValues: ["fazenda", "chacara", "sitio", "imovel", "urbano", "rural"] },
  { id: "propriedade.matricula", entity: "propriedade", key: "matricula", label: "Matrícula", type: "text",
    aliases: ["matricula", "matrícula"] },
  { id: "propriedade.car", entity: "propriedade", key: "car", label: "CAR", type: "text", aliases: ["car"] },
  { id: "propriedade.ccir", entity: "propriedade", key: "ccir", label: "CCIR", type: "text", aliases: ["ccir"] },
  { id: "propriedade.itr", entity: "propriedade", key: "itr", label: "ITR", type: "text", aliases: ["itr"] },
  { id: "propriedade.area", entity: "propriedade", key: "area", label: "Área", type: "number",
    aliases: ["area", "área", "area total", "área total", "hectares", "ha", "tamanho"] },
  { id: "propriedade.latitude", entity: "propriedade", key: "latitude", label: "Latitude", type: "geo",
    aliases: ["latitude", "lat"] },
  { id: "propriedade.longitude", entity: "propriedade", key: "longitude", label: "Longitude", type: "geo",
    aliases: ["longitude", "lng", "lon", "long"] },

  // ===== SERVIÇO =====
  { id: "servico.nome", entity: "servico", key: "nome", label: "Serviço", type: "text",
    aliases: ["servico", "serviço", "nome do servico", "nome do serviço", "descricao do servico"] },
  { id: "servico.tipo", entity: "servico", key: "tipo", label: "Tipo de Serviço", type: "text",
    aliases: ["tipo servico", "tipo de servico", "tipo de serviço"] },
  { id: "servico.categoria", entity: "servico", key: "categoria", label: "Categoria", type: "text",
    aliases: ["categoria", "categoria servico", "categoria do serviço"] },
  { id: "servico.subcategoria", entity: "servico", key: "subcategoria", label: "Subcategoria", type: "text",
    aliases: ["subcategoria", "sub categoria"] },
  { id: "servico.responsavel", entity: "servico", key: "responsavel", label: "Responsável", type: "text",
    aliases: ["responsavel", "responsável", "tecnico", "técnico", "executor"] },
  { id: "servico.status", entity: "servico", key: "status", label: "Status do Serviço", type: "enum",
    aliases: ["status servico", "situacao do servico", "situação do serviço"],
    enumValues: ["pendente", "em andamento", "concluido", "concluído", "cancelado"] },
  { id: "servico.data_inicio", entity: "servico", key: "data_inicio", label: "Data de Início", type: "date",
    aliases: ["data inicio", "data inicial", "data de inicio", "início"] },
  { id: "servico.data_fim", entity: "servico", key: "data_fim", label: "Data de Término", type: "date",
    aliases: ["data fim", "data final", "data de termino", "conclusão"] },

  // ===== ORÇAMENTO =====
  { id: "orcamento.codigo", entity: "orcamento", key: "codigo", label: "Código do Orçamento", type: "text",
    aliases: ["codigo", "código", "codigo orcamento", "numero orcamento", "id orcamento"] },
  { id: "orcamento.valor_orcado", entity: "orcamento", key: "valor_orcado", label: "Valor Orçado", type: "monetary",
    aliases: ["valor orcado", "valor orçado", "valor", "valor unitario"] },
  { id: "orcamento.desconto", entity: "orcamento", key: "desconto", label: "Desconto", type: "monetary",
    aliases: ["desconto", "abatimento"] },
  { id: "orcamento.impostos", entity: "orcamento", key: "impostos", label: "Impostos", type: "monetary",
    aliases: ["impostos", "imposto", "tributos"] },
  { id: "orcamento.valor_final", entity: "orcamento", key: "valor_final", label: "Valor Final", type: "monetary",
    aliases: ["valor final", "valor total", "total", "total geral"] },
  { id: "orcamento.forma_pagamento", entity: "orcamento", key: "forma_pagamento", label: "Forma de Pagamento", type: "enum",
    aliases: ["forma de pagamento", "forma pagamento", "meio de pagamento", "metodo de pagamento", "método de pagamento", "pagamento"],
    enumValues: ["pix", "boleto", "cartao", "cartão", "transferencia", "transferência", "dinheiro", "cheque"] },
  { id: "orcamento.situacao_pagamento", entity: "orcamento", key: "situacao_pagamento", label: "Situação do Pagamento", type: "enum",
    aliases: ["situacao do pagamento", "situação do pagamento", "status pagamento", "status financeiro", "status do pagamento"],
    enumValues: ["pago", "pendente", "cancelado", "em aberto", "atrasado", "parcial"] },
  { id: "orcamento.status", entity: "orcamento", key: "status", label: "Status do Orçamento", type: "enum",
    aliases: ["status orcamento", "status do orcamento", "situacao do orcamento", "situação do orçamento"],
    enumValues: ["aprovado", "recusado", "em analise", "em análise", "enviado", "pendente", "cancelado", "faturado"] },
  { id: "orcamento.data_emissao", entity: "orcamento", key: "data_emissao", label: "Data de Emissão", type: "date",
    aliases: ["data emissao", "data de emissão", "data orcamento", "data do orçamento"] },
  { id: "orcamento.data_vencimento", entity: "orcamento", key: "data_vencimento", label: "Data de Vencimento", type: "date",
    aliases: ["data vencimento", "vencimento", "data de vencimento"] },
  { id: "orcamento.data_faturamento", entity: "orcamento", key: "data_faturamento", label: "Data de Faturamento", type: "date",
    aliases: ["data faturamento", "data do faturamento"] },

  // ===== FINANCEIRO =====
  { id: "financeiro.receita", entity: "financeiro", key: "receita", label: "Receita", type: "monetary",
    aliases: ["receita"] },
  { id: "financeiro.receita_prevista", entity: "financeiro", key: "receita_prevista", label: "Receita Prevista", type: "monetary",
    aliases: ["receita prevista", "receita esperada", "previsao receita"] },
  { id: "financeiro.receita_realizada", entity: "financeiro", key: "receita_realizada", label: "Receita Realizada", type: "monetary",
    aliases: ["receita realizada", "faturamento", "valor recebido", "valor faturado", "valor pago"] },
  { id: "financeiro.custos", entity: "financeiro", key: "custos", label: "Custos", type: "monetary",
    aliases: ["custos", "custo total", "custo"] },
  { id: "financeiro.custos_variaveis", entity: "financeiro", key: "custos_variaveis", label: "Custos Variáveis", type: "monetary",
    aliases: ["custos variaveis", "custos variáveis"] },
  { id: "financeiro.custos_fixos", entity: "financeiro", key: "custos_fixos", label: "Custos Fixos", type: "monetary",
    aliases: ["custos fixos", "custo fixo"] },
  { id: "financeiro.despesas", entity: "financeiro", key: "despesas", label: "Despesas", type: "monetary",
    aliases: ["despesa", "despesas", "gastos", "custo operacional"] },
  { id: "financeiro.despesas_operacionais", entity: "financeiro", key: "despesas_operacionais", label: "Despesas Operacionais", type: "monetary",
    aliases: ["despesas operacionais", "opex"] },
  { id: "financeiro.impostos", entity: "financeiro", key: "impostos", label: "Impostos", type: "monetary",
    aliases: ["impostos pagos", "tributos pagos"] },
  { id: "financeiro.lucro_bruto", entity: "financeiro", key: "lucro_bruto", label: "Lucro Bruto", type: "monetary",
    aliases: ["lucro bruto", "margem bruta valor"] },
  { id: "financeiro.lucro_liquido", entity: "financeiro", key: "lucro_liquido", label: "Lucro Líquido", type: "monetary",
    aliases: ["lucro liquido", "lucro líquido", "resultado liquido"] },
  { id: "financeiro.margem", entity: "financeiro", key: "margem", label: "Margem", type: "percent",
    aliases: ["margem", "margem percentual", "margem %"] },
];

export const CANONICAL_BY_ID: Record<string, CanonicalField> =
  Object.fromEntries(CANONICAL_FIELDS.map(f => [f.id, f]));

export function fieldsByEntity(entity: CanonicalEntity): CanonicalField[] {
  return CANONICAL_FIELDS.filter(f => f.entity === entity);
}
