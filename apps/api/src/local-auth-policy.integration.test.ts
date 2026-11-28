import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `local-auth-policy-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const apiToken = `auth-policy-api-${process.pid}`;

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = apiToken;
process.env.GEOGESTOR_SECRET_KEY = Buffer.alloc(32, 13).toString('base64');
process.env.GEOGESTOR_BACKUP_RECOVERY_KEY = Buffer.alloc(32, 14).toString('base64');
delete process.env.GEOGESTOR_REQUIRE_UNLOCK;
delete process.env.GEOGESTOR_AUTH_DISABLED;

test('senha de abertura é opcional e pode ser ativada, redefinida e removida', async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { dbReady, closeDb }, { runRuntimeMigrations }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service')
  ]);
  const baseHeaders = { 'x-api-token': apiToken };
  const jsonHeaders = { ...baseHeaders, 'content-type': 'application/json' };
  try {
    await dbReady;
    await runRuntimeMigrations();
    const setup = await injectWithRecordVersion(server, {
      method: 'POST',
      url: '/api/configuracoes',
      headers: jsonHeaders,
      payload: {
        empresaNome: 'Empresa sem bloqueio',
        dadosPasta: testRoot
      }
    });
    assert.equal(setup.statusCode, 200, setup.body);

    const initialStatus = await injectWithRecordVersion(server, { method: 'GET', url: '/api/auth/status', headers: baseHeaders });
    assert.equal(initialStatus.statusCode, 200, initialStatus.body);
    assert.equal(initialStatus.json().authRequired, false);
    assert.equal(initialStatus.json().locked, false);
    const openAccess = await injectWithRecordVersion(server, { method: 'GET', url: '/api/clientes', headers: baseHeaders });
    assert.equal(openAccess.statusCode, 200, openAccess.body);

    const enabled = await injectWithRecordVersion(server, {
      method: 'PUT',
      url: '/api/auth/policy',
      headers: jsonHeaders,
      payload: { enabled: true, newPassword: 'senha-nova-456' }
    });
    assert.equal(enabled.statusCode, 200, enabled.body);
    assert.equal(enabled.json().enabled, true);
    const sessionToken = enabled.json<{ session: { token: string } }>().session.token;

    const lockedAccess = await injectWithRecordVersion(server, { method: 'GET', url: '/api/clientes', headers: baseHeaders });
    assert.equal(lockedAccess.statusCode, 423, lockedAccess.body);
    const protectedAccess = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/clientes',
      headers: { ...baseHeaders, 'x-local-session': sessionToken }
    });
    assert.equal(protectedAccess.statusCode, 200, protectedAccess.body);

    const wrongDisable = await injectWithRecordVersion(server, {
      method: 'PUT',
      url: '/api/auth/policy',
      headers: { ...jsonHeaders, 'x-local-session': sessionToken },
      payload: { enabled: false, currentPassword: 'senha-incorreta' }
    });
    assert.equal(wrongDisable.statusCode, 401, wrongDisable.body);

    const disabled = await injectWithRecordVersion(server, {
      method: 'PUT',
      url: '/api/auth/policy',
      headers: { ...jsonHeaders, 'x-local-session': sessionToken },
      payload: { enabled: false, currentPassword: 'senha-nova-456' }
    });
    assert.equal(disabled.statusCode, 200, disabled.body);
    assert.equal(disabled.json().enabled, false);
    assert.equal(disabled.json().session, null);

    const reopenedAccess = await injectWithRecordVersion(server, { method: 'GET', url: '/api/clientes', headers: baseHeaders });
    assert.equal(reopenedAccess.statusCode, 200, reopenedAccess.body);
  } finally {
    await server.close();
    await closeDb();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
