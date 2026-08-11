import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { isValidCnpj, isValidCpf } from '@geogestor/contracts';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from './audit.service';
import { FileSystemOutboxService } from './filesystem-outbox.service';
import { OperationalLogService } from './operational-log.service';

export type FullImportInput = {
  fileName: string;
  fileHash: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  sheetName?: string;
  firstDataRow?: number;
  mappingOverrides?: Record<string, string | null>;
  clientTimings?: { readingMs: number; hashingMs: number };
};

export type ImportIssueSeverity = 'info' | 'warning' | 'ambiguous' | 'blocking' | 'historical';

export type ImportIssue = {
  row: number | null;
  field: string | null;
  severity: ImportIssueSeverity;
  message: string;
};

type ColumnClassification = 'client' | 'historical' | 'property' | 'expense' | 'budget' | 'billing' | 'project';

type HeaderDefinition = {
  key: string;
  label: string;
  classification: ColumnClassification;
  aliases?: string[];
};

export const FULL_IMPORT_HEADERS: HeaderDefinition[] = [
  { key: 'cliente', label: 'Cliente', classification: 'client', aliases: ['nome do cliente', 'nome cliente', 'razao social', 'contratante', 'tomador', 'empresa cliente'] },
  { key: 'idade', label: 'Idade', classification: 'client' },
  { key: 'cpf', label: 'CPF', classification: 'client' },
  { key: 'cnpj', label: 'CNPJ', classification: 'client' },
  { key: 'endereco', label: 'Endereço', classification: 'client', aliases: ['endereco completo'] },
  { key: 'telefone', label: 'Telefone', classification: 'client', aliases: ['celular', 'whatsapp', 'fone', 'contato telefonico'] },
  { key: 'email', label: 'Email', classification: 'client', aliases: ['e-mail'] },
  { key: 'dataCadastro', label: 'Data_Cadastro', classification: 'client', aliases: ['data cadastro', 'data de cadastro'] },
  { key: 'tipoCliente', label: 'Tipo de Cliente', classification: 'client', aliases: ['categoria do cliente'] },
  { key: 'indicacao', label: 'Indicação', classification: 'client', aliases: ['origem', 'indicado por'] },
  { key: 'situacaoCliente', label: 'Situação do Cliente', classification: 'client', aliases: ['status do cliente'] },
  { key: 'receita', label: 'Receita', classification: 'historical' },
  { key: 'custo', label: 'Custo', classification: 'historical' },
  { key: 'despesasHistoricas', label: 'Despesas', classification: 'historical', aliases: ['despesas historicas'] },
  { key: 'lucroBruto', label: 'Lucro Bruto', classification: 'historical' },
  { key: 'lucroLiquido', label: 'Lucro Líquido', classification: 'historical' },
  { key: 'margemContribuicao', label: 'Margem de Contribuição', classification: 'historical' },
  { key: 'pontoEquilibrio', label: 'Ponto de Equilíbrio', classification: 'historical' },
  { key: 'custosVariaveis', label: 'Custos Variáveis', classification: 'historical' },
  { key: 'nomePropriedade', label: 'Nome da Propriedade', classification: 'property', aliases: ['propriedade', 'imovel'] },
  { key: 'cidade', label: 'Cidade', classification: 'property', aliases: ['municipio'] },
  { key: 'areaHa', label: 'Área_ha', classification: 'property', aliases: ['area ha', 'area hectare', 'area hectares'] },
  { key: 'tipoPropriedade', label: 'Tipo de Propriedade', classification: 'property', aliases: ['tipo do imovel'] },
  { key: 'observacoes', label: 'Observações', classification: 'property' },
  { key: 'latitude', label: 'Latitude', classification: 'property' },
  { key: 'longitude', label: 'Longitude', classification: 'property' },
  { key: 'situacaoImovel', label: 'Situação do Imóvel', classification: 'property' },
  { key: 'tipoDocumento', label: 'Tipo de Documento', classification: 'property' },
  { key: 'documentacao', label: 'Documentação', classification: 'property' },
  { key: 'averbacao', label: 'Averbação', classification: 'property' },
  { key: 'usucapiao', label: 'Usucapião', classification: 'property' },
  { key: 'car', label: 'CAR', classification: 'property' },
  { key: 'matricula', label: 'Nº da Matrícula', classification: 'property', aliases: ['№ da matrícula', 'numero da matricula', 'n da matricula'] },
  { key: 'ccir', label: 'CCIR', classification: 'property' },
  { key: 'memorialDescritivo', label: 'Memorial Descritivo', classification: 'property' },
  { key: 'declaracaoConfrontantes', label: 'Declaração de Confrontantes', classification: 'property' },
  { key: 'solicitacaoRegistroGeorref', label: 'Solicitação de Registro de Georref.', classification: 'property', aliases: ['solicitacao de registro de georreferenciamento', 'registro de georreferenciamento'] },
  { key: 'itr', label: 'ITR', classification: 'property' },
  { key: 'situacaoDocumento', label: 'Situação do Documento', classification: 'property' },
  { key: 'marco', label: 'Marco', classification: 'property' },
  { key: 'categoriaGasto', label: 'Categoria de Gasto', classification: 'expense' },
  { key: 'subcategoriaGasto', label: 'SubCategoria de Gasto', classification: 'expense', aliases: ['subcategoria de gasto'] },
  { key: 'valorDespesa', label: 'Valor da Despesa', classification: 'expense', aliases: ['valor gasto', 'gasto', 'custo do projeto', 'desembolso'] },
  { key: 'dataDespesa', label: 'Data da Despesa', classification: 'expense' },
  { key: 'valorUnitario', label: 'Valor Unitário', classification: 'budget' },
  { key: 'quantidade', label: 'Quantidade', classification: 'budget' },
  { key: 'valorImposto', label: 'Valor Imposto', classification: 'budget', aliases: ['imposto previsto'] },
  { key: 'receitaEsperada', label: 'Receita Esperada', classification: 'budget' },
  { key: 'lucroEsperado', label: 'Lucro Esperado', classification: 'budget' },
  { key: 'margemEsperada', label: 'Margem Esperada', classification: 'budget' },
  { key: 'receitaEsperadaImposto', label: 'Receita Esperada + Imposto', classification: 'budget', aliases: ['receita esperada com imposto', 'receita esperada mais imposto'] },
  { key: 'desconto', label: 'Desconto', classification: 'budget' },
  { key: 'dataOrcamento', label: 'Data_Orcamento', classification: 'budget', aliases: ['data orcamento', 'data do orcamento'] },
  { key: 'receitaRealizada', label: 'Receita Realizada', classification: 'historical' },
  { key: 'orcamentoConvertido', label: 'Orçamento Convertido', classification: 'budget' },
  { key: 'dataFaturamento', label: 'Data do Faturamento', classification: 'billing' },
  { key: 'valorFaturado', label: 'Valor Faturado', classification: 'billing', aliases: ['valor cobrado', 'preco cobrado', 'total faturado', 'faturamento'] },
  { key: 'situacaoPagamento', label: 'Situação do Pagamento', classification: 'billing' },
  { key: 'formaPagamento', label: 'Forma de Pagamento', classification: 'billing' },
  { key: 'situacaoServico', label: 'Situação do Serviço', classification: 'project' },
  { key: 'projeto', label: 'Projeto', classification: 'project', aliases: ['nome do projeto', 'servico', 'trabalho', 'obra', 'contrato'] },
  { key: 'categoriaProjeto', label: 'Categoria do Projeto', classification: 'project', aliases: ['tipo do projeto'] },
  { key: 'dataServicoInicio', label: 'Data do Serviço (Início)', classification: 'project', aliases: ['data de inicio do servico', 'inicio do servico'] },
  { key: 'dataServicoFim', label: 'Data do Serviço (Fim)', classification: 'project', aliases: ['data de fim do servico', 'fim do servico'] }
];

const HISTORICAL_TOTALS = [
  ['receita', 'Receita histórica'],
  ['custo', 'Custo histórico'],
  ['despesasHistoricas', 'Despesas históricas'],
  ['valorDespesa', 'Despesas transacionais'],
  ['receitaEsperada', 'Receita esperada'],
  ['valorImposto', 'Impostos previstos'],
  ['receitaEsperadaImposto', 'Receita esperada com impostos'],
  ['lucroEsperado', 'Lucro esperado'],
  ['receitaRealizada', 'Receita realizada'],
  ['valorFaturado', 'Valor faturado']
] as const;

const YES = new Set(['sim', 's', 'yes', 'true', '1']);
const NO = new Set(['nao', 'n', 'no', 'false', '0']);

export function normalizeImportHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/№/g, ' numero ')
    .replace(/[º°]/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/\b(nro|num)\b/g, 'numero')
    .replace(/\b(vlr|vl)\b/g, 'valor')
    .replace(/\b(dt)\b/g, 'data')
    .replace(/\b(qtd|qtde)\b/g, 'quantidade')
    .replace(/\b(cli)\b/g, 'cliente')
    .replace(/\b(proj)\b/g, 'projeto')
    .replace(/\b(prop)\b/g, 'propriedade')
    .replace(/\b(obs)\b/g, 'observacoes')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const aliasLookup = new Map<string, HeaderDefinition>();
const aliasesByDefinition = new Map<string, string[]>();
for (const definition of FULL_IMPORT_HEADERS) {
  const aliases = [definition.label, definition.key, ...(definition.aliases ?? [])]
    .map(normalizeImportHeader)
    .filter(Boolean);
  aliasesByDefinition.set(definition.key, aliases);
  for (const alias of aliases) {
    aliasLookup.set(alias, definition);
  }
}

type RecognitionMethod = 'manual' | 'exact' | 'semantic';

function semanticScore(source: string, alias: string) {
  if (!source || !alias) return 0;
  if (source === alias) return 1;
  const sourceTokens = new Set(source.split(' '));
  const aliasTokens = new Set(alias.split(' '));
  const intersection = [...sourceTokens].filter(token => aliasTokens.has(token)).length;
  const union = new Set([...sourceTokens, ...aliasTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const contained = Math.min(source.length, alias.length) >= 5 && (source.includes(alias) || alias.includes(source));
  return contained ? Math.max(0.88, jaccard) : jaccard;
}

function semanticMatch(source: string) {
  const normalized = normalizeImportHeader(source);
  const exact = aliasLookup.get(normalized);
  if (exact) return { definition: exact, confidence: 1, method: 'exact' as const };

  const candidates = FULL_IMPORT_HEADERS.map(definition => ({
    definition,
    score: Math.max(...(aliasesByDefinition.get(definition.key) ?? []).map(alias => semanticScore(normalized, alias)), 0)
  })).sort((left, right) => right.score - left.score);
  const [best, second] = candidates;
  if (!best || best.score < 0.86 || (second && best.score - second.score < 0.08)) return null;
  return { definition: best.definition, confidence: Number(best.score.toFixed(2)), method: 'semantic' as const };
}

function recognizeHeaders(headers: string[], overrides: Record<string, string | null> = {}) {
  const recognized: Array<{ source: string; field: string; label: string; classification: ColumnClassification; confidence: number; method: RecognitionMethod }> = [];
  const unrecognized: string[] = [];
  const ignored: string[] = [];
  const sourceByKey = new Map<string, string>();
  const duplicates: string[] = [];

  const add = (source: string, match: HeaderDefinition, confidence: number, method: RecognitionMethod) => {
    if (sourceByKey.has(match.key)) {
      duplicates.push(source);
      return;
    }
    sourceByKey.set(match.key, source);
    recognized.push({ source, field: match.key, label: match.label, classification: match.classification, confidence, method });
  };

  // Manual choices are authoritative and reserve their destination before suggestions run.
  for (const source of headers) {
    if (!Object.prototype.hasOwnProperty.call(overrides, source)) continue;
    const field = overrides[source];
    if (field === null || field === '') ignored.push(source);
    else {
      const match = FULL_IMPORT_HEADERS.find(definition => definition.key === field);
      if (match) add(source, match, 1, 'manual');
      else unrecognized.push(source);
    }
  }

  for (const source of headers) {
    if (Object.prototype.hasOwnProperty.call(overrides, source)) continue;
    const match = semanticMatch(source);
    if (!match) unrecognized.push(source);
    else add(source, match.definition, match.confidence, match.method);
  }
  return { recognized, unrecognized, ignored, duplicates, sourceByKey };
}

function cell(row: Record<string, unknown>, sourceByKey: Map<string, string>, key: string) {
  const source = sourceByKey.get(key);
  return source ? row[source] : null;
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizedIdentity(value: unknown) {
  return normalizeImportHeader(value).replace(/\s/g, '');
}

export function normalizeNationalPhone(value: unknown) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

export function excelDateToIso(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const brazilian = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function decimalString(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : null;
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(/^R\$/i, '').replace(/%$/, '');
  if (!raw) return null;
  const negative = raw.startsWith('-');
  let unsigned = raw.replace(/^[+-]/, '').replace(/[^\d.,]/g, '');
  if (!unsigned) return null;
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalMark = lastComma > lastDot ? ',' : '.';
    const thousandsMark = decimalMark === ',' ? /\./g : /,/g;
    unsigned = unsigned.replace(thousandsMark, '').replace(decimalMark, '.');
  } else if (lastComma >= 0) {
    unsigned = unsigned.replace(/\./g, '').replace(',', '.');
  } else if ((unsigned.match(/\./g) ?? []).length > 1) {
    unsigned = unsigned.replace(/\./g, '');
  }
  return `${negative ? '-' : ''}${unsigned}`;
}

export function moneyToCents(value: unknown) {
  const decimal = decimalString(value);
  if (!decimal) return 0;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal);
  if (!match) return 0;
  const [, sign, whole, fraction = ''] = match;
  const padded = `${fraction}000`;
  let cents = BigInt(whole) * 100n + BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  if (sign) cents *= -1n;
  const result = Number(cents);
  return Number.isSafeInteger(result) ? result : 0;
}

function numericValue(value: unknown) {
  const decimal = decimalString(value);
  if (!decimal) return null;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanIndicator(value: unknown) {
  const normalized = normalizeImportHeader(value);
  if (YES.has(normalized)) return true;
  if (NO.has(normalized)) return false;
  return null;
}

function identifierValue(value: unknown) {
  const raw = textValue(value);
  return raw && booleanIndicator(raw) === null ? raw : null;
}

function projectStatus(value: unknown) {
  const normalized = normalizeImportHeader(value);
  if (normalized === 'concluido' || normalized === 'finalizado') return 'Concluído';
  if (normalized === 'cancelado') return 'Cancelado';
  return 'Em Andamento';
}

function clientStatus(value: unknown) {
  return normalizeImportHeader(value) === 'inativo' ? 'Inativo' : 'Ativo';
}

function billingStatus(value: unknown) {
  const normalized = normalizeImportHeader(value);
  if (normalized === 'cancelado') return 'cancelada';
  if (normalized === 'faturado') return 'emitida';
  return 'pendente';
}

function rowNote(line: number, fields: Array<[string, unknown]>) {
  const details = fields.flatMap(([label, value]) => textValue(value) ? [`${label}: ${textValue(value)}`] : []);
  return details.length ? `Migração completa — linha ${line}. ${details.join(' | ')}` : `Migração completa — linha ${line}.`;
}

type PreparedRow = {
  line: number;
  raw: Record<string, unknown>;
  clientKey: string;
  client: {
    name: string;
    type: 'PF' | 'PJ' | null;
    cpf: string | null;
    cnpj: string | null;
    normalizedDocument: string | null;
    documentValid: boolean;
    email: string | null;
    phone: string | null;
    address: string | null;
    registeredAt: string | null;
    category: string | null;
    origin: string | null;
    status: string;
    notes: string;
  };
  property: null | {
    key: string;
    name: string;
    areaHa: number | null;
    registration: string | null;
    car: string | null;
    ccir: string | null;
    itr: string | null;
    municipality: string | null;
    situation: string | null;
    latitude: number | null;
    longitude: number | null;
    notes: string;
  };
  project: null | {
    key: string;
    name: string;
    category: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    notes: string;
  };
  budget: null | {
    total: number;
    expectedRevenue: number;
    tax: number;
    expectedProfit: number;
    expectedMarginBp: number | null;
    discount: number;
    unitValue: number;
    quantity: number;
    date: string | null;
    approved: boolean;
    originalConversion: string | null;
    paymentMethod: string | null;
  };
  billing: null | { value: number; date: string | null; status: string; originalStatus: string | null };
  expense: null | { value: number; date: string | null; category: string; subcategory: string | null };
};

type ExistingClient = typeof schema.clientes.$inferSelect;

type PreparedMigration = {
  input: FullImportInput;
  sourceByKey: Map<string, string>;
  rows: PreparedRow[];
  issues: ImportIssue[];
  headers: ReturnType<typeof recognizeHeaders>;
  existingClients: Map<string, ExistingClient>;
  totals: Record<string, number>;
};

function clientLookupKeys(client: ExistingClient) {
  const keys: string[] = [];
  if (client.documentoNormalizado) keys.push(`doc:${client.documentoNormalizado}`);
  if (client.nome) keys.push(`name:${normalizedIdentity(client.nome)}`);
  return keys;
}

async function prepare(input: FullImportInput, database: typeof db = db): Promise<PreparedMigration> {
  const headers = recognizeHeaders(input.headers, input.mappingOverrides);
  const issues: ImportIssue[] = [];
  if (headers.unrecognized.length) {
    issues.push({ row: null, field: null, severity: 'warning', message: `${headers.unrecognized.length} coluna(s) não reconhecida(s) não serão descartadas: elas serão preservadas no snapshot da migração.` });
  }
  if (headers.duplicates.length) {
    issues.push({ row: null, field: null, severity: 'blocking', message: `Mais de uma coluna foi associada ao mesmo campo: ${headers.duplicates.join(', ')}. Escolha apenas uma origem para cada campo.` });
  }
  for (const suggestion of headers.recognized.filter(column => column.method === 'semantic')) {
    issues.push({
      row: null,
      field: suggestion.field,
      severity: 'blocking',
      message: `Confirme se a coluna “${suggestion.source}” corresponde a “${suggestion.label}”. A sugestão não será gravada sem sua confirmação.`
    });
  }
  if (!headers.sourceByKey.has('cliente')) {
    issues.push({ row: null, field: 'cliente', severity: 'blocking', message: 'A coluna de cliente não foi reconhecida.' });
  }
  for (const definition of FULL_IMPORT_HEADERS) {
    if (definition.classification === 'historical' && headers.sourceByKey.has(definition.key)) {
      issues.push({ row: null, field: definition.key, severity: 'historical', message: `${definition.label} será preservado como indicador histórico e não criará lançamento financeiro.` });
    }
  }

  const currentClients = await database.select().from(schema.clientes).where(isNull(schema.clientes.deletedAt));
  const existingClients = new Map<string, ExistingClient>();
  for (const current of currentClients) for (const key of clientLookupKeys(current)) {
    if (!existingClients.has(key)) existingClients.set(key, current);
  }

  const rows: PreparedRow[] = [];
  const documentNames = new Map<string, Map<string, number[]>>();
  const totals: Record<string, number> = Object.fromEntries(HISTORICAL_TOTALS.map(([key]) => [key, 0]));

  for (const [index, raw] of input.rows.entries()) {
    const line = index + (input.firstDataRow ?? 2);
    const name = textValue(cell(raw, headers.sourceByKey, 'cliente'));
    if (!name) {
      issues.push({ row: line, field: 'cliente', severity: 'blocking', message: 'Informe o nome ou a razão social do cliente.' });
      continue;
    }
    const cpf = textValue(cell(raw, headers.sourceByKey, 'cpf'));
    const cnpj = textValue(cell(raw, headers.sourceByKey, 'cnpj'));
    const type = cpf ? 'PF' as const : cnpj ? 'PJ' as const : null;
    const document = String(cpf || cnpj || '').replace(/\D/g, '') || null;
    const documentValid = cpf ? isValidCpf(cpf) : cnpj ? isValidCnpj(cnpj) : false;
    const normalizedDocument = documentValid ? document : null;
    const nameKey = normalizedIdentity(name);
    const clientKey = normalizedDocument ? `doc:${normalizedDocument}` : `name:${nameKey}`;
    if (document) {
      const names = documentNames.get(document) ?? new Map<string, number[]>();
      names.set(nameKey, [...(names.get(nameKey) ?? []), line]);
      documentNames.set(document, names);
    }
    if (document && !documentValid) {
      issues.push({ row: line, field: type === 'PF' ? 'cpf' : 'cnpj', severity: 'warning', message: `${type ?? 'Documento'} inválido. O cliente será mantido com revisão cadastral e sem união automática pelo documento.` });
    }
    if (!document) {
      issues.push({ row: line, field: 'documento', severity: 'warning', message: 'Documento ausente. O cliente será identificado pelo nome e ficará marcado para revisão cadastral.' });
    }
    if (normalizedDocument && existingClients.has(`doc:${normalizedDocument}`)) {
      issues.push({ row: line, field: 'documento', severity: 'info', message: 'Documento já existente no GeoGestor. O cadastro correspondente será reutilizado ou atualizado após a conferência.' });
    }
    const rawPhone = cell(raw, headers.sourceByKey, 'telefone');
    const phone = normalizeNationalPhone(rawPhone);
    if (textValue(rawPhone) && !phone) {
      issues.push({ row: line, field: 'telefone', severity: 'warning', message: 'Telefone inválido. Use DDD e 10 ou 11 dígitos nacionais; o +55 não será adicionado.' });
    }
    const propertyName = textValue(cell(raw, headers.sourceByKey, 'nomePropriedade'));
    const registration = identifierValue(cell(raw, headers.sourceByKey, 'matricula'));
    const propertyKey = propertyName || registration
      ? `${clientKey}:${registration ? `mat:${normalizedIdentity(registration)}` : `name:${normalizedIdentity(propertyName)}`}`
      : null;
    const projectName = textValue(cell(raw, headers.sourceByKey, 'projeto'));
    const startDate = excelDateToIso(cell(raw, headers.sourceByKey, 'dataServicoInicio'));
    const projectKey = projectName ? `${clientKey}:${normalizedIdentity(projectName)}:${startDate ?? ''}` : null;
    const expenseValue = moneyToCents(cell(raw, headers.sourceByKey, 'valorDespesa'));
    const expectedRevenue = moneyToCents(cell(raw, headers.sourceByKey, 'receitaEsperada'));
    const tax = moneyToCents(cell(raw, headers.sourceByKey, 'valorImposto'));
    const historicalTotal = moneyToCents(cell(raw, headers.sourceByKey, 'receitaEsperadaImposto'));
    const unitValue = moneyToCents(cell(raw, headers.sourceByKey, 'valorUnitario'));
    const quantity = numericValue(cell(raw, headers.sourceByKey, 'quantidade')) ?? 1;
    const budgetTotal = historicalTotal || expectedRevenue + tax || Math.round(unitValue * quantity);
    const billedValue = moneyToCents(cell(raw, headers.sourceByKey, 'valorFaturado'));
    const billingDate = excelDateToIso(cell(raw, headers.sourceByKey, 'dataFaturamento'));
    const paymentStatus = textValue(cell(raw, headers.sourceByKey, 'situacaoPagamento'));
    if (billedValue > 0 && !billingDate) {
      issues.push({ row: line, field: 'dataFaturamento', severity: 'warning', message: 'O valor faturado será preservado, mas a data de faturamento está ausente ou inválida.' });
    }
    if (billedValue > 0) {
      issues.push({ row: line, field: 'situacaoPagamento', severity: 'info', message: 'Faturamento não será tratado como recebimento. Nenhuma entrada será criada no fluxo de caixa sem data e valor efetivamente recebidos.' });
    }
    const expenseCategory = textValue(cell(raw, headers.sourceByKey, 'categoriaGasto'));
    const expenseSubcategory = textValue(cell(raw, headers.sourceByKey, 'subcategoriaGasto'));
    if (expenseValue > 0 && !expenseCategory && !expenseSubcategory) {
      issues.push({ row: line, field: 'categoriaGasto', severity: 'warning', message: 'Despesa sem categoria: será classificada como “Outros — revisão necessária”.' });
    }
    const endDate = excelDateToIso(cell(raw, headers.sourceByKey, 'dataServicoFim'));
    if (startDate && endDate && endDate < startDate) {
      issues.push({ row: line, field: 'dataServicoFim', severity: 'blocking', message: 'A data final do serviço é anterior à data inicial.' });
    }

    for (const [key] of HISTORICAL_TOTALS) totals[key] += moneyToCents(cell(raw, headers.sourceByKey, key));

    const documentChecklist: Array<[string, unknown]> = [
      ['Tipo de propriedade', cell(raw, headers.sourceByKey, 'tipoPropriedade')],
      ['Tipo de documento', cell(raw, headers.sourceByKey, 'tipoDocumento')],
      ['Documentação', cell(raw, headers.sourceByKey, 'documentacao')],
      ['Averbação', cell(raw, headers.sourceByKey, 'averbacao')],
      ['Usucapião', cell(raw, headers.sourceByKey, 'usucapiao')],
      ['CAR', cell(raw, headers.sourceByKey, 'car')],
      ['CCIR', cell(raw, headers.sourceByKey, 'ccir')],
      ['Memorial descritivo', cell(raw, headers.sourceByKey, 'memorialDescritivo')],
      ['Declaração de confrontantes', cell(raw, headers.sourceByKey, 'declaracaoConfrontantes')],
      ['Solicitação de registro de georreferenciamento', cell(raw, headers.sourceByKey, 'solicitacaoRegistroGeorref')],
      ['ITR', cell(raw, headers.sourceByKey, 'itr')],
      ['Situação documental', cell(raw, headers.sourceByKey, 'situacaoDocumento')],
      ['Marco', cell(raw, headers.sourceByKey, 'marco')]
    ];
    rows.push({
      line,
      raw,
      clientKey,
      client: {
        name,
        type,
        cpf,
        cnpj,
        normalizedDocument,
        documentValid,
        email: textValue(cell(raw, headers.sourceByKey, 'email')),
        phone,
        address: textValue(cell(raw, headers.sourceByKey, 'endereco')),
        registeredAt: excelDateToIso(cell(raw, headers.sourceByKey, 'dataCadastro')),
        category: textValue(cell(raw, headers.sourceByKey, 'tipoCliente')),
        origin: textValue(cell(raw, headers.sourceByKey, 'indicacao')),
        status: clientStatus(cell(raw, headers.sourceByKey, 'situacaoCliente')),
        notes: rowNote(line, [['Idade informada', cell(raw, headers.sourceByKey, 'idade')]])
      },
      property: propertyKey ? {
        key: propertyKey,
        name: propertyName || `Imóvel da linha ${line}`,
        areaHa: numericValue(cell(raw, headers.sourceByKey, 'areaHa')),
        registration,
        car: identifierValue(cell(raw, headers.sourceByKey, 'car')),
        ccir: identifierValue(cell(raw, headers.sourceByKey, 'ccir')),
        itr: identifierValue(cell(raw, headers.sourceByKey, 'itr')),
        municipality: textValue(cell(raw, headers.sourceByKey, 'cidade')),
        situation: textValue(cell(raw, headers.sourceByKey, 'situacaoImovel')),
        latitude: numericValue(cell(raw, headers.sourceByKey, 'latitude')),
        longitude: numericValue(cell(raw, headers.sourceByKey, 'longitude')),
        notes: [textValue(cell(raw, headers.sourceByKey, 'observacoes')), rowNote(line, documentChecklist)].filter(Boolean).join('\n')
      } : null,
      project: projectKey ? {
        key: projectKey,
        name: projectName!,
        category: textValue(cell(raw, headers.sourceByKey, 'categoriaProjeto')),
        status: projectStatus(cell(raw, headers.sourceByKey, 'situacaoServico')),
        startDate,
        endDate,
        notes: rowNote(line, [['Situação original do serviço', cell(raw, headers.sourceByKey, 'situacaoServico')]])
      } : null,
      budget: budgetTotal > 0 ? {
        total: budgetTotal,
        expectedRevenue,
        tax,
        expectedProfit: moneyToCents(cell(raw, headers.sourceByKey, 'lucroEsperado')),
        expectedMarginBp: numericValue(cell(raw, headers.sourceByKey, 'margemEsperada')) === null ? null : Math.round((numericValue(cell(raw, headers.sourceByKey, 'margemEsperada')) ?? 0) * 100),
        discount: moneyToCents(cell(raw, headers.sourceByKey, 'desconto')),
        unitValue,
        quantity,
        date: excelDateToIso(cell(raw, headers.sourceByKey, 'dataOrcamento')),
        approved: booleanIndicator(cell(raw, headers.sourceByKey, 'orcamentoConvertido')) === true,
        originalConversion: textValue(cell(raw, headers.sourceByKey, 'orcamentoConvertido')),
        paymentMethod: textValue(cell(raw, headers.sourceByKey, 'formaPagamento'))
      } : null,
      billing: billedValue > 0 ? { value: billedValue, date: billingDate, status: billingStatus(paymentStatus), originalStatus: paymentStatus } : null,
      expense: expenseValue > 0 ? {
        value: expenseValue,
        date: excelDateToIso(cell(raw, headers.sourceByKey, 'dataDespesa')),
        category: expenseCategory || 'Outros — revisão necessária',
        subcategory: expenseSubcategory
      } : null
    });
  }

  for (const names of documentNames.values()) {
    const lines = [...names.values()].flat().sort((a, b) => a - b);
    if (names.size === 1 && lines.length > 1) {
      issues.push({ row: lines[0], field: 'documento', severity: 'info', message: `Documento repetido para o mesmo cliente nas linhas ${lines.join(', ')}. O cadastro será reutilizado sem duplicação.` });
      continue;
    }
    if (names.size <= 1) continue;
    for (const line of lines) issues.push({
      row: line,
      field: 'documento',
      severity: 'blocking',
      message: `O mesmo CPF/CNPJ aparece associado a nomes diferentes nas linhas ${lines.join(', ')}. Corrija a planilha antes de confirmar.`
    });
  }
  return { input, sourceByKey: headers.sourceByKey, rows, issues, headers, existingClients, totals };
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function reconciliation(totals: Record<string, number>, imported = totals) {
  return HISTORICAL_TOTALS.map(([key, label]) => {
    const source = totals[key] ?? 0;
    const target = imported[key] ?? 0;
    const difference = target - source;
    return { key, label, spreadsheet: source, imported: target, difference, status: difference === 0 ? 'Conciliado' : 'Divergente', historical: ['receita', 'custo', 'despesasHistoricas', 'receitaRealizada'].includes(key) };
  });
}

function previewFromPrepared(prepared: PreparedMigration, alreadyImported: boolean) {
  const clients = uniqueBy(prepared.rows, (row) => row.clientKey);
  const properties = uniqueBy(prepared.rows.flatMap((row) => row.property ? [{ ...row.property, clientKey: row.clientKey }] : []), (item) => item.key);
  const projects = uniqueBy(prepared.rows.flatMap((row) => row.project ? [{ ...row.project, clientKey: row.clientKey }] : []), (item) => item.key);
  const clientsUpdated = clients.filter((row) => prepared.existingClients.has(row.clientKey) || prepared.existingClients.has(`name:${normalizedIdentity(row.client.name)}`)).length;
  const blocking = prepared.issues.filter((issue) => issue.severity === 'blocking').length;
  const warnings = prepared.issues.filter((issue) => issue.severity === 'warning' || issue.severity === 'ambiguous').length;
  return {
    importId: crypto.randomUUID(),
    fileName: prepared.input.fileName,
    sheetName: prepared.input.sheetName,
    fileHash: prepared.input.fileHash,
    status: alreadyImported ? 'already_imported' : blocking ? 'blocked' : 'ready',
    counts: {
      rowsRead: prepared.input.rows.length,
      clientsCreated: clients.length - clientsUpdated,
      clientsUpdated,
      invalidDocuments: prepared.issues.filter((issue) => issue.field === 'cpf' || issue.field === 'cnpj').length,
      duplicateDocuments: prepared.issues.filter((issue) => issue.field === 'documento' && issue.severity === 'blocking').length,
      properties: properties.length,
      projects: projects.length,
      budgets: prepared.rows.filter((row) => row.budget).length,
      billings: prepared.rows.filter((row) => row.billing).length,
      receivables: 0,
      receipts: 0,
      expenses: prepared.rows.filter((row) => row.expense).length,
      partial: new Set(prepared.issues.filter((issue) => issue.row && issue.severity !== 'info' && issue.severity !== 'historical').map((issue) => issue.row)).size,
      warnings,
      blocking
    },
    columns: {
      expected: FULL_IMPORT_HEADERS.length,
      sourceTotal: prepared.input.headers.length,
      sources: prepared.input.headers,
      availableFields: FULL_IMPORT_HEADERS.map(({ key, label, classification }) => ({ key, label, classification })),
      selectedMapping: Object.fromEntries(prepared.input.headers.map(source => [
        source,
        prepared.headers.recognized.find(column => column.source === source)?.field
          ?? prepared.input.mappingOverrides?.[source]
          ?? null
      ])),
      recognized: prepared.headers.recognized,
      unrecognized: prepared.headers.unrecognized,
      ignored: prepared.headers.ignored,
      duplicateAliases: prepared.headers.duplicates
    },
    issues: prepared.issues,
    reconciliation: reconciliation(prepared.totals),
    limitations: [
      'Receita, custo, despesas agregadas, lucros, margens, ponto de equilíbrio, custos variáveis e receita realizada serão snapshots históricos.',
      'Valor faturado não será considerado recebido. A planilha não informa data nem valor efetivamente recebido.',
      'Nenhuma parcela será criada sem data de vencimento. O faturamento permanecerá registrado e pendente de revisão financeira.',
      'Indicadores Sim/Não de CAR, CCIR, ITR e demais documentos serão preservados como checklist; nenhum arquivo ou identificador será inventado.'
    ]
  };
}

function ledgerKey(fileHash: string) {
  return `full-spreadsheet-import:${fileHash}`;
}

export async function previewFullSpreadsheetImport(input: FullImportInput, database: typeof db = db) {
  const prepared = await prepare(input, database);
  const existing = await database.select({ id: schema.configuracoesOperacionais.id }).from(schema.configuracoesOperacionais)
    .where(eq(schema.configuracoesOperacionais.chave, ledgerKey(input.fileHash))).limit(1);
  return previewFromPrepared(prepared, existing.length > 0);
}

function mergeNotes(current: string | null, added: string) {
  if (!current) return added;
  return current.includes(added) ? current : `${current}\n${added}`;
}

function sourceRef(hash: string, line: number) {
  return `migração:${hash.slice(0, 12)}:linha:${line}`;
}

export async function commitFullSpreadsheetImport(input: FullImportInput, database: typeof db = db) {
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();
  const prepared = await prepare(input, database);
  const preview = previewFromPrepared(prepared, false);
  if (preview.counts.blocking > 0) {
    const error = new Error('A importação possui erros impeditivos. Corrija as linhas indicadas e gere uma nova prévia.') as Error & { statusCode?: number; preview?: unknown };
    error.statusCode = 422;
    error.preview = preview;
    throw error;
  }
  const now = new Date().toISOString();
  const result = await database.transaction(async (tx) => {
    const ledgerId = crypto.randomUUID();
    const reserved = await tx.insert(schema.configuracoesOperacionais).values({
      id: ledgerId,
      chave: ledgerKey(input.fileHash),
      valorJson: JSON.stringify({ status: 'processing', fileName: input.fileName, fileHash: input.fileHash, startedAt: now }),
      origem: 'migracao_completa',
      migradoEm: now
    }).onConflictDoNothing({ target: schema.configuracoesOperacionais.chave }).returning({ id: schema.configuracoesOperacionais.id });
    if (!reserved.length) {
      const duplicate = new Error('Este mesmo arquivo já foi importado. A operação foi interrompida para evitar duplicidade.') as Error & { statusCode?: number };
      duplicate.statusCode = 409;
      throw duplicate;
    }

    const counts = { imported: 0, updated: 0, ignored: 0, rejected: 0, pendingReview: 0, clients: 0, properties: 0, projects: 0, budgets: 0, billings: 0, receivables: 0, receipts: 0, expenses: 0 };
    const clientIds = new Map<string, string>();
    const propertyIds = new Map<string, string>();
    const projectIds = new Map<string, string>();
    const clients = uniqueBy(prepared.rows, (row) => row.clientKey);

    for (const row of clients) {
      const existing = prepared.existingClients.get(row.clientKey) ?? prepared.existingClients.get(`name:${normalizedIdentity(row.client.name)}`);
      if (existing) {
        await tx.update(schema.clientes).set({
          nome: row.client.name,
          tipoPessoa: row.client.type ?? existing.tipoPessoa,
          documento: row.client.documentValid ? row.client.cpf || row.client.cnpj : existing.documento,
          cpf: row.client.type === 'PF' ? row.client.cpf : existing.cpf,
          cnpj: row.client.type === 'PJ' ? row.client.cnpj : existing.cnpj,
          documentoNormalizado: row.client.normalizedDocument ?? existing.documentoNormalizado,
          email: row.client.email ?? existing.email,
          telefone: row.client.phone ?? existing.telefone,
          endereco: row.client.address ?? existing.endereco,
          categoria: row.client.category ?? existing.categoria,
          origem: row.client.origin ?? existing.origem,
          origemPrincipal: row.client.origin ?? existing.origemPrincipal,
          situacao: row.client.status,
          anotacoes: mergeNotes(existing.anotacoes, `${row.client.notes} Referência: ${sourceRef(input.fileHash, row.line)}.`),
          updatedAt: now
        }).where(eq(schema.clientes.id, existing.id));
        clientIds.set(row.clientKey, existing.id);
        counts.updated += 1;
      } else {
        const id = crypto.randomUUID();
        await tx.insert(schema.clientes).values({
          id,
          nome: row.client.name,
          tipoPessoa: row.client.type,
          documento: row.client.documentValid ? row.client.cpf || row.client.cnpj : null,
          cpf: row.client.type === 'PF' ? row.client.cpf : null,
          cnpj: row.client.type === 'PJ' ? row.client.cnpj : null,
          documentoNormalizado: row.client.normalizedDocument,
          email: row.client.email,
          telefone: row.client.phone,
          endereco: row.client.address,
          categoria: row.client.category,
          origem: row.client.origin,
          origemPrincipal: row.client.origin,
          situacao: row.client.status,
          anotacoes: `${row.client.notes} Referência: ${sourceRef(input.fileHash, row.line)}.`,
          createdAt: row.client.registeredAt ? `${row.client.registeredAt}T00:00:00.000Z` : now,
          updatedAt: now
        });
        await FileSystemOutboxService.enqueue({
          idempotencyKey: `client-folder:create:${id}:${row.client.name}`,
          operationType: 'create-client-folder', aggregateType: 'client', aggregateId: id,
          payload: { clientId: id, clientName: row.client.name }
        }, tx);
        clientIds.set(row.clientKey, id);
        counts.imported += 1;
      }
      counts.clients += 1;
      if (!row.client.documentValid) counts.pendingReview += 1;
    }

    for (const row of uniqueBy(prepared.rows.filter((item) => item.property), (item) => item.property!.key)) {
      const property = row.property!;
      const clientId = clientIds.get(row.clientKey)!;
      const [existing] = await tx.select().from(schema.propriedades).where(and(
        eq(schema.propriedades.clienteId, clientId),
        property.registration ? eq(schema.propriedades.matricula, property.registration) : eq(schema.propriedades.nome, property.name),
        isNull(schema.propriedades.deletedAt)
      )).limit(1);
      if (existing) {
        propertyIds.set(property.key, existing.id);
        counts.ignored += 1;
        continue;
      }
      const id = crypto.randomUUID();
      await tx.insert(schema.propriedades).values({
        id, clienteId: clientId, nome: property.name, areaHa: property.areaHa, matricula: property.registration,
        car: property.car, ccir: property.ccir, itr: property.itr, cidade: property.municipality,
        municipio: property.municipality, situacaoImovel: property.situation, latitude: property.latitude,
        longitude: property.longitude, observacoes: `${property.notes}\nReferência: ${sourceRef(input.fileHash, row.line)}.`
      });
      propertyIds.set(property.key, id);
      counts.properties += 1;
      counts.imported += 1;
    }

    for (const row of uniqueBy(prepared.rows.filter((item) => item.project), (item) => item.project!.key)) {
      const project = row.project!;
      const clientId = clientIds.get(row.clientKey)!;
      const [existing] = await tx.select().from(schema.projetos).where(and(
        eq(schema.projetos.clienteId, clientId), eq(schema.projetos.nome, project.name), isNull(schema.projetos.deletedAt)
      )).limit(1);
      if (existing) {
        projectIds.set(project.key, existing.id);
        counts.ignored += 1;
        continue;
      }
      const id = crypto.randomUUID();
      await tx.insert(schema.projetos).values({
        id, clienteId: clientId, propriedadeId: row.property ? propertyIds.get(row.property.key) ?? null : null,
        nome: project.name, tipo: project.category, status: project.status,
        dataInicio: project.startDate, dataEntrega: project.endDate,
        areaHa: row.property?.areaHa ?? null, cidade: row.property?.municipality ?? null,
        municipio: row.property?.municipality ?? null, matricula: row.property?.registration ?? null,
        car: row.property?.car ?? null, ccir: row.property?.ccir ?? null, itr: row.property?.itr ?? null,
        latitude: row.property?.latitude ?? null, longitude: row.property?.longitude ?? null,
        observacoes: `${project.notes} Referência: ${sourceRef(input.fileHash, row.line)}.`
      });
      await FileSystemOutboxService.enqueue({
        idempotencyKey: `project-folder:create:${id}:${row.client.name}:${project.name}`,
        operationType: 'create-project-folder', aggregateType: 'project', aggregateId: id,
        payload: { clientId, projectId: id, clientName: row.client.name, projectName: project.name }
      }, tx);
      projectIds.set(project.key, id);
      counts.projects += 1;
      counts.imported += 1;
    }

    for (const row of prepared.rows) {
      const clientId = clientIds.get(row.clientKey)!;
      const propertyId = row.property ? propertyIds.get(row.property.key) ?? null : null;
      const projectId = row.project ? projectIds.get(row.project.key) ?? null : null;
      let budgetId: string | null = null;
      if (row.budget) {
        budgetId = crypto.randomUUID();
        const code = `MIG-${input.fileHash.slice(0, 8).toUpperCase()}-L${row.line}`;
        await tx.insert(schema.orcamentos).values({
          id: budgetId, grupoId: budgetId, clienteId: clientId, projetoId: projectId, propriedadeId: propertyId,
          valorTotal: row.budget.total, status: row.budget.approved ? 'aprovado' : 'rascunho',
          descricao: row.project?.name || `Serviço migrado da linha ${row.line}`,
          anotacoes: `Conversão original: ${row.budget.originalConversion ?? 'não informada'}. Referência: ${sourceRef(input.fileHash, row.line)}.`,
          formaDePagamento: row.budget.paymentMethod, desconto: row.budget.discount,
          codigoOrcamento: code, dataOrcamento: row.budget.date, dataEmissao: row.budget.date,
          dataCompetencia: row.budget.date, origem: 'migracao_completa', servicoTipo: row.project?.category,
          imovelNome: row.property?.name, municipio: row.property?.municipality,
          descontoGlobalTipo: 'fixo', descontoGlobalValor: (row.budget.discount / 100).toFixed(2),
          subtotalServicos: row.budget.expectedRevenue, impostosPrevistos: row.budget.tax,
          honorariosBrutos: row.budget.expectedRevenue, lucroEstimado: row.budget.expectedProfit,
          margemPontosBase: row.budget.expectedMarginBp,
          aprovadoEm: row.budget.approved ? `${row.budget.date ?? now.slice(0, 10)}T00:00:00.000Z` : null
        });
        await tx.insert(schema.orcamento_itens).values({
          id: crypto.randomUUID(), orcamentoId: budgetId,
          descricao: row.project?.name || 'Serviço migrado', quantidade: row.budget.quantity,
          quantidadeDecimal: String(row.budget.quantity), valorUnitario: row.budget.unitValue,
          categoria: row.project?.category || 'Serviços', total: Math.round(row.budget.unitValue * row.budget.quantity),
          observacoes: `Total histórico do orçamento preservado em valor_total. ${sourceRef(input.fileHash, row.line)}.`
        });
        counts.budgets += 1;
        counts.imported += 2;
      }
      if (row.billing) {
        const id = crypto.randomUUID();
        await tx.insert(schema.notasFiscais).values({
          id, clienteId: clientId, projetoId: projectId, orcamentoId: budgetId,
          numero: `MIGRACAO-${input.fileHash.slice(0, 8).toUpperCase()}-L${row.line}`,
          dataEmissao: row.billing.date ?? row.budget?.date ?? now.slice(0, 10),
          valor: row.billing.value, status: row.billing.status,
          municipio: row.property?.municipality,
          canceladaEm: row.billing.status === 'cancelada' ? `${row.billing.date ?? now.slice(0, 10)}T00:00:00.000Z` : null,
          motivoCancelamento: row.billing.status === 'cancelada' ? 'Situação Cancelado informada na planilha de migração.' : null
        });
        counts.billings += 1;
        counts.imported += 1;
        counts.pendingReview += row.billing.status === 'emitida' || row.billing.status === 'pendente' ? 1 : 0;
      }
      if (row.expense) {
        await tx.insert(schema.despesas).values({
          id: crypto.randomUUID(), clienteId: clientId, projetoId: projectId,
          descricao: row.expense.subcategory || row.expense.category,
          valor: row.expense.value, data: row.expense.date ?? now.slice(0, 10),
          dataCompetencia: row.expense.date, categoria: row.expense.category,
          categoriaCodigo: normalizedIdentity(row.expense.category) || 'outros',
          observacoes: `Subcategoria: ${row.expense.subcategory ?? 'não informada'}. Referência: ${sourceRef(input.fileHash, row.line)}.`,
          status: 'Pendente'
        });
        counts.expenses += 1;
        counts.imported += 1;
        if (row.expense.category === 'Outros — revisão necessária') counts.pendingReview += 1;
      }
    }

    const finalReconciliation = reconciliation(prepared.totals);
    const ledger = {
      status: 'completed', importId: ledgerId, fileName: input.fileName, fileHash: input.fileHash,
      completedAt: now, sourceRows: input.rows.length,
      columns: { recognized: preview.columns.recognized, unrecognized: preview.columns.unrecognized },
      historicalSnapshot: prepared.totals,
      sourceReferences: prepared.rows.map(row => row.line),
      reconciliation: finalReconciliation,
      counts,
      issues: prepared.issues.map((issue) => ({ row: issue.row, field: issue.field, severity: issue.severity, message: issue.message }))
    };
    await tx.update(schema.configuracoesOperacionais).set({ valorJson: JSON.stringify(ledger), updatedAt: now })
      .where(eq(schema.configuracoesOperacionais.id, ledgerId));
    await AuditLogService.log('INSERT', 'Migração completa de planilha', null, {
      importId: ledgerId, fileHash: input.fileHash, rows: input.rows.length, counts,
      reconciliation: finalReconciliation.map((item) => ({ key: item.key, difference: item.difference, status: item.status }))
    }, tx);
    return { importId: ledgerId, status: 'completed', counts, reconciliation: finalReconciliation, warnings: prepared.issues.filter((issue) => issue.severity !== 'historical') };
  });
  try {
    await FileSystemOutboxService.processPending();
  } catch (error) {
    await OperationalLogService.error('full-import-filesystem-outbox-failed', { importId: result.importId, error });
    result.warnings.push({
      row: null,
      field: null,
      severity: 'warning',
      message: 'Os dados foram gravados, mas uma ou mais pastas ficaram pendentes para nova tentativa automática.'
    });
  }
  return {
    ...result,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAtMs)
  };
}
