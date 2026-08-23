import assert from 'node:assert/strict';
import test from 'node:test';
import { commitVertexHistory, redoVertexHistory, undoVertexHistory, type VertexHistoryState } from './useVertexHistory';

test('desfaz e refaz adição, edição e substituição de vértices', () => {
  let history: VertexHistoryState<number[]> = { past: [], present: [1, 2, 3], future: [] };
  history = commitVertexHistory(history, (vertices) => [...vertices, 4], 40);
  history = commitVertexHistory(history, (vertices) => vertices.map((value) => value === 2 ? 20 : value), 40);
  assert.deepEqual(history.present, [1, 20, 3, 4]);
  history = undoVertexHistory(history, 40);
  assert.deepEqual(history.present, [1, 2, 3, 4]);
  history = undoVertexHistory(history, 40);
  assert.deepEqual(history.present, [1, 2, 3]);
  history = redoVertexHistory(history, 40);
  assert.deepEqual(history.present, [1, 2, 3, 4]);
});

test('limita estados anteriores e limpa refazer após nova alteração', () => {
  let history: VertexHistoryState<number> = { past: [], present: 0, future: [] };
  for (let value = 1; value <= 6; value += 1) history = commitVertexHistory(history, value, 3);
  assert.equal(history.past.length, 3);
  history = undoVertexHistory(history, 3);
  assert.equal(history.future.length, 1);
  history = commitVertexHistory(history, 99, 3);
  assert.equal(history.future.length, 0);
});
