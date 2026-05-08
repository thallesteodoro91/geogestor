/**
 * Financial Column Classifier
 *
 * Receives spreadsheet headers and assigns a SEMANTIC ROLE to each one.
 * This is the brain of the import — it lets us distinguish, for example,
 * "valor recebido" (receita) from "valor pago" (despesa) and from
 * "valor orçado" (proposta), even though all three contain "valor".
 */

export type SemanticRole =
  | "receita_bruta"
  | "receita_liquida"
  | "valor_orcado"
  | "custo_obra"
  | "despesa_operacional"
  | "imposto"
  | "lucro_informado"
  | "margem_informada"
  | "pipeline"
  | "data_orcamento"
  | "data_despesa"
  | "cliente_nome"
  | "propriedade_nome"
  | "municipio"
  | "servico_nome"
  | "categoria_despesa"
  | "ignorar";

export interface ClassifiedColumn {
  header: string;
  role: SemanticRole;
  confidence: number; // 0..100
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-.*]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Rule = { role, anyOf, allOf?, notAny?, weight }
 * - matches when EVERY token in `allOf` is present AND at least one in `anyOf`
 *   AND none of `notAny` is present.
 */
interface Rule {
  role: SemanticRole;
  anyOf: string[];
  allOf?: string[];
  notAny?: string[];
  weight: number;
}

const RULES: Rule[] = [
  // === RECEITA ===
  { role: "receita_bruta", anyOf: ["receita bruta", "faturamento bruto"], weight: 100 },
  { role: "receita_bruta", anyOf: ["receita", "faturamento", "valor recebido", "recebimento", "valor faturado", "revenue"], notAny: ["liquid", "previs", "potenc", "esperad"], weight: 90 },
  { role: "receita_liquida", anyOf: ["receita liquida", "faturamento liquido", "net revenue"], weight: 100 },

  // === VALOR ORÇADO / PROPOSTA ===
  { role: "valor_orcado", anyOf: ["valor orcado", "valor proposta", "valor do orcamento", "valor unitario", "preco unitario", "preco do servico", "valor do servico", "valor contrato", "valor total", "valor global"], weight: 80 },
  { role: "valor_orcado", anyOf: ["preco", "valor", "vlr", "amount", "price"], notAny: ["custo", "despesa", "gasto", "pago", "saida", "imposto", "lucro", "margem", "previs", "potenc"], weight: 50 },

  // === CUSTO (variável, ligado ao serviço) ===
  { role: "custo_obra", anyOf: ["custo do servico", "custo da obra", "custo operacional", "custo total", "custo direto", "cost"], weight: 95 },
  { role: "custo_obra", anyOf: ["custo"], notAny: ["beneficio", "oportunidade"], weight: 80 },

  // === DESPESA OPERACIONAL ===
  { role: "despesa_operacional", anyOf: ["despesa operacional", "despesas fixas", "despesa fixa", "saida", "valor pago", "pagamento", "expense"], weight: 95 },
  { role: "despesa_operacional", anyOf: ["despesa", "despesas", "gasto", "gastos"], weight: 85 },

  // === IMPOSTOS ===
  { role: "imposto", anyOf: ["imposto", "impostos", "iss", "tributo", "taxa", "tax"], weight: 90 },

  // === LUCRO / MARGEM (apenas leitura, validação cruzada) ===
  { role: "lucro_informado", anyOf: ["lucro", "lucro liquido", "resultado", "profit", "lucratividade"], weight: 90 },
  { role: "margem_informada", anyOf: ["margem", "margem liquida", "margem bruta", "margin"], weight: 90 },

  // === PIPELINE ===
  { role: "pipeline", anyOf: ["previsao", "potencial", "negociacao", "pipeline", "forecast"], weight: 80 },

  // === DATAS ===
  { role: "data_orcamento", anyOf: ["data orcamento", "data do orcamento", "data proposta", "data emissao", "data faturamento", "data servico", "data inicio"], weight: 95 },
  { role: "data_despesa", anyOf: ["data despesa", "data da despesa", "data do gasto", "data pagamento"], weight: 95 },

  // === ENTIDADES ===
  { role: "cliente_nome", anyOf: ["cliente", "nome cliente", "razao social", "contratante", "proprietario", "dono", "responsavel"], weight: 95 },
  { role: "propriedade_nome", anyOf: ["propriedade", "fazenda", "sitio", "chacara", "imovel", "gleba", "terreno", "lote"], weight: 95 },
  { role: "municipio", anyOf: ["municipio", "cidade", "localidade"], weight: 90 },
  { role: "servico_nome", anyOf: ["servico", "projeto", "atividade", "trabalho", "tipo de servico"], weight: 85 },
  { role: "categoria_despesa", anyOf: ["categoria", "tipo de despesa", "natureza", "grupo despesa", "classificacao"], weight: 70 },
];

function ruleMatches(headerNorm: string, rule: Rule): boolean {
  if (rule.notAny?.some(t => headerNorm.includes(norm(t)))) return false;
  if (rule.allOf && !rule.allOf.every(t => headerNorm.includes(norm(t)))) return false;
  return rule.anyOf.some(t => headerNorm.includes(norm(t)));
}

export function classifyColumn(header: string): ClassifiedColumn {
  const h = norm(header);
  let best: { role: SemanticRole; weight: number } = { role: "ignorar", weight: 0 };

  for (const rule of RULES) {
    if (ruleMatches(h, rule) && rule.weight > best.weight) {
      best = { role: rule.role, weight: rule.weight };
    }
  }

  return { header, role: best.role, confidence: best.weight };
}

export function classifyHeaders(headers: string[]): ClassifiedColumn[] {
  return headers.map(classifyColumn);
}

/**
 * Classify a free-text expense category into VARIAVEL/FIXA.
 * Used when auto-creating dim_tipodespesa during import.
 */
export function classifyExpenseCategory(label: string): "VARIAVEL" | "FIXA" {
  const h = norm(label);
  const variavelKeys = ["combustivel", "material", "insumo", "diaria", "frete", "deslocamento", "campo", "produto", "mercadoria"];
  if (variavelKeys.some(k => h.includes(k))) return "VARIAVEL";
  return "FIXA";
}
