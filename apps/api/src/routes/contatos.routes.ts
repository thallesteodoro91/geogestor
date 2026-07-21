import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import crypto from 'crypto';

type ContatoInput = {
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cidade?: string;
  observacoes?: string;
  origem?: string;
};

type ContatosQuery = {
  q?: string;
  status?: 'ativo' | 'convertido';
  page?: string;
  pageSize?: string;
};

const normalizeEmail = (value?: string | null) => (value || '').trim().normalize('NFKC').toLocaleLowerCase('pt-BR');

const normalizePhone = (value?: string | null) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
};

const normalizeName = (value?: string | null) => (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const knownOrigins = new Set(['Site', 'Indicação', 'Instagram', 'Google', 'WhatsApp', 'Outro']);

function conflict(message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 409;
  return error;
}

export async function contatosRoutes(server: FastifyInstance) {
  // GET /api/contatos/analytics
  server.get('/analytics', async () => {
    const rows = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${schema.contatos.status} = 'ativo' then 1 else 0 end)`,
      converted: sql<number>`sum(case when ${schema.contatos.status} = 'convertido' then 1 else 0 end)`
    }).from(schema.contatos).where(isNull(schema.contatos.deletedAt));
    const total = Number(rows[0]?.total || 0);
    const activeCount = Number(rows[0]?.active || 0);
    const convertedCount = Number(rows[0]?.converted || 0);

    return {
      total,
      activeCount,
      convertedCount,
      conversionBasisPoints: total ? Math.round(convertedCount * 10_000 / total) : 0
    };
  });

  // GET /api/contatos
  server.get('/', async (request, reply) => {
    const { q, status, page: pageParam, pageSize: pageSizeParam } = request.query as ContatosQuery;
    const search = q?.trim() ? `%${q.trim()}%` : undefined;
    const where = and(
      isNull(schema.contatos.deletedAt),
      status === 'ativo' || status === 'convertido' ? eq(schema.contatos.status, status) : undefined,
      search ? or(
        like(schema.contatos.nome, search),
        like(schema.contatos.empresa, search),
        like(schema.contatos.cidade, search),
        like(schema.contatos.telefone, search),
        like(schema.contatos.email, search)
      ) : undefined
    );
    const paginationRequested = pageParam !== undefined || pageSizeParam !== undefined;

    if (!paginationRequested) {
      return db.select()
        .from(schema.contatos)
        .where(where)
        .orderBy(desc(schema.contatos.createdAt))
        .all();
    }

    const requestedPage = Number.parseInt(pageParam || '1', 10);
    const requestedPageSize = Number.parseInt(pageSizeParam || '12', 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Number.isFinite(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 12;
    const [items, countRows] = await Promise.all([
      db.select()
        .from(schema.contatos)
        .where(where)
        .orderBy(desc(schema.contatos.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all(),
      db.select({ total: sql<number>`count(*)` }).from(schema.contatos).where(where).all()
    ]);
    const total = Number(countRows[0]?.total || 0);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  });

  // POST /api/contatos
  server.post('/', async (request, reply) => {
    const body = request.body as ContatoInput;

    if (!body || !body.nome) {
      return reply.status(400).send({ error: 'Nome é obrigatório' });
    }

    const now = new Date().toISOString();
    const newContato = {
      id: crypto.randomUUID(),
      nome: body.nome,
      email: body.email || null,
      telefone: body.telefone || null,
      empresa: body.empresa || null,
      cidade: body.cidade || null,
      observacoes: body.observacoes || null,
      origem: body.origem || null,
      status: 'ativo',
      createdAt: now,
      updatedAt: now
    };

    await db.insert(schema.contatos).values(newContato).run();
    return newContato;
  });

  // PUT /api/contatos/:id
  server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;

    const { nome, email, telefone, empresa, cidade, observacoes, origem, status, dataCadastro } = body;
    
    const updateData: any = {
      nome,
      email,
      telefone,
      empresa,
      cidade,
      observacoes,
      origem,
      status,
      updatedAt: new Date().toISOString()
    };
    
    if (dataCadastro) {
      updateData.createdAt = new Date(dataCadastro).toISOString();
    }
    
    // Remover campos undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    await db.update(schema.contatos)
      .set(updateData)
      .where(eq(schema.contatos.id, id))
      .run();

    return { success: true };
  });

  // DELETE /api/contatos/:id
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const linkedOpportunity = await db.select({ id: schema.oportunidades.id })
      .from(schema.oportunidades)
      .where(and(
        eq(schema.oportunidades.leadId, id),
        isNull(schema.oportunidades.deletedAt)
      ))
      .limit(1)
      .get();

    if (linkedOpportunity) {
      return reply.status(409).send({
        error: 'Este lead possui oportunidades comerciais ativas. Converta o lead, reassocie as oportunidades a outro cliente ou exclua corretamente as oportunidades antes de excluir o lead.'
      });
    }

    await db.update(schema.contatos)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(schema.contatos.id, id))
      .run();
    return { success: true };
  });

  // POST /api/contatos/:id/converter
  server.post('/:id/converter', async (request, reply) => {
    const { id } = request.params as { id: string };
    const initialContato = await db.select().from(schema.contatos).where(and(
      eq(schema.contatos.id, id),
      isNull(schema.contatos.deletedAt)
    )).get();
    
    if (!initialContato) {
      return reply.status(404).send({ error: 'Lead não encontrado' });
    }

    const now = new Date().toISOString();
    try {
      const result = await db.transaction(async (tx) => {
        const contato = await tx.select().from(schema.contatos).where(and(
          eq(schema.contatos.id, id),
          isNull(schema.contatos.deletedAt)
        )).get();
        if (!contato) throw conflict('Este lead não está mais disponível para conversão. Atualize a lista e tente novamente.');

        const linkedOpportunities = await tx.select({
          id: schema.oportunidades.id,
          clienteId: schema.oportunidades.clienteId,
          deletedAt: schema.oportunidades.deletedAt
        }).from(schema.oportunidades).where(eq(schema.oportunidades.leadId, id));
        const activeOpportunities = linkedOpportunities.filter((item) => !item.deletedAt);

        const findClient = async (clientId: string) => tx.select({
          id: schema.clientes.id,
          deletedAt: schema.clientes.deletedAt
        }).from(schema.clientes).where(eq(schema.clientes.id, clientId)).limit(1).get();

        let clientId: string | null = null;
        let matchCriterion = 'novo_cliente';
        let clientCreated = false;

        if (contato.clienteConvertidoId) {
          const linkedClient = await findClient(contato.clienteConvertidoId);
          if (!linkedClient || linkedClient.deletedAt) {
            throw conflict('O cliente anteriormente vinculado a este lead não está disponível. Restaure o cliente antes de repetir a conversão.');
          }
          clientId = linkedClient.id;
          matchCriterion = 'vinculo_persistido';
        }

        if (!clientId) {
          const opportunityClientId = activeOpportunities.find((item) => item.clienteId)?.clienteId;
          if (opportunityClientId) {
            const opportunityClient = await findClient(opportunityClientId);
            if (opportunityClient && !opportunityClient.deletedAt) {
              clientId = opportunityClient.id;
              matchCriterion = 'oportunidade_existente';
            }
          }
        }

        const normalizedEmail = normalizeEmail(contato.email);
        if (!clientId && normalizedEmail) {
          const matches = await tx.select({ id: schema.clientes.id })
            .from(schema.clientes)
            .where(and(
              isNull(schema.clientes.deletedAt),
              sql`lower(trim(${schema.clientes.email})) = ${normalizedEmail}`
            ))
            .limit(2);
          if (matches.length === 1) {
            clientId = matches[0].id;
            matchCriterion = 'email_normalizado';
          } else if (matches.length > 1) {
            throw conflict('Mais de um cliente possui o mesmo e-mail deste lead. Revise os cadastros duplicados antes de converter.');
          }
        }

        const normalizedPhone = normalizePhone(contato.telefone);
        if (normalizedPhone && (!clientId || matchCriterion === 'email_normalizado')) {
          const phoneWithCountryCode = `55${normalizedPhone}`;
          const normalizedTelephone = sql<string>`replace(replace(replace(replace(replace(replace(${schema.clientes.telefone}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '')`;
          const normalizedMobile = sql<string>`replace(replace(replace(replace(replace(replace(${schema.clientes.celular}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '')`;
          const matches = await tx.select({ id: schema.clientes.id })
            .from(schema.clientes)
            .where(and(
              isNull(schema.clientes.deletedAt),
              or(
                sql`${normalizedTelephone} in (${normalizedPhone}, ${phoneWithCountryCode})`,
                sql`${normalizedMobile} in (${normalizedPhone}, ${phoneWithCountryCode})`
              )
            ))
            .limit(2);
          if (matches.length === 1) {
            if (clientId && clientId !== matches[0].id) {
              throw conflict('O e-mail e o telefone deste lead correspondem a clientes diferentes. Corrija os dados antes de converter.');
            }
            if (!clientId) {
              clientId = matches[0].id;
              matchCriterion = 'telefone_normalizado';
            }
          } else if (matches.length > 1) {
            throw conflict('Mais de um cliente possui o mesmo telefone deste lead. Revise os cadastros duplicados antes de converter.');
          }
        }

        if (!clientId && !normalizedEmail && !normalizedPhone) {
          const normalizedLeadName = normalizeName(contato.nome);
          const matches = await tx.select({ id: schema.clientes.id })
            .from(schema.clientes)
            .where(and(
              isNull(schema.clientes.deletedAt),
              sql`lower(trim(${schema.clientes.nome})) = ${normalizedLeadName}`
            ))
            .limit(2);
          if (matches.length === 1) {
            clientId = matches[0].id;
            matchCriterion = 'nome_exato_unico';
          } else if (matches.length > 1) {
            throw conflict('Há mais de um cliente com o mesmo nome deste lead. Informe e-mail ou telefone para realizar uma conversão segura.');
          }
        }

        if (!clientId) {
          clientId = crypto.randomUUID();
          clientCreated = true;
          const notes = [
            'Cliente originado da conversão de lead.',
            contato.empresa ? `Empresa/organização informada no lead: ${contato.empresa}` : null,
            contato.observacoes ? `Histórico do lead: ${contato.observacoes}` : null
          ].filter(Boolean).join('\n');
          const mainOrigin = contato.origem && knownOrigins.has(contato.origem) ? contato.origem : contato.origem ? 'Outro' : null;
          await tx.insert(schema.clientes).values({
            id: clientId,
            nome: contato.nome,
            email: contato.email,
            telefone: contato.telefone,
            municipio: contato.cidade,
            origem: contato.origem,
            origemPrincipal: mainOrigin,
            origemDetalhe: mainOrigin === 'Outro' ? contato.origem : null,
            anotacoes: notes || null,
            situacao: 'Ativo',
            createdAt: now,
            updatedAt: now
          }).run();
        }

        await tx.update(schema.contatos)
          .set({
            status: 'convertido',
            clienteConvertidoId: clientId,
            convertidoEm: contato.convertidoEm || now,
            updatedAt: now
          })
          .where(eq(schema.contatos.id, id))
          .run();

        let opportunityId = activeOpportunities[0]?.id || null;
        let opportunityCreated = false;
        if (activeOpportunities.length) {
          await tx.update(schema.oportunidades)
            .set({ clienteId: clientId, updatedAt: now })
            .where(and(eq(schema.oportunidades.leadId, id), isNull(schema.oportunidades.deletedAt)))
            .run();
        } else if (contato.status === 'convertido' && linkedOpportunities.length) {
          opportunityId = linkedOpportunities[0].id;
        } else {
          opportunityId = crypto.randomUUID();
          opportunityCreated = true;
          const orderRows = await tx.select({
            value: sql<number>`coalesce(max(${schema.oportunidades.ordem}), -1)`
          }).from(schema.oportunidades).where(and(
            eq(schema.oportunidades.estagio, 'Prospectado'),
            isNull(schema.oportunidades.deletedAt)
          ));
          await tx.insert(schema.oportunidades).values({
            id: opportunityId,
            clienteId: clientId,
            leadId: id,
            titulo: `Negócio - ${contato.nome}`,
            valorEstimado: 0,
            estagio: 'Prospectado',
            ordem: Number(orderRows[0]?.value ?? -1) + 1,
            origem: contato.origem,
            probabilidadePontosBase: 1_000,
            estagioAlteradoEm: now,
            createdAt: now,
            updatedAt: now
          }).run();
          await tx.insert(schema.oportunidadeEstagiosHistorico).values({
            id: crypto.randomUUID(),
            oportunidadeId: opportunityId,
            estagioAnterior: null,
            estagioNovo: 'Prospectado',
            motivo: 'Conversão de lead em cliente',
            usuarioId: 'admin',
            createdAt: now
          }).run();
        }

        await tx.insert(schema.auditLogs).values({
          id: crypto.randomUUID(),
          action: 'UPDATE',
          entity: 'LeadConversion',
          userId: 'admin',
          oldData: JSON.stringify({ leadId: id, status: contato.status, clientId: contato.clienteConvertidoId || null }),
          newData: JSON.stringify({ leadId: id, clientId, opportunityId, clientCreated, opportunityCreated, matchCriterion }),
          createdAt: now
        }).run();

        return {
          clientId,
          opportunityId,
          clientCreated,
          opportunityCreated,
          matchCriterion,
          idempotent: contato.status === 'convertido'
        };
      });

      return { success: true, ...result };
    } catch (error) {
      const statusCode = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
      if (statusCode === 409) return reply.status(409).send({ error: error instanceof Error ? error.message : 'Conflito na conversão do lead.' });
      throw error;
    }
  });

  // POST /api/contatos/lote
  server.post('/lote', async (request: FastifyRequest, reply: FastifyReply) => {
    const items = request.body as ContatoInput[];
    if (!Array.isArray(items)) {
      return reply.status(400).send({ error: 'Payload deve ser uma lista de contatos' });
    }

    try {
      await db.transaction(async (tx) => {
        for (const item of items) {
          if (!item.nome) continue;
          const now = new Date().toISOString();
          await tx.insert(schema.contatos).values({
            id: crypto.randomUUID(),
            nome: item.nome,
            email: item.email || null,
            telefone: item.telefone || null,
            empresa: item.empresa || null,
            cidade: item.cidade || null,
            observacoes: item.observacoes || null,
            origem: item.origem || null,
            status: 'ativo',
            createdAt: now,
            updatedAt: now
          }).run();
        }
      });
      return { success: true, importedCount: items.length };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao importar contatos em lote' });
    }
  });
}
