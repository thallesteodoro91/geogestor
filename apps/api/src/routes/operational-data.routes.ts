import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import crypto from 'node:crypto';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, asc, desc, eq, isNull, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { databaseClientConfig, schema } from '@geogestor/database';
import {
  EXPENSE_CATALOG_KEY,
  ExpenseCatalogSchema,
  SERVICE_CATALOG_KEY,
  ServiceCatalogSchema,
  coerceExpenseCatalog,
  coerceServiceCatalog,
} from '@geogestor/contracts/src/auxiliary-catalogs';
import {
  PropertyPatchSchema,
  PropertyPayloadSchema,
  normalizePropertyIdentifier,
  normalizePropertyName,
  type PropertyPayload
} from '@geogestor/contracts/src/properties';
import { db, dbPath } from '../db';
import { AuditLogService } from '../services/audit.service';
import { OperationalLogService } from '../services/operational-log.service';
import { withSqliteBusyRetry } from '../services/sqlite-concurrency.service';
import { editToken, unchangedRow, nextEditTime, editConflict } from '../services/edit-concurrency.service';
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
  dataCalculo: z.string().refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, 'Informe uma data de cálculo válida.'),
  entradas: z.record(z.string(), z.unknown()),
  resultado: z.record(z.string(), z.unknown()),
  unidade: z.string().trim().max(80).nullable().optional(),
  metodo: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().trim().max(4000).nullable().optional()
}).strict();

function parseStoredCalculationJson(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    const invalid = !parsed || typeof parsed !== 'object' || Array.isArray(parsed);
    return { value: invalid ? null : parsed, invalid };
  } catch {
    return { value: null, invalid: true };
  }
}

const operationalSettingKeys = new Set([
  SERVICE_CATALOG_KEY,
  EXPENSE_CATALOG_KEY,
  'geogestor_jornada_categorias',
  'geogestor_empresa_template',
  'import_schemas',
  'geogestor_alerta_dias'
]);
const OperationalSettingsBody = z.object({
  values: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, 'Informe ao menos uma configuração.'),
  expectedValues: z.record(z.string(), z.unknown()).optional()
}).strict();

function validateOperationalSetting(key: string, value: unknown) {
  if (!operationalSettingKeys.has(key)) return `A configuração “${key}” não é reconhecida.`;
  const result = key === SERVICE_CATALOG_KEY
    ? ServiceCatalogSchema.safeParse(value)
    : key === EXPENSE_CATALOG_KEY
      ? ExpenseCatalogSchema.safeParse(value)
      : { success: true } as const;
  return result.success ? null : result.error.issues[0]?.message || 'Configuração operacional inválida.';
}

function normalizeMigratedOperationalSetting(key: string, value: unknown) {
  if (!operationalSettingKeys.has(key)) return { error: `A configuração “${key}” não é reconhecida.` } as const;
  if (key === SERVICE_CATALOG_KEY) {
    const catalog = coerceServiceCatalog(value);
    return catalog ? { value: catalog } as const : { error: 'Catálogo de serviços legado inválido.' } as const;
  }
  if (key === EXPENSE_CATALOG_KEY) {
    const catalog = coerceExpenseCatalog(value);
    return catalog ? { value: catalog } as const : { error: 'Catálogo de despesas legado inválido.' } as const;
  }
  return { value } as const;
}

function normalizedPropertyFields(payload: PropertyPayload) {
  return {
    nomeNormalizado: normalizePropertyName(payload.nome),
    matriculaNormalizada: normalizePropertyIdentifier(payload.matricula) || null,
    carNormalizado: normalizePropertyIdentifier(payload.car) || null,
    ccirNormalizado: normalizePropertyIdentifier(payload.ccir) || null,
    itrNormalizado: normalizePropertyIdentifier(payload.itr) || null
  };
}

function propertyPayloadFromRow(property: typeof schema.propriedades.$inferSelect): PropertyPayload {
  return {
    clienteId: property.clienteId,
    nome: property.nome,
    areaHa: property.areaHa,
    matricula: property.matricula,
    car: property.car,
    ccir: property.ccir,
    itr: property.itr,
    cidade: property.cidade,
    municipio: property.municipio || '',
    uf: property.uf || '',
    situacaoImovel: property.situacaoImovel,
    latitude: property.latitude,
    longitude: property.longitude,
    observacoes: property.observacoes
  };
}

function isPropertyUniquenessConflict(error: unknown) {
  const message = error instanceof Error
    ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`
    : String(error);
  return /uq_propriedades_active_|UNIQUE constraint failed: propriedades\./i.test(message);
}

const searchablePropertyText = sql<string>`lower(
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    coalesce(${schema.propriedades.nome}, '') || ' ' || coalesce(${schema.propriedades.matricula}, '') || ' ' ||
    coalesce(${schema.propriedades.car}, '') || ' ' || coalesce(${schema.propriedades.municipio}, ''),
    'á', 'a'), 'à', 'a'), 'â', 'a'), 'ã', 'a'), 'é', 'e'), 'ê', 'e'), 'í', 'i'),
    'ó', 'o'), 'ô', 'o'), 'õ', 'o')
)`;
const searchablePropertyTextNormalized = sql<string>`replace(replace(replace(
  ${searchablePropertyText}, 'ú', 'u'), 'ü', 'u'), 'ç', 'c')`;

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
    db.select({ id: schema.projetos.id }).from(schema.projetos).where(and(eq(schema.projetos.propriedadeId, propertyId), isNull(schema.projetos.deletedAt))).limit(1),
    db.select({ id: schema.orcamentos.id }).from(schema.orcamentos).where(and(eq(schema.orcamentos.propriedadeId, propertyId), isNull(schema.orcamentos.deletedAt))).limit(1),
    db.select({ id: schema.ambiental.id }).from(schema.ambiental).where(and(eq(schema.ambiental.propriedadeId, propertyId), isNull(schema.ambiental.deletedAt))).limit(1),
    db.select({ id: schema.pericias.id }).from(schema.pericias).where(and(eq(schema.pericias.propriedadeId, propertyId), isNull(schema.pericias.deletedAt))).limit(1)
  ]);
  return [
    project.length > 0 ? 'projeto' : null,
    budget.length > 0 ? 'orçamento' : null,
    environmental.length > 0 ? 'demanda ambiental' : null,
    assessment.length > 0 ? 'perícia' : null
  ].filter((value): value is string => Boolean(value));
}

function propertyLinkMessage(links: string[], action: 'trocar de cliente' | 'ser excluída') {
  return `A propriedade não pode ${action} enquanto estiver vinculada a ${links.join(', ')}.`;
}

export async function operationalDataRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/propriedades', {
    schema: { querystring: z.object({
      clienteId: z.string().uuid().optional(),
      q: z.string().trim().max(200).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }).strict() }
  }, async (request) => {
    const filters = [isNull(schema.propriedades.deletedAt)];
    if (request.query.clienteId) filters.push(eq(schema.propriedades.clienteId, request.query.clienteId));
    if (request.query.q) {
      const term = `%${normalizePropertyName(request.query.q)}%`;
      filters.push(like(searchablePropertyTextNormalized, term));
    }
    const where = and(...filters);
    const [items, [count]] = await Promise.all([
      db.select({ property: schema.propriedades, clienteNome: schema.clientes.nome })
        .from(schema.propriedades)
        .leftJoin(schema.clientes, eq(schema.propriedades.clienteId, schema.clientes.id))
        .where(where)
        .orderBy(asc(schema.propriedades.nome), asc(schema.propriedades.id))
        .limit(request.query.limit)
        .offset((request.query.page - 1) * request.query.limit),
      db.select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` }).from(schema.propriedades).where(where)
    ]);
    return {
      items: items.map((item) => ({ ...item.property, clienteNome: item.clienteNome, editToken: editToken(item.property) })),
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
    }).strict() }
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
      q ? like(searchablePropertyTextNormalized, `%${normalizePropertyName(q)}%`) : undefined
    )).orderBy(asc(schema.propriedades.nome), asc(schema.propriedades.id)).limit(limit);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      const [selected] = await db.select(selection).from(schema.propriedades)
        .where(and(eq(schema.propriedades.id, selectedId), isNull(schema.propriedades.deletedAt))).limit(1);
      if (selected) return [selected, ...items].slice(0, limit);
    }
    return items;
  });

  zServer.get('/propriedades/:id', {
    schema: { params: z.object({ id: z.string().uuid() }).strict() }
  }, async (request, reply) => {
    const [item] = await db.select({ property: schema.propriedades, clienteNome: schema.clientes.nome })
      .from(schema.propriedades)
      .leftJoin(schema.clientes, eq(schema.propriedades.clienteId, schema.clientes.id))
      .where(and(eq(schema.propriedades.id, request.params.id), isNull(schema.propriedades.deletedAt)))
      .limit(1);
    if (!item) return reply.status(404).send({ error: 'Propriedade não encontrada.' });
    return { ...item.property, clienteNome: item.clienteNome, editToken: editToken(item.property) };
  });

  zServer.post('/propriedades', { schema: { body: PropertyPayloadSchema } }, async (request, reply) => {
    const propertyId = crypto.randomUUID();
    return withSqliteBusyRetry(async () => {
      const [alreadyCreated] = await db.select().from(schema.propriedades)
        .where(eq(schema.propriedades.id, propertyId)).limit(1);
      if (alreadyCreated) return reply.status(201).send({ ...alreadyCreated, editToken: editToken(alreadyCreated) });
      await assertActiveClient(request.body.clienteId);
      const duplicate = await findPropertyDuplicate(request.body);
      if (duplicate) return reply.status(409).send({ error: duplicate });
      try {
        const [created] = await db.transaction(async (tx) => {
          const rows = await tx.insert(schema.propriedades).values({
            id: propertyId,
            ...request.body,
            ...normalizedPropertyFields(request.body)
          }).returning();
          await AuditLogService.log('INSERT', 'Propriedade', null, rows[0], tx);
          return rows;
        });
        return reply.status(201).send({ ...created, editToken: editToken(created) });
      } catch (error) {
        if (isPropertyUniquenessConflict(error)) return reply.status(409).send({ error: 'Já existe uma propriedade com o mesmo nome ou identificador.' });
        throw error;
      }
    });
  });

  zServer.patch('/propriedades/:id', {
    schema: { params: z.object({ id: z.string().uuid() }), body: PropertyPatchSchema }
  }, async (request, reply) => {
    return withSqliteBusyRetry(async () => {
      const [current] = await db.select().from(schema.propriedades).where(and(
        eq(schema.propriedades.id, request.params.id), isNull(schema.propriedades.deletedAt)
      )).limit(1);
      if (!current) return reply.status(request.headers['if-match'] ? 409 : 404).send(editConflict);
      if (request.headers['if-match'] !== editToken(current)) return reply.status(409).send(editConflict);
      const parsed = PropertyPayloadSchema.safeParse({ ...propertyPayloadFromRow(current), ...request.body });
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Revise os dados da propriedade.' });
      const nextProperty = parsed.data;
      const targetClientId = nextProperty.clienteId;
      await assertActiveClient(nextProperty.clienteId);
      if (targetClientId !== current.clienteId) {
        const links = await propertyHasLinks(current.id);
        if (links.length) return reply.status(409).send({ error: propertyLinkMessage(links, 'trocar de cliente') });
      }
      const duplicate = await findPropertyDuplicate(nextProperty, current.id);
      if (duplicate) return reply.status(409).send({ error: duplicate });
      try {
        const [updated] = await db.transaction(async (tx) => {
          const rows = await tx.update(schema.propriedades).set({
            ...nextProperty,
            ...normalizedPropertyFields(nextProperty),
            updatedAt: nextEditTime(current.updatedAt)
          }).where(unchangedRow(schema.propriedades, current)).returning();
          if (!rows[0]) return [];
          await AuditLogService.log('UPDATE', 'Propriedade', current, rows[0], tx);
          return rows;
        });
        if (!updated) return reply.status(409).send(editConflict);
        return { ...updated, editToken: editToken(updated) };
      } catch (error) {
        if (isPropertyUniquenessConflict(error)) return reply.status(409).send({ error: 'Já existe uma propriedade com o mesmo nome ou identificador.' });
        throw error;
      }
    });
  });

  zServer.delete('/propriedades/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) }
  }, async (request, reply) => {
    return withSqliteBusyRetry(async () => {
      const [current] = await db.select().from(schema.propriedades).where(and(
        eq(schema.propriedades.id, request.params.id), isNull(schema.propriedades.deletedAt)
      )).limit(1);
      if (!current) return reply.status(request.headers['if-match'] ? 409 : 404).send(editConflict);
      if (request.headers['if-match'] !== editToken(current)) return reply.status(409).send(editConflict);
      const links = await propertyHasLinks(request.params.id);
      if (links.length) return reply.status(409).send({ error: propertyLinkMessage(links, 'ser excluída') });
      const deleted = await db.transaction(async (tx) => {
        const rows = await tx.update(schema.propriedades).set({ deletedAt: new Date().toISOString(), updatedAt: nextEditTime(current.updatedAt) })
          .where(unchangedRow(schema.propriedades, current)).returning();
        if (!rows.length) return false;
        await AuditLogService.log('DELETE (SOFT)', 'Propriedade', current, null, tx);
        return true;
      });
      if (!deleted) return reply.status(409).send(editConflict);
      return reply.status(204).send();
    });
  });

  zServer.get('/configuracoes-operacionais', async () => {
    const rows = await db.select().from(schema.configuracoesOperacionais)
      .where(isNull(schema.configuracoesOperacionais.deletedAt));
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.chave] = JSON.parse(row.valorJson);
      } catch {
        await OperationalLogService.warn('operational-setting-corrupt', { key: row.chave });
      }
    }
    return settings;
  });

  zServer.put('/configuracoes-operacionais', {
    schema: { body: OperationalSettingsBody }
  }, async (request, reply) => {
    for (const [key, value] of Object.entries(request.body.values)) {
      const validationError = validateOperationalSetting(key, value);
      if (validationError) return reply.status(400).send({ error: validationError });
    }
    const timestamp = new Date().toISOString();
    try { await withSqliteBusyRetry(async () => {
      const client = createClient(databaseClientConfig(dbPath));
      try {
        await client.execute('PRAGMA foreign_keys = ON;');
        await client.execute('PRAGMA busy_timeout = 5000;');
        const transactionDb = drizzle(client, { schema });
        await transactionDb.transaction(async (tx) => {
          for (const [key, value] of Object.entries(request.body.values)) {
            const [current] = await tx.select().from(schema.configuracoesOperacionais).where(eq(schema.configuracoesOperacionais.chave, key)).limit(1);
            const expected = request.body.expectedValues;
            if (expected && (!(key in expected) || JSON.stringify(expected[key]) !== (current && !current.deletedAt ? current.valorJson : 'null'))) {
              throw new Error('EDIT_CONFLICT');
            }
            if (!expected && current && !current.deletedAt && (key === SERVICE_CATALOG_KEY || key === EXPENSE_CATALOG_KEY)) throw new Error('EDIT_CONFLICT');
            const rows = await tx.insert(schema.configuracoesOperacionais).values({
              id: crypto.randomUUID(),
              chave: key,
              valorJson: JSON.stringify(value),
              origem: 'aplicacao',
              updatedAt: timestamp
            }).onConflictDoUpdate({
              target: schema.configuracoesOperacionais.chave,
              set: { valorJson: JSON.stringify(value), origem: 'aplicacao', updatedAt: timestamp, deletedAt: null },
              setWhere: current ? unchangedRow(schema.configuracoesOperacionais, current) : sql`0`
            }).returning();
            if (!rows.length) throw new Error('EDIT_CONFLICT');
          }
        });
      } finally {
        client.close();
      }
    }); } catch (error) {
      if (error instanceof Error && error.message === 'EDIT_CONFLICT') return reply.status(409).send(editConflict);
      throw error;
    }
    return { updated: Object.keys(request.body.values), updatedAt: timestamp };
  });

  zServer.put('/configuracoes-operacionais/migrar', {
    schema: { body: OperationalSettingsBody }
  }, async (request, reply) => {
    const normalizedValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request.body.values)) {
      const normalized = normalizeMigratedOperationalSetting(key, value);
      if ('error' in normalized) return reply.status(400).send({ error: normalized.error });
      normalizedValues[key] = normalized.value;
    }
    const timestamp = new Date().toISOString();
    const migrated: string[] = [];
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(normalizedValues)) {
        const inserted = await tx.insert(schema.configuracoesOperacionais).values({
          id: crypto.randomUUID(),
          chave: key,
          valorJson: JSON.stringify(value),
          origem: 'localStorage',
          migradoEm: timestamp,
          updatedAt: timestamp
        }).onConflictDoNothing({ target: schema.configuracoesOperacionais.chave }).returning({ chave: schema.configuracoesOperacionais.chave });
        if (inserted.length) migrated.push(key);
      }
    });
    return { migrated, migratedAt: timestamp };
  });

  zServer.get('/calculos', {
    schema: { querystring: z.object({ tipo: z.enum(['topografico', 'ambiental']).optional() }).strict() }
  }, async (request) => {
    const rows = await db.select().from(schema.calculosSalvos).where(and(
      isNull(schema.calculosSalvos.deletedAt),
      request.query.tipo ? eq(schema.calculosSalvos.tipo, request.query.tipo) : undefined
    )).orderBy(desc(schema.calculosSalvos.dataCalculo), desc(schema.calculosSalvos.createdAt), desc(schema.calculosSalvos.id));
    return rows.map((row) => {
      const inputs = parseStoredCalculationJson(row.entradasJson);
      const result = parseStoredCalculationJson(row.resultadoJson);
      return {
        ...row,
        entradas: inputs.value,
        resultado: result.value,
        dadosInvalidos: inputs.invalid || result.invalid
      };
    });
  });

  zServer.post('/calculos', { schema: { body: CalculationPayload } }, async (request, reply) => {
    try {
      const link = await resolveClientProjectLink(request.body);
      if (request.body.tipo === 'ambiental' && link.projetoId) {
        const [project] = await db.select({ tipo: schema.projetos.tipo }).from(schema.projetos)
          .where(and(eq(schema.projetos.id, link.projetoId), isNull(schema.projetos.deletedAt)))
          .limit(1);
        if (!project || !['Ambiental', 'Licenciamento'].includes(project.tipo || '')) {
          throw new RelationshipIntegrityError('Selecione um projeto ambiental ou de licenciamento para este cálculo.', 409);
        }
      }
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
