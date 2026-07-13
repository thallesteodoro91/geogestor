import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { desc } from 'drizzle-orm';

export async function auditRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    try {
      const logs = await db
        .select()
        .from(schema.auditLogs)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(200); // Return up to 200 logs for display
      return logs;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar logs de auditoria' });
    }
  });
}
