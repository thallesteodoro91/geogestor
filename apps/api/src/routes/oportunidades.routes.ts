import type { FastifyInstance } from 'fastify';
import {
  OpportunityConvertProjectSchema,
  OpportunityLinkBudgetSchema,
  OpportunityPayloadSchema,
  OpportunityReorderSchema,
  OpportunityTransitionSchema,
  OpportunityUpdateSchema
} from '@geogestor/contracts';
import {
  convertOpportunityToProject,
  createOpportunity,
  deleteOpportunity,
  getOpportunity,
  getOpportunityAnalytics,
  getOpportunityOptions,
  linkOpportunityBudget,
  listOpportunities,
  reorderOpportunities,
  transitionOpportunity,
  updateOpportunity
} from '../services/oportunidades.service';

type IdParams = { id: string };

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues.map((issue) => issue.message).join(' ');
}

function sendError(reply: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
  const status = /não encontrad/i.test(message) ? 404 : 400;
  return reply.status(status).send({ error: message });
}

export async function oportunidadesRoutes(server: FastifyInstance) {
  server.get('/', async () => listOpportunities());
  server.get('/analytics', async () => getOpportunityAnalytics());
  server.get('/options', async () => getOpportunityOptions());
  server.get('/:id', async (request, reply) => {
    try {
      return await getOpportunity((request.params as IdParams).id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/', async (request, reply) => {
    const parsed = OpportunityPayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createOpportunity(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch('/reorder', async (request, reply) => {
    const parsed = OpportunityReorderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await reorderOpportunities(parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch('/:id', async (request, reply) => {
    const parsed = OpportunityUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateOpportunity((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch('/:id/transition', async (request, reply) => {
    const parsed = OpportunityTransitionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await transitionOpportunity((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/:id/link-budget', async (request, reply) => {
    const parsed = OpportunityLinkBudgetSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await linkOpportunityBudget((request.params as IdParams).id, parsed.data.orcamentoId);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/:id/convert-project', async (request, reply) => {
    const parsed = OpportunityConvertProjectSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await convertOpportunityToProject((request.params as IdParams).id, parsed.data.nomeProjeto);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.delete('/:id', async (request, reply) => {
    try {
      await deleteOpportunity((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
