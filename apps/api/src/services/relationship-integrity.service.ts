import { and, eq, isNull } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';

export class RelationshipIntegrityError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RelationshipIntegrityError';
    this.statusCode = statusCode;
  }
}

type DatabaseExecutor = typeof db | any;

export async function assertActiveClient(clientId: string, database: DatabaseExecutor = db) {
  const [client] = await database.select({ id: schema.clientes.id })
    .from(schema.clientes)
    .where(and(eq(schema.clientes.id, clientId), isNull(schema.clientes.deletedAt)))
    .limit(1);
  if (!client) throw new RelationshipIntegrityError('O cliente informado não existe ou está inativo.');
  return client;
}

export async function getActiveProject(projectId: string, database: DatabaseExecutor = db) {
  const [project] = await database.select({
    id: schema.projetos.id,
    clienteId: schema.projetos.clienteId,
    propriedadeId: schema.projetos.propriedadeId
  }).from(schema.projetos)
    .where(and(eq(schema.projetos.id, projectId), isNull(schema.projetos.deletedAt)))
    .limit(1);
  if (!project) throw new RelationshipIntegrityError('O projeto informado não existe ou está inativo.');
  return project;
}

export async function resolveClientProjectLink(input: {
  clienteId?: string | null;
  projetoId?: string | null;
}, database: DatabaseExecutor = db) {
  if (!input.projetoId) {
    if (input.clienteId) await assertActiveClient(input.clienteId, database);
    return { clienteId: input.clienteId || null, projetoId: null, project: null };
  }

  const project = await getActiveProject(input.projetoId, database);
  if (input.clienteId && input.clienteId !== project.clienteId) {
    throw new RelationshipIntegrityError('O projeto informado pertence a outro cliente.');
  }
  return { clienteId: project.clienteId, projetoId: project.id, project };
}

export async function assertPropertyBelongsToClient(
  propertyId: string | null | undefined,
  clientId: string,
  database: DatabaseExecutor = db
) {
  if (!propertyId) return null;
  const [property] = await database.select({
    id: schema.propriedades.id,
    clienteId: schema.propriedades.clienteId
  }).from(schema.propriedades)
    .where(and(eq(schema.propriedades.id, propertyId), isNull(schema.propriedades.deletedAt)))
    .limit(1);
  if (!property) throw new RelationshipIntegrityError('A propriedade informada não existe ou está inativa.');
  if (property.clienteId !== clientId) {
    throw new RelationshipIntegrityError('A propriedade informada pertence a outro cliente.');
  }
  return property;
}

const dependencyChecks = [
  ['Orçamentos', schema.orcamentos, schema.orcamentos.projetoId, true],
  ['Despesas', schema.despesas, schema.despesas.projetoId, true],
  ['Notas fiscais', schema.notasFiscais, schema.notasFiscais.projetoId, true],
  ['Decisões financeiras', schema.projetoFinanceiroDecisoes, schema.projetoFinanceiroDecisoes.projetoId, true],
  ['Tarefas', schema.tarefas, schema.tarefas.projetoId, false],
  ['Compromissos', schema.compromissos, schema.compromissos.projetoId, false],
  ['Viagens', schema.viagens, schema.viagens.projetoId, false],
  ['Documentos e mapas', schema.documentos, schema.documentos.projetoId, false],
  ['Licenças', schema.licencas, schema.licencas.projetoId, false],
  ['Demandas ambientais', schema.ambiental, schema.ambiental.projetoId, false],
  ['Perícias', schema.pericias, schema.pericias.projetoId, false],
  ['Oportunidades', schema.oportunidades, schema.oportunidades.projetoId, false],
  ['Interações', schema.interacoes_cliente, schema.interacoes_cliente.projetoId, false],
  ['Eventos financeiros', schema.financeiroEventos, schema.financeiroEventos.projetoId, true],
  ['Iniciativas estratégicas', schema.iniciativasEstrategicas, schema.iniciativasEstrategicas.projetoId, false]
] as const;

export async function inspectProjectReassignment(projectId: string, database: DatabaseExecutor = db) {
  const dependencies: Array<{ label: string; count: number; financial: boolean }> = [];
  for (const [label, table, projectColumn, financial] of dependencyChecks) {
    const rows = await database.select({ id: (table as any).id })
      .from(table as any)
      .where(eq(projectColumn as any, projectId));
    if (rows.length) dependencies.push({ label, count: rows.length, financial });
  }
  return {
    allowed: !dependencies.some((item) => item.financial),
    hasFinancialDependencies: dependencies.some((item) => item.financial),
    dependencies
  };
}
