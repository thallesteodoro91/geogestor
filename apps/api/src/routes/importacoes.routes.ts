import type { FastifyInstance, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { previewFullSpreadsheetImport } from '../services/full-spreadsheet-import.service';
import { FullImportWorkerService } from '../services/full-import-worker.service';
import {
  ensureImportInfrastructure,
  getImportRun,
  importContentDigest,
  importErrorsCsv,
  ImportRunError,
  listImportRows,
  listImportRuns,
  queueConfirmedPreview,
  recoverInterruptedImportRuns,
  registerImportPreview
} from '../services/import-run.service';
import { OperationalLogService } from '../services/operational-log.service';

const ScalarCellSchema = z.union([
  z.string().max(20_000),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

const FullImportSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
  sheetName: z.string().trim().min(1).max(100).optional(),
  headers: z.array(z.string().trim().min(1).max(300)).min(1).max(300),
  rows: z.array(z.record(z.string().max(300), ScalarCellSchema).refine(row => Object.keys(row).length <= 300, 'A linha excede 300 colunas.')).min(1).max(20_000),
  firstDataRow: z.number().int().min(2).max(1_000_000).optional(),
  mappingOverrides: z.record(z.string().max(300), z.string().max(100).nullable()).optional(),
  clientTimings: z.object({
    readingMs: z.number().nonnegative().max(3_600_000),
    hashingMs: z.number().nonnegative().max(3_600_000)
  }).strict().optional()
}).strict();

const FullConfirmationSchema = FullImportSchema.extend({
  previewId: z.string().uuid()
}).strict();

function validationMessage(error: z.ZodError) {
  return { error: 'Revise o arquivo enviado.', issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) };
}

function sourceMetadata(fileName: string, sheetName?: string) {
  const lastDot = fileName.lastIndexOf('.');
  return {
    sourceName: lastDot > 0 ? fileName.slice(0, lastDot).slice(0, 200) : fileName.slice(0, 200),
    sourceExtension: lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : 'sem extensão',
    worksheet: sheetName ?? null
  };
}

function contentForDigest(input: z.infer<typeof FullImportSchema>) {
  return {
    fileName: input.fileName,
    sheetName: input.sheetName ?? null,
    headers: input.headers,
    rows: input.rows,
    firstDataRow: input.firstDataRow ?? 2,
    mappingOverrides: input.mappingOverrides ?? {}
  };
}

function importErrorReply(reply: FastifyReply, error: unknown) {
  if (error instanceof ImportRunError) {
    return reply.status(error.statusCode).send({ error: error.message, code: error.code });
  }
  throw error;
}

export async function importacoesRoutes(server: FastifyInstance) {
  await ensureImportInfrastructure();
  await recoverInterruptedImportRuns();
  FullImportWorkerService.kick();

  server.post('/migracao-completa/preview', { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
    const startedAt = performance.now();
    const parsed = FullImportSchema.safeParse(request.body);
    if (!parsed.success) {
      await OperationalLogService.warn('spreadsheet-import-preview-rejected', {
        operationId: crypto.randomUUID(), importType: 'complete', status: 'rejected',
        issueCount: parsed.error.issues.length, durationMs: Math.round(performance.now() - startedAt)
      });
      return reply.status(400).send(validationMessage(parsed.error));
    }
    try {
      const digest = importContentDigest(contentForDigest(parsed.data));
      const preview = await previewFullSpreadsheetImport(parsed.data);
      const registration = await registerImportPreview({
        entity: 'complete',
        digest,
        sourceName: parsed.data.fileName,
        sourceHash: digest,
        totalRows: parsed.data.rows.length,
        preview: preview as unknown as Record<string, unknown>
      });
      await OperationalLogService.info('spreadsheet-import-preview', {
        operationId: registration.previewId,
        importType: 'complete',
        sourceExtension: sourceMetadata(parsed.data.fileName, parsed.data.sheetName).sourceExtension,
        worksheet: parsed.data.sheetName ?? null,
        contentDigest: digest,
        rows: parsed.data.rows.length,
        columns: parsed.data.headers.length,
        readingMs: parsed.data.clientTimings?.readingMs ?? null,
        hashingMs: parsed.data.clientTimings?.hashingMs ?? null,
        previewMs: Math.round(performance.now() - startedAt),
        status: preview.status,
        blocking: preview.counts.blocking,
        warnings: preview.counts.warnings
      });
      return { ...preview, importId: registration.previewId, ...registration };
    } catch (error) {
      await OperationalLogService.error('spreadsheet-import-preview-failed', {
        operationId: crypto.randomUUID(), importType: 'complete',
        sourceExtension: sourceMetadata(parsed.data.fileName, parsed.data.sheetName).sourceExtension,
        rows: parsed.data.rows.length, columns: parsed.data.headers.length,
        reason: error, previewMs: Math.round(performance.now() - startedAt)
      });
      throw error;
    }
  });

  server.post('/migracao-completa/confirmar', { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
    const parsed = FullConfirmationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(validationMessage(parsed.error));
    const { previewId, ...payload } = parsed.data;
    try {
      const digest = importContentDigest(contentForDigest(payload));
      const queued = await queueConfirmedPreview(previewId, digest, payload);
      await OperationalLogService.info('spreadsheet-import-queued', {
        operationId: queued.importId,
        importType: 'complete',
        sourceExtension: sourceMetadata(payload.fileName, payload.sheetName).sourceExtension,
        contentDigest: digest,
        rows: payload.rows.length,
        columns: payload.headers.length,
        status: queued.status
      });
      FullImportWorkerService.kick();
      return reply.status(202).send(queued);
    } catch (error) {
      return importErrorReply(reply, error);
    }
  });

  server.get('/historico', async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(request.query);
    return { items: await listImportRuns(query.limit) };
  });

  server.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const run = await getImportRun(id);
    if (!run) return reply.status(404).send({ error: 'Importação não encontrada.' });
    return run;
  });

  server.get('/:id/linhas', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!await getImportRun(id)) return reply.status(404).send({ error: 'Importação não encontrada.' });
    const query = z.object({ errorsOnly: z.coerce.boolean().default(false) }).parse(request.query);
    return { items: await listImportRows(id, query.errorsOnly) };
  });

  server.get('/:id/erros.csv', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!await getImportRun(id)) return reply.status(404).send({ error: 'Importação não encontrada.' });
    const rows = await listImportRows(id, true);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="importacao-${id}-erros.csv"`);
    return reply.send(importErrorsCsv(rows));
  });
}
