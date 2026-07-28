import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, or, and, isNull, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';
import { AuditLogService } from '../services/audit.service';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

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
        limit: z.coerce.number().min(1).max(500).default(100)
      })
    }
  }, async (request, reply) => {
    const { projetoId, clienteId, page, limit } = request.query;
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

    return query;
  });

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

    if (body.projetoId !== undefined) {
      const projetoId = body.projetoId || null;
      updateFields.projetoId = projetoId;
      updateFields.contextoTipo = projetoId ? 'projeto' : 'cliente';

      if (projetoId) {
        const projeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, projetoId)).limit(1);
        if (!projeto.length) {
          return reply.status(400).send({ error: 'Projeto vinculado nao encontrado' });
        }
        updateFields.clienteId = projeto[0].clienteId;
      }
    }

    if (body.clienteId !== undefined && updateFields.clienteId === undefined) {
      updateFields.clienteId = body.clienteId || null;
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
