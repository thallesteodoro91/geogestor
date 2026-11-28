import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { budgetFilterParams, budgetRange } from './budgetListState';

describe('budget list presentation state', () => {
  it('keeps only actual filters without pagination, sorting, selection or navigation metadata', () => {
    const params = new URLSearchParams('query=ficção&status=rascunho&page=2&sort=cliente&budgetId=123&highlightId=456&returnTo=financeiro&issueFrom=2026-10-01');
    assert.deepEqual([...budgetFilterParams(params)], [['query', 'ficção'], ['issueFrom', '2026-10-01'], ['status', 'rascunho']]);
    assert.equal(params.get('page'), '2');
  });
  it('reports the visible range independently of a separately highlighted record', () => {
    assert.equal(budgetRange(2, 25, 51), '26–50 de 51 orçamentos');
    assert.equal(budgetRange(3, 1, 51), '51–51 de 51 orçamentos');
    assert.equal(budgetRange(1, 1, 1), '1–1 de 1 orçamento');
    assert.equal(budgetRange(3, 0, 50), '0 de 50 orçamentos');
    assert.equal(budgetRange(1, 0, 0), '0 de 0 orçamentos');
  });
});
