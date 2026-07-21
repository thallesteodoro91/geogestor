import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
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
  expireOverdueBudgets,
  getBudgetAggregate,
  getBudgetKpis,
  getBudgetOptions,
  listBudgets,
  markBudgetViewed,
  reviseBudget,
  transitionBudget,
  updateBudget,
  type BudgetFilters
} from '../services/orcamentos.service';

const paymentSchema = z.object({
  type: z.string().min(1),
  description: z.string().nullable().optional(),
  installments: z.array(InstallmentDefinitionSchema).min(1),
  paymentMethod: z.string().nullable().optional(),
  financialAccount: z.string().nullable().optional(),
  interestBasisPoints: z.number().int().min(0).optional(),
  fineBasisPoints: z.number().int().min(0).optional(),
  earlyDiscountBasisPoints: z.number().int().min(0).optional()
});

const budgetPayloadSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  description: z.string().min(1),
  internalNotes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
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
});

const filterSchema = z.object({
  query: z.string().optional(),
  clientId: z.string().uuid().optional(),
  property: z.string().optional(),
  municipality: z.string().optional(),
  serviceType: z.string().optional(),
  technicalLead: z.string().optional(),
  status: z.enum(BUDGET_STATUSES).optional(),
  issueFrom: z.string().optional(),
  issueTo: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  minValueCents: z.coerce.number().int().min(0).optional(),
  maxValueCents: z.coerce.number().int().min(0).optional(),
  propertyType: z.enum(['rural', 'urbano']).optional(),
  linkedProject: z.enum(['sim', 'nao']).optional()
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
      await expireOverdueBudgets();
      return listBudgets(request.query as BudgetFilters);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao listar orçamentos.' });
    }
  });

  zServer.get('/kpis', { schema: { querystring: filterSchema } }, async (request, reply) => {
    try {
      await expireOverdueBudgets();
      return getBudgetKpis(request.query as BudgetFilters);
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
      body: z.object({ status: z.enum(BUDGET_STATUSES), reason: z.string().nullable().optional() })
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
        })
      })
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
      body: z.object({ reason: z.string().min(3) })
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
        name: z.string().min(1),
        serviceType: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        content: z.record(z.unknown())
      })
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
        name: z.string().min(1).optional(),
        serviceType: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        content: z.record(z.unknown()).optional(),
        active: z.boolean().optional()
      })
    }
  }, async (request) => {
    const updated = await db.update(schema.orcamentoModelos).set({
      nome: request.body.name,
      servicoTipo: request.body.serviceType,
      descricao: request.body.description,
      conteudoJson: request.body.content ? JSON.stringify(request.body.content) : undefined,
      ativo: request.body.active,
      updatedAt: new Date().toISOString()
    }).where(eq(schema.orcamentoModelos.id, request.params.id)).returning();
    return updated[0];
  });

  zServer.post('/tax-profiles', {
    schema: {
      body: z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        taxes: z.array(z.object({
          name: z.string().min(1),
          acronym: z.string().min(1),
          ratePercent: z.string().regex(/^\d+(?:[.,]\d+)?$/),
          calculationBase: z.enum(['tributavel', 'servicos', 'taxas', 'total']),
          includedInPrice: z.boolean(),
          cumulative: z.boolean().optional(),
          financialCategory: z.string().nullable().optional(),
          financialAccount: z.string().nullable().optional(),
          validFrom: z.string().nullable().optional(),
          validUntil: z.string().nullable().optional(),
          notes: z.string().nullable().optional()
        }))
      })
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
        key: z.string().min(1),
        name: z.string().min(1),
        category: z.string().min(1),
        unit: z.string().nullable().optional(),
        valueCents: z.number().int().min(0).nullable().optional(),
        decimalValue: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      })
    }
  }, async (request, reply) => {
    const values = {
      id: crypto.randomUUID(),
      chave: request.body.key,
      nome: request.body.name,
      categoria: request.body.category,
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
