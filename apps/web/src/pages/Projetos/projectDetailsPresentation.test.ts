import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatFileSize,
  formatProjectArea,
  formatProjectDate,
  formatProjectLocation,
  getDeadlinePresentation,
  isTaskOverdue,
  localDateInputValue
} from './projectDetailsPresentation';

test('formats project dates without shifting the calendar day', () => {
  assert.equal(formatProjectDate('2022-10-30'), '30/10/2022');
  assert.equal(formatProjectDate('2022-10-30T00:00:00.000Z'), '30/10/2022');
  assert.equal(localDateInputValue(new Date(2026, 8, 2, 23, 30)), '2026-09-02');
});

test('formats Brazilian area and removes duplicated location values', () => {
  assert.equal(formatProjectArea(348.21), '348,21 ha');
  assert.equal(formatProjectLocation('da Luz', 'da Luz'), 'da Luz');
  assert.equal(formatProjectLocation('SC', 'Florianópolis'), 'Florianópolis/SC');
});

test('derives deadline status while respecting completed projects', () => {
  const reference = new Date('2026-09-01T12:00:00.000Z');
  assert.equal(getDeadlinePresentation('Em Andamento', '2026-09-13', reference).label, 'Entrega em 12 dias');
  assert.equal(getDeadlinePresentation('Em Andamento', '2026-08-24', reference).label, 'Atrasado há 8 dias');
  assert.equal(getDeadlinePresentation('Concluído', '2023-02-06', reference).tone, 'success');
});

test('formats file sizes and identifies overdue open tasks', () => {
  assert.equal(formatFileSize(1_572_864), '1,5 MB');
  const reference = new Date('2026-09-01T12:00:00.000Z');
  assert.equal(isTaskOverdue('A Fazer', '2026-08-31', reference), true);
  assert.equal(isTaskOverdue('Concluído', '2026-08-31', reference), false);
});
