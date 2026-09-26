import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatTaskPeriodLabel,
  getTaskPeriodRange,
  resolveProjectScope,
  resolveTaskCompletionPeriod,
  validateCustomTaskRange,
} from './dashboardFilters';

const referenceDate = new Date(2026, 7, 30, 12, 0, 0);

test('resolve os períodos predefinidos a partir da data local', () => {
  assert.deepEqual(getTaskPeriodRange('month', '', '', referenceDate), {
    start: '2026-08-01',
    end: '2026-08-31',
  });
  assert.deepEqual(getTaskPeriodRange('three_months', '', '', referenceDate), {
    start: '2026-06-01',
    end: '2026-08-31',
  });
  assert.deepEqual(getTaskPeriodRange('year', '', '', referenceDate), {
    start: '2026-01-01',
    end: '2026-12-31',
  });
});

test('valida e preserva o período personalizado', () => {
  assert.equal(validateCustomTaskRange('', ''), 'Informe as datas inicial e final.');
  assert.equal(validateCustomTaskRange('2026-02-30', '2026-03-01'), 'Informe as datas inicial e final.');
  assert.equal(validateCustomTaskRange('2026-08-20', '2026-08-10'), 'A data inicial não pode ser posterior à data final.');
  assert.equal(validateCustomTaskRange('2026-08-01', '2026-08-31'), null);
  assert.deepEqual(getTaskPeriodRange('custom', '2026-08-01', '2026-08-31', referenceDate), {
    start: '2026-08-01',
    end: '2026-08-31',
  });
  assert.equal(getTaskPeriodRange('custom', '', '', referenceDate), null);
});

test('normaliza filtros vindos da URL e formata o período em pt-BR', () => {
  assert.equal(resolveProjectScope('all'), 'all');
  assert.equal(resolveProjectScope('desconhecido'), 'active');
  assert.equal(resolveTaskCompletionPeriod('three_months'), 'three_months');
  assert.equal(resolveTaskCompletionPeriod('desconhecido'), 'month');
  assert.equal(
    formatTaskPeriodLabel('month', { start: '2026-08-01', end: '2026-08-31' }),
    'Agosto de 2026',
  );
  assert.equal(
    formatTaskPeriodLabel('three_months', { start: '2026-06-01', end: '2026-08-31' }),
    '01 de jun. de 2026 – 31 de ago. de 2026',
  );
});
