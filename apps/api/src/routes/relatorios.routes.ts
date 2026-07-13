import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq, sql } from 'drizzle-orm';

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
        .groupBy(schema.orcamentos.status);

      // 3. Estatísticas de Parcelas (Pagamentos recebidos vs pendentes)
      const parcelasStats = await db
        .select({
          statusPagamento: schema.parcelas.statusPagamento,
          total: sql<number>`sum(${schema.parcelas.valor})`
        })
        .from(schema.parcelas)
        .groupBy(schema.parcelas.statusPagamento);

      // 4. Estatísticas de Despesas (por Categoria e Total)
      const despesasPorCategoria = await db
        .select({
          categoria: schema.despesas.categoria,
          total: sql<number>`sum(${schema.despesas.valor})`
        })
        .from(schema.despesas)
        .groupBy(schema.despesas.categoria);

      // 5. Histórico mensal simples (Fluxo de caixa dos últimos 6 meses - simulado/calculado a partir de datas)
      // Daremos um mock estruturado caso não existam múltiplos meses, mas vamos tentar extrair de despesas e orçamentos.
      const despesasMensais = await db
        .select({
          mes: sql<string>`strftime('%Y-%m', ${schema.despesas.data})`,
          total: sql<number>`sum(${schema.despesas.valor})`
        })
        .from(schema.despesas)
        .groupBy(sql`strftime('%Y-%m', ${schema.despesas.data})`);

      const parcelasMensais = await db
        .select({
          mes: sql<string>`strftime('%Y-%m', ${schema.parcelas.dataVencimento})`,
          total: sql<number>`sum(${schema.parcelas.valor})`
        })
        .from(schema.parcelas)
        .where(eq(schema.parcelas.statusPagamento, 'Pago'))
        .groupBy(sql`strftime('%Y-%m', ${schema.parcelas.dataVencimento})`);

      return {
        projetosPorStatus,
        projetosPorTipo,
        areaTotal,
        orcamentosStats,
        parcelasStats,
        despesasPorCategoria,
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
