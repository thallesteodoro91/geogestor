import crypto from 'node:crypto';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
  type SQL
} from 'drizzle-orm';
import { schema } from '@geogestor/database';
import {
  basisPointsToPercentage,
  calculateBudget,
  calculateInstallments,
  canTransitionBudget,
  normalizeBudgetStatus,
  percentageToBasisPoints,
  validateBudgetTransition,
  type AdjustmentInput,
  type BudgetCalculationResult,
  type BudgetCostInput,
  type BudgetItemInput,
  type BudgetStatus,
  type BudgetTaxInput,
  type InstallmentDefinition
} from '@geogestor/contracts';
import { db } from '../db';
import { JornadaService } from './jornada.service';

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BudgetPaymentInput {
  type: string;
  description?: string | null;
  installments: InstallmentDefinition[];
  paymentMethod?: string | null;
  financialAccount?: string | null;
  interestBasisPoints?: number;
  fineBasisPoints?: number;
  earlyDiscountBasisPoints?: number;
}

export interface BudgetPayload {
  clientId: string;
  projectId?: string | null;
  propertyId?: string | null;
  description: string;
  internalNotes?: string | null;
  clientNotes?: string | null;
  terms?: string | null;
  issueDate?: string | null;
  validUntil?: string | null;
  technicalLead?: string | null;
  source?: string | null;
  serviceType?: string | null;
  propertyType?: string | null;
  propertyName?: string | null;
  municipality?: string | null;
  state?: string | null;
  methodology?: string | null;
  deliverables?: string | null;
  executionDays?: number | null;
  characterization?: Record<string, unknown> | null;
  globalDiscount: AdjustmentInput;
  globalAddition: AdjustmentInput;
  items: BudgetItemInput[];
  costs: BudgetCostInput[];
  taxes: BudgetTaxInput[];
  payment: BudgetPaymentInput;
}

export interface BudgetApprovalInput {
  idempotencyKey: string;
  userId?: string;
  project: {
    mode: 'existing' | 'create';
    projectId?: string | null;
    name?: string | null;
  };
}

export interface BudgetFilters {
  query?: string;
  clientId?: string;
  property?: string;
  municipality?: string;
  serviceType?: string;
  technicalLead?: string;
  status?: BudgetStatus;
  issueFrom?: string;
  issueTo?: string;
  validFrom?: string;
  validTo?: string;
  minValueCents?: number;
  maxValueCents?: number;
  propertyType?: string;
  linkedProject?: 'sim' | 'nao';
}

function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureNonEmpty(value: string | null | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
}

async function validateRelations(database: DbOrTx, payload: Pick<BudgetPayload, 'clientId' | 'projectId' | 'propertyId'>) {
  const client = await database.select().from(schema.clientes)
    .where(and(eq(schema.clientes.id, payload.clientId), isNull(schema.clientes.deletedAt)))
    .limit(1);
  if (!client.length) throw new Error('Cliente vinculado não encontrado.');

  if (payload.projectId) {
    const project = await database.select().from(schema.projetos)
      .where(and(eq(schema.projetos.id, payload.projectId), isNull(schema.projetos.deletedAt)))
      .limit(1);
    if (!project.length) throw new Error('Projeto vinculado não encontrado.');
    if (project[0].clienteId !== payload.clientId) throw new Error('O projeto não pertence ao cliente informado.');
  }

  if (payload.propertyId) {
    const property = await database.select().from(schema.propriedades)
      .where(and(eq(schema.propriedades.id, payload.propertyId), isNull(schema.propriedades.deletedAt)))
      .limit(1);
    if (!property.length) throw new Error('Imóvel vinculado não encontrado.');
    if (property[0].clienteId !== payload.clientId) throw new Error('O imóvel não pertence ao cliente informado.');
  }
  return client[0];
}

function calculatePayload(payload: BudgetPayload) {
  return calculateBudget({
    items: payload.items,
    costs: payload.costs,
    taxes: payload.taxes,
    globalDiscount: payload.globalDiscount,
    globalAddition: payload.globalAddition
  });
}

function budgetValues(payload: BudgetPayload, calculation: BudgetCalculationResult) {
  return {
    clienteId: payload.clientId,
    projetoId: payload.projectId || null,
    propriedadeId: payload.propertyId || null,
    valorTotal: calculation.totalCents,
    descricao: payload.description,
    anotacoes: payload.internalNotes || null,
    observacoesCliente: payload.clientNotes || null,
    termosCondicoes: payload.terms || null,
    dataOrcamento: payload.issueDate || null,
    dataEmissao: payload.issueDate || null,
    validadeAte: payload.validUntil || null,
    responsavelTecnico: payload.technicalLead || null,
    origem: payload.source || 'manual',
    servicoTipo: payload.serviceType || null,
    imovelTipo: payload.propertyType || null,
    imovelNome: payload.propertyName || null,
    municipio: payload.municipality || null,
    uf: payload.state || null,
    metodologia: payload.methodology || null,
    entregaveis: payload.deliverables || null,
    prazoExecucaoDias: payload.executionDays ?? null,
    caracterizacaoJson: payload.characterization ? JSON.stringify(payload.characterization) : null,
    desconto: calculation.globalDiscountCents,
    descontoGlobalTipo: payload.globalDiscount.type,
    descontoGlobalValor: payload.globalDiscount.value,
    acrescimoGlobalTipo: payload.globalAddition.type,
    acrescimoGlobalValor: payload.globalAddition.value,
    subtotalServicos: calculation.subtotalServicesCents,
    subtotalDespesas: calculation.subtotalExpensesCents,
    subtotalTaxas: calculation.subtotalFeesCents,
    custoTotalEstimado: calculation.estimatedCostCents,
    impostosPrevistos: calculation.estimatedTaxesCents,
    impostoValor: calculation.estimatedTaxesCents,
    possuiImposto: calculation.taxes.length > 0,
    honorariosBrutos: calculation.grossFeesCents,
    honorariosLiquidos: calculation.netFeesCents,
    lucroEstimado: calculation.estimatedProfitCents,
    margemPontosBase: calculation.estimatedMarginBasisPoints,
    markupPontosBase: calculation.markupBasisPoints,
    valorReembolsavel: calculation.reimbursableCents,
    valorNaoTributavel: calculation.nonTaxableCents,
    formaDePagamento: payload.payment.description || payload.payment.type,
    updatedAt: nowIso()
  };
}

async function replaceChildren(database: DbOrTx, budgetId: string, payload: BudgetPayload, calculation: BudgetCalculationResult) {
  await database.delete(schema.orcamento_itens).where(eq(schema.orcamento_itens.orcamentoId, budgetId));
  await database.delete(schema.orcamento_despesas).where(eq(schema.orcamento_despesas.orcamentoId, budgetId));
  await database.delete(schema.orcamentoImpostos).where(eq(schema.orcamentoImpostos.orcamentoId, budgetId));
  await database.delete(schema.orcamentoCondicoesPagamento).where(eq(schema.orcamentoCondicoesPagamento.orcamentoId, budgetId));

  if (calculation.items.length) {
    await database.insert(schema.orcamento_itens).values(calculation.items.map((item, index) => ({
      id: item.id || crypto.randomUUID(),
      orcamentoId: budgetId,
      codigo: item.code || null,
      grupo: item.group || null,
      etapa: item.stage || null,
      categoria: item.category || 'Serviços',
      descricao: item.description,
      unidade: item.unit,
      quantidade: Number(item.quantity.replace(',', '.')),
      quantidadeDecimal: item.quantity.replace(',', '.'),
      custoUnitario: item.unitCostCents,
      valorUnitario: item.unitPriceCents,
      descontoTipo: item.discount.type,
      descontoValor: item.discount.value,
      acrescimoTipo: item.addition.type,
      acrescimoValor: item.addition.value,
      tributavel: item.taxable,
      componenteFinanceiro: item.component,
      observacoes: item.notes || null,
      ordem: item.order ?? index,
      opcional: item.optional || false,
      obrigatorio: item.required !== false,
      total: item.totalCents
    })));
  }

  if (payload.costs.length) {
    await database.insert(schema.orcamento_despesas).values(payload.costs.map((cost, index) => ({
      id: cost.id || crypto.randomUUID(),
      orcamentoId: budgetId,
      descricao: cost.description,
      valor: cost.amountCents,
      categoria: cost.category,
      classificacao: cost.classification,
      tributavel: cost.taxable || false,
      observacoes: cost.notes || null,
      ordem: cost.order ?? index
    })));
  }

  if (calculation.taxes.length) {
    await database.insert(schema.orcamentoImpostos).values(calculation.taxes.map((tax, index) => ({
      id: tax.id || crypto.randomUUID(),
      orcamentoId: budgetId,
      tributoId: tax.taxId || null,
      nome: tax.name,
      sigla: tax.acronym,
      aliquotaPontosBase: percentageToBasisPoints(tax.ratePercent),
      baseCalculo: tax.calculationBase,
      inclusoNoPreco: tax.includedInPrice,
      cumulativo: tax.cumulative || false,
      baseValor: tax.baseCents,
      valorPrevisto: tax.amountCents,
      ajusteManual: tax.manualAdjustmentCents || 0,
      justificativaAjuste: tax.adjustmentReason || null,
      ordem: index
    })));
  }

  await database.insert(schema.orcamentoCondicoesPagamento).values({
    id: crypto.randomUUID(),
    orcamentoId: budgetId,
    tipo: payload.payment.type,
    descricao: payload.payment.description || null,
    parcelasJson: JSON.stringify(payload.payment.installments),
    meioPagamento: payload.payment.paymentMethod || null,
    contaFinanceira: payload.payment.financialAccount || null,
    jurosPontosBase: payload.payment.interestBasisPoints || 0,
    multaPontosBase: payload.payment.fineBasisPoints || 0,
    descontoAntecipacaoPontosBase: payload.payment.earlyDiscountBasisPoints || 0
  });
}

async function insertAudit(database: DbOrTx, action: string, entity: string, oldData: unknown, newData: unknown, userId = 'admin') {
  await database.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    action,
    entity,
    userId,
    oldData: oldData ? JSON.stringify(oldData) : null,
    newData: newData ? JSON.stringify(newData) : null
  });
}

async function insertStatusHistory(
  database: DbOrTx,
  budgetId: string,
  oldStatus: string | null,
  newStatus: BudgetStatus,
  reason?: string | null,
  userId = 'admin',
  metadata?: unknown
) {
  await database.insert(schema.orcamentoStatusHistorico).values({
    id: crypto.randomUUID(),
    orcamentoId: budgetId,
    statusAnterior: oldStatus,
    statusNovo: newStatus,
    motivo: reason || null,
    usuarioId: userId,
    metadataJson: metadata ? JSON.stringify(metadata) : null
  });
}

async function saveVersionSnapshot(database: DbOrTx, budgetId: string, status: BudgetStatus, reason?: string | null, userId = 'admin') {
  const budget = await database.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, budgetId)).limit(1);
  if (!budget.length) throw new Error('Orçamento não encontrado para registrar a versão.');
  const [items, costs, taxes, payment] = await Promise.all([
    database.select().from(schema.orcamento_itens).where(eq(schema.orcamento_itens.orcamentoId, budgetId)),
    database.select().from(schema.orcamento_despesas).where(eq(schema.orcamento_despesas.orcamentoId, budgetId)),
    database.select().from(schema.orcamentoImpostos).where(eq(schema.orcamentoImpostos.orcamentoId, budgetId)),
    database.select().from(schema.orcamentoCondicoesPagamento).where(eq(schema.orcamentoCondicoesPagamento.orcamentoId, budgetId)).limit(1)
  ]);
  await database.insert(schema.orcamentoVersoes).values({
    id: crypto.randomUUID(),
    orcamentoId: budgetId,
    grupoId: budget[0].grupoId || budgetId,
    versao: budget[0].versao || 1,
    status,
    valorTotal: budget[0].valorTotal,
    snapshotJson: JSON.stringify({ budget: budget[0], items, costs, taxes, payment: payment[0] || null }),
    motivo: reason || null,
    usuarioId: userId
  }).onConflictDoNothing();
}

export async function getBudgetAggregate(budgetId: string, database: DbOrTx = db) {
  const result = await database.select({
    budget: schema.orcamentos,
    clientName: schema.clientes.nome,
    clientDocument: schema.clientes.documento,
    clientEmail: schema.clientes.email,
    clientPhone: schema.clientes.telefone,
    projectName: schema.projetos.nome,
    propertyRecordName: schema.propriedades.nome
  })
    .from(schema.orcamentos)
    .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
    .leftJoin(schema.projetos, eq(schema.orcamentos.projetoId, schema.projetos.id))
    .leftJoin(schema.propriedades, eq(schema.orcamentos.propriedadeId, schema.propriedades.id))
    .where(and(eq(schema.orcamentos.id, budgetId), isNull(schema.orcamentos.deletedAt)))
    .limit(1);
  if (!result.length) return null;

  const [items, costs, taxes, payment, history, versions, installments, links] = await Promise.all([
    database.select().from(schema.orcamento_itens).where(and(eq(schema.orcamento_itens.orcamentoId, budgetId), isNull(schema.orcamento_itens.deletedAt))).orderBy(asc(schema.orcamento_itens.ordem)),
    database.select().from(schema.orcamento_despesas).where(and(eq(schema.orcamento_despesas.orcamentoId, budgetId), isNull(schema.orcamento_despesas.deletedAt))).orderBy(asc(schema.orcamento_despesas.ordem)),
    database.select().from(schema.orcamentoImpostos).where(and(eq(schema.orcamentoImpostos.orcamentoId, budgetId), isNull(schema.orcamentoImpostos.deletedAt))).orderBy(asc(schema.orcamentoImpostos.ordem)),
    database.select().from(schema.orcamentoCondicoesPagamento).where(and(eq(schema.orcamentoCondicoesPagamento.orcamentoId, budgetId), isNull(schema.orcamentoCondicoesPagamento.deletedAt))).limit(1),
    database.select().from(schema.orcamentoStatusHistorico).where(eq(schema.orcamentoStatusHistorico.orcamentoId, budgetId)).orderBy(desc(schema.orcamentoStatusHistorico.createdAt)),
    database.select().from(schema.orcamentoVersoes).where(eq(schema.orcamentoVersoes.orcamentoId, budgetId)).orderBy(desc(schema.orcamentoVersoes.createdAt)),
    database.select().from(schema.parcelas).where(and(eq(schema.parcelas.orcamentoId, budgetId), isNull(schema.parcelas.deletedAt))).orderBy(asc(schema.parcelas.numero)),
    database.select().from(schema.orcamentoProjetos).where(eq(schema.orcamentoProjetos.orcamentoId, budgetId))
  ]);

  const row = result[0];
  return {
    ...row.budget,
    status: normalizeBudgetStatus(row.budget.status),
    clientName: row.clientName,
    clientDocument: row.clientDocument,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    projectName: row.projectName,
    propertyRecordName: row.propertyRecordName,
    characterization: json<Record<string, unknown> | null>(row.budget.caracterizacaoJson, null),
    clientSnapshot: json<Record<string, unknown> | null>(row.budget.clienteSnapshotJson, null),
    propertySnapshot: json<Record<string, unknown> | null>(row.budget.imovelSnapshotJson, null),
    items: items.map((item: typeof items[number]) => ({
      id: item.id,
      code: item.codigo,
      group: item.grupo,
      stage: item.etapa,
      category: item.categoria,
      description: item.descricao,
      unit: item.unidade,
      quantity: item.quantidadeDecimal || String(item.quantidade),
      unitCostCents: item.custoUnitario || 0,
      unitPriceCents: item.valorUnitario,
      discount: { type: item.descontoTipo || 'fixo', value: item.descontoValor || '0' },
      addition: { type: item.acrescimoTipo || 'fixo', value: item.acrescimoValor || '0' },
      taxable: item.tributavel !== false,
      component: item.componenteFinanceiro || 'servico',
      optional: item.opcional || false,
      required: item.obrigatorio !== false,
      notes: item.observacoes,
      order: item.ordem,
      totalCents: item.total
    })),
    costs: costs.map((cost: typeof costs[number]) => ({
      id: cost.id,
      category: cost.categoria,
      description: cost.descricao,
      amountCents: cost.valor,
      classification: cost.classificacao,
      taxable: cost.tributavel || false,
      notes: cost.observacoes,
      order: cost.ordem
    })),
    taxes: taxes.map((tax: typeof taxes[number]) => ({
      id: tax.id,
      taxId: tax.tributoId,
      name: tax.nome,
      acronym: tax.sigla,
      ratePercent: basisPointsToPercentage(tax.aliquotaPontosBase),
      calculationBase: tax.baseCalculo,
      includedInPrice: tax.inclusoNoPreco,
      cumulative: tax.cumulativo,
      manualAdjustmentCents: tax.ajusteManual,
      adjustmentReason: tax.justificativaAjuste,
      baseCents: tax.baseValor,
      amountCents: tax.valorPrevisto
    })),
    payment: payment[0] ? {
      id: payment[0].id,
      type: payment[0].tipo,
      description: payment[0].descricao,
      installments: json<InstallmentDefinition[]>(payment[0].parcelasJson, []),
      paymentMethod: payment[0].meioPagamento,
      financialAccount: payment[0].contaFinanceira,
      interestBasisPoints: payment[0].jurosPontosBase,
      fineBasisPoints: payment[0].multaPontosBase,
      earlyDiscountBasisPoints: payment[0].descontoAntecipacaoPontosBase
    } : null,
    history,
    versions,
    installments,
    projectLinks: links
  };
}

export async function createBudget(payload: BudgetPayload, userId = 'admin') {
  ensureNonEmpty(payload.description, 'Informe a descrição do orçamento.');
  const calculation = calculatePayload(payload);
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await validateRelations(tx, payload);
    await tx.insert(schema.orcamentos).values({
      id,
      grupoId: id,
      versao: 1,
      status: 'rascunho',
      ...budgetValues(payload, calculation)
    });
    await replaceChildren(tx, id, payload, calculation);
    await insertStatusHistory(tx, id, null, 'rascunho', 'Criação do orçamento', userId);
    await insertAudit(tx, 'INSERT', 'Orcamento', null, { id, total: calculation.totalCents, status: 'rascunho' }, userId);
  });
  return getBudgetAggregate(id);
}

export async function updateBudget(budgetId: string, payload: BudgetPayload, userId = 'admin') {
  const calculation = calculatePayload(payload);
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(schema.orcamentos).where(and(eq(schema.orcamentos.id, budgetId), isNull(schema.orcamentos.deletedAt))).limit(1);
    if (!existing.length) throw new Error('Orçamento não encontrado.');
    if (normalizeBudgetStatus(existing[0].status) !== 'rascunho') {
      throw new Error('Somente orçamentos em rascunho podem ser editados. Crie uma revisão formal para alterar uma versão emitida ou aprovada.');
    }
    await validateRelations(tx, payload);
    await tx.update(schema.orcamentos).set(budgetValues(payload, calculation)).where(eq(schema.orcamentos.id, budgetId));
    await replaceChildren(tx, budgetId, payload, calculation);
    await insertAudit(tx, 'UPDATE', 'Orcamento', { total: existing[0].valorTotal }, { total: calculation.totalCents }, userId);
  });
  return getBudgetAggregate(budgetId);
}

function filterConditions(filters: BudgetFilters) {
  const conditions: SQL[] = [isNull(schema.orcamentos.deletedAt)];
  if (filters.query) {
    const term = `%${filters.query.trim()}%`;
    const queryCondition = or(
      like(schema.orcamentos.codigoOrcamento, term),
      like(schema.orcamentos.descricao, term),
      like(schema.clientes.nome, term),
      like(schema.orcamentos.imovelNome, term),
      like(schema.orcamentos.municipio, term)
    );
    if (queryCondition) conditions.push(queryCondition);
  }
  if (filters.clientId) conditions.push(eq(schema.orcamentos.clienteId, filters.clientId));
  if (filters.property) conditions.push(like(schema.orcamentos.imovelNome, `%${filters.property}%`));
  if (filters.municipality) conditions.push(like(schema.orcamentos.municipio, `%${filters.municipality}%`));
  if (filters.serviceType) conditions.push(eq(schema.orcamentos.servicoTipo, filters.serviceType));
  if (filters.technicalLead) conditions.push(like(schema.orcamentos.responsavelTecnico, `%${filters.technicalLead}%`));
  if (filters.status) conditions.push(eq(schema.orcamentos.status, filters.status));
  if (filters.issueFrom) conditions.push(gte(schema.orcamentos.dataEmissao, filters.issueFrom));
  if (filters.issueTo) conditions.push(lte(schema.orcamentos.dataEmissao, filters.issueTo));
  if (filters.validFrom) conditions.push(gte(schema.orcamentos.validadeAte, filters.validFrom));
  if (filters.validTo) conditions.push(lte(schema.orcamentos.validadeAte, filters.validTo));
  if (filters.minValueCents !== undefined) conditions.push(gte(schema.orcamentos.valorTotal, filters.minValueCents));
  if (filters.maxValueCents !== undefined) conditions.push(lte(schema.orcamentos.valorTotal, filters.maxValueCents));
  if (filters.propertyType) conditions.push(eq(schema.orcamentos.imovelTipo, filters.propertyType));
  if (filters.linkedProject === 'sim') conditions.push(isNotNull(schema.orcamentos.projetoId));
  if (filters.linkedProject === 'nao') conditions.push(isNull(schema.orcamentos.projetoId));
  return conditions;
}

export async function listBudgets(filters: BudgetFilters = {}) {
  return db.select({
    id: schema.orcamentos.id,
    groupId: schema.orcamentos.grupoId,
    version: schema.orcamentos.versao,
    number: schema.orcamentos.codigoOrcamento,
    status: schema.orcamentos.status,
    description: schema.orcamentos.descricao,
    serviceType: schema.orcamentos.servicoTipo,
    propertyType: schema.orcamentos.imovelTipo,
    propertyName: schema.orcamentos.imovelNome,
    municipality: schema.orcamentos.municipio,
    state: schema.orcamentos.uf,
    technicalLead: schema.orcamentos.responsavelTecnico,
    issueDate: schema.orcamentos.dataEmissao,
    validUntil: schema.orcamentos.validadeAte,
    totalCents: schema.orcamentos.valorTotal,
    estimatedTaxesCents: schema.orcamentos.impostosPrevistos,
    netFeesCents: schema.orcamentos.honorariosLiquidos,
    estimatedProfitCents: schema.orcamentos.lucroEstimado,
    marginBasisPoints: schema.orcamentos.margemPontosBase,
    clientId: schema.orcamentos.clienteId,
    clientName: schema.clientes.nome,
    projectId: schema.orcamentos.projetoId,
    projectName: schema.projetos.nome,
    viewedAt: schema.orcamentos.visualizadoEm,
    createdAt: schema.orcamentos.createdAt,
    updatedAt: schema.orcamentos.updatedAt
  })
    .from(schema.orcamentos)
    .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
    .leftJoin(schema.projetos, eq(schema.orcamentos.projetoId, schema.projetos.id))
    .where(and(...filterConditions(filters)))
    .orderBy(desc(schema.orcamentos.createdAt));
}

export async function expireOverdueBudgets(userId = 'system') {
  const today = dateKey();
  const overdue = await db.select().from(schema.orcamentos).where(and(
    inArray(schema.orcamentos.status, ['emitido', 'enviado', 'em_negociacao']),
    lte(schema.orcamentos.validadeAte, addDays(today, -1)),
    isNull(schema.orcamentos.deletedAt)
  ));
  if (!overdue.length) return 0;
  await db.transaction(async (tx) => {
    for (const budget of overdue) {
      await tx.update(schema.orcamentos).set({ status: 'expirado', motivoStatus: 'Prazo de validade encerrado', updatedAt: nowIso() }).where(eq(schema.orcamentos.id, budget.id));
      await insertStatusHistory(tx, budget.id, budget.status, 'expirado', 'Prazo de validade encerrado', userId);
      await insertAudit(tx, 'UPDATE', 'OrcamentoStatus', { status: budget.status }, { status: 'expirado' }, userId);
    }
  });
  return overdue.length;
}

async function nextBudgetNumber(database: DbOrTx, issueDate: string) {
  const year = issueDate.slice(0, 4);
  const rows = await database.select({ code: schema.orcamentos.codigoOrcamento })
    .from(schema.orcamentos)
    .where(like(schema.orcamentos.codigoOrcamento, `ORC-${year}-%`));
  const max = rows.reduce((current: number, row: { code: string | null }) => {
    const match = row.code?.match(new RegExp(`^ORC-${year}-(\\d+)$`));
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `ORC-${year}-${String(max + 1).padStart(4, '0')}`;
}

function validateForEmission(aggregate: NonNullable<Awaited<ReturnType<typeof getBudgetAggregate>>>) {
  if (!aggregate.clienteId) throw new Error('Associe um cliente ao orçamento.');
  if (!aggregate.items.length) throw new Error('Adicione pelo menos um item ao orçamento.');
  const calculation = calculateBudget({
    items: aggregate.items.map((item) => ({
      ...item,
      discount: { ...item.discount, type: item.discount.type as AdjustmentInput['type'] },
      addition: { ...item.addition, type: item.addition.type as AdjustmentInput['type'] },
      component: item.component as BudgetItemInput['component']
    })),
    costs: aggregate.costs.map((cost) => ({
      ...cost,
      classification: cost.classification as BudgetCostInput['classification']
    })),
    taxes: aggregate.taxes.map((tax) => ({
      ...tax,
      calculationBase: tax.calculationBase as BudgetTaxInput['calculationBase']
    })),
    globalDiscount: {
      type: (aggregate.descontoGlobalTipo || 'fixo') as AdjustmentInput['type'],
      value: aggregate.descontoGlobalValor || '0'
    },
    globalAddition: {
      type: (aggregate.acrescimoGlobalTipo || 'fixo') as AdjustmentInput['type'],
      value: aggregate.acrescimoGlobalValor || '0'
    }
  });
  const billableSubtotal = calculation.subtotalServicesCents + calculation.subtotalExpensesCents + calculation.subtotalFeesCents;
  if (calculation.globalDiscountCents > billableSubtotal) {
    throw new Error('O desconto global não pode ser maior que o subtotal faturável.');
  }
  const invalidItemIndex = calculation.items.findIndex((item) => item.discountCents > item.subtotalCents);
  if (invalidItemIndex >= 0) {
    throw new Error(`O desconto do item ${invalidItemIndex + 1} não pode ser maior que o subtotal do item.`);
  }
  if (calculation.totalCents <= 0) throw new Error('O total do orçamento deve ser maior que zero.');
  if (!aggregate.payment?.installments?.length) throw new Error('Configure ao menos uma condição de pagamento.');
}

export async function emitBudget(budgetId: string, userId = 'admin') {
  await db.transaction(async (tx) => {
    const aggregate = await getBudgetAggregate(budgetId, tx);
    if (!aggregate) throw new Error('Orçamento não encontrado.');
    const status = normalizeBudgetStatus(aggregate.status);
    const transitionError = validateBudgetTransition(status, 'emitido');
    if (transitionError) throw new Error(transitionError);
    validateForEmission(aggregate);

    const issueDate = aggregate.dataEmissao || dateKey();
    const validUntil = aggregate.validadeAte || addDays(issueDate, 15);
    const client = await tx.select().from(schema.clientes).where(eq(schema.clientes.id, aggregate.clienteId)).limit(1);
    const property = aggregate.propriedadeId
      ? await tx.select().from(schema.propriedades).where(eq(schema.propriedades.id, aggregate.propriedadeId)).limit(1)
      : [];
    const number = aggregate.codigoOrcamento || await nextBudgetNumber(tx, issueDate);
    const timestamp = nowIso();
    await tx.update(schema.orcamentos).set({
      status: 'emitido',
      codigoOrcamento: number,
      dataOrcamento: issueDate,
      dataEmissao: issueDate,
      validadeAte: validUntil,
      clienteSnapshotJson: JSON.stringify(client[0]),
      imovelSnapshotJson: JSON.stringify(property[0] || {
        nome: aggregate.imovelNome,
        tipo: aggregate.imovelTipo,
        municipio: aggregate.municipio,
        uf: aggregate.uf,
        caracterizacao: aggregate.characterization
      }),
      emitidoEm: timestamp,
      bloqueadoEm: timestamp,
      motivoStatus: null,
      updatedAt: timestamp
    }).where(eq(schema.orcamentos.id, budgetId));
    await insertStatusHistory(tx, budgetId, status, 'emitido', null, userId);
    await saveVersionSnapshot(tx, budgetId, 'emitido', 'Emissão do documento', userId);
    await insertAudit(tx, 'UPDATE', 'OrcamentoStatus', { status }, { status: 'emitido', number }, userId);
    await JornadaService.logClienteEvento({
      clienteId: aggregate.clienteId,
      projetoId: aggregate.projetoId,
      orcamentoId: budgetId,
      tipo: 'Orçamento',
      titulo: `Orçamento emitido: ${number} v${aggregate.versao}`,
      categoria: 'Emissão',
      descricao: `Valor: ${(aggregate.valorTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nValidade: ${validUntil}`
    }, tx);
  });
  return getBudgetAggregate(budgetId);
}

export async function transitionBudget(budgetId: string, target: BudgetStatus, reason?: string | null, userId = 'admin') {
  if (target === 'emitido') return emitBudget(budgetId, userId);
  if (target === 'aprovado') throw new Error('Use a confirmação de aprovação para gerar o projeto e as contas a receber.');
  if (target === 'substituido') throw new Error('O status Substituído é aplicado automaticamente quando uma revisão é aprovada.');
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(schema.orcamentos).where(and(eq(schema.orcamentos.id, budgetId), isNull(schema.orcamentos.deletedAt))).limit(1);
    if (!rows.length) throw new Error('Orçamento não encontrado.');
    const budget = rows[0];
    const from = normalizeBudgetStatus(budget.status);
    const error = validateBudgetTransition(from, target, reason);
    if (error) throw new Error(error);
    const timestamp = nowIso();
    const stateDates = target === 'enviado'
      ? { enviadoEm: timestamp }
      : target === 'rejeitado'
        ? { rejeitadoEm: timestamp }
        : target === 'cancelado'
          ? { canceladoEm: timestamp }
          : {};
    await tx.update(schema.orcamentos).set({
      status: target,
      motivoStatus: reason || null,
      ...stateDates,
      updatedAt: timestamp
    }).where(eq(schema.orcamentos.id, budgetId));

    if (target === 'cancelado') {
      await tx.update(schema.parcelas).set({
        statusPagamento: 'Cancelado',
        canceladaEm: timestamp,
        motivoCancelamento: reason || 'Cancelamento do orçamento',
        updatedAt: timestamp
      }).where(and(eq(schema.parcelas.orcamentoId, budgetId), sql`${schema.parcelas.statusPagamento} != 'Pago'`));
    }
    await insertStatusHistory(tx, budgetId, from, target, reason, userId);
    await saveVersionSnapshot(tx, budgetId, target, reason, userId);
    await insertAudit(tx, 'UPDATE', 'OrcamentoStatus', { status: from }, { status: target, reason }, userId);
  });
  return getBudgetAggregate(budgetId);
}

export async function markBudgetViewed(budgetId: string, userId = 'admin') {
  const budget = await getBudgetAggregate(budgetId);
  if (!budget) throw new Error('Orçamento não encontrado.');
  if (!budget.visualizadoEm) {
    const timestamp = nowIso();
    await db.transaction(async (tx) => {
      await tx.update(schema.orcamentos).set({ visualizadoEm: timestamp, updatedAt: timestamp }).where(eq(schema.orcamentos.id, budgetId));
      await insertAudit(tx, 'UPDATE', 'OrcamentoVisualizacao', null, { visualizadoEm: timestamp }, userId);
    });
  }
  return getBudgetAggregate(budgetId);
}

export async function approveBudget(budgetId: string, input: BudgetApprovalInput) {
  const userId = input.userId || 'admin';
  let response: { budgetId: string; projectId: string; installmentIds: string[]; idempotent: boolean } | null = null;
  await db.transaction(async (tx) => {
    const aggregate = await getBudgetAggregate(budgetId, tx);
    if (!aggregate) throw new Error('Orçamento não encontrado.');
    const status = normalizeBudgetStatus(aggregate.status);
    if (status === 'aprovado') {
      const effects = json<{ projectId: string; installmentIds: string[] } | null>(aggregate.efeitosAprovacaoJson, null);
      response = {
        budgetId,
        projectId: effects?.projectId || aggregate.projetoId || '',
        installmentIds: effects?.installmentIds || aggregate.installments.map((item: { id: string }) => item.id),
        idempotent: true
      };
      return;
    }
    if (!canTransitionBudget(status, 'aprovado')) throw new Error('O status atual não permite aprovação.');
    validateForEmission(aggregate);
    if (!aggregate.dataEmissao || !aggregate.validadeAte) throw new Error('Emita o orçamento e defina sua validade antes de aprovar.');
    if (aggregate.validadeAte < dateKey()) throw new Error('O orçamento está vencido. Crie uma revisão com nova validade.');
    if (aggregate.items.some((item: { taxable: boolean }) => item.taxable) && aggregate.taxes.length === 0) {
      throw new Error('Configure os impostos ou marque explicitamente os itens como não tributáveis antes da aprovação.');
    }
    if (!aggregate.payment) throw new Error('Configure as condições de pagamento antes da aprovação.');

    let projectId = input.project.projectId || aggregate.projetoId || null;
    if (input.project.mode === 'existing') {
      if (!projectId) throw new Error('Selecione o projeto que será vinculado.');
      const project = await tx.select().from(schema.projetos).where(and(eq(schema.projetos.id, projectId), isNull(schema.projetos.deletedAt))).limit(1);
      if (!project.length) throw new Error('Projeto selecionado não encontrado.');
      if (project[0].clienteId !== aggregate.clienteId) throw new Error('O projeto selecionado não pertence ao cliente do orçamento.');
    } else {
      ensureNonEmpty(input.project.name, 'Informe o nome do novo projeto.');
      projectId = crypto.randomUUID();
      await tx.insert(schema.projetos).values({
        id: projectId,
        clienteId: aggregate.clienteId,
        nome: input.project.name!.trim(),
        descricao: aggregate.descricao,
        status: 'Em Andamento',
        dataInicio: dateKey(),
        dataEntrega: aggregate.prazoExecucaoDias ? addDays(dateKey(), aggregate.prazoExecucaoDias) : null,
        municipio: aggregate.municipio,
        cidade: aggregate.uf,
        tipo: aggregate.servicoTipo,
        propriedadeId: aggregate.propriedadeId,
        observacoes: `Projeto originado do orçamento ${aggregate.codigoOrcamento} v${aggregate.versao}.`
      });
      await insertAudit(tx, 'INSERT', 'Projeto', null, { id: projectId, origemOrcamentoId: budgetId }, userId);
    }

    const approvalDate = dateKey();
    const timestamp = nowIso();
    const installmentIds: string[] = [];
    let receivedFromReplacedCents = 0;

    if (aggregate.substituiOrcamentoId) {
      const replaced = await tx.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, aggregate.substituiOrcamentoId)).limit(1);
      if (replaced.length && normalizeBudgetStatus(replaced[0].status) === 'aprovado') {
        const replacedInstallments = await tx.select().from(schema.parcelas).where(and(
          eq(schema.parcelas.orcamentoId, replaced[0].id),
          isNull(schema.parcelas.deletedAt)
        ));
        receivedFromReplacedCents = replacedInstallments.reduce((sum: number, installment: typeof replacedInstallments[number]) => (
          sum + (installment.valorPago || (installment.statusPagamento === 'Pago' ? installment.valor : 0))
        ), 0);
        if (!replacedInstallments.length && replaced[0].dataPagamento) {
          receivedFromReplacedCents = replaced[0].valorTotal;
        }
        if (receivedFromReplacedCents > aggregate.valorTotal) {
          throw new Error('O valor da revisão é inferior ao total já recebido. Registre o estorno ou o crédito ao cliente antes de aprovar.');
        }
        await tx.update(schema.orcamentos).set({ status: 'substituido', motivoStatus: `Substituído por ${aggregate.codigoOrcamento} v${aggregate.versao}`, updatedAt: timestamp }).where(eq(schema.orcamentos.id, replaced[0].id));
        await tx.update(schema.parcelas).set({ statusPagamento: 'Cancelado', canceladaEm: timestamp, motivoCancelamento: 'Substituição por revisão aprovada', updatedAt: timestamp })
          .where(and(eq(schema.parcelas.orcamentoId, replaced[0].id), sql`${schema.parcelas.statusPagamento} != 'Pago'`));
        await insertStatusHistory(tx, replaced[0].id, replaced[0].status, 'substituido', `Substituído pela versão ${aggregate.versao}`, userId);
        await saveVersionSnapshot(tx, replaced[0].id, 'substituido', `Substituído pela versão ${aggregate.versao}`, userId);
        await insertAudit(tx, 'UPDATE', 'OrcamentoStatus', { status: replaced[0].status }, { status: 'substituido', receivedPreservedCents: receivedFromReplacedCents }, userId);
      }
    }

    const financeableTotalCents = aggregate.valorTotal - receivedFromReplacedCents;
    const financeableTaxCents = aggregate.valorTotal > 0
      ? Number((BigInt(aggregate.impostosPrevistos || 0) * BigInt(financeableTotalCents) + BigInt(aggregate.valorTotal) / 2n) / BigInt(aggregate.valorTotal))
      : 0;
    const installments = financeableTotalCents > 0
      ? calculateInstallments(financeableTotalCents, aggregate.payment.installments, approvalDate)
      : [];

    for (const installment of installments) {
      const id = crypto.randomUUID();
      installmentIds.push(id);
      await tx.insert(schema.parcelas).values({
        id,
        orcamentoId: budgetId,
        numero: installment.number,
        valor: installment.valueCents,
        valorPago: 0,
        dataVencimento: installment.dueDate,
        dataCompetencia: approvalDate,
        statusPagamento: 'Pendente',
        tipoValor: 'recebivel_previsto',
        origemVersao: aggregate.versao,
        chaveOrigem: `${budgetId}:v${aggregate.versao}:p${installment.number}`,
        categoriaFinanceira: 'Honorários contratados',
        contaFinanceira: aggregate.payment.financialAccount,
        meioPagamento: aggregate.payment.paymentMethod,
        juros: aggregate.payment.interestBasisPoints || 0,
        multa: aggregate.payment.fineBasisPoints || 0,
        descontoAntecipacao: aggregate.payment.earlyDiscountBasisPoints || 0,
        impostoPrevisto: installments.length
          ? Math.floor(financeableTaxCents / installments.length) + (installment.number === installments.length ? financeableTaxCents % installments.length : 0)
          : 0
      });
    }

    await tx.insert(schema.orcamentoProjetos).values({
      id: crypto.randomUUID(),
      orcamentoId: budgetId,
      projetoId: projectId!,
      tipoVinculo: input.project.mode === 'create' ? 'criado_na_aprovacao' : 'vinculado_na_aprovacao'
    }).onConflictDoNothing();

    const effects = { projectId: projectId!, installmentIds, receivedFromReplacedCents, financeableTotalCents, financeableTaxCents };
    await tx.update(schema.orcamentos).set({
      status: 'aprovado',
      projetoId: projectId,
      aprovadoEm: timestamp,
      aprovadoPor: userId,
      bloqueadoEm: timestamp,
      chaveIdempotenciaAprovacao: input.idempotencyKey,
      efeitosAprovacaoJson: JSON.stringify(effects),
      motivoStatus: null,
      updatedAt: timestamp
    }).where(eq(schema.orcamentos.id, budgetId));

    const linkedOpportunities = await tx.select({ id: schema.oportunidades.id, stage: schema.oportunidades.estagio })
      .from(schema.oportunidades)
      .where(and(eq(schema.oportunidades.orcamentoId, budgetId), isNull(schema.oportunidades.deletedAt)));
    for (const opportunity of linkedOpportunities) {
      await tx.update(schema.oportunidades).set({
        estagio: 'Ganho',
        probabilidadePontosBase: 10_000,
        projetoId: projectId,
        motivoPerda: null,
        encerradoEm: timestamp,
        estagioAlteradoEm: opportunity.stage === 'Ganho' ? undefined : timestamp,
        updatedAt: timestamp
      }).where(eq(schema.oportunidades.id, opportunity.id));
      if (opportunity.stage !== 'Ganho') {
        await tx.insert(schema.oportunidadeEstagiosHistorico).values({
          id: crypto.randomUUID(),
          oportunidadeId: opportunity.id,
          estagioAnterior: opportunity.stage,
          estagioNovo: 'Ganho',
          motivo: 'Orçamento vinculado aprovado',
          usuarioId: userId,
          createdAt: timestamp
        });
      }
    }
    await insertStatusHistory(tx, budgetId, status, 'aprovado', null, userId, effects);
    await saveVersionSnapshot(tx, budgetId, 'aprovado', 'Aprovação comercial', userId);
    await insertAudit(tx, 'UPDATE', 'OrcamentoAprovacao', { status }, { status: 'aprovado', effects }, userId);
    await JornadaService.logClienteEvento({
      clienteId: aggregate.clienteId,
      projetoId: projectId,
      orcamentoId: budgetId,
      tipo: 'Orçamento',
      titulo: `Orçamento aprovado: ${aggregate.codigoOrcamento} v${aggregate.versao}`,
      categoria: 'Aprovação',
      descricao: `${installments.length} conta(s) a receber prevista(s) gerada(s). ${receivedFromReplacedCents > 0 ? `Foram preservados ${(receivedFromReplacedCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} já recebidos na versão anterior.` : 'Receita realizada permanece em R$ 0,00 até a liquidação.'}`
    }, tx);
    response = { budgetId, projectId: projectId!, installmentIds, idempotent: false };
  });
  if (!response) throw new Error('Não foi possível concluir a aprovação.');
  return response;
}

async function cloneBudget(sourceId: string, mode: 'duplicate' | 'revision', reason?: string | null, userId = 'admin') {
  let newId = '';
  await db.transaction(async (tx) => {
    const source = await getBudgetAggregate(sourceId, tx);
    if (!source) throw new Error('Orçamento de origem não encontrado.');
    if (mode === 'revision' && normalizeBudgetStatus(source.status) !== 'aprovado') {
      throw new Error('A revisão formal é necessária apenas para orçamentos aprovados. Use duplicar para os demais casos.');
    }
    newId = crypto.randomUUID();
    const groupId = mode === 'revision' ? source.grupoId || source.id : newId;
    const maxVersion = mode === 'revision'
      ? await tx.select({ value: sql<number>`max(${schema.orcamentos.versao})` }).from(schema.orcamentos).where(eq(schema.orcamentos.grupoId, groupId))
      : [{ value: 0 }];
    const version = mode === 'revision' ? (maxVersion[0]?.value || source.versao || 1) + 1 : 1;

    await tx.insert(schema.orcamentos).values({
      id: newId,
      grupoId: groupId,
      substituiOrcamentoId: mode === 'revision' ? source.id : null,
      versao: version,
      clienteId: source.clienteId,
      projetoId: source.projetoId,
      propriedadeId: source.propriedadeId,
      valorTotal: source.valorTotal,
      status: 'rascunho',
      descricao: source.descricao,
      anotacoes: source.anotacoes,
      observacoesCliente: source.observacoesCliente,
      termosCondicoes: source.termosCondicoes,
      formaDePagamento: source.formaDePagamento,
      desconto: source.desconto,
      codigoOrcamento: mode === 'revision' ? source.codigoOrcamento : null,
      dataOrcamento: null,
      dataEmissao: null,
      validadeAte: null,
      responsavelTecnico: source.responsavelTecnico,
      origem: mode === 'revision' ? 'revisao' : 'duplicacao',
      servicoTipo: source.servicoTipo,
      imovelTipo: source.imovelTipo,
      imovelNome: source.imovelNome,
      municipio: source.municipio,
      uf: source.uf,
      metodologia: source.metodologia,
      entregaveis: source.entregaveis,
      prazoExecucaoDias: source.prazoExecucaoDias,
      caracterizacaoJson: source.caracterizacaoJson,
      descontoGlobalTipo: source.descontoGlobalTipo,
      descontoGlobalValor: source.descontoGlobalValor,
      acrescimoGlobalTipo: source.acrescimoGlobalTipo,
      acrescimoGlobalValor: source.acrescimoGlobalValor,
      subtotalServicos: source.subtotalServicos,
      subtotalDespesas: source.subtotalDespesas,
      subtotalTaxas: source.subtotalTaxas,
      custoTotalEstimado: source.custoTotalEstimado,
      impostosPrevistos: source.impostosPrevistos,
      impostoValor: source.impostoValor,
      possuiImposto: source.possuiImposto,
      honorariosBrutos: source.honorariosBrutos,
      honorariosLiquidos: source.honorariosLiquidos,
      lucroEstimado: source.lucroEstimado,
      margemPontosBase: source.margemPontosBase,
      markupPontosBase: source.markupPontosBase,
      valorReembolsavel: source.valorReembolsavel,
      valorNaoTributavel: source.valorNaoTributavel
    });

    if (source.items.length) {
      await tx.insert(schema.orcamento_itens).values(source.items.map((item) => ({
        id: crypto.randomUUID(), orcamentoId: newId, codigo: item.code, grupo: item.group, etapa: item.stage,
        categoria: item.category, descricao: item.description, unidade: item.unit,
        quantidade: Number(String(item.quantity).replace(',', '.')), quantidadeDecimal: item.quantity,
        custoUnitario: item.unitCostCents, valorUnitario: item.unitPriceCents,
        descontoTipo: item.discount.type, descontoValor: item.discount.value,
        acrescimoTipo: item.addition.type, acrescimoValor: item.addition.value,
        tributavel: item.taxable, componenteFinanceiro: item.component, observacoes: item.notes,
        ordem: item.order, opcional: item.optional, obrigatorio: item.required, total: item.totalCents
      })));
    }
    if (source.costs.length) {
      await tx.insert(schema.orcamento_despesas).values(source.costs.map((cost) => ({
        id: crypto.randomUUID(), orcamentoId: newId, descricao: cost.description, valor: cost.amountCents,
        categoria: cost.category, classificacao: cost.classification, tributavel: cost.taxable,
        observacoes: cost.notes, ordem: cost.order
      })));
    }
    if (source.taxes.length) {
      await tx.insert(schema.orcamentoImpostos).values(source.taxes.map((tax, index) => ({
        id: crypto.randomUUID(), orcamentoId: newId, tributoId: tax.taxId, nome: tax.name, sigla: tax.acronym,
        aliquotaPontosBase: percentageToBasisPoints(tax.ratePercent), baseCalculo: tax.calculationBase,
        inclusoNoPreco: tax.includedInPrice, cumulativo: tax.cumulative, baseValor: tax.baseCents,
        valorPrevisto: tax.amountCents, ajusteManual: tax.manualAdjustmentCents,
        justificativaAjuste: tax.adjustmentReason, ordem: index
      })));
    }
    if (source.payment) {
      await tx.insert(schema.orcamentoCondicoesPagamento).values({
        id: crypto.randomUUID(), orcamentoId: newId, tipo: source.payment.type,
        descricao: source.payment.description, parcelasJson: JSON.stringify(source.payment.installments),
        meioPagamento: source.payment.paymentMethod, contaFinanceira: source.payment.financialAccount,
        jurosPontosBase: source.payment.interestBasisPoints, multaPontosBase: source.payment.fineBasisPoints,
        descontoAntecipacaoPontosBase: source.payment.earlyDiscountBasisPoints
      });
    }
    await insertStatusHistory(tx, newId, null, 'rascunho', reason || (mode === 'revision' ? 'Revisão formal' : 'Duplicação'), userId, { sourceId });
    await insertAudit(tx, 'INSERT', mode === 'revision' ? 'OrcamentoRevisao' : 'OrcamentoDuplicacao', null, { id: newId, sourceId, version }, userId);
  });
  return getBudgetAggregate(newId);
}

export function duplicateBudget(sourceId: string, userId = 'admin') {
  return cloneBudget(sourceId, 'duplicate', 'Orçamento duplicado', userId);
}

export function reviseBudget(sourceId: string, reason: string, userId = 'admin') {
  ensureNonEmpty(reason, 'Informe o motivo da revisão.');
  return cloneBudget(sourceId, 'revision', reason, userId);
}

export async function deleteBudget(budgetId: string, userId = 'admin') {
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(schema.orcamentos).where(and(eq(schema.orcamentos.id, budgetId), isNull(schema.orcamentos.deletedAt))).limit(1);
    if (!rows.length) return;
    const status = normalizeBudgetStatus(rows[0].status);
    if (status !== 'rascunho') throw new Error('Somente orçamentos em rascunho podem ser excluídos. Use cancelamento para preservar o histórico.');
    const timestamp = nowIso();
    await tx.update(schema.orcamentos).set({ deletedAt: timestamp, updatedAt: timestamp }).where(eq(schema.orcamentos.id, budgetId));
    await insertAudit(tx, 'DELETE (SOFT)', 'Orcamento', { id: budgetId, status }, null, userId);
  });
}

export async function getBudgetKpis(filters: BudgetFilters = {}) {
  const budgets = await listBudgets(filters);
  const ids = budgets.map((budget) => budget.id);
  const installments = ids.length
    ? await db.select().from(schema.parcelas).where(and(inArray(schema.parcelas.orcamentoId, ids), isNull(schema.parcelas.deletedAt)))
    : [];
  const counts = Object.fromEntries([
    'rascunho', 'emitido', 'enviado', 'em_negociacao', 'aprovado', 'rejeitado', 'expirado', 'cancelado', 'substituido'
  ].map((status) => [status, 0])) as Record<BudgetStatus, number>;
  for (const budget of budgets) counts[normalizeBudgetStatus(budget.status)] += 1;
  const validForBudgeted = budgets.filter((budget) => !['rascunho', 'cancelado', 'substituido'].includes(normalizeBudgetStatus(budget.status)));
  const approved = budgets.filter((budget) => normalizeBudgetStatus(budget.status) === 'aprovado');
  const eligibleClosed = budgets.filter((budget) => ['aprovado', 'rejeitado', 'expirado'].includes(normalizeBudgetStatus(budget.status)));
  const openReceivables = installments
    .filter((installment) => !['Pago', 'Cancelado'].includes(installment.statusPagamento))
    .reduce((sum, installment) => sum + Math.max(0, installment.valor - (installment.valorPago || 0)), 0);
  const received = installments
    .filter((installment) => installment.statusPagamento === 'Pago')
    .reduce((sum, installment) => sum + (installment.valorPago || installment.valor), 0);
  const totalApproved = approved.reduce((sum, budget) => sum + budget.totalCents, 0);
  const byService = new Map<string, { eligible: number; approved: number }>();
  for (const budget of eligibleClosed) {
    const service = budget.serviceType || 'Não informado';
    const current = byService.get(service) || { eligible: 0, approved: 0 };
    current.eligible += 1;
    if (normalizeBudgetStatus(budget.status) === 'aprovado') current.approved += 1;
    byService.set(service, current);
  }
  return {
    total: budgets.length,
    counts,
    viewed: budgets.filter((budget) => Boolean(budget.viewedAt)).length,
    totalBudgetedCents: validForBudgeted.reduce((sum, budget) => sum + budget.totalCents, 0),
    totalApprovedCents: totalApproved,
    averageApprovedTicketCents: approved.length ? Math.round(totalApproved / approved.length) : 0,
    conversionBasisPoints: eligibleClosed.length ? Math.round((approved.length / eligibleClosed.length) * 10_000) : 0,
    estimatedTaxesCents: approved.reduce((sum, budget) => sum + (budget.estimatedTaxesCents || 0), 0),
    estimatedNetFeesCents: approved.reduce((sum, budget) => sum + (budget.netFeesCents || 0), 0),
    accountsReceivableCents: openReceivables,
    receivedCents: received,
    conversionByService: Array.from(byService, ([serviceType, value]) => ({
      serviceType,
      eligible: value.eligible,
      approved: value.approved,
      conversionBasisPoints: value.eligible ? Math.round((value.approved / value.eligible) * 10_000) : 0
    }))
  };
}

export async function getBudgetOptions() {
  const [clients, projects, properties, profiles, taxes, templates, parameters] = await Promise.all([
    db.select({ id: schema.clientes.id, name: schema.clientes.nome, document: schema.clientes.documento }).from(schema.clientes).where(isNull(schema.clientes.deletedAt)).orderBy(asc(schema.clientes.nome)),
    db.select({ id: schema.projetos.id, clientId: schema.projetos.clienteId, name: schema.projetos.nome, status: schema.projetos.status }).from(schema.projetos).where(isNull(schema.projetos.deletedAt)).orderBy(asc(schema.projetos.nome)),
    db.select({ id: schema.propriedades.id, clientId: schema.propriedades.clienteId, name: schema.propriedades.nome, municipality: schema.propriedades.municipio, city: schema.propriedades.cidade, areaHa: schema.propriedades.areaHa, record: schema.propriedades.matricula }).from(schema.propriedades).where(isNull(schema.propriedades.deletedAt)).orderBy(asc(schema.propriedades.nome)),
    db.select().from(schema.perfisTributarios).where(and(eq(schema.perfisTributarios.ativo, true), isNull(schema.perfisTributarios.deletedAt))).orderBy(asc(schema.perfisTributarios.nome)),
    db.select().from(schema.tributos).where(and(
      eq(schema.tributos.ativo, true),
      isNull(schema.tributos.deletedAt),
      or(isNull(schema.tributos.vigenciaInicio), lte(schema.tributos.vigenciaInicio, dateKey())),
      or(isNull(schema.tributos.vigenciaFim), gte(schema.tributos.vigenciaFim, dateKey()))
    )).orderBy(asc(schema.tributos.nome)),
    db.select().from(schema.orcamentoModelos).where(and(eq(schema.orcamentoModelos.ativo, true), isNull(schema.orcamentoModelos.deletedAt))).orderBy(asc(schema.orcamentoModelos.nome)),
    db.select().from(schema.parametrosPrecificacao).where(and(eq(schema.parametrosPrecificacao.ativo, true), isNull(schema.parametrosPrecificacao.deletedAt))).orderBy(asc(schema.parametrosPrecificacao.nome))
  ]);
  return {
    clients,
    projects,
    properties,
    taxProfiles: profiles.map((profile) => ({ ...profile, taxes: taxes.filter((tax) => tax.perfilId === profile.id).map((tax) => ({
      ...tax,
      ratePercent: basisPointsToPercentage(tax.aliquotaPontosBase)
    })) })),
    templates: templates.map((template) => ({ ...template, content: json(template.conteudoJson, {}) })),
    pricingParameters: parameters
  };
}
