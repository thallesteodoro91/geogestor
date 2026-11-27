export const planningStatusOptions = {
  cycle: [['rascunho', 'Rascunho'], ['ativo', 'Ativo'], ['em_revisao', 'Em revisão'], ['encerrado', 'Encerrado']],
  objective: [['nao_iniciado', 'Não iniciado'], ['em_andamento', 'Em andamento'], ['em_risco', 'Em risco'], ['concluido', 'Concluído'], ['cancelado', 'Cancelado']],
  initiative: [['planejada', 'Planejada'], ['em_andamento', 'Em andamento'], ['bloqueada', 'Bloqueada'], ['concluida', 'Concluída'], ['cancelada', 'Cancelada']],
  checkin: [['no_rumo', 'No rumo'], ['atencao', 'Atenção'], ['critico', 'Crítico']],
  decision: [['pendente', 'Pendente'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluída'], ['cancelada', 'Cancelada']],
  risk: [['aberto', 'Aberto'], ['mitigando', 'Em mitigação'], ['resolvido', 'Resolvido'], ['aceito', 'Aceito']]
} as const;

export const planningPriorityOptions = [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta'], ['critica', 'Crítica']] as const;
export const planningImpactOptions = [['baixo', 'Baixo'], ['medio', 'Médio'], ['alto', 'Alto'], ['critico', 'Crítico']] as const;

export const planningLabels: Record<string, string> = Object.fromEntries([
  ...Object.values(planningStatusOptions).flat(), ...planningPriorityOptions, ...planningImpactOptions
]);

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const measureFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const measureCurrencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatPlanningMeasure(value: number, unit: string) {
  if (unit === 'BRL') return measureCurrencyFormatter.format(value);
  return `${measureFormatter.format(value)}${unit === '%' ? '%' : ` ${unit}`}`;
}

export function formatPlanningDate(value?: string | null) {
  if (!value) return 'Não definida';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function planningDeadlineOutsideCycle(deadline: string, cycle?: { dataInicio: string; dataFim: string }) {
  return Boolean(deadline && cycle && (deadline < cycle.dataInicio || deadline > cycle.dataFim));
}

export const planningEntities = {
  cycle: { endpoint: 'ciclos', create: 'Criar planejamento estratégico', edit: 'Editar ciclo estratégico', submit: 'Criar ciclo' },
  pillar: { endpoint: 'pilares', create: 'Novo pilar estratégico', edit: 'Editar pilar estratégico', submit: 'Criar pilar' },
  objective: { endpoint: 'objetivos', create: 'Novo objetivo estratégico', edit: 'Editar objetivo estratégico', submit: 'Criar objetivo' },
  keyResult: { endpoint: 'resultados-chave', create: 'Novo resultado-chave', edit: 'Editar resultado-chave', submit: 'Criar resultado-chave' },
  initiative: { endpoint: 'iniciativas', create: 'Nova iniciativa', edit: 'Editar iniciativa', submit: 'Criar iniciativa' },
  checkin: { endpoint: 'checkins', create: 'Registrar revisão estratégica', edit: 'Editar revisão estratégica', submit: 'Registrar revisão' },
  decision: { endpoint: 'decisoes', create: 'Nova decisão estratégica', edit: 'Editar decisão estratégica', submit: 'Criar decisão' },
  risk: { endpoint: 'riscos', create: 'Novo risco estratégico', edit: 'Editar risco estratégico', submit: 'Criar risco' }
} as const;
export type PlanningFormKind = keyof typeof planningEntities;

// Copy only missing fields on explicit request; operational links never sync strategic progress.
export function planningExecutionSuggestion(
  current: Record<string, string>,
  task?: { titulo: string; dataLimite?: string | null; projetoId: string | null },
  project?: { nome: string; dataEntrega?: string | null }
): Record<string, string> {
  const deadline = task ? task.dataLimite : project?.dataEntrega;
  return { ...current, titulo: current.titulo.trim() ? current.titulo : task?.titulo || project?.nome || '',
    dataLimite: current.dataLimite || deadline?.slice(0, 10) || '',
    projetoId: current.projetoId || task?.projetoId || '' };
}
