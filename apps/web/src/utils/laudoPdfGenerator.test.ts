import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLaudoDate, sanitizeLaudoFileName } from './laudoPdfGenerator';

test('sanitizes forbidden Windows filename characters and trailing dots', () => {
  assert.equal(sanitizeLaudoFileName('QA: Área <Norte> / CAR? *  '), 'QA_Área_Norte_CAR');
  assert.equal(sanitizeLaudoFileName('...'), 'projeto');
});

test('formats date-only values without a UTC conversion', () => {
  assert.equal(formatLaudoDate('2026-09-11'), '11/09/2026');
  assert.equal(formatLaudoDate('legado'), 'legado');
});
