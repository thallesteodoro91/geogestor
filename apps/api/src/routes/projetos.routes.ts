import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, and, isNull, isNotNull, desc, asc, count, like, lte, gte, inArray, notInArray, or, sql } from 'drizzle-orm';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { FileSystemOutboxService } from '../services/filesystem-outbox.service';
import crypto from 'crypto';
import { z } from 'zod';
import { normalizeBudgetStatus, ProjetoPayloadSchema } from '@geogestor/contracts';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  RelationshipIntegrityError,
  assertActiveClient,
  assertPropertyBelongsToClient,
  inspectProjectReassignment
} from '../services/relationship-integrity.service';
import { finishSimpleImport, type SimpleImportRowResult } from '../services/simple-import-result.service';
import { OperationalLogService } from '../services/operational-log.service';
import { finalizeImportFilesystem } from '../services/import-filesystem-finalization.service';
import {
  completeImportRun,
  ensureImportInfrastructure,
  failImportRun,
  findImportReplay,
  importContentDigest,
  ImportRunError,
  readIdempotencyKey,
  reserveSimpleImport
} from '../services/import-run.service';
import {
  maskedDocument,
  projectImportPreviewRow,
  resolveProjectImportClient,
  summarizeProjectImportPreview,
  type ProjectImportPreviewRow
} from '../services/project-import-client-resolution.service';

const ProjetoLoteItemSchema = z.object({
  clienteId: z.string().uuid().optional(),
  clienteReferencia: z.string().trim().min(1).max(300).optional(),
  clienteDocumento: z.string().trim().max(30).optional(),
  associacaoManual: z.boolean().optional(),
  associacaoPendente: z.boolean().optional(),
  nome: z.string().trim().min(1).max(300),
  status: z.string().trim().max(100).optional(),
  cidade: z.string().trim().max(200).nullable().optional(),
  areaHa: z.preprocess(
    (value) => value === '' || value === null || value === undefined ? null : Number(value),
    z.number().nullable().optional()
  )
}).strict();
const ProjetoLotePayloadSchema = z.array(z.unknown()).min(1).max(500);

const normalizeImportName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

async function loadRelevantProjectClients(items: Array<z.infer<typeof ProjetoLoteItemSchema>>) {
  const ids = [...new Set(items.flatMap(item => item.clienteId ? [item.clienteId] : []))];
  const documents = [...new Set(items.flatMap(item => {
    const value = item.clienteDocumento || item.clienteReferencia || '';
    const digits = value.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 14 ? [digits] : [];
  }))];
  const names = [...new Set(items.flatMap(item => {
    const value = item.clienteReferencia?.trim();
    return value && !/^\d+$/.test(value.replace(/\D/g, '')) ? [normalizeImportName(value)] : [];
  }))];
  const matches = [];
  if (ids.length) matches.push(inArray(schema.clientes.id, ids));
  if (documents.length) matches.push(inArray(schema.clientes.documentoNormalizado, documents));
  if (names.length) matches.push(sql`lower(trim(${schema.clientes.nome})) in (${sql.join(names.map(name => sql`${name}`), sql`, `)})`);
  if (!matches.length) return [];
  return db.select({
    id: schema.clientes.id,
    nome: schema.clientes.nome,
    documentoNormalizado: schema.clientes.documentoNormalizado,
    municipio: schema.clientes.municipio
  }).from(schema.clientes).where(and(
    isNull(schema.clientes.deletedAt),
    eq(schema.clientes.situacao, 'Ativo'),
    or(...matches)!
  ));
}

async function applyProjectDuplicatePreviewRules(rows: ProjectImportPreviewRow[]) {
  const clientIds = [...new Set(rows.flatMap(row => row.association?.clientId ? [row.association.clientId] : []))];
  const existing = clientIds.length === 0 ? [] : await db.select({
    clienteId: schema.projetos.clienteId,
    nome: schema.projetos.nome
  }).from(schema.projetos).where(and(
    inArray(schema.projetos.clienteId, clientIds),
    isNull(schema.projetos.deletedAt)
  ));
  const existingKeys = new Set(existing.map(project => `${project.clienteId}:${normalizeImportName(project.nome)}`));
  const seen = new Set<string>();

  return rows.map(row => {
    if (row.status !== 'resolved' || !row.association) return row;
    const key = `${row.association.clientId}:${normalizeImportName(row.projectName)}`;
    if (existingKeys.has(key)) {
      return { ...row, status: 'pending' as const, action: 'reject' as const, reason: 'invalid_row' as const, message: 'Já existe um projeto com este nome para o cliente informado.' };
    }
    if (seen.has(key)) {
      return { ...row, status: 'pending' as const, action: 'reject' as const, reason: 'invalid_row' as const, message: 'Projeto repetido para o mesmo cliente neste lote.' };
    }
    seen.add(key);
    return row;
  });
}

const labelValue = (value: any) => {
  if (value === null || value === undefined || value === '') return 'não informado';
  return String(value);
};

const buildProjetoChanges = (oldProjeto: any, data: any) => {
  const fields: Array<[string, string]> = [
    ['nome', 'Nome'],
    ['status', 'Status'],
    ['tipo', 'Tipo'],
    ['dataInicio', 'Início'],
    ['dataEntrega', 'Entrega'],
    ['areaHa', 'Área mapeada'],
    ['matricula', 'Matrícula'],
    ['car', 'CAR'],
    ['ccir', 'CCIR'],
    ['itr', 'ITR'],
    ['cidade', 'Cidade'],
    ['municipio', 'Município'],
    ['situacaoImovel', 'Situação do imóvel'],
    ['averbacao', 'Averbação']
  ];

  return fields.flatMap(([field, label]) => {
    if (data[field] === undefined || data[field] === oldProjeto[field]) return [];
    return `${label}: ${labelValue(oldProjeto[field])} -> ${labelValue(data[field])}`;
  });
};

export async function projetosRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/', {
    schema: {
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(50),
        clienteId: z.string().uuid().optional(),
        q: z.string().trim().max(200).optional(),
        status: z.string().trim().max(100).optional(),
        tipo: z.string().trim().max(100).optional(),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        mode: z.enum(['legacy', 'page']).default('legacy')
      })
    }
  }, async (request, reply) => {
    const { page, limit, mode, q } = request.query;
    try {
      const offset = (page - 1) * limit;
      const whereClause = and(
        isNull(schema.projetos.deletedAt),
        request.query.clienteId ? eq(schema.projetos.clienteId, request.query.clienteId) : undefined,
        request.query.status ? eq(schema.projetos.status, request.query.status) : undefined,
        request.query.tipo ? eq(schema.projetos.tipo, request.query.tipo) : undefined,
        request.query.inicio ? gte(schema.projetos.dataInicio, request.query.inicio) : undefined,
        request.query.fim ? lte(schema.projetos.dataInicio, request.query.fim) : undefined,
        q ? or(
          like(schema.projetos.nome, `%${q}%`),
          like(schema.clientes.nome, `%${q}%`),
          like(schema.projetos.descricao, `%${q}%`),
          like(schema.projetos.cidade, `%${q}%`),
          like(schema.projetos.municipio, `%${q}%`),
          like(schema.projetos.matricula, `%${q}%`),
          like(schema.projetos.car, `%${q}%`)
        ) : undefined
      );
      const projetosList = await db.select({
        projeto: schema.projetos,
        cliente: {
          id: schema.clientes.id,
          nome: schema.clientes.nome
        }
      })
      .from(schema.projetos)
      .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(q ? asc(schema.projetos.nome) : desc(schema.projetos.createdAt));
      
      const items = projetosList.map(row => ({
        ...row.projeto,
        clienteNome: row.cliente?.nome
      }));
      if (mode === 'legacy') return items;
      const [{ total }] = await db.select({ total: count() }).from(schema.projetos)
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(whereClause);
      return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar projetos' });
    }
  });

  zServer.get('/options', {
    schema: { querystring: z.object({
      q: z.string().trim().max(200).optional(),
      clienteId: z.string().uuid().optional(),
      selectedId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(25)
    }) }
  }, async (request) => {
    const { q, clienteId, selectedId, limit } = request.query;
    const selection = {
      id: schema.projetos.id,
      nome: schema.projetos.nome,
      clienteId: schema.projetos.clienteId,
      status: schema.projetos.status,
      cidade: schema.projetos.cidade,
      clienteNome: schema.clientes.nome,
      tipo: schema.projetos.tipo
    };
    const items = await db.select(selection).from(schema.projetos)
      .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id)).where(and(
      isNull(schema.projetos.deletedAt),
      clienteId ? eq(schema.projetos.clienteId, clienteId) : undefined,
      q ? or(like(schema.projetos.nome, `%${q}%`), like(schema.projetos.cidade, `%${q}%`)) : undefined
    )).orderBy(asc(schema.projetos.nome), asc(schema.projetos.id)).limit(limit);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      const [selected] = await db.select(selection).from(schema.projetos)
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(and(eq(schema.projetos.id, selectedId), isNull(schema.projetos.deletedAt))).limit(1);
      if (selected) return [selected, ...items].slice(0, limit);
    }
    return items;
  });

  zServer.get('/deadlines', {
    schema: { querystring: z.object({ days: z.coerce.number().int().min(0).max(365).default(7) }) }
  }, async (request) => {
    const maximum = new Date();
    maximum.setHours(0, 0, 0, 0);
    maximum.setDate(maximum.getDate() + request.query.days);
    return db.select({
      id: schema.projetos.id,
      nome: schema.projetos.nome,
      status: schema.projetos.status,
      dataEntrega: schema.projetos.dataEntrega
    }).from(schema.projetos).where(and(
      isNull(schema.projetos.deletedAt),
      isNotNull(schema.projetos.dataEntrega),
      lte(schema.projetos.dataEntrega, maximum.toISOString().slice(0, 10)),
      notInArray(schema.projetos.status, ['Concluído', 'Concluido', 'Finalizado', 'Arquivado', 'Cancelado'])
    )).orderBy(asc(schema.projetos.dataEntrega), asc(schema.projetos.id)).limit(200);
  });

  zServer.get('/calendar', {
    schema: { querystring: z.object({
      inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }) }
  }, async (request) => db.select({
    id: schema.projetos.id,
    nome: schema.projetos.nome,
    dataInicio: schema.projetos.dataInicio,
    dataEntrega: schema.projetos.dataEntrega,
    clienteId: schema.projetos.clienteId,
    clienteNome: schema.clientes.nome
  }).from(schema.projetos)
    .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
    .where(and(
      isNull(schema.projetos.deletedAt),
      or(
        and(gte(schema.projetos.dataInicio, request.query.inicio), lte(schema.projetos.dataInicio, request.query.fim)),
        and(gte(schema.projetos.dataEntrega, request.query.inicio), lte(schema.projetos.dataEntrega, request.query.fim))
      )
    )).orderBy(asc(schema.projetos.dataInicio), asc(schema.projetos.id)).limit(500));

  zServer.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      const result = await db.select({
        projeto: schema.projetos,
        cliente: {
          id: schema.clientes.id,
          nome: schema.clientes.nome
        }
      })
      .from(schema.projetos)
      .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
      .where(and(eq(schema.projetos.id, id), isNull(schema.projetos.deletedAt)))
      .limit(1);

      if (!result.length) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }

      const [licenseRows, environmentalRows, expertAssessmentRows] = await Promise.all([
        db.select().from(schema.licencas).where(eq(schema.licencas.projetoId, id)).limit(1),
        db.select().from(schema.ambiental).where(eq(schema.ambiental.projetoId, id)).limit(1),
        db.select().from(schema.pericias).where(eq(schema.pericias.projetoId, id)).limit(1)
      ]);
      const license = licenseRows[0];
      const environmental = environmentalRows[0];
      const expertAssessment = expertAssessmentRows[0];

      return {
        ...result[0].projeto,
        clienteNome: result[0].cliente?.nome,
        orgaoAmbiental: environmental?.orgaoAmbiental || license?.orgao || null,
        tipoDemanda: environmental?.tipoDemanda || null,
        tipoLicenca: license?.tipoLicenca || null,
        protocolo: environmental?.protocolo || license?.protocolo || null,
        numeroLicenca: license?.numero || null,
        dataEmissao: license?.dataEmissao || null,
        dataVencimentoLicenca: license?.dataVencimento || null,
        statusLicenca: license?.status || null,
        observacoesLicenca: license?.observacoes || null,
        tipoPericia: expertAssessment?.tipoPericia || null,
        numeroProcesso: expertAssessment?.numeroProcesso || null,
        dataVistoria: expertAssessment?.dataVistoria || null
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar projeto' });
    }
  });

  zServer.post('/', {
    schema: {
      body: ProjetoPayloadSchema
    }
  }, async (request, reply) => {
    const data = request.body;
    if (data.tipo === 'Licenciamento' && (!data.numeroLicenca || !data.orgaoAmbiental || !data.tipoLicenca || !data.dataVencimentoLicenca)) {
      return reply.status(400).send({ error: 'Número, órgão, tipo e vencimento da licença são obrigatórios.' });
    }
    try {
      const novoProjeto = await db.transaction(async (tx) => {
        const result = await tx.insert(schema.projetos).values({
          id: crypto.randomUUID(),
          clienteId: data.clienteId,
          nome: data.nome,
          descricao: data.descricao || null,
          status: data.status || 'Em Andamento',
          dataInicio: data.dataInicio || null,
          dataEntrega: data.dataEntrega || null,
          areaHa: data.areaHa ?? null,
          matricula: data.matricula || null,
          car: data.car || null,
          ccir: data.ccir || null,
          itr: data.itr || null,
          cidade: data.cidade || null,
          municipio: data.municipio || null,
          situacaoImovel: data.situacaoImovel || null,
          tipo: data.tipo || null,
          averbacao: data.averbacao || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          possuiMemorialDescritivo: data.possuiMemorialDescritivo || null,
          observacoes: data.observacoes || null,
          propriedadeId: data.propriedadeId || null
        }).returning();
        
        // Inserir nos módulos específicos baseados no tipo
        if (data.tipo === 'Licenciamento') {
          await tx.insert(schema.licencas).values({
            id: crypto.randomUUID(),
            projetoId: result[0].id,
            clienteId: data.clienteId,
            numero: data.numeroLicenca!,
            protocolo: data.protocolo || null,
            orgao: data.orgaoAmbiental!,
            tipoLicenca: data.tipoLicenca!,
            dataEmissao: data.dataEmissao || null,
            dataVencimento: data.dataVencimentoLicenca!,
            status: data.statusLicenca || 'Em análise',
            observacoes: data.observacoesLicenca || null
          });
        } else if (data.tipo === 'Ambiental') {
          await tx.insert(schema.ambiental).values({
            id: crypto.randomUUID(),
            projetoId: result[0].id,
            clienteId: data.clienteId,
            propriedadeId: data.propriedadeId || null,
            orgaoAmbiental: data.orgaoAmbiental || null,
            tipoDemanda: data.tipoDemanda || null,
            protocolo: data.protocolo || null,
            statusFase: 'Inicial'
          });
        } else if (data.tipo === 'Perícia') {
          await tx.insert(schema.pericias).values({
            id: crypto.randomUUID(),
            projetoId: result[0].id,
            clienteId: data.clienteId,
            propriedadeId: data.propriedadeId || null,
            tipoPericia: data.tipoPericia || null,
            numeroProcesso: data.numeroProcesso || null,
            dataVistoria: data.dataVistoria || null,
            status: 'Agendada'
          });
        }
        
        await AuditLogService.log('INSERT', 'Projeto', null, result[0], tx);
        await JornadaService.logClienteEvento({
          clienteId: data.clienteId,
          projetoId: result[0].id,
          tipo: 'Projeto',
          titulo: `Projeto criado: ${result[0].nome}`,
          categoria: 'Início',
          descricao: `Tipo: ${result[0].tipo || 'Não informado'} | Status: ${result[0].status}`
        }, tx);

        // A operação física ocorre somente após o commit e sobrevive a reinicializações.
        const cliente = await tx.select().from(schema.clientes).where(eq(schema.clientes.id, data.clienteId)).limit(1);
        if (cliente.length && cliente[0].nome) {
          await FileSystemOutboxService.enqueue({
            idempotencyKey: `project-folder:create:${result[0].id}:${cliente[0].nome}:${result[0].nome}`,
            operationType: 'create-project-folder',
            aggregateType: 'project',
            aggregateId: result[0].id,
            payload: {
              clientId: result[0].clienteId,
              projectId: result[0].id,
              clientName: cliente[0].nome,
              projectName: result[0].nome
            }
          }, tx);
        }

        return result[0];
      });

      await FileSystemOutboxService.processPending();

      return reply.status(201).send(novoProjeto);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao criar projeto' });
    }
  });

  zServer.get('/lote/clientes', {
    schema: {
      querystring: z.object({
        q: z.string().trim().max(200).optional(),
        selectedId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(25)
      })
    }
  }, async (request, reply) => {
    const { q, selectedId, limit } = request.query;
    try {
      const activeCondition = eq(schema.clientes.situacao, 'Ativo');
      const conditions = [isNull(schema.clientes.deletedAt), activeCondition];
      if (q) {
        const search = `%${q}%`;
        conditions.push(or(
          like(schema.clientes.nome, search),
          like(schema.clientes.documento, search),
          like(schema.clientes.cpf, search),
          like(schema.clientes.cnpj, search),
          like(schema.clientes.municipio, search)
        )!);
      }
      const selectFields = {
        id: schema.clientes.id,
        nome: schema.clientes.nome,
        documentoNormalizado: schema.clientes.documentoNormalizado,
        municipio: schema.clientes.municipio
      };
      const items = await db.select(selectFields).from(schema.clientes)
        .where(and(...conditions)).orderBy(asc(schema.clientes.nome)).limit(limit);
      if (selectedId && !items.some(item => item.id === selectedId)) {
        const [selected] = await db.select(selectFields).from(schema.clientes).where(and(
          eq(schema.clientes.id, selectedId),
          isNull(schema.clientes.deletedAt),
          activeCondition
        )).limit(1);
        if (selected) items.unshift(selected);
      }
      return items.slice(0, limit).map(item => ({
        id: item.id,
        nome: item.nome,
        documentoMascarado: maskedDocument(item.documentoNormalizado),
        municipio: item.municipio
      }));
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível pesquisar clientes para a associação.' });
    }
  });

  zServer.post('/lote/preview', {
    schema: { body: ProjetoLotePayloadSchema }
  }, async (request, reply) => {
    try {
      const parsedItems = request.body.map(raw => ProjetoLoteItemSchema.safeParse(raw));
      const activeClients = await loadRelevantProjectClients(parsedItems.flatMap(parsed => parsed.success ? [parsed.data] : []));
      const resolvedRows: ProjectImportPreviewRow[] = request.body.map((raw, index) => {
        const parsed = parsedItems[index];
        if (!parsed.success) {
          return {
            index,
            row: index + 2,
            projectName: raw && typeof raw === 'object' && 'nome' in raw ? String(raw.nome || 'Projeto sem nome') : 'Projeto sem nome',
            reference: raw && typeof raw === 'object' && 'clienteReferencia' in raw ? String(raw.clienteReferencia || '') : '',
            status: 'pending',
            action: 'reject',
            reason: 'invalid_row',
            message: [...new Set(parsed.error.issues.map(issue => issue.message))].join(' ')
          };
        }
        return projectImportPreviewRow(parsed.data, index, activeClients);
      });
      const rows = await applyProjectDuplicatePreviewRules(resolvedRows);
      const counts = summarizeProjectImportPreview(rows);
      await OperationalLogService.info('simple-project-import-preview', { rows: rows.length, ...counts, status: counts.pending > 0 ? 'blocked' : 'ready' });
      return { status: counts.pending > 0 ? 'blocked' as const : 'ready' as const, counts, rows };
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível validar os vínculos dos projetos.' });
    }
  });

  zServer.post('/lote', {
    schema: {
      body: ProjetoLotePayloadSchema
    }
  }, async (request, reply) => {
    const data = request.body;
    const startedAt = new Date().toISOString();
    const digest = importContentDigest(data);
    let runId: string | null = null;

    if (data.length === 0) {
      return reply.status(400).send({ error: 'Payload deve conter pelo menos um projeto' });
    }

    try {
      await ensureImportInfrastructure();
      const idempotencyKey = readIdempotencyKey(request.headers);
      const replay = await findImportReplay('projetos', 'simple', idempotencyKey, digest);
      if (replay) return reply.status(200).send(replay);
      const reservation = await reserveSimpleImport(db, {
        entity: 'projetos', key: idempotencyKey, digest, totalRows: data.length
      });
      runId = reservation.runId;
      if (reservation.replay) return reply.status(200).send(reservation.replay);

      const results: SimpleImportRowResult[] = [];
      const resolved: Array<{ index: number; item: z.infer<typeof ProjetoLoteItemSchema>; clienteId: string; clienteNome: string }> = [];
      const parsedItems = data.map(raw => ProjetoLoteItemSchema.safeParse(raw));
      const activeClients = await loadRelevantProjectClients(parsedItems.flatMap(parsed => parsed.success ? [parsed.data] : []));

      for (const [index, raw] of data.entries()) {
        const parsed = parsedItems[index];
        if (!parsed.success) {
          results.push({ index, status: 'failed', errors: [...new Set(parsed.error.issues.map(issue => issue.message))] });
          continue;
        }
        const item = parsed.data;
        const clientResolution = resolveProjectImportClient(item, activeClients);
        if (clientResolution.status !== 'resolved') {
          results.push({ index, status: 'failed', errors: [clientResolution.message] });
          continue;
        }
        resolved.push({
          index,
          item,
          clienteId: clientResolution.client.id,
          clienteNome: clientResolution.client.nome
        });
      }

      const summary = await db.transaction(async (tx) => {
        const created = [];
        const seenProjects = new Set<string>();

        for (const { index, item, clienteId, clienteNome } of resolved) {
          const [activeClient] = await tx.select({ id: schema.clientes.id }).from(schema.clientes).where(and(
            eq(schema.clientes.id, clienteId),
            eq(schema.clientes.situacao, 'Ativo'),
            isNull(schema.clientes.deletedAt)
          )).limit(1);
          if (!activeClient) {
            results.push({ index, status: 'failed', errors: ['O cliente foi desativado ou excluído depois da prévia. Gere uma nova prévia.'] });
            continue;
          }
          const businessKey = `${clienteId}:${normalizeImportName(item.nome)}`;
          if (seenProjects.has(businessKey)) {
            results.push({ index, status: 'failed', errors: ['Projeto repetido para o mesmo cliente neste lote.'] });
            continue;
          }
          seenProjects.add(businessKey);
          const existingProjects = await tx.select({ id: schema.projetos.id, nome: schema.projetos.nome }).from(schema.projetos).where(and(
            eq(schema.projetos.clienteId, clienteId),
            isNull(schema.projetos.deletedAt)
          ));
          if (existingProjects.some(project => normalizeImportName(project.nome) === normalizeImportName(item.nome))) {
            results.push({ index, status: 'failed', errors: ['Já existe um projeto com este nome para o cliente informado.'] });
            continue;
          }
          const result = await tx.insert(schema.projetos).values({
            id: crypto.randomUUID(),
            clienteId,
            nome: item.nome,
            status: item.status || 'Em Andamento',
            cidade: item.cidade || null,
            areaHa: item.areaHa || null
          }).returning();

          await JornadaService.logClienteEvento({
            clienteId,
            projetoId: result[0].id,
            tipo: 'Projeto',
            titulo: `Projeto criado: ${result[0].nome}`,
              categoria: 'Importação',
            descricao: `Status: ${result[0].status}`
          }, tx);

          if (clienteNome) {
            await FileSystemOutboxService.enqueue({
              idempotencyKey: `project-folder:create:${result[0].id}:${clienteNome}:${result[0].nome}`,
              operationType: 'create-project-folder',
              aggregateType: 'project',
              aggregateId: result[0].id,
              payload: {
                clientId: clienteId,
                projectId: result[0].id,
                clientName: clienteNome,
                projectName: result[0].nome
              }
            }, tx);
          }

          created.push(result[0]);
          const resolution = resolveProjectImportClient(item, activeClients);
          results.push({
            index,
            status: 'success',
            id: result[0].id,
            association: resolution.status === 'resolved' ? {
              clientId: clienteId,
              clientName: clienteNome,
              method: resolution.method
            } : undefined
          });
        }

        await AuditLogService.log('INSERT', 'Projeto', null, {
          importacaoLote: true,
          quantidade: created.length,
          projetos: created.map(projeto => projeto.nome)
        }, tx);
        const transactionResult = finishSimpleImport(startedAt, data.length, results, { importId: runId! });
        await completeImportRun(tx, runId!, transactionResult as unknown as Record<string, unknown>, results);
        return transactionResult;
      });

      const finalized = summary.imported > 0 ? await finalizeImportFilesystem(runId, summary) : summary;
      await OperationalLogService.info('simple-spreadsheet-import', { importId: finalized.importId, entity: 'projetos', status: finalized.status, rows: finalized.rowsRead, imported: finalized.imported, failed: finalized.failed, filesystemPending: finalized.filesystemPending, durationMs: finalized.durationMs });
      return reply.status(201).send(finalized);
    } catch (err) {
      if (runId) await failImportRun(runId, err).catch(() => undefined);
      await OperationalLogService.error('simple-spreadsheet-import-failed', { entity: 'projetos', status: 'failed', rows: data.length, reason: err, durationMs: Date.now() - new Date(startedAt).getTime() }).catch(() => undefined);
      server.log.error(err);
      if (err instanceof ImportRunError) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      return reply.status(500).send({ error: 'Erro ao importar projetos em lote' });
    }
  });

  zServer.get('/:id/reassignment-impact', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ clienteId: z.string().uuid() })
    }
  }, async (request, reply) => {
    const [project] = await db.select().from(schema.projetos).where(and(
      eq(schema.projetos.id, request.params.id),
      isNull(schema.projetos.deletedAt)
    )).limit(1);
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    try {
      await assertActiveClient(request.query.clienteId);
      await assertPropertyBelongsToClient(project.propriedadeId, request.query.clienteId);
      return {
        projetoId: project.id,
        clienteAtualId: project.clienteId,
        clienteDestinoId: request.query.clienteId,
        ...(await inspectProjectReassignment(project.id))
      };
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  zServer.post('/:id/reassign-client', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ clienteId: z.string().uuid(), confirmation: z.string().min(1) })
    }
  }, async (request, reply) => {
    const [project] = await db.select().from(schema.projetos).where(and(
      eq(schema.projetos.id, request.params.id), isNull(schema.projetos.deletedAt)
    )).limit(1);
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const expected = `REATRIBUIR ${project.id} PARA ${request.body.clienteId}`;
    if (request.body.confirmation !== expected) {
      return reply.status(400).send({ error: 'A confirmação específica da reatribuição não confere.' });
    }
    try {
      await assertActiveClient(request.body.clienteId);
      await assertPropertyBelongsToClient(project.propriedadeId, request.body.clienteId);
      const impact = await inspectProjectReassignment(project.id);
      if (impact.hasFinancialDependencies) {
        return reply.status(409).send({
          error: 'A reatribuição foi bloqueada porque existem dependências financeiras.',
          code: 'PROJECT_REASSIGNMENT_BLOCKED', impact
        });
      }
      const [[oldClient], [targetClient]] = await Promise.all([
        db.select({ nome: schema.clientes.nome }).from(schema.clientes).where(eq(schema.clientes.id, project.clienteId)).limit(1),
        db.select({ nome: schema.clientes.nome }).from(schema.clientes).where(eq(schema.clientes.id, request.body.clienteId)).limit(1)
      ]);
      const now = new Date().toISOString();
      await db.transaction(async (tx) => {
        await tx.update(schema.tarefas).set({ clienteId: request.body.clienteId }).where(eq(schema.tarefas.projetoId, project.id));
        await tx.update(schema.compromissos).set({ clienteId: request.body.clienteId }).where(eq(schema.compromissos.projetoId, project.id));
        await tx.update(schema.viagens).set({ clienteId: request.body.clienteId }).where(eq(schema.viagens.projetoId, project.id));
        await tx.update(schema.documentos).set({ clienteId: request.body.clienteId }).where(eq(schema.documentos.projetoId, project.id));
        await tx.update(schema.licencas).set({ clienteId: request.body.clienteId }).where(eq(schema.licencas.projetoId, project.id));
        await tx.update(schema.ambiental).set({ clienteId: request.body.clienteId }).where(eq(schema.ambiental.projetoId, project.id));
        await tx.update(schema.pericias).set({ clienteId: request.body.clienteId }).where(eq(schema.pericias.projetoId, project.id));
        await tx.update(schema.oportunidades).set({ clienteId: request.body.clienteId }).where(eq(schema.oportunidades.projetoId, project.id));
        await tx.update(schema.interacoes_cliente).set({ clienteId: request.body.clienteId }).where(eq(schema.interacoes_cliente.projetoId, project.id));
        await tx.update(schema.projetos).set({ clienteId: request.body.clienteId, updatedAt: now }).where(eq(schema.projetos.id, project.id));
        await AuditLogService.log('UPDATE', 'ProjetoReatribuicao', project, { ...project, clienteId: request.body.clienteId, impact }, tx);
        await FileSystemOutboxService.enqueue({
          idempotencyKey: `project-reassignment:${project.id}:${project.clienteId}:${request.body.clienteId}`,
          operationType: 'rename-project-folder', aggregateType: 'project', aggregateId: project.id,
          payload: {
            oldClientName: oldClient?.nome || project.clienteId,
            newClientName: targetClient?.nome || request.body.clienteId,
            oldProjectName: project.nome, newProjectName: project.nome, projectId: project.id
          }
        }, tx);
      });
      FileSystemOutboxService.kick();
      return { reassigned: true, projetoId: project.id, clienteId: request.body.clienteId, impact };
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) return reply.status(error.statusCode).send({ error: error.message });
      throw error;
    }
  });

  zServer.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: ProjetoPayloadSchema.partial()
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    try {
      const oldProjeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, id)).limit(1);
      if (!oldProjeto.length || oldProjeto[0].deletedAt) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }
      const targetClientId = data.clienteId ?? oldProjeto[0].clienteId;
      await assertActiveClient(targetClientId);
      await assertPropertyBelongsToClient(
        data.propriedadeId !== undefined ? data.propriedadeId : oldProjeto[0].propriedadeId,
        targetClientId
      );
      if (targetClientId !== oldProjeto[0].clienteId) {
        const impact = await inspectProjectReassignment(id);
        if (impact.dependencies.length > 0) {
          return reply.status(409).send({
            error: impact.hasFinancialDependencies
              ? 'O cliente do projeto não pode ser alterado enquanto existirem dependências financeiras.'
              : 'Use a operação assistida de reatribuição para atualizar todas as dependências.',
            code: impact.hasFinancialDependencies ? 'PROJECT_REASSIGNMENT_BLOCKED' : 'PROJECT_REASSIGNMENT_REQUIRED',
            impact
          });
        }
      }
      const requestedType = data.tipo !== undefined ? data.tipo : oldProjeto[0].tipo;
      if (requestedType !== oldProjeto[0].tipo) {
        const [licenses, environmental, assessments] = await Promise.all([
          db.select({ id: schema.licencas.id }).from(schema.licencas)
            .where(and(eq(schema.licencas.projetoId, id), isNull(schema.licencas.deletedAt))).limit(1),
          db.select({ id: schema.ambiental.id }).from(schema.ambiental)
            .where(and(eq(schema.ambiental.projetoId, id), isNull(schema.ambiental.deletedAt))).limit(1),
          db.select({ id: schema.pericias.id }).from(schema.pericias)
            .where(and(eq(schema.pericias.projetoId, id), isNull(schema.pericias.deletedAt))).limit(1)
        ]);
        const specializedDependencies = [
          licenses.length ? 'licenças e condicionantes' : null,
          environmental.length ? 'dados ambientais' : null,
          assessments.length ? 'perícias' : null
        ].filter((value): value is string => Boolean(value));
        if (specializedDependencies.length) {
          return reply.status(409).send({
            error: `A alteração de tipo foi bloqueada para preservar ${specializedDependencies.join(', ')}.`,
            code: 'PROJECT_TYPE_CHANGE_BLOCKED',
            dependencies: specializedDependencies
          });
        }
      }
      if (requestedType === 'Licenciamento') {
        const existingLicense = await db.select().from(schema.licencas).where(eq(schema.licencas.projetoId, id)).limit(1);
        if (!existingLicense.length && (!data.numeroLicenca || !data.orgaoAmbiental || !data.tipoLicenca || !data.dataVencimentoLicenca)) {
          return reply.status(400).send({ error: 'Número, órgão, tipo e vencimento da licença são obrigatórios.' });
        }
      }

      const updateData: any = { updatedAt: new Date().toISOString() };
      const projectFields = new Set([
        'clienteId', 'nome', 'descricao', 'status', 'dataInicio', 'dataEntrega',
        'areaHa', 'matricula', 'car', 'ccir', 'itr', 'cidade', 'municipio',
        'situacaoImovel', 'tipo', 'averbacao', 'latitude', 'longitude',
        'possuiMemorialDescritivo', 'observacoes', 'propriedadeId'
      ]);
      for (const key of Object.keys(data)) {
        if (projectFields.has(key)) updateData[key] = (data as any)[key] ?? null;
      }

      const projetoAtualizado = await db.transaction(async (tx) => {
        const result = await tx.update(schema.projetos)
          .set(updateData)
          .where(eq(schema.projetos.id, id))
          .returning();

        const currentType = data.tipo !== undefined ? data.tipo : oldProjeto[0].tipo;
        const specializedUpdatedAt = new Date().toISOString();

        if (currentType === 'Licenciamento') {
          const existing = await tx.select().from(schema.licencas).where(eq(schema.licencas.projetoId, id)).limit(1);
          if (existing.length) {
            await tx.update(schema.licencas).set({
              clienteId: result[0].clienteId,
              ...(data.numeroLicenca !== undefined && data.numeroLicenca ? { numero: data.numeroLicenca } : {}),
              ...(data.protocolo !== undefined ? { protocolo: data.protocolo ?? null } : {}),
              ...(data.orgaoAmbiental !== undefined ? { orgao: data.orgaoAmbiental || 'Não informado' } : {}),
              ...(data.tipoLicenca !== undefined ? { tipoLicenca: data.tipoLicenca ?? null } : {}),
              ...(data.dataEmissao !== undefined ? { dataEmissao: data.dataEmissao ?? null } : {}),
              ...(data.dataVencimentoLicenca ? { dataVencimento: data.dataVencimentoLicenca } : {}),
              ...(data.statusLicenca !== undefined ? { status: data.statusLicenca || 'Em análise' } : {}),
              ...(data.observacoesLicenca !== undefined ? { observacoes: data.observacoesLicenca ?? null } : {}),
              updatedAt: specializedUpdatedAt
            }).where(eq(schema.licencas.id, existing[0].id));
          } else {
            await tx.insert(schema.licencas).values({
              id: crypto.randomUUID(),
              projetoId: id,
              clienteId: result[0].clienteId,
              numero: data.numeroLicenca!,
              protocolo: data.protocolo || null,
              orgao: data.orgaoAmbiental!,
              tipoLicenca: data.tipoLicenca!,
              dataEmissao: data.dataEmissao || null,
              dataVencimento: data.dataVencimentoLicenca!,
              status: data.statusLicenca || 'Em análise',
              observacoes: data.observacoesLicenca || null
            });
          }
        }

        if (currentType === 'Ambiental') {
          const existing = await tx.select().from(schema.ambiental).where(eq(schema.ambiental.projetoId, id)).limit(1);
          if (existing.length) {
            await tx.update(schema.ambiental).set({
              clienteId: result[0].clienteId,
              propriedadeId: result[0].propriedadeId,
              ...(data.orgaoAmbiental !== undefined ? { orgaoAmbiental: data.orgaoAmbiental ?? null } : {}),
              ...(data.tipoDemanda !== undefined ? { tipoDemanda: data.tipoDemanda ?? null } : {}),
              ...(data.protocolo !== undefined ? { protocolo: data.protocolo ?? null } : {}),
              updatedAt: specializedUpdatedAt
            }).where(eq(schema.ambiental.id, existing[0].id));
          } else {
            await tx.insert(schema.ambiental).values({
              id: crypto.randomUUID(),
              projetoId: id,
              clienteId: result[0].clienteId,
              propriedadeId: result[0].propriedadeId,
              orgaoAmbiental: data.orgaoAmbiental || null,
              tipoDemanda: data.tipoDemanda || null,
              protocolo: data.protocolo || null,
              statusFase: 'Inicial'
            });
          }
        }

        if (currentType === 'Perícia') {
          const existing = await tx.select().from(schema.pericias).where(eq(schema.pericias.projetoId, id)).limit(1);
          if (existing.length) {
            await tx.update(schema.pericias).set({
              clienteId: result[0].clienteId,
              propriedadeId: result[0].propriedadeId,
              ...(data.tipoPericia !== undefined ? { tipoPericia: data.tipoPericia ?? null } : {}),
              ...(data.numeroProcesso !== undefined ? { numeroProcesso: data.numeroProcesso ?? null } : {}),
              ...(data.dataVistoria !== undefined ? { dataVistoria: data.dataVistoria ?? null } : {}),
              updatedAt: specializedUpdatedAt
            }).where(eq(schema.pericias.id, existing[0].id));
          } else {
            await tx.insert(schema.pericias).values({
              id: crypto.randomUUID(),
              projetoId: id,
              clienteId: result[0].clienteId,
              propriedadeId: result[0].propriedadeId,
              tipoPericia: data.tipoPericia || null,
              numeroProcesso: data.numeroProcesso || null,
              dataVistoria: data.dataVistoria || null,
              status: 'Agendada'
            });
          }
        }
          
        await AuditLogService.log('UPDATE', 'Projeto', oldProjeto[0], result[0], tx);

        const changes = buildProjetoChanges(oldProjeto[0], data);
        if (changes.length > 0) {
          await JornadaService.logClienteEvento({
            clienteId: result[0].clienteId,
            projetoId: result[0].id,
            tipo: 'Observação',
            titulo: 'Projeto atualizado',
            categoria: 'Atualização',
            descricao: changes.join('\n')
          }, tx);
        }

        const projectWasCancelled = oldProjeto[0].status !== 'Cancelado'
          && result[0].status === 'Cancelado';
        if (projectWasCancelled) {
          const timestamp = new Date().toISOString();
          await tx.insert(schema.financeiroEventos).values({
            id: crypto.randomUUID(),
            tipo: 'cancelamento_projeto_pendente',
            entidade: 'projeto',
            entidadeId: id,
            clienteId: result[0].clienteId,
            projetoId: id,
            valor: 0,
            dataEvento: timestamp.slice(0, 10),
            motivo: 'Projeto cancelado; decisão financeira pendente.',
            metadataJson: JSON.stringify({
              statusAnterior: oldProjeto[0].status,
              statusAtual: result[0].status
            }),
            createdAt: timestamp
          });
        }

        const folderIdentityChanged = result[0].nome !== oldProjeto[0].nome
          || result[0].clienteId !== oldProjeto[0].clienteId;
        if (folderIdentityChanged) {
          const [oldClient] = await tx.select({ nome: schema.clientes.nome })
            .from(schema.clientes).where(eq(schema.clientes.id, oldProjeto[0].clienteId)).limit(1);
          const [newClient] = await tx.select({ nome: schema.clientes.nome })
            .from(schema.clientes).where(eq(schema.clientes.id, result[0].clienteId)).limit(1);
          if (oldClient && newClient) {
            await FileSystemOutboxService.enqueue({
              idempotencyKey: `project-folder:rename:${id}:${oldClient.nome}:${oldProjeto[0].nome}:${newClient.nome}:${result[0].nome}`,
              operationType: 'rename-project-folder',
              aggregateType: 'project',
              aggregateId: id,
              payload: {
                projectId: id,
                oldClientName: oldClient.nome,
                newClientName: newClient.nome,
                oldProjectName: oldProjeto[0].nome,
                newProjectName: result[0].nome
              }
            }, tx);
          }
        }
        return result[0];
      });

      await FileSystemOutboxService.processPending();

      return projetoAtualizado;
    } catch (err) {
      if (err instanceof RelationshipIntegrityError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar projeto' });
    }
  });

  zServer.get('/:id/contexto-financeiro', {
    schema: { params: z.object({ id: z.string().uuid() }) }
  }, async (request, reply) => {
    const { id } = request.params;
    const [project] = await db.select().from(schema.projetos).where(and(
      eq(schema.projetos.id, id),
      isNull(schema.projetos.deletedAt)
    )).limit(1);
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' });
    const budgets = await db.select().from(schema.orcamentos).where(and(
      eq(schema.orcamentos.projetoId, id),
      isNull(schema.orcamentos.deletedAt)
    ));
    const installments = budgets.length
      ? (await Promise.all(budgets.map((budget) => db.select().from(schema.parcelas).where(and(
        eq(schema.parcelas.orcamentoId, budget.id),
        isNull(schema.parcelas.deletedAt)
      ))))).flat()
      : [];
    const expenses = await db.select().from(schema.despesas).where(and(
      eq(schema.despesas.projetoId, id),
      isNull(schema.despesas.deletedAt)
    ));
    const decisions = await db.select().from(schema.projetoFinanceiroDecisoes)
      .where(eq(schema.projetoFinanceiroDecisoes.projetoId, id))
      .orderBy(desc(schema.projetoFinanceiroDecisoes.createdAt));
    const financialEvents = await db.select().from(schema.financeiroEventos)
      .where(eq(schema.financeiroEventos.projetoId, id))
      .orderBy(desc(schema.financeiroEventos.createdAt))
      .limit(100);
    const fiscalNotes = await db.select().from(schema.notasFiscais).where(and(
      eq(schema.notasFiscais.projetoId, id),
      isNull(schema.notasFiscais.deletedAt),
      isNull(schema.notasFiscais.canceladaEm)
    ));
    const budgetedBudgets = budgets.filter((budget) => (
      !['rascunho', 'cancelado', 'substituido'].includes(normalizeBudgetStatus(budget.status))
    ));
    const contractedBudgets = budgets
      .filter((budget) => ['aprovado', 'pago'].includes((budget.status || '').toLowerCase()));
    const valorContratado = contractedBudgets
      .reduce((sum, budget) => sum + budget.valorTotal, 0);
    const latestExecutionDecision = decisions.find((decision) => (
      decision.tipo === 'cobranca_parcial'
      && (decision.valorExecutado != null || decision.percentualExecutado != null)
    ));
    const valorExecutadoInformado = latestExecutionDecision
      ? latestExecutionDecision.valorExecutado
        ?? Math.round(valorContratado * (latestExecutionDecision.percentualExecutado || 0) / 100)
      : null;
    const latestPendingCancellation = financialEvents.find((event) => event.tipo === 'cancelamento_projeto_pendente');
    const latestFinancialDecision = financialEvents.find((event) => event.tipo === 'decisao_financeira_projeto');
    const decisaoFinanceiraPendente = project.status === 'Cancelado' && (
      (!latestPendingCancellation && !decisions.length)
      || Boolean(
        latestPendingCancellation
        && (!latestFinancialDecision || latestPendingCancellation.createdAt > latestFinancialDecision.createdAt)
      )
    );
    const activeExpenses = expenses.filter((expense) => !expense.canceladaEm && !expense.estornadaEm);
    const custoPrevisto = contractedBudgets
      .reduce((sum, budget) => sum + (budget.custoTotalEstimado || 0), 0);
    const custoRealizado = activeExpenses.reduce((sum, expense) => sum + expense.valor, 0);
    return {
      projeto: { id: project.id, status: project.status },
      orcamentos: budgets.length,
      valorOrcado: budgetedBudgets.reduce((sum, budget) => sum + budget.valorTotal, 0),
      valorContratado,
      valorFaturado: fiscalNotes.reduce((sum, note) => sum + note.valor, 0),
      valorExecutadoInformado,
      valorRecebido: installments.reduce((sum, installment) => sum + installment.valorPago, 0),
      saldoAberto: installments
        .filter((installment) => !installment.canceladaEm)
        .reduce((sum, installment) => sum + Math.max(0, installment.valor - installment.valorPago), 0),
      despesasLancadas: custoRealizado,
      despesasPagas: activeExpenses
        .filter((expense) => (expense.status || '').toLowerCase() === 'pago')
        .reduce((sum, expense) => sum + expense.valor, 0),
      custoPrevisto,
      custoRealizado,
      desvioCusto: custoRealizado - custoPrevisto,
      percentualCustoConsumido: custoPrevisto > 0
        ? Math.round((custoRealizado / custoPrevisto) * 10_000) / 100
        : null,
      despesasSemPrevisao: custoPrevisto === 0 && custoRealizado > 0,
      decisaoFinanceiraPendente,
      parcelas: installments,
      eventosFinanceiros: financialEvents,
      ultimaDecisao: decisions[0] || null
    };
  });

  zServer.post('/:id/decisao-financeira', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        tipo: z.enum([
          'manter_sem_alteracao',
          'cancelar_parcelas_futuras',
          'cobranca_parcial',
          'registrar_devolucao',
          'registrar_credito'
        ]),
        percentualExecutado: z.number().min(0).max(100).nullable().optional(),
        valorExecutado: z.number().int().min(0).nullable().optional(),
        motivo: z.string().trim().min(5).max(2000)
      })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const input = request.body;
    const [project] = await db.select().from(schema.projetos).where(and(
      eq(schema.projetos.id, id),
      isNull(schema.projetos.deletedAt)
    )).limit(1);
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' });
    if (input.tipo === 'cobranca_parcial' && input.percentualExecutado == null && input.valorExecutado == null) {
      return reply.status(400).send({ error: 'Informe o percentual ou o valor executado para a cobrança parcial.' });
    }
    if (['registrar_devolucao', 'registrar_credito'].includes(input.tipo) && !input.valorExecutado) {
      return reply.status(400).send({ error: 'Informe o valor da devolução ou do crédito.' });
    }
    const budgets = await db.select({
      id: schema.orcamentos.id,
      status: schema.orcamentos.status,
      valorTotal: schema.orcamentos.valorTotal
    }).from(schema.orcamentos).where(and(
      eq(schema.orcamentos.projetoId, id),
      isNull(schema.orcamentos.deletedAt)
    ));
    const contractedTotal = budgets
      .filter((budget) => ['aprovado', 'pago'].includes(normalizeBudgetStatus(budget.status)))
      .reduce((sum, budget) => sum + budget.valorTotal, 0);
    const resolvedExecutedValue = input.tipo === 'cobranca_parcial'
      ? input.valorExecutado
        ?? (input.percentualExecutado == null
          ? null
          : Math.round(contractedTotal * input.percentualExecutado / 100))
      : input.valorExecutado ?? null;
    const decisionTimestamp = new Date().toISOString();
    const decision = await db.transaction(async (tx) => {
      const [created] = await tx.insert(schema.projetoFinanceiroDecisoes).values({
        id: crypto.randomUUID(),
        projetoId: id,
        clienteId: project.clienteId,
        tipo: input.tipo,
        percentualExecutado: input.percentualExecutado ?? null,
        valorExecutado: resolvedExecutedValue,
        cancelarParcelasFuturas: input.tipo === 'cancelar_parcelas_futuras',
        motivo: input.motivo,
        createdAt: decisionTimestamp
      }).returning();
      if (input.tipo === 'cancelar_parcelas_futuras') {
        const timestamp = new Date().toISOString();
        for (const budget of budgets) {
          const installments = await tx.select().from(schema.parcelas).where(and(
            eq(schema.parcelas.orcamentoId, budget.id),
            isNull(schema.parcelas.deletedAt),
            isNull(schema.parcelas.canceladaEm)
          ));
          for (const installment of installments.filter((item) => item.valorPago < item.valor)) {
            await tx.update(schema.parcelas).set({
              statusPagamento: 'Cancelado',
              canceladaEm: timestamp,
              motivoCancelamento: input.motivo,
              updatedAt: timestamp
            }).where(eq(schema.parcelas.id, installment.id));
          }
        }
      }
      await tx.insert(schema.financeiroEventos).values({
        id: crypto.randomUUID(),
        tipo: 'decisao_financeira_projeto',
        entidade: 'projeto',
        entidadeId: id,
        clienteId: project.clienteId,
        projetoId: id,
        valor: resolvedExecutedValue || 0,
        dataEvento: decisionTimestamp.slice(0, 10),
        motivo: input.motivo,
        metadataJson: JSON.stringify(input),
        createdAt: decisionTimestamp
      });
      await JornadaService.logClienteEvento({
        clienteId: project.clienteId,
        projetoId: id,
        tipo: 'Financeiro',
        titulo: 'Tratamento financeiro do projeto definido',
        categoria: 'Projeto',
        descricao: `${input.tipo}\n${input.motivo}`
      }, tx);
      await AuditLogService.log('INSERT', 'ProjetoDecisaoFinanceira', null, created, tx);
      return created;
    });
    return reply.status(201).send(decision);
  });

  zServer.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      await db.transaction(async (tx) => {
        const oldProjeto = await tx.select().from(schema.projetos).where(eq(schema.projetos.id, id)).limit(1);
        if (!oldProjeto.length || oldProjeto[0].deletedAt) return;

        await tx.update(schema.projetos)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(schema.projetos.id, id));

        await FileSystemOutboxService.cancelAggregate('project', id, tx);

        await AuditLogService.log('DELETE (SOFT)', 'Projeto', oldProjeto[0], null, tx);
      });

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir projeto' });
    }
  });
}
