import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, sql, isNull, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { normalizeBudgetStatus } from '@geogestor/contracts';

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((valueInCents || 0) / 100);

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type IdParams = { id: string };

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
const nullableDateSchema = isoDateSchema.nullable().optional();
const centsSchema = z.number().int().min(0).max(9_000_000_000);
const nullableCentsSchema = centsSchema.nullable().optional();
const legacyBudgetItemSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  quantidade: z.number().finite().positive().max(1_000_000),
  valorUnitario: centsSchema,
  // Mantido no contrato por compatibilidade; o valor persistido é recalculado no servidor.
  total: centsSchema
});
const legacyBudgetCostSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  valor: centsSchema
});

function calculatedLegacyItemTotal(item: z.infer<typeof legacyBudgetItemSchema>) {
  return Math.round(item.quantidade * item.valorUnitario);
}

export async function financeiroRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();
  
  // Orçamentos
  zServer.get('/orcamentos', {
    schema: {
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(500).default(100),
        clienteId: z.string().uuid().optional()
      })
    }
  }, async (request, reply) => {
    const { page, limit } = request.query;
    const offset = (page - 1) * limit;

    const data = await db
      .select({
        id: schema.orcamentos.id,
        valorTotal: schema.orcamentos.valorTotal,
        status: schema.orcamentos.status,
        descricao: schema.orcamentos.descricao,
        clienteNome: schema.clientes.nome,
        clienteId: schema.clientes.id,
        projetoId: schema.orcamentos.projetoId,
        projetoNome: schema.projetos.nome,
        anotacoes: schema.orcamentos.anotacoes,
        formaDePagamento: schema.orcamentos.formaDePagamento,
        desconto: schema.orcamentos.desconto,
        codigoOrcamento: schema.orcamentos.codigoOrcamento,
        dataOrcamento: schema.orcamentos.dataOrcamento,
        dataCompetencia: schema.orcamentos.dataCompetencia,
        dataPagamento: schema.orcamentos.dataPagamento,
        possuiMarco: schema.orcamentos.possuiMarco,
        marcoQtd: schema.orcamentos.marcoQtd,
        marcoValor: schema.orcamentos.marcoValor,
        possuiImposto: schema.orcamentos.possuiImposto,
        impostoPorcentagem: schema.orcamentos.impostoPorcentagem,
        impostoValor: schema.orcamentos.impostoValor,
        impostosPrevistos: schema.orcamentos.impostosPrevistos,
        impostoRetido: schema.orcamentos.impostoRetido,
        centroCusto: schema.orcamentos.centroCusto,
        possuiArt: schema.orcamentos.possuiArt,
        artValor: schema.orcamentos.artValor,
        createdAt: schema.orcamentos.createdAt
      })
      .from(schema.orcamentos)
      .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
      .leftJoin(schema.projetos, eq(schema.orcamentos.projetoId, schema.projetos.id))
      .where(
        and(
          isNull(schema.orcamentos.deletedAt),
          request.query.clienteId ? eq(schema.orcamentos.clienteId, request.query.clienteId) : undefined
        )
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.orcamentos.createdAt));
      
    // Buscar itens e despesas de todos os orçamentos
    const orcIds = data.map(o => o.id);
    if (orcIds.length > 0) {
      // Itens
      const allItens = await db.select().from(schema.orcamento_itens).where(sql`orcamento_id IN ${orcIds}`);
      // Despesas
      const allDespesas = await db.select().from(schema.orcamento_despesas).where(sql`orcamento_id IN ${orcIds}`);

      return data.map(orc => ({
        ...orc,
        itens: allItens.filter(i => i.orcamentoId === orc.id),
        despesas: allDespesas.filter(d => d.orcamentoId === orc.id)
      }));
    }
    
    return data;
  });

  zServer.post('/orcamentos', {
    schema: {
      body: z.object({
        clienteId: z.string().uuid('Cliente inválido'),
        projetoId: z.string().uuid('Projeto inválido').nullable().optional(),
        valorTotal: centsSchema,
        status: z.string().max(50).optional(),
        descricao: z.string().trim().min(1, 'Descrição é obrigatória').max(2_000),
        anotacoes: z.string().max(20_000).nullable().optional(),
        formaDePagamento: z.string().max(200).nullable().optional(),
        desconto: nullableCentsSchema,
        codigoOrcamento: z.string().max(100).nullable().optional(),
        dataOrcamento: nullableDateSchema,
        dataCompetencia: nullableDateSchema,
        dataPagamento: nullableDateSchema,
        itens: z.array(legacyBudgetItemSchema).max(500).optional(),
        possuiMarco: z.boolean().optional(),
        marcoQtd: z.number().int().min(0).max(1_000_000).nullable().optional(),
        marcoValor: nullableCentsSchema,
        possuiImposto: z.boolean().optional(),
        impostoPorcentagem: z.number().finite().min(0).max(100).nullable().optional(),
        impostoValor: nullableCentsSchema,
        impostoRetido: z.boolean().optional(),
        centroCusto: z.string().max(200).nullable().optional(),
        possuiArt: z.boolean().optional(),
        artValor: nullableCentsSchema,
        despesas: z.array(legacyBudgetCostSchema).max(500).optional()
      })
    }
  }, async (request, reply) => {
    const data = request.body;
    const projetoId = data.projetoId || null;

    const cliente = await db.select({ id: schema.clientes.id }).from(schema.clientes)
      .where(and(eq(schema.clientes.id, data.clienteId), isNull(schema.clientes.deletedAt))).limit(1);
    if (!cliente.length) return reply.status(400).send({ error: 'Cliente não encontrado' });

    if (projetoId) {
      const projeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, projetoId)).limit(1);
      if (!projeto.length) {
        return reply.status(400).send({ error: 'Projeto vinculado não encontrado' });
      }
      if (projeto[0].clienteId !== data.clienteId) {
        return reply.status(400).send({ error: 'Projeto não pertence ao cliente informado' });
      }
    }

    const orcamento = await db.transaction(async (tx) => {
      const orc = await tx.insert(schema.orcamentos).values({
        id: crypto.randomUUID(),
        clienteId: data.clienteId,
        projetoId,
        valorTotal: data.valorTotal,
        status: 'rascunho',
        descricao: data.descricao,
        anotacoes: data.anotacoes || null,
        formaDePagamento: data.formaDePagamento || null,
        desconto: data.desconto !== undefined ? data.desconto : null,
        codigoOrcamento: data.codigoOrcamento || null,
        dataOrcamento: data.dataOrcamento || null,
        dataCompetencia: data.dataCompetencia || null,
        dataPagamento: data.dataPagamento || null,
        possuiMarco: data.possuiMarco !== undefined ? data.possuiMarco : false,
        marcoQtd: data.marcoQtd !== undefined ? data.marcoQtd : null,
        marcoValor: data.marcoValor !== undefined ? data.marcoValor : null,
        possuiImposto: data.possuiImposto !== undefined ? data.possuiImposto : false,
        impostoPorcentagem: data.impostoPorcentagem !== undefined ? data.impostoPorcentagem : null,
        impostoValor: data.impostoValor !== undefined ? data.impostoValor : null,
        impostoRetido: data.impostoRetido !== undefined ? data.impostoRetido : false,
        centroCusto: data.centroCusto || null,
        possuiArt: data.possuiArt !== undefined ? data.possuiArt : false,
        artValor: data.artValor !== undefined ? data.artValor : null
      }).returning();

      if (data.itens && data.itens.length > 0) {
        for (const item of data.itens) {
          await tx.insert(schema.orcamento_itens).values({
            id: crypto.randomUUID(),
            orcamentoId: orc[0].id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            total: calculatedLegacyItemTotal(item)
          });
        }
      }

      if (data.despesas && data.despesas.length > 0) {
        for (const d of data.despesas) {
          await tx.insert(schema.orcamento_despesas).values({
            id: crypto.randomUUID(),
            orcamentoId: orc[0].id,
            descricao: d.descricao,
            valor: d.valor
          });
        }
      }

      await AuditLogService.log('INSERT', 'Orcamento', null, orc[0], tx);
      await JornadaService.logClienteEvento({
        clienteId: orc[0].clienteId,
        projetoId: orc[0].projetoId || null,
        orcamentoId: orc[0].id,
        tipo: 'Orçamento',
        titulo: `Orçamento criado: ${orc[0].codigoOrcamento || orc[0].descricao || orc[0].id.slice(0, 8)}`,
        categoria: 'Orçamento',
        descricao: [
          `Valor: ${formatCurrency(orc[0].valorTotal)}`,
          `Status: ${orc[0].status}`,
          orc[0].dataOrcamento ? `Data: ${orc[0].dataOrcamento}` : null,
          orc[0].formaDePagamento ? `Pagamento: ${orc[0].formaDePagamento}` : null
        ].filter(Boolean).join('\n')
      }, tx);
      return orc;
    });
    return orcamento[0];
  });

  zServer.patch('/orcamentos/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        clienteId: z.string().uuid('Cliente inválido').optional(),
        projetoId: z.string().uuid('Projeto inválido').nullable().optional(),
        valorTotal: centsSchema.optional(),
        status: z.string().max(50).optional(),
        descricao: z.string().trim().min(1, 'Descrição não pode ser vazia').max(2_000).optional(),
        anotacoes: z.string().max(20_000).nullable().optional(),
        formaDePagamento: z.string().max(200).nullable().optional(),
        desconto: nullableCentsSchema,
        codigoOrcamento: z.string().max(100).nullable().optional(),
        dataOrcamento: nullableDateSchema,
        dataCompetencia: nullableDateSchema,
        dataPagamento: nullableDateSchema,
        itens: z.array(legacyBudgetItemSchema).max(500).optional(),
        possuiMarco: z.boolean().optional(),
        marcoQtd: z.number().int().min(0).max(1_000_000).nullable().optional(),
        marcoValor: nullableCentsSchema,
        possuiImposto: z.boolean().optional(),
        impostoPorcentagem: z.number().finite().min(0).max(100).nullable().optional(),
        impostoValor: nullableCentsSchema,
        impostoRetido: z.boolean().optional(),
        centroCusto: z.string().max(200).nullable().optional(),
        possuiArt: z.boolean().optional(),
        artValor: nullableCentsSchema,
        despesas: z.array(legacyBudgetCostSchema).max(500).optional()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const oldOrcamento = await db.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, id)).limit(1);
      if (!oldOrcamento.length) {
        return reply.status(404).send({ error: 'Orçamento não encontrado' });
      }

      const currentStatus = normalizeBudgetStatus(oldOrcamento[0].status);
      if (currentStatus !== 'rascunho') {
        return reply.status(409).send({
          error: 'Somente rascunhos podem ser editados. Use o módulo Orçamentos para transições, aprovação ou revisão formal.'
        });
      }
      if (data.status !== undefined && normalizeBudgetStatus(data.status) !== currentStatus) {
        return reply.status(409).send({
          error: 'Mudanças de status devem usar a máquina de estados do módulo Orçamentos.'
        });
      }

      const nextClienteId = data.clienteId !== undefined ? data.clienteId : oldOrcamento[0].clienteId;
      const nextProjetoId = data.projetoId !== undefined ? (data.projetoId || null) : oldOrcamento[0].projetoId;

      const nextCliente = await db.select({ id: schema.clientes.id }).from(schema.clientes)
        .where(and(eq(schema.clientes.id, nextClienteId), isNull(schema.clientes.deletedAt))).limit(1);
      if (!nextCliente.length) return reply.status(400).send({ error: 'Cliente não encontrado' });

      if (nextProjetoId) {
        const projeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, nextProjetoId)).limit(1);
        if (!projeto.length) {
          return reply.status(400).send({ error: 'Projeto vinculado não encontrado' });
        }
        if (projeto[0].clienteId !== nextClienteId) {
          return reply.status(400).send({ error: 'Projeto não pertence ao cliente informado' });
        }
      }

      const changes: string[] = [];
      if (data.valorTotal !== undefined && data.valorTotal !== oldOrcamento[0].valorTotal) {
        changes.push(`Valor: ${formatCurrency(oldOrcamento[0].valorTotal)} -> ${formatCurrency(data.valorTotal)}`);
      }
      if (data.dataOrcamento !== undefined && data.dataOrcamento !== oldOrcamento[0].dataOrcamento) {
        changes.push(`Data do orçamento: ${oldOrcamento[0].dataOrcamento || 'não informada'} -> ${data.dataOrcamento || 'não informada'}`);
      }
      if (data.dataPagamento !== undefined && data.dataPagamento !== oldOrcamento[0].dataPagamento) {
        changes.push(`Data de pagamento: ${oldOrcamento[0].dataPagamento || 'não informada'} -> ${data.dataPagamento || 'não informada'}`);
      }
      if (data.impostoValor !== undefined && data.impostoValor !== oldOrcamento[0].impostoValor) {
        changes.push(`Imposto: ${formatCurrency(oldOrcamento[0].impostoValor || 0)} -> ${formatCurrency(data.impostoValor || 0)}`);
      }

      const orcamentoAtualizado = await db.transaction(async (tx) => {
        const orc = await tx.update(schema.orcamentos).set({
          clienteId: data.clienteId !== undefined ? data.clienteId : undefined,
          projetoId: data.projetoId !== undefined ? (data.projetoId || null) : undefined,
          valorTotal: data.valorTotal !== undefined ? data.valorTotal : undefined,
          status: undefined,
          descricao: data.descricao !== undefined ? data.descricao : undefined,
          anotacoes: data.anotacoes !== undefined ? data.anotacoes : undefined,
          formaDePagamento: data.formaDePagamento !== undefined ? data.formaDePagamento : undefined,
          desconto: data.desconto !== undefined ? data.desconto : undefined,
          codigoOrcamento: data.codigoOrcamento !== undefined ? data.codigoOrcamento : undefined,
          dataOrcamento: data.dataOrcamento !== undefined ? data.dataOrcamento : undefined,
          dataCompetencia: data.dataCompetencia !== undefined ? data.dataCompetencia : undefined,
          dataPagamento: data.dataPagamento !== undefined ? data.dataPagamento : undefined,
          possuiMarco: data.possuiMarco !== undefined ? data.possuiMarco : undefined,
          marcoQtd: data.marcoQtd !== undefined ? data.marcoQtd : undefined,
          marcoValor: data.marcoValor !== undefined ? data.marcoValor : undefined,
          possuiImposto: data.possuiImposto !== undefined ? data.possuiImposto : undefined,
          impostoPorcentagem: data.impostoPorcentagem !== undefined ? data.impostoPorcentagem : undefined,
          impostoValor: data.impostoValor !== undefined ? data.impostoValor : undefined,
          impostoRetido: data.impostoRetido !== undefined ? data.impostoRetido : undefined,
          centroCusto: data.centroCusto !== undefined ? data.centroCusto : undefined,
          possuiArt: data.possuiArt !== undefined ? data.possuiArt : undefined,
          artValor: data.artValor !== undefined ? data.artValor : undefined,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.orcamentos.id, id)).returning();

        if (data.itens !== undefined) {
          await tx.delete(schema.orcamento_itens).where(eq(schema.orcamento_itens.orcamentoId, id));
          for (const item of data.itens) {
            await tx.insert(schema.orcamento_itens).values({
              id: crypto.randomUUID(),
              orcamentoId: id,
              descricao: item.descricao,
              quantidade: item.quantidade,
              valorUnitario: item.valorUnitario,
              total: calculatedLegacyItemTotal(item)
            });
          }
        }

        if (data.despesas !== undefined) {
          await tx.delete(schema.orcamento_despesas).where(eq(schema.orcamento_despesas.orcamentoId, id));
          for (const desp of data.despesas) {
            await tx.insert(schema.orcamento_despesas).values({
              id: crypto.randomUUID(),
              orcamentoId: id,
              descricao: desp.descricao,
              valor: desp.valor
            });
          }
        }
        await AuditLogService.log('UPDATE', 'Orcamento', oldOrcamento[0], orc[0], tx);
        if (changes.length) {
          await JornadaService.logClienteEvento({
            clienteId: orc[0].clienteId,
            projetoId: orc[0].projetoId || null,
            orcamentoId: orc[0].id,
            tipo: 'Orçamento',
            titulo: `Orçamento atualizado: ${orc[0].codigoOrcamento || orc[0].descricao || orc[0].id.slice(0, 8)}`,
            categoria: 'Orçamento',
            descricao: changes.join('\n')
          }, tx);
        }
        return orc;
      });

      return reply.send(orcamentoAtualizado[0]);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar orçamento' });
    }
  });

  // Parcelas
  server.get('/parcelas', async (request, reply) => {
    const data = await db
      .select({
        id: schema.parcelas.id,
        orcamentoId: schema.parcelas.orcamentoId,
        valor: schema.parcelas.valor,
        valorPago: schema.parcelas.valorPago,
        dataVencimento: schema.parcelas.dataVencimento,
        dataPagamento: schema.parcelas.dataPagamento,
        statusPagamento: schema.parcelas.statusPagamento,
        clienteNome: schema.clientes.nome,
        clienteId: schema.clientes.id,
        orcamentoDescricao: schema.orcamentos.descricao
      })
      .from(schema.parcelas)
      .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
      .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
      .where(and(
        isNull(schema.parcelas.deletedAt),
        isNull(schema.parcelas.canceladaEm),
        isNull(schema.orcamentos.deletedAt),
        sql`(${schema.parcelas.statusPagamento} = 'Pago' OR lower(${schema.orcamentos.status}) IN ('aprovado', 'pago'))`
      ));
    return data;
  });

  server.get('/parcelas/:orcamentoId', async (request, reply) => {
    const { orcamentoId } = request.params as any;
    const data = await db.select().from(schema.parcelas).where(and(
      eq(schema.parcelas.orcamentoId, orcamentoId),
      isNull(schema.parcelas.deletedAt)
    ));
    return data;
  });

  server.post('/parcelas', async (request, reply) => {
    const bodySchema = z.object({
      orcamentoId: z.string().min(1, 'Orçamento ID é obrigatório'),
      valor: z.number().min(1, 'Valor inválido'),
      dataVencimento: z.string().min(1, 'Data de vencimento é obrigatória'),
      dataPagamento: z.string().nullable().optional(),
      statusPagamento: z.string().optional()
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }

    const data = parseResult.data;
    const sourceBudget = await db.select().from(schema.orcamentos)
      .where(and(eq(schema.orcamentos.id, data.orcamentoId), isNull(schema.orcamentos.deletedAt)))
      .limit(1);
    if (!sourceBudget.length) return reply.status(404).send({ error: 'Orçamento não encontrado' });
    if (normalizeBudgetStatus(sourceBudget[0].status) !== 'aprovado') {
      return reply.status(409).send({ error: 'Contas a receber só podem ser criadas para orçamentos aprovados.' });
    }
    const parcela = await db.insert(schema.parcelas).values({
      id: crypto.randomUUID(),
      orcamentoId: data.orcamentoId,
      valor: data.valor,
      dataVencimento: data.dataVencimento,
      dataPagamento: data.dataPagamento || (data.statusPagamento === 'Pago' ? todayKey() : null),
      statusPagamento: data.statusPagamento || 'Pendente',
      valorPago: data.statusPagamento === 'Pago' ? data.valor : 0,
      tipoValor: 'recebivel_previsto'
    }).returning();

    const orcamento = await db.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, parcela[0].orcamentoId)).limit(1);
    if (orcamento.length) {
      await JornadaService.logClienteEvento({
        clienteId: orcamento[0].clienteId,
        projetoId: orcamento[0].projetoId || null,
        orcamentoId: orcamento[0].id,
        tipo: 'Financeiro',
        titulo: `Parcela registrada: ${formatCurrency(parcela[0].valor)}`,
        categoria: 'Fatura',
        descricao: `Vencimento: ${parcela[0].dataVencimento}\nStatus: ${parcela[0].statusPagamento}`
      });
    }
    return parcela[0];
  });

  server.patch('/parcelas/:id', async (request, reply) => {
    const { id } = request.params as any;
    
    const bodySchema = z.object({
      statusPagamento: z.enum(['Pendente', 'Pago']).optional(),
      dataPagamento: z.string().nullable().optional()
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }
    
    const data = parseResult.data;
    const parcelaAnterior = await db.select().from(schema.parcelas).where(eq(schema.parcelas.id, id)).limit(1);
    if (!parcelaAnterior.length) {
      return reply.status(404).send({ error: 'Parcela nao encontrada' });
    }
    if (parcelaAnterior[0].canceladaEm) {
      return reply.status(409).send({ error: 'Uma parcela cancelada não pode ser liquidada ou reaberta.' });
    }

    const parcela = await db.update(schema.parcelas).set({
      statusPagamento: data.statusPagamento,
      valorPago: data.statusPagamento === 'Pago'
        ? parcelaAnterior[0].valor
        : data.statusPagamento
          ? 0
          : undefined,
      dataPagamento: data.dataPagamento !== undefined
        ? data.dataPagamento
        : data.statusPagamento === 'Pago'
          ? parcelaAnterior[0].dataPagamento || todayKey()
          : data.statusPagamento
            ? null
            : undefined,
      updatedAt: new Date().toISOString()
    }).where(eq(schema.parcelas.id, id)).returning();

    if (parcela.length && parcelaAnterior.length && data.statusPagamento !== parcelaAnterior[0].statusPagamento) {
      const orcamento = await db.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, parcela[0].orcamentoId)).limit(1);
      if (orcamento.length) {
        await JornadaService.logClienteEvento({
          clienteId: orcamento[0].clienteId,
          projetoId: orcamento[0].projetoId || null,
          orcamentoId: orcamento[0].id,
          tipo: 'Financeiro',
          titulo: data.statusPagamento === 'Pago'
            ? `Pagamento confirmado: ${formatCurrency(parcela[0].valor)}`
            : `Status da fatura atualizado: ${data.statusPagamento}`,
          categoria: 'Fatura',
          descricao: `Parcela com vencimento em ${parcela[0].dataVencimento}\nStatus: ${parcelaAnterior[0].statusPagamento} -> ${parcela[0].statusPagamento}`
        });
      }
    }
    return parcela[0];
  });

  // Despesas
  server.get('/despesas', async (request, reply) => {
    const data = await db
      .select({
        id: schema.despesas.id,
        clienteId: sql<string | null>`coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId})`,
        clienteNome: schema.clientes.nome,
        projetoId: schema.despesas.projetoId,
        projetoNome: schema.projetos.nome,
        descricao: schema.despesas.descricao,
        fornecedor: schema.despesas.fornecedor,
        numeroDocumento: schema.despesas.numeroDocumento,
        valor: schema.despesas.valor,
        data: schema.despesas.data,
        dataCompetencia: schema.despesas.dataCompetencia,
        dataPagamento: schema.despesas.dataPagamento,
        categoria: schema.despesas.categoria,
        tipoCusto: schema.despesas.tipoCusto,
        centroCusto: schema.despesas.centroCusto,
        reembolsavel: schema.despesas.reembolsavel,
        comprovanteDocumentoId: schema.despesas.comprovanteDocumentoId,
        observacoes: schema.despesas.observacoes,
        status: schema.despesas.status,
        formaPagamento: schema.despesas.formaPagamento,
        createdAt: schema.despesas.createdAt,
        updatedAt: schema.despesas.updatedAt
      })
      .from(schema.despesas)
      .leftJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, sql`${schema.clientes.id} = coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId})`);
    return data;
  });

  server.post('/despesas', async (request, reply) => {
    const bodySchema = z.object({
      clienteId: z.string().nullable().optional(),
      projetoId: z.string().nullable().optional(),
      descricao: z.string().min(1, 'Descrição é obrigatória'),
      fornecedor: z.string().nullable().optional(),
      numeroDocumento: z.string().nullable().optional(),
      valor: z.number({ required_error: 'Valor é obrigatório' }).min(1, 'Valor deve ser maior que zero'),
      data: z.string().min(1, 'Data é obrigatória'),
      dataCompetencia: z.string().nullable().optional(),
      dataPagamento: z.string().nullable().optional(),
      categoria: z.string().min(1, 'Categoria é obrigatória'),
      tipoCusto: z.string().nullable().optional(),
      centroCusto: z.string().nullable().optional(),
      reembolsavel: z.boolean().optional(),
      comprovanteDocumentoId: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
      status: z.string().optional(),
      formaPagamento: z.string().nullable().optional()
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }

    const data = parseResult.data;
    const projetoId = data.projetoId || null;
    let clienteId = data.clienteId || null;

    if (projetoId) {
      const projeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, projetoId)).limit(1);
      if (!projeto.length) {
        return reply.status(400).send({ error: 'Projeto vinculado nao encontrado' });
      }
      if (clienteId && projeto[0].clienteId !== clienteId) {
        return reply.status(400).send({ error: 'Projeto nao pertence ao cliente informado' });
      }
      clienteId = clienteId || projeto[0].clienteId;
    }

    const despesa = await db.insert(schema.despesas).values({
      id: crypto.randomUUID(),
      clienteId,
      projetoId,
      descricao: data.descricao,
      fornecedor: data.fornecedor || null,
      numeroDocumento: data.numeroDocumento || null,
      valor: data.valor,
      data: data.data,
      dataCompetencia: data.dataCompetencia || null,
      dataPagamento: data.dataPagamento || (data.status === 'Pago' ? todayKey() : null),
      categoria: data.categoria,
      tipoCusto: data.tipoCusto || null,
      centroCusto: data.centroCusto || null,
      reembolsavel: data.reembolsavel !== undefined ? data.reembolsavel : false,
      comprovanteDocumentoId: data.comprovanteDocumentoId || null,
      observacoes: data.observacoes || null,
      status: data.status || 'Pendente',
      formaPagamento: data.formaPagamento || null
    }).returning();

    await AuditLogService.log('INSERT', 'Despesa', null, despesa[0]);
    if (despesa[0].clienteId) {
      await JornadaService.logClienteEvento({
        clienteId: despesa[0].clienteId,
        projetoId: despesa[0].projetoId || null,
        tipo: 'Financeiro',
        titulo: `Despesa registrada: ${despesa[0].descricao}`,
        categoria: 'Despesa',
        descricao: [
          `Valor: ${formatCurrency(despesa[0].valor)}`,
          `Categoria: ${despesa[0].categoria}`,
          despesa[0].tipoCusto ? `Tipo de custo: ${despesa[0].tipoCusto}` : null,
          despesa[0].centroCusto ? `Centro de custo: ${despesa[0].centroCusto}` : null,
          `Vencimento: ${despesa[0].data}`,
          `Status: ${despesa[0].status || 'Pendente'}`
        ].filter(Boolean).join('\n')
      });
    }
    return despesa[0];
  });

  server.patch('/despesas/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    
    const bodySchema = z.object({
      clienteId: z.string().nullable().optional(),
      projetoId: z.string().nullable().optional(),
      descricao: z.string().min(1, 'Descrição não pode ser vazia').optional(),
      fornecedor: z.string().nullable().optional(),
      numeroDocumento: z.string().nullable().optional(),
      valor: z.number().min(1, 'Valor deve ser maior que zero').optional(),
      data: z.string().min(1, 'Data não pode ser vazia').optional(),
      dataCompetencia: z.string().nullable().optional(),
      dataPagamento: z.string().nullable().optional(),
      categoria: z.string().min(1, 'Categoria não pode ser vazia').optional(),
      tipoCusto: z.string().nullable().optional(),
      centroCusto: z.string().nullable().optional(),
      reembolsavel: z.boolean().optional(),
      comprovanteDocumentoId: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
      status: z.string().optional(),
      formaPagamento: z.string().nullable().optional()
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }

    const data = parseResult.data;
    try {
      const oldDespesa = await db.select().from(schema.despesas).where(eq(schema.despesas.id, id)).limit(1);
      if (!oldDespesa.length) {
        return reply.status(404).send({ error: 'Despesa não encontrada' });
      }

      const nextProjetoId = data.projetoId !== undefined ? (data.projetoId || null) : oldDespesa[0].projetoId;
      let nextClienteId = data.clienteId !== undefined ? (data.clienteId || null) : oldDespesa[0].clienteId;

      if (nextProjetoId) {
        const projeto = await db.select().from(schema.projetos).where(eq(schema.projetos.id, nextProjetoId)).limit(1);
        if (!projeto.length) {
          return reply.status(400).send({ error: 'Projeto vinculado nao encontrado' });
        }
        if (nextClienteId && projeto[0].clienteId !== nextClienteId) {
          return reply.status(400).send({ error: 'Projeto nao pertence ao cliente informado' });
        }
        nextClienteId = nextClienteId || projeto[0].clienteId;
      }

      const despesaAtualizada = await db.update(schema.despesas).set({
        clienteId: data.clienteId !== undefined || data.projetoId !== undefined ? nextClienteId : undefined,
        projetoId: data.projetoId !== undefined ? (data.projetoId || null) : undefined,
        descricao: data.descricao !== undefined ? data.descricao : undefined,
        fornecedor: data.fornecedor !== undefined ? data.fornecedor : undefined,
        numeroDocumento: data.numeroDocumento !== undefined ? data.numeroDocumento : undefined,
        valor: data.valor !== undefined ? data.valor : undefined,
        data: data.data !== undefined ? data.data : undefined,
        dataCompetencia: data.dataCompetencia !== undefined ? data.dataCompetencia : undefined,
        dataPagamento: data.dataPagamento !== undefined
          ? data.dataPagamento
          : data.status === 'Pago' && !oldDespesa[0].dataPagamento
            ? todayKey()
            : data.status && data.status !== 'Pago'
              ? null
              : undefined,
        categoria: data.categoria !== undefined ? data.categoria : undefined,
        tipoCusto: data.tipoCusto !== undefined ? data.tipoCusto : undefined,
        centroCusto: data.centroCusto !== undefined ? data.centroCusto : undefined,
        reembolsavel: data.reembolsavel !== undefined ? data.reembolsavel : undefined,
        comprovanteDocumentoId: data.comprovanteDocumentoId !== undefined ? data.comprovanteDocumentoId : undefined,
        observacoes: data.observacoes !== undefined ? data.observacoes : undefined,
        status: data.status !== undefined ? data.status : undefined,
        formaPagamento: data.formaPagamento !== undefined ? data.formaPagamento : undefined,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.despesas.id, id)).returning();

      await AuditLogService.log('UPDATE', 'Despesa', oldDespesa[0], despesaAtualizada[0]);

      const changes: string[] = [];
      if (data.status !== undefined && data.status !== oldDespesa[0].status) {
        changes.push(`Status: ${oldDespesa[0].status || 'Pendente'} -> ${data.status}`);
      }
      if (data.valor !== undefined && data.valor !== oldDespesa[0].valor) {
        changes.push(`Valor: ${formatCurrency(oldDespesa[0].valor)} -> ${formatCurrency(data.valor)}`);
      }
      if (data.dataPagamento !== undefined && data.dataPagamento !== oldDespesa[0].dataPagamento) {
        changes.push(`Data de pagamento: ${oldDespesa[0].dataPagamento || 'nao informada'} -> ${data.dataPagamento || 'nao informada'}`);
      }

      if (changes.length && despesaAtualizada[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: despesaAtualizada[0].clienteId,
          projetoId: despesaAtualizada[0].projetoId || null,
          tipo: 'Financeiro',
          titulo: `Despesa atualizada: ${despesaAtualizada[0].descricao}`,
          categoria: 'Despesa',
          descricao: changes.join('\n')
        });
      }

      return reply.send(despesaAtualizada[0]);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar despesa' });
    }
  });

  // Excluir orçamento
  zServer.delete('/orcamentos/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      const existing = await db.select().from(schema.orcamentos)
        .where(and(eq(schema.orcamentos.id, id), isNull(schema.orcamentos.deletedAt)))
        .limit(1);
      if (!existing.length) return reply.status(204).send();
      if (normalizeBudgetStatus(existing[0].status) !== 'rascunho') {
        return reply.status(409).send({
          error: 'Somente orçamentos em rascunho podem ser excluídos. Cancele o orçamento para preservar o histórico.'
        });
      }
      await db.transaction(async (tx) => {
        const oldOrcamento = await tx.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, id)).limit(1);
        if (!oldOrcamento.length || oldOrcamento[0].deletedAt) return;

        // 1. Gravar snapshot na Jornada (com orcamentoId nulo para evitar conflito de FK)
        await JornadaService.logClienteEvento({
          clienteId: oldOrcamento[0].clienteId,
          projetoId: oldOrcamento[0].projetoId || null,
          orcamentoId: undefined,
          tipo: 'Orçamento',
          titulo: `Orçamento excluído: ${oldOrcamento[0].codigoOrcamento || oldOrcamento[0].descricao || oldOrcamento[0].id.slice(0, 8)}`,
          categoria: 'Orçamento',
          descricao: `Valor: ${formatCurrency(oldOrcamento[0].valorTotal)}\nStatus anterior: ${oldOrcamento[0].status}`
        }, tx);

        // 2. Soft delete no orçamento
        await tx.update(schema.orcamentos)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(schema.orcamentos.id, id));

        // 3. Soft delete nas parcelas
        await tx.update(schema.parcelas)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(schema.parcelas.orcamentoId, id));

        await AuditLogService.log('DELETE (SOFT)', 'Orcamento', oldOrcamento[0], null, tx);
      });

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir orçamento' });
    }
  });

  // Excluir despesa
  server.delete('/despesas/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    try {
      await db.transaction(async (tx) => {
        const oldDespesa = await tx.select().from(schema.despesas).where(eq(schema.despesas.id, id)).limit(1);
        if (!oldDespesa.length) return;

        if (oldDespesa[0].clienteId) {
          await JornadaService.logClienteEvento({
            clienteId: oldDespesa[0].clienteId,
            projetoId: oldDespesa[0].projetoId || null,
            tipo: 'Financeiro',
            titulo: `Despesa excluída: ${oldDespesa[0].descricao}`,
            categoria: 'Despesa',
            descricao: [
              `Valor: ${formatCurrency(oldDespesa[0].valor)}`,
              `Categoria: ${oldDespesa[0].categoria}`,
              `Status anterior: ${oldDespesa[0].status || 'Pendente'}`
            ].join('\n')
          }, tx);
        }

        await tx.delete(schema.despesas).where(eq(schema.despesas.id, id));
        await AuditLogService.log('DELETE', 'Despesa', oldDespesa[0], null, tx);
      });

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir despesa' });
    }
  });

  // DRE Aggregation (Visão 360)
  server.get('/dre', async (request, reply) => {
    const orcamentosData = await db.select().from(schema.orcamentos)
      .where(isNull(schema.orcamentos.deletedAt));
    const despesasData = await db.select().from(schema.despesas)
      .where(isNull(schema.despesas.deletedAt));
    const parcelasData = await db.select().from(schema.parcelas)
      .where(and(isNull(schema.parcelas.deletedAt), isNull(schema.parcelas.canceladaEm)));

    const monthlyData: Record<string, { receitas: number, despesas: number }> = {};

    // Generate last 24 months keys
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      // Ensure we don't skip months when current day is 31st and previous month has 30 days
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${monthStr}`; // YYYY-MM
      monthlyData[key] = { receitas: 0, despesas: 0 };
    }

    // Aggregate Receitas (Orçamentos pagos/aprovados)
    const orcamentosComParcelas = new Set(parcelasData.map((parcela) => parcela.orcamentoId));

    parcelasData.forEach((parcela) => {
      if (parcela.statusPagamento !== 'Pago') return;
      const dateValue = parcela.dataPagamento || parcela.dataVencimento;
      const key = dateValue && dateValue.length >= 7 ? dateValue.substring(0, 7) : '';
      if (key && monthlyData[key] !== undefined) {
        monthlyData[key].receitas += parcela.valorPago || parcela.valor;
      }
    });

    orcamentosData.forEach(orc => {
      if (normalizeBudgetStatus(orc.status) === 'aprovado' && orc.dataPagamento && !orcamentosComParcelas.has(orc.id)) {
        let key = '';
        const dateValue = orc.dataPagamento || orc.dataOrcamento;
        if (dateValue && dateValue.length >= 7) {
          key = dateValue.substring(0, 7);
        } else if (orc.createdAt) {
          const date = new Date(orc.createdAt);
          key = date.toISOString().substring(0, 7);
        }
        if (key && monthlyData[key] !== undefined) {
          monthlyData[key].receitas += orc.valorTotal;
        }
      }
    });

    // Aggregate Despesas (Pagas)
    despesasData.forEach(desp => {
      if (desp.status === 'Pago') {
        const dateValue = desp.dataPagamento || desp.data;
        const key = dateValue && dateValue.length >= 7 ? dateValue.substring(0, 7) : '';
        if (key && monthlyData[key] !== undefined) {
          monthlyData[key].despesas += desp.valor;
        }
      }
    });

    const result = Object.keys(monthlyData).map(mes => ({
      mes,
      receitas: monthlyData[mes].receitas,
      despesas: monthlyData[mes].despesas,
      lucro: monthlyData[mes].receitas - monthlyData[mes].despesas
    })).sort((a, b) => a.mes.localeCompare(b.mes));

    return result;
  });

  // Resumo Gerencial Avançado (KPIs, Contas a Pagar/Receber, Inadimplência, Margem por Cliente)
  server.get('/resumo-gerencial', async (request, reply) => {
    const orcamentosData = await db.select().from(schema.orcamentos)
      .where(isNull(schema.orcamentos.deletedAt));
    const despesasData = await db.select().from(schema.despesas)
      .where(isNull(schema.despesas.deletedAt));
    const parcelasData = await db.select().from(schema.parcelas)
      .where(and(isNull(schema.parcelas.deletedAt), isNull(schema.parcelas.canceladaEm)));
    const clientesData = await db.select().from(schema.clientes)
      .where(isNull(schema.clientes.deletedAt));
    const clientesMap = new Map(clientesData.map(c => [c.id, c.nome]));

    const hoje = new Date().toISOString().substring(0, 10);

    let receitasPagas = 0;
    let contasAReceber = 0;
    let inadimplencia = 0;

    const orcamentosComParcelas = new Set(parcelasData.map(p => p.orcamentoId));
    const clienteFinanceiroMap = new Map<string, { receitas: number; despesas: number }>();

    const getClienteAgg = (clienteId?: string | null) => {
      if (!clienteId) return null;
      if (!clienteFinanceiroMap.has(clienteId)) {
        clienteFinanceiroMap.set(clienteId, { receitas: 0, despesas: 0 });
      }
      return clienteFinanceiroMap.get(clienteId)!;
    };

    // Agregar Parcelas de Orçamentos
    parcelasData.forEach(p => {
      // Tentar resolver clienteId através do orçamento
      const orc = orcamentosData.find(o => o.id === p.orcamentoId);
      const clienteAgg = getClienteAgg(orc?.clienteId);

      if (p.statusPagamento === 'Pago') {
        const received = p.valorPago || p.valor;
        receitasPagas += received;
        if (clienteAgg) clienteAgg.receitas += received;
      } else {
        const outstanding = Math.max(0, p.valor - (p.valorPago || 0));
        contasAReceber += outstanding;
        const venc = p.dataVencimento || '';
        if (venc < hoje && venc !== '') {
          inadimplencia += outstanding;
        }
      }
    });

    // Agregar Orçamentos sem Parcelas
    orcamentosData.forEach(orc => {
      if (orcamentosComParcelas.has(orc.id)) return;
      const clienteAgg = getClienteAgg(orc.clienteId);

      if (normalizeBudgetStatus(orc.status) === 'aprovado' && orc.dataPagamento) {
        receitasPagas += orc.valorTotal;
        if (clienteAgg) clienteAgg.receitas += orc.valorTotal;
      } else if (normalizeBudgetStatus(orc.status) === 'aprovado') {
        contasAReceber += orc.valorTotal;
        const v = orc.dataPagamento || orc.dataCompetencia || '';
        if (v < hoje && v !== '') {
          inadimplencia += orc.valorTotal;
        }
      }
    });

    let despesasPagas = 0;
    let contasAPagar = 0;
    let custosFixos = 0;
    let custosVariaveis = 0;
    let tributario = 0;
    let cartorioTaxas = 0;
    let reembolsaveis = 0;

    despesasData.forEach(d => {
      const clienteAgg = getClienteAgg(d.clienteId);

      if (d.status === 'Pago') {
        despesasPagas += d.valor;
        if (clienteAgg) clienteAgg.despesas += d.valor;
      } else {
        contasAPagar += d.valor;
      }

      // Detalhamento de saídas (geral/pago)
      if (d.tipoCusto === 'Fixo') custosFixos += d.valor;
      if (d.tipoCusto === 'Variável') custosVariaveis += d.valor;
      if (d.categoria?.includes('Tribut')) tributario += d.valor;
      if (d.categoria?.includes('Cartório') || d.categoria?.includes('Taxa')) cartorioTaxas += d.valor;
      if (d.reembolsavel === true) reembolsaveis += d.valor;
    });

    const margemPorCliente = Array.from(clienteFinanceiroMap.entries()).map(([cid, agg]) => {
      const result = agg.receitas - agg.despesas;
      const margem = agg.receitas > 0 ? (result / agg.receitas) * 100 : 0;
      return {
        clienteId: cid,
        clienteNome: clientesMap.get(cid) || 'Cliente Indefinido',
        receitas: agg.receitas,
        despesas: agg.despesas,
        resultado: result,
        margemPorcentagem: Number(margem.toFixed(2))
      };
    }).sort((a, b) => b.receitas - a.receitas);

    return {
      kpis: {
        receitasPagas,
        despesasPagas,
        resultadoCaixa: receitasPagas - despesasPagas,
        contasAReceber,
        contasAPagar,
        inadimplencia
      },
      detalhamento: {
        custosFixos,
        custosVariaveis,
        tributario,
        cartorioTaxas,
        reembolsaveis
      },
      margemPorCliente
    };
  });
}
