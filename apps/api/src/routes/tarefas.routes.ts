import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, or, and, isNull, isNotNull, ne, desc, asc, count, like, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';
import { AuditLogService } from '../services/audit.service';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RelationshipIntegrityError, resolveClientProjectLink } from '../services/relationship-integrity.service';

const taskDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidTaskDate = (value: string) => {
  if (value === '') return true;
  if (!taskDatePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const TarefaPayloadSchema = z.object({
  titulo: z.string().trim().min(1).max(180),
  clienteId: z.string().uuid().nullable().optional(),
  projetoId: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().max(2_000).nullable().optional(),
  status: z.enum(['A Fazer', 'Em Progresso', 'Concluído']).optional(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta']).optional(),
  categoria: z.string().trim().max(100).optional(),
  dataLimite: z.string().refine(isValidTaskDate, 'Informe uma data válida no formato AAAA-MM-DD.').nullable().optional()
}).strict();

const TarefaPatchSchema = TarefaPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Informe ao menos um campo para atualizar.'
);

const ChecklistStepSchema = z.object({
  titulo: z.string().trim().min(1).max(180),
  descricao: z.string().trim().max(1000).nullable().optional(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta']).default('Média')
}).strict();

const ChecklistModelPayloadSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  descricao: z.string().trim().max(1000).nullable().optional(),
  tipoProjeto: z.string().trim().max(120).nullable().optional(),
  ativo: z.boolean().default(true),
  etapas: z.array(ChecklistStepSchema).min(1, 'Inclua pelo menos uma etapa.').max(100)
}).strict();

const TaskListQuerySchema = z.object({
  projetoId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(200).optional(),
  id: z.string().uuid().optional(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta']).optional(),
  inicio: z.string().refine((value) => value !== '' && isValidTaskDate(value), 'Informe uma data inicial real no formato AAAA-MM-DD.').optional(),
  fim: z.string().refine((value) => value !== '' && isValidTaskDate(value), 'Informe uma data final real no formato AAAA-MM-DD.').optional(),
  mode: z.enum(['legacy', 'page']).default('legacy')
}).strict().superRefine((value, context) => {
  if (value.inicio && value.fim && value.fim < value.inicio) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fim'], message: 'A data final deve ser igual ou posterior à inicial.' });
  }
});

const searchableTaskText = sql<string>`lower(
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    coalesce(${schema.tarefas.titulo}, '') || ' ' || coalesce(${schema.tarefas.descricao}, '') || ' ' ||
    coalesce(${schema.projetos.nome}, '') || ' ' || coalesce(${schema.clientes.nome}, ''),
    'á', 'a'), 'à', 'a'), 'â', 'a'), 'ã', 'a'), 'é', 'e'), 'ê', 'e'), 'í', 'i'),
    'ó', 'o'), 'ô', 'o'), 'õ', 'o')
)`;

const searchableTaskTextNormalized = sql<string>`replace(replace(replace(
  ${searchableTaskText}, 'ú', 'u'), 'ü', 'u'), 'ç', 'c')`;

export const normalizeTaskTitle = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('pt-BR');

export async function tarefasRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  const loadChecklistModel = async (modelIdOrKey: string, includeInactive = false, database: any = db) => {
    const [model] = await database.select().from(schema.checklistModelos).where(and(
      or(eq(schema.checklistModelos.id, modelIdOrKey), eq(schema.checklistModelos.chave, modelIdOrKey)),
      isNull(schema.checklistModelos.deletedAt),
      includeInactive ? undefined : eq(schema.checklistModelos.ativo, true)
    )).limit(1);
    if (!model) return null;
    const etapas = await database.select().from(schema.checklistModeloEtapas).where(and(
      eq(schema.checklistModeloEtapas.modeloId, model.id),
      isNull(schema.checklistModeloEtapas.deletedAt)
    )).orderBy(asc(schema.checklistModeloEtapas.ordem), asc(schema.checklistModeloEtapas.id));
    return { ...model, etapas };
  };

  const applyChecklistModel = async (projetoId: string, modelIdOrKey: string) => {
    return db.transaction(async (tx) => {
      const [projeto] = await tx.select({
        id: schema.projetos.id,
        clienteId: schema.projetos.clienteId
      }).from(schema.projetos).where(and(
        eq(schema.projetos.id, projetoId),
        isNull(schema.projetos.deletedAt)
      )).limit(1);
      if (!projeto) return { error: 'Projeto não encontrado' as const, statusCode: 404 as const };

      const model = await loadChecklistModel(modelIdOrKey, false, tx);
      if (!model) return { error: 'Modelo de checklist ativo não encontrado' as const, statusCode: 404 as const };

      const existingTasks = await tx.select({ titulo: schema.tarefas.titulo })
        .from(schema.tarefas)
        .where(and(eq(schema.tarefas.projetoId, projetoId), isNull(schema.tarefas.deletedAt)));
      const existingTitles = new Set(existingTasks.map((task: { titulo: string }) => normalizeTaskTitle(task.titulo)));
      const stepsToCreate = model.etapas.filter((step: { titulo: string }) => {
        const normalized = normalizeTaskTitle(step.titulo);
        if (existingTitles.has(normalized)) return false;
        existingTitles.add(normalized);
        return true;
      });

      const rows = [];
      const taskTimestamp = new Date().toISOString();
      for (const step of stepsToCreate) {
        const [task] = await tx.insert(schema.tarefas).values({
          id: crypto.randomUUID(),
          clienteId: projeto.clienteId,
          projetoId,
          titulo: step.titulo,
          descricao: step.descricao || '',
          status: 'A Fazer',
          prioridade: step.prioridade,
          categoria: 'Trabalho',
          contextoTipo: 'projeto',
          dataLimite: '',
          createdAt: taskTimestamp,
          updatedAt: taskTimestamp
        }).returning();
        rows.push(task);
        await AuditLogService.log('INSERT', 'Tarefa', null, task, tx);
      }
      const applicationId = crypto.randomUUID();
      const [application] = await tx.insert(schema.checklistModeloAplicacoes).values({
        id: applicationId,
        modeloId: model.id,
        projetoId,
        tarefasCriadas: rows.length,
        tarefasIgnoradas: model.etapas.length - rows.length
      }).returning();
      await AuditLogService.log('INSERT', 'AplicacaoModeloChecklist', null, application, tx);
      if (projeto.clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: projeto.clienteId,
          projetoId,
          tipo: 'Checklist',
          titulo: `Modelo de checklist aplicado: ${model.nome}`,
          categoria: 'Tarefa',
          descricao: `${rows.length} tarefa(s) criada(s) e ${model.etapas.length - rows.length} item(ns) já existente(s) preservado(s).`
        }, tx);
      }
      return {
        aplicacaoId: applicationId,
        modelo: { id: model.id, nome: model.nome },
        criadas: rows.length,
        ignoradas: model.etapas.length - rows.length,
        tarefas: rows
      };
    });
  };

  zServer.get('/', {
    schema: {
      querystring: TaskListQuerySchema
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
    if (q) condition = and(condition, like(searchableTaskTextNormalized, `%${normalizeTaskTitle(q)}%`))!;
    if (request.query.id) condition = and(condition, eq(schema.tarefas.id, request.query.id))!;
    if (request.query.prioridade) condition = and(condition, eq(schema.tarefas.prioridade, request.query.prioridade))!;
    if (request.query.inicio || request.query.fim) {
      condition = and(condition, isNotNull(schema.tarefas.dataLimite), ne(schema.tarefas.dataLimite, ''))!;
    }
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
      .orderBy(desc(schema.tarefas.createdAt), asc(schema.tarefas.id));

    const items = mode === 'legacy' ? await query : await query.limit(limit).offset(offset);
    if (mode === 'legacy') return items;
    const [{ total, todo, progress, done, others }] = await db.select({
      total: count(),
      todo: sql<number>`CAST(SUM(CASE WHEN ${schema.tarefas.status} = 'A Fazer' THEN 1 ELSE 0 END) AS INTEGER)`,
      progress: sql<number>`CAST(SUM(CASE WHEN ${schema.tarefas.status} = 'Em Progresso' THEN 1 ELSE 0 END) AS INTEGER)`,
      done: sql<number>`CAST(SUM(CASE WHEN ${schema.tarefas.status} = 'Concluído' THEN 1 ELSE 0 END) AS INTEGER)`,
      others: sql<number>`CAST(SUM(CASE WHEN ${schema.tarefas.status} NOT IN ('A Fazer', 'Em Progresso', 'Concluído') THEN 1 ELSE 0 END) AS INTEGER)`
    })
      .from(schema.tarefas)
      .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, eq(schema.tarefas.clienteId, schema.clientes.id))
      .where(condition);
    return {
      items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      statusTotals: {
        'A Fazer': Number(todo || 0),
        'Em Progresso': Number(progress || 0),
        'Concluído': Number(done || 0),
        outros: Number(others || 0)
      }
    };
  });

  zServer.get('/options', {
    schema: { querystring: z.object({
      q: z.string().trim().max(200).optional(),
      projetoId: z.string().uuid().optional(),
      selectedId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(25)
    }).strict() }
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
      inicio: z.string().refine((value) => value !== '' && isValidTaskDate(value), 'Informe uma data inicial real no formato AAAA-MM-DD.'),
      fim: z.string().refine((value) => value !== '' && isValidTaskDate(value), 'Informe uma data final real no formato AAAA-MM-DD.')
    }).strict().superRefine((value, context) => {
      if (value.fim < value.inicio) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fim'], message: 'A data final deve ser igual ou posterior à inicial.' });
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
    )).orderBy(asc(schema.tarefas.dataLimite), asc(schema.tarefas.id)));

  zServer.get('/:id', {
    schema: { params: z.object({ id: z.string().uuid() }).strict() }
  }, async (request, reply) => {
    const [task] = await db.select({
      id: schema.tarefas.id,
      titulo: schema.tarefas.titulo,
      descricao: schema.tarefas.descricao,
      status: schema.tarefas.status,
      prioridade: schema.tarefas.prioridade,
      categoria: schema.tarefas.categoria,
      dataLimite: schema.tarefas.dataLimite,
      clienteId: schema.tarefas.clienteId,
      clienteNome: schema.clientes.nome,
      projetoId: schema.tarefas.projetoId,
      projetoNome: schema.projetos.nome
    }).from(schema.tarefas)
      .leftJoin(schema.projetos, and(eq(schema.tarefas.projetoId, schema.projetos.id), isNull(schema.projetos.deletedAt)))
      .leftJoin(schema.clientes, and(eq(schema.tarefas.clienteId, schema.clientes.id), isNull(schema.clientes.deletedAt)))
      .where(and(eq(schema.tarefas.id, request.params.id), isNull(schema.tarefas.deletedAt))).limit(1);
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' });
    return task;
  });

  zServer.get('/modelos', {
    schema: { querystring: z.object({
      ativos: z.enum(['true', 'false']).transform((value) => value === 'true').optional()
    }).strict() }
  }, async (request) => {
    const models = await db.select().from(schema.checklistModelos).where(and(
      isNull(schema.checklistModelos.deletedAt),
      request.query.ativos ? eq(schema.checklistModelos.ativo, true) : undefined
    )).orderBy(desc(schema.checklistModelos.ativo), asc(schema.checklistModelos.nome));
    return Promise.all(models.map(async (model) => {
      const etapas = await db.select().from(schema.checklistModeloEtapas).where(and(
        eq(schema.checklistModeloEtapas.modeloId, model.id),
        isNull(schema.checklistModeloEtapas.deletedAt)
      )).orderBy(asc(schema.checklistModeloEtapas.ordem), asc(schema.checklistModeloEtapas.id));
      return { ...model, etapas };
    }));
  });

  zServer.post('/modelos', {
    schema: { body: ChecklistModelPayloadSchema }
  }, async (request) => db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const [model] = await tx.insert(schema.checklistModelos).values({
      id: crypto.randomUUID(),
      chave: null,
      nome: request.body.nome,
      descricao: request.body.descricao || null,
      tipoProjeto: request.body.tipoProjeto || null,
      ativo: request.body.ativo,
      createdAt: now,
      updatedAt: now
    }).returning();
    const etapas = [];
    for (const [ordem, step] of request.body.etapas.entries()) {
      const [created] = await tx.insert(schema.checklistModeloEtapas).values({
        id: crypto.randomUUID(), modeloId: model.id, titulo: step.titulo,
        descricao: step.descricao || null, prioridade: step.prioridade, ordem,
        createdAt: now, updatedAt: now
      }).returning();
      etapas.push(created);
    }
    await AuditLogService.log('INSERT', 'ModeloChecklist', null, { ...model, etapas }, tx);
    return { ...model, etapas };
  }));

  zServer.patch('/modelos/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }).strict(),
      body: ChecklistModelPayloadSchema
    }
  }, async (request, reply) => {
    const previous = await loadChecklistModel(request.params.id, true);
    if (!previous) return reply.status(404).send({ error: 'Modelo de checklist não encontrado' });
    const now = new Date().toISOString();
    return db.transaction(async (tx) => {
      const [model] = await tx.update(schema.checklistModelos).set({
        nome: request.body.nome,
        descricao: request.body.descricao || null,
        tipoProjeto: request.body.tipoProjeto || null,
        ativo: request.body.ativo,
        updatedAt: now
      }).where(eq(schema.checklistModelos.id, request.params.id)).returning();
      await tx.update(schema.checklistModeloEtapas).set({ deletedAt: now, updatedAt: now })
        .where(and(eq(schema.checklistModeloEtapas.modeloId, model.id), isNull(schema.checklistModeloEtapas.deletedAt)));
      const etapas = [];
      for (const [ordem, step] of request.body.etapas.entries()) {
        const [created] = await tx.insert(schema.checklistModeloEtapas).values({
          id: crypto.randomUUID(), modeloId: model.id, titulo: step.titulo,
          descricao: step.descricao || null, prioridade: step.prioridade, ordem,
          createdAt: now, updatedAt: now
        }).returning();
        etapas.push(created);
      }
      await AuditLogService.log('UPDATE', 'ModeloChecklist', previous, { ...model, etapas }, tx);
      return { ...model, etapas };
    });
  });

  zServer.post('/modelos/:id/duplicar', {
    schema: {
      params: z.object({ id: z.string().uuid() }).strict(),
      body: z.object({}).strict()
    }
  }, async (request, reply) => {
    const source = await loadChecklistModel(request.params.id, true);
    if (!source) return reply.status(404).send({ error: 'Modelo de checklist não encontrado' });
    const now = new Date().toISOString();
    return db.transaction(async (tx) => {
      const [model] = await tx.insert(schema.checklistModelos).values({
        id: crypto.randomUUID(), chave: null, nome: `${source.nome} — cópia`,
        descricao: source.descricao, tipoProjeto: source.tipoProjeto, ativo: false,
        createdAt: now, updatedAt: now
      }).returning();
      const etapas = [];
      for (const step of source.etapas) {
        const [created] = await tx.insert(schema.checklistModeloEtapas).values({
          id: crypto.randomUUID(), modeloId: model.id, titulo: step.titulo,
          descricao: step.descricao, prioridade: step.prioridade, ordem: step.ordem,
          createdAt: now, updatedAt: now
        }).returning();
        etapas.push(created);
      }
      await AuditLogService.log('INSERT', 'ModeloChecklist', null, { ...model, etapas }, tx);
      return { ...model, etapas };
    });
  });

  zServer.delete('/modelos/:id', {
    schema: { params: z.object({ id: z.string().uuid() }).strict() }
  }, async (request, reply) => {
    const previous = await loadChecklistModel(request.params.id, true);
    if (!previous) return reply.status(404).send({ error: 'Modelo de checklist não encontrado' });
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.update(schema.checklistModelos).set({ ativo: false, deletedAt: now, updatedAt: now })
        .where(eq(schema.checklistModelos.id, request.params.id));
      await AuditLogService.log('DELETE (SOFT)', 'ModeloChecklist', previous, null, tx);
    });
    return { success: true };
  });

  zServer.post('/modelos/:id/aplicar', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ projetoId: z.string().uuid() }).strict()
    }
  }, async (request, reply) => {
    const result = await applyChecklistModel(request.body.projetoId, request.params.id);
    if ('error' in result) return reply.status(result.statusCode || 404).send({ error: result.error });
    return result;
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

    let link: Awaited<ReturnType<typeof resolveClientProjectLink>>;
    try {
      link = await resolveClientProjectLink({
        projetoId: body.projetoId || null,
        clienteId: body.clienteId || null
      });
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
    const projetoId = link.projetoId;
    const clienteId = link.clienteId;

    const novaTarefa = await db.transaction(async (tx) => {
      const taskTimestamp = new Date().toISOString();
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
        dataLimite: body.dataLimite || '',
        createdAt: taskTimestamp,
        updatedAt: taskTimestamp
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

  zServer.post('/aplicar-modelo', {
    schema: {
      body: z.object({
        projetoId: z.string().uuid(),
        modelo: z.string().trim().min(1).max(160)
      }).strict()
    }
  }, async (request, reply) => {
    const result = await applyChecklistModel(request.body.projetoId, request.body.modelo);
    if ('error' in result) return reply.status(result.statusCode || 404).send({ error: result.error });
    return result;
  });

  zServer.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }).strict(),
      body: TarefaPatchSchema
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;
    
    const tarefaAnterior = await db.select()
      .from(schema.tarefas)
      .where(and(eq(schema.tarefas.id, id), isNull(schema.tarefas.deletedAt)))
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
        .where(and(eq(schema.tarefas.id, id), isNull(schema.tarefas.deletedAt)))
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
      params: z.object({ id: z.string().uuid() }).strict()
    }
  }, async (request, reply) => {
    const { id } = request.params;

    const deletado = await db.transaction(async (tx) => {
      const removed = await tx.update(schema.tarefas)
        .set({ deletedAt: new Date().toISOString() })
        .where(and(eq(schema.tarefas.id, id), isNull(schema.tarefas.deletedAt)))
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
