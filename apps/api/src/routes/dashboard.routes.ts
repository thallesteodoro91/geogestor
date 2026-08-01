import type { FastifyInstance } from 'fastify';
import { and, asc, count, eq, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';

export async function dashboardRoutes(server: FastifyInstance) {
  server.get('/overview', async () => {
    const [[clientCounts], [projectCounts], [taskCounts], projectByType, projectByTypeStatus, upcomingTasks] = await Promise.all([
      db.select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(schema.clientes)
        .where(isNull(schema.clientes.deletedAt)),
      db.select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(schema.projetos)
        .where(isNull(schema.projetos.deletedAt)),
      db.select({
        total: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        completed: sql<number>`CAST(SUM(CASE WHEN lower(${schema.tarefas.status}) IN ('concluído', 'concluída', 'finalizada') THEN 1 ELSE 0 END) AS INTEGER)`
      }).from(schema.tarefas)
        .where(and(isNull(schema.tarefas.deletedAt))),
      db.select({
        name: sql<string>`COALESCE(${schema.projetos.tipo}, 'Não Informado')`,
        value: count()
      }).from(schema.projetos).where(isNull(schema.projetos.deletedAt)).groupBy(schema.projetos.tipo),
      db.select({
        type: sql<string>`COALESCE(${schema.projetos.tipo}, 'Não Informado')`,
        status: sql<string>`COALESCE(${schema.projetos.status}, 'Sem Status')`,
        value: count()
      }).from(schema.projetos).where(isNull(schema.projetos.deletedAt)).groupBy(schema.projetos.tipo, schema.projetos.status),
      db.select({
        id: schema.tarefas.id,
        titulo: schema.tarefas.titulo,
        status: schema.tarefas.status,
        dataLimite: schema.tarefas.dataLimite,
        prioridade: schema.tarefas.prioridade,
        projetoNome: schema.projetos.nome,
        clienteNome: schema.clientes.nome
      }).from(schema.tarefas)
        .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
        .leftJoin(schema.clientes, eq(schema.tarefas.clienteId, schema.clientes.id))
        .where(and(
          isNull(schema.tarefas.deletedAt),
          isNotNull(schema.tarefas.dataLimite),
          notInArray(schema.tarefas.status, ['Concluído', 'Concluída', 'Finalizada'])
        )).orderBy(asc(schema.tarefas.dataLimite), asc(schema.tarefas.id)).limit(100)
    ]);
    const tasksTotal = Number(taskCounts?.total || 0);
    const tasksCompleted = Number(taskCounts?.completed || 0);
    return {
      clientsTotal: Number(clientCounts?.total || 0),
      projectsTotal: Number(projectCounts?.total || 0),
      tasksTotal,
      tasksCompleted,
      tasksPending: Math.max(0, tasksTotal - tasksCompleted),
      taskCompletionRate: tasksTotal > 0 ? Math.round(tasksCompleted / tasksTotal * 100) : 0,
      projectByType: projectByType.map((item) => ({ name: item.name, value: Number(item.value) })),
      projectByTypeStatus: projectByTypeStatus.map((item) => ({ type: item.type, status: item.status, value: Number(item.value) })),
      upcomingTasks
    };
  });
}
