import crypto from 'node:crypto';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '../db';
import { schema } from '@geogestor/database';
import {
  ALERT_CATEGORY_LABELS,
  DEFAULT_ALERT_SETTINGS,
  type AlertCategory,
  type AlertCategoryConfig,
  type AlertSettings,
  type DeadlineAlert,
  type DeadlineAlertResponse
} from '@geogestor/contracts';

const TIME_ZONE = 'America/Sao_Paulo';
const CLOSED_PROJECT_STATUSES = new Set(['concluido', 'finalizado', 'arquivado', 'cancelado']);
const CLOSED_TASK_STATUSES = new Set(['concluido', 'finalizado', 'cancelado', 'arquivado']);
const CLOSED_BUDGET_STATUSES = new Set(['aprovado', 'rejeitado', 'recusado', 'cancelado', 'expirado', 'substituido']);
const CLOSED_CRM_STAGES = new Set(['ganho', 'ganha', 'perdido', 'perdida', 'encerrado', 'cancelado']);

export interface DeadlineSource {
  category: AlertCategory;
  sourceId: string;
  dueDate: string;
  title: string;
  description: string;
  link: string;
}

function normalize(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function saoPauloDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOrdinal(dateKey: string) {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function civilDaysBetween(fromDate: string, toDate: string) {
  return dateOrdinal(toDate) - dateOrdinal(fromDate);
}

export function addCivilDays(dateKey: string, days: number) {
  const ordinal = dateOrdinal(dateKey);
  return Number.isFinite(ordinal) ? new Date((ordinal + days) * 86_400_000).toISOString().slice(0, 10) : dateKey;
}

export function resolveOccurrenceCycle(
  dueDate: string,
  today: string,
  config: AlertCategoryConfig
) {
  const daysUntilDue = civilDaysBetween(today, dueDate);
  if (!Number.isFinite(daysUntilDue)) return null;
  if (daysUntilDue > config.daysBefore) return null;
  if (daysUntilDue < 0 && !config.keepOverdue) return null;
  if (daysUntilDue === 0 && !config.alertOnDueDate) return null;
  if (daysUntilDue === 0 && config.alertOnDueDate) return today;
  if (config.recurrence === 'once') return 'once';
  if (config.recurrence === 'daily') return today;

  const windowStart = addCivilDays(dueDate, -config.daysBefore);
  const elapsed = Math.max(0, civilDaysBetween(windowStart, today));
  const bucketStart = addCivilDays(windowStart, Math.floor(elapsed / config.intervalDays) * config.intervalDays);
  return bucketStart;
}

function timingLabel(daysUntilDue: number) {
  if (daysUntilDue < 0) return `Vencido há ${Math.abs(daysUntilDue)} dia${Math.abs(daysUntilDue) === 1 ? '' : 's'}`;
  if (daysUntilDue === 0) return 'Vence hoje';
  return `Vence em ${daysUntilDue} dia${daysUntilDue === 1 ? '' : 's'}`;
}

async function ensureSettings() {
  const existingCategories = await db.select().from(schema.alertaCategoriaConfiguracao);
  let legacyDays = 7;
  if (!existingCategories.length) {
    const [legacy] = await db.select({ value: schema.configuracoesOperacionais.valorJson })
      .from(schema.configuracoesOperacionais)
      .where(and(
        eq(schema.configuracoesOperacionais.chave, 'geogestor_alerta_dias'),
        isNull(schema.configuracoesOperacionais.deletedAt)
      ))
      .limit(1);
    if (legacy?.value) {
      try {
        const parsed = Number(JSON.parse(legacy.value));
        if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 365) legacyDays = parsed;
      } catch {
        const parsed = Number(legacy.value);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 365) legacyDays = parsed;
      }
    }
  }

  await db.insert(schema.alertaConfiguracao).values({
    id: 'default',
    habilitado: true,
    notificacaoNativa: true
  }).onConflictDoNothing();

  for (const defaultConfig of DEFAULT_ALERT_SETTINGS.categories) {
    await db.insert(schema.alertaCategoriaConfiguracao).values({
      categoria: defaultConfig.category,
      habilitado: defaultConfig.enabled,
      diasAntecedencia: existingCategories.length ? defaultConfig.daysBefore : legacyDays,
      recorrencia: defaultConfig.recurrence,
      intervaloDias: defaultConfig.intervalDays,
      alertarNoVencimento: defaultConfig.alertOnDueDate,
      manterVencidos: defaultConfig.keepOverdue
    }).onConflictDoNothing();
  }
}

export async function getAlertSettings(): Promise<AlertSettings> {
  await ensureSettings();
  const [[global], categories] = await Promise.all([
    db.select().from(schema.alertaConfiguracao).where(eq(schema.alertaConfiguracao.id, 'default')).limit(1),
    db.select().from(schema.alertaCategoriaConfiguracao)
  ]);
  const byCategory = new Map(categories.map((item) => [item.categoria, item]));
  return {
    enabled: global?.habilitado ?? true,
    nativeEnabled: global?.notificacaoNativa ?? true,
    categories: DEFAULT_ALERT_SETTINGS.categories.map((fallback) => {
      const stored = byCategory.get(fallback.category);
      return stored ? {
        category: fallback.category,
        enabled: stored.habilitado,
        daysBefore: stored.diasAntecedencia,
        recurrence: stored.recorrencia as AlertCategoryConfig['recurrence'],
        intervalDays: stored.intervaloDias,
        alertOnDueDate: stored.alertarNoVencimento,
        keepOverdue: stored.manterVencidos
      } : fallback;
    })
  };
}

export async function saveAlertSettings(settings: AlertSettings) {
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.insert(schema.alertaConfiguracao).values({
      id: 'default',
      habilitado: settings.enabled,
      notificacaoNativa: settings.nativeEnabled,
      updatedAt: now
    }).onConflictDoUpdate({
      target: schema.alertaConfiguracao.id,
      set: { habilitado: settings.enabled, notificacaoNativa: settings.nativeEnabled, updatedAt: now }
    });
    for (const category of settings.categories) {
      await tx.insert(schema.alertaCategoriaConfiguracao).values({
        categoria: category.category,
        habilitado: category.enabled,
        diasAntecedencia: category.daysBefore,
        recorrencia: category.recurrence,
        intervaloDias: category.intervalDays,
        alertarNoVencimento: category.alertOnDueDate,
        manterVencidos: category.keepOverdue,
        updatedAt: now
      }).onConflictDoUpdate({
        target: schema.alertaCategoriaConfiguracao.categoria,
        set: {
          habilitado: category.enabled,
          diasAntecedencia: category.daysBefore,
          recorrencia: category.recurrence,
          intervaloDias: category.intervalDays,
          alertarNoVencimento: category.alertOnDueDate,
          manterVencidos: category.keepOverdue,
          updatedAt: now
        }
      });
    }
  });
  return getAlertSettings();
}

export async function resetAlertSettings() {
  return saveAlertSettings(structuredClone(DEFAULT_ALERT_SETTINGS));
}

async function loadDeadlineSources(maxDates: Record<AlertCategory, string>): Promise<DeadlineSource[]> {
  const [projects, clientServices, tasks, receivables, payables, budgets, licenses, conditions, appointments, opportunities] = await Promise.all([
    db.select({
      id: schema.projetos.id, name: schema.projetos.nome, status: schema.projetos.status,
      dueDate: schema.projetos.dataEntrega, clientName: schema.clientes.nome
    }).from(schema.projetos)
      .leftJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
      .where(and(isNull(schema.projetos.deletedAt), lte(schema.projetos.dataEntrega, maxDates.project))).limit(500),
    db.select({
      id: schema.clientes.id, name: schema.clientes.nome, services: schema.clientes.servicos,
      dueDate: schema.clientes.previsaoEntrega, status: schema.clientes.situacao
    }).from(schema.clientes)
      .where(and(isNull(schema.clientes.deletedAt), lte(schema.clientes.previsaoEntrega, maxDates.project))).limit(500),
    db.select({
      id: schema.tarefas.id, title: schema.tarefas.titulo, status: schema.tarefas.status,
      dueDate: schema.tarefas.dataLimite, projectId: schema.tarefas.projetoId,
      projectName: schema.projetos.nome, clientName: schema.clientes.nome
    }).from(schema.tarefas)
      .leftJoin(schema.projetos, eq(schema.tarefas.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, eq(schema.tarefas.clienteId, schema.clientes.id))
      .where(and(isNull(schema.tarefas.deletedAt), lte(schema.tarefas.dataLimite, maxDates.task))).limit(500),
    db.select({
      id: schema.parcelas.id, number: schema.parcelas.numero, amount: schema.parcelas.valor,
      paidAmount: schema.parcelas.valorPago, status: schema.parcelas.statusPagamento,
      dueDate: schema.parcelas.dataVencimento, paidDate: schema.parcelas.dataPagamento,
      cancelledAt: schema.parcelas.canceladaEm, budgetId: schema.parcelas.orcamentoId,
      budgetCode: schema.orcamentos.codigoOrcamento, budgetDescription: schema.orcamentos.descricao,
      projectId: schema.orcamentos.projetoId, clientName: schema.clientes.nome
    }).from(schema.parcelas)
      .innerJoin(schema.orcamentos, eq(schema.parcelas.orcamentoId, schema.orcamentos.id))
      .leftJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
      .where(and(isNull(schema.parcelas.deletedAt), isNull(schema.orcamentos.deletedAt), lte(schema.parcelas.dataVencimento, maxDates.receivable))).limit(500),
    db.select({
      id: schema.despesas.id, description: schema.despesas.descricao, amount: schema.despesas.valor,
      status: schema.despesas.status, dueDate: schema.despesas.data, paidDate: schema.despesas.dataPagamento,
      cancelledAt: schema.despesas.canceladaEm, reversedAt: schema.despesas.estornadaEm,
      clientName: schema.clientes.nome
    }).from(schema.despesas)
      .leftJoin(schema.clientes, eq(schema.despesas.clienteId, schema.clientes.id))
      .where(and(isNull(schema.despesas.deletedAt), lte(schema.despesas.data, maxDates.payable))).limit(500),
    db.select({
      id: schema.orcamentos.id, code: schema.orcamentos.codigoOrcamento, description: schema.orcamentos.descricao,
      status: schema.orcamentos.status, dueDate: schema.orcamentos.validadeAte, clientName: schema.clientes.nome
    }).from(schema.orcamentos)
      .leftJoin(schema.clientes, eq(schema.orcamentos.clienteId, schema.clientes.id))
      .where(and(isNull(schema.orcamentos.deletedAt), lte(schema.orcamentos.validadeAte, maxDates.budget))).limit(500),
    db.select({
      id: schema.licencas.id, number: schema.licencas.numero, status: schema.licencas.status,
      dueDate: schema.licencas.dataVencimento, projectId: schema.licencas.projetoId,
      projectName: schema.projetos.nome, clientName: schema.clientes.nome
    }).from(schema.licencas)
      .leftJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
      .leftJoin(schema.clientes, eq(schema.licencas.clienteId, schema.clientes.id))
      .where(and(isNull(schema.licencas.deletedAt), lte(schema.licencas.dataVencimento, maxDates.license))).limit(500),
    db.select({
      id: schema.condicionantesAmbientais.id, title: schema.condicionantesAmbientais.titulo,
      status: schema.condicionantesAmbientais.status, dueDate: schema.condicionantesAmbientais.dataLimite,
      licenseId: schema.condicionantesAmbientais.licencaId, licenseNumber: schema.licencas.numero,
      projectName: schema.projetos.nome
    }).from(schema.condicionantesAmbientais)
      .innerJoin(schema.licencas, eq(schema.condicionantesAmbientais.licencaId, schema.licencas.id))
      .leftJoin(schema.projetos, eq(schema.licencas.projetoId, schema.projetos.id))
      .where(and(isNull(schema.condicionantesAmbientais.deletedAt), lte(schema.condicionantesAmbientais.dataLimite, maxDates.condition))).limit(500),
    db.select({
      id: schema.compromissos.id, title: schema.compromissos.titulo, dueDate: schema.compromissos.data,
      projectId: schema.compromissos.projetoId, clientName: schema.clientes.nome
    }).from(schema.compromissos)
      .leftJoin(schema.clientes, eq(schema.compromissos.clienteId, schema.clientes.id))
      .where(and(isNull(schema.compromissos.deletedAt), lte(schema.compromissos.data, maxDates.appointment))).limit(500),
    db.select({
      id: schema.oportunidades.id, title: schema.oportunidades.titulo, action: schema.oportunidades.proximaAcao,
      dueDate: schema.oportunidades.proximaAcaoEm, stage: schema.oportunidades.estagio,
      closedAt: schema.oportunidades.encerradoEm, clientName: schema.clientes.nome
    }).from(schema.oportunidades)
      .leftJoin(schema.clientes, eq(schema.oportunidades.clienteId, schema.clientes.id))
      .where(and(isNull(schema.oportunidades.deletedAt), lte(schema.oportunidades.proximaAcaoEm, maxDates.crm))).limit(500)
  ]);

  const sources: DeadlineSource[] = [];
  for (const item of projects) {
    if (!item.dueDate || CLOSED_PROJECT_STATUSES.has(normalize(item.status))) continue;
    sources.push({ category: 'project', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.name, description: item.clientName ? `Projeto de ${item.clientName}` : 'Prazo de entrega do projeto', link: `/projetos/${item.id}` });
  }
  for (const item of clientServices) {
    if (!item.dueDate || ['inativo', 'arquivado', 'cancelado'].includes(normalize(item.status))) continue;
    sources.push({ category: 'project', sourceId: `cliente-${item.id}`, dueDate: item.dueDate.slice(0, 10), title: `Serviços de ${item.name}`, description: item.services || 'Previsão de entrega cadastrada no cliente', link: `/clientes/${item.id}` });
  }
  for (const item of tasks) {
    if (!item.dueDate || CLOSED_TASK_STATUSES.has(normalize(item.status))) continue;
    sources.push({ category: 'task', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.title, description: item.projectName || item.clientName || 'Tarefa pendente', link: item.projectId ? `/projetos/${item.projectId}?tarefa=${item.id}` : `/tarefas?id=${item.id}` });
  }
  for (const item of receivables) {
    const remaining = Math.max(0, item.amount - (item.paidAmount || 0));
    if (!item.dueDate || remaining <= 0 || item.paidDate || item.cancelledAt || normalize(item.status) === 'pago' || normalize(item.status) === 'cancelado') continue;
    const reference = item.budgetCode || item.budgetDescription || `Parcela ${item.number}`;
    sources.push({ category: 'receivable', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: `Receber ${reference}`, description: `${formatCurrency(remaining)} pendente${item.clientName ? ` · ${item.clientName}` : ''}`, link: `/faturas?parcela=${item.id}` });
  }
  for (const item of payables) {
    if (!item.dueDate || item.paidDate || item.cancelledAt || item.reversedAt || normalize(item.status) === 'pago' || normalize(item.status) === 'cancelado') continue;
    sources.push({ category: 'payable', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.description, description: `${formatCurrency(item.amount)} a pagar${item.clientName ? ` · ${item.clientName}` : ''}`, link: `/despesas?id=${item.id}` });
  }
  for (const item of budgets) {
    if (!item.dueDate || CLOSED_BUDGET_STATUSES.has(normalize(item.status)) || normalize(item.status) === 'rascunho') continue;
    sources.push({ category: 'budget', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.code || item.description || 'Orçamento', description: item.clientName ? `Validade da proposta para ${item.clientName}` : 'Validade da proposta comercial', link: `/orcamentos/${item.id}` });
  }
  for (const item of licenses) {
    if (!item.dueDate || ['cancelada', 'arquivada'].includes(normalize(item.status))) continue;
    sources.push({ category: 'license', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: `Licença ${item.number}`, description: item.projectName || item.clientName || 'Licença ambiental', link: `/ambiental/licencas/${item.id}` });
  }
  for (const item of conditions) {
    if (!item.dueDate || ['cumprida', 'dispensada', 'cancelada'].includes(normalize(item.status))) continue;
    sources.push({ category: 'condition', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.title, description: `${item.licenseNumber ? `Licença ${item.licenseNumber}` : 'Condicionante'}${item.projectName ? ` · ${item.projectName}` : ''}`, link: `/ambiental/licencas/${item.licenseId}?condicionante=${item.id}` });
  }
  for (const item of appointments) {
    if (!item.dueDate) continue;
    sources.push({ category: 'appointment', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.title, description: item.clientName || 'Compromisso da agenda', link: `/calendario/${item.id}` });
  }
  for (const item of opportunities) {
    if (!item.dueDate || item.closedAt || CLOSED_CRM_STAGES.has(normalize(item.stage))) continue;
    sources.push({ category: 'crm', sourceId: item.id, dueDate: item.dueDate.slice(0, 10), title: item.action || item.title, description: `${item.title}${item.clientName ? ` · ${item.clientName}` : ''}`, link: `/crm?oportunidade=${item.id}` });
  }
  return sources;
}

async function occurrenceRows(keys: string[]) {
  const rows: Array<typeof schema.alertaOcorrencias.$inferSelect> = [];
  for (let index = 0; index < keys.length; index += 300) {
    rows.push(...await db.select().from(schema.alertaOcorrencias)
      .where(inArray(schema.alertaOcorrencias.chaveOcorrencia, keys.slice(index, index + 300))));
  }
  return rows;
}

export async function listDeadlineAlerts(today = saoPauloDateKey()): Promise<DeadlineAlertResponse> {
  const settings = await getAlertSettings();
  if (!settings.enabled) return { items: [], settings, generatedAt: new Date().toISOString() };
  const configByCategory = new Map(settings.categories.map((item) => [item.category, item]));
  const maxDates = Object.fromEntries(settings.categories.map((item) => [item.category, addCivilDays(today, item.daysBefore)])) as Record<AlertCategory, string>;
  const sources = await loadDeadlineSources(maxDates);
  const scheduled = sources.flatMap((source) => {
    const config = configByCategory.get(source.category);
    if (!config?.enabled) return [];
    const cycle = resolveOccurrenceCycle(source.dueDate, today, config);
    if (!cycle) return [];
    const occurrenceKey = `${source.category}:${source.sourceId}:${source.dueDate}:${cycle}`;
    return [{ source, cycle, occurrenceKey, daysUntilDue: civilDaysBetween(today, source.dueDate) }];
  });

  for (const item of scheduled) {
    await db.insert(schema.alertaOcorrencias).values({
      id: crypto.randomUUID(),
      chaveOcorrencia: item.occurrenceKey,
      categoria: item.source.category,
      origemId: item.source.sourceId,
      dataVencimento: item.source.dueDate,
      ciclo: item.cycle
    }).onConflictDoNothing();
  }

  const states = new Map((await occurrenceRows(scheduled.map((item) => item.occurrenceKey)))
    .map((item) => [item.chaveOcorrencia, item]));
  const items = scheduled.flatMap<DeadlineAlert>((item) => {
    const state = states.get(item.occurrenceKey);
    if (!state || state.ocultadaEm || state.deletedAt) return [];
    return [{
      id: state.id,
      occurrenceKey: item.occurrenceKey,
      category: item.source.category,
      categoryLabel: ALERT_CATEGORY_LABELS[item.source.category],
      sourceId: item.source.sourceId,
      title: item.source.title,
      description: item.source.description,
      dueDate: item.source.dueDate,
      daysUntilDue: item.daysUntilDue,
      timingLabel: timingLabel(item.daysUntilDue),
      severity: item.daysUntilDue < 0 ? 'critical' : item.daysUntilDue === 0 ? 'warning' : 'info',
      link: item.source.link,
      readAt: state.lidaEm,
      nativeNotifiedAt: state.notificadaNativamenteEm,
      createdAt: state.createdAt
    }];
  });
  items.sort((left, right) => {
    const leftGroup = left.daysUntilDue < 0 ? 0 : left.daysUntilDue === 0 ? 1 : 2;
    const rightGroup = right.daysUntilDue < 0 ? 0 : right.daysUntilDue === 0 ? 1 : 2;
    return leftGroup - rightGroup || left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title, 'pt-BR');
  });
  return { items, settings, generatedAt: new Date().toISOString() };
}

async function updateOccurrences(ids: string[], values: Partial<typeof schema.alertaOcorrencias.$inferInsert>) {
  for (let index = 0; index < ids.length; index += 300) {
    await db.update(schema.alertaOcorrencias).set({ ...values, updatedAt: new Date().toISOString() })
      .where(inArray(schema.alertaOcorrencias.id, ids.slice(index, index + 300)));
  }
}

export const DeadlineAlertStateService = {
  markRead(ids: string[]) {
    return updateOccurrences(ids, { lidaEm: new Date().toISOString() });
  },
  dismiss(ids: string[]) {
    return updateOccurrences(ids, { ocultadaEm: new Date().toISOString() });
  },
  restore(ids: string[]) {
    return updateOccurrences(ids, { ocultadaEm: null });
  },
  markNativeNotified(ids: string[]) {
    return updateOccurrences(ids, { notificadaNativamenteEm: new Date().toISOString() });
  }
};
