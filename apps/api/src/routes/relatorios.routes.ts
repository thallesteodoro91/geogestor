import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReportPeriodValidationError } from '../services/reports/report-period';
import { generateManagerialReportFromSql } from '../services/reports/report-query.service';

const ReportQuerySchema = z.object({
  inicio: z.string().trim().max(10).optional(),
  fim: z.string().trim().max(10).optional()
}).strict();

export async function relatoriosRoutes(server: FastifyInstance) {
  server.get('/geral', async (request, reply) => {
    try {
      const parsed = ReportQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Use apenas inicio e fim, uma única vez, no formato AAAA-MM-DD.' });
      }
      const query = parsed.data;
      return await generateManagerialReportFromSql(query);
    } catch (error) {
      if (error instanceof ReportPeriodValidationError) {
        return reply.status(400).send({ error: error.message });
      }
      server.log.error(error);
      return reply.status(500).send({ error: 'Erro ao gerar dados do relatório geral.' });
    }
  });
}
