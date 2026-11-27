import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientDeadline, clientOpenBalance, formatClientDate } from './clientWorkspace';

test('saldo em aberto inclui vencidos mesmo quando não há valor a vencer', () => {
  assert.deepEqual(clientOpenBalance({ valorPendente: 0, valorVencido: 300000 }), { due: 0, overdue: 300000, total: 300000 });
  assert.deepEqual(clientOpenBalance({ valorPendente: 100000, valorVencido: 200000 }), { due: 100000, overdue: 200000, total: 300000 });
});
test('datas documentais preservam o dia e instantes respeitam São Paulo', () => {
  assert.equal(formatClientDate('2026-09-01'), '01/09/2026');
  assert.equal(formatClientDate('2026-09-02T01:00:00Z'), '01/09/2026');
  assert.equal(formatClientDate('2026-09-02 01:00:00'), '01/09/2026');
  assert.equal(clientDeadline('2026-09-01', true), 'Prazo registrado: 01/09/2026');
});
