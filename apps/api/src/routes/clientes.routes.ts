import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, isNull, desc, count, sum, not, inArray, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ClientePayloadSchema } from '@geogestor/contracts';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FileSystemService } from '../services/fs.service';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';

type IdParams = { id: string };
type HistoricoParams = { id: string; historicoId: string };
type Payload = Record<string, any>;

const labelValue = (value: any) => {
  if (value === null || value === undefined || value === '') return 'não informado';
  return String(value);
};

const buildClienteChanges = (oldCliente: any, data: any) => {
  const fields: Array<[string, string]> = [
    ['nome', 'Nome'],
    ['email', 'E-mail'],
    ['telefone', 'Telefone'],
    ['celular', 'Celular'],
    ['cpf', 'CPF'],
    ['cnpj', 'CNPJ'],
    ['endereco', 'Endereço'],
    ['numero', 'Número'],
    ['bairro', 'Bairro'],
    ['origem', 'Origem'],
    ['categoria', 'Categoria'],
    ['situacao', 'Situação'],
    ['previsaoEntrega', 'Previsão de Entrega'],
    ['servicos', 'Serviços']
  ];

  return fields.flatMap(([field, label]) => {
    if (data[field] === undefined || data[field] === oldCliente[field]) return [];
    return `${label}: ${labelValue(oldCliente[field])} -> ${labelValue(data[field])}`;
  });
};

export async function clientesRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();

  // Listar todos os clientes
  zServer.get('/', {
    schema: {
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(500).default(100)
      })
    }
  }, async (request, reply) => {
    const { page, limit } = request.query;
    try {
      const offset = (page - 1) * limit;
      const clientesList = await db.select().from(schema.clientes)
        .where(isNull(schema.clientes.deletedAt))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(schema.clientes.createdAt));
      return clientesList;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar clientes' });
    }
  });

  // Obter um cliente específico
  zServer.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      const cliente = await db.select().from(schema.clientes)
        .where(eq(schema.clientes.id, id))
        .limit(1);
      if (!cliente.length) {
        return reply.status(404).send({ error: 'Cliente não encontrado' });
      }
      return cliente[0];
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar cliente' });
    }
  });

  // Obter dashboard de um cliente (cliente + KPIs rápidos)
  zServer.get('/:id/dashboard', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      // 1. Dados do cliente
      const clienteRes = await db.select().from(schema.clientes)
        .where(eq(schema.clientes.id, id))
        .limit(1);
        
      if (!clienteRes.length) {
        return reply.status(404).send({ error: 'Cliente não encontrado' });
      }

      // 2. Agregações rápidas (KPIs) com Promise.all para paralelizar consultas no banco
      const [
        totalProjetos,
        totalTarefasPendentes,
        totalOrcamentos,
        totalDespesas,
        totalDocumentos
      ] = await Promise.all([
        db.select({ value: count() }).from(schema.projetos).where(eq(schema.projetos.clienteId, id)),
        db.select({ value: count() }).from(schema.tarefas).where(
          sql`${schema.tarefas.clienteId} = ${id} AND ${schema.tarefas.status} != 'Concluído' AND ${schema.tarefas.status} != 'Concluido'`
        ),
        db.select({ valor: sum(schema.orcamentos.valorTotal), count: count() }).from(schema.orcamentos).where(eq(schema.orcamentos.clienteId, id)),
        db.select({ valor: sum(schema.despesas.valor) }).from(schema.despesas).where(eq(schema.despesas.clienteId, id)),
        db.select({ value: count() }).from(schema.documentos).where(eq(schema.documentos.clienteId, id))
      ]);

      const kpis = {
        projetos: totalProjetos[0]?.value || 0,
        tarefasPendentes: totalTarefasPendentes[0]?.value || 0,
        orcamentosQtd: totalOrcamentos[0]?.count || 0,
        orcamentosValor: totalOrcamentos[0]?.valor || 0,
        despesasValor: totalDespesas[0]?.valor || 0,
        documentos: totalDocumentos[0]?.value || 0
      };

      return {
        cliente: clienteRes[0],
        kpis
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar dashboard do cliente' });
    }
  });

  // Criar novo cliente
  zServer.post('/', {
    schema: {
      body: ClientePayloadSchema
    }
  }, async (request, reply) => {
    const data = request.body;
    try {
      const novoCliente = await db.transaction(async (tx) => {
        // 1. Criar no banco de dados
        const result = await tx.insert(schema.clientes).values({
          id: crypto.randomUUID(),
          nome: data.nome,
          documento: data.documento || null,
          email: data.email || null,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          numero: data.numero || null,
          bairro: data.bairro || null,
          celular: data.celular || null,
          cpf: data.cpf || null,
          cnpj: data.cnpj || null,
          origem: data.origem || null,
          categoria: data.categoria || null,
          anotacoes: data.anotacoes || null,
          situacao: data.situacao || 'Ativo',
          previsaoEntrega: data.previsaoEntrega || null,
          servicos: data.servicos || null
        }).returning();
        
        // Log de Auditoria
        await AuditLogService.log('INSERT', 'Cliente', null, result[0], tx);
        await JornadaService.logClienteEvento({
          clienteId: result[0].id,
          tipo: 'Cliente',
          titulo: `Cliente criado: ${result[0].nome}`,
          categoria: result[0].categoria || 'Cadastro',
          descricao: [
            result[0].email ? `E-mail: ${result[0].email}` : null,
            result[0].telefone ? `Telefone: ${result[0].telefone}` : null,
            result[0].celular ? `Celular: ${result[0].celular}` : null,
            result[0].endereco ? `Endereço: ${result[0].endereco}` : null,
            result[0].numero ? `Número: ${result[0].numero}` : null,
            result[0].bairro ? `Bairro: ${result[0].bairro}` : null
          ].filter(Boolean).join('\n') || 'Cadastro inicial do cliente no GeoGestor.'
        }, tx);

        return result[0];
      });

      // 2. Criar a pasta do cliente no sistema
      try {
        await FileSystemService.getClientFolder(data.nome);
      } catch (fsErr) {
        server.log.error({ err: fsErr }, `Falha ao criar pasta para cliente ${data.nome}`);
      }

      return reply.status(201).send(novoCliente);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao criar cliente' });
    }
  });

  // Atualizar cliente
  zServer.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: ClientePayloadSchema.partial()
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    try {
      const oldCliente = await db.select().from(schema.clientes).where(eq(schema.clientes.id, id)).limit(1);
      if (!oldCliente.length) {
        return reply.status(404).send({ error: 'Cliente não encontrado' });
      }

      const clienteAtualizado = await db.transaction(async (tx) => {
        const result = await tx.update(schema.clientes).set({
          nome: data.nome !== undefined ? data.nome : undefined,
          documento: data.documento !== undefined ? data.documento : undefined,
          email: data.email !== undefined ? data.email : undefined,
          telefone: data.telefone !== undefined ? data.telefone : undefined,
          endereco: data.endereco !== undefined ? data.endereco : undefined,
          numero: data.numero !== undefined ? data.numero : undefined,
          bairro: data.bairro !== undefined ? data.bairro : undefined,
          celular: data.celular !== undefined ? data.celular : undefined,
          cpf: data.cpf !== undefined ? data.cpf : undefined,
          cnpj: data.cnpj !== undefined ? data.cnpj : undefined,
          origem: data.origem !== undefined ? data.origem : undefined,
          categoria: data.categoria !== undefined ? data.categoria : undefined,
          anotacoes: data.anotacoes !== undefined ? data.anotacoes : undefined,
          situacao: data.situacao !== undefined ? data.situacao : undefined,
          previsaoEntrega: data.previsaoEntrega !== undefined ? data.previsaoEntrega : undefined,
          servicos: data.servicos !== undefined ? data.servicos : undefined,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.clientes.id, id)).returning();

        // Log de Auditoria
        await AuditLogService.log('UPDATE', 'Cliente', oldCliente[0], result[0], tx);

        const changes = buildClienteChanges(oldCliente[0], data);
        if (changes.length) {
          await JornadaService.logClienteEvento({
            clienteId: id,
            tipo: 'Cliente',
            titulo: `Dados do cliente atualizados: ${result[0].nome}`,
            categoria: 'Cadastro',
            descricao: changes.join('\n')
          }, tx);
        }

        if (data.nome !== undefined && data.nome && data.nome !== oldCliente[0].nome) {
          try {
            await FileSystemService.renameClientFolder(oldCliente[0].nome, data.nome, id, tx);
          } catch (fsErr) {
            server.log.error({ err: fsErr }, `Falha ao renomear pasta do cliente ${oldCliente[0].nome}`);
          }
        }

        return result[0];
      });

      return clienteAtualizado;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar cliente' });
    }
  });

  // Excluir cliente (Soft Delete)
  zServer.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      await db.transaction(async (tx) => {
        const oldCliente = await tx.select().from(schema.clientes).where(eq(schema.clientes.id, id)).limit(1);
        if (!oldCliente.length || oldCliente[0].deletedAt) return;

        // Soft Delete Cliente
        await tx.update(schema.clientes)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(schema.clientes.id, id));

        await AuditLogService.log('DELETE (SOFT)', 'Cliente', oldCliente[0], null, tx);
      });

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir cliente' });
    }
  });

  // ========== HISTÓRICO CRM ==========
  
  // Buscar histórico de um cliente
  server.get('/:id/historico', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    try {
      const historico = await db.select()
        .from(schema.interacoes_cliente)
        .where(eq(schema.interacoes_cliente.clienteId, id));
      
      // Ordenar do mais recente pro mais antigo
      historico.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      
      return historico;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar histórico' });
    }
  });

  // Adicionar nova interação ao histórico
  server.post('/:id/historico', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    const data = request.body as Payload;
    try {
      const novaInteracao = await db.insert(schema.interacoes_cliente).values({
        id: crypto.randomUUID(),
        clienteId: id,
        projetoId: data.projetoId || null,
        orcamentoId: data.orcamentoId || null,
        tipo: data.tipo,
        titulo: data.titulo || null,
        categoria: data.categoria || null,
        manual: data.manual !== undefined ? data.manual : true,
        data: data.data,
        descricao: data.descricao
      }).returning();
      
      return reply.status(201).send(novaInteracao[0]);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao salvar interação' });
    }
  });

  // Atualizar interação do histórico
  server.patch('/:id/historico/:historicoId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, historicoId } = request.params as HistoricoParams;
    const data = request.body as Payload;

    try {
      const interacao = await db.select()
        .from(schema.interacoes_cliente)
        .where(eq(schema.interacoes_cliente.id, historicoId))
        .limit(1);

      if (!interacao.length || interacao[0].clienteId !== id) {
        return reply.status(404).send({ error: 'Interação não encontrada' });
      }

      const interacaoAtualizada = await db.update(schema.interacoes_cliente).set({
        projetoId: data.projetoId !== undefined ? data.projetoId || null : undefined,
        orcamentoId: data.orcamentoId !== undefined ? data.orcamentoId || null : undefined,
        tipo: data.tipo !== undefined ? data.tipo : undefined,
        titulo: data.titulo !== undefined ? data.titulo || null : undefined,
        categoria: data.categoria !== undefined ? data.categoria || null : undefined,
        data: data.data !== undefined ? data.data : undefined,
        descricao: data.descricao !== undefined ? data.descricao : undefined,
        updatedAt: new Date().toISOString()
      })
        .where(eq(schema.interacoes_cliente.id, historicoId))
        .returning();

      return interacaoAtualizada[0];
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar interação' });
    }
  });

  // Importação em Lote
  server.post('/lote', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as Payload[]; // Array of items
    if (!Array.isArray(data)) return reply.status(400).send({ error: 'Payload deve ser um array' });
    
    try {
      const inserts = data.map(item => ({
        id: crypto.randomUUID(),
        nome: item.nome || 'Sem Nome',
        documento: item.documento || null,
        email: item.email || null,
        telefone: item.telefone || null,
        endereco: item.endereco || null,
        numero: item.numero || null,
        bairro: item.bairro || null,
        celular: item.celular || null,
        cpf: item.cpf || null,
        cnpj: item.cnpj || null,
        origem: item.origem || null,
        categoria: item.categoria || null,
        anotacoes: item.anotacoes || null,
        situacao: item.situacao || 'Ativo'
      }));

      if (inserts.length > 0) {
        await db.insert(schema.clientes).values(inserts);
        await AuditLogService.log('INSERT', 'Cliente', null, { 
          importacaoLote: true, 
          quantidade: inserts.length, 
          clientes: inserts.map(c => c.nome) 
        });
        
        // Crie pastas para todos os clientes criados (em background, para não travar a resposta)
        Promise.allSettled(
          inserts.map(c => FileSystemService.getClientFolder(c.nome))
        ).catch(e => server.log.error('Erro criando pastas em lote', e));
      }

      return reply.status(201).send({ message: `${inserts.length} registros importados com sucesso` });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao importar em lote' });
    }
  });
}
