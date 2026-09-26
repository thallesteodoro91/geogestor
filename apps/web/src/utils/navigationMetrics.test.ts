import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPendingNavigationPath,
  markNavigationContentMounted,
  markNavigationFailed,
  markNavigationIntent,
  markNavigationRenderStarted,
  markNavigationUrlChanged,
  markNavigationUsable,
  subscribeNavigationState,
  type NavigationMetric
} from './navigationMetrics';

function installSessionStorage() {
  const values = new Map<string, string>();
  const storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); }
  } satisfies Storage;
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true });
  return values;
}

test('a navegação só fica utilizável depois que o conteúdo da rota correta monta', () => {
  const storage = installSessionStorage();
  const states: Array<string | null> = [];
  const unsubscribe = subscribeNavigationState(() => states.push(getPendingNavigationPath()));

  assert.equal(markNavigationIntent('/projetos'), true);
  assert.equal(getPendingNavigationPath(), '/projetos');
  assert.equal(markNavigationUrlChanged('/projetos'), true);
  assert.equal(markNavigationRenderStarted('/projetos'), true);
  assert.equal(markNavigationUsable('/projetos'), false, 'não deve aceitar o conteúdo da rota anterior');
  assert.equal(getPendingNavigationPath(), '/projetos');

  assert.equal(markNavigationContentMounted('/clientes'), false, 'uma rota diferente não conclui a medição');
  assert.equal(markNavigationContentMounted('/projetos'), true);
  assert.equal(markNavigationUsable('/projetos'), true);
  assert.equal(getPendingNavigationPath(), null);
  unsubscribe();

  const metrics = JSON.parse(storage.get('geogestor:navigation-metrics') || '[]') as NavigationMetric[];
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].pathname, '/projetos');
  assert.equal(metrics[0].status, 'usable');
  assert.equal(typeof metrics[0].contentMountedMs, 'number');
  assert.equal(typeof metrics[0].usableMs, 'number');
  assert.deepEqual(states, ['/projetos', null]);
});

test('falhas encerram o feedback pendente e preservam o motivo', () => {
  const storage = installSessionStorage();
  markNavigationIntent('/topografia');
  assert.equal(markNavigationFailed('/topografia', 'chunk-load-error'), true);
  assert.equal(getPendingNavigationPath(), null);

  const metrics = JSON.parse(storage.get('geogestor:navigation-metrics') || '[]') as NavigationMetric[];
  assert.equal(metrics[0].status, 'failed');
  assert.equal(metrics[0].failureReason, 'chunk-load-error');
  assert.equal(metrics[0].usableMs, null);
});
