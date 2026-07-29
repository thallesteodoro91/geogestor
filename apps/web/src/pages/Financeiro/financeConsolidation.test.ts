import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('Financeiro concentra os painéis canônicos sem editar orçamentos ou duplicar relatórios', () => {
  const source = read('./Financeiro.tsx');

  assert.match(source, /<Faturas embedded \/>/);
  assert.match(source, /<Despesas embedded \/>/);
  assert.match(source, /<GestaoFinanceira embedded \/>/);
  assert.doesNotMatch(source, /Receitas e contratos/);
  assert.doesNotMatch(source, /Relatórios Corporativos/);
  assert.doesNotMatch(source, /openCreateOrcamento|submitOrcamentoMutation/);
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
  const source = read('../../App.tsx');

  assert.match(source, /path="\/faturas".*to="\/financeiro\?tab=faturas"/);
  assert.match(source, /path="\/despesas".*to="\/financeiro\?tab=pagar"/);
  assert.match(source, /path="\/gestao-financeira".*to="\/financeiro\?tab=auxiliares"/);
  assert.match(source, /path="\/dashboard-financeiro".*to="\/financeiro"/);
  assert.match(source, /path="\/operacional".*to="\/projetos\?visualizacao=estatisticas"/);
  assert.match(source, /path="\/relatorio-executivo".*to="\/relatorios\?tipo=executivo"/);
});
