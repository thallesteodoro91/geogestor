import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import {
  ConditionPayloadSchema,
  ConditionPatchPayloadSchema,
  LicensePayloadSchema,
  LicensePatchPayloadSchema,
  isRecognizedLicenseStatus,
  normalizeLicenseStatus,
  resolveEffectiveLicenseStatus,
  type LicenseCondition,
  type LicenseListItem
} from '@geogestor/contracts';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { AuditLogService } from '../services/audit.service';
import { RelationshipIntegrityError, resolveClientProjectLink } from '../services/relationship-integrity.service';

const IdParamsSchema = z.object({ id: z.string().uuid() });
const ConditionParamsSchema = z.object({
  id: z.string().uuid(),
  conditionId: z.string().uuid()
});

const ListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().trim().optional(),
  tipo: z.string().trim().optional(),
  clienteId: z.string().uuid().optional(),
  vencimento: z.enum(['vencida', '30d', '60d', '90d', '120d']).optional(),
  mode: z.literal('page').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

type LicenseRow = {
  license: typeof schema.licencas.$inferSelect;
  project: { id: string; nome: string; clienteId: string; status: string | null };
  client: { id: string; nome: string } | null;
};

function resolveConditionStatus(condition: typeof schema.condicionantesAmbientais.$inferSelect): LicenseCondition['status'] {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  if (
    condition.dataLimite
    && condition.dataLimite < today
    && (condition.status === 'Pendente' || condition.status === 'Em andamento')
  ) return 'Vencida';
  return condition.status as LicenseCondition['status'];
}

function serializeCondition(condition: typeof schema.condicionantesAmbientais.$inferSelect): LicenseCondition {
  return {
    id: condition.id,
    licencaId: condition.licencaId,
    titulo: condition.titulo,
    descricao: condition.descricao,
    dataLimite: condition.dataLimite,
    periodicidade: condition.periodicidade,
    responsavel: condition.responsavel,
    status: resolveConditionStatus(condition),
    dataCumprimento: condition.dataCumprimento,
    observacoes: condition.observacoes,
    comprovante: condition.comprovante,
    createdAt: condition.createdAt,
    updatedAt: condition.updatedAt
  };
}

function serializeLicense(
  row: LicenseRow,
  conditions: LicenseCondition[]
): LicenseListItem {
  const activeConditions = conditions.filter((item) => item.status !== 'Dispensada');
  const nextCondition = activeConditions
    .filter((item) => item.dataLimite && ['Pendente', 'Em andamento', 'Vencida'].includes(item.status))
    .sort((a, b) => String(a.dataLimite).localeCompare(String(b.dataLimite)))[0];

  const registeredStatus = row.license.status?.trim() || 'Em análise';
  return {
    id: row.license.id,
    projetoId: row.license.projetoId,
    trabalhoStatus: row.project.status || 'Planejamento',
    clienteId: row.license.clienteId || row.project.clienteId,
    clienteNome: row.client?.nome || 'Cliente não informado',
    projetoNome: row.project.nome,
    numero: row.license.numero,
    protocolo: row.license.protocolo,
    orgao: row.license.orgao,
    tipoLicenca: row.license.tipoLicenca,
    dataEmissao: row.license.dataEmissao,
    dataVencimento: row.license.dataVencimento,
    status: resolveEffectiveLicenseStatus(row.license.status, row.license.dataVencimento),
    statusRegistrado: isRecognizedLicenseStatus(registeredStatus)
      ? normalizeLicenseStatus(registeredStatus)
      : registeredStatus,
    statusRegistradoReconhecido: isRecognizedLicenseStatus(registeredStatus),
    observacoes: row.license.observacoes,
    condicionantesPendentes: activeConditions.filter((item) => item.status === 'Pendente' || item.status === 'Em andamento').length,
    condicionantesVencidas: activeConditions.filter((item) => item.status === 'Vencida').length,
    proximaCondicionante: nextCondition?.dataLimite || null,
    createdAt: row.license.createdAt,
    updatedAt: row.license.updatedAt
  };
}

export async function licencasRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const registeredStatus = sql<string>`CASE lower(trim(coalesce(${schema.licencas.status}, '')))
    WHEN 'válida' THEN 'Válida' WHEN 'valida' THEN 'Válida' WHEN 'ativa' THEN 'Válida' WHEN 'valido' THEN 'Válida'
    WHEN 'em renovação' THEN 'Em renovação' WHEN 'em renovacao' THEN 'Em renovação'
    WHEN 'suspensa' THEN 'Suspensa' WHEN 'vencida' THEN 'Vencida' WHEN 'encerrada' THEN 'Encerrada'
    ELSE 'Em análise' END`;
  const effectiveStatus = () => sql<string>`CASE WHEN ${registeredStatus} IN ('Encerrada', 'Suspensa') THEN ${registeredStatus}
    WHEN ${schema.licencas.dataVencimento} < ${todayKey()} THEN 'Vencida' ELSE ${registeredStatus} END`;

  zServer.get('/summary', async () => {
    const today = todayKey();
    const nearEnd = new Date(`${today}T12:00:00Z`); nearEnd.setUTCDate(nearEnd.getUTCDate() + 120);
    const [counts] = await db.select({
      total: sql<number>`count(*)`, valid: sql<number>`sum(CASE WHEN ${effectiveStatus()} = 'Válida' THEN 1 ELSE 0 END)`,
      expired: sql<number>`sum(CASE WHEN ${effectiveStatus()} = 'Vencida' THEN 1 ELSE 0 END)`,
      renewal: sql<number>`sum(CASE WHEN ${registeredStatus} = 'Em renovação' THEN 1 ELSE 0 END)`,
      near: sql<number>`sum(CASE WHEN ${schema.licencas.dataVencimento} BETWEEN ${today} AND ${nearEnd.toISOString().slice(0, 10)} AND ${effectiveStatus()} <> 'Encerrada' THEN 1 ELSE 0 END)`
    }).from(schema.licencas).innerJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
      .where(and(isNull(schema.licencas.deletedAt), isNull(schema.projetos.deletedAt)));
    const overdue = sql`(${schema.condicionantesAmbientais.status} = 'Vencida' OR (${schema.condicionantesAmbientais.status} IN ('Pendente', 'Em andamento') AND ${schema.condicionantesAmbientais.dataLimite} < ${today}))`;
    const [conditions] = await db.select({
      pending: sql<number>`sum(CASE WHEN ${schema.condicionantesAmbientais.status} IN ('Pendente','Em andamento') AND NOT coalesce(${overdue}, 0) THEN 1 ELSE 0 END)`,
      overdue: sql<number>`sum(CASE WHEN ${overdue} THEN 1 ELSE 0 END)`
    }).from(schema.condicionantesAmbientais).innerJoin(schema.licencas, eq(schema.condicionantesAmbientais.licencaId, schema.licencas.id))
      .innerJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
      .where(and(isNull(schema.condicionantesAmbientais.deletedAt), isNull(schema.licencas.deletedAt), isNull(schema.projetos.deletedAt)));
    return Object.fromEntries(Object.entries({ ...counts, ...conditions }).map(([key, value]) => [key, Number(value || 0)]));
  });

  zServer.get('/', { schema: { querystring: ListQuerySchema } }, async (request, reply) => {
    const filters: SQL[] = [isNull(schema.licencas.deletedAt), isNull(schema.projetos.deletedAt)];
    if (request.query.clienteId) filters.push(eq(schema.projetos.clienteId, request.query.clienteId));
    if (request.query.tipo) filters.push(eq(schema.licencas.tipoLicenca, request.query.tipo));
    if (request.query.q) {
      const query = `%${request.query.q}%`;
      filters.push(or(
        like(schema.licencas.numero, query),
        like(schema.licencas.protocolo, query),
        like(schema.licencas.orgao, query),
        like(schema.projetos.nome, query),
        like(schema.clientes.nome, query)
      )!);
    }
    if (request.query.status) filters.push(eq(request.query.status === 'Em renovação' ? registeredStatus : effectiveStatus(), request.query.status));
    if (request.query.vencimento) {
      const today = todayKey();
      if (request.query.vencimento === 'vencida') filters.push(sql`${schema.licencas.dataVencimento} < ${today}`);
      else {
        const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + Number(request.query.vencimento.replace('d', '')));
        filters.push(sql`${schema.licencas.dataVencimento} BETWEEN ${today} AND ${end.toISOString().slice(0, 10)}`);
      }
    }

    try {
      const query = db.select({
        license: schema.licencas,
        project: {
          id: schema.projetos.id,
          nome: schema.projetos.nome,
          clienteId: schema.projetos.clienteId,
          status: schema.projetos.status
        },
        client: {
          id: schema.clientes.id,
          nome: schema.clientes.nome
        }
      })
        .from(schema.licencas)
        .innerJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(and(...filters))
        .orderBy(asc(schema.licencas.dataVencimento), desc(schema.licencas.updatedAt), asc(schema.licencas.id));
      const rows = await (request.query.mode === 'page' ? query.limit(request.query.limit).offset((request.query.page - 1) * request.query.limit) : query);
      const [count] = request.query.mode === 'page' ? await db.select({ total: sql<number>`count(*)` }).from(schema.licencas)
        .innerJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id)).leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(and(...filters)) : [{ total: rows.length }];

      const licenseIds = rows.map((row) => row.license.id);
      const conditionRows = licenseIds.length ? await db.select()
        .from(schema.condicionantesAmbientais)
        .where(and(
          inArray(schema.condicionantesAmbientais.licencaId, licenseIds),
          isNull(schema.condicionantesAmbientais.deletedAt)
        )) : [];
      const conditionsByLicense = new Map<string, LicenseCondition[]>();
      conditionRows.forEach((row) => {
        const list = conditionsByLicense.get(row.licencaId) || [];
        list.push(serializeCondition(row));
        conditionsByLicense.set(row.licencaId, list);
      });

      const items = rows.map((row) => serializeLicense(row as LicenseRow, conditionsByLicense.get(row.license.id) || []));
      if (request.query.mode === 'page') return { items, total: Number(count.total), page: request.query.page, limit: request.query.limit, totalPages: Math.max(1, Math.ceil(Number(count.total) / request.query.limit)) };
      return items;
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível consultar as licenças. Tente novamente.' });
    }
  });

  zServer.get('/:id', { schema: { params: IdParamsSchema } }, async (request, reply) => {
    try {
      const rows = await db.select({
        license: schema.licencas,
        project: {
          id: schema.projetos.id,
          nome: schema.projetos.nome,
          clienteId: schema.projetos.clienteId,
          status: schema.projetos.status
        },
        client: { id: schema.clientes.id, nome: schema.clientes.nome }
      })
        .from(schema.licencas)
        .innerJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(and(
          eq(schema.licencas.id, request.params.id),
          isNull(schema.licencas.deletedAt),
          isNull(schema.projetos.deletedAt)
        ))
        .limit(1);
      if (!rows.length) return reply.status(404).send({ error: 'Licença não encontrada.' });

      const conditionRows = await db.select()
        .from(schema.condicionantesAmbientais)
        .where(and(
          eq(schema.condicionantesAmbientais.licencaId, request.params.id),
          isNull(schema.condicionantesAmbientais.deletedAt)
        ))
        .orderBy(asc(schema.condicionantesAmbientais.dataLimite));
      const conditions = conditionRows.map(serializeCondition);
      const historyRows = await db.select().from(schema.interacoes_cliente)
        .where(and(
          eq(schema.interacoes_cliente.projetoId, rows[0].license.projetoId),
          isNull(schema.interacoes_cliente.deletedAt)
        ))
        .orderBy(desc(schema.interacoes_cliente.data));
      return {
        ...serializeLicense(rows[0] as LicenseRow, conditions),
        condicionantes: conditions,
        history: historyRows.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          titulo: item.titulo,
          categoria: item.categoria,
          descricao: item.descricao,
          data: item.data,
          manual: item.manual,
          createdAt: item.createdAt
        }))
      };
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível carregar a licença.' });
    }
  });

  zServer.post('/', { schema: { body: LicensePayloadSchema } }, async (request, reply) => {
    try {
      const project = await db.select().from(schema.projetos)
        .where(and(eq(schema.projetos.id, request.body.projetoId), isNull(schema.projetos.deletedAt)))
        .limit(1);
      const link = project.length
        ? await resolveClientProjectLink({
            projetoId: request.body.projetoId,
            clienteId: request.body.clienteId
          })
        : null;
      if (!project.length) return reply.status(400).send({ error: 'O projeto selecionado não existe.' });

      const created = await db.transaction(async (tx) => {
        const license = await tx.insert(schema.licencas).values({
          id: crypto.randomUUID(),
          projetoId: request.body.projetoId,
          clienteId: link!.clienteId,
          numero: request.body.numero,
          protocolo: request.body.protocolo || null,
          orgao: request.body.orgao,
          tipoLicenca: request.body.tipoLicenca,
          dataEmissao: request.body.dataEmissao || null,
          dataVencimento: request.body.dataVencimento,
          status: request.body.status,
          observacoes: request.body.observacoes || null
        }).returning();
        await AuditLogService.log('INSERT', 'Licença', null, license[0], tx);
        return license;
      });
      return reply.status(201).send(created[0]);
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível criar a licença.' });
    }
  });

  zServer.patch('/:id', {
    schema: { params: IdParamsSchema, body: LicensePatchPayloadSchema }
  }, async (request, reply) => {
    try {
      const current = await db.select().from(schema.licencas)
        .where(and(eq(schema.licencas.id, request.params.id), isNull(schema.licencas.deletedAt)))
        .limit(1);
      const link = current.length
        ? await resolveClientProjectLink({
            projetoId: request.body.projetoId !== undefined ? request.body.projetoId : current[0].projetoId,
            clienteId: request.body.clienteId !== undefined ? request.body.clienteId : current[0].clienteId
          })
        : null;
      if (!current.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      if (request.body.projetoId !== undefined && request.body.projetoId !== current[0].projetoId) {
        return reply.status(409).send({ error: 'O projeto de uma licença existente não pode ser alterado.' });
      }
      const merged = LicensePayloadSchema.safeParse({
        projetoId: request.body.projetoId ?? current[0].projetoId,
        clienteId: request.body.clienteId === undefined ? current[0].clienteId : request.body.clienteId,
        numero: request.body.numero ?? current[0].numero,
        protocolo: request.body.protocolo === undefined ? current[0].protocolo : request.body.protocolo,
        orgao: request.body.orgao ?? current[0].orgao,
        tipoLicenca: request.body.tipoLicenca ?? current[0].tipoLicenca,
        dataEmissao: request.body.dataEmissao === undefined ? current[0].dataEmissao : request.body.dataEmissao,
        dataVencimento: request.body.dataVencimento ?? current[0].dataVencimento,
        status: request.body.status ?? normalizeLicenseStatus(current[0].status),
        observacoes: request.body.observacoes === undefined ? current[0].observacoes : request.body.observacoes
      });
      if (!merged.success) return reply.status(400).send({ error: merged.error.issues[0]?.message || 'Dados inválidos.' });
      const updated = await db.transaction(async (tx) => {
        const license = await tx.update(schema.licencas).set({
          ...request.body,
          projetoId: link!.projetoId!,
          clienteId: link!.clienteId,
          protocolo: request.body.protocolo === undefined ? undefined : request.body.protocolo || null,
          dataEmissao: request.body.dataEmissao === undefined ? undefined : request.body.dataEmissao || null,
          observacoes: request.body.observacoes === undefined ? undefined : request.body.observacoes || null,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.licencas.id, request.params.id)).returning();
        await AuditLogService.log('UPDATE', 'Licença', current[0], license[0], tx);
        return license;
      });
      return updated[0];
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível atualizar a licença.' });
    }
  });

  zServer.put('/:id', {
    schema: { params: IdParamsSchema, body: LicensePayloadSchema }
  }, async (request, reply) => {
    try {
      const current = await db.select().from(schema.licencas)
        .where(and(eq(schema.licencas.id, request.params.id), isNull(schema.licencas.deletedAt)))
        .limit(1);
      const link = current.length
        ? await resolveClientProjectLink({
            projetoId: request.body.projetoId,
            clienteId: request.body.clienteId
          })
        : null;
      if (!current.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      if (request.body.projetoId !== current[0].projetoId) {
        return reply.status(409).send({ error: 'O projeto de uma licença existente não pode ser alterado.' });
      }
      const updated = await db.transaction(async (tx) => {
        const license = await tx.update(schema.licencas).set({
          ...request.body,
          projetoId: link!.projetoId!,
          clienteId: link!.clienteId,
          protocolo: request.body.protocolo || null,
          dataEmissao: request.body.dataEmissao || null,
          observacoes: request.body.observacoes || null,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.licencas.id, request.params.id)).returning();
        await AuditLogService.log('UPDATE', 'Licença', current[0], license[0], tx);
        return license;
      });
      return updated[0];
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível atualizar a licença.' });
    }
  });

  zServer.delete('/:id', { schema: { params: IdParamsSchema } }, async (request, reply) => {
    try {
      const current = await db.select().from(schema.licencas)
        .where(and(eq(schema.licencas.id, request.params.id), isNull(schema.licencas.deletedAt)))
        .limit(1);
      if (!current.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      await db.transaction(async (tx) => {
        const deletedAt = new Date().toISOString();
        await tx.update(schema.licencas).set({
          deletedAt,
          updatedAt: deletedAt
        }).where(eq(schema.licencas.id, request.params.id));
        await tx.update(schema.condicionantesAmbientais).set({
          deletedAt,
          updatedAt: deletedAt
        }).where(and(
          eq(schema.condicionantesAmbientais.licencaId, request.params.id),
          isNull(schema.condicionantesAmbientais.deletedAt)
        ));
        await AuditLogService.log('DELETE (SOFT)', 'Licença', current[0], null, tx);
      });
      return reply.status(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível excluir a licença.' });
    }
  });

  zServer.get('/:id/condicionantes', { schema: { params: IdParamsSchema } }, async (request, reply) => {
    try {
      const license = await db.select({ id: schema.licencas.id }).from(schema.licencas)
        .where(and(eq(schema.licencas.id, request.params.id), isNull(schema.licencas.deletedAt)))
        .limit(1);
      if (!license.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      const rows = await db.select().from(schema.condicionantesAmbientais)
        .where(and(
          eq(schema.condicionantesAmbientais.licencaId, request.params.id),
          isNull(schema.condicionantesAmbientais.deletedAt)
        ))
        .orderBy(asc(schema.condicionantesAmbientais.dataLimite));
      return rows.map(serializeCondition);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível consultar as condicionantes.' });
    }
  });

  zServer.post('/:id/condicionantes', {
    schema: { params: IdParamsSchema, body: ConditionPayloadSchema }
  }, async (request, reply) => {
    try {
      const license = await db.select({ id: schema.licencas.id }).from(schema.licencas)
        .where(and(eq(schema.licencas.id, request.params.id), isNull(schema.licencas.deletedAt)))
        .limit(1);
      if (!license.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      const created = await db.transaction(async (tx) => {
        const condition = await tx.insert(schema.condicionantesAmbientais).values({
          id: crypto.randomUUID(),
          licencaId: request.params.id,
          ...request.body,
          descricao: request.body.descricao || null,
          dataLimite: request.body.dataLimite || null,
          periodicidade: request.body.periodicidade || null,
          responsavel: request.body.responsavel || null,
          dataCumprimento: request.body.dataCumprimento || null,
          observacoes: request.body.observacoes || null,
          comprovante: request.body.comprovante || null
        }).returning();
        await AuditLogService.log('INSERT', 'Condicionante Ambiental', null, condition[0], tx);
        return condition;
      });
      return reply.status(201).send(serializeCondition(created[0]));
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível criar a condicionante.' });
    }
  });

  zServer.patch('/:id/condicionantes/:conditionId', {
    schema: { params: ConditionParamsSchema, body: ConditionPatchPayloadSchema }
  }, async (request, reply) => {
    try {
      const current = await db.select().from(schema.condicionantesAmbientais)
        .where(and(
          eq(schema.condicionantesAmbientais.id, request.params.conditionId),
          eq(schema.condicionantesAmbientais.licencaId, request.params.id),
          isNull(schema.condicionantesAmbientais.deletedAt)
        )).limit(1);
      if (!current.length) return reply.status(404).send({ error: 'Condicionante não encontrada.' });
      const merged = ConditionPayloadSchema.safeParse({
        titulo: request.body.titulo ?? current[0].titulo,
        descricao: request.body.descricao === undefined ? current[0].descricao : request.body.descricao,
        dataLimite: request.body.dataLimite === undefined ? current[0].dataLimite : request.body.dataLimite,
        periodicidade: request.body.periodicidade === undefined ? current[0].periodicidade : request.body.periodicidade,
        responsavel: request.body.responsavel === undefined ? current[0].responsavel : request.body.responsavel,
        status: request.body.status ?? current[0].status,
        dataCumprimento: request.body.dataCumprimento === undefined ? current[0].dataCumprimento : request.body.dataCumprimento,
        observacoes: request.body.observacoes === undefined ? current[0].observacoes : request.body.observacoes,
        comprovante: request.body.comprovante === undefined ? current[0].comprovante : request.body.comprovante
      });
      if (!merged.success) return reply.status(400).send({ error: merged.error.issues[0]?.message || 'Dados inválidos.' });
      const updated = await db.transaction(async (tx) => {
        const condition = await tx.update(schema.condicionantesAmbientais).set({
          ...request.body,
          dataCumprimento: request.body.status !== undefined && request.body.status !== 'Cumprida'
            ? null
            : request.body.dataCumprimento,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.condicionantesAmbientais.id, request.params.conditionId)).returning();
        await AuditLogService.log('UPDATE', 'Condicionante Ambiental', current[0], condition[0], tx);
        return condition;
      });
      return serializeCondition(updated[0]);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível atualizar a condicionante.' });
    }
  });

  zServer.delete('/:id/condicionantes/:conditionId', {
    schema: { params: ConditionParamsSchema }
  }, async (request, reply) => {
    try {
      const current = await db.select().from(schema.condicionantesAmbientais)
        .where(and(
          eq(schema.condicionantesAmbientais.id, request.params.conditionId),
          eq(schema.condicionantesAmbientais.licencaId, request.params.id),
          isNull(schema.condicionantesAmbientais.deletedAt)
        )).limit(1);
      if (!current.length) return reply.status(404).send({ error: 'Condicionante não encontrada.' });
      await db.transaction(async (tx) => {
        await tx.update(schema.condicionantesAmbientais).set({
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).where(eq(schema.condicionantesAmbientais.id, request.params.conditionId));
        await AuditLogService.log('DELETE (SOFT)', 'Condicionante Ambiental', current[0], null, tx);
      });
      return reply.status(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível excluir a condicionante.' });
    }
  });
}
