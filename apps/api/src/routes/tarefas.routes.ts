import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, or, and, isNull, desc, asc, count, like, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';
import { AuditLogService } from '../services/audit.service';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RelationshipIntegrityError, resolveClientProjectLink } from '../services/relationship-integrity.service';

const TarefaPayloadSchema = z.object({
  titulo: z.string().min(1),
  clienteId: z.string().uuid().nullable().optional(),
  projetoId: z.string().uuid().nullable().optional(),
  descricao: z.string().nullable().optional(),
  status: z.string().optional(),
  prioridade: z.string().optional(),
  categoria: z.string().optional(),
  dataLimite: z.string().nullable().optional()
});

export async function tarefasRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/', {
    schema: {
      querystring: z.object({
        projetoId: z.string().uuid().optional(),
        clienteId: z.string().uuid().optional(),
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(50),
        q: z.string().trim().max(200).optional(),
        id: z.string().uuid().optional(),
        prioridade: z.string().trim().max(100).optional(),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        mode: z.enum(['legacy', 'page']).default('legacy')
      })
    }
  }, async (request, reply) => {
    const { projetoId, clienteId, page, limit, q, mode } = request.query;
    const offset = (page - 1) * limit;

    let condition = isNull(schema.tarefas.deletedAt);

    if (projetoId) {
      condition = and(condition, eq(schema.tarefas.projetoId, projetoId))!;
    } else if (clienteId) {
      condition = and(condition, or(
        eq(schema.tarefas.clienteId, clienteId),
        eq(schema.projetos.clienteId, clienteId)
      ))!;
    }
    if (q) condition = and(condition, like(schema.tarefas.titulo, `%${q}%`))!;
    if (request.query.id) condition = and(condition, eq(schema.tarefas.id, request.query.id))!;
    if (request.query.prioridade) condition = and(condition, eq(schema.tarefas.prioridade, request.query.prioridade))!;
    if (request.query.inicio) condition = and(condition, gte(schema.tarefas.dataLimite, request.query.inicio))!;
    if (request.query.fim) condition = and(condition, lte(schema.tarefas.dataLimite, request.query.fim))!;

    const query = db.select({
      id: schema.tarefas.id,
      clienteId: schema.tarefas.clienteId,
      projetoId: schema.tarefas.projetoId,
      titulo: schema.tarefas.titulo,
      descricao: schema.tarefas.descricao,
      status: schema.tarefas.status,
      prioridade: schema.tarefas.prioridade,
      categoria: schema.tarefas.categoria,
      contextoTipo: schema.tarefas.contextoTipo,
      dataLimite: schema.tarefas.dataLimite,
      projetoNome: schema.projetos.nome,
      clienteNome: schema.clientes.nome
    })
      .from(schema.tarefas)
      .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, eq(schema.tarefas.clienteId, schema.clientes.id))
      .where(condition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.tarefas.createdAt));

    const items = await query;
    if (mode === 'legacy') return items;
    const [{ total }] = await db.select({ total: count() })
      .from(schema.tarefas)
      .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
      .where(condition);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  });

  zServer.get('/options', {
    schema: { querystring: z.object({
      q: z.string().trim().max(200).optional(),
      projetoId: z.string().uuid().optional(),
      selectedId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(25)
    }) }
  }, async (request) => {
    const { q, projetoId, selectedId, limit } = request.query;
    const selection = {
      id: schema.tarefas.id,
      titulo: schema.tarefas.titulo,
      projetoId: schema.tarefas.projetoId,
      clienteId: schema.tarefas.clienteId,
      status: schema.tarefas.status
    };
    const items = await db.select(selection).from(schema.tarefas).where(and(
      isNull(schema.tarefas.deletedAt),
      projetoId ? eq(schema.tarefas.projetoId, projetoId) : undefined,
      q ? like(schema.tarefas.titulo, `%${q}%`) : undefined
    )).orderBy(asc(schema.tarefas.titulo), asc(schema.tarefas.id)).limit(limit);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      const [selected] = await db.select(selection).from(schema.tarefas)
        .where(and(eq(schema.tarefas.id, selectedId), isNull(schema.tarefas.deletedAt))).limit(1);
      if (selected) return [selected, ...items].slice(0, limit);
    }
    return items;
  });

  zServer.get('/calendar', {
    schema: { querystring: z.object({
      inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }) }
  }, async (request) => db.select({
    id: schema.tarefas.id,
    titulo: schema.tarefas.titulo,
    status: schema.tarefas.status,
    dataLimite: schema.tarefas.dataLimite,
    clienteId: schema.tarefas.clienteId,
    clienteNome: schema.clientes.nome,
    projetoId: schema.tarefas.projetoId,
    projetoNome: schema.projetos.nome
  }).from(schema.tarefas)
    .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
    .leftJoin(schema.clientes, eq(schema.tarefas.clienteId, schema.clientes.id))
    .where(and(
      isNull(schema.tarefas.deletedAt),
      gte(schema.tarefas.dataLimite, request.query.inicio),
      lte(schema.tarefas.dataLimite, request.query.fim)
    )).orderBy(asc(schema.tarefas.dataLimite), asc(schema.tarefas.id)).limit(500));

  zServer.post('/', {
    schema: {
      body: TarefaPayloadSchema
    }
  }, async (request, reply) => {
    const body = request.body;

    if (!body.titulo || (!body.projetoId && !body.clienteId)) {
      return reply.status(400).send({ error: 'titulo e clienteId ou projetoId sao obrigatorios' });
    }

    const projetoId = body.projetoId || null;
    let clienteId = body.clienteId || null;

    if (projetoId) {
      const projeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, projetoId)).limit(1);
      if (!projeto.length) {
        return reply.status(400).send({ error: 'Projeto vinculado nao encontrado' });
      }
      if (clienteId && clienteId !== projeto[0].clienteId) {
        return reply.status(400).send({ error: 'Projeto nao pertence ao cliente informado' });
      }
      clienteId = projeto[0].clienteId;
    }

    const novaTarefa = await db.transaction(async (tx) => {
      const created = await tx.insert(schema.tarefas).values({
        id: crypto.randomUUID(),
        clienteId,
        projetoId,
        titulo: body.titulo,
        descricao: body.descricao || '',
        status: body.status || 'A Fazer',
        prioridade: body.prioridade || 'Média',
        categoria: body.categoria || (projetoId ? 'Trabalho' : 'Interno'),
        contextoTipo: projetoId ? 'projeto' : 'cliente',
        dataLimite: body.dataLimite || ''
      }).returning();
      await AuditLogService.log('INSERT', 'Tarefa', null, created[0], tx);
      if (created[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: created[0].clienteId,
          projetoId: created[0].projetoId || null,
          tipo: 'Checklist',
          titulo: `Tarefa criada: ${created[0].titulo}`,
          categoria: created[0].categoria || 'Tarefa',
          descricao: [
            `Status: ${created[0].status}`,
            `Prioridade: ${created[0].prioridade}`,
            created[0].dataLimite ? `Prazo: ${created[0].dataLimite}` : null,
            created[0].descricao || null
          ].filter(Boolean).join('\n')
        }, tx);
      }
      return created[0];
    });

    return novaTarefa;
  });

  zServer.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: TarefaPayloadSchema.partial()
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;
    
    const tarefaAnterior = await db.select()
      .from(schema.tarefas)
      .where(eq(schema.tarefas.id, id))
      .limit(1);

    if (!tarefaAnterior.length) {
      return reply.status(404).send({ error: 'Tarefa nao encontrada' });
    }

    const updateFields: any = {};
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.titulo !== undefined) updateFields.titulo = body.titulo;
    if (body.descricao !== undefined) updateFields.descricao = body.descricao;
    if (body.prioridade !== undefined) updateFields.prioridade = body.prioridade;
    if (body.categoria !== undefined) updateFields.categoria = body.categoria;
    if (body.dataLimite !== undefined) updateFields.dataLimite = body.dataLimite;

    if (body.projetoId !== undefined || body.clienteId !== undefined) {
      try {
        const link = await resolveClientProjectLink({
          projetoId: body.projetoId !== undefined ? body.projetoId || null : tarefaAnterior[0].projetoId,
          clienteId: body.clienteId !== undefined ? body.clienteId || null : tarefaAnterior[0].clienteId
        });
        updateFields.projetoId = link.projetoId;
        updateFields.clienteId = link.clienteId;
        updateFields.contextoTipo = link.projetoId ? 'projeto' : 'cliente';
      } catch (error) {
        if (error instanceof RelationshipIntegrityError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }

    updateFields.updatedAt = new Date().toISOString();

    const tarefaAtualizada = await db.transaction(async (tx) => {
      const updated = await tx.update(schema.tarefas)
        .set(updateFields)
        .where(eq(schema.tarefas.id, id))
        .returning();
      if (!updated.length) return null;
      await AuditLogService.log('UPDATE', 'Tarefa', tarefaAnterior[0], updated[0], tx);
      if (body.status === 'Concluído' && tarefaAnterior[0].status !== 'Concluído' && updated[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: updated[0].clienteId,
          projetoId: updated[0].projetoId || null,
          tipo: 'Checklist',
          titulo: `Tarefa concluída: ${updated[0].titulo}`,
          categoria: updated[0].categoria || 'Tarefa',
          descricao: `${updated[0].titulo}${updated[0].descricao ? `\n${updated[0].descricao}` : ''}`
        }, tx);
      }
      return updated[0];
    });
    if (!tarefaAtualizada) return reply.status(404).send({ error: 'Tarefa nao encontrada' });
    return tarefaAtualizada;
  });

  zServer.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;

    const deletado = await db.transaction(async (tx) => {
      const removed = await tx.update(schema.tarefas)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(schema.tarefas.id, id))
        .returning();
      if (removed.length) await AuditLogService.log('DELETE (SOFT)', 'Tarefa', removed[0], null, tx);
      return removed;
    });

    if (!deletado.length) {
      return reply.status(404).send({ error: 'Tarefa nao encontrada' });
    }

    return { success: true };
  });
}
