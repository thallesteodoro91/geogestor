import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

export async function relatoriosRoutes(server: FastifyInstance) {
  
  // Rota de agregação geral para gráficos e relatórios
  server.get('/geral', async (request, reply) => {
    try {
      // 1. Contagem de Projetos por Status
      const projetosPorStatus = await db
        .select({
          status: schema.projetos.status,
          count: sql<number>`count(${schema.projetos.id})`
        })
        .from(schema.projetos)
        .groupBy(schema.projetos.status);

      // 1b. Projetos por Tipo (Rural/Urbano)
      const projetosPorTipo = await db
        .select({
          tipo: schema.projetos.tipo,
          count: sql<number>`count(${schema.projetos.id})`
        })
        .from(schema.projetos)
        .groupBy(schema.projetos.tipo);

      // 1c. Área Total sob Gestão
      const areaTotalResult = await db
        .select({
          totalArea: sql<number>`sum(${schema.projetos.areaHa})`
        })
        .from(schema.projetos)
        .where(sql`${schema.projetos.status} != 'Entregue'`);
      const areaTotal = areaTotalResult[0]?.totalArea || 0;

      // 2. Estatísticas de Receitas (Orçamentos)
      const orcamentosStats = await db
        .select({
          status: schema.orcamentos.status,
          total: sql<number>`sum(${schema.orcamentos.valorTotal})`,
          count: sql<number>`count(${schema.orcamentos.id})`
        })
        .from(schema.orcamentos)
        .where(isNull(schema.orcamentos.deletedAt))
        .groupBy(schema.orcamentos.status);

      // 3. Estatísticas de Parcelas (Pagamentos recebidos vs pendentes)
      const parcelasStats = await db
        .select({
          statusPagamento: schema.parcelas.statusPagamento,
          total: sql<number>`sum(${schema.parcelas.valor})`
        })
        .from(schema.parcelas)
        .where(and(isNull(schema.parcelas.deletedAt), isNull(schema.parcelas.canceladaEm)))
        .groupBy(schema.parcelas.statusPagamento);

      // 4. Estatísticas de Despesas (por Categoria e Total)
      const despesasPorCategoria = await db
        .select({
          categoria: schema.despesas.categoria,
          total: sql<number>`sum(${schema.despesas.valor})`
        })
        .from(schema.despesas)
        .where(isNull(schema.despesas.deletedAt))
        .groupBy(schema.despesas.categoria);

      // 5. Histórico mensal simples (Fluxo de caixa dos últimos 6 meses - simulado/calculado a partir de datas)
      // Daremos um mock estruturado caso não existam múltiplos meses, mas vamos tentar extrair de despesas e orçamentos.
      const despesasMensais = await db
        .select({
          mes: sql<string>`strftime('%Y-%m', coalesce(${schema.despesas.dataPagamento}, ${schema.despesas.data}))`,
          total: sql<number>`sum(${schema.despesas.valor})`
        })
        .from(schema.despesas)
        .where(and(isNull(schema.despesas.deletedAt), eq(schema.despesas.status, 'Pago')))
        .groupBy(sql`strftime('%Y-%m', coalesce(${schema.despesas.dataPagamento}, ${schema.despesas.data}))`);

      const parcelasMensais = await db
        .select({
          mes: sql<string>`strftime('%Y-%m', coalesce(${schema.parcelas.dataPagamento}, ${schema.parcelas.dataVencimento}))`,
          total: sql<number>`sum(CASE WHEN ${schema.parcelas.valorPago} > 0 THEN ${schema.parcelas.valorPago} ELSE ${schema.parcelas.valor} END)`
        })
        .from(schema.parcelas)
        .where(and(
          isNull(schema.parcelas.deletedAt),
          isNull(schema.parcelas.canceladaEm),
          eq(schema.parcelas.statusPagamento, 'Pago')
        ))
        .groupBy(sql`strftime('%Y-%m', coalesce(${schema.parcelas.dataPagamento}, ${schema.parcelas.dataVencimento}))`);

      const [financeiro] = await db
        .select({
          receitaContratada: sql<number>`coalesce((
            SELECT sum(o.valor_total)
            FROM orcamentos o
            WHERE o.deleted_at IS NULL AND lower(o.status) IN ('aprovado', 'pago')
          ), 0)`,
          receitaRecebida: sql<number>`coalesce((
            SELECT sum(CASE WHEN p.valor_pago > 0 THEN p.valor_pago ELSE p.valor END)
            FROM parcelas p
            JOIN orcamentos o ON o.id = p.orcamento_id
            WHERE p.deleted_at IS NULL
              AND p.cancelada_em IS NULL
              AND p.status_pagamento = 'Pago'
              AND o.deleted_at IS NULL
          ), 0)`,
          receitaPendente: sql<number>`coalesce((
            SELECT sum(max(p.valor - coalesce(p.valor_pago, 0), 0))
            FROM parcelas p
            JOIN orcamentos o ON o.id = p.orcamento_id
            WHERE p.deleted_at IS NULL
              AND p.cancelada_em IS NULL
              AND p.status_pagamento != 'Pago'
              AND o.deleted_at IS NULL
              AND lower(o.status) IN ('aprovado', 'pago')
          ), 0)`,
          despesasPagas: sql<number>`coalesce((
            SELECT sum(d.valor)
            FROM despesas d
            WHERE d.deleted_at IS NULL AND d.status = 'Pago'
          ), 0)`,
          impostosPrevistos: sql<number>`coalesce((
            SELECT sum(coalesce(o.impostos_previstos, o.imposto_valor, 0))
            FROM orcamentos o
            WHERE o.deleted_at IS NULL AND lower(o.status) IN ('aprovado', 'pago')
          ), 0)`
        })
        .from(sql`(SELECT 1) AS base`);

      const financeiroConsolidado = {
        ...financeiro,
        resultadoCaixa: (financeiro?.receitaRecebida || 0) - (financeiro?.despesasPagas || 0)
      };

      return {
        projetosPorStatus,
        projetosPorTipo,
        areaTotal,
        orcamentosStats,
        parcelasStats,
        despesasPorCategoria,
        financeiro: financeiroConsolidado,
        historicoMensal: {
          despesasMensais,
          receitasMensais: parcelasMensais
        }
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao gerar dados do relatório geral' });
    }
  });
}
