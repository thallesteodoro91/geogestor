import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';

type SearchResult = {
  id: string;
  type: 'Cliente' | 'Projeto' | 'Orçamento' | 'Tarefa' | 'Agenda' | 'Documento';
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  path: string;
  date?: string | null;
};

const normalize = (value: any) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const matchesQuery = (query: string, values: any[]) =>
  values.some((value) => normalize(value).includes(query));

const take = <T>(items: T[], limit = 8) => items.slice(0, limit);

const clientTabPath = (clienteId: string | null | undefined, tab: string, params: Record<string, string | null | undefined> = {}) => {
  const query = new URLSearchParams({ tab });
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return `/clientes/${clienteId || ''}?${query.toString()}`;
};

export async function searchRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    const { q } = request.query as { q?: string };
    const query = normalize(q).trim();

    if (query.length < 2) {
      return { query: q || '', results: [] };
    }

    try {
      const [
        clientes,
        projetos,
        orcamentos,
        tarefas,
        compromissos,
        documentos
      ] = await Promise.all([
        db.select().from(schema.clientes),
        db.select({
          id: schema.projetos.id,
          nome: schema.projetos.nome,
          descricao: schema.projetos.descricao,
          status: schema.projetos.status,
          tipo: schema.projetos.tipo,
          cidade: schema.projetos.cidade,
          municipio: schema.projetos.municipio,
          matricula: schema.projetos.matricula,
          car: schema.projetos.car,
          clienteId: schema.projetos.clienteId,
          clienteNome: schema.clientes.nome,
          updatedAt: schema.projetos.updatedAt
        })
          .from(schema.projetos)
          .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id)),
        db.select({
          id: schema.orcamentos.id,
          clienteId: schema.orcamentos.clienteId,
          projetoId: schema.orcamentos.projetoId,
          codigoOrcamento: schema.orcamentos.codigoOrcamento,
          descricao: schema.orcamentos.descricao,
          status: schema.orcamentos.status,
          valorTotal: schema.orcamentos.valorTotal,
          clienteNome: schema.clientes.nome,
          projetoNome: schema.projetos.nome,
          updatedAt: schema.orcamentos.updatedAt
        })
          .from(schema.orcamentos)
          .innerJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
          .leftJoin(schema.projetos, eq(schema.orcamentos.projetoId, schema.projetos.id)),
        db.select({
          id: schema.tarefas.id,
          clienteId: schema.tarefas.clienteId,
          projetoId: schema.tarefas.projetoId,
          titulo: schema.tarefas.titulo,
          descricao: schema.tarefas.descricao,
          status: schema.tarefas.status,
          prioridade: schema.tarefas.prioridade,
          categoria: schema.tarefas.categoria,
          dataLimite: schema.tarefas.dataLimite,
          projetoNome: schema.projetos.nome,
          clienteNome: schema.clientes.nome,
          updatedAt: schema.tarefas.updatedAt
        })
          .from(schema.tarefas)
          .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
          .leftJoin(schema.clientes, eq(schema.tarefas.clienteId, schema.clientes.id)),
        db.select({
          id: schema.compromissos.id,
          clienteId: schema.compromissos.clienteId,
          projetoId: schema.compromissos.projetoId,
          titulo: schema.compromissos.titulo,
          descricao: schema.compromissos.descricao,
          data: schema.compromissos.data,
          tipo: schema.compromissos.tipo,
          projetoNome: schema.projetos.nome,
          clienteNome: schema.clientes.nome,
          updatedAt: schema.compromissos.updatedAt
        })
          .from(schema.compromissos)
          .leftJoin(schema.projetos, eq(schema.compromissos.projetoId, schema.projetos.id))
          .leftJoin(schema.clientes, eq(schema.compromissos.clienteId, schema.clientes.id)),
        db.select().from(schema.documentos)
      ]);

      const results: SearchResult[] = [
        ...take(clientes.filter((item) => matchesQuery(query, [
          item.nome,
          item.email,
          item.telefone,
          item.celular,
          item.cpf,
          item.cnpj,
          item.documento,
          item.endereco,
          item.categoria,
          item.origem
        ])).map((item) => ({
          id: item.id,
          type: 'Cliente' as const,
          title: item.nome,
          subtitle: item.email || item.telefone || item.celular || item.endereco,
          meta: item.categoria || item.situacao || 'Cliente',
          path: `/clientes/${item.id}`,
          date: item.updatedAt
        }))),
        ...take(projetos.filter((item) => matchesQuery(query, [
          item.nome,
          item.descricao,
          item.status,
          item.tipo,
          item.cidade,
          item.municipio,
          item.matricula,
          item.car,
          item.clienteNome
        ])).map((item) => ({
          id: item.id,
          type: 'Projeto' as const,
          title: item.nome,
          subtitle: item.clienteNome,
          meta: item.tipo || item.status,
          path: `/projetos/${item.id}`,
          date: item.updatedAt
        }))),
        ...take(orcamentos.filter((item) => matchesQuery(query, [
          item.codigoOrcamento,
          item.descricao,
          item.status,
          item.clienteNome,
          item.projetoNome
        ])).map((item) => ({
          id: item.id,
          type: 'Orçamento' as const,
          title: item.codigoOrcamento || item.descricao || `Orçamento ${item.id.slice(0, 8)}`,
          subtitle: item.clienteNome,
          meta: item.status,
          path: clientTabPath(item.clienteId, 'orcamentos', { orcamentoId: item.id }),
          date: item.updatedAt
        }))),
        ...take(tarefas.filter((item) => matchesQuery(query, [
          item.titulo,
          item.descricao,
          item.status,
          item.prioridade,
          item.categoria,
          item.projetoNome,
          item.clienteNome
        ])).map((item) => ({
          id: item.id,
          type: 'Tarefa' as const,
          title: item.titulo,
          subtitle: item.projetoNome || item.clienteNome,
          meta: item.status,
          path: `/tarefas?tarefaId=${item.id}`,
          date: item.dataLimite || item.updatedAt
        }))),
        ...take(compromissos.filter((item) => matchesQuery(query, [
          item.titulo,
          item.descricao,
          item.tipo,
          item.projetoNome,
          item.clienteNome
        ])).map((item) => ({
          id: item.id,
          type: 'Agenda' as const,
          title: item.titulo,
          subtitle: item.projetoNome || item.clienteNome,
          meta: item.tipo,
          path: `/calendario/compromisso/${item.id}`,
          date: item.data || item.updatedAt
        }))),
        ...take(documentos.filter((item) => matchesQuery(query, [
          item.nome,
          item.nomeOriginal,
          item.categoria,
          item.tags,
          item.extensao,
          item.caminhoRelativo
        ])).map((item) => ({
          id: item.id,
          type: 'Documento' as const,
          title: item.nomeOriginal || item.nome,
          subtitle: item.categoria,
          meta: item.extensao?.toUpperCase(),
          path: clientTabPath(item.clienteId, 'arquivos', {
            documentId: item.id,
            arquivo: item.nomeOriginal || item.nome
          }),
          date: item.updatedAt
        })))
      ];

      return {
        query: q || '',
        results: results.slice(0, 30)
      };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao executar busca global' });
    }
  });
}
