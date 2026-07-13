import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { FileSystemService } from '../services/fs.service';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import crypto from 'crypto';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

const ProjetoPayloadSchema = z.object({
  clienteId: z.string().uuid(),
  nome: z.string().min(1),
  descricao: z.string().nullable().optional(),
  status: z.string().optional(),
  dataInicio: z.string().nullable().optional(),
  dataEntrega: z.string().nullable().optional(),
  areaHa: z.number().nullable().optional(),
  matricula: z.string().nullable().optional(),
  car: z.string().nullable().optional(),
  ccir: z.string().nullable().optional(),
  itr: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  municipio: z.string().nullable().optional(),
  situacaoImovel: z.string().nullable().optional(),
  tipo: z.string().nullable().optional(),
  averbacao: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  possuiMemorialDescritivo: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  // Campos Unificados
  propriedadeId: z.string().uuid().nullable().optional(),
  orgaoAmbiental: z.string().nullable().optional(),
  tipoDemanda: z.string().nullable().optional(),
  protocolo: z.string().nullable().optional(),
  numeroProcesso: z.string().nullable().optional(),
  numeroLicenca: z.string().nullable().optional(),
  dataEmissao: z.string().nullable().optional(),
  dataVencimentoLicenca: z.string().nullable().optional(),
  tipoLicenca: z.string().nullable().optional(),
  tipoPericia: z.string().nullable().optional(),
  dataVistoria: z.string().nullable().optional()
});

const ProjetoLotePayloadSchema = z.array(z.object({
  clienteId: z.string().uuid(),
  nome: z.string().min(1),
  status: z.string().optional(),
  cidade: z.string().nullable().optional(),
  areaHa: z.preprocess(
    (value) => value === '' || value === null || value === undefined ? null : Number(value),
    z.number().nullable().optional()
  )
}));

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
        limit: z.coerce.number().min(1).max(500).default(100),
        clienteId: z.string().uuid().optional()
      })
    }
  }, async (request, reply) => {
    const { page, limit } = request.query;
    try {
      const offset = (page - 1) * limit;
      const projetosList = await db.select({
        projeto: schema.projetos,
        cliente: {
          id: schema.clientes.id,
          nome: schema.clientes.nome
        }
      })
      .from(schema.projetos)
      .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
      .where(
        and(
          isNull(schema.projetos.deletedAt),
          request.query.clienteId ? eq(schema.projetos.clienteId, request.query.clienteId) : undefined
        )
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.projetos.createdAt));
      
      return projetosList.map(row => ({
        ...row.projeto,
        clienteNome: row.cliente?.nome
      }));
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar projetos' });
    }
  });

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

      return {
        ...result[0].projeto,
        clienteNome: result[0].cliente?.nome
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
          areaHa: data.areaHa || null,
          matricula: data.matricula || null,
          car: data.car || null,
          ccir: data.ccir || null,
          itr: data.itr || null,
          cidade: data.cidade || null,
          municipio: data.municipio || null,
          situacaoImovel: data.situacaoImovel || null,
          tipo: data.tipo || null,
          averbacao: data.averbacao || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
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
            numero: data.numeroLicenca || 'S/N',
            protocolo: data.protocolo || null,
            orgao: data.orgaoAmbiental || 'Não informado',
            tipoLicenca: data.tipoLicenca || null,
            dataEmissao: data.dataEmissao || null,
            dataVencimento: data.dataVencimentoLicenca || data.dataEntrega || new Date().toISOString(),
            status: 'Válida'
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

        // Setup inicial de pastas
        const cliente = await tx.select().from(schema.clientes).where(eq(schema.clientes.id, data.clienteId)).limit(1);
        if (cliente.length && cliente[0].nome) {
          await FileSystemService.getProjectFolder(cliente[0].nome, result[0].nome);
        }

        return result[0];
      });

      return reply.status(201).send(novoProjeto);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao criar projeto' });
    }
  });

  zServer.post('/lote', {
    schema: {
      body: ProjetoLotePayloadSchema
    }
  }, async (request, reply) => {
    const data = request.body;

    if (data.length === 0) {
      return reply.status(400).send({ error: 'Payload deve conter pelo menos um projeto' });
    }

    try {
      const clientesById = new Map<string, string>();

      for (const item of data) {
        if (clientesById.has(item.clienteId)) continue;

        const cliente = await db.select({
          id: schema.clientes.id,
          nome: schema.clientes.nome
        })
          .from(schema.clientes)
          .where(eq(schema.clientes.id, item.clienteId))
          .limit(1);

        if (!cliente.length) {
            return reply.status(400).send({ error: `Cliente vinculado não encontrado: ${item.clienteId}` });
        }

        clientesById.set(cliente[0].id, cliente[0].nome);
      }

      const projetosCriados = await db.transaction(async (tx) => {
        const created = [];

        for (const item of data) {
          const result = await tx.insert(schema.projetos).values({
            id: crypto.randomUUID(),
            clienteId: item.clienteId,
            nome: item.nome,
            status: item.status || 'Em Andamento',
            cidade: item.cidade || null,
            areaHa: item.areaHa || null
          }).returning();

          await JornadaService.logClienteEvento({
            clienteId: item.clienteId,
            projetoId: result[0].id,
            tipo: 'Projeto',
            titulo: `Projeto criado: ${result[0].nome}`,
              categoria: 'Importação',
            descricao: `Status: ${result[0].status}`
          }, tx);

          created.push(result[0]);
        }

        await AuditLogService.log('INSERT', 'Projeto', null, {
          importacaoLote: true,
          quantidade: created.length,
          projetos: created.map(projeto => projeto.nome)
        }, tx);

        return created;
      });

      Promise.allSettled(
        projetosCriados.map(projeto => {
          const clienteNome = clientesById.get(projeto.clienteId);
          return clienteNome ? FileSystemService.getProjectFolder(clienteNome, projeto.nome) : Promise.resolve();
        })
      ).catch(e => server.log.error('Erro criando pastas de projetos em lote', e));

      return reply.status(201).send({
        message: `${projetosCriados.length} projetos importados com sucesso`,
        importedCount: projetosCriados.length
      });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao importar projetos em lote' });
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

      const updateData: any = { updatedAt: new Date().toISOString() };
      for (const key of Object.keys(data)) {
        updateData[key] = (data as any)[key] ?? null;
      }

      const projetoAtualizado = await db.transaction(async (tx) => {
        const result = await tx.update(schema.projetos)
          .set(updateData)
          .where(eq(schema.projetos.id, id))
          .returning();
          
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
        return result[0];
      });

      return projetoAtualizado;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar projeto' });
    }
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

        await AuditLogService.log('DELETE (SOFT)', 'Projeto', oldProjeto[0], null, tx);
      });

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir projeto' });
    }
  });
}
