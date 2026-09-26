import type { FastifyInstance } from 'fastify';
import { and, asc, count, eq, gte, isNotNull, isNull, lte, notInArray, sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';

type DashboardOverviewQuery = {
  projectScope?: 'active' | 'all';
  tasksInicio?: string;
  tasksFim?: string;
};

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const normalizedProjectStatus = sql<string>`lower(trim(coalesce(${schema.projetos.status}, '')))`;
const activeProjectCondition = sql<boolean>`${normalizedProjectStatus} not in (
  'concluído', 'concluido', 'concluída', 'concluida',
  'finalizado', 'finalizada', 'cancelado', 'cancelada', 'arquivado', 'arquivada'
)`;
const normalizedTaskStatus = sql<string>`lower(trim(coalesce(${schema.tarefas.status}, '')))`;
const completedTaskCondition = sql<boolean>`${normalizedTaskStatus} in (
  'concluído', 'concluido', 'concluída', 'concluida', 'finalizado', 'finalizada'
)`;
const taskDueDate = sql<string>`substr(${schema.tarefas.dataLimite}, 1, 10)`;

function isValidDateKey(value: string | undefined): value is string {
  if (!value || !dateKeyPattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function dashboardRoutes(server: FastifyInstance) {
  server.get<{ Querystring: DashboardOverviewQuery }>('/overview', async (request, reply) => {
    const projectScope = request.query.projectScope ?? 'active';
    const tasksInicio = request.query.tasksInicio;
    const tasksFim = request.query.tasksFim;

    if (projectScope !== 'active' && projectScope !== 'all') {
      return reply.status(400).send({ error: 'Escopo de projetos inválido. Use active ou all.' });
    }
    if (Boolean(tasksInicio) !== Boolean(tasksFim)) {
      return reply.status(400).send({ error: 'Informe as datas inicial e final do período de tarefas.' });
    }
    if ((tasksInicio && !isValidDateKey(tasksInicio)) || (tasksFim && !isValidDateKey(tasksFim))) {
      return reply.status(400).send({ error: 'Use datas válidas no formato AAAA-MM-DD.' });
    }
    if (tasksInicio && tasksFim && tasksInicio > tasksFim) {
      return reply.status(400).send({ error: 'A data inicial não pode ser posterior à data final.' });
    }

    const projectScopeWhere = and(
      isNull(schema.projetos.deletedAt),
      projectScope === 'active' ? activeProjectCondition : undefined,
    );
    const taskCompletionWhere = and(
      isNull(schema.tarefas.deletedAt),
      isNotNull(schema.tarefas.dataLimite),
      tasksInicio ? gte(taskDueDate, tasksInicio) : undefined,
      tasksFim ? lte(taskDueDate, tasksFim) : undefined,
    );

    const [
      [clientCounts],
      [projectCounts],
      [taskCounts],
      [taskCompletionCounts],
      projectByType,
      projectByTypeStatus,
      upcomingTasks,
      upcomingLicenses,
    ] = await Promise.all([
      db.select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(schema.clientes)
        .where(isNull(schema.clientes.deletedAt)),
      db.select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(schema.projetos)
        .where(isNull(schema.projetos.deletedAt)),
      db.select({
        total: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        completed: sql<number>`CAST(SUM(CASE WHEN ${completedTaskCondition} THEN 1 ELSE 0 END) AS INTEGER)`
      }).from(schema.tarefas)
        .where(and(isNull(schema.tarefas.deletedAt))),
      db.select({
        total: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        completed: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${completedTaskCondition} THEN 1 ELSE 0 END), 0) AS INTEGER)`
      }).from(schema.tarefas)
        .where(taskCompletionWhere),
      db.select({
        name: sql<string>`COALESCE(NULLIF(TRIM(${schema.projetos.tipo}), ''), 'Não informado')`,
        value: count()
      }).from(schema.projetos).where(projectScopeWhere).groupBy(schema.projetos.tipo),
      db.select({
        type: sql<string>`COALESCE(NULLIF(TRIM(${schema.projetos.tipo}), ''), 'Não informado')`,
        status: sql<string>`COALESCE(NULLIF(TRIM(${schema.projetos.status}), ''), 'Sem status')`,
        value: count()
      }).from(schema.projetos).where(projectScopeWhere).groupBy(schema.projetos.tipo, schema.projetos.status),
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
          sql`trim(coalesce(${schema.tarefas.dataLimite}, '')) <> ''`,
          sql`not (${completedTaskCondition})`
        )).orderBy(asc(schema.tarefas.dataLimite), asc(schema.tarefas.id)).limit(100),
      db.select({
        id: schema.licencas.id,
        projetoId: schema.licencas.projetoId,
        numero: schema.licencas.numero,
        orgao: schema.licencas.orgao,
        dataVencimento: schema.licencas.dataVencimento,
        status: schema.licencas.status,
        projetoNome: schema.projetos.nome
      }).from(schema.licencas)
        .leftJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
        .where(and(
          isNull(schema.licencas.deletedAt),
          isNotNull(schema.licencas.dataVencimento),
          notInArray(schema.licencas.status, ['Concluído', 'Entregue', 'Cancelada', 'Arquivada'])
        )).orderBy(asc(schema.licencas.dataVencimento), asc(schema.licencas.id)).limit(100)
    ]);
    const tasksTotal = Number(taskCounts?.total || 0);
    const tasksCompleted = Number(taskCounts?.completed || 0);
    const completionTotal = Number(taskCompletionCounts?.total || 0);
    const completionCompleted = Number(taskCompletionCounts?.completed || 0);
    const projectsInScope = projectByType.reduce((total, item) => total + Number(item.value), 0);
    return {
      clientsTotal: Number(clientCounts?.total || 0),
      projectsTotal: Number(projectCounts?.total || 0),
      tasksTotal,
      tasksCompleted,
      tasksPending: Math.max(0, tasksTotal - tasksCompleted),
      taskCompletionRate: tasksTotal > 0 ? Math.round(tasksCompleted / tasksTotal * 100) : 0,
      taskCompletion: {
        inicio: tasksInicio ?? null,
        fim: tasksFim ?? null,
        total: completionTotal,
        completed: completionCompleted,
        pending: Math.max(0, completionTotal - completionCompleted),
        rate: completionTotal > 0 ? Math.round(completionCompleted / completionTotal * 100) : 0,
      },
      projectScope,
      projectsInScope,
      projectByType: projectByType.map((item) => ({ name: item.name, value: Number(item.value) })),
      projectByTypeStatus: projectByTypeStatus.map((item) => ({ type: item.type, status: item.status, value: Number(item.value) })),
      upcomingTasks,
      upcomingLicenses
    };
  });
}
