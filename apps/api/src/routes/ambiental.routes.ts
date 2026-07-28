import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, or, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import type {
  EnvironmentalDemandDetail,
  EnvironmentalDemandListItem,
  EnvironmentalDemandListResponse
} from '@geogestor/contracts';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { AuditLogService } from '../services/audit.service';

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().trim().optional(),
  tipo: z.enum(['Ambiental', 'Perícia']).optional(),
  clienteId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  orgao: z.string().trim().optional(),
  tipoDemanda: z.string().trim().optional(),
  inicio: z.string().optional(),
  fim: z.string().optional()
});

const IdParamsSchema = z.object({ id: z.string().uuid() });
const PhasePayloadSchema = z.object({
  statusFase: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(120).optional()
});
const ProgressPayloadSchema = z.object({
  titulo: z.string().trim().min(1).max(180),
  descricao: z.string().trim().min(1).max(3000),
  data: z.string().min(1),
  categoria: z.string().trim().max(120).default('Andamento ambiental')
});

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
          .orderBy(asc(schema.tarefas.dataLimite))
        : [];
      const nextTaskByProject = new Map<string, typeof taskRows[number]>();
      taskRows.forEach((task) => {
        if (!task.projetoId || ['Concluído', 'Concluída', 'Finalizada'].includes(task.status)) return;
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
        proximaAcao: null,
        proximaAcaoEm: null,
        propriedadeId: isAssessment ? row.assessment?.propriedadeId || null : row.environmental?.propriedadeId || null,
        propriedadeNome: row.propertyName,
        createdAt: row.project.createdAt,
        updatedAt: row.project.updatedAt,
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

      const updatedAt = new Date().toISOString();
      const updated = await db.transaction(async (tx) => {
        const environmental = await tx.update(schema.ambiental).set({
          statusFase: request.body.statusFase,
          updatedAt
        }).where(eq(schema.ambiental.id, current[0].id)).returning();
        if (request.body.status) {
          await tx.update(schema.projetos).set({ status: request.body.status, updatedAt })
            .where(eq(schema.projetos.id, request.params.id));
        }
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
        await AuditLogService.log('INSERT', 'Andamento Ambiental', null, progress[0], tx);
        return progress;
      });
      return reply.status(201).send(created[0]);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível registrar o andamento.' });
    }
  });
}
