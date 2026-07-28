import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.resolve(process.cwd(), 'scratch', `performance-metrics-${process.pid}`, 'geogestor.db');
process.env.GEOGESTOR_SLOW_REQUEST_MS = '200';

test('métricas agregam rotas normalizadas com classificação e limiar configurável', async () => {
  const { PerformanceMetricsService, normalizeRegisteredRoute } = await import('./services/performance-metrics.service');
  PerformanceMetricsService.resetForTests();
  assert.equal(normalizeRegisteredRoute('/api/clientes/:clienteId/historico/:historicoId'), '/api/clientes/:id/historico/:id');

  const observations = [10, 60, 220, 300];
  const slowEvents = observations.map((durationMs) => PerformanceMetricsService.record({
    route: '/api/clientes/:clienteId',
    method: 'GET',
    statusCode: 200,
    durationMs,
    responseBytes: 1_000
  })).filter(Boolean);
  assert.equal(slowEvents.length, 1, 'eventos lentos devem ser limitados por rota e intervalo');

  PerformanceMetricsService.record({
    route: '/api/clientes',
    method: 'POST',
    statusCode: 201,
    durationMs: 80,
    responseBytes: 500
  });

  const snapshot = PerformanceMetricsService.snapshot();
  assert.equal(snapshot.slowRequestThresholdMs, 200);
  assert.equal(snapshot.routes.length, 2);
  const clientDetail = snapshot.routes.find((route) => route.method === 'GET');
  assert.equal(clientDetail?.route, '/api/clientes/:id');
  assert.equal(clientDetail?.count, 4);
  assert.deepEqual(clientDetail?.classifications, { fast: 1, normal: 1, slow: 2 });
  assert.equal(clientDetail?.statusCodes['200'], 4);
  assert.equal(clientDetail?.responseBytes.max, 1_000);
  assert.equal(JSON.stringify(snapshot).includes('clienteId'), false);
});
