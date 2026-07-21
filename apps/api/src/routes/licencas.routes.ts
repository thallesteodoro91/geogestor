import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import {
  ConditionPayloadSchema,
  ConditionPatchPayloadSchema,
  LicensePayloadSchema,
  LicensePatchPayloadSchema,
  normalizeLicenseStatus,
  resolveEffectiveLicenseStatus,
  type LicenseCondition,
  type LicenseListItem
} from '@geogestor/contracts';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { AuditLogService } from '../services/audit.service';

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
  vencimento: z.enum(['vencida', '30d', '60d', '90d', '120d']).optional()
});

type LicenseRow = {
  license: typeof schema.licencas.$inferSelect;
  project: { id: string; nome: string; clienteId: string };
  client: { id: string; nome: string } | null;
};

function resolveConditionStatus(condition: typeof schema.condicionantesAmbientais.$inferSelect): LicenseCondition['status'] {
  if (
    condition.dataLimite
    && condition.dataLimite < new Date().toISOString().slice(0, 10)
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

  return {
    id: row.license.id,
    projetoId: row.license.projetoId,
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
    statusRegistrado: normalizeLicenseStatus(row.license.status),
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

  zServer.get('/', { schema: { querystring: ListQuerySchema } }, async (request, reply) => {
    const filters: SQL[] = [isNull(schema.licencas.deletedAt)];
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

    try {
      const rows = await db.select({
        license: schema.licencas,
        project: {
          id: schema.projetos.id,
          nome: schema.projetos.nome,
          clienteId: schema.projetos.clienteId
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
        .orderBy(asc(schema.licencas.dataVencimento), desc(schema.licencas.updatedAt));

      const conditionRows = await db.select()
        .from(schema.condicionantesAmbientais)
        .where(isNull(schema.condicionantesAmbientais.deletedAt));
      const conditionsByLicense = new Map<string, LicenseCondition[]>();
      conditionRows.forEach((row) => {
        const list = conditionsByLicense.get(row.licencaId) || [];
        list.push(serializeCondition(row));
        conditionsByLicense.set(row.licencaId, list);
      });

      let items = rows.map((row) => serializeLicense(row as LicenseRow, conditionsByLicense.get(row.license.id) || []));
      if (request.query.status) {
        items = items.filter((item) => request.query.status === 'Em renovação'
          ? item.statusRegistrado === 'Em renovação'
          : item.status === request.query.status);
      }
      if (request.query.vencimento) {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const windowDays = request.query.vencimento === 'vencida'
          ? null
          : Number(request.query.vencimento.replace('d', ''));
        items = items.filter((item) => {
          const expiration = new Date(`${item.dataVencimento}T12:00:00`);
          const days = Math.ceil((expiration.getTime() - today.getTime()) / 86_400_000);
          return windowDays === null ? days < 0 : days >= 0 && days <= windowDays;
        });
      }
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
          clienteId: schema.projetos.clienteId
        },
        client: { id: schema.clientes.id, nome: schema.clientes.nome }
      })
        .from(schema.licencas)
        .innerJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
        .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(and(eq(schema.licencas.id, request.params.id), isNull(schema.licencas.deletedAt)))
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
      if (!project.length) return reply.status(400).send({ error: 'O projeto selecionado não existe.' });

      const created = await db.insert(schema.licencas).values({
        id: crypto.randomUUID(),
        projetoId: request.body.projetoId,
        clienteId: request.body.clienteId || project[0].clienteId,
        numero: request.body.numero,
        protocolo: request.body.protocolo || null,
        orgao: request.body.orgao,
        tipoLicenca: request.body.tipoLicenca,
        dataEmissao: request.body.dataEmissao || null,
        dataVencimento: request.body.dataVencimento,
        status: request.body.status,
        observacoes: request.body.observacoes || null
      }).returning();
      await AuditLogService.log('INSERT', 'Licença', null, created[0]);
      return reply.status(201).send(created[0]);
    } catch (error) {
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
      if (!current.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      const updated = await db.update(schema.licencas).set({
        ...request.body,
        protocolo: request.body.protocolo === undefined ? undefined : request.body.protocolo || null,
        dataEmissao: request.body.dataEmissao === undefined ? undefined : request.body.dataEmissao || null,
        observacoes: request.body.observacoes === undefined ? undefined : request.body.observacoes || null,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.licencas.id, request.params.id)).returning();
      await AuditLogService.log('UPDATE', 'Licença', current[0], updated[0]);
      return updated[0];
    } catch (error) {
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
      if (!current.length) return reply.status(404).send({ error: 'Licença não encontrada.' });
      const updated = await db.update(schema.licencas).set({
        ...request.body,
        protocolo: request.body.protocolo || null,
        dataEmissao: request.body.dataEmissao || null,
        observacoes: request.body.observacoes || null,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.licencas.id, request.params.id)).returning();
      await AuditLogService.log('UPDATE', 'Licença', current[0], updated[0]);
      return updated[0];
    } catch (error) {
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
      await db.update(schema.licencas).set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).where(eq(schema.licencas.id, request.params.id));
      await AuditLogService.log('DELETE (SOFT)', 'Licença', current[0], null);
      return reply.status(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível excluir a licença.' });
    }
  });

  zServer.get('/:id/condicionantes', { schema: { params: IdParamsSchema } }, async (request, reply) => {
    try {
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
      const created = await db.insert(schema.condicionantesAmbientais).values({
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
      await AuditLogService.log('INSERT', 'Condicionante Ambiental', null, created[0]);
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
      const updated = await db.update(schema.condicionantesAmbientais).set({
        ...request.body,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.condicionantesAmbientais.id, request.params.conditionId)).returning();
      await AuditLogService.log('UPDATE', 'Condicionante Ambiental', current[0], updated[0]);
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
      await db.update(schema.condicionantesAmbientais).set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).where(eq(schema.condicionantesAmbientais.id, request.params.conditionId));
      await AuditLogService.log('DELETE (SOFT)', 'Condicionante Ambiental', current[0], null);
      return reply.status(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível excluir a condicionante.' });
    }
  });
}
