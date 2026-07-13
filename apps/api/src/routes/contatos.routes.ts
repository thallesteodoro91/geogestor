import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, like, or } from 'drizzle-orm';
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

export async function contatosRoutes(server: FastifyInstance) {
  // GET /api/contatos
  server.get('/', async (request, reply) => {
    const { q } = request.query as { q?: string };
    
    if (q && q.trim().length > 0) {
      const search = `%${q.trim()}%`;
      return db.select()
        .from(schema.contatos)
        .where(or(
          like(schema.contatos.nome, search),
          like(schema.contatos.empresa, search),
          like(schema.contatos.cidade, search),
          like(schema.contatos.telefone, search)
        ))
        .all();
    }

    return db.select().from(schema.contatos).all();
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
    await db.delete(schema.contatos).where(eq(schema.contatos.id, id)).run();
    return { success: true };
  });

  // POST /api/contatos/:id/converter
  server.post('/:id/converter', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Buscar dados do contato
    const contato = await db.select().from(schema.contatos).where(eq(schema.contatos.id, id)).get();
    
    if (!contato) {
      return reply.status(404).send({ error: 'Contato não encontrado' });
    }

    if (contato.status === 'convertido') {
      return reply.status(400).send({ error: 'Contato já foi convertido' });
    }

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      // 1. Atualizar status do contato
      await tx.update(schema.contatos)
        .set({
          status: 'convertido',
          updatedAt: now
        })
        .where(eq(schema.contatos.id, id))
        .run();

      // 2. Criar Cliente
      const newClienteId = crypto.randomUUID();
      await tx.insert(schema.clientes).values({
        id: newClienteId,
        nome: contato.nome,
        email: contato.email,
        telefone: contato.telefone,
        origem: contato.origem,
        anotacoes: `Cliente originado do contato/lead. Empresa: ${contato.empresa || ''} - Observações: ${contato.observacoes || ''}`,
        situacao: 'Ativo',
        createdAt: now,
        updatedAt: now
      }).run();

      // 3. Criar Oportunidade (CRM)
      const newOportunidadeId = crypto.randomUUID();
      await tx.insert(schema.oportunidades).values({
        id: newOportunidadeId,
        clienteId: newClienteId,
        titulo: `Negócio - ${contato.nome}`,
        valorEstimado: 0,
        estagio: 'Prospectado', // Estágio inicial do CRM
        ordem: 0,
        createdAt: now,
        updatedAt: now
      }).run();
    });

    return { success: true };
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
