import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  StrategicCheckinPayloadSchema,
  StrategicCheckinUpdateSchema,
  StrategicCyclePayloadSchema,
  StrategicCycleUpdateSchema,
  StrategicDecisionPayloadSchema,
  StrategicDecisionUpdateSchema,
  StrategicInitiativePayloadSchema,
  StrategicInitiativeUpdateSchema,
  StrategicKeyResultPayloadSchema,
  StrategicKeyResultUpdateSchema,
  StrategicObjectivePayloadSchema,
  StrategicObjectiveUpdateSchema,
  StrategicPillarPayloadSchema,
  StrategicPillarUpdateSchema,
  StrategicRiskPayloadSchema,
  StrategicRiskUpdateSchema
} from '@geogestor/contracts';
import {
  createStrategicCheckin,
  createStrategicCycle,
  createStrategicDecision,
  createStrategicInitiative,
  createStrategicKeyResult,
  createStrategicObjective,
  createStrategicPillar,
  createStrategicRisk,
  deleteStrategicCheckin,
  deleteStrategicCycle,
  deleteStrategicDecision,
  deleteStrategicInitiative,
  deleteStrategicKeyResult,
  deleteStrategicObjective,
  deleteStrategicPillar,
  deleteStrategicRisk,
  getStrategicOptions,
  getStrategicSnapshot,
  listStrategicCycles,
  updateStrategicCheckin,
  updateStrategicCycle,
  updateStrategicDecision,
  updateStrategicInitiative,
  updateStrategicKeyResult,
  updateStrategicObjective,
  updateStrategicPillar,
  updateStrategicRisk
} from '../services/strategic-planning.service';

type IdParams = { id: string };

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues.map((issue) => issue.message).join(' ');
}

function sendError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação estratégica.';
  const status = /não encontrad/i.test(message) ? 404 : 400;
  return reply.status(status).send({ error: message });
}

export async function strategicPlanningRoutes(server: FastifyInstance) {
  server.get('/ciclos', async () => listStrategicCycles());
  server.get('/ciclos/:id', async (request, reply) => {
    try {
      return await getStrategicSnapshot((request.params as IdParams).id);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.get('/opcoes', async () => getStrategicOptions());

  server.post('/ciclos', async (request, reply) => {
    const parsed = StrategicCyclePayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicCycle(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/ciclos/:id', async (request, reply) => {
    const parsed = StrategicCycleUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicCycle((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/ciclos/:id', async (request, reply) => {
    try {
      await deleteStrategicCycle((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/pilares', async (request, reply) => {
    const parsed = StrategicPillarPayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicPillar(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/pilares/:id', async (request, reply) => {
    const parsed = StrategicPillarUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicPillar((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/pilares/:id', async (request, reply) => {
    try {
      await deleteStrategicPillar((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/objetivos', async (request, reply) => {
    const parsed = StrategicObjectivePayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicObjective(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/objetivos/:id', async (request, reply) => {
    const parsed = StrategicObjectiveUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicObjective((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/objetivos/:id', async (request, reply) => {
    try {
      await deleteStrategicObjective((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/resultados-chave', async (request, reply) => {
    const parsed = StrategicKeyResultPayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicKeyResult(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/resultados-chave/:id', async (request, reply) => {
    const parsed = StrategicKeyResultUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicKeyResult((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/resultados-chave/:id', async (request, reply) => {
    try {
      await deleteStrategicKeyResult((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/iniciativas', async (request, reply) => {
    const parsed = StrategicInitiativePayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicInitiative(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/iniciativas/:id', async (request, reply) => {
    const parsed = StrategicInitiativeUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicInitiative((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/iniciativas/:id', async (request, reply) => {
    try {
      await deleteStrategicInitiative((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/checkins', async (request, reply) => {
    const parsed = StrategicCheckinPayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicCheckin(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/checkins/:id', async (request, reply) => {
    const parsed = StrategicCheckinUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicCheckin((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/checkins/:id', async (request, reply) => {
    try {
      await deleteStrategicCheckin((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/riscos', async (request, reply) => {
    const parsed = StrategicRiskPayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicRisk(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/riscos/:id', async (request, reply) => {
    const parsed = StrategicRiskUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicRisk((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/riscos/:id', async (request, reply) => {
    try {
      await deleteStrategicRisk((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post('/decisoes', async (request, reply) => {
    const parsed = StrategicDecisionPayloadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return reply.status(201).send(await createStrategicDecision(parsed.data));
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.patch('/decisoes/:id', async (request, reply) => {
    const parsed = StrategicDecisionUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: validationMessage(parsed.error) });
    try {
      return await updateStrategicDecision((request.params as IdParams).id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });
  server.delete('/decisoes/:id', async (request, reply) => {
    try {
      await deleteStrategicDecision((request.params as IdParams).id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
