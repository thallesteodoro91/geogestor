import { FastifyInstance } from 'fastify';
import {
  generateManagerialReport,
  ReportPeriodValidationError
} from '../services/reports.service';

export async function relatoriosRoutes(server: FastifyInstance) {
  server.get('/geral', async (request, reply) => {
    try {
      const query = request.query as { inicio?: string; fim?: string };
      return await generateManagerialReport(query);
    } catch (error) {
      if (error instanceof ReportPeriodValidationError) {
        return reply.status(400).send({ error: error.message });
      }
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao gerar dados do relatório geral.' });
    }
  });
}
