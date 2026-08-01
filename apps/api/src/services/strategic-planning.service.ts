import crypto from 'crypto';
import { and, asc, desc, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm';
import type {
  StrategicCheckinPayload,
  StrategicCheckinUpdate,
  StrategicCyclePayload,
  StrategicCycleUpdate,
  StrategicDecisionPayload,
  StrategicDecisionUpdate,
  StrategicInitiativePayload,
  StrategicInitiativeUpdate,
  StrategicKeyResultPayload,
  StrategicKeyResultUpdate,
  StrategicObjectivePayload,
  StrategicObjectiveUpdate,
  StrategicPillarPayload,
  StrategicPillarUpdate,
  StrategicRiskPayload,
  StrategicRiskUpdate,
  StrategicSourceOption
} from '@geogestor/contracts';
import { StrategicSourceTypeSchema } from '@geogestor/contracts';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from './audit.service';

const nowIso = () => new Date().toISOString();
const todayKey = () => nowIso().slice(0, 10);
type CycleRow = typeof schema.ciclosEstrategicos.$inferSelect;
type PillarRow = typeof schema.pilaresEstrategicos.$inferSelect;
type ObjectiveRow = typeof schema.objetivosEstrategicos.$inferSelect;
type KeyResultRow = typeof schema.resultadosChave.$inferSelect;
type InitiativeRow = typeof schema.iniciativasEstrategicas.$inferSelect;
type CheckinRow = typeof schema.checkinsEstrategicos.$inferSelect;
type RiskRow = typeof schema.riscosEstrategicos.$inferSelect;
type DecisionRow = typeof schema.decisoesEstrategicas.$inferSelect;
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type ProgressSnapshot = {
  progressoGeral: number | null;
  objetivos: Array<{ id: string; titulo: string; progresso: number | null }>;
  riscos: Array<{ id: string; impacto: string; probabilidade: string; status: string }>;
  iniciativas: Array<{ id: string; status: string; atrasada: boolean }>;
  decisoes: Array<{ id: string; status: string }>;
  dadosDesatualizados: number;
};
type SnapshotCaptureInput = {
  objetivos: Array<{ id: string; titulo: string; progresso?: number | null }>;
  riscos: Array<{ id: string; impacto: string; probabilidade: string; status: string }>;
  iniciativas: Array<{ id: string; status: string; atrasada: boolean }>;
  decisoes: Array<{ id: string; status: string }>;
  resumo: { progressoGeral: number | null; dadosDesatualizados: number };
};

const SOURCE_OPTIONS: StrategicSourceOption[] = [
  {
    tipo: 'financeiro',
    codigo: 'financeiro_resultado_caixa',
    nome: 'Resultado de caixa',
    regra: 'Recebimentos confirmados menos despesas pagas no período do ciclo.',
    periodo: 'Período do ciclo estratégico',
    rota: '/financeiro',
    unidade: 'BRL'
  },
  {
    tipo: 'crm',
    codigo: 'crm_taxa_conversao',
    nome: 'Taxa de conversão comercial',
    regra: 'Oportunidades ganhas divididas pelas oportunidades encerradas no período.',
    periodo: 'Período do ciclo estratégico',
    rota: '/crm',
    unidade: '%'
  },
  {
    tipo: 'projetos',
    codigo: 'projetos_taxa_conclusao',
    nome: 'Taxa de conclusão de projetos',
    regra: 'Projetos concluídos divididos pelos projetos ativos no período do ciclo.',
    periodo: 'Período do ciclo estratégico',
    rota: '/projetos',
    unidade: '%'
  },
  {
    tipo: 'tarefas',
    codigo: 'tarefas_taxa_conclusao',
    nome: 'Taxa de conclusão de tarefas',
    regra: 'Tarefas concluídas divididas pelas tarefas com prazo no período do ciclo.',
    periodo: 'Período do ciclo estratégico',
    rota: '/tarefas',
    unidade: '%'
  }
];

function ensureFound<T>(rows: T[], message: string): T {
  if (!rows.length) throw new Error(message);
  return rows[0];
}

async function findCycle(id: string, tx: DbOrTx = db): Promise<CycleRow> {
  return ensureFound(
    await tx.select().from(schema.ciclosEstrategicos)
      .where(and(eq(schema.ciclosEstrategicos.id, id), isNull(schema.ciclosEstrategicos.deletedAt))).limit(1) as CycleRow[],
    'Ciclo estratégico não encontrado.'
  );
}

async function findPillar(id: string, tx: DbOrTx = db): Promise<PillarRow> {
  return ensureFound(
    await tx.select().from(schema.pilaresEstrategicos)
      .where(and(eq(schema.pilaresEstrategicos.id, id), isNull(schema.pilaresEstrategicos.deletedAt))).limit(1) as PillarRow[],
    'Pilar estratégico não encontrado.'
  );
}

async function findObjective(id: string, tx: DbOrTx = db): Promise<ObjectiveRow> {
  return ensureFound(
    await tx.select().from(schema.objetivosEstrategicos)
      .where(and(eq(schema.objetivosEstrategicos.id, id), isNull(schema.objetivosEstrategicos.deletedAt))).limit(1) as ObjectiveRow[],
    'Objetivo estratégico não encontrado.'
  );
}

async function findKeyResult(id: string, tx: DbOrTx = db): Promise<KeyResultRow> {
  return ensureFound(
    await tx.select().from(schema.resultadosChave)
      .where(and(eq(schema.resultadosChave.id, id), isNull(schema.resultadosChave.deletedAt))).limit(1) as KeyResultRow[],
    'Resultado-chave não encontrado.'
  );
}

async function findInitiative(id: string, tx: DbOrTx = db): Promise<InitiativeRow> {
  return ensureFound(
    await tx.select().from(schema.iniciativasEstrategicas)
      .where(and(eq(schema.iniciativasEstrategicas.id, id), isNull(schema.iniciativasEstrategicas.deletedAt))).limit(1) as InitiativeRow[],
    'Iniciativa estratégica não encontrada.'
  );
}

async function findCheckin(id: string, tx: DbOrTx = db): Promise<CheckinRow> {
  return ensureFound(
    await tx.select().from(schema.checkinsEstrategicos)
      .where(and(eq(schema.checkinsEstrategicos.id, id), isNull(schema.checkinsEstrategicos.deletedAt))).limit(1) as CheckinRow[],
    'Revisão estratégica não encontrada.'
  );
}

async function findRisk(id: string, tx: DbOrTx = db): Promise<RiskRow> {
  return ensureFound(
    await tx.select().from(schema.riscosEstrategicos)
      .where(and(eq(schema.riscosEstrategicos.id, id), isNull(schema.riscosEstrategicos.deletedAt))).limit(1) as RiskRow[],
    'Risco estratégico não encontrado.'
  );
}

async function findDecision(id: string, tx: DbOrTx = db): Promise<DecisionRow> {
  return ensureFound(
    await tx.select().from(schema.decisoesEstrategicas)
      .where(and(eq(schema.decisoesEstrategicas.id, id), isNull(schema.decisoesEstrategicas.deletedAt))).limit(1) as DecisionRow[],
    'Decisão estratégica não encontrada.'
  );
}

async function activateOnlyCycle(id: string, tx: DbOrTx) {
  await tx.update(schema.ciclosEstrategicos)
    .set({ status: 'em_revisao', updatedAt: nowIso() })
    .where(and(
      ne(schema.ciclosEstrategicos.id, id),
      eq(schema.ciclosEstrategicos.status, 'ativo'),
      isNull(schema.ciclosEstrategicos.deletedAt)
    ));
}

export async function listStrategicCycles() {
  return db.select().from(schema.ciclosEstrategicos)
    .where(isNull(schema.ciclosEstrategicos.deletedAt))
    .orderBy(desc(sql`CASE WHEN ${schema.ciclosEstrategicos.status} = 'ativo' THEN 1 ELSE 0 END`), desc(schema.ciclosEstrategicos.dataInicio));
}

export async function createStrategicCycle(input: StrategicCyclePayload) {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    if (input.status === 'ativo') await activateOnlyCycle(id, tx);
    const created = { id, ...input, proximaRevisao: input.proximaRevisao || null };
    await tx.insert(schema.ciclosEstrategicos).values(created);
    await AuditLogService.log('INSERT', 'Ciclo Estratégico', null, created, tx);
  });
  return findCycle(id);
}

export async function updateStrategicCycle(id: string, input: StrategicCycleUpdate) {
  const current = await findCycle(id);
  const nextStart = input.dataInicio ?? current.dataInicio;
  const nextEnd = input.dataFim ?? current.dataFim;
  if (nextEnd < nextStart) throw new Error('A data final deve ser posterior à data inicial.');
  await db.transaction(async (tx) => {
    if (input.status === 'ativo') await activateOnlyCycle(id, tx);
    await tx.update(schema.ciclosEstrategicos).set({ ...input, updatedAt: nowIso() })
      .where(eq(schema.ciclosEstrategicos.id, id));
    await AuditLogService.log('UPDATE', 'Ciclo Estratégico', current, { ...current, ...input }, tx);
  });
  return findCycle(id);
}

export async function deleteStrategicCycle(id: string) {
  const current = await findCycle(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.ciclosEstrategicos).set({ deletedAt, updatedAt: deletedAt })
      .where(eq(schema.ciclosEstrategicos.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Ciclo Estratégico', current, null, tx);
  });
}

export async function createStrategicPillar(input: StrategicPillarPayload) {
  await findCycle(input.cicloId);
  const id = crypto.randomUUID();
  const created = { id, ...input };
  await db.transaction(async (tx) => {
    await tx.insert(schema.pilaresEstrategicos).values(created);
    await AuditLogService.log('INSERT', 'Pilar Estratégico', null, created, tx);
  });
  return findPillar(id);
}

export async function updateStrategicPillar(id: string, input: StrategicPillarUpdate) {
  const current = await findPillar(id);
  await db.transaction(async (tx) => {
    await tx.update(schema.pilaresEstrategicos).set({ ...input, updatedAt: nowIso() }).where(eq(schema.pilaresEstrategicos.id, id));
    await AuditLogService.log('UPDATE', 'Pilar Estratégico', current, { ...current, ...input }, tx);
  });
  return findPillar(id);
}

export async function deleteStrategicPillar(id: string) {
  const current = await findPillar(id);
  const objectives = await db.select({ id: schema.objetivosEstrategicos.id, titulo: schema.objetivosEstrategicos.titulo }).from(schema.objetivosEstrategicos)
    .where(and(eq(schema.objetivosEstrategicos.pilarId, id), isNull(schema.objetivosEstrategicos.deletedAt)));
  if (objectives.length) {
    const examples = objectives.slice(0, 2).map((item) => `“${item.titulo}”`).join(' e ');
    throw new Error(`Este pilar possui ${objectives.length} ${objectives.length === 1 ? 'objetivo ativo' : 'objetivos ativos'}, incluindo ${examples}. Mova ou exclua ${objectives.length === 1 ? 'esse objetivo' : 'esses objetivos'} antes de remover o pilar.`);
  }
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.pilaresEstrategicos).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.pilaresEstrategicos.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Pilar Estratégico', current, null, tx);
  });
}

export async function createStrategicObjective(input: StrategicObjectivePayload) {
  const [cycle, pillar] = await Promise.all([findCycle(input.cicloId), findPillar(input.pilarId)]);
  if (pillar.cicloId !== cycle.id) throw new Error('O pilar selecionado não pertence ao ciclo estratégico.');
  const id = crypto.randomUUID();
  const created = { id, ...input };
  await db.transaction(async (tx) => {
    await tx.insert(schema.objetivosEstrategicos).values(created);
    await AuditLogService.log('INSERT', 'Objetivo Estratégico', null, created, tx);
  });
  return findObjective(id);
}

export async function updateStrategicObjective(id: string, input: StrategicObjectiveUpdate) {
  const current = await findObjective(id);
  if (input.pilarId) {
    const pillar = await findPillar(input.pilarId);
    if (pillar.cicloId !== current.cicloId) throw new Error('O pilar selecionado não pertence ao ciclo estratégico.');
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.objetivosEstrategicos).set({ ...input, updatedAt: nowIso() }).where(eq(schema.objetivosEstrategicos.id, id));
    await AuditLogService.log('UPDATE', 'Objetivo Estratégico', current, { ...current, ...input }, tx);
  });
  return findObjective(id);
}

export async function deleteStrategicObjective(id: string) {
  const current = await findObjective(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.objetivosEstrategicos).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.objetivosEstrategicos.id, id));
    await tx.update(schema.resultadosChave).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.resultadosChave.objetivoId, id));
    await tx.update(schema.iniciativasEstrategicas).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.iniciativasEstrategicas.objetivoId, id));
    await AuditLogService.log('DELETE (SOFT)', 'Objetivo Estratégico', current, null, tx);
  });
}

function sourceOption(type: string, code: string | null | undefined) {
  return SOURCE_OPTIONS.find((item) => item.tipo === type && item.codigo === code);
}

async function validateKeyResultSource(input: StrategicKeyResultPayload | StrategicKeyResultUpdate) {
  const type = input.fonteTipo;
  if (type && type !== 'manual' && !sourceOption(type, input.fonteCodigo)) {
    throw new Error('A fonte automática selecionada não está disponível.');
  }
}

export async function createStrategicKeyResult(input: StrategicKeyResultPayload) {
  await findObjective(input.objetivoId);
  await validateKeyResultSource(input);
  const id = crypto.randomUUID();
  const option = sourceOption(input.fonteTipo, input.fonteCodigo);
  const created = {
    id,
    ...input,
    fonteRegra: option?.regra ?? input.fonteRegra ?? null,
    fontePeriodo: option?.periodo ?? input.fontePeriodo ?? null,
    fonteRota: option?.rota ?? input.fonteRota ?? null,
    ultimaAtualizacao: input.fonteTipo === 'manual' ? input.ultimaAtualizacao || nowIso() : null
  };
  await db.transaction(async (tx) => {
    await tx.insert(schema.resultadosChave).values(created);
    await AuditLogService.log('INSERT', 'Resultado-chave', null, created, tx);
  });
  return findKeyResult(id);
}

export async function updateStrategicKeyResult(id: string, input: StrategicKeyResultUpdate) {
  const current = await findKeyResult(id);
  const sourceType = StrategicSourceTypeSchema.parse(input.fonteTipo ?? current.fonteTipo);
  const sourceCode = input.fonteCodigo !== undefined ? input.fonteCodigo : current.fonteCodigo;
  await validateKeyResultSource({ ...input, fonteTipo: sourceType, fonteCodigo: sourceCode });
  const option = sourceOption(sourceType, sourceCode);
  const patch = {
    ...input,
    fonteRegra: option?.regra ?? input.fonteRegra,
    fontePeriodo: option?.periodo ?? input.fontePeriodo,
    fonteRota: option?.rota ?? input.fonteRota,
    ultimaAtualizacao: sourceType === 'manual' && input.valorAtual !== undefined ? nowIso() : input.ultimaAtualizacao,
    updatedAt: nowIso()
  };
  await db.transaction(async (tx) => {
    await tx.update(schema.resultadosChave).set(patch).where(eq(schema.resultadosChave.id, id));
    await AuditLogService.log('UPDATE', 'Resultado-chave', current, { ...current, ...patch }, tx);
  });
  return findKeyResult(id);
}

export async function deleteStrategicKeyResult(id: string) {
  const current = await findKeyResult(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.resultadosChave).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.resultadosChave.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Resultado-chave', current, null, tx);
  });
}

async function validateInitiativeLinks(input: StrategicInitiativePayload | StrategicInitiativeUpdate) {
  if (input.projetoId) {
    ensureFound(
      await db.select({ id: schema.projetos.id }).from(schema.projetos)
        .where(and(eq(schema.projetos.id, input.projetoId), isNull(schema.projetos.deletedAt))).limit(1),
      'Projeto vinculado não encontrado.'
    );
  }
  if (input.tarefaId) {
    ensureFound(
      await db.select({ id: schema.tarefas.id }).from(schema.tarefas)
        .where(and(eq(schema.tarefas.id, input.tarefaId), isNull(schema.tarefas.deletedAt))).limit(1),
      'Tarefa vinculada não encontrada.'
    );
  }
}

export async function createStrategicInitiative(input: StrategicInitiativePayload) {
  await findObjective(input.objetivoId);
  await validateInitiativeLinks(input);
  const id = crypto.randomUUID();
  const created = { id, ...input };
  await db.transaction(async (tx) => {
    await tx.insert(schema.iniciativasEstrategicas).values(created);
    await AuditLogService.log('INSERT', 'Iniciativa Estratégica', null, created, tx);
  });
  return findInitiative(id);
}

export async function updateStrategicInitiative(id: string, input: StrategicInitiativeUpdate) {
  const current = await findInitiative(id);
  await validateInitiativeLinks(input);
  await db.transaction(async (tx) => {
    await tx.update(schema.iniciativasEstrategicas).set({ ...input, updatedAt: nowIso() }).where(eq(schema.iniciativasEstrategicas.id, id));
    await AuditLogService.log('UPDATE', 'Iniciativa Estratégica', current, { ...current, ...input }, tx);
  });
  return findInitiative(id);
}

function strategicSnapshotValues(
  cycleId: string,
  checkinId: string,
  reviewDate: string,
  snapshot: SnapshotCaptureInput,
  extraDecisions: Array<{ id: string; status: string }> = []
) {
  return {
    id: crypto.randomUUID(),
    cicloId: cycleId,
    checkinId,
    capturadoEm: `${reviewDate}T12:00:00.000Z`,
    progressoGeral: snapshot.resumo.progressoGeral,
    objetivosJson: JSON.stringify(snapshot.objetivos.map((item) => ({ id: item.id, titulo: item.titulo, progresso: item.progresso ?? null }))),
    riscosJson: JSON.stringify(snapshot.riscos.map((item) => ({ id: item.id, impacto: item.impacto, probabilidade: item.probabilidade, status: item.status }))),
    iniciativasJson: JSON.stringify(snapshot.iniciativas.map((item) => ({ id: item.id, status: item.status, atrasada: item.atrasada }))),
    decisoesJson: JSON.stringify([
      ...snapshot.decisoes.map((item) => ({ id: item.id, status: item.status })),
      ...extraDecisions
    ]),
    dadosDesatualizados: snapshot.resumo.dadosDesatualizados
  };
}

export async function deleteStrategicInitiative(id: string) {
  const current = await findInitiative(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.iniciativasEstrategicas).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.iniciativasEstrategicas.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Iniciativa Estratégica', current, null, tx);
  });
}

export async function createStrategicCheckin(input: StrategicCheckinPayload) {
  await findCycle(input.cicloId);
  if (input.objetivoId) {
    const objective = await findObjective(input.objetivoId);
    if (objective.cicloId !== input.cicloId) throw new Error('O objetivo não pertence ao ciclo selecionado.');
  }
  const id = crypto.randomUUID();
  const created = { id, ...input };
  const currentSnapshot = await getStrategicSnapshot(input.cicloId);
  const legacyDecision = input.decisoesPendentes?.trim() ? {
    id: crypto.randomUUID(),
    cicloId: input.cicloId,
    checkinId: id,
    objetivoId: input.objetivoId || null,
    descricao: input.decisoesPendentes.trim(),
    responsavel: 'Responsável não definido',
    prazo: input.proximaRevisao || currentSnapshot.ciclo.proximaRevisao || input.data,
    status: 'pendente',
    concluidaEm: null,
    observacaoEncerramento: 'Decisão criada a partir do campo textual de compatibilidade.'
  } : null;
  await db.transaction(async (tx) => {
    await tx.insert(schema.checkinsEstrategicos).values(created);
    if (legacyDecision) {
      await tx.insert(schema.decisoesEstrategicas).values(legacyDecision);
      await AuditLogService.log('INSERT', 'Decisão Estratégica', null, legacyDecision, tx);
    }
    await tx.insert(schema.snapshotsEstrategicos).values(strategicSnapshotValues(
      input.cicloId,
      id,
      input.data,
      currentSnapshot,
      legacyDecision ? [{ id: legacyDecision.id, status: legacyDecision.status }] : []
    ));
    if (input.proximaRevisao) {
      await tx.update(schema.ciclosEstrategicos).set({ proximaRevisao: input.proximaRevisao, updatedAt: nowIso() })
        .where(eq(schema.ciclosEstrategicos.id, input.cicloId));
    }
    await AuditLogService.log('INSERT', 'Revisão Estratégica', null, created, tx);
  });
  return findCheckin(id);
}

export async function updateStrategicCheckin(id: string, input: StrategicCheckinUpdate) {
  const current = await findCheckin(id);
  if (input.objetivoId) {
    const objective = await findObjective(input.objetivoId);
    if (objective.cicloId !== current.cicloId) throw new Error('O objetivo não pertence ao ciclo selecionado.');
  }
  const currentSnapshot = await getStrategicSnapshot(current.cicloId);
  const reviewDate = input.data || current.data;
  const snapshotValues = strategicSnapshotValues(current.cicloId, id, reviewDate, currentSnapshot);
  await db.transaction(async (tx) => {
    await tx.update(schema.checkinsEstrategicos).set({ ...input, updatedAt: nowIso() }).where(eq(schema.checkinsEstrategicos.id, id));
    await AuditLogService.log('UPDATE', 'Revisão Estratégica', current, { ...current, ...input }, tx);
    await tx.insert(schema.snapshotsEstrategicos).values(snapshotValues).onConflictDoUpdate({
      target: schema.snapshotsEstrategicos.checkinId,
      set: {
        capturadoEm: snapshotValues.capturadoEm,
        progressoGeral: snapshotValues.progressoGeral,
        objetivosJson: snapshotValues.objetivosJson,
        riscosJson: snapshotValues.riscosJson,
        iniciativasJson: snapshotValues.iniciativasJson,
        decisoesJson: snapshotValues.decisoesJson,
        dadosDesatualizados: snapshotValues.dadosDesatualizados,
        updatedAt: nowIso()
      }
    });
  });
  return findCheckin(id);
}

export async function deleteStrategicCheckin(id: string) {
  const current = await findCheckin(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.checkinsEstrategicos).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.checkinsEstrategicos.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Revisão Estratégica', current, null, tx);
  });
}

export async function createStrategicRisk(input: StrategicRiskPayload) {
  await findCycle(input.cicloId);
  if (input.objetivoId) {
    const objective = await findObjective(input.objetivoId);
    if (objective.cicloId !== input.cicloId) throw new Error('O objetivo não pertence ao ciclo selecionado.');
  }
  if (input.iniciativaId) {
    const initiative = await findInitiative(input.iniciativaId);
    const objective = await findObjective(initiative.objetivoId);
    if (objective.cicloId !== input.cicloId) throw new Error('A iniciativa não pertence ao ciclo selecionado.');
  }
  const id = crypto.randomUUID();
  const created = { id, ...input };
  await db.transaction(async (tx) => {
    await tx.insert(schema.riscosEstrategicos).values(created);
    await AuditLogService.log('INSERT', 'Risco Estratégico', null, created, tx);
  });
  return findRisk(id);
}

export async function updateStrategicRisk(id: string, input: StrategicRiskUpdate) {
  const current = await findRisk(id);
  await db.transaction(async (tx) => {
    await tx.update(schema.riscosEstrategicos).set({ ...input, updatedAt: nowIso() }).where(eq(schema.riscosEstrategicos.id, id));
    await AuditLogService.log('UPDATE', 'Risco Estratégico', current, { ...current, ...input }, tx);
  });
  return findRisk(id);
}

export async function deleteStrategicRisk(id: string) {
  const current = await findRisk(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.riscosEstrategicos).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.riscosEstrategicos.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Risco Estratégico', current, null, tx);
  });
}

async function validateDecisionRelations(input: StrategicDecisionPayload | StrategicDecisionUpdate, currentCycleId?: string) {
  const cycleId = 'cicloId' in input ? input.cicloId : currentCycleId;
  if (!cycleId) throw new Error('O ciclo da decisão não foi identificado. Reabra o planejamento e tente novamente.');
  await findCycle(cycleId);
  if (input.checkinId) {
    const checkin = await findCheckin(input.checkinId);
    if (checkin.cicloId !== cycleId) throw new Error('A revisão selecionada pertence a outro ciclo. Escolha uma revisão deste planejamento.');
  }
  if (input.objetivoId) {
    const objective = await findObjective(input.objetivoId);
    if (objective.cicloId !== cycleId) throw new Error('O objetivo selecionado pertence a outro ciclo. Escolha um objetivo deste planejamento.');
  }
}

function normalizeDecisionCompletion(input: StrategicDecisionPayload | StrategicDecisionUpdate, current?: DecisionRow) {
  const status = input.status ?? current?.status ?? 'pendente';
  const closureNote = input.observacaoEncerramento !== undefined
    ? input.observacaoEncerramento
    : current?.observacaoEncerramento;
  const isNewCompletion = status === 'concluida' && current?.status !== 'concluida';
  if (status === 'concluida' && (!closureNote?.trim() || (isNewCompletion && !input.observacaoEncerramento?.trim()))) {
    throw new Error('Explique como a decisão foi concluída para preservar o histórico e finalize novamente.');
  }
  return {
    status,
    concluidaEm: status === 'concluida'
      ? input.concluidaEm || current?.concluidaEm || nowIso()
      : null,
    observacaoEncerramento: closureNote || null
  };
}

export async function createStrategicDecision(input: StrategicDecisionPayload) {
  await validateDecisionRelations(input);
  const id = crypto.randomUUID();
  const completion = normalizeDecisionCompletion(input);
  const created = { ...input, ...completion, id };
  await db.transaction(async (tx) => {
    await tx.insert(schema.decisoesEstrategicas).values(created);
    await AuditLogService.log('INSERT', 'Decisão Estratégica', null, created, tx);
  });
  return findDecision(id);
}

export async function updateStrategicDecision(id: string, input: StrategicDecisionUpdate) {
  const current = await findDecision(id);
  await validateDecisionRelations(input, current.cicloId);
  const completion = normalizeDecisionCompletion(input, current);
  const patch = { ...input, ...completion, updatedAt: nowIso() };
  await db.transaction(async (tx) => {
    await tx.update(schema.decisoesEstrategicas).set(patch).where(eq(schema.decisoesEstrategicas.id, id));
    await AuditLogService.log('UPDATE', 'Decisão Estratégica', current, { ...current, ...patch }, tx);
  });
  return findDecision(id);
}

export async function deleteStrategicDecision(id: string) {
  const current = await findDecision(id);
  const deletedAt = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(schema.decisoesEstrategicas).set({ deletedAt, updatedAt: deletedAt }).where(eq(schema.decisoesEstrategicas.id, id));
    await AuditLogService.log('DELETE (SOFT)', 'Decisão Estratégica', current, null, tx);
  });
}

async function automaticValue(code: string, cycle: { dataInicio: string; dataFim: string }) {
  const updatedAt = nowIso();
  if (code === 'financeiro_resultado_caixa') {
    const [receipts, expenses] = await Promise.all([
      db.select({ total: sql<number>`coalesce(sum(${schema.recebimentos.valorRecebido}), 0)`, count: sql<number>`count(*)` })
        .from(schema.recebimentos)
        .where(and(
          isNull(schema.recebimentos.deletedAt),
          isNull(schema.recebimentos.estornadoEm),
          gte(schema.recebimentos.dataRecebimento, cycle.dataInicio),
          lte(schema.recebimentos.dataRecebimento, cycle.dataFim)
        )),
      db.select({ total: sql<number>`coalesce(sum(${schema.despesas.valor}), 0)`, count: sql<number>`count(*)` })
        .from(schema.despesas)
        .where(and(
          isNull(schema.despesas.deletedAt),
          isNull(schema.despesas.canceladaEm),
          isNull(schema.despesas.estornadaEm),
          eq(schema.despesas.status, 'Pago'),
          gte(sql`coalesce(${schema.despesas.dataPagamento}, ${schema.despesas.data})`, cycle.dataInicio),
          lte(sql`coalesce(${schema.despesas.dataPagamento}, ${schema.despesas.data})`, cycle.dataFim)
        ))
    ]);
    const records = Number(receipts[0]?.count || 0) + Number(expenses[0]?.count || 0);
    return records
      ? { valor: (Number(receipts[0]?.total || 0) - Number(expenses[0]?.total || 0)) / 100, updatedAt }
      : { valor: null, updatedAt: null };
  }
  if (code === 'crm_taxa_conversao') {
    const rows = await db.select({
      won: sql<number>`sum(CASE WHEN ${schema.oportunidades.estagio} = 'Ganho' THEN 1 ELSE 0 END)`,
      closed: sql<number>`sum(CASE WHEN ${schema.oportunidades.estagio} IN ('Ganho', 'Perdido') THEN 1 ELSE 0 END)`
    }).from(schema.oportunidades).where(and(
      isNull(schema.oportunidades.deletedAt),
      gte(sql`substr(coalesce(${schema.oportunidades.encerradoEm}, ${schema.oportunidades.updatedAt}), 1, 10)`, cycle.dataInicio),
      lte(sql`substr(coalesce(${schema.oportunidades.encerradoEm}, ${schema.oportunidades.updatedAt}), 1, 10)`, cycle.dataFim)
    ));
    const closed = Number(rows[0]?.closed || 0);
    return { valor: closed ? Number(rows[0]?.won || 0) * 100 / closed : null, updatedAt };
  }
  if (code === 'projetos_taxa_conclusao') {
    const rows = await db.select({
      completed: sql<number>`sum(CASE WHEN lower(${schema.projetos.status}) IN ('concluído', 'concluido', 'finalizado') THEN 1 ELSE 0 END)`,
      total: sql<number>`count(*)`
    }).from(schema.projetos).where(and(
      isNull(schema.projetos.deletedAt),
      lte(sql`coalesce(${schema.projetos.dataInicio}, substr(${schema.projetos.createdAt}, 1, 10))`, cycle.dataFim),
      gte(sql`coalesce(${schema.projetos.dataEntrega}, ${schema.projetos.dataInicio}, substr(${schema.projetos.createdAt}, 1, 10))`, cycle.dataInicio)
    ));
    const total = Number(rows[0]?.total || 0);
    return { valor: total ? Number(rows[0]?.completed || 0) * 100 / total : null, updatedAt };
  }
  if (code === 'tarefas_taxa_conclusao') {
    const rows = await db.select({
      completed: sql<number>`sum(CASE WHEN lower(${schema.tarefas.status}) IN ('concluída', 'concluida', 'concluído', 'concluido') THEN 1 ELSE 0 END)`,
      total: sql<number>`count(*)`
    }).from(schema.tarefas).where(and(
      isNull(schema.tarefas.deletedAt),
      gte(schema.tarefas.dataLimite, cycle.dataInicio),
      lte(schema.tarefas.dataLimite, cycle.dataFim)
    ));
    const total = Number(rows[0]?.total || 0);
    return { valor: total ? Number(rows[0]?.completed || 0) * 100 / total : null, updatedAt };
  }
  return { valor: null, updatedAt: null };
}

function progressFor(result: { linhaBase: number; meta: number; valorAtual: number | null; direcao: string }) {
  if (result.valorAtual === null || !Number.isFinite(result.valorAtual)) return null;
  if (result.direcao === 'manter') {
    const tolerance = Math.max(Math.abs(result.meta) * 0.05, 0.01);
    return Math.max(0, Math.min(100, 100 - Math.abs(result.valorAtual - result.meta) / tolerance * 100));
  }
  const range = result.direcao === 'reduzir'
    ? result.linhaBase - result.meta
    : result.meta - result.linhaBase;
  if (range === 0) return result.valorAtual === result.meta ? 100 : 0;
  const moved = result.direcao === 'reduzir'
    ? result.linhaBase - result.valorAtual
    : result.valorAtual - result.linhaBase;
  return Math.max(0, Math.min(100, moved / range * 100));
}

function progressFormula(result: { direcao: string; meta: number }) {
  if (result.direcao === 'reduzir') return '(linha de base − valor atual) ÷ (linha de base − meta) × 100';
  if (result.direcao === 'manter') {
    const tolerance = Math.max(Math.abs(result.meta) * 0.05, 0.01);
    return `100 − (distância até a meta ÷ tolerância de ${tolerance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}) × 100`;
  }
  return '(valor atual − linha de base) ÷ (meta − linha de base) × 100';
}

function staleAfterDays(frequency: string) {
  return ({ semanal: 10, mensal: 40, trimestral: 110, semestral: 210, anual: 400 } as Record<string, number>)[frequency] || 40;
}

function parseSnapshotJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function deserializeProgressSnapshot(row: typeof schema.snapshotsEstrategicos.$inferSelect): ProgressSnapshot {
  return {
    progressoGeral: row.progressoGeral,
    objetivos: parseSnapshotJson(row.objetivosJson, []),
    riscos: parseSnapshotJson(row.riscosJson, []),
    iniciativas: parseSnapshotJson(row.iniciativasJson, []),
    decisoes: parseSnapshotJson(row.decisoesJson, []),
    dadosDesatualizados: row.dadosDesatualizados
  };
}

function trendSummary(snapshotRows: Array<typeof schema.snapshotsEstrategicos.$inferSelect>) {
  if (snapshotRows.length < 2) {
    return {
      disponivel: false,
      motivo: 'Registre pelo menos duas revisões para comparar a evolução sem estimativas.',
      revisaoAnterior: null,
      revisaoAtual: snapshotRows[0]?.capturadoEm || null,
      progressoAnterior: null,
      progressoAtual: snapshotRows[0]?.progressoGeral ?? null,
      variacaoProgresso: null,
      objetivosMelhoraram: [],
      objetivosPioraram: [],
      riscosNovos: 0,
      riscosAgravados: 0,
      riscosMitigados: 0,
      riscosResolvidos: 0,
      iniciativasConcluidas: 0,
      iniciativasAtrasadas: 0,
      iniciativasBloqueadas: 0,
      decisoesAbertas: 0,
      decisoesConcluidas: 0,
      dadosDesatualizados: snapshotRows[0]?.dadosDesatualizados || 0
    };
  }
  const currentRow = snapshotRows[0];
  const previousRow = snapshotRows[1];
  const current = deserializeProgressSnapshot(currentRow);
  const previous = deserializeProgressSnapshot(previousRow);
  const previousObjectives = new Map(previous.objetivos.map((item) => [item.id, item]));
  const objectiveChanges = current.objetivos.flatMap((objective) => {
    const before = previousObjectives.get(objective.id);
    if (objective.progresso == null || before?.progresso == null) return [];
    const variation = objective.progresso - before.progresso;
    return Math.abs(variation) < 0.05 ? [] : [{ id: objective.id, titulo: objective.titulo, variacao: variation }];
  });
  const previousRisks = new Map(previous.riscos.map((item) => [item.id, item]));
  const level = (value: string) => ({ baixo: 1, medio: 2, alto: 3, critico: 4 } as Record<string, number>)[value] || 0;
  const previousInitiatives = new Map(previous.iniciativas.map((item) => [item.id, item]));
  const previousDecisions = new Map(previous.decisoes.map((item) => [item.id, item]));
  const variationProgress = current.progressoGeral != null && previous.progressoGeral != null
    ? current.progressoGeral - previous.progressoGeral
    : null;
  return {
    disponivel: true,
    motivo: null,
    revisaoAnterior: previousRow.capturadoEm,
    revisaoAtual: currentRow.capturadoEm,
    progressoAnterior: previous.progressoGeral,
    progressoAtual: current.progressoGeral,
    variacaoProgresso: variationProgress,
    objetivosMelhoraram: objectiveChanges.filter((item) => item.variacao > 0).sort((a, b) => b.variacao - a.variacao),
    objetivosPioraram: objectiveChanges.filter((item) => item.variacao < 0).sort((a, b) => a.variacao - b.variacao),
    riscosNovos: current.riscos.filter((item) => !previousRisks.has(item.id)).length,
    riscosAgravados: current.riscos.filter((item) => {
      const before = previousRisks.get(item.id);
      return before && (level(item.impacto) > level(before.impacto) || level(item.probabilidade) > level(before.probabilidade));
    }).length,
    riscosMitigados: current.riscos.filter((item) => previousRisks.get(item.id)?.status !== 'mitigando' && item.status === 'mitigando').length,
    riscosResolvidos: current.riscos.filter((item) => previousRisks.get(item.id)?.status !== 'resolvido' && item.status === 'resolvido').length,
    iniciativasConcluidas: current.iniciativas.filter((item) => previousInitiatives.get(item.id)?.status !== 'concluida' && item.status === 'concluida').length,
    iniciativasAtrasadas: current.iniciativas.filter((item) => item.atrasada).length,
    iniciativasBloqueadas: current.iniciativas.filter((item) => item.status === 'bloqueada').length,
    decisoesAbertas: current.decisoes.filter((item) => ['pendente', 'em_andamento'].includes(item.status)).length,
    decisoesConcluidas: current.decisoes.filter((item) => previousDecisions.get(item.id)?.status !== 'concluida' && item.status === 'concluida').length,
    dadosDesatualizados: current.dadosDesatualizados
  };
}

export async function getStrategicSnapshot(cycleId: string) {
  const cycle = await findCycle(cycleId);
  const [pillars, objectives, storedResults, initiatives, checkins, risks, decisions, storedSnapshots] = await Promise.all([
    db.select().from(schema.pilaresEstrategicos)
      .where(and(eq(schema.pilaresEstrategicos.cicloId, cycleId), isNull(schema.pilaresEstrategicos.deletedAt)))
      .orderBy(asc(schema.pilaresEstrategicos.ordem), asc(schema.pilaresEstrategicos.nome)),
    db.select().from(schema.objetivosEstrategicos)
      .where(and(eq(schema.objetivosEstrategicos.cicloId, cycleId), isNull(schema.objetivosEstrategicos.deletedAt)))
      .orderBy(asc(schema.objetivosEstrategicos.ordem), asc(schema.objetivosEstrategicos.dataLimite)),
    db.select().from(schema.resultadosChave)
      .innerJoin(schema.objetivosEstrategicos, eq(schema.resultadosChave.objetivoId, schema.objetivosEstrategicos.id))
      .where(and(
        eq(schema.objetivosEstrategicos.cicloId, cycleId),
        isNull(schema.objetivosEstrategicos.deletedAt),
        isNull(schema.resultadosChave.deletedAt)
      )),
    db.select().from(schema.iniciativasEstrategicas)
      .innerJoin(schema.objetivosEstrategicos, eq(schema.iniciativasEstrategicas.objetivoId, schema.objetivosEstrategicos.id))
      .where(and(
        eq(schema.objetivosEstrategicos.cicloId, cycleId),
        isNull(schema.objetivosEstrategicos.deletedAt),
        isNull(schema.iniciativasEstrategicas.deletedAt)
      ))
      .orderBy(asc(schema.iniciativasEstrategicas.dataLimite)),
    db.select().from(schema.checkinsEstrategicos)
      .where(and(eq(schema.checkinsEstrategicos.cicloId, cycleId), isNull(schema.checkinsEstrategicos.deletedAt)))
      .orderBy(desc(schema.checkinsEstrategicos.data), desc(schema.checkinsEstrategicos.createdAt)),
    db.select().from(schema.riscosEstrategicos)
      .where(and(eq(schema.riscosEstrategicos.cicloId, cycleId), isNull(schema.riscosEstrategicos.deletedAt)))
      .orderBy(desc(schema.riscosEstrategicos.createdAt)),
    db.select().from(schema.decisoesEstrategicas)
      .where(and(eq(schema.decisoesEstrategicas.cicloId, cycleId), isNull(schema.decisoesEstrategicas.deletedAt)))
      .orderBy(asc(schema.decisoesEstrategicas.prazo), desc(schema.decisoesEstrategicas.updatedAt)),
    db.select().from(schema.snapshotsEstrategicos)
      .where(and(eq(schema.snapshotsEstrategicos.cicloId, cycleId), isNull(schema.snapshotsEstrategicos.deletedAt)))
      .orderBy(desc(schema.snapshotsEstrategicos.capturadoEm), desc(schema.snapshotsEstrategicos.createdAt))
      .limit(2)
  ]);

  const results = await Promise.all(storedResults.map(async ({ resultados_chave: result }) => {
    const automatic = result.fonteTipo !== 'manual' && result.fonteCodigo
      ? await automaticValue(result.fonteCodigo, cycle)
      : { valor: result.valorAtual, updatedAt: result.ultimaAtualizacao };
    const valorAtual = automatic.valor;
    const progresso = progressFor({ ...result, valorAtual });
    const option = sourceOption(result.fonteTipo, result.fonteCodigo);
    const stale = !automatic.updatedAt
      || Date.now() - Date.parse(automatic.updatedAt) > staleAfterDays(result.frequencia) * 86_400_000;
    return {
      ...result,
      valorAtual,
      progresso,
      ultimaAtualizacao: automatic.updatedAt,
      desatualizado: stale,
      estadoDado: valorAtual == null ? 'indisponivel' as const : stale ? 'desatualizado' as const : 'disponivel' as const,
      formulaProgresso: progressFormula(result),
      fonteNome: result.fonteTipo === 'manual' ? 'Atualização manual' : option?.nome || 'Fonte indisponível',
      fonteRegra: option?.regra || result.fonteRegra,
      fontePeriodo: `${cycle.dataInicio} a ${cycle.dataFim}`,
      fonteRota: option?.rota || result.fonteRota
    };
  }));

  const initiativeRows = initiatives.map(({ iniciativas_estrategicas: initiative }) => ({
    ...initiative,
    atrasada: initiative.dataLimite < todayKey() && !['concluida', 'cancelada'].includes(initiative.status)
  }));
  const decisionRows = decisions.map((decision) => ({
    ...decision,
    atrasada: decision.prazo < todayKey() && ['pendente', 'em_andamento'].includes(decision.status)
  }));
  const progressValues = results.map((item) => item.progresso).filter((value): value is number => value !== null);
  const nextInitiative = initiativeRows
    .filter((item) => item.dataLimite >= todayKey() && !['concluida', 'cancelada'].includes(item.status))
    .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite))[0];
  const pendingDecisions = decisionRows.filter((item) => ['pendente', 'em_andamento'].includes(item.status));
  const highRiskObjectiveIds = new Set(risks
    .filter((risk) => ['alto', 'critico'].includes(risk.impacto) && !['resolvido', 'aceito'].includes(risk.status))
    .map((risk) => risk.objetivoId)
    .filter(Boolean));
  const objectivesInRisk = new Set([
    ...objectives.filter((item) => item.status === 'em_risco').map((item) => item.id),
    ...highRiskObjectiveIds
  ]);

  const objectiveRows = objectives.map((objective) => {
    const ownResults = results.filter((result) => result.objetivoId === objective.id);
    const ownProgress = ownResults.map((result) => result.progresso).filter((value): value is number => value !== null);
    return {
      ...objective,
      progresso: ownProgress.length ? ownProgress.reduce((sum, value) => sum + value, 0) / ownProgress.length : null
    };
  });
  const timeline = [
    ...checkins.map((item) => ({ id: `revisao:${item.id}`, tipo: 'revisao' as const, data: item.data, titulo: 'Revisão estratégica', descricao: item.narrativa, status: item.status })),
    ...decisionRows.map((item) => ({ id: `decisao:${item.id}`, tipo: 'decisao' as const, data: (item.concluidaEm || item.updatedAt).slice(0, 10), titulo: item.descricao, descricao: `Responsável: ${item.responsavel} · prazo ${item.prazo}`, status: item.status })),
    ...risks.map((item) => ({ id: `risco:${item.id}`, tipo: 'risco' as const, data: item.updatedAt.slice(0, 10), titulo: item.descricao, descricao: `Impacto ${item.impacto} · probabilidade ${item.probabilidade}`, status: item.status })),
    ...initiativeRows.filter((item) => item.atrasada || ['concluida', 'bloqueada'].includes(item.status)).map((item) => ({ id: `iniciativa:${item.id}`, tipo: 'iniciativa' as const, data: item.updatedAt.slice(0, 10), titulo: item.titulo, descricao: item.atrasada ? `Prazo vencido em ${item.dataLimite}` : `Situação alterada para ${item.status}`, status: item.atrasada ? 'atrasada' : item.status }))
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);
  const nextDecision = pendingDecisions.slice().sort((a, b) => a.prazo.localeCompare(b.prazo))[0];

  return {
    ciclo: cycle,
    pilares: pillars,
    objetivos: objectiveRows,
    resultadosChave: results,
    iniciativas: initiativeRows,
    checkins,
    riscos: risks,
    decisoes: decisionRows,
    tendencias: trendSummary(storedSnapshots),
    linhaDoTempo: timeline,
    resumo: {
      progressoGeral: progressValues.length ? progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length : null,
      objetivosEmRisco: objectivesInRisk.size,
      iniciativasAtrasadas: initiativeRows.filter((item) => item.atrasada).length,
      decisoesPendentes: pendingDecisions.length,
      dadosDesatualizados: results.filter((item) => item.desatualizado).length,
      ultimaRevisao: checkins[0]?.data || null,
      proximaDecisao: nextDecision ? { id: nextDecision.id, descricao: nextDecision.descricao, prazo: nextDecision.prazo } : null,
      proximoMarco: nextInitiative
        ? { titulo: nextInitiative.proximoMarco?.trim() || nextInitiative.titulo, data: nextInitiative.dataLimite }
        : cycle.proximaRevisao
          ? { titulo: 'Próxima revisão do ciclo', data: cycle.proximaRevisao }
          : null
    }
  };
}

export async function getStrategicOptions() {
  const [projects, tasks] = await Promise.all([
    db.select({ id: schema.projetos.id, nome: schema.projetos.nome, status: schema.projetos.status })
      .from(schema.projetos).where(isNull(schema.projetos.deletedAt)).orderBy(asc(schema.projetos.nome)),
    db.select({ id: schema.tarefas.id, titulo: schema.tarefas.titulo, status: schema.tarefas.status, projetoId: schema.tarefas.projetoId })
      .from(schema.tarefas).where(isNull(schema.tarefas.deletedAt)).orderBy(asc(schema.tarefas.titulo))
  ]);
  return { fontes: SOURCE_OPTIONS, projetos: projects, tarefas: tasks };
}
