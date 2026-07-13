import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, or } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';

export async function compromissosRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    const { clienteId, projetoId } = request.query as { clienteId?: string; projetoId?: string };

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

    return query;
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

    const novoCompromisso = await db.insert(schema.compromissos).values({
      id: crypto.randomUUID(),
      titulo: body.titulo,
      descricao: body.descricao || '',
      data: body.data,
      hora: body.hora || null,
      tipo: body.tipo || 'Visita de Campo',
      clienteId,
      projetoId
    }).returning();

    if (novoCompromisso[0].clienteId) {
      await JornadaService.logClienteEvento({
        clienteId: novoCompromisso[0].clienteId,
        projetoId: novoCompromisso[0].projetoId || null,
        tipo: 'Agenda',
        titulo: `Compromisso criado: ${novoCompromisso[0].titulo}`,
        categoria: novoCompromisso[0].tipo || 'Agenda',
        descricao: [
          `Data: ${novoCompromisso[0].data}`,
          `Tipo: ${novoCompromisso[0].tipo}`,
          novoCompromisso[0].descricao || null
        ].filter(Boolean).join('\n')
      });
    }

    return novoCompromisso[0];
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

    if (body.projetoId !== undefined) {
      const projetoId = body.projetoId || null;
      updateFields.projetoId = projetoId;
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

    const atualizado = await db.update(schema.compromissos)
      .set(updateFields)
      .where(eq(schema.compromissos.id, id))
      .returning();

    if (!atualizado.length) {
      return reply.status(404).send({ error: 'Compromisso nao encontrado' });
    }

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

    if (changes.length && atualizado[0].clienteId) {
      await JornadaService.logClienteEvento({
        clienteId: atualizado[0].clienteId,
        projetoId: atualizado[0].projetoId || null,
        tipo: 'Agenda',
        titulo: `Compromisso atualizado: ${atualizado[0].titulo}`,
        categoria: atualizado[0].tipo || 'Agenda',
        descricao: changes.join('\n')
      });
    }

    return atualizado[0];
  });

  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const compromissoAnterior = await db.select()
      .from(schema.compromissos)
      .where(eq(schema.compromissos.id, id))
      .limit(1);

    const deletado = await db.delete(schema.compromissos)
      .where(eq(schema.compromissos.id, id))
      .returning();

    if (!deletado.length) {
      return reply.status(404).send({ error: 'Compromisso nao encontrado' });
    }

    const source = compromissoAnterior[0] || deletado[0];
    if (source.clienteId) {
      await JornadaService.logClienteEvento({
        clienteId: source.clienteId,
        projetoId: source.projetoId || null,
        tipo: 'Agenda',
        titulo: `Compromisso excluído: ${source.titulo}`,
        categoria: source.tipo || 'Agenda',
        descricao: `Data: ${source.data}\nTipo: ${source.tipo || 'Agenda'}`
      });
    }

    return { success: true };
  });
}
