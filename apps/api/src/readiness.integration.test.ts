import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `readiness-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'readiness-test-token';

test('readiness comprova acesso leve ao banco sem executar o diagnóstico completo', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { dbReady, closeDb }, { runRuntimeMigrations }, { SystemHealthService }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('./services/system-health.service')
  ]);
  await dbReady;
  await runRuntimeMigrations();

  const originalInspect = SystemHealthService.inspect;
  SystemHealthService.inspect = async () => {
    throw new Error('O diagnóstico pesado não deve participar do readiness.');
  };

  try {
    const response = await server.inject({
      method: 'GET',
      url: '/api/ready',
      headers: { 'x-api-token': 'readiness-test-token' }
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ready' });
  } finally {
    SystemHealthService.inspect = originalInspect;
    await server.close();
    await closeDb();
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
