import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, or, and, gte, lte, asc } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';
import { AuditLogService } from '../services/audit.service';
import { RelationshipIntegrityError, resolveClientProjectLink } from '../services/relationship-integrity.service';

export async function compromissosRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    const { clienteId, projetoId, inicio, fim } = request.query as { clienteId?: string; projetoId?: string; inicio?: string; fim?: string };

    const query = db
      .select({
        id: schema.compromissos.id,
        titulo: schema.compromissos.titulo,
        descricao: schema.compromissos.descricao,
        data: schema.compromissos.data,
        hora: schema.compromissos.hora,
        tipo: schema.compromissos.tipo,
        clienteId: schema.compromissos.clienteId,
        projetoClienteId: schema.projetos.clienteId,
        projetoId: schema.compromissos.projetoId,
        projetoNome: schema.projetos.nome,
        clienteNome: schema.clientes.nome
      })
      .from(schema.compromissos)
      .leftJoin(schema.projetos, eq(schema.compromissos.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, or(
        eq(schema.compromissos.clienteId, schema.clientes.id),
        eq(schema.projetos.clienteId, schema.clientes.id)
      ));

    if (projetoId) {
      return query.where(eq(schema.compromissos.projetoId, projetoId));
    }

    if (clienteId) {
      return query.where(or(
        eq(schema.compromissos.clienteId, clienteId),
        eq(schema.projetos.clienteId, clienteId)
      ));
    }

    if (inicio || fim) {
      return query.where(and(
        inicio ? gte(schema.compromissos.data, inicio) : undefined,
        fim ? lte(schema.compromissos.data, fim) : undefined
      )).orderBy(asc(schema.compromissos.data)).limit(500);
    }

    return query.limit(500);
  });

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const data = await db
        .select({
          id: schema.compromissos.id,
          titulo: schema.compromissos.titulo,
          descricao: schema.compromissos.descricao,
          data: schema.compromissos.data,
          hora: schema.compromissos.hora,
          tipo: schema.compromissos.tipo,
          clienteId: schema.compromissos.clienteId,
          projetoClienteId: schema.projetos.clienteId,
          projetoId: schema.compromissos.projetoId,
          projetoNome: schema.projetos.nome,
          clienteNome: schema.clientes.nome
        })
        .from(schema.compromissos)
        .leftJoin(schema.projetos, eq(schema.compromissos.projetoId, schema.projetos.id))
        .leftJoin(schema.clientes, or(
          eq(schema.compromissos.clienteId, schema.clientes.id),
          eq(schema.projetos.clienteId, schema.clientes.id)
        ))
        .where(eq(schema.compromissos.id, id))
        .limit(1);

      if (!data.length) {
        return reply.status(404).send({ error: 'Compromisso nao encontrado' });
      }

      return {
        ...data[0],
        clienteId: data[0].clienteId || data[0].projetoClienteId
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar compromisso' });
    }
  });

  server.post('/', async (request, reply) => {
    const body = request.body as any;

    if (!body.titulo || !body.data) {
      return reply.status(400).send({ error: 'titulo e data sao obrigatorios' });
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

    const novoCompromisso = await db.transaction(async (tx) => {
      const created = await tx.insert(schema.compromissos).values({
        id: crypto.randomUUID(),
        titulo: body.titulo,
        descricao: body.descricao || '',
        data: body.data,
        hora: body.hora || null,
        tipo: body.tipo || 'Visita de Campo',
        clienteId,
        projetoId
      }).returning();
      await AuditLogService.log('INSERT', 'Compromisso', null, created[0], tx);
      if (created[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: created[0].clienteId,
          projetoId: created[0].projetoId || null,
          tipo: 'Agenda',
          titulo: `Compromisso criado: ${created[0].titulo}`,
          categoria: created[0].tipo || 'Agenda',
          descricao: [
            `Data: ${created[0].data}`,
            `Tipo: ${created[0].tipo}`,
            created[0].descricao || null
          ].filter(Boolean).join('\n')
        }, tx);
      }
      return created[0];
    });

    return novoCompromisso;
  });

  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const compromissoAnterior = await db.select()
      .from(schema.compromissos)
      .where(eq(schema.compromissos.id, id))
      .limit(1);

    if (!compromissoAnterior.length) {
      return reply.status(404).send({ error: 'Compromisso nao encontrado' });
    }

    const updateFields: any = {};
    if (body.titulo !== undefined) updateFields.titulo = body.titulo;
    if (body.descricao !== undefined) updateFields.descricao = body.descricao;
    if (body.data !== undefined) updateFields.data = body.data;
    if (body.hora !== undefined) updateFields.hora = body.hora;
    if (body.tipo !== undefined) updateFields.tipo = body.tipo;

    if (body.projetoId !== undefined || body.clienteId !== undefined) {
      try {
        const link = await resolveClientProjectLink({
          projetoId: body.projetoId !== undefined ? body.projetoId || null : compromissoAnterior[0].projetoId,
          clienteId: body.clienteId !== undefined ? body.clienteId || null : compromissoAnterior[0].clienteId
        });
        updateFields.projetoId = link.projetoId;
        updateFields.clienteId = link.clienteId;
      } catch (error) {
        if (error instanceof RelationshipIntegrityError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }

    updateFields.updatedAt = new Date().toISOString();

    const changes: string[] = [];
    if (body.titulo !== undefined && body.titulo !== compromissoAnterior[0].titulo) {
      changes.push(`Título: ${compromissoAnterior[0].titulo} -> ${body.titulo}`);
    }
    if (body.data !== undefined && body.data !== compromissoAnterior[0].data) {
      changes.push(`Data: ${compromissoAnterior[0].data} -> ${body.data}`);
    }
    if (body.tipo !== undefined && body.tipo !== compromissoAnterior[0].tipo) {
      changes.push(`Tipo: ${compromissoAnterior[0].tipo} -> ${body.tipo}`);
    }

    const atualizado = await db.transaction(async (tx) => {
      const updated = await tx.update(schema.compromissos)
        .set(updateFields)
        .where(eq(schema.compromissos.id, id))
        .returning();
      if (!updated.length) return null;
      await AuditLogService.log('UPDATE', 'Compromisso', compromissoAnterior[0], updated[0], tx);
      if (changes.length && updated[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: updated[0].clienteId,
          projetoId: updated[0].projetoId || null,
          tipo: 'Agenda',
          titulo: `Compromisso atualizado: ${updated[0].titulo}`,
          categoria: updated[0].tipo || 'Agenda',
          descricao: changes.join('\n')
        }, tx);
      }
      return updated[0];
    });
    if (!atualizado) return reply.status(404).send({ error: 'Compromisso nao encontrado' });
    return atualizado;
  });

  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const compromissoAnterior = await db.select()
      .from(schema.compromissos)
      .where(eq(schema.compromissos.id, id))
      .limit(1);

    const deletado = await db.transaction(async (tx) => {
      const removed = await tx.delete(schema.compromissos)
        .where(eq(schema.compromissos.id, id))
        .returning();
      if (!removed.length) return null;
      const source = compromissoAnterior[0] || removed[0];
      await AuditLogService.log('DELETE', 'Compromisso', source, null, tx);
      if (source.clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: source.clienteId,
          projetoId: source.projetoId || null,
          tipo: 'Agenda',
          titulo: `Compromisso excluído: ${source.titulo}`,
          categoria: source.tipo || 'Agenda',
          descricao: `Data: ${source.data}\nTipo: ${source.tipo || 'Agenda'}`
        }, tx);
      }
      return removed[0];
    });

    if (!deletado) return reply.status(404).send({ error: 'Compromisso nao encontrado' });

    return { success: true };
  });
}
