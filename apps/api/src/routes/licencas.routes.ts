import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function licencasRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    try {
      const licencas = await db
        .select()
        .from(schema.licencas);
      return licencas;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar licenças' });
    }
  });

  server.post('/', async (request, reply) => {
    try {
      const data = request.body as any;
      const newLicenca = await db.insert(schema.licencas).values({
        id: crypto.randomUUID(),
        projetoId: data.projetoId,
        numero: data.numero,
        orgao: data.orgao,
        dataEmissao: data.dataEmissao || null,
        dataVencimento: data.dataVencimento,
        status: data.status || 'Válida',
        observacoes: data.observacoes || null
      }).returning();
      return newLicenca[0];
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao criar licença' });
    }
  });

  server.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      const updated = await db.update(schema.licencas).set({
        projetoId: data.projetoId,
        numero: data.numero,
        orgao: data.orgao,
        dataEmissao: data.dataEmissao || null,
        dataVencimento: data.dataVencimento,
        status: data.status || 'Válida',
        observacoes: data.observacoes || null,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.licencas.id, id)).returning();
      return updated[0];
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar licença' });
    }
  });

  server.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await db.delete(schema.licencas).where(eq(schema.licencas.id, id));
      return { message: 'Licença removida' };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao deletar licença' });
    }
  });
}
