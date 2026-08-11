import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, sql, isNull, and, desc, count } from 'drizzle-orm';
import crypto from 'crypto';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { normalizeBudgetStatus } from '@geogestor/contracts';
import { LegacyFinanceDomainService } from '../services/legacy-finance-domain.service';
import { activeDocumentWhere } from '../services/document-integrity.service';
import {
  centsSchema,
  isoDateSchema,
  legacyBudgetCostSchema,
  legacyBudgetItemSchema,
  nullableCentsSchema,
  nullableDateSchema
} from './financeiro.schemas';
import {
  calculateInstallmentSettlement,
  calculateReceiptCash,
  normalizeExpenseCategoryCode
} from '../services/managerial-finance-domain.service';

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((valueInCents || 0) / 100);

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type IdParams = { id: string };

async function syncInstallmentSettlement(tx: any, parcelaId: string) {
  const [parcela] = await tx.select().from(schema.parcelas)
    .where(eq(schema.parcelas.id, parcelaId)).limit(1);
  if (!parcela) throw new Error('Parcela não encontrada');

  const activeReceipts = await tx.select().from(schema.recebimentos).where(and(
    eq(schema.recebimentos.parcelaId, parcelaId),
    isNull(schema.recebimentos.deletedAt),
    isNull(schema.recebimentos.estornadoEm)
  ));
  const settlement = calculateInstallmentSettlement(
    parcela.valor,
    activeReceipts.map((item: typeof schema.recebimentos.$inferSelect) => item.valorPrincipal)
  );
  const lastReceipt = activeReceipts
    .slice()
    .sort((a: typeof schema.recebimentos.$inferSelect, b: typeof schema.recebimentos.$inferSelect) =>
      b.dataRecebimento.localeCompare(a.dataRecebimento)
    )[0];

  const [updated] = await tx.update(schema.parcelas).set({
    valorPago: settlement.valorPago,
    statusPagamento: settlement.status,
    dataPagamento: settlement.status === 'Pago' ? lastReceipt?.dataRecebimento || null : null,
    updatedAt: new Date().toISOString()
  }).where(eq(schema.parcelas.id, parcelaId)).returning();
  return updated;
}

export async function financeiroRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();
  
  // Orçamentos
  zServer.get('/orcamentos', {
    schema: {
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(500).default(100),
        clienteId: z.string().uuid().optional(),
        mode: z.enum(['legacy', 'page']).default('legacy')
      })
    }
  }, async (request, reply) => {
    const { page, limit, mode } = request.query;
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
    let items = data as Array<(typeof data)[number] & { itens?: unknown[]; despesas?: unknown[] }>;
    if (orcIds.length > 0) {
      // Itens
      const allItens = await db.select().from(schema.orcamento_itens).where(sql`orcamento_id IN ${orcIds}`);
      // Despesas
      const allDespesas = await db.select().from(schema.orcamento_despesas).where(sql`orcamento_id IN ${orcIds}`);

      items = data.map(orc => ({
        ...orc,
        itens: allItens.filter(i => i.orcamentoId === orc.id),
        despesas: allDespesas.filter(d => d.orcamentoId === orc.id)
      }));
    }
    if (mode === 'legacy') return items;
    const where = and(
      isNull(schema.orcamentos.deletedAt),
      request.query.clienteId ? eq(schema.orcamentos.clienteId, request.query.clienteId) : undefined
    );
    const [{ total }] = await db.select({ total: count() }).from(schema.orcamentos).where(where);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
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

    const calculation = LegacyFinanceDomainService.calculate({
      requestedTotalCents: data.valorTotal,
      discountCents: data.desconto,
      items: data.itens,
      costs: data.despesas
    });
    const orcamento = await db.transaction(async (tx) => {
      const orc = await tx.insert(schema.orcamentos).values({
        id: crypto.randomUUID(),
        clienteId: data.clienteId,
        projetoId,
        valorTotal: calculation.totalCents,
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
        for (const [index, item] of data.itens.entries()) {
          await tx.insert(schema.orcamento_itens).values({
            id: crypto.randomUUID(),
            orcamentoId: orc[0].id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            total: calculation.itemTotals[index]
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
      const calculation = data.itens !== undefined
        ? LegacyFinanceDomainService.calculate({
            requestedTotalCents: data.valorTotal ?? oldOrcamento[0].valorTotal,
            discountCents: data.desconto !== undefined ? data.desconto : oldOrcamento[0].desconto,
            items: data.itens,
            costs: data.despesas
          })
        : null;
      const nextTotal = calculation?.totalCents ?? data.valorTotal;
      if (nextTotal !== undefined && nextTotal !== oldOrcamento[0].valorTotal) {
        changes.push(`Valor: ${formatCurrency(oldOrcamento[0].valorTotal)} -> ${formatCurrency(nextTotal)}`);
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
          valorTotal: nextTotal !== undefined ? nextTotal : undefined,
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
          for (const [index, item] of data.itens.entries()) {
            await tx.insert(schema.orcamento_itens).values({
              id: crypto.randomUUID(),
              orcamentoId: id,
              descricao: item.descricao,
              quantidade: item.quantidade,
              valorUnitario: item.valorUnitario,
              total: calculation?.itemTotals[index] ?? Math.round(item.quantidade * item.valorUnitario)
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
        recebidoCaixa: sql<number>`coalesce((
          select sum(r.valor_recebido)
          from recebimentos r
          where r.parcela_id = ${schema.parcelas.id}
            and r.deleted_at is null
            and r.estornado_em is null
        ), 0)`,
        dataVencimento: schema.parcelas.dataVencimento,
        dataPagamento: schema.parcelas.dataPagamento,
        statusPagamento: schema.parcelas.statusPagamento,
        clienteNome: schema.clientes.nome,
        clienteId: schema.clientes.id,
        projetoId: schema.orcamentos.projetoId,
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
    const installmentIds = data.map(item => item.id);
    const receipts = installmentIds.length ? await db.select({
      parcelaId: schema.recebimentos.parcelaId,
      valorRecebido: schema.recebimentos.valorRecebido,
      dataRecebimento: schema.recebimentos.dataRecebimento
    }).from(schema.recebimentos).where(and(
      sql`${schema.recebimentos.parcelaId} IN ${installmentIds}`,
      isNull(schema.recebimentos.deletedAt),
      isNull(schema.recebimentos.estornadoEm)
    )) : [];
    return data.map(item => ({
      ...item,
      recebimentos: receipts.filter(receipt => receipt.parcelaId === item.id)
    }));
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
      statusPagamento: z.enum(['Pendente', 'Pago']).optional()
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
    const existingInstallments = await db.select().from(schema.parcelas).where(and(
      eq(schema.parcelas.orcamentoId, data.orcamentoId),
      isNull(schema.parcelas.deletedAt),
      isNull(schema.parcelas.canceladaEm)
    ));
    const scheduledTotal = existingInstallments.reduce((sum, item) => sum + item.valor, 0);
    if (scheduledTotal + data.valor > sourceBudget[0].valorTotal) {
      return reply.status(409).send({
        error: `A nova parcela ultrapassa o saldo contratual de ${formatCurrency(sourceBudget[0].valorTotal - scheduledTotal)}.`
      });
    }
    const parcela = await db.transaction(async (tx) => {
      const [created] = await tx.insert(schema.parcelas).values({
        id: crypto.randomUUID(),
        orcamentoId: data.orcamentoId,
        valor: data.valor,
        dataVencimento: data.dataVencimento,
        dataPagamento: null,
        statusPagamento: 'Pendente',
        valorPago: 0,
        tipoValor: 'recebivel_previsto'
      }).returning();
      let settled = created;
      if (data.statusPagamento === 'Pago') {
        const receiptData = calculateReceiptCash({ valorPrincipal: data.valor });
        const [receipt] = await tx.insert(schema.recebimentos).values({
          id: crypto.randomUUID(),
          parcelaId: created.id,
          ...receiptData,
          dataRecebimento: data.dataPagamento || todayKey(),
          observacoes: 'Recebimento registrado com a criação da conta a receber.'
        }).returning();
        await tx.insert(schema.financeiroEventos).values({
          id: crypto.randomUUID(),
          tipo: 'recebimento',
          entidade: 'recebimento',
          entidadeId: receipt.id,
          clienteId: sourceBudget[0].clienteId,
          projetoId: sourceBudget[0].projetoId,
          valor: receipt.valorRecebido,
          dataEvento: receipt.dataRecebimento,
          motivo: 'Recebimento registrado com a criação da conta a receber'
        });
        settled = await syncInstallmentSettlement(tx, created.id);
      }
      const [orcamento] = await tx.select().from(schema.orcamentos)
        .where(eq(schema.orcamentos.id, created.orcamentoId)).limit(1);
      await AuditLogService.log('INSERT', 'Parcela', null, settled, tx);
      if (orcamento) {
        await JornadaService.logClienteEvento({
          clienteId: orcamento.clienteId,
          projetoId: orcamento.projetoId || null,
          orcamentoId: orcamento.id,
          tipo: 'Financeiro',
          titulo: `Parcela registrada: ${formatCurrency(settled.valor)}`,
          categoria: 'Fatura',
          descricao: `Vencimento: ${settled.dataVencimento}\nStatus: ${settled.statusPagamento}`
        }, tx);
      }
      return settled;
    });
    return parcela;
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
    if (data.statusPagamento === 'Pendente' && parcelaAnterior[0].valorPago > 0) {
      return reply.status(409).send({
        error: 'Uma parcela com recebimento não pode ser reaberta diretamente. Estorne os recebimentos vinculados.'
      });
    }

    const parcela = await db.transaction(async (tx) => {
      if (data.statusPagamento === 'Pago') {
        const saldo = parcelaAnterior[0].valor - parcelaAnterior[0].valorPago;
        if (saldo > 0) {
          const receiptData = calculateReceiptCash({ valorPrincipal: saldo });
          const [orcamentoOrigem] = await tx.select().from(schema.orcamentos)
            .where(eq(schema.orcamentos.id, parcelaAnterior[0].orcamentoId)).limit(1);
          const [receipt] = await tx.insert(schema.recebimentos).values({
            id: crypto.randomUUID(),
            parcelaId: id,
            ...receiptData,
            dataRecebimento: data.dataPagamento || todayKey(),
            meioPagamento: parcelaAnterior[0].meioPagamento || null,
            observacoes: 'Liquidação integral registrada pela ação rápida.'
          }).returning();
          await tx.insert(schema.financeiroEventos).values({
            id: crypto.randomUUID(),
            tipo: 'recebimento',
            entidade: 'recebimento',
            entidadeId: receipt.id,
            clienteId: orcamentoOrigem?.clienteId || null,
            projetoId: orcamentoOrigem?.projetoId || null,
            valor: receipt.valorRecebido,
            dataEvento: receipt.dataRecebimento,
            motivo: 'Liquidação integral da conta a receber'
          });
          await AuditLogService.log('INSERT', 'Recebimento', null, receipt, tx);
        }
      }
      const updated = data.statusPagamento === 'Pago'
        ? await syncInstallmentSettlement(tx, id)
        : (await tx.update(schema.parcelas).set({
          dataPagamento: data.dataPagamento !== undefined ? data.dataPagamento : undefined,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.parcelas.id, id)).returning())[0];
      await AuditLogService.log('UPDATE', 'Parcela', parcelaAnterior[0], updated, tx);
      if (data.statusPagamento !== parcelaAnterior[0].statusPagamento) {
        const [orcamento] = await tx.select().from(schema.orcamentos)
          .where(eq(schema.orcamentos.id, updated.orcamentoId)).limit(1);
        if (orcamento) {
          await JornadaService.logClienteEvento({
            clienteId: orcamento.clienteId,
            projetoId: orcamento.projetoId || null,
            orcamentoId: orcamento.id,
            tipo: 'Financeiro',
            titulo: data.statusPagamento === 'Pago'
              ? `Pagamento confirmado: ${formatCurrency(updated.valorPago)}`
              : `Status da fatura atualizado: ${data.statusPagamento}`,
            categoria: 'Fatura',
            descricao: `Parcela com vencimento em ${updated.dataVencimento}\nStatus: ${parcelaAnterior[0].statusPagamento} -> ${updated.statusPagamento}`
          }, tx);
        }
      }
      return updated;
    });
    return parcela;
  });

  server.get('/parcelas/:id/recebimentos', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parcela = await db.select({ id: schema.parcelas.id }).from(schema.parcelas)
      .where(and(eq(schema.parcelas.id, id), isNull(schema.parcelas.deletedAt))).limit(1);
    if (!parcela.length) return reply.status(404).send({ error: 'Parcela não encontrada' });
    return db.select().from(schema.recebimentos)
      .where(and(eq(schema.recebimentos.parcelaId, id), isNull(schema.recebimentos.deletedAt)))
      .orderBy(desc(schema.recebimentos.dataRecebimento), desc(schema.recebimentos.createdAt));
  });

  zServer.get('/comprovantes', {
    schema: {
      querystring: z.object({
        clienteId: z.string().uuid(),
        projetoId: z.string().uuid().optional()
      })
    }
  }, async (request) => {
    const { clienteId, projetoId } = request.query;
    return db.select({
      id: schema.documentos.id,
      nome: schema.documentos.nome,
      extensao: schema.documentos.extensao,
      projetoId: schema.documentos.projetoId,
      tamanhoBytes: schema.documentos.tamanhoBytes,
      updatedAt: schema.documentos.updatedAt
    }).from(schema.documentos).where(and(
      eq(schema.documentos.clienteId, clienteId),
      activeDocumentWhere(),
      projetoId
        ? sql`${schema.documentos.projetoId} is null OR ${schema.documentos.projetoId} = ${projetoId}`
        : isNull(schema.documentos.projetoId)
    )).orderBy(desc(schema.documentos.updatedAt));
  });

  server.post('/parcelas/:id/recebimentos', async (request, reply) => {
    const { id } = request.params as IdParams;
    const bodySchema = z.object({
      valorPrincipal: centsSchema.refine((value) => value > 0, 'Informe um valor principal maior que zero.'),
      juros: centsSchema.optional().default(0),
      multa: centsSchema.optional().default(0),
      desconto: centsSchema.optional().default(0),
      taxas: centsSchema.optional().default(0),
      valorRecebido: centsSchema.optional(),
      dataRecebimento: isoDateSchema,
      meioPagamento: z.string().trim().max(100).nullable().optional(),
      observacoes: z.string().trim().max(2000).nullable().optional(),
      comprovanteDocumentoId: z.string().uuid().nullable().optional()
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }
    const input = parsed.data;
    let receiptData: ReturnType<typeof calculateReceiptCash>;
    try {
      receiptData = calculateReceiptCash(input);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Recebimento inválido' });
    }
    if (input.valorRecebido !== undefined && input.valorRecebido !== receiptData.valorRecebido) {
      return reply.status(400).send({
        error: 'O valor recebido deve corresponder ao principal, juros, multa, desconto e taxas informados.'
      });
    }

    const [source] = await db.select({
      parcela: schema.parcelas,
      clienteId: schema.orcamentos.clienteId,
      projetoId: schema.orcamentos.projetoId
    }).from(schema.parcelas)
      .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
      .where(and(
        eq(schema.parcelas.id, id),
        isNull(schema.parcelas.deletedAt),
        isNull(schema.parcelas.canceladaEm),
        isNull(schema.orcamentos.deletedAt)
      )).limit(1);
    if (!source) return reply.status(404).send({ error: 'Conta a receber não encontrada' });

    if (input.comprovanteDocumentoId) {
      const [document] = await db.select().from(schema.documentos).where(and(
        eq(schema.documentos.id, input.comprovanteDocumentoId),
        activeDocumentWhere()
      )).limit(1);
      if (!document) return reply.status(400).send({ error: 'Comprovante não encontrado' });
      if (document.clienteId !== source.clienteId) {
        return reply.status(400).send({ error: 'O comprovante não pertence ao cliente da conta a receber.' });
      }
      if (document.projetoId && source.projetoId && document.projetoId !== source.projetoId) {
        return reply.status(400).send({ error: 'O comprovante pertence a outro projeto.' });
      }
    }

    const activeReceipts = await db.select().from(schema.recebimentos).where(and(
      eq(schema.recebimentos.parcelaId, id),
      isNull(schema.recebimentos.deletedAt),
      isNull(schema.recebimentos.estornadoEm)
    ));
    const principalPaid = activeReceipts.reduce((sum, item) => sum + item.valorPrincipal, 0);
    if (principalPaid + input.valorPrincipal > source.parcela.valor) {
      return reply.status(409).send({
        error: `O recebimento ultrapassa o saldo principal de ${formatCurrency(source.parcela.valor - principalPaid)}.`
      });
    }

    const result = await db.transaction(async (tx) => {
      const [receipt] = await tx.insert(schema.recebimentos).values({
        id: crypto.randomUUID(),
        parcelaId: id,
        ...receiptData,
        dataRecebimento: input.dataRecebimento,
        meioPagamento: input.meioPagamento || null,
        observacoes: input.observacoes || null,
        comprovanteDocumentoId: input.comprovanteDocumentoId || null
      }).returning();
      await tx.insert(schema.financeiroEventos).values({
        id: crypto.randomUUID(),
        tipo: 'recebimento',
        entidade: 'recebimento',
        entidadeId: receipt.id,
        clienteId: source.clienteId,
        projetoId: source.projetoId,
        valor: receipt.valorRecebido,
        dataEvento: receipt.dataRecebimento,
        motivo: 'Recebimento registrado'
      });
      const installment = await syncInstallmentSettlement(tx, id);
      await AuditLogService.log('INSERT', 'Recebimento', null, receipt, tx);
      return { recebimento: receipt, parcela: installment };
    });
    return reply.status(201).send(result);
  });

  server.post('/recebimentos/:id/estorno', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      motivo: z.string().trim().min(5, 'Informe o motivo do estorno.').max(1000),
      dataEstorno: isoDateSchema.optional()
    }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }
    const [receipt] = await db.select().from(schema.recebimentos).where(and(
      eq(schema.recebimentos.id, id),
      isNull(schema.recebimentos.deletedAt)
    )).limit(1);
    if (!receipt) return reply.status(404).send({ error: 'Recebimento não encontrado' });
    if (receipt.estornadoEm) return reply.status(409).send({ error: 'Este recebimento já foi estornado.' });

    const [source] = await db.select({
      clienteId: schema.orcamentos.clienteId,
      projetoId: schema.orcamentos.projetoId
    }).from(schema.parcelas)
      .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
      .where(eq(schema.parcelas.id, receipt.parcelaId)).limit(1);
    const estornadoEm = parsed.data.dataEstorno || todayKey();
    const result = await db.transaction(async (tx) => {
      const [updatedReceipt] = await tx.update(schema.recebimentos).set({
        estornadoEm,
        motivoEstorno: parsed.data.motivo,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.recebimentos.id, id)).returning();
      await tx.insert(schema.financeiroEventos).values({
        id: crypto.randomUUID(),
        tipo: 'estorno_recebimento',
        entidade: 'recebimento',
        entidadeId: id,
        clienteId: source?.clienteId || null,
        projetoId: source?.projetoId || null,
        valor: -receipt.valorRecebido,
        dataEvento: estornadoEm,
        motivo: parsed.data.motivo,
        metadataJson: JSON.stringify({ recebimentoOriginalId: id })
      });
      const installment = await syncInstallmentSettlement(tx, receipt.parcelaId);
      await AuditLogService.log('UPDATE', 'Recebimento', receipt, updatedReceipt, tx);
      return { recebimento: updatedReceipt, parcela: installment };
    });
    return result;
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
        viagemId: schema.despesas.viagemId,
        descricao: schema.despesas.descricao,
        fornecedor: schema.despesas.fornecedor,
        numeroDocumento: schema.despesas.numeroDocumento,
        valor: schema.despesas.valor,
        data: schema.despesas.data,
        dataCompetencia: schema.despesas.dataCompetencia,
        dataPagamento: schema.despesas.dataPagamento,
        categoria: schema.despesas.categoria,
        categoriaCodigo: schema.despesas.categoriaCodigo,
        tipoCusto: schema.despesas.tipoCusto,
        centroCusto: schema.despesas.centroCusto,
        reembolsavel: schema.despesas.reembolsavel,
        comprovanteDocumentoId: schema.despesas.comprovanteDocumentoId,
        observacoes: schema.despesas.observacoes,
        status: schema.despesas.status,
        formaPagamento: schema.despesas.formaPagamento,
        canceladaEm: schema.despesas.canceladaEm,
        motivoCancelamento: schema.despesas.motivoCancelamento,
        estornadaEm: schema.despesas.estornadaEm,
        motivoEstorno: schema.despesas.motivoEstorno,
        createdAt: schema.despesas.createdAt,
        updatedAt: schema.despesas.updatedAt
      })
      .from(schema.despesas)
      .leftJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, sql`${schema.clientes.id} = coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId})`)
      .where(isNull(schema.despesas.deletedAt));
    return data;
  });

  server.post('/despesas', async (request, reply) => {
    const bodySchema = z.object({
      clienteId: z.string().nullable().optional(),
      projetoId: z.string().nullable().optional(),
      viagemId: z.string().uuid().nullable().optional(),
      descricao: z.string().min(1, 'Descrição é obrigatória'),
      fornecedor: z.string().nullable().optional(),
      numeroDocumento: z.string().nullable().optional(),
      valor: z.number({ required_error: 'Valor é obrigatório' }).min(1, 'Valor deve ser maior que zero'),
      data: z.string().min(1, 'Data é obrigatória'),
      dataCompetencia: z.string().nullable().optional(),
      dataPagamento: z.string().nullable().optional(),
      categoria: z.string().min(1, 'Categoria é obrigatória'),
      categoriaCodigo: z.string().trim().max(80).nullable().optional(),
      tipoCusto: z.string().nullable().optional(),
      centroCusto: z.string().nullable().optional(),
      reembolsavel: z.boolean().optional(),
      comprovanteDocumentoId: z.string().nullable().optional(),
      documentoIds: z.array(z.string().uuid()).max(20).optional(),
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

    if (data.viagemId) {
      const [viagem] = await db.select().from(schema.viagens).where(and(
        eq(schema.viagens.id, data.viagemId),
        isNull(schema.viagens.deletedAt)
      )).limit(1);
      if (!viagem) return reply.status(400).send({ error: 'Viagem vinculada não encontrada.' });
      if (projetoId && viagem.projetoId && viagem.projetoId !== projetoId) {
        return reply.status(400).send({ error: 'A viagem pertence a outro projeto.' });
      }
      if (clienteId && viagem.clienteId && viagem.clienteId !== clienteId) {
        return reply.status(400).send({ error: 'A viagem pertence a outro cliente.' });
      }
      clienteId = clienteId || viagem.clienteId;
    }

    const documentIds = Array.from(new Set([
      ...(data.documentoIds || []),
      ...(data.comprovanteDocumentoId ? [data.comprovanteDocumentoId] : [])
    ]));
    const validatedDocuments: Array<typeof schema.documentos.$inferSelect> = [];
    for (const documentId of documentIds) {
      const [document] = await db.select().from(schema.documentos).where(and(
        eq(schema.documentos.id, documentId),
        activeDocumentWhere()
      )).limit(1);
      if (!document) return reply.status(400).send({ error: 'Um dos comprovantes não foi encontrado.' });
      if (clienteId && document.clienteId !== clienteId) {
        return reply.status(400).send({ error: 'O comprovante não pertence ao cliente da despesa.' });
      }
      if (projetoId && document.projetoId && document.projetoId !== projetoId) {
        return reply.status(400).send({ error: 'O comprovante pertence a outro projeto.' });
      }
      validatedDocuments.push(document);
    }

    const despesa = await db.transaction(async (tx) => {
      const created = await tx.insert(schema.despesas).values({
        id: crypto.randomUUID(),
        clienteId,
        projetoId,
        viagemId: data.viagemId || null,
        descricao: data.descricao,
        fornecedor: data.fornecedor || null,
        numeroDocumento: data.numeroDocumento || null,
        valor: data.valor,
        data: data.data,
        dataCompetencia: data.dataCompetencia || null,
        dataPagamento: data.dataPagamento || (data.status === 'Pago' ? todayKey() : null),
        categoria: data.categoria,
        categoriaCodigo: data.categoriaCodigo || normalizeExpenseCategoryCode(data.categoria),
        tipoCusto: data.tipoCusto || null,
        centroCusto: data.centroCusto || null,
        reembolsavel: data.reembolsavel !== undefined ? data.reembolsavel : false,
        comprovanteDocumentoId: data.comprovanteDocumentoId || null,
        observacoes: data.observacoes || null,
        status: data.status || 'Pendente',
        formaPagamento: data.formaPagamento || null
      }).returning();
      for (const document of validatedDocuments) {
        await tx.insert(schema.despesaDocumentos).values({
          id: crypto.randomUUID(),
          despesaId: created[0].id,
          documentoId: document.id,
          tipo: 'comprovante'
        });
      }
      await AuditLogService.log('INSERT', 'Despesa', null, created[0], tx);
      if (created[0].clienteId) {
        await JornadaService.logClienteEvento({
          clienteId: created[0].clienteId,
          projetoId: created[0].projetoId || null,
          tipo: 'Financeiro',
          titulo: `Despesa registrada: ${created[0].descricao}`,
          categoria: 'Despesa',
          descricao: [
            `Valor: ${formatCurrency(created[0].valor)}`,
            `Categoria: ${created[0].categoria}`,
            created[0].tipoCusto ? `Tipo de custo: ${created[0].tipoCusto}` : null,
            created[0].centroCusto ? `Centro de custo: ${created[0].centroCusto}` : null,
            `Vencimento: ${created[0].data}`,
            `Status: ${created[0].status || 'Pendente'}`
          ].filter(Boolean).join('\n')
        }, tx);
      }
      return created[0];
    });
    return despesa;
  });

  server.patch('/despesas/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as IdParams;
    
    const bodySchema = z.object({
      clienteId: z.string().nullable().optional(),
      projetoId: z.string().nullable().optional(),
      viagemId: z.string().uuid().nullable().optional(),
      descricao: z.string().min(1, 'Descrição não pode ser vazia').optional(),
      fornecedor: z.string().nullable().optional(),
      numeroDocumento: z.string().nullable().optional(),
      valor: z.number().min(1, 'Valor deve ser maior que zero').optional(),
      data: z.string().min(1, 'Data não pode ser vazia').optional(),
      dataCompetencia: z.string().nullable().optional(),
      dataPagamento: z.string().nullable().optional(),
      categoria: z.string().min(1, 'Categoria não pode ser vazia').optional(),
      categoriaCodigo: z.string().trim().max(80).nullable().optional(),
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
      if (oldDespesa[0].deletedAt || oldDespesa[0].canceladaEm || oldDespesa[0].estornadaEm) {
        return reply.status(409).send({ error: 'Uma despesa cancelada, estornada ou excluída não pode ser editada.' });
      }
      if ((oldDespesa[0].status || '').toLowerCase() === 'pago' && (
        data.valor !== undefined
        || (data.status !== undefined && data.status !== 'Pago')
        || data.dataPagamento !== undefined
      )) {
        return reply.status(409).send({
          error: 'Valores e baixa de uma despesa paga não podem ser reescritos. Registre um estorno.'
        });
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
      if (data.viagemId) {
        const [viagem] = await db.select().from(schema.viagens).where(and(
          eq(schema.viagens.id, data.viagemId),
          isNull(schema.viagens.deletedAt)
        )).limit(1);
        if (!viagem) return reply.status(400).send({ error: 'Viagem vinculada não encontrada.' });
        if (nextProjetoId && viagem.projetoId && viagem.projetoId !== nextProjetoId) {
          return reply.status(400).send({ error: 'A viagem pertence a outro projeto.' });
        }
        if (nextClienteId && viagem.clienteId && viagem.clienteId !== nextClienteId) {
          return reply.status(400).send({ error: 'A viagem pertence a outro cliente.' });
        }
        nextClienteId = nextClienteId || viagem.clienteId;
      }
      if (data.comprovanteDocumentoId) {
        const [document] = await db.select().from(schema.documentos).where(and(
          eq(schema.documentos.id, data.comprovanteDocumentoId),
          activeDocumentWhere()
        )).limit(1);
        if (!document) return reply.status(400).send({ error: 'Comprovante não encontrado.' });
        if (nextClienteId && document.clienteId !== nextClienteId) {
          return reply.status(400).send({ error: 'O comprovante não pertence ao cliente da despesa.' });
        }
      }

      const despesaAtualizada = await db.transaction(async (tx) => {
        const updated = await tx.update(schema.despesas).set({
        clienteId: data.clienteId !== undefined || data.projetoId !== undefined || data.viagemId !== undefined ? nextClienteId : undefined,
        projetoId: data.projetoId !== undefined ? (data.projetoId || null) : undefined,
        viagemId: data.viagemId !== undefined ? (data.viagemId || null) : undefined,
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
        categoriaCodigo: data.categoriaCodigo !== undefined
          ? (data.categoriaCodigo || normalizeExpenseCategoryCode(data.categoria || oldDespesa[0].categoria))
          : data.categoria !== undefined
            ? normalizeExpenseCategoryCode(data.categoria)
            : undefined,
        tipoCusto: data.tipoCusto !== undefined ? data.tipoCusto : undefined,
        centroCusto: data.centroCusto !== undefined ? data.centroCusto : undefined,
        reembolsavel: data.reembolsavel !== undefined ? data.reembolsavel : undefined,
        comprovanteDocumentoId: data.comprovanteDocumentoId !== undefined ? data.comprovanteDocumentoId : undefined,
        observacoes: data.observacoes !== undefined ? data.observacoes : undefined,
        status: data.status !== undefined ? data.status : undefined,
        formaPagamento: data.formaPagamento !== undefined ? data.formaPagamento : undefined,
        updatedAt: new Date().toISOString()
        }).where(eq(schema.despesas.id, id)).returning();

        if (data.comprovanteDocumentoId) {
          const existingLink = await tx.select({ id: schema.despesaDocumentos.id })
            .from(schema.despesaDocumentos)
            .where(and(
              eq(schema.despesaDocumentos.despesaId, id),
              eq(schema.despesaDocumentos.documentoId, data.comprovanteDocumentoId)
            )).limit(1);
          if (!existingLink.length) {
            await tx.insert(schema.despesaDocumentos).values({
              id: crypto.randomUUID(),
              despesaId: id,
              documentoId: data.comprovanteDocumentoId,
              tipo: 'comprovante'
            });
          }
        }
        await AuditLogService.log('UPDATE', 'Despesa', oldDespesa[0], updated[0], tx);

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

        if (changes.length && updated[0].clienteId) {
          await JornadaService.logClienteEvento({
          clienteId: updated[0].clienteId,
          projetoId: updated[0].projetoId || null,
          tipo: 'Financeiro',
          titulo: `Despesa atualizada: ${updated[0].descricao}`,
          categoria: 'Despesa',
          descricao: changes.join('\n')
          }, tx);
        }
        return updated[0];
      });

      return reply.send(despesaAtualizada);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar despesa' });
    }
  });

  server.get('/despesas/:id/documentos', async (request, reply) => {
    const { id } = request.params as IdParams;
    return db.select({
      id: schema.documentos.id,
      nome: schema.documentos.nome,
      extensao: schema.documentos.extensao,
      status: schema.documentos.status,
      deletedAt: schema.documentos.deletedAt,
      tipo: schema.despesaDocumentos.tipo,
      vinculoId: schema.despesaDocumentos.id
    }).from(schema.despesaDocumentos)
      .innerJoin(schema.documentos, eq(schema.despesaDocumentos.documentoId, schema.documentos.id))
      .where(eq(schema.despesaDocumentos.despesaId, id));
  });

  server.post('/despesas/:id/documentos', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      documentoId: z.string().uuid(),
      tipo: z.string().trim().max(80).optional().default('comprovante')
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    const [expense] = await db.select().from(schema.despesas).where(and(
      eq(schema.despesas.id, id),
      isNull(schema.despesas.deletedAt)
    )).limit(1);
    if (!expense) return reply.status(404).send({ error: 'Despesa não encontrada' });
    const [document] = await db.select().from(schema.documentos).where(and(
      eq(schema.documentos.id, parsed.data.documentoId),
      activeDocumentWhere()
    )).limit(1);
    if (!document) return reply.status(404).send({ error: 'Documento não encontrado' });
    if (expense.clienteId && document.clienteId !== expense.clienteId) {
      return reply.status(400).send({ error: 'O documento não pertence ao cliente da despesa.' });
    }
    if (expense.projetoId && document.projetoId && document.projetoId !== expense.projetoId) {
      return reply.status(400).send({ error: 'O documento pertence a outro projeto.' });
    }
    const existing = await db.select().from(schema.despesaDocumentos).where(and(
      eq(schema.despesaDocumentos.despesaId, id),
      eq(schema.despesaDocumentos.documentoId, document.id)
    )).limit(1);
    if (existing.length) return existing[0];
    const [created] = await db.insert(schema.despesaDocumentos).values({
      id: crypto.randomUUID(),
      despesaId: id,
      documentoId: document.id,
      tipo: parsed.data.tipo
    }).returning();
    return reply.status(201).send(created);
  });

  server.post('/despesas/:id/cancelamento', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      motivo: z.string().trim().min(5, 'Informe o motivo do cancelamento.').max(1000),
      dataCancelamento: isoDateSchema.optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    const [expense] = await db.select().from(schema.despesas).where(and(
      eq(schema.despesas.id, id),
      isNull(schema.despesas.deletedAt)
    )).limit(1);
    if (!expense) return reply.status(404).send({ error: 'Despesa não encontrada' });
    if ((expense.status || '').toLowerCase() === 'pago' || expense.dataPagamento) {
      return reply.status(409).send({ error: 'Uma despesa paga deve ser estornada, não cancelada.' });
    }
    if (expense.canceladaEm || expense.estornadaEm) {
      return reply.status(409).send({ error: 'A despesa já foi cancelada ou estornada.' });
    }
    const canceladaEm = parsed.data.dataCancelamento || todayKey();
    const [updated] = await db.transaction(async (tx) => {
      const result = await tx.update(schema.despesas).set({
        status: 'Cancelado',
        canceladaEm,
        motivoCancelamento: parsed.data.motivo,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.despesas.id, id)).returning();
      await tx.insert(schema.financeiroEventos).values({
        id: crypto.randomUUID(),
        tipo: 'cancelamento_despesa',
        entidade: 'despesa',
        entidadeId: id,
        clienteId: expense.clienteId,
        projetoId: expense.projetoId,
        valor: 0,
        dataEvento: canceladaEm,
        motivo: parsed.data.motivo
      });
      await AuditLogService.log('UPDATE', 'Despesa', expense, result[0], tx);
      return result;
    });
    return updated;
  });

  server.post('/despesas/:id/estorno', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      motivo: z.string().trim().min(5, 'Informe o motivo do estorno.').max(1000),
      dataEstorno: isoDateSchema.optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    const [expense] = await db.select().from(schema.despesas).where(and(
      eq(schema.despesas.id, id),
      isNull(schema.despesas.deletedAt)
    )).limit(1);
    if (!expense) return reply.status(404).send({ error: 'Despesa não encontrada' });
    if ((expense.status || '').toLowerCase() !== 'pago' || !expense.dataPagamento) {
      return reply.status(409).send({ error: 'Somente uma despesa paga pode ser estornada.' });
    }
    if (expense.estornadaEm) return reply.status(409).send({ error: 'A despesa já foi estornada.' });
    const estornadaEm = parsed.data.dataEstorno || todayKey();
    const [updated] = await db.transaction(async (tx) => {
      const result = await tx.update(schema.despesas).set({
        status: 'Estornado',
        estornadaEm,
        motivoEstorno: parsed.data.motivo,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.despesas.id, id)).returning();
      await tx.insert(schema.financeiroEventos).values({
        id: crypto.randomUUID(),
        tipo: 'estorno_despesa',
        entidade: 'despesa',
        entidadeId: id,
        clienteId: expense.clienteId,
        projetoId: expense.projetoId,
        valor: -expense.valor,
        dataEvento: estornadaEm,
        motivo: parsed.data.motivo,
        metadataJson: JSON.stringify({ despesaOriginalId: id })
      });
      await AuditLogService.log('UPDATE', 'Despesa', expense, result[0], tx);
      return result;
    });
    return updated;
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
      const [oldDespesa] = await db.select().from(schema.despesas)
        .where(and(eq(schema.despesas.id, id), isNull(schema.despesas.deletedAt))).limit(1);
      if (!oldDespesa) return reply.status(204).send();
      const status = (oldDespesa.status || 'Pendente').toLowerCase();
      if (status === 'pago' || oldDespesa.dataPagamento || oldDespesa.canceladaEm || oldDespesa.estornadaEm) {
        return reply.status(409).send({
          error: 'Esta despesa possui histórico financeiro e não pode ser excluída. Use cancelamento ou estorno.'
        });
      }
      await db.transaction(async (tx) => {
        if (oldDespesa.clienteId) {
          await JornadaService.logClienteEvento({
            clienteId: oldDespesa.clienteId,
            projetoId: oldDespesa.projetoId || null,
            tipo: 'Financeiro',
            titulo: `Despesa excluída: ${oldDespesa.descricao}`,
            categoria: 'Despesa',
            descricao: [
              `Valor: ${formatCurrency(oldDespesa.valor)}`,
              `Categoria: ${oldDespesa.categoria}`,
              `Status anterior: ${oldDespesa.status || 'Pendente'}`
            ].join('\n')
          }, tx);
        }

        const deletedAt = new Date().toISOString();
        await tx.update(schema.despesas).set({ deletedAt, updatedAt: deletedAt })
          .where(eq(schema.despesas.id, id));
        await AuditLogService.log('DELETE (SOFT)', 'Despesa', oldDespesa, null, tx);
      });

      return reply.status(204).send();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir despesa' });
    }
  });

  // Fluxo de caixa mensal gerencial. O endpoint /dre permanece apenas como alias legado.
  const monthlyCashFlowHandler = async () => {
    const orcamentosData = await db.select().from(schema.orcamentos)
      .where(isNull(schema.orcamentos.deletedAt));
    const despesasData = await db.select().from(schema.despesas)
      .where(and(
        isNull(schema.despesas.deletedAt),
        isNull(schema.despesas.canceladaEm),
        isNull(schema.despesas.estornadaEm)
      ));
    const parcelasData = await db.select().from(schema.parcelas)
      .where(and(isNull(schema.parcelas.deletedAt), isNull(schema.parcelas.canceladaEm)));
    const recebimentosData = await db.select().from(schema.recebimentos)
      .where(and(isNull(schema.recebimentos.deletedAt), isNull(schema.recebimentos.estornadoEm)));

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

    recebimentosData.forEach((recebimento) => {
      const dateValue = recebimento.dataRecebimento;
      const key = dateValue && dateValue.length >= 7 ? dateValue.substring(0, 7) : '';
      if (key && monthlyData[key] !== undefined) {
        monthlyData[key].receitas += recebimento.valorRecebido;
      }
    });
    const parcelasComRecebimento = new Set(recebimentosData.map((item) => item.parcelaId));
    parcelasData.forEach((parcela) => {
      if (parcela.statusPagamento !== 'Pago' || parcelasComRecebimento.has(parcela.id)) return;
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
  };
  server.get('/resumo-mensal', monthlyCashFlowHandler);
  server.get('/dre', monthlyCashFlowHandler);

  // Resumo Gerencial Avançado (KPIs, Contas a Pagar/Receber, Inadimplência, Margem por Cliente)
  server.get('/resumo-gerencial', async (request, reply) => {
    const orcamentosData = await db.select().from(schema.orcamentos)
      .where(isNull(schema.orcamentos.deletedAt));
    const despesasData = await db.select().from(schema.despesas)
      .where(and(
        isNull(schema.despesas.deletedAt),
        isNull(schema.despesas.canceladaEm),
        isNull(schema.despesas.estornadaEm)
      ));
    const parcelasData = await db.select().from(schema.parcelas)
      .where(and(isNull(schema.parcelas.deletedAt), isNull(schema.parcelas.canceladaEm)));
    const recebimentosData = await db.select().from(schema.recebimentos)
      .where(and(isNull(schema.recebimentos.deletedAt), isNull(schema.recebimentos.estornadoEm)));
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

    // Agregar caixa recebido por eventos de recebimento, inclusive pagamentos parciais.
    recebimentosData.forEach(recebimento => {
      const parcela = parcelasData.find(item => item.id === recebimento.parcelaId);
      const orc = parcela ? orcamentosData.find(item => item.id === parcela.orcamentoId) : undefined;
      const clienteAgg = getClienteAgg(orc?.clienteId);
      receitasPagas += recebimento.valorRecebido;
      if (clienteAgg) clienteAgg.receitas += recebimento.valorRecebido;
    });
    const parcelasComRecebimento = new Set(recebimentosData.map((item) => item.parcelaId));
    parcelasData.forEach((parcela) => {
      if (parcela.statusPagamento !== 'Pago' || parcelasComRecebimento.has(parcela.id)) return;
      const orc = orcamentosData.find(item => item.id === parcela.orcamentoId);
      const clienteAgg = getClienteAgg(orc?.clienteId);
      const legacyReceived = parcela.valorPago || parcela.valor;
      receitasPagas += legacyReceived;
      if (clienteAgg) clienteAgg.receitas += legacyReceived;
    });

    // Agregar saldos principais das contas a receber.
    parcelasData.forEach(p => {
      if (p.statusPagamento !== 'Pago') {
        const outstanding = Math.max(0, p.valor - p.valorPago);
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

  server.get('/viagens', async () => {
    const [travelRows, expenseRows] = await Promise.all([
      db.select({
        viagem: schema.viagens,
        clienteNome: schema.clientes.nome,
        projetoNome: schema.projetos.nome
      }).from(schema.viagens)
        .leftJoin(schema.clientes, eq(schema.viagens.clienteId, schema.clientes.id))
        .leftJoin(schema.projetos, eq(schema.viagens.projetoId, schema.projetos.id))
        .where(isNull(schema.viagens.deletedAt))
        .orderBy(desc(schema.viagens.dataInicio)),
      db.select().from(schema.despesas).where(and(
        isNull(schema.despesas.deletedAt),
        isNull(schema.despesas.canceladaEm),
        isNull(schema.despesas.estornadaEm)
      ))
    ]);
    return travelRows.map(({ viagem, clienteNome, projetoNome }) => {
      const related = expenseRows.filter((expense) => expense.viagemId === viagem.id);
      const totalGasto = related.reduce((sum, expense) => sum + expense.valor, 0);
      return {
        ...viagem,
        clienteNome,
        projetoNome,
        totalGasto,
        saldoPrestacao: viagem.adiantamento - totalGasto,
        despesasQuantidade: related.length
      };
    });
  });

  server.post('/viagens', async (request, reply) => {
    const parsed = z.object({
      clienteId: z.string().uuid().nullable().optional(),
      projetoId: z.string().uuid().nullable().optional(),
      finalidade: z.string().trim().min(1).max(300),
      destino: z.string().trim().min(1).max(300),
      dataInicio: isoDateSchema,
      dataFim: isoDateSchema.nullable().optional(),
      responsavel: z.string().trim().max(200).nullable().optional(),
      adiantamento: centsSchema.optional().default(0),
      quilometragem: z.number().min(0).max(1_000_000).optional().default(0),
      valorReembolsavel: centsSchema.optional().default(0),
      status: z.enum(['planejada', 'em_andamento', 'prestacao_pendente', 'encerrada', 'cancelada']).optional(),
      observacoes: z.string().trim().max(3000).nullable().optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    let clienteId = parsed.data.clienteId || null;
    if (parsed.data.dataFim && parsed.data.dataFim < parsed.data.dataInicio) {
      return reply.status(400).send({ error: 'A data final não pode ser anterior à data inicial.' });
    }
    if (parsed.data.projetoId) {
      const [project] = await db.select().from(schema.projetos).where(and(
        eq(schema.projetos.id, parsed.data.projetoId),
        isNull(schema.projetos.deletedAt)
      )).limit(1);
      if (!project) return reply.status(400).send({ error: 'Projeto não encontrado.' });
      if (clienteId && clienteId !== project.clienteId) {
        return reply.status(400).send({ error: 'O projeto não pertence ao cliente informado.' });
      }
      clienteId = project.clienteId;
    }
    const [created] = await db.transaction(async (tx) => {
      const result = await tx.insert(schema.viagens).values({
        id: crypto.randomUUID(),
        ...parsed.data,
        clienteId,
        projetoId: parsed.data.projetoId || null,
        dataFim: parsed.data.dataFim || null,
        responsavel: parsed.data.responsavel || null,
        status: parsed.data.status || 'planejada',
        observacoes: parsed.data.observacoes || null
      }).returning();
      await AuditLogService.log('INSERT', 'Viagem', null, result[0], tx);
      return result;
    });
    return reply.status(201).send(created);
  });

  server.patch('/viagens/:id', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      finalidade: z.string().trim().min(1).max(300).optional(),
      destino: z.string().trim().min(1).max(300).optional(),
      dataInicio: isoDateSchema.optional(),
      dataFim: isoDateSchema.nullable().optional(),
      responsavel: z.string().trim().max(200).nullable().optional(),
      adiantamento: centsSchema.optional(),
      quilometragem: z.number().min(0).max(1_000_000).optional(),
      valorReembolsavel: centsSchema.optional(),
      status: z.enum(['planejada', 'em_andamento', 'prestacao_pendente', 'encerrada', 'cancelada']).optional(),
      observacoes: z.string().trim().max(3000).nullable().optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    const [old] = await db.select().from(schema.viagens).where(and(
      eq(schema.viagens.id, id),
      isNull(schema.viagens.deletedAt)
    )).limit(1);
    if (!old) return reply.status(404).send({ error: 'Viagem não encontrada' });
    const nextStart = parsed.data.dataInicio || old.dataInicio;
    const nextEnd = parsed.data.dataFim !== undefined ? parsed.data.dataFim : old.dataFim;
    if (nextEnd && nextEnd < nextStart) {
      return reply.status(400).send({ error: 'A data final não pode ser anterior à data inicial.' });
    }
    const [updated] = await db.transaction(async (tx) => {
      const result = await tx.update(schema.viagens).set({
        ...parsed.data,
        encerradaEm: parsed.data.status === 'encerrada' ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.viagens.id, id)).returning();
      await AuditLogService.log('UPDATE', 'Viagem', old, result[0], tx);
      return result;
    });
    return updated;
  });

  server.get('/notas-fiscais', async () => {
    return db.select({
      nota: schema.notasFiscais,
      clienteNome: schema.clientes.nome,
      projetoNome: schema.projetos.nome,
      orcamentoCodigo: schema.orcamentos.codigoOrcamento
    }).from(schema.notasFiscais)
      .innerJoin(schema.clientes, eq(schema.notasFiscais.clienteId, schema.clientes.id))
      .leftJoin(schema.projetos, eq(schema.notasFiscais.projetoId, schema.projetos.id))
      .leftJoin(schema.orcamentos, eq(schema.notasFiscais.orcamentoId, schema.orcamentos.id))
      .where(isNull(schema.notasFiscais.deletedAt))
      .orderBy(desc(schema.notasFiscais.dataEmissao));
  });

  server.post('/notas-fiscais', async (request, reply) => {
    const parsed = z.object({
      clienteId: z.string().uuid(),
      projetoId: z.string().uuid().nullable().optional(),
      orcamentoId: z.string().uuid().nullable().optional(),
      documentoId: z.string().uuid().nullable().optional(),
      numero: z.string().trim().min(1).max(100),
      codigoVerificacao: z.string().trim().max(200).nullable().optional(),
      dataEmissao: isoDateSchema,
      valor: centsSchema.refine((value) => value > 0, 'O valor deve ser maior que zero.'),
      status: z.enum(['emitida', 'cancelada', 'substituida']).optional(),
      municipio: z.string().trim().max(200).nullable().optional(),
      link: z.string().url().max(2000).nullable().optional(),
      substituiNotaId: z.string().uuid().nullable().optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    const input = parsed.data;
    if (input.projetoId) {
      const [project] = await db.select().from(schema.projetos).where(eq(schema.projetos.id, input.projetoId)).limit(1);
      if (!project || project.clienteId !== input.clienteId) {
        return reply.status(400).send({ error: 'O projeto não pertence ao cliente informado.' });
      }
    }
    if (input.orcamentoId) {
      const [budget] = await db.select().from(schema.orcamentos).where(eq(schema.orcamentos.id, input.orcamentoId)).limit(1);
      if (!budget || budget.clienteId !== input.clienteId) {
        return reply.status(400).send({ error: 'O orçamento não pertence ao cliente informado.' });
      }
    }
    if (input.documentoId) {
      const [document] = await db.select().from(schema.documentos).where(and(eq(schema.documentos.id, input.documentoId), activeDocumentWhere())).limit(1);
      if (!document || document.clienteId !== input.clienteId) {
        return reply.status(400).send({ error: 'O documento não pertence ao cliente informado.' });
      }
    }
    const [created] = await db.transaction(async (tx) => {
      const result = await tx.insert(schema.notasFiscais).values({
        id: crypto.randomUUID(),
        ...input,
        projetoId: input.projetoId || null,
        orcamentoId: input.orcamentoId || null,
        documentoId: input.documentoId || null,
        codigoVerificacao: input.codigoVerificacao || null,
        status: input.status || 'emitida',
        municipio: input.municipio || null,
        link: input.link || null,
        substituiNotaId: input.substituiNotaId || null
      }).returning();
      await AuditLogService.log('INSERT', 'NotaFiscalInformada', null, result[0], tx);
      return result;
    });
    return reply.status(201).send(created);
  });

  server.post('/notas-fiscais/:id/cancelamento', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      motivo: z.string().trim().min(5).max(1000),
      dataCancelamento: isoDateSchema.optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    const [old] = await db.select().from(schema.notasFiscais).where(and(
      eq(schema.notasFiscais.id, id),
      isNull(schema.notasFiscais.deletedAt)
    )).limit(1);
    if (!old) return reply.status(404).send({ error: 'Documento fiscal não encontrado.' });
    if (old.canceladaEm) return reply.status(409).send({ error: 'O documento fiscal já está cancelado.' });
    const [updated] = await db.transaction(async (tx) => {
      const result = await tx.update(schema.notasFiscais).set({
        status: 'cancelada',
        canceladaEm: parsed.data.dataCancelamento || todayKey(),
        motivoCancelamento: parsed.data.motivo,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.notasFiscais.id, id)).returning();
      await AuditLogService.log('UPDATE', 'NotaFiscalInformada', old, result[0], tx);
      return result;
    });
    return updated;
  });

  server.get('/diagnostico-vinculos', async () => {
    const [
      despesasSemCliente,
      despesasProjetoOutroCliente,
      orcamentosProjetoOutroCliente,
      comprovantesOrfaos,
      documentosInconsistentes,
      decisoesCancelamentoPendentes
    ] = await Promise.all([
      db.select({ id: schema.despesas.id, descricao: schema.despesas.descricao })
        .from(schema.despesas)
        .leftJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
        .where(and(
          isNull(schema.despesas.deletedAt),
          sql`coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId}) is null`
        )),
      db.select({ id: schema.despesas.id, clienteId: schema.despesas.clienteId, projetoId: schema.despesas.projetoId })
        .from(schema.despesas)
        .innerJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
        .where(and(
          isNull(schema.despesas.deletedAt),
          sql`${schema.despesas.clienteId} is not null and ${schema.despesas.clienteId} <> ${schema.projetos.clienteId}`
        )),
      db.select({ id: schema.orcamentos.id, clienteId: schema.orcamentos.clienteId, projetoId: schema.orcamentos.projetoId })
        .from(schema.orcamentos)
        .innerJoin(schema.projetos, eq(schema.orcamentos.projetoId, schema.projetos.id))
        .where(and(
          isNull(schema.orcamentos.deletedAt),
          sql`${schema.orcamentos.clienteId} <> ${schema.projetos.clienteId}`
        )),
      db.select({ id: schema.despesaDocumentos.id, documentoId: schema.despesaDocumentos.documentoId })
        .from(schema.despesaDocumentos)
        .leftJoin(schema.documentos, eq(schema.despesaDocumentos.documentoId, schema.documentos.id))
        .where(sql`${schema.documentos.id} is null`),
      db.select({
        vinculoId: schema.despesaDocumentos.id,
        despesaId: schema.despesas.id,
        documentoId: schema.documentos.id
      }).from(schema.despesaDocumentos)
        .innerJoin(schema.despesas, eq(schema.despesaDocumentos.despesaId, schema.despesas.id))
        .innerJoin(schema.documentos, eq(schema.despesaDocumentos.documentoId, schema.documentos.id))
        .where(sql`${schema.despesas.clienteId} is not null and ${schema.despesas.clienteId} <> ${schema.documentos.clienteId}`),
      db.select({ id: schema.projetos.id, nome: schema.projetos.nome })
        .from(schema.projetos)
        .where(and(
          isNull(schema.projetos.deletedAt),
          sql`lower(${schema.projetos.status}) = 'cancelado'`,
          sql`not exists (
            select 1
            from projeto_financeiro_decisoes d
            where d.projeto_id = ${schema.projetos.id}
              and d.created_at >= coalesce((
                select max(e.created_at)
                from financeiro_eventos e
                where e.projeto_id = ${schema.projetos.id}
                  and e.tipo = 'cancelamento_projeto_pendente'
              ), '')
          )`
        ))
    ]);
    return {
      geradoEm: new Date().toISOString(),
      somenteDiagnostico: true,
      totais: {
        despesasSemCliente: despesasSemCliente.length,
        despesasProjetoOutroCliente: despesasProjetoOutroCliente.length,
        orcamentosProjetoOutroCliente: orcamentosProjetoOutroCliente.length,
        comprovantesOrfaos: comprovantesOrfaos.length,
        documentosInconsistentes: documentosInconsistentes.length,
        decisoesCancelamentoPendentes: decisoesCancelamentoPendentes.length
      },
      orientacoes: {
        despesasSemCliente: 'Despesas administrativas podem permanecer sem cliente; revise apenas quando o vínculo era esperado.',
        despesasProjetoOutroCliente: 'O cliente da despesa diverge do cliente do projeto e pode distorcer os painéis.',
        orcamentosProjetoOutroCliente: 'O orçamento e o projeto pertencem a clientes diferentes; corrija manualmente o vínculo.',
        comprovantesOrfaos: 'Há vínculo apontando para documento inexistente; localize ou remova somente o vínculo.',
        documentosInconsistentes: 'O comprovante pertence a outro cliente e não deve compor este lançamento.',
        decisoesCancelamentoPendentes: 'Abra o projeto cancelado e registre como cobranças, créditos ou devoluções devem ser tratados.'
      },
      registros: {
        despesasSemCliente,
        despesasProjetoOutroCliente,
        orcamentosProjetoOutroCliente,
        comprovantesOrfaos,
        documentosInconsistentes,
        decisoesCancelamentoPendentes
      }
    };
  });
}
