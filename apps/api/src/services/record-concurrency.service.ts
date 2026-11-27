import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { eq } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { mutationRecordPath } from '@geogestor/contracts/src/record-concurrency';
import { db, databaseContext } from '../db';
import { nextEditTime } from './edit-concurrency.service';
import { isSqliteBusy } from './sqlite-concurrency.service';

const tables = {
  '/api/clientes': schema.clientes, '/api/projetos': schema.projetos, '/api/contatos': schema.contatos,
  '/api/oportunidades': schema.oportunidades, '/api/tarefas': schema.tarefas,
  '/api/compromissos': schema.compromissos, '/api/licencas': schema.licencas, '/api/orcamentos': schema.orcamentos,
  '/api/tarefas/modelos': schema.checklistModelos, '/api/orcamentos/templates': schema.orcamentoModelos,
  '/api/financeiro/despesas': schema.despesas, '/api/financeiro/orcamentos': schema.orcamentos,
  '/api/financeiro/parcelas': schema.parcelas, '/api/financeiro/viagens': schema.viagens,
  '/api/planejamento/ciclos': schema.ciclosEstrategicos, '/api/planejamento/pilares': schema.pilaresEstrategicos,
  '/api/planejamento/objetivos': schema.objetivosEstrategicos, '/api/planejamento/resultados-chave': schema.resultadosChave,
  '/api/planejamento/iniciativas': schema.iniciativasEstrategicas, '/api/planejamento/checkins': schema.checkinsEstrategicos,
  '/api/planejamento/riscos': schema.riscosEstrategicos, '/api/planejamento/decisoes': schema.decisoesEstrategicas
};
class RollbackReply extends Error {}

export function installRecordConcurrency(server: FastifyInstance) {
  server.get('/api/edicao/atual', async (request, reply) => {
    const path = (request.query as { path?: string }).path || '';
    const recordPath = mutationRecordPath(path);
    const entry = Object.entries(tables).find(([resource]) => resource === recordPath?.slice(0, recordPath.lastIndexOf('/')));
    if (!recordPath || !entry || path !== recordPath) return reply.code(400).send({ error: 'Registro de edição inválido.' });
    const [resource, table] = entry;
    const [row] = await db.select().from(table).where(eq(table.id, path.slice(resource.length + 1))).limit(1);
    return row && !row.deletedAt ? row : reply.code(404).send({ error: 'Registro excluído ou indisponível.' });
  });
  server.addHook('onRoute', (options: RouteOptions) => {
    const methods = Array.isArray(options.method) ? options.method : [options.method];
    if (!methods.some((method) => ['PATCH', 'PUT', 'DELETE', 'POST'].includes(method))) return;
    const matched = Object.entries(tables).find(([resource]) => options.url === resource + '/:id');
    if (!matched) return; // Linked workflows and batch commands need separate domain preconditions.
    const [resource, table] = matched;
    const handler = options.handler;
    options.handler = async function (request: FastifyRequest, reply: FastifyReply) {
      const recordPath = mutationRecordPath(request.url.split('?')[0]);
      if (!recordPath) return handler.call(this, request, reply);
      const id = recordPath.slice(resource.length + 1);
      let buffered = false; let payload: unknown;
      const originalSend = reply.send;
      // Delay response until COMMIT, including handlers using reply.send().
      reply.send = ((value: unknown) => { buffered = true; payload = value; return value; }) as FastifyReply['send'];
      try {
        const result = await db.transaction(async (tx) => databaseContext.run(tx as unknown as typeof db, async () => {
          const [before] = await db.select().from(table).where(eq(table.id, id)).limit(1);
          const expected = request.headers['x-record-version'];
          if (!expected || !before || before.deletedAt || expected !== before.updatedAt) {
            reply.code(!expected && (!before || before.deletedAt) ? 404 : 409);
            payload = { code: 'RECORD_EDIT_CONFLICT', recordPath, current: before && !before.deletedAt ? before : null,
              error: 'Outra janela alterou ou excluiu este registro. Seu rascunho foi preservado. Consulte a versão atual antes de salvar novamente.' };
            buffered = true;
            throw new RollbackReply();
          }
          const result = await handler.call(this, request, reply);
          if (reply.statusCode >= 400) throw new RollbackReply();
          const timestamp = nextEditTime(before.updatedAt);
          await db.update(table).set({ updatedAt: timestamp }).where(eq(table.id, id));
          // RETURNING from the inner route predates the monotonic version stamp.
          const response = buffered ? payload : result;
          if (response && typeof response === 'object' && 'updatedAt' in response) (response as { updatedAt: string }).updatedAt = timestamp;
          return result;
        }));
        reply.send = originalSend;
        return buffered ? reply.send(payload) : result;
      } catch (error) {
        reply.send = originalSend;
        if (error instanceof RollbackReply) return reply.send(payload);
        if (isSqliteBusy(error)) return reply.code(409).send({ code: 'RECORD_EDIT_CONFLICT', recordPath, error: 'Outra gravação está em andamento. Seu rascunho permanece aberto. Consulte a versão atual e tente novamente.' });
        throw error;
      } finally { reply.send = originalSend; }
    };
  });
}
