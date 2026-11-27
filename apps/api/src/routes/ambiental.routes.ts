import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import {
  EnvironmentalPhaseSchema,
  EnvironmentalProgressPayloadSchema,
  isEnvironmentalWorkCompleted,
  environmentalRecordedAtTime,
  StatusProjetoSchema,
  isRealEnvironmentalDateKey,
  type EnvironmentalDemandDetail,
  type EnvironmentalDemandListItem,
  type EnvironmentalDemandListResponse
} from '@geogestor/contracts';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { CompletedWorkError } from '../services/environmental-work.service';
import { nextEditTime } from '../services/edit-concurrency.service';

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().trim().optional(),
  tipo: z.enum(['Ambiental', 'Perícia']).optional(),
  clienteId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  orgao: z.string().trim().optional(),
  tipoDemanda: z.string().trim().optional(),
  inicio: z.string().refine(isRealEnvironmentalDateKey, 'Informe uma data inicial válida.').optional(),
  fim: z.string().refine(isRealEnvironmentalDateKey, 'Informe uma data final válida.').optional()
}).strict().superRefine((query, context) => {
  if (query.inicio && query.fim && query.fim < query.inicio) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fim'], message: 'A data final deve ser igual ou posterior à inicial.' });
  }
});

const IdParamsSchema = z.object({ id: z.string().uuid() });
const PhasePayloadSchema = z.object({
  statusFase: EnvironmentalPhaseSchema,
  status: StatusProjetoSchema.optional()
}).strict();
const ProgressPayloadSchema = EnvironmentalProgressPayloadSchema;
const taskIsPending = (status: string) => !['concluido', 'concluida', 'finalizada', 'cancelado', 'cancelada'].includes(
  status.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
);

function buildFilters(query: z.infer<typeof ListQuerySchema>) {
  const filters: SQL[] = [
    isNull(schema.projetos.deletedAt),
    inArray(schema.projetos.tipo, query.tipo ? [query.tipo] : ['Ambiental', 'Perícia'])
  ];
  if (query.clienteId) filters.push(eq(schema.projetos.clienteId, query.clienteId));
  if (query.status) filters.push(eq(schema.projetos.status, query.status));
  if (query.orgao) filters.push(like(schema.ambiental.orgaoAmbiental, `%${query.orgao}%`));
  if (query.tipoDemanda) {
    filters.push(or(
      eq(schema.ambiental.tipoDemanda, query.tipoDemanda),
      eq(schema.pericias.tipoPericia, query.tipoDemanda)
    )!);
  }
  if (query.inicio) filters.push(gte(schema.projetos.dataEntrega, query.inicio));
  if (query.fim) filters.push(lte(schema.projetos.dataEntrega, query.fim));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(
      like(schema.projetos.nome, term),
      like(schema.clientes.nome, term),
      like(schema.ambiental.protocolo, term),
      like(schema.ambiental.orgaoAmbiental, term),
      like(schema.ambiental.tipoDemanda, term),
      like(schema.pericias.numeroProcesso, term),
      like(schema.pericias.tipoPericia, term)
    )!);
  }
  return filters;
}

export async function ambientalRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/', { schema: { querystring: ListQuerySchema } }, async (request, reply) => {
    const filters = buildFilters(request.query);
    const offset = (request.query.page - 1) * request.query.limit;
    try {
      const baseSelect = {
        project: schema.projetos,
        clientName: schema.clientes.nome,
        environmentalType: schema.ambiental.tipoDemanda,
        environmentalAgency: schema.ambiental.orgaoAmbiental,
        environmentalProtocol: schema.ambiental.protocolo,
        environmentalPhase: schema.ambiental.statusFase,
        assessmentType: schema.pericias.tipoPericia,
        assessmentProcess: schema.pericias.numeroProcesso,
        assessmentStatus: schema.pericias.status
      };
      const rows = await db.select(baseSelect)
        .from(schema.projetos)
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .leftJoin(schema.ambiental, eq(schema.projetos.id, schema.ambiental.projetoId))
        .leftJoin(schema.pericias, eq(schema.projetos.id, schema.pericias.projetoId))
        .where(and(...filters))
        .orderBy(asc(schema.projetos.dataEntrega), desc(schema.projetos.updatedAt))
        .limit(request.query.limit)
        .offset(offset);

      const totalRows = await db.select({ total: count() })
        .from(schema.projetos)
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .leftJoin(schema.ambiental, eq(schema.projetos.id, schema.ambiental.projetoId))
        .leftJoin(schema.pericias, eq(schema.projetos.id, schema.pericias.projetoId))
        .where(and(...filters));

      const projectIds = rows.map((row) => row.project.id);
      const taskRows = projectIds.length
        ? await db.select().from(schema.tarefas)
          .where(and(
            inArray(schema.tarefas.projetoId, projectIds),
            isNull(schema.tarefas.deletedAt)
          ))
          .orderBy(sql`case when ${schema.tarefas.dataLimite} is null then 1 else 0 end`, asc(schema.tarefas.dataLimite), asc(schema.tarefas.createdAt))
        : [];
      const nextTaskByProject = new Map<string, typeof taskRows[number]>();
      taskRows.forEach((task) => {
        if (!task.projetoId || !taskIsPending(task.status)) return;
        if (!nextTaskByProject.has(task.projetoId)) nextTaskByProject.set(task.projetoId, task);
      });

      const items: EnvironmentalDemandListItem[] = rows.map((row) => {
        const task = nextTaskByProject.get(row.project.id);
        const isAssessment = row.project.tipo === 'Perícia';
        return {
          id: row.project.id,
          clienteId: row.project.clienteId,
          clienteNome: row.clientName || 'Cliente não informado',
          nome: row.project.nome,
          tipo: row.project.tipo || 'Ambiental',
          tipoDemanda: isAssessment ? row.assessmentType : row.environmentalType,
          orgaoAmbiental: isAssessment ? null : row.environmentalAgency,
          protocolo: isAssessment ? row.assessmentProcess : row.environmentalProtocol,
          statusFase: isAssessment ? row.assessmentStatus : row.environmentalPhase,
          status: row.project.status,
          descricao: row.project.descricao,
          dataInicio: row.project.dataInicio,
          dataEntrega: row.project.dataEntrega,
          proximaAcao: task?.titulo || null,
          proximaAcaoEm: task?.dataLimite || null,
          createdAt: row.project.createdAt,
          updatedAt: row.project.updatedAt
        };
      });
      const response: EnvironmentalDemandListResponse = {
        items,
        total: totalRows[0]?.total || 0,
        page: request.query.page,
        limit: request.query.limit
      };
      return response;
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível consultar as demandas ambientais. Tente novamente.' });
    }
  });

  zServer.get('/:id', { schema: { params: IdParamsSchema } }, async (request, reply) => {
    try {
      const rows = await db.select({
        project: schema.projetos,
        clientName: schema.clientes.nome,
        environmental: schema.ambiental,
        assessment: schema.pericias,
        propertyName: schema.propriedades.nome
      })
        .from(schema.projetos)
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .leftJoin(schema.ambiental, eq(schema.projetos.id, schema.ambiental.projetoId))
        .leftJoin(schema.pericias, eq(schema.projetos.id, schema.pericias.projetoId))
        .leftJoin(schema.propriedades, or(
          eq(schema.ambiental.propriedadeId, schema.propriedades.id),
          eq(schema.pericias.propriedadeId, schema.propriedades.id)
        ))
        .where(and(
          eq(schema.projetos.id, request.params.id),
          inArray(schema.projetos.tipo, ['Ambiental', 'Perícia']),
          isNull(schema.projetos.deletedAt)
        )).limit(1);
      if (!rows.length) return reply.status(404).send({ error: 'Demanda ambiental não encontrada.' });

      const row = rows[0];
      const history = await db.select().from(schema.interacoes_cliente)
        .where(and(
          eq(schema.interacoes_cliente.projetoId, request.params.id),
          isNull(schema.interacoes_cliente.deletedAt)
        )).orderBy(desc(schema.interacoes_cliente.data));
      const isAssessment = row.project.tipo === 'Perícia';
      const tasks = await db.select().from(schema.tarefas).where(and(
        eq(schema.tarefas.projetoId, request.params.id), isNull(schema.tarefas.deletedAt)
      )).orderBy(sql`case when ${schema.tarefas.dataLimite} is null then 1 else 0 end`, asc(schema.tarefas.dataLimite), asc(schema.tarefas.createdAt));
      const pendingTasks = tasks.filter(task => taskIsPending(task.status));
      // Event dates may be historical or future dates. Use recording timestamps
      // for the update label, without rewriting imported work dates.
      const updatedAt = [row.project.updatedAt, row.environmental?.updatedAt, row.assessment?.updatedAt, ...history.flatMap(item => [item.createdAt, item.updatedAt])]
        .filter((value): value is string => Boolean(value) && Number.isFinite(environmentalRecordedAtTime(value!)))
        .sort((a, b) => environmentalRecordedAtTime(b) - environmentalRecordedAtTime(a))[0] || row.project.updatedAt;
      const closure = history.filter(item => !item.manual && item.categoria === 'Encerramento do trabalho')
        .sort((a, b) => environmentalRecordedAtTime(b.createdAt) - environmentalRecordedAtTime(a.createdAt))[0];
      const detail: EnvironmentalDemandDetail = {
        id: row.project.id,
        clienteId: row.project.clienteId,
        clienteNome: row.clientName || 'Cliente não informado',
        nome: row.project.nome,
        tipo: row.project.tipo || 'Ambiental',
        tipoDemanda: isAssessment ? row.assessment?.tipoPericia || null : row.environmental?.tipoDemanda || null,
        orgaoAmbiental: isAssessment ? null : row.environmental?.orgaoAmbiental || null,
        protocolo: isAssessment ? row.assessment?.numeroProcesso || null : row.environmental?.protocolo || null,
        statusFase: isAssessment ? row.assessment?.status || null : row.environmental?.statusFase || null,
        status: row.project.status,
        descricao: row.project.descricao,
        dataInicio: row.project.dataInicio,
        dataEntrega: row.project.dataEntrega,
        proximaAcao: pendingTasks[0]?.titulo || null,
        proximaAcaoEm: pendingTasks[0]?.dataLimite || null,
        pendingTaskCount: pendingTasks.length,
        encerramento: isEnvironmentalWorkCompleted(row.project.status) && closure ? { data: closure.data, descricao: closure.descricao } : null,
        propriedadeId: isAssessment ? row.assessment?.propriedadeId || null : row.environmental?.propriedadeId || null,
        propriedadeNome: row.propertyName,
        createdAt: row.project.createdAt,
        updatedAt,
        history: history.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          titulo: item.titulo,
          categoria: item.categoria,
          descricao: item.descricao,
          data: item.data,
          manual: item.manual,
          createdAt: item.createdAt
        }))
      };
      return detail;
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível carregar a demanda ambiental.' });
    }
  });

  zServer.patch('/:id/fase', {
    schema: { params: IdParamsSchema, body: PhasePayloadSchema }
  }, async (request, reply) => {
    try {
      const project = await db.select().from(schema.projetos)
        .where(and(eq(schema.projetos.id, request.params.id), isNull(schema.projetos.deletedAt)))
        .limit(1);
      if (!project.length || project[0].tipo !== 'Ambiental') {
        return reply.status(404).send({ error: 'Demanda ambiental não encontrada.' });
      }
      const current = await db.select().from(schema.ambiental)
        .where(eq(schema.ambiental.projetoId, request.params.id)).limit(1);
      if (!current.length) return reply.status(404).send({ error: 'Dados ambientais não encontrados.' });

      const updated = await db.transaction(async (tx) => {
        const [live] = await tx.select().from(schema.projetos).where(eq(schema.projetos.id, request.params.id));
        if (isEnvironmentalWorkCompleted(live.status)) throw new CompletedWorkError();
        const updatedAt = nextEditTime(live.updatedAt);
        const environmental = await tx.update(schema.ambiental).set({
          statusFase: request.body.statusFase,
          updatedAt
        }).where(eq(schema.ambiental.id, current[0].id)).returning();
        await tx.update(schema.projetos).set({ ...(request.body.status ? { status: request.body.status } : {}), updatedAt })
          .where(eq(schema.projetos.id, request.params.id));
        if (isEnvironmentalWorkCompleted(request.body.status)) await JornadaService.logClienteEvento({
          clienteId: live.clienteId, projetoId: live.id, tipo: 'Ambiental', categoria: 'Encerramento do trabalho',
          titulo: 'Trabalho concluído', descricao: 'O status do trabalho foi alterado para Concluído. Histórico e documentos preservados.', data: updatedAt
        }, tx);
        await tx.insert(schema.interacoes_cliente).values({
          id: crypto.randomUUID(),
          clienteId: project[0].clienteId,
          projetoId: project[0].id,
          tipo: 'Ambiental',
          titulo: `Fase alterada para ${request.body.statusFase}`,
          categoria: 'Mudança de fase',
          manual: false,
          data: updatedAt.slice(0, 10),
          descricao: `A demanda ambiental avançou para a fase ${request.body.statusFase}.`
        });
        await AuditLogService.log('UPDATE', 'Demanda Ambiental', current[0], environmental[0], tx);
        return environmental[0];
      });
      return updated;
    } catch (error) {
      if (error instanceof CompletedWorkError) return reply.status(409).send({ error: error.message });
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível atualizar a fase da demanda.' });
    }
  });

  zServer.post('/:id/andamentos', {
    schema: { params: IdParamsSchema, body: ProgressPayloadSchema }
  }, async (request, reply) => {
    try {
      const project = await db.select().from(schema.projetos)
        .where(and(
          eq(schema.projetos.id, request.params.id),
          inArray(schema.projetos.tipo, ['Ambiental', 'Perícia']),
          isNull(schema.projetos.deletedAt)
        )).limit(1);
      if (!project.length) return reply.status(404).send({ error: 'Demanda ambiental não encontrada.' });
      const created = await db.transaction(async (tx) => {
        const [live] = await tx.select().from(schema.projetos).where(eq(schema.projetos.id, request.params.id));
        if (isEnvironmentalWorkCompleted(live.status)) throw new CompletedWorkError();
        const progress = await tx.insert(schema.interacoes_cliente).values({
          id: crypto.randomUUID(),
          clienteId: project[0].clienteId,
          projetoId: project[0].id,
          tipo: 'Ambiental',
          titulo: request.body.titulo,
          categoria: request.body.categoria,
          manual: true,
          data: request.body.data,
          descricao: request.body.descricao
        }).returning();
        await tx.update(schema.projetos).set({ updatedAt: nextEditTime(live.updatedAt) }).where(eq(schema.projetos.id, live.id));
        await AuditLogService.log('INSERT', 'Andamento Ambiental', null, progress[0], tx);
        return progress;
      });
      return reply.status(201).send(created[0]);
    } catch (error) {
      if (error instanceof CompletedWorkError) return reply.status(409).send({ error: error.message });
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível registrar o andamento.' });
    }
  });

  for (const action of ['concluir', 'reabrir'] as const) {
    zServer.post(`/:id/${action}`, { schema: { params: IdParamsSchema } }, async (request, reply) => {
      try {
        const result = await db.transaction(async tx => {
          const [project] = await tx.select().from(schema.projetos).where(and(
            eq(schema.projetos.id, request.params.id), isNull(schema.projetos.deletedAt), inArray(schema.projetos.tipo, ['Ambiental', 'Perícia'])
          )).limit(1);
          if (!project) return null;
          const completed = isEnvironmentalWorkCompleted(project.status);
          if ((action === 'reabrir') !== completed) return { conflict: true };
          const updatedAt = nextEditTime(project.updatedAt);
          const [updated] = await tx.update(schema.projetos).set({ status: action === 'reabrir' ? 'Em Andamento' : 'Concluído', updatedAt })
            .where(eq(schema.projetos.id, project.id)).returning();
          await JornadaService.logClienteEvento({
            clienteId: project.clienteId, projetoId: project.id, tipo: 'Ambiental',
            titulo: action === 'reabrir' ? 'Trabalho reaberto' : 'Trabalho concluído',
            categoria: action === 'reabrir' ? 'Reabertura do trabalho' : 'Encerramento do trabalho',
            descricao: action === 'reabrir'
              ? 'O trabalho voltou ao status Em Andamento. Fase, histórico e documentos foram preservados; alterações de fase e novos andamentos estão disponíveis.'
              : 'O status do trabalho foi alterado para Concluído. Histórico e documentos preservados. Alterações de fase e novos andamentos exigem reabertura.',
            data: updatedAt
          }, tx);
          await AuditLogService.log('UPDATE', 'Demanda Ambiental', project, updated, tx);
          return updated;
        });
        if (!result) return reply.status(404).send({ error: 'Demanda ambiental não encontrada.' });
        if ('conflict' in result) return reply.status(409).send({ error: action === 'reabrir' ? 'Este trabalho já está ativo. Atualize os detalhes.' : 'Este trabalho já está concluído. Atualize os detalhes.' });
        return result;
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ error: action === 'reabrir' ? 'Não foi possível reabrir o trabalho. Tente novamente.' : 'Não foi possível concluir o trabalho. Tente novamente.' });
      }
    });
  }
}
