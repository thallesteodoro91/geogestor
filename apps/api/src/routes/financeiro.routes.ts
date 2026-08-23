import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, sql, isNull, and } from 'drizzle-orm';
import crypto from 'crypto';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { normalizeBudgetStatus } from '@geogestor/contracts';
import { activeDocumentWhere } from '../services/document-integrity.service';
import { isoDateSchema } from './financeiro.schemas';
import { normalizeExpenseCategoryCode } from '../services/managerial-finance-domain.service';
import { registerFinanceiroOrcamentoRoutes } from './financeiro-orcamentos.routes';
import { registerFinanceiroRecebimentoRoutes } from './financeiro-recebimentos.routes';
import { registerFinanceiroOperacionalRoutes } from './financeiro-operacional.routes';

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((valueInCents || 0) / 100);

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type IdParams = { id: string };

export async function financeiroRoutes(server: FastifyInstance) {
  const zServer = server.withTypeProvider<ZodTypeProvider>();
  await registerFinanceiroOrcamentoRoutes(server);
  await registerFinanceiroRecebimentoRoutes(server);
  
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

  await registerFinanceiroOperacionalRoutes(server);

}
