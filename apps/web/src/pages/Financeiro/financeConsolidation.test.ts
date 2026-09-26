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

test('abas financeiras oferecem roving tabindex, setas e relação com os painéis', () => {
  const source = read('./Financeiro.tsx');

  assert.match(source, /onKeyDown=\{\(event\) => handleFinanceTabKeyDown\(event, id\)\}/);
  assert.match(source, /tabIndex=\{activeTab === id \? 0 : -1\}/);
  assert.match(source, /aria-controls=\{`finance-panel-\$\{id\}`\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-labelledby=\{`finance-tab-\$\{activeTab\}`\}/);
});

test('gráfico de fluxo de caixa expõe comparação, resultado e alternativa acessível', () => {
  const source = read('./Financeiro.tsx');

  assert.match(source, /<ComposedChart accessibilityLayer=\{false\} data=\{monthlyData\}/);
  assert.match(source, /dataKey="Recebido"[\s\S]*dataKey="Despesas"[\s\S]*dataKey="Resultado mensal"/);
  assert.match(source, /tickFormatter=\{formatCompactCurrencyAxisValue\}/);
  assert.match(source, /domain=\{cashFlowAxisScale\.domain\}[\s\S]*ticks=\{cashFlowAxisScale\.ticks\}/);
  assert.match(source, /Valores em <span translate="no">R\$<\/span>/);
  assert.match(source, /<table className="sr-only">[\s\S]*<caption>[\s\S]*<thead>[\s\S]*<tbody>/);
  assert.match(source, /<th scope="col">Mês<\/th>[\s\S]*<th scope="col">Recebido<\/th>[\s\S]*<th scope="col">Despesas<\/th>[\s\S]*<th scope="col">Resultado mensal<\/th>/);
  assert.doesNotMatch(source, /showDifference/);
});

test('contas a receber preservam recebimento parcial, comprovante, histórico e estorno', () => {
  const source = read('../Faturas/Faturas.tsx');

  assert.match(source, /parcelas\/\$\{receivingFatura\.id\}\/recebimentos/);
  assert.match(source, /comprovanteDocumentoId/);
  assert.match(source, /Histórico de recebimentos/);
  assert.match(source, /recebimentos\/\$\{reversingReceipt\.id\}\/estorno/);
  assert.match(source, /openCreateOnMount/);
  assert.match(source, /Contexto predefinido:/);
  assert.match(source, /initialProjectId/);
  assert.match(source, /mesmo orçamento quando valor e vencimento forem idênticos/);
  assert.match(source, /isError: failed/);
  assert.match(source, /role="alert"[\s\S]*Não foi possível carregar as contas a receber/);
});

test('atalho do projeto abre a configuração de parcelas com projeto e cliente', () => {
  const project = read('../Projetos/ProjetoDetalhes.tsx');
  const finance = read('./Financeiro.tsx');
  assert.match(project, /appLinks\.finance\(\{ tab: 'faturas', acao: 'parcela', projeto: projeto\.id, cliente: projeto\.clienteId \}\)/);
  assert.match(finance, /openCreateOnMount=\{embeddedAction\?\.type === 'parcela'\}/);
  assert.match(finance, /initialClientId=\{initialFinanceClientId\}/);
});

test('contas a pagar preservam viagem e operações financeiras formais', () => {
  const source = read('../Despesas/Despesas.tsx');

  assert.match(source, /name="viagemId"/);
  assert.match(source, /type: 'cancelamento' \| 'estorno'/);
  assert.match(source, /despesas\/\$\{financialAction\.item\.id\}\/\$\{financialAction\.type\}/);
  assert.match(source, /new URLSearchParams\(\{ clienteId: effectiveExpenseClientId \}\)/);
  assert.match(source, /enabled: showModal && Boolean\(effectiveExpenseClientId\)/);
  assert.match(source, /isError: despesasFailed/);
  assert.match(source, /role="alert"[\s\S]*Não foi possível carregar as contas a pagar/);
});

test('subáreas auxiliares oferecem navegação completa por teclado', () => {
  const source = read('./GestaoFinanceira.tsx');

  assert.match(source, /onKeyDown=\{\(event\) => handleAuxiliaryTabKeyDown\(event, id\)\}/);
  assert.match(source, /tabIndex=\{activeTab === id \? 0 : -1\}/);
  assert.match(source, /aria-controls=\{`auxiliary-panel-\$\{id\}`\}/);
  assert.match(source, /id="auxiliary-panel-viagens" role="tabpanel"/);
  assert.match(source, /id="auxiliary-panel-fiscal" role="tabpanel"/);
  assert.match(source, /id="auxiliary-panel-diagnostico" role="tabpanel"/);
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
