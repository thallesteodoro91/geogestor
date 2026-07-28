import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `local-auth-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const apiToken = `auth-api-${process.pid}`;

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = apiToken;
process.env.GEOGESTOR_REQUIRE_UNLOCK = '1';
process.env.GEOGESTOR_SECRET_KEY = Buffer.alloc(32, 9).toString('base64');

test('rotas operacionais exigem desbloqueio, expiração e bloqueio manual', async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { dbReady, closeDb }, { runRuntimeMigrations }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service')
  ]);
  const baseHeaders = { 'x-api-token': apiToken };
  try {
    await dbReady;
    await runRuntimeMigrations();

    const setup = await server.inject({
      method: 'POST',
      url: '/api/configuracoes',
      headers: { ...baseHeaders, 'content-type': 'application/json' },
      payload: {
        empresaNome: 'Empresa de teste',
        dadosPasta: testRoot,
        adminNome: 'Pessoa Administradora',
        adminEmail: 'admin@example.test',
        adminSenha: 'senha-segura-123'
      }
    });
    assert.equal(setup.statusCode, 200, setup.body);
    assert.equal('adminSenhaHash' in setup.json(), false);

    const locked = await server.inject({ method: 'GET', url: '/api/clientes', headers: baseHeaders });
    assert.equal(locked.statusCode, 423, locked.body);

    const wrongPassword = await server.inject({
      method: 'POST',
      url: '/api/auth/unlock',
      headers: { ...baseHeaders, 'content-type': 'application/json' },
      payload: { password: 'senha-incorreta' }
    });
    assert.equal(wrongPassword.statusCode, 401, wrongPassword.body);
    assert.equal(wrongPassword.json().code, 'invalid_password');

    const unlocked = await server.inject({
      method: 'POST',
      url: '/api/auth/unlock',
      headers: { ...baseHeaders, 'content-type': 'application/json' },
      payload: { password: 'senha-segura-123' }
    });
    assert.equal(unlocked.statusCode, 200, unlocked.body);
    const sessionToken = unlocked.json<{ token: string }>().token;
    assert.ok(sessionToken.length >= 32);

    const operational = await server.inject({
      method: 'GET',
      url: '/api/clientes',
      headers: { ...baseHeaders, 'x-local-session': sessionToken }
    });
    assert.equal(operational.statusCode, 200, operational.body);
    assert.deepEqual(operational.json(), []);

    const manualLock = await server.inject({
      method: 'POST',
      url: '/api/auth/lock',
      headers: { ...baseHeaders, 'x-local-session': sessionToken }
    });
    assert.equal(manualLock.statusCode, 200, manualLock.body);
    const afterLock = await server.inject({
      method: 'GET',
      url: '/api/clientes',
      headers: { ...baseHeaders, 'x-local-session': sessionToken }
    });
    assert.equal(afterLock.statusCode, 423, afterLock.body);

    process.env.GEOGESTOR_SESSION_IDLE_MS = '5';
    const shortSession = await server.inject({
      method: 'POST',
      url: '/api/auth/unlock',
      headers: { ...baseHeaders, 'content-type': 'application/json' },
      payload: { password: 'senha-segura-123' }
    });
    const expiringToken = shortSession.json<{ token: string }>().token;
    await new Promise((resolve) => setTimeout(resolve, 15));
    const expired = await server.inject({
      method: 'GET',
      url: '/api/clientes',
      headers: { ...baseHeaders, 'x-local-session': expiringToken }
    });
    assert.equal(expired.statusCode, 423, expired.body);
  } finally {
    delete process.env.GEOGESTOR_SESSION_IDLE_MS;
    await server.close();
    await closeDb();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
