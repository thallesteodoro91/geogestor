import { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { sanitizeStoredAuditJson } from '../services/audit.service';

function sanitizeAuditRows<T extends { oldData: string | null; newData: string | null }>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    oldData: sanitizeStoredAuditJson(row.oldData),
    newData: sanitizeStoredAuditJson(row.newData)
  }));
}

export async function auditRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();
  zServer.get('/recent', {
    schema: { querystring: z.object({ limit: z.coerce.number().int().min(1).max(20).default(10) }) }
  }, async (request) => sanitizeAuditRows(await db.select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      entity: schema.auditLogs.entity,
      userId: schema.auditLogs.userId,
      oldData: sql<string | null>`substr(${schema.auditLogs.oldData}, 1, 2000)`,
      newData: sql<string | null>`substr(${schema.auditLogs.newData}, 1, 2000)`,
      createdAt: schema.auditLogs.createdAt
    }).from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(request.query.limit)));

  zServer.get('/', {
    schema: { querystring: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      action: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
      entity: z.string().trim().max(100).optional()
    }) }
  }, async (request, reply) => {
    try {
      const conditions = and(
        request.query.action ? eq(schema.auditLogs.action, request.query.action) : undefined,
        request.query.entity ? eq(schema.auditLogs.entity, request.query.entity) : undefined
      );
      const offset = (request.query.page - 1) * request.query.limit;
      const [items, totals] = await Promise.all([db
        .select()
        .from(schema.auditLogs)
        .where(conditions)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(request.query.limit)
        .offset(offset),
      db.select({
        total: count(),
        inserts: sql<number>`sum(case when ${schema.auditLogs.action} = 'INSERT' then 1 else 0 end)`,
        updates: sql<number>`sum(case when ${schema.auditLogs.action} = 'UPDATE' then 1 else 0 end)`,
        deletes: sql<number>`sum(case when ${schema.auditLogs.action} = 'DELETE' then 1 else 0 end)`
      }).from(schema.auditLogs).where(conditions)]);
      const summary = totals[0] || { total: 0, inserts: 0, updates: 0, deletes: 0 };
      const total = Number(summary.total || 0);
      return {
        items: sanitizeAuditRows(items),
        page: request.query.page,
        limit: request.query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / request.query.limit)),
        summary: { inserts: Number(summary.inserts || 0), updates: Number(summary.updates || 0), deletes: Number(summary.deletes || 0) }
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar logs de auditoria' });
    }
  });
}
