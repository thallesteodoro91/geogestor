import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';
import { AuditLogService } from '../services/audit.service';
import { activeDocumentWhere } from '../services/document-integrity.service';
import { centsSchema, isoDateSchema } from './financeiro.schemas';

type IdParams = { id: string };

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export async function registerFinanceiroOperacionalRoutes(server: FastifyInstance) {
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

