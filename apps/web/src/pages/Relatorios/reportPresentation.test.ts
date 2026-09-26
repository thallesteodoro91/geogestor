import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManagerialReport } from '@geogestor/contracts';
import {
  comparisonText,
  canonicalReportSearch,
  formatCurrency,
  formatGeneratedAt,
  percentageDelta,
  reportFileName
} from './reportPresentation';

test('formata centavos em reais e calcula variação sem inventar base', () => {
  assert.match(formatCurrency(123_456), /1\.234,56/);
  assert.equal(percentageDelta(100, 0), null);
  assert.equal(percentageDelta(150, 100), 50);
  assert.equal(comparisonText(100, null), 'Sem base comparável');
});

test('normaliza tipo, duplicatas e parâmetros transitórios sem perder o recorte', () => {
  assert.equal(canonicalReportSearch('tipo=FINANCEIRO&tipo=projetos&inicio=2026-09-01&inicio=2026-09-02&periodo=x'), 'inicio=2026-09-01');
  assert.equal(canonicalReportSearch('tipo=executivo&fim=2026-09-30&periodo=personalizado'), 'tipo=executivo&fim=2026-09-30&periodo=personalizado');
  assert.equal(canonicalReportSearch('tipo=financeiro'), '');
});

test('data de emissão usa o dia civil de São Paulo', () => {
  assert.equal(formatGeneratedAt('2026-01-01T01:30:00.000Z'), '31/12/2025');
});

test('nome do PDF inclui tipo e recorte aplicado', () => {
  const report = {
    period: { startDate: '2026-01-01', endDate: '2026-01-31' }
  } as ManagerialReport;
  assert.equal(reportFileName('financeiro', report), 'geogestor-financeiro-2026-01-01-2026-01-31.pdf');
});
