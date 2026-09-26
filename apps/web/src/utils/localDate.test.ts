import assert from 'node:assert/strict';
import test from 'node:test';
import { saoPauloDateKey } from './localDate';

test('calcula a data civil de São Paulo sem depender do fuso do processo', () => {
  assert.equal(saoPauloDateKey(new Date('2026-09-15T02:30:00.000Z')), '2026-09-14');
  assert.equal(saoPauloDateKey(new Date('2026-09-15T03:30:00.000Z')), '2026-09-15');
});
