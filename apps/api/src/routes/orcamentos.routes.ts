import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { PerformanceMetricsService } from '../services/performance-metrics.service';
import { schema } from '@geogestor/database';
import {
  BUDGET_STATUSES,
  BudgetAdditionAdjustmentSchema,
  BudgetCostInputSchema,
  BudgetDiscountAdjustmentSchema,
  BudgetItemInputSchema,
  BudgetTaxInputSchema,
  InstallmentDefinitionSchema,
  percentageToBasisPoints
} from '@geogestor/contracts';
import { db } from '../db';
import {
  approveBudget,
  createBudget,
  deleteBudget,
  duplicateBudget,
  emitBudget,
  expireOverdueBudgetsIfDue,
  getBudgetAggregate,
  getBudgetKpis,
  getBudgetFilterOptions,
  getBudgetOptions,
  listBudgets,
  listBudgetsPage,
  markBudgetViewed,
  reviseBudget,
  transitionBudget,
  updateBudget,
  type BudgetFilters
} from '../services/orcamentos.service';

const isoDateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Informe uma data válida no formato AAAA-MM-DD.');

const paymentSchema = z.object({
  type: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  installments: z.array(InstallmentDefinitionSchema).min(1).max(60),
  paymentMethod: z.string().nullable().optional(),
  financialAccount: z.string().nullable().optional(),
  interestBasisPoints: z.number().int().min(0).max(10_000).optional(),
  fineBasisPoints: z.number().int().min(0).max(10_000).optional(),
  earlyDiscountBasisPoints: z.number().int().min(0).max(10_000).optional()
}).strict();

const budgetPayloadSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1),
  internalNotes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  issueDate: isoDateSchema.nullable().optional(),
  validUntil: isoDateSchema.nullable().optional(),
  technicalLead: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  serviceType: z.string().nullable().optional(),
  propertyType: z.enum(['rural', 'urbano']).nullable().optional(),
  propertyName: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  methodology: z.string().nullable().optional(),
  deliverables: z.string().nullable().optional(),
  executionDays: z.number().int().min(0).nullable().optional(),
  characterization: z.record(z.unknown()).nullable().optional(),
  globalDiscount: BudgetDiscountAdjustmentSchema,
  globalAddition: BudgetAdditionAdjustmentSchema,
  items: z.array(BudgetItemInputSchema),
  costs: z.array(BudgetCostInputSchema),
  taxes: z.array(BudgetTaxInputSchema),
  payment: paymentSchema
}).strict().superRefine((payload, context) => {
  if (payload.issueDate && payload.validUntil && payload.validUntil < payload.issueDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validUntil'],
      message: 'A validade deve ser igual ou posterior à data de emissão.'
    });
  }
});

const filterSchema = z.object({
  query: z.string().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  property: z.string().optional(),
  municipality: z.string().optional(),
  serviceType: z.string().optional(),
  technicalLead: z.string().optional(),
  status: z.enum(BUDGET_STATUSES).optional(),
  issueFrom: isoDateSchema.optional(),
  issueTo: isoDateSchema.optional(),
  validFrom: isoDateSchema.optional(),
  validTo: isoDateSchema.optional(),
  minValueCents: z.coerce.number().int().min(0).optional(),
  maxValueCents: z.coerce.number().int().min(0).optional(),
  propertyType: z.enum(['rural', 'urbano']).optional(),
  linkedProject: z.enum(['sim', 'nao']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  mode: z.enum(['legacy', 'page']).default('legacy')
}).strict().superRefine((filters, context) => {
  if (filters.issueFrom && filters.issueTo && filters.issueFrom > filters.issueTo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['issueTo'], message: 'A emissão final deve ser igual ou posterior à inicial.' });
  }
  if (filters.validFrom && filters.validTo && filters.validFrom > filters.validTo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['validTo'], message: 'A validade final deve ser igual ou posterior à inicial.' });
  }
  if (filters.minValueCents !== undefined && filters.maxValueCents !== undefined && filters.minValueCents > filters.maxValueCents) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxValueCents'], message: 'O valor máximo deve ser igual ou maior que o mínimo.' });
  }
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação com o orçamento.';
}

function sendDomainError(reply: FastifyReply, error: unknown) {
  const message = errorMessage(error);
  const status = message.includes('não encontrado') ? 404 : message.includes('não pertence') ? 409 : 400;
  return reply.status(status).send({ error: message });
}

export async function orcamentosRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/', { schema: { querystring: filterSchema } }, async (request, reply) => {
    try {
      await expireOverdueBudgetsIfDue();
      const { page, limit, mode, ...filters } = request.query;
      if (mode === 'legacy') {
        reply.header('deprecation', 'true');
        PerformanceMetricsService.recordLegacyContract('GET /api/orcamentos');
      }
      return mode === 'page'
        ? listBudgetsPage(filters as BudgetFilters, page, limit)
        : listBudgets(filters as BudgetFilters);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao listar orçamentos.' });
    }
  });

  zServer.get('/kpis', { schema: { querystring: filterSchema } }, async (request, reply) => {
    try {
      await expireOverdueBudgetsIfDue();
      const { page: _page, limit: _limit, mode: _mode, ...filters } = request.query;
      return getBudgetKpis(filters as BudgetFilters);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao calcular os indicadores de orçamentos.' });
    }
  });

  zServer.get('/options', async (_request, reply) => {
    try {
      return getBudgetOptions();
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao carregar os cadastros para o orçamento.' });
    }
  });

  zServer.get('/filter-options', async (_request, reply) => {
    try {
      return getBudgetFilterOptions();
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao carregar os filtros de orçamentos.' });
    }
  });

  zServer.post('/', { schema: { body: budgetPayloadSchema } }, async (request, reply) => {
    try {
      const created = await createBudget(request.body);
      return reply.status(201).send(created);
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.get('/:id', { schema: { params: z.object({ id: z.string().uuid() }) } }, async (request, reply) => {
    const budget = await getBudgetAggregate(request.params.id);
    if (!budget) return reply.status(404).send({ error: 'Orçamento não encontrado.' });
    return budget;
  });

  zServer.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: budgetPayloadSchema
    }
  }, async (request, reply) => {
    try {
      return await updateBudget(request.params.id, request.body);
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/:id/emit', { schema: { params: z.object({ id: z.string().uuid() }) } }, async (request, reply) => {
    try {
      return await emitBudget(request.params.id);
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/:id/transitions', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ status: z.enum(BUDGET_STATUSES), reason: z.string().nullable().optional() }).strict()
    }
  }, async (request, reply) => {
    try {
      return await transitionBudget(request.params.id, request.body.status, request.body.reason);
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/:id/approve', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        idempotencyKey: z.string().min(12),
        project: z.object({
          mode: z.enum(['existing', 'create']),
          projectId: z.string().uuid().nullable().optional(),
          name: z.string().nullable().optional()
        }).strict()
      }).strict()
    }
  }, async (request, reply) => {
    try {
      return await approveBudget(request.params.id, request.body);
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/:id/viewed', { schema: { params: z.object({ id: z.string().uuid() }) } }, async (request, reply) => {
    try {
      return await markBudgetViewed(request.params.id);
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/:id/duplicate', { schema: { params: z.object({ id: z.string().uuid() }) } }, async (request, reply) => {
    try {
      return reply.status(201).send(await duplicateBudget(request.params.id));
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/:id/revisions', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ reason: z.string().trim().min(3) }).strict()
    }
  }, async (request, reply) => {
    try {
      return reply.status(201).send(await reviseBudget(request.params.id, request.body.reason));
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.delete('/:id', { schema: { params: z.object({ id: z.string().uuid() }) } }, async (request, reply) => {
    try {
      await deleteBudget(request.params.id);
      return reply.status(204).send();
    } catch (error) {
      server.log.error(error);
      return sendDomainError(reply, error);
    }
  });

  zServer.post('/templates', {
    schema: {
      body: z.object({
        name: z.string().trim().min(1),
        serviceType: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        content: z.record(z.unknown())
      }).strict()
    }
  }, async (request, reply) => {
    const template = await db.insert(schema.orcamentoModelos).values({
      id: crypto.randomUUID(),
      nome: request.body.name,
      servicoTipo: request.body.serviceType || null,
      descricao: request.body.description || null,
      conteudoJson: JSON.stringify(request.body.content),
      ativo: true
    }).returning();
    return reply.status(201).send(template[0]);
  });

  zServer.patch('/templates/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        name: z.string().trim().min(1).optional(),
        serviceType: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        content: z.record(z.unknown()).optional(),
        active: z.boolean().optional()
      }).strict()
    }
  }, async (request, reply) => {
    const updated = await db.update(schema.orcamentoModelos).set({
      nome: request.body.name,
      servicoTipo: request.body.serviceType,
      descricao: request.body.description,
      conteudoJson: request.body.content ? JSON.stringify(request.body.content) : undefined,
      ativo: request.body.active,
      updatedAt: new Date().toISOString()
    }).where(eq(schema.orcamentoModelos.id, request.params.id)).returning();
    if (!updated[0]) return reply.status(404).send({ error: 'Modelo de orçamento não encontrado.' });
    return updated[0];
  });

  zServer.post('/tax-profiles', {
    schema: {
      body: z.object({
        name: z.string().trim().min(1),
        description: z.string().nullable().optional(),
        taxes: z.array(z.object({
          name: z.string().trim().min(1),
          acronym: z.string().trim().min(1),
          ratePercent: z.string().regex(/^\d+(?:[.,]\d+)?$/),
          calculationBase: z.enum(['tributavel', 'servicos', 'taxas', 'total']),
          includedInPrice: z.boolean(),
          cumulative: z.boolean().optional(),
          financialCategory: z.string().nullable().optional(),
          financialAccount: z.string().nullable().optional(),
          validFrom: isoDateSchema.nullable().optional(),
          validUntil: isoDateSchema.nullable().optional(),
          notes: z.string().nullable().optional()
        }).strict())
      }).strict()
    }
  }, async (request, reply) => {
    const result = await db.transaction(async (tx) => {
      const profileId = crypto.randomUUID();
      const profile = await tx.insert(schema.perfisTributarios).values({
        id: profileId,
        nome: request.body.name,
        descricao: request.body.description || null,
        ativo: true
      }).returning();
      if (request.body.taxes.length) {
        await tx.insert(schema.tributos).values(request.body.taxes.map((tax) => ({
          id: crypto.randomUUID(),
          perfilId: profileId,
          nome: tax.name,
          sigla: tax.acronym,
          aliquotaPontosBase: percentageToBasisPoints(tax.ratePercent),
          baseCalculo: tax.calculationBase,
          inclusoNoPreco: tax.includedInPrice,
          cumulativo: tax.cumulative || false,
          ativo: true,
          categoriaFinanceira: tax.financialCategory || null,
          contaFinanceira: tax.financialAccount || null,
          vigenciaInicio: tax.validFrom || null,
          vigenciaFim: tax.validUntil || null,
          observacoes: tax.notes || null
        })));
      }
      return profile[0];
    });
    return reply.status(201).send(result);
  });

  zServer.post('/pricing-parameters', {
    schema: {
      body: z.object({
        key: z.string().trim().min(1),
        name: z.string().trim().min(1),
        category: z.string().trim().min(1),
        unit: z.string().nullable().optional(),
        valueCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
        decimalValue: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      }).strict()
    }
  }, async (request, reply) => {
    const values = {
      id: crypto.randomUUID(),
      chave: request.body.key.trim().toLocaleLowerCase('pt-BR'),
      nome: request.body.name.trim(),
      categoria: request.body.category.trim(),
      unidade: request.body.unit || null,
      valorCentavos: request.body.valueCents ?? null,
      valorDecimal: request.body.decimalValue || null,
      observacoes: request.body.notes || null,
      ativo: true,
      updatedAt: new Date().toISOString()
    };
    const result = await db.insert(schema.parametrosPrecificacao).values(values)
      .onConflictDoUpdate({
        target: schema.parametrosPrecificacao.chave,
        set: {
          nome: values.nome,
          categoria: values.categoria,
          unidade: values.unidade,
          valorCentavos: values.valorCentavos,
          valorDecimal: values.valorDecimal,
          observacoes: values.observacoes,
          ativo: values.ativo,
          updatedAt: values.updatedAt
        }
      })
      .returning();
    return reply.status(201).send(result[0]);
  });
}
