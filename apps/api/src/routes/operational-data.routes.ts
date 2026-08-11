import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import crypto from 'node:crypto';
import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '@geogestor/database';
import {
  EXPENSE_CATALOG_KEY,
  ExpenseCatalogSchema,
  SERVICE_CATALOG_KEY,
  ServiceCatalogSchema,
} from '@geogestor/contracts/src/auxiliary-catalogs';
import {
  PropertyPatchSchema,
  PropertyPayloadSchema,
  normalizePropertyIdentifier,
  normalizePropertyName,
  type PropertyPayload
} from '@geogestor/contracts/src/properties';
import { db } from '../db';
import { AuditLogService } from '../services/audit.service';
import {
  RelationshipIntegrityError,
  assertActiveClient,
  resolveClientProjectLink
} from '../services/relationship-integrity.service';

const CalculationPayload = z.object({
  tipo: z.enum(['topografico', 'ambiental']),
  nome: z.string().trim().min(1).max(200),
  clienteId: z.string().uuid().nullable().optional(),
  projetoId: z.string().uuid().nullable().optional(),
  dataCalculo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entradas: z.unknown(),
  resultado: z.unknown(),
  unidade: z.string().trim().max(80).nullable().optional(),
  metodo: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().trim().max(4000).nullable().optional()
});

const operationalSettingKeys = new Set([
  SERVICE_CATALOG_KEY,
  EXPENSE_CATALOG_KEY,
  'geogestor_jornada_categorias',
  'geogestor_empresa_template',
  'import_schemas',
  'geogestor_alerta_dias'
]);

function validateOperationalSetting(key: string, value: unknown) {
  if (!operationalSettingKeys.has(key)) return `A configuração “${key}” não é reconhecida.`;
  const result = key === SERVICE_CATALOG_KEY
    ? ServiceCatalogSchema.safeParse(value)
    : key === EXPENSE_CATALOG_KEY
      ? ExpenseCatalogSchema.safeParse(value)
      : { success: true } as const;
  return result.success ? null : result.error.issues[0]?.message || 'Configuração operacional inválida.';
}

async function findPropertyDuplicate(payload: PropertyPayload, currentId?: string) {
  const rows = await db.select({
    id: schema.propriedades.id,
    clienteId: schema.propriedades.clienteId,
    nome: schema.propriedades.nome,
    matricula: schema.propriedades.matricula,
    car: schema.propriedades.car,
    ccir: schema.propriedades.ccir,
    itr: schema.propriedades.itr
  }).from(schema.propriedades).where(isNull(schema.propriedades.deletedAt));

  const identifiers = [
    ['matrícula', payload.matricula, 'matricula'],
    ['CAR', payload.car, 'car'],
    ['CCIR', payload.ccir, 'ccir'],
    ['ITR', payload.itr, 'itr']
  ] as const;

  for (const property of rows) {
    if (property.id === currentId) continue;
    if (property.clienteId === payload.clienteId && normalizePropertyName(property.nome) === normalizePropertyName(payload.nome)) {
      return 'Já existe uma propriedade com este nome para o cliente selecionado.';
    }
    for (const [label, value, key] of identifiers) {
      const normalized = normalizePropertyIdentifier(value);
      if (!normalized) continue;
      const existing = normalizePropertyIdentifier(property[key]);
      if (existing && existing === normalized) return `Já existe uma propriedade com este ${label}.`;
    }
  }
  return null;
}

async function propertyHasLinks(propertyId: string) {
  const [project, budget, environmental, assessment] = await Promise.all([
    db.select({ id: schema.projetos.id }).from(schema.projetos).where(eq(schema.projetos.propriedadeId, propertyId)).limit(1),
    db.select({ id: schema.orcamentos.id }).from(schema.orcamentos).where(eq(schema.orcamentos.propriedadeId, propertyId)).limit(1),
    db.select({ id: schema.ambiental.id }).from(schema.ambiental).where(eq(schema.ambiental.propriedadeId, propertyId)).limit(1),
    db.select({ id: schema.pericias.id }).from(schema.pericias).where(eq(schema.pericias.propriedadeId, propertyId)).limit(1)
  ]);
  return project.length > 0 || budget.length > 0 || environmental.length > 0 || assessment.length > 0;
}

export async function operationalDataRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/propriedades', {
    schema: { querystring: z.object({
      clienteId: z.string().uuid().optional(),
      q: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }) }
  }, async (request) => {
    const filters = [isNull(schema.propriedades.deletedAt)];
    if (request.query.clienteId) filters.push(eq(schema.propriedades.clienteId, request.query.clienteId));
    if (request.query.q) {
      const term = `%${request.query.q}%`;
      filters.push(or(
        like(schema.propriedades.nome, term),
        like(schema.propriedades.matricula, term),
        like(schema.propriedades.car, term),
        like(schema.propriedades.municipio, term)
      )!);
    }
    const where = and(...filters);
    const [items, [count]] = await Promise.all([
      db.select({ property: schema.propriedades, clienteNome: schema.clientes.nome })
        .from(schema.propriedades)
        .leftJoin(schema.clientes, eq(schema.propriedades.clienteId, schema.clientes.id))
        .where(where)
        .orderBy(schema.propriedades.nome)
        .limit(request.query.limit)
        .offset((request.query.page - 1) * request.query.limit),
      db.select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` }).from(schema.propriedades).where(where)
    ]);
    return {
      items: items.map((item) => ({ ...item.property, clienteNome: item.clienteNome })),
      total: Number(count?.total || 0),
      page: request.query.page,
      limit: request.query.limit
    };
  });

  zServer.get('/propriedades/options', {
    schema: { querystring: z.object({
      q: z.string().trim().max(200).optional(),
      clienteId: z.string().uuid().optional(),
      selectedId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(25)
    }) }
  }, async (request) => {
    const { q, clienteId, selectedId, limit } = request.query;
    const selection = {
      id: schema.propriedades.id,
      nome: schema.propriedades.nome,
      clienteId: schema.propriedades.clienteId,
      areaHa: schema.propriedades.areaHa,
      matricula: schema.propriedades.matricula,
      car: schema.propriedades.car,
      ccir: schema.propriedades.ccir,
      itr: schema.propriedades.itr,
      municipio: schema.propriedades.municipio,
      latitude: schema.propriedades.latitude,
      longitude: schema.propriedades.longitude,
      situacaoImovel: schema.propriedades.situacaoImovel
    };
    const items = await db.select(selection).from(schema.propriedades).where(and(
      isNull(schema.propriedades.deletedAt),
      clienteId ? eq(schema.propriedades.clienteId, clienteId) : undefined,
      q ? or(
        like(schema.propriedades.nome, `%${q}%`),
        like(schema.propriedades.matricula, `%${q}%`),
        like(schema.propriedades.car, `%${q}%`),
        like(schema.propriedades.municipio, `%${q}%`)
      ) : undefined
    )).orderBy(asc(schema.propriedades.nome), asc(schema.propriedades.id)).limit(limit);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      const [selected] = await db.select(selection).from(schema.propriedades)
        .where(and(eq(schema.propriedades.id, selectedId), isNull(schema.propriedades.deletedAt))).limit(1);
      if (selected) return [selected, ...items].slice(0, limit);
    }
    return items;
  });

  zServer.post('/propriedades', { schema: { body: PropertyPayloadSchema } }, async (request, reply) => {
    await assertActiveClient(request.body.clienteId);
    const duplicate = await findPropertyDuplicate(request.body);
    if (duplicate) return reply.status(409).send({ error: duplicate });
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(schema.propriedades).values({
        id: crypto.randomUUID(),
        ...request.body
      }).returning();
      await AuditLogService.log('INSERT', 'Propriedade', null, rows[0], tx);
      return rows;
    });
    return reply.status(201).send(created);
  });

  zServer.patch('/propriedades/:id', {
    schema: { params: z.object({ id: z.string().uuid() }), body: PropertyPatchSchema }
  }, async (request, reply) => {
    const [current] = await db.select().from(schema.propriedades).where(and(
      eq(schema.propriedades.id, request.params.id), isNull(schema.propriedades.deletedAt)
    )).limit(1);
    if (!current) return reply.status(404).send({ error: 'Propriedade não encontrada.' });
    const parsed = PropertyPayloadSchema.safeParse({ ...current, ...request.body });
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Revise os dados da propriedade.' });
    const nextProperty = parsed.data;
    const targetClientId = nextProperty.clienteId;
    await assertActiveClient(nextProperty.clienteId);
    if (targetClientId !== current.clienteId) {
      if (await propertyHasLinks(current.id)) {
        return reply.status(409).send({ error: 'A propriedade não pode trocar de cliente enquanto estiver vinculada.' });
      }
    }
    const duplicate = await findPropertyDuplicate(nextProperty, current.id);
    if (duplicate) return reply.status(409).send({ error: duplicate });
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(schema.propriedades).set({
        ...nextProperty,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.propriedades.id, current.id)).returning();
      await AuditLogService.log('UPDATE', 'Propriedade', current, rows[0], tx);
      return rows;
    });
    return updated;
  });

  zServer.delete('/propriedades/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) }
  }, async (request, reply) => {
    if (await propertyHasLinks(request.params.id)) {
      return reply.status(409).send({ error: 'A propriedade possui registros vinculados e não pode ser excluída.' });
    }
    const [current] = await db.select().from(schema.propriedades).where(and(
      eq(schema.propriedades.id, request.params.id), isNull(schema.propriedades.deletedAt)
    )).limit(1);
    if (!current) return reply.status(404).send({ error: 'Propriedade não encontrada.' });
    await db.transaction(async (tx) => {
      await tx.update(schema.propriedades).set({ deletedAt: new Date().toISOString() })
        .where(eq(schema.propriedades.id, request.params.id));
      await AuditLogService.log('DELETE (SOFT)', 'Propriedade', current, null, tx);
    });
    return reply.status(204).send();
  });

  zServer.get('/configuracoes-operacionais', async () => {
    const rows = await db.select().from(schema.configuracoesOperacionais)
      .where(isNull(schema.configuracoesOperacionais.deletedAt));
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.chave] = JSON.parse(row.valorJson);
      } catch {
        // Ignore a corrupt row so one invalid setting cannot break every consumer.
      }
    }
    return settings;
  });

  zServer.put('/configuracoes-operacionais', {
    schema: { body: z.object({ values: z.record(z.string(), z.unknown()) }) }
  }, async (request, reply) => {
    for (const [key, value] of Object.entries(request.body.values)) {
      const validationError = validateOperationalSetting(key, value);
      if (validationError) return reply.status(400).send({ error: validationError });
    }
    const timestamp = new Date().toISOString();
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(request.body.values)) {
        await tx.insert(schema.configuracoesOperacionais).values({
          id: crypto.randomUUID(),
          chave: key,
          valorJson: JSON.stringify(value),
          origem: 'aplicacao',
          updatedAt: timestamp
        }).onConflictDoUpdate({
          target: schema.configuracoesOperacionais.chave,
          set: { valorJson: JSON.stringify(value), origem: 'aplicacao', updatedAt: timestamp, deletedAt: null }
        });
      }
    });
    return { updated: Object.keys(request.body.values), updatedAt: timestamp };
  });

  zServer.put('/configuracoes-operacionais/migrar', {
    schema: { body: z.object({ values: z.record(z.string(), z.unknown()) }) }
  }, async (request) => {
    const timestamp = new Date().toISOString();
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(request.body.values)) {
        await tx.insert(schema.configuracoesOperacionais).values({
          id: crypto.randomUUID(),
          chave: key,
          valorJson: JSON.stringify(value),
          origem: 'localStorage',
          migradoEm: timestamp,
          updatedAt: timestamp
        }).onConflictDoNothing({ target: schema.configuracoesOperacionais.chave });
      }
    });
    return { migrated: Object.keys(request.body.values), migratedAt: timestamp };
  });

  zServer.get('/calculos', {
    schema: { querystring: z.object({ tipo: z.enum(['topografico', 'ambiental']).optional() }) }
  }, async (request) => {
    const rows = await db.select().from(schema.calculosSalvos).where(and(
      isNull(schema.calculosSalvos.deletedAt),
      request.query.tipo ? eq(schema.calculosSalvos.tipo, request.query.tipo) : undefined
    )).orderBy(desc(schema.calculosSalvos.dataCalculo), desc(schema.calculosSalvos.createdAt));
    return rows.map((row) => ({ ...row, entradas: JSON.parse(row.entradasJson), resultado: JSON.parse(row.resultadoJson) }));
  });

  zServer.post('/calculos', { schema: { body: CalculationPayload } }, async (request, reply) => {
    try {
      const link = await resolveClientProjectLink(request.body);
      const [created] = await db.transaction(async (tx) => {
        const rows = await tx.insert(schema.calculosSalvos).values({
          id: crypto.randomUUID(),
          tipo: request.body.tipo,
          nome: request.body.nome,
          clienteId: link.clienteId,
          projetoId: link.projetoId,
          dataCalculo: request.body.dataCalculo,
          entradasJson: JSON.stringify(request.body.entradas),
          resultadoJson: JSON.stringify(request.body.resultado),
          unidade: request.body.unidade || null,
          metodo: request.body.metodo || null,
          observacoes: request.body.observacoes || null
        }).returning();
        await AuditLogService.log('INSERT', 'CalculoSalvo', null, rows[0], tx);
        return rows;
      });
      return reply.status(201).send(created);
    } catch (error) {
      if (error instanceof RelationshipIntegrityError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
