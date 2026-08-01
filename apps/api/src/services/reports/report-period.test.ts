import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ReportPeriodValidationError,
  isInPeriod,
  parseReportPeriod
} from './report-period';

test('período é inclusivo, compara a mesma quantidade de dias e atravessa ano bissexto', () => {
  assert.deepEqual(parseReportPeriod({ inicio: '2024-02-28', fim: '2024-03-01' }), {
    startDate: '2024-02-28',
    endDate: '2024-03-01',
    previousStartDate: '2024-02-25',
    previousEndDate: '2024-02-27'
  });
  assert.equal(isInPeriod('2024-02-28T23:59:59Z', { startDate: '2024-02-28', endDate: '2024-03-01' }), true);
  assert.equal(isInPeriod('2024-03-01', { startDate: '2024-02-28', endDate: '2024-03-01' }), true);
});

test('aceita intervalo de um dia e filtros parciais', () => {
  assert.deepEqual(parseReportPeriod({ inicio: '2026-01-01', fim: '2026-01-01' }), {
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    previousStartDate: '2025-12-31',
    previousEndDate: '2025-12-31'
  });
  assert.equal(parseReportPeriod({ inicio: '2026-01-01' }).previousStartDate, null);
  assert.equal(parseReportPeriod({ fim: '2026-12-31' }).previousEndDate, null);
});

test('rejeita datas inexistentes, formato ambíguo e ordem invertida', () => {
  assert.throws(() => parseReportPeriod({ inicio: '2025-02-29' }), ReportPeriodValidationError);
  assert.throws(() => parseReportPeriod({ inicio: '01/02/2026' }), ReportPeriodValidationError);
  assert.throws(
    () => parseReportPeriod({ inicio: '2026-02-01', fim: '2026-01-31' }),
    ReportPeriodValidationError
  );
});
