import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManagerialReport } from '@geogestor/contracts';
import {
  comparisonText,
  formatCurrency,
  percentageDelta,
  reportFileName
} from './reportPresentation';

test('formata centavos em reais e calcula variação sem inventar base', () => {
  assert.match(formatCurrency(123_456), /1\.234,56/);
  assert.equal(percentageDelta(100, 0), null);
  assert.equal(percentageDelta(150, 100), 50);
  assert.equal(comparisonText(100, null), 'Sem base comparável');
});

test('nome do PDF inclui tipo e recorte aplicado', () => {
  const report = {
    period: { startDate: '2026-01-01', endDate: '2026-01-31' }
  } as ManagerialReport;
  assert.equal(reportFileName('financeiro', report), 'geogestor-financeiro-2026-01-01-2026-01-31.pdf');
});
