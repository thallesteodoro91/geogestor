import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPlanningDate, planningDeadlineOutsideCycle, planningExecutionSuggestion } from './planningMetadata';

test('prazo fora do horizonte avisa sem impedir registros históricos e data civil não muda de dia', () => {
  const cycle = { dataInicio: '2026-01-01', dataFim: '2026-12-31' };
  assert.equal(planningDeadlineOutsideCycle('', cycle), false);
  assert.equal(planningDeadlineOutsideCycle('2026-12-31', cycle), false);
  assert.equal(planningDeadlineOutsideCycle('2027-01-01', cycle), true);
  assert.equal(planningDeadlineOutsideCycle('2025-12-31', cycle), true);
  assert.match(formatPlanningDate('2026-01-01'), /01.*jan.*2026/);
});

test('reaproveitar execução preenche vazios e preserva campos, vínculos e progresso existentes', () => {
  const task = { titulo: 'Levantamento', dataLimite: '2026-12-15', projetoId: 'project-a' };
  const current = { titulo: 'Título estratégico', dataLimite: '2026-11-30', projetoId: 'project-b', progresso: '42', responsavel: 'Ana' };
  assert.deepEqual(planningExecutionSuggestion(current, task), current);
  const reused = planningExecutionSuggestion({ titulo: '', dataLimite: '', projetoId: '', progresso: '0' }, task);
  assert.equal(reused.titulo, 'Levantamento');
  assert.equal(reused.dataLimite, '2026-12-15');
  assert.equal(reused.projetoId, 'project-a');
  assert.equal(reused.progresso, '0');
});
