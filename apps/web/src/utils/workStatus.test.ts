import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkStatusPresentation } from './workStatus';

test('diferencia visualmente as situações operacionais do trabalho', () => {
  const statuses = [
    'Planejamento',
    'Em Análise',
    'Em Andamento',
    'Aguardando Cliente',
    'Aguardando Documentação',
    'Aguardando Órgão',
    'Com Pendência',
    'Suspenso',
    'Finalizado',
    'Cancelado'
  ];
  const badgeClasses = statuses.map((status) => getWorkStatusPresentation(status).badgeClass);

  assert.equal(new Set(badgeClasses).size, statuses.length);
  assert.equal(getWorkStatusPresentation('Finalizado').label, 'Concluído');
  assert.equal(getWorkStatusPresentation('Finalizado').progress, 100);
  assert.equal(getWorkStatusPresentation('Cancelado').progress, 0);
});

test('preserva situações legadas desconhecidas com apresentação neutra', () => {
  const presentation = getWorkStatusPresentation('Status legado');
  assert.equal(presentation.label, 'Status legado');
  assert.match(presentation.badgeClass, /zinc/);
});
