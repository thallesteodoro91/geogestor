import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import crypto from 'crypto';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, desc, eq, gte, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { databaseClientConfig, schema } from '@geogestor/database';
import { normalizeBudgetStatus } from '@geogestor/contracts';
import { db, dbPath } from '../db';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { activeDocumentWhere } from '../services/document-integrity.service';
import { centsSchema, entityIdSchema, isoDateSchema } from './financeiro.schemas';
import {
  calculateInstallmentSettlement,
  calculateReceiptCash
} from '../services/managerial-finance-domain.service';
import { PerformanceMetricsService } from '../services/performance-metrics.service';
import { errorMessages, withSqliteBusyRetry } from '../services/sqlite-concurrency.service';

type IdParams = { id: string };
type BudgetIdParams = { orcamentoId: string };
type SettlementTransaction = Pick<typeof db, 'select' | 'update'>;

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((valueInCents || 0) / 100);

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

async function syncInstallmentSettlement(tx: SettlementTransaction, parcelaId: string) {
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

export async function registerFinanceiroRecebimentoRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();
  const installmentListSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    mode: z.enum(['legacy', 'page']).default('legacy'),
    selectedId: entityIdSchema.optional(),
    q: z.string().trim().max(160).optional(),
    status: z.enum(['pendentes', 'recebidas']).optional(),
    dataInicio: isoDateSchema.optional(),
    dataFim: isoDateSchema.optional()
  }).strict().refine((value) => !value.dataInicio || !value.dataFim || value.dataInicio <= value.dataFim, {
    message: 'A data inicial não pode ser posterior à data final.',
    path: ['dataFim']
  });

  zServer.get('/parcelas', { schema: { querystring: installmentListSchema } }, async (request, reply) => {
    const query = request.query;
    if (query.mode === 'legacy') {
      reply.header('deprecation', 'true');
      PerformanceMetricsService.recordLegacyContract('GET /api/financeiro/parcelas');
    }
    const eligibleConditions: SQL[] = [
      isNull(schema.parcelas.deletedAt),
      isNull(schema.parcelas.canceladaEm),
      isNull(schema.orcamentos.deletedAt),
      sql`(${schema.parcelas.statusPagamento} = 'Pago' OR lower(${schema.orcamentos.status}) IN ('aprovado', 'pago'))`
    ];
    const conditions = [...eligibleConditions];
    if (query.selectedId) {
      conditions.push(eq(schema.parcelas.id, query.selectedId));
    } else if (query.q) {
      const term = `%${query.q}%`;
      const searchCondition = or(like(schema.clientes.nome, term), like(schema.orcamentos.descricao, term));
      if (searchCondition) conditions.push(searchCondition);
    }
    if (!query.selectedId) {
      if (query.status === 'pendentes') conditions.push(sql`${schema.parcelas.statusPagamento} <> 'Pago'`);
      if (query.status === 'recebidas') conditions.push(eq(schema.parcelas.statusPagamento, 'Pago'));
      if (query.dataInicio) conditions.push(gte(schema.parcelas.dataVencimento, query.dataInicio));
      if (query.dataFim) conditions.push(lte(schema.parcelas.dataVencimento, query.dataFim));
    }

    const baseQuery = () => db
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
      .where(and(...conditions));

    const [data, totalRows, summaryRows] = await Promise.all([
      query.mode === 'legacy'
        ? baseQuery().orderBy(desc(schema.parcelas.dataVencimento), desc(schema.parcelas.createdAt))
        : baseQuery().orderBy(desc(schema.parcelas.dataVencimento), desc(schema.parcelas.createdAt))
          .limit(query.limit).offset((query.page - 1) * query.limit),
      query.mode === 'legacy' ? Promise.resolve([{ total: 0 }]) : db.select({ total: sql<number>`count(*)` })
        .from(schema.parcelas)
        .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
        .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
        .where(and(...conditions)),
      query.mode === 'legacy' ? Promise.resolve([]) : db.select({
        faturamentoTotal: sql<number>`coalesce(sum(${schema.parcelas.valor}), 0)`,
        totalRecebido: sql<number>`coalesce(sum(coalesce(nullif((
          select sum(r.valor_recebido)
          from recebimentos r
          where r.parcela_id = ${schema.parcelas.id}
            and r.deleted_at is null
            and r.estornado_em is null
        ), 0), ${schema.parcelas.valorPago}, 0)), 0)`,
        totalPendente: sql<number>`coalesce(sum(case when ${schema.parcelas.statusPagamento} <> 'Pago' and ${schema.parcelas.dataVencimento} >= date('now', 'localtime') then max(0, ${schema.parcelas.valor} - ${schema.parcelas.valorPago}) else 0 end), 0)`,
        totalAtrasado: sql<number>`coalesce(sum(case when ${schema.parcelas.statusPagamento} <> 'Pago' and ${schema.parcelas.dataVencimento} < date('now', 'localtime') then max(0, ${schema.parcelas.valor} - ${schema.parcelas.valorPago}) else 0 end), 0)`
      }).from(schema.parcelas)
        .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
        .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
        .where(and(...conditions))
    ]);
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
    const receiptsByInstallment = new Map<string, typeof receipts>();
    for (const receipt of receipts) {
      const group = receiptsByInstallment.get(receipt.parcelaId);
      if (group) group.push(receipt);
      else receiptsByInstallment.set(receipt.parcelaId, [receipt]);
    }
    const items = data.map(item => ({
      ...item,
      recebimentos: receiptsByInstallment.get(item.id) || []
    }));
    if (query.mode === 'legacy') return items;
    const total = Number(totalRows[0]?.total || 0);
    const summary = summaryRows[0] || { faturamentoTotal: 0, totalRecebido: 0, totalPendente: 0, totalAtrasado: 0 };
    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
      summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value || 0)]))
    };
  });

  server.get('/parcelas/:orcamentoId', async (request, reply) => {
    const { orcamentoId } = request.params as BudgetIdParams;
    const data = await db.select().from(schema.parcelas).where(and(
      eq(schema.parcelas.orcamentoId, orcamentoId),
      isNull(schema.parcelas.deletedAt)
    ));
    return data;
  });

  server.post('/parcelas', async (request, reply) => {
    const bodySchema = z.object({
      orcamentoId: entityIdSchema,
      valor: centsSchema.refine((value) => value > 0, 'Valor inválido'),
      dataVencimento: isoDateSchema,
      dataPagamento: isoDateSchema.nullable().optional(),
      statusPagamento: z.enum(['Pendente', 'Pago']).optional()
    }).strict().refine((value) => !value.dataPagamento || value.statusPagamento === 'Pago', {
      message: 'A data de pagamento exige status Pago.',
      path: ['dataPagamento']
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
    const duplicate = existingInstallments.find((item) => item.valor === data.valor && item.dataVencimento === data.dataVencimento);
    if (duplicate) {
      return reply.status(409).send({
        error: 'Já existe uma parcela ativa deste orçamento com o mesmo valor e vencimento.'
      });
    }
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
    const { id } = request.params as IdParams;
    
    const bodySchema = z.object({
      statusPagamento: z.enum(['Pendente', 'Pago']).optional(),
      dataPagamento: isoDateSchema.nullable().optional()
    }).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualização.');

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
        clienteId: entityIdSchema,
        projetoId: entityIdSchema.optional()
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
      comprovanteDocumentoId: entityIdSchema.nullable().optional()
    }).strict();
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

    const receiptId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    return withSqliteBusyRetry(async () => {
      const [existingReceipt] = await db.select().from(schema.recebimentos)
        .where(eq(schema.recebimentos.id, receiptId)).limit(1);
      if (existingReceipt) {
        const [installment] = await db.select().from(schema.parcelas)
          .where(eq(schema.parcelas.id, id)).limit(1);
        return reply.status(201).send({ recebimento: existingReceipt, parcela: installment });
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

      const transactionClient = createClient(databaseClientConfig(dbPath));
      try {
        await transactionClient.execute('PRAGMA foreign_keys = ON;');
        await transactionClient.execute('PRAGMA busy_timeout = 5000;');
        const transactionDb = drizzle(transactionClient, { schema });
        const result = await transactionDb.transaction(async (tx) => {
          const [receipt] = await tx.insert(schema.recebimentos).values({
            id: receiptId,
            parcelaId: id,
            ...receiptData,
            dataRecebimento: input.dataRecebimento,
            meioPagamento: input.meioPagamento || null,
            observacoes: input.observacoes || null,
            comprovanteDocumentoId: input.comprovanteDocumentoId || null
          }).returning();
          await tx.insert(schema.financeiroEventos).values({
            id: eventId,
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
      } catch (error) {
        if (errorMessages(error).some((message) => /recebimento_excede_principal/i.test(message))) {
          return reply.status(409).send({ error: 'O recebimento ultrapassa o saldo principal disponível.' });
        }
        throw error;
      } finally {
        transactionClient.close();
      }
    });
  });

  server.post('/recebimentos/:id/estorno', async (request, reply) => {
    const { id } = request.params as IdParams;
    const parsed = z.object({
      motivo: z.string().trim().min(5, 'Informe o motivo do estorno.').max(1000),
      dataEstorno: isoDateSchema.optional()
    }).strict().safeParse(request.body);
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

}
