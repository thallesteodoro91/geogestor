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
  importRowsPage,
  previewIssuesPage,
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

const unsafeObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const safeSourceKey = (key: string) => !unsafeObjectKeys.has(key);

const FullImportBody = z.object({
  fileName: z.string().trim().min(1).max(260)
    .refine(name => !/[\\/:]/u.test(name) && /\.(?:csv|xlsx)$/iu.test(name), 'Informe somente o nome de um arquivo CSV ou XLSX, sem caminhos.'),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
  sheetName: z.string().trim().min(1).max(100).optional(),
  headers: z.array(z.string().trim().min(1).max(300)).min(1).max(300),
  rows: z.array(z.record(z.string().max(300), ScalarCellSchema).refine(row => Object.keys(row).length <= 300, 'A linha excede 300 colunas.')).min(1).max(20_000),
  firstDataRow: z.number().int().min(2).max(1_000_000).optional(),
  sourceRowNumbers: z.array(z.number().int().min(2).max(1_000_000)).max(20_000).optional(),
  mappingOverrides: z.record(z.string().max(300), z.string().max(100).nullable()).optional(),
  clientTimings: z.object({
    readingMs: z.number().nonnegative().max(3_600_000),
    hashingMs: z.number().nonnegative().max(3_600_000)
  }).strict().optional()
}).strict();

function validateSourceRows(input: z.infer<typeof FullImportBody>, context: z.RefinementCtx) {
  if (input.headers.some(header => !safeSourceKey(header))
    || input.rows.some(row => Object.keys(row).some(key => !safeSourceKey(key)))
    || Object.keys(input.mappingOverrides ?? {}).some(key => !safeSourceKey(key))) {
    context.addIssue({ code: 'custom', path: ['headers'], message: 'A planilha contém um nome de coluna reservado. Renomeie a coluna e tente novamente.' });
  }
  const numbers = input.sourceRowNumbers;
  if (!numbers) return;
  if (numbers.length !== input.rows.length || numbers.some((number, index) => index > 0 && number <= numbers[index - 1])) {
    context.addIssue({ code: 'custom', path: ['sourceRowNumbers'], message: 'Informe uma linha de origem crescente para cada registro.' });
  }
}

const FullImportSchema = FullImportBody.superRefine(validateSourceRows);

const FullConfirmationSchema = FullImportBody.extend({
  previewId: z.string().uuid()
}).strict().superRefine(validateSourceRows);

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
    sourceRowNumbers: input.sourceRowNumbers ?? null,
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
        sourceHash: parsed.data.fileHash,
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
      const issuesPaged = preview.issues.length > 100;
      const issueTotals = {
        blocking: preview.issues.filter(issue => issue.severity === 'blocking').length,
        general: preview.issues.filter(issue => issue.row === null && ['warning', 'ambiguous'].includes(issue.severity)).length,
        row: preview.issues.filter(issue => issue.row !== null && !['info', 'blocking'].includes(issue.severity)).length
      };
      return { ...preview, issues: issuesPaged ? [] : preview.issues, issuesPaged, issueTotals, importId: registration.previewId, ...registration };
    } catch (error) {
      await OperationalLogService.error('spreadsheet-import-preview-failed', {
        operationId: crypto.randomUUID(), importType: 'complete',
        sourceExtension: sourceMetadata(parsed.data.fileName, parsed.data.sheetName).sourceExtension,
        rows: parsed.data.rows.length, columns: parsed.data.headers.length,
        reason: error, previewMs: Math.round(performance.now() - startedAt)
      });
      return importErrorReply(reply, error);
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
    const query = z.object({ errorsOnly: z.enum(['true', 'false']).default('false'), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
    return importRowsPage(id, query.errorsOnly === 'true', query.page, query.limit);
  });

  server.get('/:id/pendencias', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = z.object({ kind: z.enum(['blocking', 'general', 'row']), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
    return previewIssuesPage(id, query.kind, query.page, query.limit);
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
