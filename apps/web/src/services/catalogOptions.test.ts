import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCatalogAndHistoricalValues } from './catalogOptions';

test('preserva o valor histórico quando um cadastro auxiliar é editado ou removido', () => {
  assert.deepEqual(
    mergeCatalogAndHistoricalValues(['Levantamento cadastral atualizado'], ['Levantamento cadastral antigo']),
    ['Levantamento cadastral antigo', 'Levantamento cadastral atualizado']
  );
});

test('não cria opções indistinguíveis por caixa, acento ou espaços', () => {
  assert.deepEqual(
    mergeCatalogAndHistoricalValues(['  Medição de área  '], ['medicao de area', 'Medição de área']),
    ['Medição de área']
  );
});
