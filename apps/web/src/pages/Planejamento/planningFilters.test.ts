import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategicDecision, StrategicKeyResult, StrategicObjective } from '@geogestor/contracts';
import {
  emptyPlanningFilters,
  filterAndSortObjectives,
  filterDecisions,
  hasPlanningFilters,
  planningFiltersFromParams
} from './planningFilters';

const objective = (overrides: Partial<StrategicObjective>): StrategicObjective => ({
  id: 'objective-a', cicloId: 'cycle', pilarId: 'pillar', titulo: 'Objetivo', descricao: null,
  responsavel: 'Ana', dataLimite: '2026-09-01', status: 'em_andamento', prioridade: 'media',
  ordem: 0, progresso: 50, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
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
