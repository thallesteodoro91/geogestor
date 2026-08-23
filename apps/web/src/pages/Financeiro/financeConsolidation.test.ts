import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { APP_LEGACY_REDIRECTS } from '@geogestor/contracts';

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('Financeiro concentra os painéis canônicos sem editar orçamentos ou duplicar relatórios', () => {
  const source = read('./Financeiro.tsx');

  assert.match(source, /<Faturas[\s\S]*embedded[\s\S]*focusParcelaId=\{focusedReceivableId\}/);
  assert.match(source, /<Despesas[\s\S]*openCreateOnMount=\{embeddedAction\?\.type === 'despesa'\}/);
  assert.match(source, /<GestaoFinanceira[\s\S]*openCreateOnMount=\{embeddedAction\?\.type === 'viagem' \|\| embeddedAction\?\.type === 'fiscal'\}/);
  assert.doesNotMatch(source, /Receitas e contratos/);
  assert.doesNotMatch(source, /Relatórios Corporativos/);
  assert.doesNotMatch(source, /openCreateOrcamento|submitOrcamentoMutation/);
});

test('seletor por ícones e ações de lançamento permanecem explícitos', () => {
  const source = read('./Financeiro.tsx');

  assert.match(source, /\['visao', 'Visão geral', overviewTabIcon/);
  assert.match(source, /\['faturas', 'Contas a receber', receivablesTabIcon/);
  assert.match(source, /\['pagar', 'Contas a pagar', payablesTabIcon/);
  assert.match(source, /\['auxiliares', 'Viagens e notas fiscais', travelAndInvoicesTabIcon/);
  assert.match(source, /<img src=\{icon\} alt="" width=\{26\} height=\{26\}/);
  assert.match(source, /aria-selected=\{activeTab === id\}/);
  assert.match(source, /openEmbeddedAction\('viagem'\)/);
  assert.match(source, /openEmbeddedAction\('fiscal'\)/);
});

test('contas a receber preservam recebimento parcial, comprovante, histórico e estorno', () => {
  const source = read('../Faturas/Faturas.tsx');

  assert.match(source, /parcelas\/\$\{receivingFatura\.id\}\/recebimentos/);
  assert.match(source, /comprovanteDocumentoId/);
  assert.match(source, /Histórico de recebimentos/);
  assert.match(source, /recebimentos\/\$\{reversingReceipt\.id\}\/estorno/);
});

test('contas a pagar preservam viagem e operações financeiras formais', () => {
  const source = read('../Despesas/Despesas.tsx');

  assert.match(source, /name="viagemId"/);
  assert.match(source, /type: 'cancelamento' \| 'estorno'/);
  assert.match(source, /despesas\/\$\{financialAction\.item\.id\}\/\$\{financialAction\.type\}/);
});

test('rotas antigas apontam para os módulos consolidados', () => {
  const redirects = new Map(APP_LEGACY_REDIRECTS.map((redirect) => [redirect.from, redirect.to]));

  assert.equal(redirects.get('/faturas'), '/financeiro?tab=faturas');
  assert.equal(redirects.get('/despesas'), '/financeiro?tab=pagar');
  assert.equal(redirects.get('/gestao-financeira'), '/financeiro?tab=auxiliares');
  assert.equal(redirects.get('/dashboard-financeiro'), '/financeiro');
  assert.equal(redirects.get('/operacional'), '/projetos?visualizacao=estatisticas');
  assert.equal(redirects.get('/relatorio-executivo'), '/relatorios?tipo=executivo');
});
