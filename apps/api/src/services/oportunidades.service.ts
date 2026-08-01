import crypto from 'crypto';
import { and, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';
import {
  ACTIVE_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  isActiveOpportunityStage,
  opportunityStageProbability,
  type OpportunityAnalytics,
  type OpportunityListItem,
  type OpportunityPayload,
  type OpportunityStage,
  type OpportunityTransition,
  type OpportunityUpdate
} from '@geogestor/contracts';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { JornadaService } from './jornada.service';
import { getActiveProject } from './relationship-integrity.service';

type ReorderItem = { id: string; estagio: OpportunityStage; ordem: number };

function nowIso() {
  return new Date().toISOString();
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeStage(stage: string): OpportunityStage {
  if (stage === 'Prospect') return 'Prospectado';
  if ((OPPORTUNITY_STAGES as readonly string[]).includes(stage)) return stage as OpportunityStage;
  return 'Prospectado';
}

async function opportunityRows(ids?: string[]) {
  const where = ids?.length
    ? and(isNull(schema.oportunidades.deletedAt), inArray(schema.oportunidades.id, ids))
    : isNull(schema.oportunidades.deletedAt);
  return db.select({
    id: schema.oportunidades.id,
    clienteId: schema.oportunidades.clienteId,
    leadId: schema.oportunidades.leadId,
    clienteNome: schema.clientes.nome,
    leadNome: schema.contatos.nome,
    titulo: schema.oportunidades.titulo,
    valorEstimado: schema.oportunidades.valorEstimado,
    estagio: schema.oportunidades.estagio,
    ordem: schema.oportunidades.ordem,
    responsavel: schema.oportunidades.responsavel,
    origem: schema.oportunidades.origem,
    servicoTipo: schema.oportunidades.servicoTipo,
    proximaAcao: schema.oportunidades.proximaAcao,
    proximaAcaoEm: schema.oportunidades.proximaAcaoEm,
    previsaoFechamento: schema.oportunidades.previsaoFechamento,
    probabilidadePontosBase: schema.oportunidades.probabilidadePontosBase,
    observacoes: schema.oportunidades.observacoes,
    motivoPerda: schema.oportunidades.motivoPerda,
    encerradoEm: schema.oportunidades.encerradoEm,
    ultimoContatoEm: schema.oportunidades.ultimoContatoEm,
    orcamentoId: schema.oportunidades.orcamentoId,
    orcamentoCodigo: schema.orcamentos.codigoOrcamento,
    orcamentoVersao: schema.orcamentos.versao,
    orcamentoStatus: schema.orcamentos.status,
    projetoId: schema.oportunidades.projetoId,
    projetoNome: schema.projetos.nome,
    estagioAlteradoEm: schema.oportunidades.estagioAlteradoEm,
    createdAt: schema.oportunidades.createdAt,
    updatedAt: schema.oportunidades.updatedAt
  }).from(schema.oportunidades)
    .leftJoin(schema.clientes, eq(schema.oportunidades.clienteId, schema.clientes.id))
    .leftJoin(schema.contatos, eq(schema.oportunidades.leadId, schema.contatos.id))
    .leftJoin(schema.orcamentos, eq(schema.oportunidades.orcamentoId, schema.orcamentos.id))
    .leftJoin(schema.projetos, eq(schema.oportunidades.projetoId, schema.projetos.id))
    .where(where);
}

function mapOpportunity(row: Awaited<ReturnType<typeof opportunityRows>>[number]): OpportunityListItem {
  return {
    ...row,
    clienteNome: row.clienteNome || row.leadNome || 'Vínculo não encontrado',
    leadNome: row.leadNome || null,
    vinculoTipo: row.clienteId ? 'cliente' : 'lead',
    estagio: normalizeStage(row.estagio),
    valorEstimado: row.valorEstimado ?? null,
    probabilidadePontosBase: row.probabilidadePontosBase ?? opportunityStageProbability(normalizeStage(row.estagio)),
    orcamentoCodigo: row.orcamentoCodigo ? `${row.orcamentoCodigo} v${row.orcamentoVersao || 1}` : null,
    estagioAlteradoEm: row.estagioAlteradoEm || row.updatedAt || row.createdAt
  };
}

async function findOpportunity(id: string) {
  const rows = await opportunityRows([id]);
  if (!rows.length) throw new Error('Oportunidade não encontrada.');
  return mapOpportunity(rows[0]);
}

async function assertClient(clientId: string, tx: any = db) {
  const rows = await tx.select({ id: schema.clientes.id }).from(schema.clientes)
    .where(and(eq(schema.clientes.id, clientId), isNull(schema.clientes.deletedAt))).limit(1);
  if (!rows.length) throw new Error('Cliente não encontrado.');
}

async function assertLead(leadId: string, tx: any = db) {
  const rows = await tx.select({ id: schema.contatos.id, status: schema.contatos.status }).from(schema.contatos)
    .where(and(eq(schema.contatos.id, leadId), isNull(schema.contatos.deletedAt))).limit(1);
  if (!rows.length) throw new Error('Lead não encontrado.');
  if (rows[0].status === 'convertido') throw new Error('Este lead já foi convertido. Selecione o cliente correspondente.');
}

async function assertSubject(clientId: string | null, leadId: string | null, tx: any = db) {
  if (!clientId && !leadId) throw new Error('Selecione um cliente ou um lead.');
  if (clientId) await assertClient(clientId, tx);
  if (clientId && leadId) {
    const [lead] = await tx.select({
      id: schema.contatos.id,
      clienteConvertidoId: schema.contatos.clienteConvertidoId
    }).from(schema.contatos)
      .where(and(eq(schema.contatos.id, leadId), isNull(schema.contatos.deletedAt)))
      .limit(1);
    if (!lead) throw new Error('Lead não encontrado.');
    if (lead.clienteConvertidoId !== clientId) {
      throw new Error('O lead informado não corresponde ao cliente convertido.');
    }
    return;
  }
  if (leadId) await assertLead(leadId, tx);
}

async function logClientEvent(clientId: string | null, payload: Record<string, unknown>, tx: any) {
  if (!clientId) return;
  await JornadaService.logClienteEvento({ ...payload, clienteId: clientId } as any, tx);
}

async function assertBudget(budgetId: string, clientId: string, tx: any = db) {
  const rows = await tx.select({
    id: schema.orcamentos.id,
    clienteId: schema.orcamentos.clienteId,
    status: schema.orcamentos.status,
    valorTotal: schema.orcamentos.valorTotal,
    projetoId: schema.orcamentos.projetoId
  }).from(schema.orcamentos)
    .where(and(eq(schema.orcamentos.id, budgetId), isNull(schema.orcamentos.deletedAt))).limit(1);
  if (!rows.length) throw new Error('Orçamento não encontrado.');
  if (rows[0].clienteId !== clientId) throw new Error('O orçamento selecionado pertence a outro cliente.');
  return rows[0];
}

async function nextOrder(stage: OpportunityStage, tx: any = db) {
  const rows = await tx.select({ value: sql<number>`coalesce(max(${schema.oportunidades.ordem}), -1)` })
    .from(schema.oportunidades)
    .where(and(eq(schema.oportunidades.estagio, stage), isNull(schema.oportunidades.deletedAt)));
  return Number(rows[0]?.value ?? -1) + 1;
}

async function insertStageHistory(tx: any, opportunityId: string, previous: OpportunityStage | null, next: OpportunityStage, reason?: string | null) {
  await tx.insert(schema.oportunidadeEstagiosHistorico).values({
    id: crypto.randomUUID(),
    oportunidadeId: opportunityId,
    estagioAnterior: previous,
    estagioNovo: next,
    motivo: reason?.trim() || null,
    usuarioId: 'admin'
  });
}

export async function listOpportunities() {
  const rows = await opportunityRows();
  return rows.map(mapOpportunity).sort((a, b) => a.ordem - b.ordem || a.createdAt.localeCompare(b.createdAt));
}

export async function getOpportunity(id: string) {
  const opportunity = await findOpportunity(id);
  const history = await db.select().from(schema.oportunidadeEstagiosHistorico)
    .where(eq(schema.oportunidadeEstagiosHistorico.oportunidadeId, id))
    .orderBy(schema.oportunidadeEstagiosHistorico.createdAt);
  return { ...opportunity, history };
}

export async function getOpportunityOptions() {
  const [clients, leads, budgets] = await Promise.all([
    db.select({ id: schema.clientes.id, name: schema.clientes.nome }).from(schema.clientes)
      .where(isNull(schema.clientes.deletedAt)).orderBy(schema.clientes.nome),
    db.select({ id: schema.contatos.id, name: schema.contatos.nome, company: schema.contatos.empresa })
      .from(schema.contatos)
      .where(and(eq(schema.contatos.status, 'ativo'), isNull(schema.contatos.deletedAt)))
      .orderBy(schema.contatos.nome),
    db.select({
      id: schema.orcamentos.id,
      clientId: schema.orcamentos.clienteId,
      code: schema.orcamentos.codigoOrcamento,
      version: schema.orcamentos.versao,
      description: schema.orcamentos.descricao,
      status: schema.orcamentos.status,
      totalCents: schema.orcamentos.valorTotal,
      projectId: schema.orcamentos.projetoId
    }).from(schema.orcamentos).where(isNull(schema.orcamentos.deletedAt)).orderBy(schema.orcamentos.createdAt)
  ]);
  return { clients, leads, budgets };
}

export async function createOpportunity(input: OpportunityPayload) {
  const id = crypto.randomUUID();
  const stage: OpportunityStage = 'Prospectado';
  await db.transaction(async (tx) => {
    const clientId = input.clienteId || null;
    const leadId = input.leadId || null;
    await assertSubject(clientId, leadId, tx);
    if (input.orcamentoId && !clientId) throw new Error('Converta o lead em cliente antes de vincular um orçamento.');
    const budget = input.orcamentoId && clientId ? await assertBudget(input.orcamentoId, clientId, tx) : null;
    const effectiveStage: OpportunityStage = budget?.status === 'aprovado' ? 'Ganho' : budget ? 'Proposta' : stage;
    const timestamp = nowIso();
    await tx.insert(schema.oportunidades).values({
      id,
      clienteId: clientId,
      leadId,
      titulo: input.titulo.trim(),
      valorEstimado: budget?.valorTotal ?? input.valorEstimado ?? null,
      estagio: effectiveStage,
      ordem: await nextOrder(effectiveStage, tx),
      responsavel: input.responsavel || null,
      origem: input.origem || null,
      servicoTipo: input.servicoTipo || null,
      proximaAcao: input.proximaAcao || null,
      proximaAcaoEm: input.proximaAcaoEm || null,
      previsaoFechamento: input.previsaoFechamento || null,
      probabilidadePontosBase: input.probabilidadePontosBase ?? opportunityStageProbability(effectiveStage),
      observacoes: input.observacoes || null,
      orcamentoId: input.orcamentoId || null,
      projetoId: budget?.projetoId || null,
      encerradoEm: effectiveStage === 'Ganho' ? timestamp : null,
      estagioAlteradoEm: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await insertStageHistory(tx, id, null, effectiveStage, 'Criação da oportunidade');
    await logClientEvent(clientId, {
      projetoId: budget?.projetoId || null,
      orcamentoId: input.orcamentoId || null,
      tipo: 'Oportunidade',
      titulo: `Nova oportunidade: ${input.titulo.trim()}`,
      categoria: 'Comercial',
      descricao: `Estágio: ${effectiveStage} | Valor estimado: ${((budget?.valorTotal ?? input.valorEstimado ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    }, tx);
  });
  return findOpportunity(id);
}

export async function updateOpportunity(id: string, input: OpportunityUpdate) {
  const current = await findOpportunity(id);
  await db.transaction(async (tx) => {
    const clientId = input.clienteId !== undefined ? input.clienteId : current.clienteId;
    const leadId = input.leadId !== undefined ? input.leadId : current.leadId;
    await assertSubject(clientId, leadId, tx);
    const effectiveBudgetId = input.orcamentoId !== undefined ? input.orcamentoId : current.orcamentoId;
    if (effectiveBudgetId && !clientId) {
      throw new Error('Converta o lead em cliente antes de vincular um orçamento.');
    }
    const effectiveBudget = effectiveBudgetId && clientId
      ? await assertBudget(effectiveBudgetId, clientId, tx)
      : null;
    const effectiveProjectId = input.orcamentoId !== undefined && effectiveBudget?.projetoId
      ? effectiveBudget.projetoId
      : current.projetoId;
    if (effectiveProjectId && clientId) {
      const project = await getActiveProject(effectiveProjectId, tx);
      if (project.clienteId !== clientId) {
        throw new Error('O projeto vinculado à oportunidade pertence a outro cliente.');
      }
    }
    if (input.orcamentoId && !clientId) throw new Error('Converta o lead em cliente antes de vincular um orçamento.');
    if (input.orcamentoId && clientId) await assertBudget(input.orcamentoId, clientId, tx);
    await tx.update(schema.oportunidades).set({
      clienteId: input.clienteId,
      leadId: input.leadId,
      titulo: input.titulo?.trim(),
      valorEstimado: input.valorEstimado,
      responsavel: input.responsavel,
      origem: input.origem,
      servicoTipo: input.servicoTipo,
      proximaAcao: input.proximaAcao,
      proximaAcaoEm: input.proximaAcaoEm,
      previsaoFechamento: input.previsaoFechamento,
      probabilidadePontosBase: input.probabilidadePontosBase,
      observacoes: input.observacoes,
      orcamentoId: input.orcamentoId,
      projetoId: input.orcamentoId !== undefined && effectiveBudget?.projetoId
        ? effectiveBudget.projetoId
        : undefined,
      ultimoContatoEm: input.proximaAcao !== undefined ? nowIso() : undefined,
      updatedAt: nowIso()
    }).where(eq(schema.oportunidades.id, id));
    await logClientEvent(clientId, {
      projetoId: effectiveProjectId,
      orcamentoId: effectiveBudgetId,
      tipo: 'Oportunidade',
      titulo: `Oportunidade atualizada: ${input.titulo?.trim() || current.titulo}`,
      categoria: 'Comercial',
      descricao: 'Dados comerciais e próxima ação atualizados.'
    }, tx);
  });
  return findOpportunity(id);
}

export async function transitionOpportunity(id: string, input: OpportunityTransition) {
  const current = await findOpportunity(id);
  const nextStage = input.estagio;
  if (current.estagio === nextStage) return current;
  if (nextStage === 'Ganho' && !current.clienteId) {
    throw new Error('Converta o lead em cliente antes de marcar a oportunidade como ganha.');
  }
  await db.transaction(async (tx) => {
    let projectId = current.projetoId;
    if (nextStage === 'Ganho' && current.orcamentoId && current.clienteId) {
      const budget = await assertBudget(current.orcamentoId, current.clienteId, tx);
      if (budget.status !== 'aprovado') {
        throw new Error('Aprove o orçamento vinculado antes de concluir a oportunidade como ganha.');
      }
      projectId = budget.projetoId;
    }
    const timestamp = nowIso();
    await tx.update(schema.oportunidades).set({
      ordem: sql`${schema.oportunidades.ordem} - 1`
    }).where(and(
      eq(schema.oportunidades.estagio, current.estagio),
      gt(schema.oportunidades.ordem, current.ordem),
      isNull(schema.oportunidades.deletedAt)
    ));
    const targetOrder = input.ordem ?? await nextOrder(nextStage, tx);
    if (input.ordem !== undefined) {
      await tx.update(schema.oportunidades).set({
        ordem: sql`${schema.oportunidades.ordem} + 1`
      }).where(and(
        eq(schema.oportunidades.estagio, nextStage),
        gte(schema.oportunidades.ordem, targetOrder),
        isNull(schema.oportunidades.deletedAt)
      ));
    }
    await tx.update(schema.oportunidades).set({
      estagio: nextStage,
      ordem: targetOrder,
      probabilidadePontosBase: opportunityStageProbability(nextStage),
      motivoPerda: nextStage === 'Perdido' ? input.motivo?.trim() || null : null,
      encerradoEm: nextStage === 'Ganho' || nextStage === 'Perdido' ? input.encerradoEm || timestamp : null,
      projetoId: projectId,
      estagioAlteradoEm: timestamp,
      updatedAt: timestamp
    }).where(eq(schema.oportunidades.id, id));
    await insertStageHistory(tx, id, current.estagio, nextStage, input.motivo);
    await logClientEvent(current.clienteId, {
      projetoId: projectId,
      orcamentoId: current.orcamentoId,
      tipo: 'Oportunidade',
      titulo: `Oportunidade "${current.titulo}" moveu de estágio`,
      categoria: 'Comercial',
      descricao: `De: ${current.estagio} → Para: ${nextStage}${input.motivo ? ` | Motivo: ${input.motivo}` : ''}`
    }, tx);
  });
  return findOpportunity(id);
}

export async function reorderOpportunities(items: ReorderItem[]) {
  const currentRows = await opportunityRows(items.map((item) => item.id));
  const currentById = new Map(currentRows.map((row) => [row.id, normalizeStage(row.estagio)]));
  if (currentRows.length !== new Set(items.map((item) => item.id)).size) throw new Error('Uma ou mais oportunidades não foram encontradas.');
  for (const item of items) {
    if (currentById.get(item.id) !== item.estagio) {
      throw new Error('Use a transição de estágio antes de reordenar entre colunas.');
    }
  }
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.update(schema.oportunidades).set({ ordem: item.ordem, updatedAt: nowIso() })
        .where(eq(schema.oportunidades.id, item.id));
    }
  });
  return { success: true };
}

export async function linkOpportunityBudget(id: string, budgetId: string) {
  const current = await findOpportunity(id);
  if (!current.clienteId) throw new Error('Converta o lead em cliente antes de vincular um orçamento.');
  await db.transaction(async (tx) => {
    const budget = await assertBudget(budgetId, current.clienteId!, tx);
    const nextStage: OpportunityStage = budget.status === 'aprovado' ? 'Ganho' : 'Proposta';
    const timestamp = nowIso();
    if (current.estagio !== nextStage) {
      await tx.update(schema.oportunidades).set({
        ordem: sql`${schema.oportunidades.ordem} - 1`
      }).where(and(
        eq(schema.oportunidades.estagio, current.estagio),
        gt(schema.oportunidades.ordem, current.ordem),
        isNull(schema.oportunidades.deletedAt)
      ));
    }
    await tx.update(schema.oportunidades).set({
      orcamentoId: budget.id,
      projetoId: budget.projetoId,
      valorEstimado: budget.valorTotal,
      estagio: nextStage,
      ordem: current.estagio === nextStage ? current.ordem : await nextOrder(nextStage, tx),
      probabilidadePontosBase: opportunityStageProbability(nextStage),
      encerradoEm: nextStage === 'Ganho' ? timestamp : null,
      estagioAlteradoEm: current.estagio !== nextStage ? timestamp : current.estagioAlteradoEm,
      updatedAt: timestamp
    }).where(eq(schema.oportunidades.id, id));
    if (current.estagio !== nextStage) await insertStageHistory(tx, id, current.estagio, nextStage, 'Orçamento vinculado');
    await logClientEvent(current.clienteId, {
      projetoId: budget.projetoId,
      orcamentoId: budget.id,
      tipo: 'Oportunidade',
      titulo: `Orçamento vinculado à oportunidade: ${current.titulo}`,
      categoria: 'Comercial',
      descricao: `Oportunidade atualizada para ${nextStage}.`
    }, tx);
  });
  return findOpportunity(id);
}

export async function convertOpportunityToProject(id: string, projectName?: string) {
  const current = await findOpportunity(id);
  if (!current.clienteId) throw new Error('Converta o lead em cliente antes de criar um projeto.');
  if (current.projetoId) return { opportunity: current, projectId: current.projetoId, idempotent: true };
  let projectId = '';
  await db.transaction(async (tx) => {
    if (current.orcamentoId) {
      const budget = await assertBudget(current.orcamentoId, current.clienteId!, tx);
      if (budget.status !== 'aprovado' || !budget.projetoId) {
        throw new Error('Aprove o orçamento vinculado para gerar o projeto e o financeiro de forma segura.');
      }
      projectId = budget.projetoId;
    } else {
      if (current.estagio !== 'Ganho') throw new Error('Conclua a oportunidade como ganha antes de criar o projeto.');
      projectId = crypto.randomUUID();
      await tx.insert(schema.projetos).values({
        id: projectId,
        clienteId: current.clienteId!,
        nome: projectName?.trim() || current.titulo,
        descricao: current.observacoes,
        status: 'Em Andamento',
        dataInicio: dateKey(),
        tipo: current.servicoTipo,
        observacoes: `Projeto originado da oportunidade ${current.titulo}.`
      });
    }
    await tx.update(schema.oportunidades).set({ projetoId: projectId, updatedAt: nowIso() }).where(eq(schema.oportunidades.id, id));
    await logClientEvent(current.clienteId, {
      projetoId: projectId,
      orcamentoId: current.orcamentoId,
      tipo: 'Oportunidade',
      titulo: `Projeto vinculado à oportunidade: ${current.titulo}`,
      categoria: 'Conversão',
      descricao: current.orcamentoId ? 'Projeto gerado pela aprovação do orçamento vinculado.' : 'Projeto criado explicitamente a partir da oportunidade ganha.'
    }, tx);
  });
  return { opportunity: await findOpportunity(id), projectId, idempotent: false };
}

export async function deleteOpportunity(id: string) {
  const current = await findOpportunity(id);
  await db.transaction(async (tx) => {
    await tx.update(schema.oportunidades).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(schema.oportunidades.id, id));
    await logClientEvent(current.clienteId, {
      projetoId: current.projetoId,
      orcamentoId: current.orcamentoId,
      tipo: 'Oportunidade',
      titulo: `Oportunidade excluída: ${current.titulo}`,
      categoria: 'Comercial',
      descricao: `Estágio anterior: ${current.estagio}`
    }, tx);
  });
}

export async function getOpportunityAnalytics(): Promise<OpportunityAnalytics> {
  const opportunities = await listOpportunities();
  const counts = Object.fromEntries(OPPORTUNITY_STAGES.map((stage) => [stage, 0])) as Record<OpportunityStage, number>;
  const values = Object.fromEntries(OPPORTUNITY_STAGES.map((stage) => [stage, 0])) as Record<OpportunityStage, number>;
  const daysByStage = Object.fromEntries(OPPORTUNITY_STAGES.map((stage) => [stage, [] as number[]])) as Record<OpportunityStage, number[]>;
  const today = dateKey();
  const now = Date.now();
  const staleThreshold = now - 14 * 86_400_000;
  let overdueNextActions = 0;
  let staleOpportunities = 0;

  for (const opportunity of opportunities) {
    counts[opportunity.estagio] += 1;
    values[opportunity.estagio] += opportunity.valorEstimado || 0;
    const enteredAt = Date.parse(opportunity.estagioAlteradoEm);
    if (Number.isFinite(enteredAt)) daysByStage[opportunity.estagio].push(Math.max(0, Math.floor((now - enteredAt) / 86_400_000)));
    if (isActiveOpportunityStage(opportunity.estagio)) {
      if (opportunity.proximaAcaoEm && opportunity.proximaAcaoEm < today) overdueNextActions += 1;
      if (Number.isFinite(enteredAt) && enteredAt < staleThreshold) staleOpportunities += 1;
    }
  }

  const active = opportunities.filter((item) => isActiveOpportunityStage(item.estagio));
  const closedCount = counts.Ganho + counts.Perdido;
  const averageDaysInStage = Object.fromEntries(OPPORTUNITY_STAGES.map((stage) => {
    const valuesForStage = daysByStage[stage];
    return [stage, valuesForStage.length ? Math.round(valuesForStage.reduce((sum, value) => sum + value, 0) / valuesForStage.length) : 0];
  })) as Record<OpportunityStage, number>;

  return {
    total: opportunities.length,
    activeCount: active.length,
    wonCount: counts.Ganho,
    lostCount: counts.Perdido,
    openPipelineCents: active.reduce((sum, item) => sum + (item.valorEstimado || 0), 0),
    weightedPipelineCents: active.reduce((sum, item) => sum + Math.round((item.valorEstimado || 0) * item.probabilidadePontosBase / 10_000), 0),
    wonValueCents: values.Ganho,
    conversionBasisPoints: closedCount ? Math.round(counts.Ganho * 10_000 / closedCount) : 0,
    overdueNextActions,
    staleOpportunities,
    counts,
    values,
    averageDaysInStage
  };
}
