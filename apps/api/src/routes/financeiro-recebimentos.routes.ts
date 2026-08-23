import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import crypto from 'crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { normalizeBudgetStatus } from '@geogestor/contracts';
import { db } from '../db';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { activeDocumentWhere } from '../services/document-integrity.service';
import { centsSchema, isoDateSchema } from './financeiro.schemas';
import {
  calculateInstallmentSettlement,
  calculateReceiptCash
} from '../services/managerial-finance-domain.service';

type IdParams = { id: string };

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((valueInCents || 0) / 100);

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

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

export async function registerFinanceiroRecebimentoRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();
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

}
