import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AlertSettingsSchema } from '@geogestor/contracts';
import {
  DeadlineAlertStateService,
  getDeadlineAlertSummary,
  getAlertSettings,
  listDeadlineAlertsPage,
  resetAlertSettings,
  saveAlertSettings
} from '../services/deadline-alerts.service';

const IdListSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export async function alertasRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/', {
    schema: { querystring: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      category: z.enum(['project', 'task', 'receivable', 'payable', 'budget', 'license', 'condition', 'appointment', 'crm']).optional(),
      status: z.enum(['all', 'unread', 'read']).default('all'),
      period: z.enum(['all', 'overdue', 'today', '7', '30']).default('all')
    }) }
  }, async (request) => listDeadlineAlertsPage(request.query));
  zServer.get('/resumo', {
    schema: { querystring: z.object({ previewLimit: z.coerce.number().int().min(0).max(20).default(5) }) }
  }, async (request) => getDeadlineAlertSummary(request.query.previewLimit));
  zServer.get('/configuracoes', async () => getAlertSettings());

  zServer.put('/configuracoes', {
    schema: { body: AlertSettingsSchema }
  }, async (request) => saveAlertSettings(request.body));

  zServer.post('/configuracoes/restaurar', async () => resetAlertSettings());

  zServer.post('/ler', {
    schema: { body: IdListSchema }
  }, async (request) => {
    await DeadlineAlertStateService.markRead(request.body.ids);
    return { success: true };
  });

  zServer.post('/ocultar', {
    schema: { body: IdListSchema }
  }, async (request) => {
    await DeadlineAlertStateService.dismiss(request.body.ids);
    return { success: true };
  });

  zServer.post('/restaurar', {
    schema: { body: IdListSchema }
  }, async (request) => {
    await DeadlineAlertStateService.restore(request.body.ids);
    return { success: true };
  });

  zServer.post('/notificacao-nativa', {
    schema: { body: IdListSchema }
  }, async (request) => {
    await DeadlineAlertStateService.markNativeNotified(request.body.ids);
    return { success: true };
  });
}
