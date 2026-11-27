import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import crypto from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { EnvironmentalDocumentInputSchema, type EnvironmentalDocumentIssue } from '@geogestor/contracts/src/environmental-documents';
import { createLaudoPdfDefinition, sanitizeLaudoFileName, type LaudoOptions } from '@geogestor/contracts/src/environmental-document-pdf';

const params = z.object({ id: z.string().uuid() });
const documentParams = params.extend({ documentId: z.string().uuid() });
const previewBody = z.object({ options: EnvironmentalDocumentInputSchema, renderedLogo: z.string().max(3_000_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/).optional(), sourceLogoHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const issueBody = previewBody.extend({ requestId: z.string().uuid(), previewHash: z.string().regex(/^[a-f0-9]{64}$/), revisionOf: z.string().uuid().optional() }).strict();
const hash = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const table = schema.ambientalDocumentosEmitidos;
type Row = typeof table.$inferSelect;
const summary = (row: Row): EnvironmentalDocumentIssue => ({ id: row.id, projetoId: row.projetoId, codigo: row.codigo, revisao: row.revisao, emittedAt: row.emitidoEm, fileName: row.nomeArquivo, sha256: row.sha256, tipoLaudo: JSON.parse(row.snapshotJson).options.tipoLaudo, responsavel: JSON.parse(row.snapshotJson).options.tecnicoResponsavel });
class DocumentError extends Error { constructor(public status: number, message: string) { super(message); } }
let pdfRuntime: { createPdf: (definition: ReturnType<typeof createLaudoPdfDefinition>) => { getBuffer: () => Promise<Uint8Array> } } | undefined;
async function render(options: LaudoOptions, time: string) {
  if (!pdfRuntime) {
    const make = require('pdfmake/build/pdfmake');
    const fonts = require('pdfmake/build/vfs_fonts');
    make.addVirtualFileSystem(fonts.pdfMake?.vfs || fonts.vfs || fonts);
    pdfRuntime = make;
  }
  const definition = createLaudoPdfDefinition(options, new Date(time));
  definition.language = 'pt-BR'; definition.displayTitle = true;
  const buffer = Buffer.from(await pdfRuntime!.createPdf(definition).getBuffer());
  if (buffer.length > 8 * 1024 * 1024) throw new DocumentError(400, 'O PDF excede 8 MB. Reduza o logotipo ou o conteúdo e tente novamente.');
  return buffer;
}
async function company(): Promise<NonNullable<LaudoOptions['empresa']>> {
  const [row] = await db.select().from(schema.configuracoesOperacionais).where(eq(schema.configuracoesOperacionais.chave, 'geogestor_empresa_template'));
  let raw: Record<string, unknown> = {};
  if (row) { try { raw = JSON.parse(row.valorJson); } catch { throw new DocumentError(409, 'Revise os dados da empresa nas configurações antes de emitir.'); } }
  return z.object({ razao: z.string().trim().max(200).catch(''), telefone: z.string().trim().max(30).catch(''), email: z.string().trim().max(254).catch(''), endereco: z.string().trim().max(500).catch(''), logo: z.string().max(3_000_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/).catch('') }).parse(raw);
}
async function snapshotFor(body: z.infer<typeof previewBody>) {
  const source = await company();
  if (body.sourceLogoHash && body.sourceLogoHash !== hash(source.logo || '')) throw new DocumentError(409, 'O logotipo da empresa mudou. Atualize a prévia.');
  if (source.logo?.startsWith('data:image/webp;')) {
    if (!body.renderedLogo || !body.sourceLogoHash) throw new DocumentError(400, 'Prepare a prévia pelo formulário para incorporar o logotipo WebP.');
    return { options: body.options, company: { ...source, logo: body.renderedLogo }, sourceLogo: source.logo };
  }
  return { options: body.options, company: source };
}
async function project(id: string) {
  const [row] = await db.select().from(schema.projetos).where(and(eq(schema.projetos.id, id), isNull(schema.projetos.deletedAt)));
  if (!row || !['Ambiental', 'Perícia'].includes(row.tipo || '')) throw new DocumentError(404, 'Demanda não encontrada.');
}
export async function environmentalDocumentsRoutes(server: FastifyInstance) {
  const routes = server.withTypeProvider<ZodTypeProvider>();
  const failure = (error: unknown, reply: import('fastify').FastifyReply) => {
    if (error instanceof DocumentError) return reply.status(error.status).send({ error: error.message });
    server.log.error(error);
    return reply.status(500).send({ error: 'Não foi possível concluir o documento. Seu preenchimento foi preservado; tente novamente.' });
  };
  routes.post('/:id/documentos/previa', { bodyLimit: 4 * 1024 * 1024, schema: { params, body: previewBody } }, async (request, reply) => {
    try {
      await project(request.params.id);
      const snapshot = await snapshotFor(request.body);
      const createdAt = new Date().toISOString();
      const pdf = await render({ ...snapshot.options, empresa: snapshot.company, preview: true }, createdAt);
      return { pdfBase64: pdf.toString('base64'), previewHash: hash(JSON.stringify(snapshot)), createdAt };
    } catch (error) { return failure(error, reply); }
  });
  routes.post('/:id/documentos/emitir', { bodyLimit: 4 * 1024 * 1024, schema: { params, body: issueBody } }, async (request, reply) => {
    try {
      const result = await db.transaction(async tx => {
        await project(request.params.id);
        const requestHash = hash(JSON.stringify({ project: request.params.id, ...request.body }));
        const [repeated] = await tx.select().from(table).where(eq(table.requestId, request.body.requestId));
        if (repeated) {
          if (repeated.requestHash !== requestHash) throw new DocumentError(409, 'Esta tentativa já registrou outro conteúdo. Atualize a prévia para uma nova emissão.');
          return summary(repeated);
        }
        const snapshot = await snapshotFor(request.body);
        if (hash(JSON.stringify(snapshot)) !== request.body.previewHash) throw new DocumentError(409, 'Os dados da empresa ou do registro mudaram. Atualize a prévia antes de emitir.');
        const id = crypto.randomUUID(); const emittedAt = new Date().toISOString();
        let group: string = id;
        let code = `DOC-${new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(emittedAt))}-${id.replaceAll('-', '').slice(0, 16).toUpperCase()}`, revision = 1;
        if (request.body.revisionOf) {
          const [previous] = await tx.select().from(table).where(and(eq(table.id, request.body.revisionOf), eq(table.projetoId, request.params.id)));
          if (!previous || JSON.parse(previous.snapshotJson).options.tipoLaudo !== snapshot.options.tipoLaudo) throw new DocumentError(409, 'Escolha uma emissão do mesmo tipo e desta demanda para revisar.');
          group = previous.grupoId; code = previous.codigo;
          const [maximum] = await tx.select({ value: sql<number>`max(${table.revisao})` }).from(table).where(eq(table.grupoId, group));
          revision = Number(maximum.value) + 1;
        }
        const pdf = await render({ ...snapshot.options, empresa: snapshot.company, emissao: { codigo: code, revisao: revision } }, emittedAt);
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(emittedAt));
        const fileName = `${code}_R${String(revision).padStart(2, '0')}_${day}_${sanitizeLaudoFileName(snapshot.options.projetoNome)}.pdf`;
        const row: Row = { id, projetoId: request.params.id, grupoId: group, codigo: code, revisao: revision, requestId: request.body.requestId, requestHash, emitidoEm: emittedAt, nomeArquivo: fileName, snapshotJson: JSON.stringify(snapshot), pdfBase64: pdf.toString('base64'), sha256: hash(pdf) };
        await tx.insert(table).values(row);
        return summary(row);
      });
      return reply.status(201).send(result);
    } catch (error) { return failure(error, reply); }
  });
  routes.get('/:id/documentos', { schema: { params } }, async (request, reply) => {
    try { await project(request.params.id); return await db.select({ id: table.id, projetoId: table.projetoId, codigo: table.codigo, revisao: table.revisao, emittedAt: table.emitidoEm, fileName: table.nomeArquivo, sha256: table.sha256, tipoLaudo: sql<string>`json_extract(${table.snapshotJson}, '$.options.tipoLaudo')`, responsavel: sql<string>`json_extract(${table.snapshotJson}, '$.options.tecnicoResponsavel')` }).from(table).where(eq(table.projetoId, request.params.id)).orderBy(desc(table.emitidoEm)); }
    catch (error) { return failure(error, reply); }
  });
  routes.get('/:id/documentos/:documentId', { schema: { params: documentParams } }, async (request, reply) => {
    try {
      await project(request.params.id);
      const [row] = await db.select().from(table).where(and(eq(table.id, request.params.documentId), eq(table.projetoId, request.params.id)));
      if (!row) throw new DocumentError(404, 'Emissão não encontrada nesta demanda.');
      if (hash(Buffer.from(row.pdfBase64, 'base64')) !== row.sha256) throw new DocumentError(500, 'Não foi possível verificar o arquivo preservado. Consulte o backup local.');
      return { ...summary(row), snapshot: JSON.parse(row.snapshotJson), pdfBase64: row.pdfBase64 };
    } catch (error) { return failure(error, reply); }
  });
}
