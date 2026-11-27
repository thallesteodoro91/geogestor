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

test('retorna ao Financeiro com a aba, período e critérios da lista preservados', () => {
  const returnTo = '/financeiro?tab=faturas&periodo=custom&inicio=2026-10-01&fim=2026-10-31&cliente=cliente_1&receberBusca=Campo&receberInicio=2026-10-01&receberFim=2026-10-31&receberSituacao=pendentes&receberPagina=3';
  assert.equal(getSafeBudgetReturnTo(returnTo), returnTo);
  const editor = new URL(buildBudgetEditorPath({ returnTo, clientId: 'cliente_1' }), 'https://geogestor.local');
  assert.equal(editor.pathname, '/orcamentos/novo');
  assert.equal(editor.searchParams.get('retorno'), returnTo);
  assert.equal(withBudgetHighlight(returnTo, 'budget_1'), returnTo);
});

test('remove comandos de criação e retornos encadeados do destino Financeiro', () => {
  assert.equal(getSafeBudgetReturnTo('/financeiro?tab=pagar&acao=despesa&retorno=%2Forcamentos%2Fnovo&highlightId=abc&arbitrario=1'), '/financeiro?tab=pagar');
});

test('preserva os critérios de Contas a pagar ao criar e concluir orçamento', () => {
  const returnTo = '/financeiro?tab=pagar&pagarBusca=Campo&pagarCategoria=Transporte&pagarSubcategoria=Combustivel&pagarSituacao=Pendente&pagarTipo=Variavel&pagarCentro=Campo&pagarReembolso=sim&pagarInicio=2026-10-01&pagarFim=2026-10-31&pagarPagina=2';
  assert.equal(getSafeBudgetReturnTo(returnTo), returnTo);
  const editor = new URL(buildBudgetEditorPath({ returnTo }), 'https://geogestor.local');
  assert.equal(editor.searchParams.get('retorno'), returnTo);
  assert.equal(withBudgetHighlight(returnTo, 'budget_1'), returnTo);
});

test('recusa protocolos, URLs absolutas, caminhos arbitrários e travessia de diretórios', () => {
  for (const input of [
    'javascript:alert(1)', 'data:text/html,test', 'https://example.com/financeiro',
    '//example.com/financeiro', 'https://geogestor.local/financeiro', '/configuracoes',
    '/orcamentos/novo', '/financeiro/../configuracoes', '/configuracoes/../financeiro',
    '/%66inanceiro', '/financeiro\\evil', '/financeiro\n?tab=faturas'
  ]) assert.equal(getSafeBudgetReturnTo(input), '/orcamentos', input);
});
