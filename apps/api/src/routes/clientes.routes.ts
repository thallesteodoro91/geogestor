import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, isNull, desc, asc, count, sum, not, and, or, like, sql, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { ClientePatchPayloadSchema, ClientePayloadSchema } from '@geogestor/contracts';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AuditLogService } from '../services/audit.service';
import { JornadaService } from '../services/jornada.service';
import { FileSystemOutboxService } from '../services/filesystem-outbox.service';
import { activeClientDocumentWhere } from '../services/document-integrity.service';
import { finishSimpleImport } from '../services/simple-import-result.service';
import { OperationalLogService } from '../services/operational-log.service';
import { finalizeImportFilesystem } from '../services/import-filesystem-finalization.service';
import {
  completeImportRun,
  ensureImportInfrastructure,
  failImportRun,
  findImportReplay,
  importContentDigest,
  ImportRunError,
  readIdempotencyKey,
  reserveSimpleImport
} from '../services/import-run.service';

type IdParams = { id: string };
type HistoricoParams = { id: string; historicoId: string };
type Payload = Record<string, any>;

const normalizeDocument = (value?: string | null) => value?.replace(/\D/g, '') || null;

const CLIENT_IMPORT_FIELDS = new Set([
  'nome', 'tipoPessoa', 'documento', 'email', 'telefone', 'endereco', 'numero', 'semNumero',
  'complemento', 'bairro', 'municipio', 'uf', 'cep', 'celular', 'celularWhatsapp', 'cpf', 'rg',
  'cnpj', 'inscricaoEstadual', 'origem', 'origemPrincipal', 'origemDetalhe', 'indicadoPor',
  'categoria', 'perfis', 'anotacoes', 'situacao', 'previsaoEntrega', 'servicos'
]);

function normalizeClientImportRow(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, errors: ['linha: envie um objeto com os campos do cliente.'] };
  }
  const errors: string[] = [];
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CLIENT_IMPORT_FIELDS.has(key)) {
      errors.push(`${key}: campo não permitido.`);
      continue;
    }
    if (value !== null && typeof value === 'object') {
      errors.push(`${key}: estruturas aninhadas não são permitidas.`);
      continue;
    }
    if (typeof value === 'string') {
      const maximum = key === 'anotacoes' ? 5_000 : 500;
      const clean = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
      if (clean.length > maximum) errors.push(`${key}: limite de ${maximum} caracteres excedido.`);
      normalized[key] = clean;
    } else {
      normalized[key] = value;
    }
  }
  return { data: normalized, errors };
}

function getClientDocument(input: {
  tipoPessoa?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  documento?: string | null;
}) {
  const selected = input.tipoPessoa === 'PJ' ? input.cnpj : input.cpf;
  return normalizeDocument(selected) || normalizeDocument(input.documento);
}

class ClientDocumentConflictError extends Error {
  constructor() {
    super('Já existe um cliente ativo com este CPF/CNPJ.');
    this.name = 'ClientDocumentConflictError';
  }
}

function isClientDocumentConflict(error: unknown) {
  return error instanceof ClientDocumentConflictError
    || (error instanceof Error && error.message.includes('CLIENT_DOCUMENT_CONFLICT'));
}

async function assertDocumentAvailable(
  document: string | null,
  dbOrTx: any,
  excludedClientId?: string
) {
  if (!document) return;
  const conditions = [
    eq(schema.clientes.documentoNormalizado, document),
    isNull(schema.clientes.deletedAt)
  ];
  if (excludedClientId) conditions.push(not(eq(schema.clientes.id, excludedClientId)));
  const existing = await dbOrTx.select({ id: schema.clientes.id })
    .from(schema.clientes)
    .where(and(...conditions))
    .limit(1);
  if (existing.length) throw new ClientDocumentConflictError();
}

const historyBodySchema = z.object({
  projetoId: z.string().uuid().nullable().optional(),
  orcamentoId: z.string().uuid().nullable().optional(),
  tipo: z.string().trim().min(1).max(100),
  titulo: z.string().trim().min(1).max(500).nullable().optional(),
  categoria: z.string().trim().min(1).max(100).nullable().optional(),
  manual: z.boolean().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/, 'Data inválida'),
  descricao: z.string().trim().min(1).max(20_000)
});

const historyPatchSchema = historyBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'Informe ao menos um campo para atualizar.'
);

const labelValue = (value: any) => {
  if (value === null || value === undefined || value === '') return 'não informado';
  return String(value);
};

const buildClienteChanges = (oldCliente: any, data: any) => {
  const fields: Array<[string, string]> = [
    ['nome', 'Nome'],
    ['tipoPessoa', 'Tipo de pessoa'],
    ['email', 'E-mail'],
    ['telefone', 'Telefone'],
    ['celular', 'Celular'],
    ['celularWhatsapp', 'Possui WhatsApp'],
    ['cpf', 'CPF'],
    ['rg', 'RG'],
    ['cnpj', 'CNPJ'],
    ['inscricaoEstadual', 'Inscrição Estadual'],
    ['endereco', 'Endereço'],
    ['numero', 'Número'],
    ['semNumero', 'Sem número'],
    ['complemento', 'Complemento'],
    ['bairro', 'Bairro'],
    ['municipio', 'Município'],
    ['uf', 'UF'],
    ['cep', 'CEP'],
    ['origemPrincipal', 'Origem principal'],
    ['origemDetalhe', 'Detalhe da origem'],
    ['indicadoPor', 'Indicado por'],
    ['perfis', 'Perfis comerciais'],
    ['situacao', 'Situação'],
    ['servicos', 'Serviços de interesse']
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
        limit: z.coerce.number().min(1).max(1000).default(100),
        mode: z.enum(['legacy', 'page']).default('legacy'),
        q: z.string().trim().max(200).optional(),
        status: z.string().trim().max(100).optional(),
        categoria: z.string().trim().max(100).optional(),
        origem: z.string().trim().max(100).optional(),
        ordenar: z.enum(['recentes', 'antigos', 'az', 'za']).default('recentes')
      })
    }
  }, async (request, reply) => {
    const { page, limit, mode, q, status, categoria, origem, ordenar } = request.query;
    try {
      const offset = (page - 1) * limit;
      const conditions = [isNull(schema.clientes.deletedAt)];
      if (q) {
        const search = `%${q}%`;
        conditions.push(or(
          like(schema.clientes.nome, search),
          like(schema.clientes.email, search),
          like(schema.clientes.telefone, search),
          like(schema.clientes.celular, search),
          like(schema.clientes.cpf, search),
          like(schema.clientes.cnpj, search),
          like(schema.clientes.documento, search),
          like(schema.clientes.endereco, search),
          like(schema.clientes.bairro, search)
        )!);
      }
      if (status) {
        conditions.push(status === 'Ativo'
          ? or(eq(schema.clientes.situacao, status), isNull(schema.clientes.situacao))!
          : eq(schema.clientes.situacao, status));
      }
      if (categoria) conditions.push(like(schema.clientes.categoria, `%${categoria}%`));
      if (origem) {
        conditions.push(or(
          eq(schema.clientes.origemPrincipal, origem),
          like(schema.clientes.origem, `%${origem}%`)
        )!);
      }
      const whereClause = and(...conditions);
      const orderBy = ordenar === 'az'
        ? asc(schema.clientes.nome)
        : ordenar === 'za'
          ? desc(schema.clientes.nome)
          : ordenar === 'antigos'
            ? asc(schema.clientes.createdAt)
            : desc(schema.clientes.createdAt);
      const clientesList = await db.select({
        ...getTableColumns(schema.clientes),
        propriedadesCount: sql<number>`CAST(
          (SELECT COUNT(*) FROM propriedades AS structured_properties
            WHERE structured_properties.cliente_id = clientes.id
              AND structured_properties.deleted_at IS NULL)
          +
          (SELECT COUNT(*) FROM projetos AS legacy_projects
            WHERE legacy_projects.cliente_id = clientes.id
              AND legacy_projects.propriedade_id IS NULL
              AND legacy_projects.deleted_at IS NULL)
          AS INTEGER
        )`
      }).from(schema.clientes)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(orderBy);

      if (mode === 'legacy') return clientesList;

      const [{ total }] = await db.select({ total: count() })
        .from(schema.clientes)
        .where(whereClause);
      return {
        items: clientesList,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar clientes' });
    }
  });

  zServer.get('/options', {
    schema: {
      querystring: z.object({
        q: z.string().trim().max(200).optional(),
        selectedId: z.string().uuid().optional(),
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(50),
        mode: z.enum(['legacy', 'page']).default('legacy')
      })
    }
  }, async (request, reply) => {
    const { q, selectedId, page, limit, mode } = request.query;
    try {
      const conditions = [isNull(schema.clientes.deletedAt)];
      if (q) {
        const search = `%${q}%`;
        conditions.push(or(
          like(schema.clientes.nome, search),
          like(schema.clientes.documento, search),
          like(schema.clientes.cpf, search),
          like(schema.clientes.cnpj, search)
        )!);
      }
      const whereClause = and(...conditions);
      const [items, totalRows] = await Promise.all([db.select({
        id: schema.clientes.id,
        nome: schema.clientes.nome,
        documento: schema.clientes.documento,
        cpf: schema.clientes.cpf,
        cnpj: schema.clientes.cnpj
      }).from(schema.clientes)
        .where(whereClause)
        .orderBy(asc(schema.clientes.nome))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: count() }).from(schema.clientes).where(whereClause)]);
      if (selectedId && !items.some((item) => item.id === selectedId)) {
        const [selected] = await db.select({
          id: schema.clientes.id,
          nome: schema.clientes.nome,
          documento: schema.clientes.documento,
          cpf: schema.clientes.cpf,
          cnpj: schema.clientes.cnpj
        }).from(schema.clientes).where(and(eq(schema.clientes.id, selectedId), isNull(schema.clientes.deletedAt))).limit(1);
        if (selected) items.unshift(selected);
      }
      if (mode === 'legacy') return items.slice(0, limit);
      const total = Number(totalRows[0]?.total || 0);
      return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao buscar opções de clientes' });
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
        totalOrcamentosEmitidos,
        totalOrcamentosContratados,
        totalRecebido,
        totalPendente,
        totalVencido,
        totalDespesas,
        totalDespesasPagas,
        totalDespesasReembolsaveis,
        totalDocumentos,
        totalFaturado,
        totalImpostosEstimados,
        totalCreditos,
        totalDevolucoes,
        totalExecutadoInformado
      ] = await Promise.all([
        db.select({ value: count() }).from(schema.projetos).where(and(
          eq(schema.projetos.clienteId, id),
          isNull(schema.projetos.deletedAt)
        )),
        db.select({ value: count() }).from(schema.tarefas).where(
          sql`${schema.tarefas.clienteId} = ${id} AND ${schema.tarefas.deletedAt} is null
            AND ${schema.tarefas.status} != 'Concluído' AND ${schema.tarefas.status} != 'Concluido'`
        ),
        db.select({ valor: sum(schema.orcamentos.valorTotal), count: count() }).from(schema.orcamentos).where(and(
          eq(schema.orcamentos.clienteId, id),
          isNull(schema.orcamentos.deletedAt),
          sql`lower(${schema.orcamentos.status}) not in ('rascunho', 'cancelado', 'cancelada', 'substituido')`
        )),
        db.select({ valor: sum(schema.orcamentos.valorTotal), count: count() }).from(schema.orcamentos).where(and(
          eq(schema.orcamentos.clienteId, id),
          isNull(schema.orcamentos.deletedAt),
          sql`lower(${schema.orcamentos.status}) in ('aprovado', 'pago')`
        )),
        db.select({ valor: sum(schema.recebimentos.valorRecebido) })
          .from(schema.recebimentos)
          .innerJoin(schema.parcelas, eq(schema.recebimentos.parcelaId, schema.parcelas.id))
          .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
          .where(and(
            eq(schema.orcamentos.clienteId, id),
            isNull(schema.recebimentos.deletedAt),
            isNull(schema.recebimentos.estornadoEm),
            isNull(schema.parcelas.deletedAt),
            isNull(schema.orcamentos.deletedAt)
          )),
        db.select({ valor: sql<number>`sum(max(0, ${schema.parcelas.valor} - ${schema.parcelas.valorPago}))` })
          .from(schema.parcelas)
          .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
          .where(and(
            eq(schema.orcamentos.clienteId, id),
            isNull(schema.parcelas.deletedAt),
            isNull(schema.parcelas.canceladaEm),
            isNull(schema.orcamentos.deletedAt),
            sql`${schema.parcelas.dataVencimento} >= date('now', 'localtime')`
          )),
        db.select({ valor: sql<number>`sum(max(0, ${schema.parcelas.valor} - ${schema.parcelas.valorPago}))` })
          .from(schema.parcelas)
          .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
          .where(and(
            eq(schema.orcamentos.clienteId, id),
            isNull(schema.parcelas.deletedAt),
            isNull(schema.parcelas.canceladaEm),
            isNull(schema.orcamentos.deletedAt),
            sql`${schema.parcelas.dataVencimento} < date('now', 'localtime')`
          )),
        db.select({ valor: sum(schema.despesas.valor) }).from(schema.despesas)
          .leftJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
          .where(and(
            sql`coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId}) = ${id}`,
            isNull(schema.despesas.deletedAt),
            isNull(schema.despesas.canceladaEm),
            isNull(schema.despesas.estornadaEm)
          )),
        db.select({ valor: sum(schema.despesas.valor) }).from(schema.despesas)
          .leftJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
          .where(and(
            sql`coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId}) = ${id}`,
            isNull(schema.despesas.deletedAt),
            isNull(schema.despesas.canceladaEm),
            isNull(schema.despesas.estornadaEm),
            sql`lower(${schema.despesas.status}) = 'pago'`
          )),
        db.select({ valor: sum(schema.despesas.valor) }).from(schema.despesas)
          .leftJoin(schema.projetos, eq(schema.despesas.projetoId, schema.projetos.id))
          .where(and(
            sql`coalesce(${schema.despesas.clienteId}, ${schema.projetos.clienteId}) = ${id}`,
            isNull(schema.despesas.deletedAt),
            isNull(schema.despesas.canceladaEm),
            isNull(schema.despesas.estornadaEm),
            eq(schema.despesas.reembolsavel, true)
          )),
        db.select({ value: count() }).from(schema.documentos).where(activeClientDocumentWhere(id)),
        db.select({ valor: sum(schema.notasFiscais.valor), count: count() }).from(schema.notasFiscais).where(and(
          eq(schema.notasFiscais.clienteId, id),
          isNull(schema.notasFiscais.deletedAt),
          isNull(schema.notasFiscais.canceladaEm)
        )),
        db.select({
          valor: sql<number>`sum(case
            when coalesce(${schema.orcamentos.impostosPrevistos}, 0) > 0
              then ${schema.orcamentos.impostosPrevistos}
            else coalesce(${schema.orcamentos.impostoValor}, 0)
          end)`
        }).from(schema.orcamentos).where(and(
          eq(schema.orcamentos.clienteId, id),
          isNull(schema.orcamentos.deletedAt),
          sql`lower(${schema.orcamentos.status}) in ('aprovado', 'pago')`
        )),
        db.select({ valor: sum(schema.projetoFinanceiroDecisoes.valorExecutado) })
          .from(schema.projetoFinanceiroDecisoes)
          .where(and(
            eq(schema.projetoFinanceiroDecisoes.clienteId, id),
            eq(schema.projetoFinanceiroDecisoes.tipo, 'registrar_credito')
          )),
        db.select({ valor: sum(schema.projetoFinanceiroDecisoes.valorExecutado) })
          .from(schema.projetoFinanceiroDecisoes)
          .where(and(
            eq(schema.projetoFinanceiroDecisoes.clienteId, id),
            eq(schema.projetoFinanceiroDecisoes.tipo, 'registrar_devolucao')
          )),
        db.select({
          projetoId: schema.projetoFinanceiroDecisoes.projetoId,
          valor: schema.projetoFinanceiroDecisoes.valorExecutado
        })
          .from(schema.projetoFinanceiroDecisoes)
          .where(and(
            eq(schema.projetoFinanceiroDecisoes.clienteId, id),
            eq(schema.projetoFinanceiroDecisoes.tipo, 'cobranca_parcial')
          ))
          .orderBy(desc(schema.projetoFinanceiroDecisoes.createdAt))
      ]);

      const latestExecutionByProject = new Map<string, number>();
      for (const decision of totalExecutadoInformado) {
        if (!latestExecutionByProject.has(decision.projetoId) && decision.valor != null) {
          latestExecutionByProject.set(decision.projetoId, decision.valor);
        }
      }
      const [totalPropriedades, documentosEmRevisao] = await Promise.all([
        db.select({ value: count() }).from(schema.propriedades).where(and(eq(schema.propriedades.clienteId, id), isNull(schema.propriedades.deletedAt))),
        db.select({ value: count() }).from(schema.documentos).where(and(eq(schema.documentos.clienteId, id), eq(schema.documentos.status, 'revisao'), isNull(schema.documentos.deletedAt)))
      ]);
      const kpis = {
        projetos: totalProjetos[0]?.value || 0,
        propriedades: totalPropriedades[0]?.value || 0,
        tarefasPendentes: totalTarefasPendentes[0]?.value || 0,
        orcamentosQtd: totalOrcamentosEmitidos[0]?.count || 0,
        orcamentosValor: totalOrcamentosContratados[0]?.valor || 0,
        valorOrcado: totalOrcamentosEmitidos[0]?.valor || 0,
        valorContratado: totalOrcamentosContratados[0]?.valor || 0,
        valorFaturado: totalFaturado[0]?.valor || 0,
        notasFiscaisQtd: totalFaturado[0]?.count || 0,
        valorRecebido: totalRecebido[0]?.valor || 0,
        valorPendente: totalPendente[0]?.valor || 0,
        valorVencido: totalVencido[0]?.valor || 0,
        despesasValor: totalDespesas[0]?.valor || 0,
        despesasPagas: totalDespesasPagas[0]?.valor || 0,
        despesasReembolsaveis: totalDespesasReembolsaveis[0]?.valor || 0,
        impostosEstimados: totalImpostosEstimados[0]?.valor || 0,
        creditos: totalCreditos[0]?.valor || 0,
        devolucoes: totalDevolucoes[0]?.valor || 0,
        valorExecutadoInformado: [...latestExecutionByProject.values()]
          .reduce((sumValue, value) => sumValue + value, 0),
        execucaoInformada: latestExecutionByProject.size > 0,
        resultadoCaixa: Number(totalRecebido[0]?.valor || 0) - Number(totalDespesasPagas[0]?.valor || 0),
        documentos: totalDocumentos[0]?.value || 0
      };

      return {
        cliente: clienteRes[0],
        kpis,
        quality: {
          requiresReview: Boolean(clienteRes[0].revisaoCadastral) || Number(documentosEmRevisao[0]?.value || 0) > 0 || Number(totalPropriedades[0]?.value || 0) === 0,
          documentReviewCount: documentosEmRevisao[0]?.value || 0
        }
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
        const documentoNormalizado = getClientDocument(data);
        await assertDocumentAvailable(documentoNormalizado, tx);
        // 1. Criar no banco de dados
        const result = await tx.insert(schema.clientes).values({
          id: crypto.randomUUID(),
          nome: data.nome,
          tipoPessoa: data.tipoPessoa,
          documento: data.documento?.trim() || (data.tipoPessoa === 'PJ' ? data.cnpj : data.cpf)?.trim() || null,
          documentoNormalizado,
          email: data.email || null,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          numero: data.semNumero ? null : data.numero || null,
          semNumero: data.semNumero || false,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          municipio: data.municipio || null,
          uf: data.uf || null,
          cep: data.cep || null,
          celular: data.celular || null,
          celularWhatsapp: data.celularWhatsapp || false,
          cpf: data.cpf || null,
          rg: data.rg || null,
          cnpj: data.cnpj || null,
          inscricaoEstadual: data.inscricaoEstadual || null,
          origem: data.origem || data.origemPrincipal || null,
          origemPrincipal: data.origemPrincipal || null,
          origemDetalhe: data.origemDetalhe || null,
          indicadoPor: data.indicadoPor || null,
          categoria: data.categoria || null,
          perfis: data.perfis || null,
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

        await FileSystemOutboxService.enqueue({
          idempotencyKey: `client-folder:create:${result[0].id}:${result[0].nome}`,
          operationType: 'create-client-folder',
          aggregateType: 'client',
          aggregateId: result[0].id,
          payload: { clientId: result[0].id, clientName: result[0].nome }
        }, tx);

        return result[0];
      });
      await FileSystemOutboxService.processPending();

      return reply.status(201).send(novoCliente);
    } catch (err) {
      if (isClientDocumentConflict(err)) {
        return reply.status(409).send({ error: 'Já existe um cliente ativo com este CPF/CNPJ.' });
      }
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao criar cliente' });
    }
  });

  // Atualizar cliente
  zServer.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: ClientePatchPayloadSchema
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
        const documentChanged = ['tipoPessoa', 'cpf', 'cnpj', 'documento']
          .some((field) => data[field as keyof typeof data] !== undefined);
        const documentoNormalizado = documentChanged ? getClientDocument({
          tipoPessoa: data.tipoPessoa ?? oldCliente[0].tipoPessoa,
          cpf: data.cpf !== undefined ? data.cpf : oldCliente[0].cpf,
          cnpj: data.cnpj !== undefined ? data.cnpj : oldCliente[0].cnpj,
          documento: data.documento !== undefined ? data.documento : oldCliente[0].documento
        }) : undefined;
        if (documentChanged) await assertDocumentAvailable(documentoNormalizado ?? null, tx, id);
        const result = await tx.update(schema.clientes).set({
          nome: data.nome !== undefined ? data.nome : undefined,
          tipoPessoa: data.tipoPessoa !== undefined ? data.tipoPessoa : undefined,
          documento: data.documento !== undefined ? data.documento : undefined,
          documentoNormalizado,
          email: data.email !== undefined ? data.email : undefined,
          telefone: data.telefone !== undefined ? data.telefone : undefined,
          endereco: data.endereco !== undefined ? data.endereco : undefined,
          numero: data.semNumero === true ? null : data.numero !== undefined ? data.numero : undefined,
          semNumero: data.semNumero !== undefined ? data.semNumero : undefined,
          complemento: data.complemento !== undefined ? data.complemento : undefined,
          bairro: data.bairro !== undefined ? data.bairro : undefined,
          municipio: data.municipio !== undefined ? data.municipio : undefined,
          uf: data.uf !== undefined ? data.uf : undefined,
          cep: data.cep !== undefined ? data.cep : undefined,
          celular: data.celular !== undefined ? data.celular : undefined,
          celularWhatsapp: data.celularWhatsapp !== undefined ? data.celularWhatsapp : undefined,
          cpf: data.cpf !== undefined ? data.cpf : undefined,
          rg: data.rg !== undefined ? data.rg : undefined,
          cnpj: data.cnpj !== undefined ? data.cnpj : undefined,
          inscricaoEstadual: data.inscricaoEstadual !== undefined ? data.inscricaoEstadual : undefined,
          // O texto legado de origem só muda quando o chamador o envia explicitamente.
          origem: data.origem !== undefined ? data.origem : undefined,
          origemPrincipal: data.origemPrincipal !== undefined ? data.origemPrincipal : undefined,
          origemDetalhe: data.origemDetalhe !== undefined ? data.origemDetalhe : undefined,
          indicadoPor: data.indicadoPor !== undefined ? data.indicadoPor : undefined,
          categoria: data.categoria !== undefined ? data.categoria : undefined,
          perfis: data.perfis !== undefined ? data.perfis : undefined,
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
          await FileSystemOutboxService.enqueue({
            idempotencyKey: `client-folder:rename:${id}:${oldCliente[0].nome}:${data.nome}`,
            operationType: 'rename-client-folder',
            aggregateType: 'client',
            aggregateId: id,
            payload: { clientId: id, oldClientName: oldCliente[0].nome, newClientName: data.nome }
          }, tx);
        }

        return result[0];
      });

      await FileSystemOutboxService.processPending();

      return clienteAtualizado;
    } catch (err) {
      if (isClientDocumentConflict(err)) {
        return reply.status(409).send({ error: 'Já existe um cliente ativo com este CPF/CNPJ.' });
      }
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

        await FileSystemOutboxService.cancelAggregate('client', id, tx);

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
  zServer.get('/:id/historico', {
    schema: { params: z.object({ id: z.string().uuid() }) }
  }, async (request, reply) => {
    const { id } = request.params;
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
  zServer.post('/:id/historico', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: historyBodySchema
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    try {
      const client = await db.select({ id: schema.clientes.id }).from(schema.clientes)
        .where(and(eq(schema.clientes.id, id), isNull(schema.clientes.deletedAt))).limit(1);
      if (!client.length) return reply.status(404).send({ error: 'Cliente não encontrado' });
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
  zServer.patch('/:id/historico/:historicoId', {
    schema: {
      params: z.object({ id: z.string().uuid(), historicoId: z.string().uuid() }),
      body: historyPatchSchema
    }
  }, async (request, reply) => {
    const { id, historicoId } = request.params;
    const data = request.body;

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
  zServer.post('/lote', {
    schema: { body: z.array(z.unknown()).min(1).max(500) }
  }, async (request, reply) => {
    const startedAt = new Date().toISOString();
    const digest = importContentDigest(request.body);
    let runId: string | null = null;
    try {
      await ensureImportInfrastructure();
      const idempotencyKey = readIdempotencyKey(request.headers);
      const replay = await findImportReplay('clientes', 'simple', idempotencyKey, digest);
      if (replay) return reply.status(200).send(replay);
      const reservation = await reserveSimpleImport(db, {
        entity: 'clientes', key: idempotencyKey, digest, totalRows: request.body.length
      });
      runId = reservation.runId;
      if (reservation.replay) return reply.status(200).send(reservation.replay);

      const existing = await db.select({ documentoNormalizado: schema.clientes.documentoNormalizado })
        .from(schema.clientes).where(isNull(schema.clientes.deletedAt));
      const knownDocuments = new Set(existing.map((item) => item.documentoNormalizado).filter(Boolean));
      const accepted: Array<{ index: number; data: z.infer<typeof ClientePayloadSchema>; id: string }> = [];
      const results: Array<{ index: number; status: 'success' | 'failed'; id?: string; errors?: string[] }> = [];

      request.body.forEach((raw, index) => {
        const normalized = normalizeClientImportRow(raw);
        if (!normalized.data || normalized.errors.length) {
          results.push({ index, status: 'failed', errors: normalized.errors });
          return;
        }
        const parsed = ClientePayloadSchema.safeParse(normalized.data);
        if (!parsed.success) {
          results.push({ index, status: 'failed', errors: parsed.error.issues.map((issue) => issue.message) });
          return;
        }
        const document = getClientDocument(parsed.data);
        if (!document) {
          results.push({ index, status: 'failed', errors: ['Informe um CPF/CNPJ válido.'] });
          return;
        }
        if (knownDocuments.has(document)) {
          results.push({ index, status: 'failed', errors: ['CPF/CNPJ já cadastrado ou repetido neste lote.'] });
          return;
        }
        knownDocuments.add(document);
        accepted.push({ index, data: parsed.data, id: crypto.randomUUID() });
      });

      const summary = accepted.length
        ? await db.transaction(async (tx) => {
          for (const item of accepted) {
            const data = item.data;
            await tx.insert(schema.clientes).values({
              id: item.id,
              nome: data.nome,
              tipoPessoa: data.tipoPessoa,
              documento: data.documento?.trim() || (data.tipoPessoa === 'PJ' ? data.cnpj : data.cpf)?.trim() || null,
              documentoNormalizado: getClientDocument(data),
              email: data.email || null,
              telefone: data.telefone || null,
              endereco: data.endereco || null,
              numero: data.semNumero ? null : data.numero || null,
              semNumero: data.semNumero || false,
              complemento: data.complemento || null,
              bairro: data.bairro || null,
              municipio: data.municipio || null,
              uf: data.uf || null,
              cep: data.cep || null,
              celular: data.celular || null,
              celularWhatsapp: data.celularWhatsapp || false,
              cpf: data.cpf || null,
              rg: data.rg || null,
              cnpj: data.cnpj || null,
              inscricaoEstadual: data.inscricaoEstadual || null,
              origem: data.origem || data.origemPrincipal || null,
              origemPrincipal: data.origemPrincipal || null,
              origemDetalhe: data.origemDetalhe || null,
              indicadoPor: data.indicadoPor || null,
              categoria: data.categoria || null,
              perfis: data.perfis || null,
              anotacoes: data.anotacoes || null,
              situacao: data.situacao || 'Ativo',
              previsaoEntrega: data.previsaoEntrega || null,
              servicos: data.servicos || null
            });
            await FileSystemOutboxService.enqueue({
              idempotencyKey: `client-folder:create:${item.id}:${data.nome}`,
              operationType: 'create-client-folder',
              aggregateType: 'client',
              aggregateId: item.id,
              payload: { clientId: item.id, clientName: data.nome }
            }, tx);
            results.push({ index: item.index, status: 'success', id: item.id });
          }
          await AuditLogService.log('INSERT', 'Cliente', null, {
            importacaoLote: true,
            quantidade: accepted.length,
            ids: accepted.map((item) => item.id)
          }, tx);
          const transactionResult = finishSimpleImport(startedAt, request.body.length, results, { importId: runId! });
          await completeImportRun(tx, runId!, transactionResult as unknown as Record<string, unknown>, results);
          return transactionResult;
        })
        : finishSimpleImport(startedAt, request.body.length, results, { importId: runId });
      if (!accepted.length) {
        await completeImportRun(db, runId, summary as unknown as Record<string, unknown>, results);
      }
      const finalized = accepted.length ? await finalizeImportFilesystem(runId, summary) : summary;
      await OperationalLogService.info('simple-spreadsheet-import', { importId: finalized.importId, entity: 'clientes', status: finalized.status, rows: finalized.rowsRead, imported: finalized.imported, failed: finalized.failed, durationMs: finalized.durationMs });
      return reply.status(201).send(finalized);
    } catch (err) {
      if (runId) await failImportRun(runId, err).catch(() => undefined);
      await OperationalLogService.error('simple-spreadsheet-import-failed', { entity: 'clientes', status: 'failed', rows: request.body.length, reason: err, durationMs: Date.now() - new Date(startedAt).getTime() }).catch(() => undefined);
      if (isClientDocumentConflict(err)) {
        return reply.status(409).send({ error: 'CPF/CNPJ já cadastrado ou repetido durante a importação.' });
      }
      if (err instanceof ImportRunError) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao importar em lote' });
    }
  });
}
