import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBudgetEditorPath,
  getBudgetListPath,
  getSafeBudgetReturnTo,
  isSafeEntityId,
  withBudgetHighlight
} from './budgetNavigation';

test('preserva filtros, paginação e ordenação no retorno ao editor', () => {
  const returnTo = getBudgetListPath('query=Geo&page=3&sort=valor_desc&status=rascunho&budgetId=abc');
  assert.equal(returnTo, '/orcamentos?query=Geo&page=3&sort=valor_desc&status=rascunho');
  assert.equal(
    buildBudgetEditorPath({ budgetId: 'budget_123', returnTo }),
    '/orcamentos/budget_123/editar?retorno=%2Forcamentos%3Fquery%3DGeo%26page%3D3%26sort%3Dvalor_desc%26status%3Drascunho'
  );
});

test('mantém cliente e oportunidade na URL de criação', () => {
  assert.equal(
    buildBudgetEditorPath({ clientId: 'cliente_1', opportunityId: 'opp_1' }),
    '/orcamentos/novo?clienteId=cliente_1&oportunidadeId=opp_1&retorno=%2Forcamentos'
  );
});

test('recusa ids e destinos externos', () => {
  assert.equal(isSafeEntityId('../segredo'), false);
  assert.equal(getSafeBudgetReturnTo('https://example.com/orcamentos?query=x'), '/orcamentos');
  assert.equal(buildBudgetEditorPath({ clientId: '../segredo' }), '/orcamentos/novo?retorno=%2Forcamentos');
});

test('adiciona destaque sem contaminar os parâmetros persistentes', () => {
  assert.equal(
    withBudgetHighlight('/orcamentos?query=Geo&page=2', 'budget_1'),
    '/orcamentos?query=Geo&page=2&highlightId=budget_1'
  );
  assert.equal(
    getBudgetListPath('query=Geo&page=2&highlightId=budget_1'),
    '/orcamentos?query=Geo&page=2'
  );
});
