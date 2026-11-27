import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategicCheckin, StrategicDecision, StrategicKeyResult, StrategicObjective, StrategicRisk } from '@geogestor/contracts';
import {
  emptyPlanningFilters,
  filterCheckins,
  filterAndSortObjectives,
  filterDecisions,
  hasPlanningFilters,
  planningFiltersFromParams
} from './planningFilters';
import { normalizePlanningParams, changePlanningTab, changePlanningCycle, filterRisks, filterAndSortInitiatives } from './planningFilters';
import { changeGovernanceView, clearPlanningScope, governanceView, governanceViewForRecord } from './planningFilters';
import { strategicRiskObjectiveId } from '@geogestor/contracts/src/strategic-planning';

test('riscos do objetivo incluem vínculo pela iniciativa sem reescrever os dados', () => {
  const initiatives = [{ id: 'i', objetivoId: 'o' }];
  const risks = [
    { id: 'indirect', objetivoId: null, iniciativaId: 'i', impacto: 'alto' },
    { id: 'direct', objetivoId: 'o', iniciativaId: null, impacto: 'baixo' },
    { id: 'general', objetivoId: null, iniciativaId: null, impacto: 'critico' }
  ] as StrategicRisk[];
  const result = filterRisks(risks, { ...emptyPlanningFilters, objetivo: 'o' }, initiatives);
  assert.deepEqual(result.map(item => item.id), ['indirect', 'direct']);
  assert.equal(strategicRiskObjectiveId(risks[0], initiatives), 'o');
  assert.equal(strategicRiskObjectiveId(risks[2], initiatives), null);
  assert.equal(risks[0].objetivoId, null);
});

test('governança mantém busca e objetivo, descarta critérios incompatíveis e paginação ao mudar lista', () => {
  const original = new URLSearchParams('aba=revisoes&ciclo=c&revisoes.lista=riscos&revisoes.status=aceito&revisoes.risco=critico&revisoes.responsavel=Ana&revisoes.busca=entrega&revisoes.pagina.risks=3&foco=risk-1&iniciativas.status=bloqueada');
  const next = changeGovernanceView(original, 'revisoes');
  assert.equal(governanceView(next), 'revisoes');
  assert.equal(next.get('revisoes.busca'), 'entrega');
  for (const key of ['status', 'risco', 'responsavel', 'pagina.risks']) assert.equal(next.has(`revisoes.${key}`), false);
  assert.equal(next.has('foco'), false);
  assert.equal(next.get('iniciativas.status'), 'bloqueada');
  assert.equal(original.get('revisoes.status'), 'aceito');
  assert.equal(governanceView(new URLSearchParams('revisoes.status=aceito')), 'todas');
  assert.equal(governanceView(new URLSearchParams()), 'revisoes');
  assert.equal(governanceViewForRecord('risk-uuid'), 'riscos');
  assert.equal(governanceViewForRecord('decision-uuid'), 'decisoes');
  assert.equal(governanceView(new URLSearchParams('aba=revisoes&foco=risk-uuid')), 'riscos');
  assert.equal(governanceView(new URLSearchParams('aba=revisoes&foco=decision-uuid')), 'decisoes');
});

test('limpeza de escopo reúne filtros, paginação e foco sem apagar a lista ou outro contexto', () => {
  const result = clearPlanningScope(new URLSearchParams('aba=revisoes&ciclo=c&revisoes.lista=decisoes&revisoes.status=pendente&revisoes.pagina.decisions=2&foco=decision-x&objetivos.status=em_risco'), 'revisoes');
  assert.equal(result.get('revisoes.lista'), 'decisoes');
  assert.equal(result.get('objetivos.status'), 'em_risco');
  assert.equal(result.has('revisoes.status'), false);
  assert.equal(result.has('revisoes.pagina.decisions'), false);
  assert.equal(result.has('foco'), false);
});

const objective = (overrides: Partial<StrategicObjective>): StrategicObjective => ({
  id: 'objective-a', cicloId: 'cycle', pilarId: 'pillar', titulo: 'Objetivo', descricao: null,
  responsavel: 'Ana', dataLimite: '2026-09-01', status: 'em_andamento', prioridade: 'media',
  ordem: 0, progresso: 50, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
});

test('migre favoritos antigos e mantenha filtros por aba após trocar, voltar e recarregar', () => {
  const original = new URLSearchParams('aba=objetivos&status=nao_iniciado&ordem=prioridade');
  const migrated = normalizePlanningParams(original, 'objetivos');
  const initiatives = changePlanningTab(migrated, 'objetivos', 'iniciativas');
  assert.equal(planningFiltersFromParams(initiatives, 'iniciativas').status, '');
  assert.equal(planningFiltersFromParams(initiatives, 'iniciativas').ordem, '');
  const back = changePlanningTab(new URLSearchParams(initiatives.toString()), 'iniciativas', 'objetivos');
  assert.equal(planningFiltersFromParams(back, 'objetivos').status, 'nao_iniciado');
  assert.equal(planningFiltersFromParams(back, 'objetivos').ordem, 'prioridade');
  assert.equal(back.has('status'), false);
  assert.equal(original.get('status'), 'nao_iniciado');
});

test('descarta situação e ordenação incompatíveis e critérios invisíveis', () => {
  const params = normalizePlanningParams(new URLSearchParams('iniciativas.status=nao_iniciado&iniciativas.ordem=prioridade&iniciativas.dados=desatualizado'), 'iniciativas');
  assert.deepEqual(planningFiltersFromParams(params, 'iniciativas'), emptyPlanningFilters);
  assert.equal(hasPlanningFilters({ ...emptyPlanningFilters, ordem: 'prazo' }), false);
});

test('trocar ciclo remove filtros, paginação e foco de todas as abas sem alterar o original', () => {
  const original = new URLSearchParams('aba=iniciativas&ciclo=anterior&iniciativas.objetivo=antigo&objetivos.status=em_risco&revisoes.pagina.risks=3&foco=risk-antigo');
  const next = changePlanningCycle(original, 'novo');
  assert.equal(next.toString(), 'aba=iniciativas&ciclo=novo');
  assert.equal(original.get('ciclo'), 'anterior');
});

test('situações compartilhadas têm estado independente e risco aceito continua filtrável', () => {
  const params = new URLSearchParams('objetivos.status=em_andamento&iniciativas.status=planejada&revisoes.status=aceito');
  const next = normalizePlanningParams(params, 'revisoes');
  assert.equal(planningFiltersFromParams(next, 'objetivos').status, 'em_andamento');
  assert.equal(planningFiltersFromParams(next, 'iniciativas').status, 'planejada');
  const risks = [{ id: 'accepted', status: 'aceito', impacto: 'alto' }, { id: 'open', status: 'aberto', impacto: 'critico' }] as StrategicRisk[];
  assert.deepEqual(filterRisks(risks, planningFiltersFromParams(next, 'revisoes')).map(item => item.id), ['accepted']);
});

test('ordena impacto crítico, alto, médio e baixo sem depender de identificadores', () => {
  const risks = [{ id: 'a', impacto: 'baixo' }, { id: 'd', impacto: 'critico' }, { id: 'c', impacto: 'medio' }, { id: 'b', impacto: 'alto' }] as StrategicRisk[];
  assert.deepEqual(filterRisks(risks, emptyPlanningFilters).map(item => item.impacto), ['critico', 'alto', 'medio', 'baixo']);
  assert.equal(risks[0].impacto, 'baixo');
});

test('filtro de objetivos não esconde iniciativa ao navegar de aba', () => {
  const next = changePlanningTab(new URLSearchParams('status=nao_iniciado'), 'objetivos', 'iniciativas');
  const items = [{ id: 'i', titulo: 'Conferência', status: 'planejada', dataLimite: '2027-10-31' }] as Parameters<typeof filterAndSortInitiatives>[0];
  assert.equal(filterAndSortInitiatives(items, planningFiltersFromParams(next, 'iniciativas'), '2026-10-31').length, 1);
});

test('busca por título e descrição combina com os demais filtros', () => {
  const items = [objective({ titulo: 'Qualidade', descricao: 'Conferir entregas', responsavel: 'Ana' }), objective({ id: 'b', titulo: 'Crescimento', responsavel: 'Ana' })];
  assert.deepEqual(filterAndSortObjectives(items, [], { ...emptyPlanningFilters, busca: 'ENTREGAS', responsavel: 'Ana' }, '2026-10-31').map(item => item.id), ['objective-a']);
});

test('busca preserva espaço durante digitação de mais de uma palavra', () => {
  const params = normalizePlanningParams(new URLSearchParams('iniciativas.busca=Conferir+'), 'iniciativas');
  assert.equal(planningFiltersFromParams(params, 'iniciativas').busca, 'Conferir ');
});

test('separa próximos 30 dias de prazos realmente futuros', () => {
  const items = [
    objective({ id: 'today', dataLimite: '2026-09-15' }),
    objective({ id: 'boundary', dataLimite: '2026-10-15' }),
    objective({ id: 'future', dataLimite: '2026-10-16' })
  ];
  assert.deepEqual(filterAndSortObjectives(items, [], { ...emptyPlanningFilters, prazo: 'proximos_30' }, '2026-09-15').map((item) => item.id), ['today', 'boundary']);
  assert.deepEqual(filterAndSortObjectives(items, [], { ...emptyPlanningFilters, prazo: 'futuro' }, '2026-09-15').map((item) => item.id), ['future']);
});

test('ignora filtros sem significado para check-ins em vez de ocultar toda a coleção', () => {
  const checkins = [{ id: 'checkin-a', status: 'no_rumo', objetivoId: 'objective-a' }] as StrategicCheckin[];
  const filtered = filterCheckins(checkins, { ...emptyPlanningFilters, responsavel: 'Ana', prioridade: 'alta', dados: 'desatualizado' });
  assert.deepEqual(filtered.map((item) => item.id), ['checkin-a']);
});

test('preserva filtros e ordenação na URL', () => {
  const filters = planningFiltersFromParams(new URLSearchParams('responsavel=Ana&prioridade=alta&ordem=prazo'));
  assert.equal(filters.responsavel, 'Ana');
  assert.equal(filters.prioridade, 'alta');
  assert.equal(filters.ordem, 'prazo');
  assert.equal(hasPlanningFilters(filters), true);
  assert.equal(hasPlanningFilters(emptyPlanningFilters), false);
});

test('filtra objetivos por responsável, prazo e qualidade dos dados sem alterar a coleção original', () => {
  const original = [
    objective({ id: 'late', responsavel: 'Ana Souza', dataLimite: '2026-07-01', ordem: 2 }),
    objective({ id: 'future', responsavel: 'Bruno', dataLimite: '2026-10-01', ordem: 1 })
  ];
  const results = [{ objetivoId: 'late', estadoDado: 'desatualizado' }] as StrategicKeyResult[];
  const filtered = filterAndSortObjectives(original, results, {
    ...emptyPlanningFilters,
    responsavel: 'ana', prazo: 'vencido', dados: 'desatualizado'
  }, '2026-07-31');

  assert.deepEqual(filtered.map((item) => item.id), ['late']);
  assert.deepEqual(original.map((item) => item.id), ['late', 'future']);
});

test('usa a ordem manual como padrão e permite ordenar por prioridade', () => {
  const items = [
    objective({ id: 'second', ordem: 2, prioridade: 'critica' }),
    objective({ id: 'first', ordem: 1, prioridade: 'baixa' })
  ];
  assert.deepEqual(filterAndSortObjectives(items, [], emptyPlanningFilters, '2026-07-31').map((item) => item.id), ['first', 'second']);
  assert.deepEqual(filterAndSortObjectives(items, [], { ...emptyPlanningFilters, ordem: 'prioridade' }, '2026-07-31').map((item) => item.id), ['second', 'first']);
});

test('separa decisões abertas, vencidas e atualizadas por filtros combinados', () => {
  const items = [
    { id: 'late', responsavel: 'Ana', prazo: '2026-07-01', status: 'pendente', objetivoId: 'o1', updatedAt: '2026-07-10T00:00:00Z' },
    { id: 'done', responsavel: 'Ana', prazo: '2026-07-01', status: 'concluida', objetivoId: 'o1', updatedAt: '2026-07-20T00:00:00Z' }
  ] as StrategicDecision[];
  const filtered = filterDecisions(items, {
    ...emptyPlanningFilters, responsavel: 'Ana', status: 'pendente', prazo: 'vencido', objetivo: 'o1'
  }, '2026-07-31');
  assert.deepEqual(filtered.map((item) => item.id), ['late']);
});
