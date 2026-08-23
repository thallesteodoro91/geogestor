import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import crypto from 'crypto';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { normalizeBudgetStatus } from '@geogestor/contracts';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { LegacyFinanceDomainService } from '../services/legacy-finance-domain.service';
import {
  centsSchema,
  legacyBudgetCostSchema,
  legacyBudgetItemSchema,
  nullableCentsSchema,
  nullableDateSchema
} from './financeiro.schemas';

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((valueInCents || 0) / 100);

export async function registerFinanceiroOrcamentoRoutes(server: FastifyInstance) {
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


}
