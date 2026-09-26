import type { FastifyInstance } from 'fastify';
import type { FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, and, gte, lte, asc, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';
import { AuditLogService } from '../services/audit.service';
import { RelationshipIntegrityError, resolveClientProjectLink } from '../services/relationship-integrity.service';

const APPOINTMENT_TYPES = [
  'Visita de Campo', 'Reunião', 'Ligação', 'Administrativo', 'Serviço', 'Entrega', 'Outro'
] as const;

const isRealDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const dateKey = z.string().refine(isRealDateKey, 'Informe uma data real no formato AAAA-MM-DD.');
const timeKey = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Informe a hora no formato HH:MM.');
const nullableId = z.string().uuid().nullable().optional();

const AppointmentPayloadSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título.').max(180),
  descricao: z.string().trim().max(4_000).nullable().optional(),
  data: dateKey,
  hora: timeKey.nullable().optional(),
  tipo: z.enum(APPOINTMENT_TYPES).default('Visita de Campo'),
  clienteId: nullableId,
  projetoId: nullableId
}).strict();

const AppointmentPatchSchema = AppointmentPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Informe ao menos um campo para atualizar.'
);

const AppointmentQuerySchema = z.object({
  clienteId: z.string().uuid().optional(),
  projetoId: z.string().uuid().optional(),
  inicio: dateKey.optional(),
  fim: dateKey.optional()
}).strict().superRefine((value, context) => {
  if (value.inicio && value.fim && value.fim < value.inicio) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fim'], message: 'A data final deve ser igual ou posterior à inicial.' });
  }
});

const activeProjectJoin = and(
  eq(schema.compromissos.projetoId, schema.projetos.id),
  isNull(schema.projetos.deletedAt)
);
const effectiveClientId = sql<string | null>`coalesce(${schema.projetos.clienteId}, ${schema.compromissos.clienteId})`;
const activeClientJoin = and(eq(effectiveClientId, schema.clientes.id), isNull(schema.clientes.deletedAt));

const appointmentSelection = {
  id: schema.compromissos.id,
  titulo: schema.compromissos.titulo,
  descricao: schema.compromissos.descricao,
  data: schema.compromissos.data,
  hora: schema.compromissos.hora,
  tipo: schema.compromissos.tipo,
  clienteId: effectiveClientId,
  projetoId: schema.compromissos.projetoId,
  projetoNome: schema.projetos.nome,
  clienteNome: schema.clientes.nome,
  googleEventId: schema.compromissos.googleEventId,
  ultimoSyncGoogle: schema.compromissos.ultimoSyncGoogle,
  createdAt: schema.compromissos.createdAt,
  updatedAt: schema.compromissos.updatedAt
};

function relationshipError(reply: FastifyReply, error: unknown) {
  if (error instanceof RelationshipIntegrityError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }
  throw error;
}

export async function compromissosRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  zServer.get('/', { schema: { querystring: AppointmentQuerySchema } }, async (request) => {
    const { clienteId, projetoId, inicio, fim } = request.query;
    return db.select(appointmentSelection)
      .from(schema.compromissos)
      .leftJoin(schema.projetos, activeProjectJoin)
      .leftJoin(schema.clientes, activeClientJoin)
      .where(and(
        isNull(schema.compromissos.deletedAt),
        projetoId ? eq(schema.compromissos.projetoId, projetoId) : undefined,
        clienteId ? eq(effectiveClientId, clienteId) : undefined,
        inicio ? gte(schema.compromissos.data, inicio) : undefined,
        fim ? lte(schema.compromissos.data, fim) : undefined
      ))
      .orderBy(
        asc(schema.compromissos.data),
        sql`case when ${schema.compromissos.hora} is null then 1 else 0 end`,
        asc(schema.compromissos.hora),
        asc(schema.compromissos.id)
      );
  });

  zServer.get('/:id', { schema: { params: z.object({ id: z.string().uuid() }).strict() } }, async (request, reply) => {
    const [appointment] = await db.select(appointmentSelection)
      .from(schema.compromissos)
      .leftJoin(schema.projetos, activeProjectJoin)
      .leftJoin(schema.clientes, activeClientJoin)
      .where(and(eq(schema.compromissos.id, request.params.id), isNull(schema.compromissos.deletedAt)))
      .limit(1);
    if (!appointment) return reply.status(404).send({ error: 'Compromisso não encontrado.' });
    return appointment;
  });

  zServer.post('/', { schema: { body: AppointmentPayloadSchema } }, async (request, reply) => {
    let link;
    try {
      link = await resolveClientProjectLink({ clienteId: request.body.clienteId, projetoId: request.body.projetoId });
    } catch (error) {
      return relationshipError(reply, error);
    }
    const appointment = await db.transaction(async (tx) => {
      const [created] = await tx.insert(schema.compromissos).values({
        id: crypto.randomUUID(),
        titulo: request.body.titulo,
        descricao: request.body.descricao || '',
        data: request.body.data,
        hora: request.body.hora || null,
        tipo: request.body.tipo,
        clienteId: link.clienteId,
        projetoId: link.projetoId
      }).returning();
      await AuditLogService.log('INSERT', 'Compromisso', null, created, tx);
      if (created.clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: created.clienteId,
          projetoId: created.projetoId || null,
          tipo: 'Agenda',
          titulo: `Compromisso criado: ${created.titulo}`,
          categoria: created.tipo,
          descricao: [`Data: ${created.data}`, `Tipo: ${created.tipo}`, created.descricao || null].filter(Boolean).join('\n')
        }, tx);
      }
      return created;
    });
    return reply.send(appointment);
  });

  zServer.patch('/:id', {
    schema: { params: z.object({ id: z.string().uuid() }).strict(), body: AppointmentPatchSchema }
  }, async (request, reply) => {
    const [before] = await db.select().from(schema.compromissos)
      .where(and(eq(schema.compromissos.id, request.params.id), isNull(schema.compromissos.deletedAt))).limit(1);
    if (!before) return reply.status(404).send({ error: 'Compromisso não encontrado.' });

    const updateFields: Partial<typeof schema.compromissos.$inferInsert> = {};
    if (request.body.titulo !== undefined) updateFields.titulo = request.body.titulo;
    if (request.body.descricao !== undefined) updateFields.descricao = request.body.descricao;
    if (request.body.data !== undefined) updateFields.data = request.body.data;
    if (request.body.hora !== undefined) updateFields.hora = request.body.hora;
    if (request.body.tipo !== undefined) updateFields.tipo = request.body.tipo;
    if (request.body.projetoId !== undefined || request.body.clienteId !== undefined) {
      try {
        const link = await resolveClientProjectLink({
          projetoId: request.body.projetoId !== undefined ? request.body.projetoId : before.projetoId,
          clienteId: request.body.clienteId !== undefined ? request.body.clienteId : before.clienteId
        });
        updateFields.projetoId = link.projetoId;
        updateFields.clienteId = link.clienteId;
      } catch (error) {
        return relationshipError(reply, error);
      }
    }
    updateFields.updatedAt = new Date().toISOString();

    const changes = [
      request.body.titulo !== undefined && request.body.titulo !== before.titulo ? `Título: ${before.titulo} -> ${request.body.titulo}` : null,
      request.body.data !== undefined && request.body.data !== before.data ? `Data: ${before.data} -> ${request.body.data}` : null,
      request.body.hora !== undefined && request.body.hora !== before.hora ? `Hora: ${before.hora || 'dia inteiro'} -> ${request.body.hora || 'dia inteiro'}` : null,
      request.body.tipo !== undefined && request.body.tipo !== before.tipo ? `Tipo: ${before.tipo} -> ${request.body.tipo}` : null
    ].filter((value): value is string => Boolean(value));

    const updated = await db.transaction(async (tx) => {
      const [after] = await tx.update(schema.compromissos).set(updateFields)
        .where(and(eq(schema.compromissos.id, request.params.id), isNull(schema.compromissos.deletedAt))).returning();
      if (!after) return null;
      await AuditLogService.log('UPDATE', 'Compromisso', before, after, tx);
      if (changes.length && after.clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: after.clienteId,
          projetoId: after.projetoId || null,
          tipo: 'Agenda',
          titulo: `Compromisso atualizado: ${after.titulo}`,
          categoria: after.tipo,
          descricao: changes.join('\n')
        }, tx);
      }
      return after;
    });
    if (!updated) return reply.status(404).send({ error: 'Compromisso não encontrado.' });
    return updated;
  });

  zServer.delete('/:id', { schema: { params: z.object({ id: z.string().uuid() }).strict() } }, async (request, reply) => {
    const removed = await db.transaction(async (tx) => {
      const [source] = await tx.delete(schema.compromissos)
        .where(and(eq(schema.compromissos.id, request.params.id), isNull(schema.compromissos.deletedAt))).returning();
      if (!source) return null;
      await AuditLogService.log('DELETE', 'Compromisso', source, null, tx);
      if (source.clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: source.clienteId,
          projetoId: source.projetoId || null,
          tipo: 'Agenda',
          titulo: `Compromisso excluído: ${source.titulo}`,
          categoria: source.tipo,
          descricao: `Data: ${source.data}\nTipo: ${source.tipo}`
        }, tx);
      }
      return source;
    });
    if (!removed) return reply.status(404).send({ error: 'Compromisso não encontrado.' });
    return { success: true };
  });
}
