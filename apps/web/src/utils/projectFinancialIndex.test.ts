import assert from 'node:assert/strict';
import test from 'node:test';
import { sumProjectAmounts } from './projectFinancialIndex';

test('indexa valores por projeto em uma única passagem e respeita exclusões', () => {
  const rows = [
    { projectId: 'a', amount: 100, active: true },
    { projectId: 'a', amount: 250, active: true },
    { projectId: 'a', amount: 999, active: false },
    { projectId: 'b', amount: 75, active: true },
    { projectId: null, amount: 500, active: true }
  ];

  const totals = sumProjectAmounts(rows, {
    getProjectId: (row) => row.projectId,
    getAmount: (row) => row.amount,
    include: (row) => row.active
  });

  assert.deepEqual(Array.from(totals.entries()), [['a', 350], ['b', 75]]);
});
