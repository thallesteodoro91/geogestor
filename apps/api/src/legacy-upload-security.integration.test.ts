import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `legacy-upload-security-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const apiToken = `legacy-upload-${process.pid}`;

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = apiToken;

test('upload Base64 legado aplica schema, limites, MIME, nome seguro e aviso de depreciaÃ§Ã£o', async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const headers = { 'x-api-token': apiToken, 'content-type': 'application/json' };

  try {
    await dbReady;
    await runRuntimeMigrations();
    const setup = await server.inject({
      method: 'POST',
      url: '/api/configuracoes',
      headers,
      payload: {
        empresaNome: 'Empresa upload sintÃ©tico',
        dadosPasta: testRoot,
        adminNome: 'Pessoa Administradora',
        adminEmail: 'upload@example.test',
        adminSenha: 'senha-segura-123'
      }
    });
    assert.equal(setup.statusCode, 200, setup.body);
    await db.insert(schema.clientes).values({ id: 'cliente-upload', nome: 'Cliente Upload' });

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const accepted = await server.inject({
      method: 'POST',
      url: '/api/arquivos/upload',
      headers,
      payload: {
        clienteId: 'cliente-upload',
        fileName: 'mapa.png',
        fileContent: `data:image/png;base64,${png.toString('base64')}`,
        mimeType: 'image/png',
        category: 'Mapas'
      }
    });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.equal(accepted.headers.deprecation, 'true');
    assert.match(String(accepted.headers.warning), /upload\/stream/);

    const invalidCases = [
      { fileName: '../escape.png', fileContent: png.toString('base64'), mimeType: 'image/png' },
      { fileName: 'CON.pdf', fileContent: png.toString('base64'), mimeType: 'application/pdf' },
      { fileName: 'mapa.png', fileContent: '%%%=', mimeType: 'image/png' },
      { fileName: 'mapa.png', fileContent: png.toString('base64'), mimeType: 'application/pdf' },
      { fileName: 'falso.pdf', fileContent: png.toString('base64'), mimeType: 'application/pdf' }
    ];
    for (const invalid of invalidCases) {
      const response = await server.inject({
        method: 'POST',
        url: '/api/arquivos/upload',
        headers,
        payload: { clienteId: 'cliente-upload', category: 'Mapas', ...invalid }
      });
      assert.equal(response.statusCode, 400, `${invalid.fileName}: ${response.body}`);
      assert.equal(response.headers.deprecation, 'true');
    }

    await assert.rejects(fs.stat(path.resolve(testRoot, 'escape.png')), { code: 'ENOENT' });
  } finally {
    await server.close();
    await closeDb();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});
