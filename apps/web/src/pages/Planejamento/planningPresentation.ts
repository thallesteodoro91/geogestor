import type { StrategicPlanningSnapshot, StrategicTimelineItem } from '@geogestor/contracts';
import { strategicRiskObjectiveId } from '@geogestor/contracts/src/strategic-planning';
import { formatPlanningDate, planningLabels } from './planningMetadata';
import type { PlanningDialog } from './StrategicPlanningFormModal';
import type { PlanningTab } from './planningFilters';

export type PlanningAlert = {
  id: string; title: string; description: string; tab: PlanningTab; recordId: string;
  action: string; tone: 'danger' | 'warning'; priority: number; deadline: string;
  objectiveId?: string | null;
};

export function planningAlerts(snapshot: StrategicPlanningSnapshot): PlanningAlert[] {
  const items: PlanningAlert[] = [];
  snapshot.resultadosChave.filter(item => item.desatualizado || item.estadoDado === 'indisponivel').forEach(item => items.push({
    id: `keyResult-${item.id}`, objectiveId: item.objetivoId, title: `${item.estadoDado === 'indisponivel' ? 'Dado indisponível' : 'Atualizar indicador'}: ${item.titulo}`,
    description: `Fonte: ${item.fonteNome}`, tab: 'objetivos', recordId: `keyResult-${item.id}`,
    action: 'Atualizar indicador', tone: 'warning', priority: 1, deadline: item.ultimaAtualizacao || ''
  }));
  snapshot.iniciativas.filter(item => item.atrasada || item.status === 'bloqueada').forEach(item => items.push({
    id: `initiative-${item.id}`, objectiveId: item.objetivoId, title: `${item.status === 'bloqueada' ? 'Iniciativa bloqueada' : 'Iniciativa atrasada'}: ${item.titulo}`,
    description: `Responsável: ${item.responsavel}`, tab: 'iniciativas', recordId: `initiative-${item.id}`,
    action: 'Abrir iniciativa', tone: 'danger', priority: 2, deadline: item.dataLimite
  }));
  snapshot.objetivos.filter(item => item.status === 'em_risco').forEach(item => items.push({
    id: `objective-${item.id}`, objectiveId: item.id, title: `Objetivo em risco: ${item.titulo}`, description: `Responsável: ${item.responsavel}`,
    tab: 'objetivos', recordId: `objective-${item.id}`, action: 'Abrir objetivo', tone: 'warning', priority: 2, deadline: item.dataLimite
  }));
  snapshot.riscos.filter(item => ['alto', 'critico'].includes(item.impacto) && !['resolvido', 'aceito'].includes(item.status)).forEach(item => items.push({
    id: `risk-${item.id}`, objectiveId: strategicRiskObjectiveId(item, snapshot.iniciativas), title: `Risco ${item.impacto === 'critico' ? 'crítico' : 'alto'}`, description: item.descricao,
    tab: 'revisoes', recordId: `risk-${item.id}`, action: 'Abrir risco', tone: 'danger', priority: item.impacto === 'critico' ? 4 : 3, deadline: ''
  }));
  return items.sort((a, b) => b.priority - a.priority || a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id));
}

export function planningDeletionDescription(kind: PlanningDialog['kind'], id: string, snapshot?: StrategicPlanningSnapshot) {
  const base = 'A exclusão retira o registro da visão ativa e fica registrada no histórico de auditoria.';
  const count = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;
  if (!snapshot) return base;
  if (kind === 'objective') {
    const initiatives = snapshot.iniciativas.filter(item => item.objetivoId === id);
    const initiativeIds = new Set(initiatives.map(item => item.id));
    const risks = snapshot.riscos.filter(item => item.objetivoId === id || (item.iniciativaId && initiativeIds.has(item.iniciativaId))).length;
    return `${base} Serão removidos deste planejamento ${count(snapshot.resultadosChave.filter(item => item.objetivoId === id).length, 'resultado-chave', 'resultados-chave')} e ${count(initiatives.length, 'iniciativa', 'iniciativas')}. Serão preservados ${count(risks, 'risco', 'riscos')}, ${count(snapshot.checkins.filter(item => item.objetivoId === id).length, 'revisão', 'revisões')} e ${count(snapshot.decisoes.filter(item => item.objetivoId === id).length, 'decisão', 'decisões')}, com os vínculos ao objetivo ou às iniciativas removidos. Projetos e tarefas vinculados serão preservados.`;
  }
  if (kind === 'initiative') return `${base} Os riscos vinculados (${snapshot.riscos.filter(item => item.iniciativaId === id).length}) serão preservados sem o vínculo com esta iniciativa. O objetivo, o projeto e a tarefa serão preservados.`;
  if (kind === 'checkin') return `${base} A captura de indicadores desta revisão também será removida das comparações. As decisões vinculadas (${snapshot.decisoes.filter(item => item.checkinId === id).length}) serão preservadas sem o vínculo com esta revisão.`;
  if (kind === 'pillar' && snapshot.objetivos.some(item => item.pilarId === id)) return 'Este pilar possui objetivos. Mova ou exclua os objetivos antes de remover o pilar.';
  return `${base} Os demais registros serão preservados.`;
}

export function planningReturnPath(value: string | null): string | null {
  if (!value) return null;
  // Only a local Planning route can be used as a return destination.
  try {
    const parsed = new URL(value, 'https://local.invalid');
    return parsed.origin === 'https://local.invalid' && parsed.pathname === '/planejamento'
      ? `${parsed.pathname}${parsed.search}` : null;
  } catch { return null; }
}

export function latestPlanningUpdate(records: Array<{ updatedAt: string }>): string | null {
  return records.reduce<string | null>((latest, item) => {
    if (!item.updatedAt || !Number.isFinite(Date.parse(item.updatedAt))) return latest;
    return !latest || Date.parse(item.updatedAt) > Date.parse(latest) ? item.updatedAt : latest;
  }, null);
}

export function planningAlertGroups(snapshot: StrategicPlanningSnapshot): Array<PlanningAlert & { causes: PlanningAlert[] }> {
  const groups = new Map<string, PlanningAlert & { causes: PlanningAlert[] }>();
  for (const alert of planningAlerts(snapshot)) {
    const key = alert.objectiveId ? `objective-${alert.objectiveId}` : alert.id;
    const existing = groups.get(key);
    if (existing) existing.causes.push(alert);
    else groups.set(key, { ...alert, causes: [alert] });
  }
  return [...groups.values()].map(group => {
    const objective = snapshot.objetivos.find(item => item.id === group.objectiveId);
    return objective && group.causes.length > 1 ? { ...group, title: objective.titulo, description: `${group.causes.length} causas relacionadas · ${group.title}` } : group;
  });
}

export function planningTimelineDescription(item: StrategicTimelineItem, snapshot: StrategicPlanningSnapshot) {
  const id = item.id.slice(item.id.indexOf(':') + 1);
  if (item.tipo === 'decisao') {
    const decision = snapshot.decisoes.find(record => record.id === id);
    if (decision) return `Responsável: ${decision.responsavel} · prazo ${formatPlanningDate(decision.prazo)}`;
  }
  if (item.tipo === 'risco') {
    const risk = snapshot.riscos.find(record => record.id === id);
    if (risk) return `Impacto ${planningLabels[risk.impacto]?.toLowerCase() || risk.impacto} · probabilidade ${(planningLabels[risk.probabilidade]?.toLowerCase() || risk.probabilidade).replace(/o$/, 'a')}`;
  }
  if (item.tipo === 'iniciativa') {
    const initiative = snapshot.iniciativas.find(record => record.id === id);
    if (initiative) return initiative.atrasada ? `Prazo vencido em ${formatPlanningDate(initiative.dataLimite)}` : `Situação alterada para ${planningLabels[initiative.status] || initiative.status}`;
  }
  return item.descricao;
}
