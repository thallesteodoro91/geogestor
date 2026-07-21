import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

process.env.GEOGESTOR_DB_PATH = path.resolve(process.cwd(), 'scratch', 'api-tests', 'local-api-security.test.db');
process.env.GEOGESTOR_API_TOKEN = 'token-sintetico';
process.env.PORT = '3001';

test('token em query é limitado aos downloads compatíveis e CORS recusa outra porta', async () => {
  const { server } = await import('./server');
  try {
    const queryOnBusinessRoute = await server.inject({
      method: 'GET',
      url: '/api/clientes?token=token-sintetico'
    });
    assert.equal(queryOnBusinessRoute.statusCode, 401);

    const authenticated = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-api-token': 'token-sintetico' }
    });
    assert.equal(authenticated.statusCode, 200);

    const compatibleDownload = await server.inject({
      method: 'GET',
      url: '/api/arquivos/download?token=token-sintetico'
    });
    assert.notEqual(compatibleDownload.statusCode, 401);

    const refusedOrigin = await server.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'http://localhost:7777',
        'access-control-request-method': 'GET'
      }
    });
    assert.equal(refusedOrigin.headers['access-control-allow-origin'], undefined);
  } finally {
    await server.close();
  }
});
