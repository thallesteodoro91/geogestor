export type PlanningFormKind =
  | 'cycle'
  | 'pillar'
  | 'objective'
  | 'keyResult'
  | 'initiative'
  | 'checkin'
  | 'decision'
  | 'risk';

export type PlanningFormErrors = Record<string, string>;

const requiredFields: Record<PlanningFormKind, Array<[string, string]>> = {
  cycle: [
    ['planning-cycle-first', 'nome'],
    ['cycle-start', 'dataInicio'],
    ['cycle-end', 'dataFim'],
    ['cycle-vision', 'visao']
  ],
  pillar: [['planning-pillar-first', 'nome'], ['pillar-order', 'ordem']],
  objective: [
    ['planning-objective-first', 'titulo'],
    ['objective-pillar', 'pilarId'],
    ['objective-owner', 'responsavel'],
    ['objective-deadline', 'dataLimite'],
    ['objective-order', 'ordem']
  ],
  keyResult: [
    ['planning-keyResult-first', 'titulo'],
    ['key-result-objective', 'objetivoId'],
    ['key-result-baseline', 'linhaBase'],
    ['key-result-target', 'meta'],
    ['key-result-unit', 'unidade']
  ],
  initiative: [
    ['planning-initiative-first', 'titulo'],
    ['initiative-objective', 'objetivoId'],
    ['initiative-owner', 'responsavel'],
    ['initiative-deadline', 'dataLimite'],
    ['initiative-progress', 'progresso']
  ],
  checkin: [['planning-checkin-first', 'data'], ['checkin-narrative', 'narrativa']],
  decision: [
    ['planning-decision-first', 'descricao'],
    ['decision-owner', 'responsavel'],
    ['decision-deadline', 'dataLimite']
  ],
  risk: [['planning-risk-first', 'descricao'], ['risk-owner', 'responsavel']]
};

function isBlank(value: string | undefined) {
  return !value?.trim();
}

export function validatePlanningForm(
  kind: PlanningFormKind,
  state: Record<string, string>,
  options: { editing?: boolean; hasAutomaticSource?: boolean } = {}
): PlanningFormErrors {
  const errors: PlanningFormErrors = {};

  for (const [id, key] of requiredFields[kind]) {
    if (isBlank(state[key])) errors[id] = 'Preencha este campo para continuar.';
  }

  if (kind === 'cycle' && state.dataInicio && state.dataFim && state.dataFim < state.dataInicio) {
    errors['cycle-end'] = 'A data final deve ser igual ou posterior à data inicial.';
  }

  if (kind === 'keyResult') {
    if (!options.editing && isBlank(state.objetivoId)) errors['key-result-objective'] = 'Selecione o objetivo relacionado.';
    if (!options.hasAutomaticSource && isBlank(state.valorAtual)) errors['key-result-current'] = 'Informe o valor atual.';
    for (const [id, key] of [['key-result-baseline', 'linhaBase'], ['key-result-target', 'meta'], ['key-result-current', 'valorAtual']] as const) {
      if (!isBlank(state[key]) && !Number.isFinite(Number(state[key].replace(',', '.')))) errors[id] = 'Informe um número válido.';
    }
  }

  if (kind === 'initiative') {
    const progress = Number(state.progresso);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) errors['initiative-progress'] = 'Informe um progresso entre 0 e 100.';
    if (!isBlank(state.orcamento) && (!Number.isFinite(Number(state.orcamento.replace(',', '.'))) || Number(state.orcamento.replace(',', '.')) < 0)) {
      errors['initiative-budget'] = 'Informe um orçamento igual ou maior que zero.';
    }
  }

  if ((kind === 'pillar' || kind === 'objective') && (!Number.isInteger(Number(state.ordem)) || Number(state.ordem) < 0 || Number(state.ordem) > 999)) {
    errors[kind === 'pillar' ? 'pillar-order' : 'objective-order'] = 'Informe uma ordem inteira entre 0 e 999.';
  }

  if (kind === 'checkin' && state.proximaRevisao && state.data && state.proximaRevisao < state.data) {
    errors['checkin-next-review'] = 'A próxima revisão não pode ser anterior a esta revisão.';
  }

  if (kind === 'decision' && state.status === 'concluida' && isBlank(state.notaConclusao)) {
    errors['decision-completion-note'] = 'Registre o resultado antes de concluir a decisão.';
  }

  return errors;
}
