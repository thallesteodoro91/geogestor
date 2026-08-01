import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeReportPeriodPreset,
  reportPeriodGuidance,
  reportPeriodPresetRange
} from './reportPeriodPresets';

describe('reportPeriodPresetRange', () => {
  const leapDay = new Date(2024, 1, 29, 12);

  it('produz intervalos inclusivos e seguros em ano bissexto', () => {
    assert.deepEqual(reportPeriodPresetRange('last-30-days', leapDay), {
      startDate: '2024-01-31',
      endDate: '2024-02-29'
    });
    assert.deepEqual(reportPeriodPresetRange('current-month', leapDay), {
      startDate: '2024-02-01',
      endDate: '2024-02-29'
    });
  });

  it('reconhece trimestre, ano e histórico completo', () => {
    assert.deepEqual(reportPeriodPresetRange('current-quarter', new Date(2026, 6, 30)), {
      startDate: '2026-07-01',
      endDate: '2026-07-30'
    });
    assert.equal(reportPeriodPresetRange('current-year', leapDay).startDate, '2024-01-01');
    assert.deepEqual(reportPeriodPresetRange('all', leapDay), { startDate: '', endDate: '' });
    assert.equal(activeReportPeriodPreset('', '', leapDay), 'all');
  });

  it('explica filtros parciais sem prometer comparação inexistente', () => {
    assert.match(reportPeriodGuidance('2026-01-01', '') || '', /a partir/);
    assert.match(reportPeriodGuidance('', '2026-01-31') || '', /até/);
    assert.equal(reportPeriodGuidance('2026-01-01', '2026-01-31'), null);
  });
});
