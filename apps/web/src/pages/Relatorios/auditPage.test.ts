import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuditPage } from './auditPage';

const log = {
  id: 'audit-1', action: 'INSERT', entity: 'Cliente', userId: 'Administrador',
  oldData: null, newData: '{"nome":"Cliente"}', createdAt: '2026-10-01T12:00:00Z'
};

test('preserva os totais do serviço paginado, inclusive além da página exibida', () => {
  const response = {
    items: [log], page: 2, total: 101, totalPages: 3,
    summary: { inserts: 80, updates: 20, deletes: 1 }
  };
  assert.deepEqual(parseAuditPage(response, new URLSearchParams('page=2&limit=50')), response);
});

test('normaliza histórico legado aplicando filtros, paginação e totais', () => {
  const logs = [log, { ...log, id: 'audit-2' }, { ...log, id: 'audit-3', action: 'UPDATE' },
    { ...log, id: 'audit-4', entity: 'Projeto' }];
  assert.deepEqual(parseAuditPage(logs, new URLSearchParams('page=2&limit=1&entity=Cliente&action=INSERT')), {
    items: [logs[1]], page: 2, total: 2, totalPages: 2,
    summary: { inserts: 2, updates: 0, deletes: 0 }
  });
  assert.deepEqual(parseAuditPage([], new URLSearchParams()), {
    items: [], page: 1, total: 0, totalPages: 1,
    summary: { inserts: 0, updates: 0, deletes: 0 }
  });
});

test('rejeita resumo ausente ou nulo e registros inválidos antes da renderização', () => {
  for (const response of [
    { items: [log], page: 1, total: 1, totalPages: 1 },
    { items: [log], page: 1, total: 1, totalPages: 1, summary: null },
    [{ ...log, entity: { nome: 'Cliente' } }],
    null, 'resposta antiga inválida'
  ]) {
    assert.throws(() => parseAuditPage(response, new URLSearchParams()), /Resposta de auditoria inválida/);
  }
});
