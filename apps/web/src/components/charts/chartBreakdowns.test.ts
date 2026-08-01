import assert from 'node:assert/strict';
import test from 'node:test';
import { getExpenseCategoryChartMode, prepareExpenseCategoryData } from './chartBreakdowns';

test('seleciona barras para até três categorias e treemap a partir de quatro', () => {
  assert.equal(getExpenseCategoryChartMode(0), 'empty');
  assert.equal(getExpenseCategoryChartMode(1), 'bars');
  assert.equal(getExpenseCategoryChartMode(3), 'bars');
  assert.equal(getExpenseCategoryChartMode(4), 'treemap');
});

test('normaliza, ordena e calcula percentuais das categorias', () => {
  const data = prepareExpenseCategoryData([
    { name: 'Taxas', value: 2_500, count: 1 },
    { name: 'Combustível', value: 7_500, count: 3 },
    { name: 'Ignorada', value: 0, count: 2 }
  ]);

  assert.deepEqual(data.map((item) => item.name), ['Combustível', 'Taxas']);
  assert.equal(data[0].percentage, 75);
  assert.equal(data[1].percentage, 25);
  assert.equal(data[0].count, 3);
});
