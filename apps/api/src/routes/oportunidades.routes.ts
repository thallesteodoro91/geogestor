import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';

type IdParams = { id: string };
type Payload = Record<string, any>;

export async function oportunidadesRoutes(server: FastifyInstance) {
  
  // Buscar todas as oportunidades (Cards do Kanban)
  server.get('/', async (request, reply) => {
    const data = await db
      .select({
        id: schema.oportunidades.id,
        clienteId: schema.oportunidades.clienteId,
        clienteNome: schema.clientes.nome,
        titulo: schema.oportunidades.titulo,
        valorEstimado: schema.oportunidades.valorEstimado,
        estagio: schema.oportunidades.estagio,
        ordem: schema.oportunidades.ordem,
        createdAt: schema.oportunidades.createdAt
      })
      .from(schema.oportunidades)
      .innerJoin(schema.clientes, eq(schema.oportunidades.clienteId, schema.clientes.id));
    return data;
  });

  // Criar nova oportunidade
  server.post('/', async (request, reply) => {
    const data = request.body as any;
    
    // Pegar a maior ordem atual para o estágio "Prospect"
    const existingInStage = await db.select().from(schema.oportunidades).where(eq(schema.oportunidades.estagio, 'Prospect'));
    const maxOrdem = existingInStage.length > 0 ? Math.max(...existingInStage.map(o => o.ordem)) : -1;

    const oportunidade = await db.insert(schema.oportunidades).values({
      id: crypto.randomUUID(),
      clienteId: data.clienteId,
      titulo: data.titulo,
      valorEstimado: data.valorEstimado || null,
      estagio: 'Prospect',
      ordem: maxOrdem + 1
    }).returning();
    
    if (oportunidade[0] && data.clienteId) {
      await JornadaService.logClienteEvento({
        clienteId: data.clienteId,
        tipo: 'Oportunidade',
        titulo: `Nova oportunidade criada: ${data.titulo}`,
        categoria: 'Comercial',
        descricao: `Estágio: Prospect | Valor estimado: R$ ${data.valorEstimado || 0}`
      });
    }

    return oportunidade[0];
  });

  // Atualizar oportunidade (Edição normal)
  server.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    const data = request.body as Payload;
    
    try {
      const oportunidadeAtualizada = await db.update(schema.oportunidades).set({
        clienteId: data.clienteId !== undefined ? data.clienteId : undefined,
        titulo: data.titulo !== undefined ? data.titulo : undefined,
        valorEstimado: data.valorEstimado !== undefined ? data.valorEstimado : undefined,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.oportunidades.id, id)).returning();

      if (!oportunidadeAtualizada.length) {
        return reply.status(404).send({ error: 'Oportunidade não encontrada' });
      }

      if (oportunidadeAtualizada[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: oportunidadeAtualizada[0].clienteId,
          tipo: 'Oportunidade',
          titulo: `Oportunidade atualizada: ${oportunidadeAtualizada[0].titulo}`,
          categoria: 'Comercial',
          descricao: `Valor estimado: R$ ${oportunidadeAtualizada[0].valorEstimado || 0}`
        });
      }

      return reply.send(oportunidadeAtualizada[0]);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar oportunidade' });
    }
  });

  // Reordenar após Drag and Drop
  server.patch('/reorder', async (request, reply) => {
    const items = request.body as { id: string, estagio: string, ordem: number }[];
    
    try {
      const oldOportunidades = await db.select().from(schema.oportunidades);
      const oldMap = new Map(oldOportunidades.map(o => [o.id, o]));

      await db.transaction(async (tx) => {
        for (const item of items) {
          await tx.update(schema.oportunidades).set({
            estagio: item.estagio,
            ordem: item.ordem,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.oportunidades.id, item.id));
        }
      });

      for (const item of items) {
        const old = oldMap.get(item.id);
        if (old && old.estagio !== item.estagio && old.clienteId) {
          await JornadaService.logClienteEvento({
            clienteId: old.clienteId,
            tipo: 'Oportunidade',
            titulo: `Oportunidade "${old.titulo}" moveu de estágio`,
            categoria: 'Comercial',
            descricao: `De: ${old.estagio} -> Para: ${item.estagio}`
          });
        }
      }

      return reply.send({ success: true });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao reordenar' });
    }
  });

  // Excluir
  server.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    try {
      const old = await db.select().from(schema.oportunidades).where(eq(schema.oportunidades.id, id));
      
      await db.delete(schema.oportunidades).where(eq(schema.oportunidades.id, id));

      if (old.length > 0 && old[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: old[0].clienteId,
          tipo: 'Oportunidade',
          titulo: `Oportunidade excluída: ${old[0].titulo}`,
          categoria: 'Comercial',
          descricao: `Estágio anterior: ${old[0].estagio}`
        });
      }

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir oportunidade' });
    }
  });
}
