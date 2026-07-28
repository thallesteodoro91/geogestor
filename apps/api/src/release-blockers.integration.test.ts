import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `release-blockers-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const filesRoot = path.join(testRoot, 'files');
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'release-blockers-token' };

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'release-blockers-token';
process.env.GEOGESTOR_SECRET_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.GEOGESTOR_DESKTOP_MANAGED = '1';

test('bloqueios de clientes, reset e configurações são recusados pelo backend', async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  await fs.mkdir(filesRoot, { recursive: true });

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }, { LocalSecretService }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
    import('./services/local-secret.service')
  ]);

  const request = (options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: object;
  }) => server.inject({
    ...options,
    headers: options.payload ? authHeaders : { 'x-api-token': authHeaders['x-api-token'] }
  });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const storedSecret = LocalSecretService.protect('segredo-google-original');
    await db.insert(schema.configuracoes).values({
      id: crypto.randomUUID(),
      empresaNome: 'SkyGeo',
      dadosPasta: filesRoot,
      adminNome: 'Administrador',
      adminEmail: 'admin@skygeo.com.br',
      adminSenhaHash: 'scrypt:test:test',
      googleClientId: 'cliente.apps.googleusercontent.com',
      googleClientSecret: storedSecret,
      setupConcluido: true
    });

    const firstClient = await request({
      method: 'POST',
      url: '/api/clientes',
      payload: {
        nome: 'Cliente original',
        tipoPessoa: 'PF',
        cpf: '529.982.247-25',
        documento: '529.982.247-25',
        telefone: '(48) 3333-4444'
      }
    });
    assert.equal(firstClient.statusCode, 201, firstClient.body);

    const duplicateClient = await request({
      method: 'POST',
      url: '/api/clientes',
      payload: {
        nome: 'Cliente duplicado',
        tipoPessoa: 'PF',
        cpf: '52998224725',
        documento: '52998224725',
        telefone: '(48) 3333-5555'
      }
    });
    assert.equal(duplicateClient.statusCode, 409, duplicateClient.body);

    const secondClient = await request({
      method: 'POST',
      url: '/api/clientes',
      payload: {
        nome: 'Segundo cliente',
        tipoPessoa: 'PF',
        cpf: '111.444.777-35',
        documento: '111.444.777-35',
        telefone: '(48) 3333-6666'
      }
    });
    assert.equal(secondClient.statusCode, 201, secondClient.body);
    const secondClientId = secondClient.json<{ id: string }>().id;
    const duplicateOnEdit = await request({
      method: 'PATCH',
      url: `/api/clientes/${secondClientId}`,
      payload: { cpf: '52998224725', documento: '52998224725' }
    });
    assert.equal(duplicateOnEdit.statusCode, 409, duplicateOnEdit.body);

    const duplicateImport = await request({
      method: 'POST',
      url: '/api/clientes/lote',
      payload: [{
        nome: 'Duplicado importado',
        tipoPessoa: 'PF',
        cpf: '529.982.247-25',
        documento: '529.982.247-25',
        telefone: '(48) 3333-7777'
      }]
    });
    assert.equal(duplicateImport.statusCode, 201, duplicateImport.body);
    assert.equal(duplicateImport.json<{ failed: number }>().failed, 1);

    const concurrentPayload = (nome: string) => ({
      method: 'POST' as const,
      url: '/api/clientes',
      payload: {
        nome,
        tipoPessoa: 'PJ',
        cnpj: '11.222.333/0001-81',
        documento: '11.222.333/0001-81',
        telefone: '(48) 3333-8888'
      }
    });
    const concurrentCreates = await Promise.all([
      request(concurrentPayload('Empresa concorrente A')),
      request(concurrentPayload('Empresa concorrente B'))
    ]);
    assert.deepEqual(concurrentCreates.map((response) => response.statusCode).sort(), [201, 409]);

    const configResponse = await request({ method: 'GET', url: '/api/configuracoes' });
    assert.equal(configResponse.statusCode, 200, configResponse.body);
    assert.equal(configResponse.body.includes('segredo-google-original'), false);
    const publicConfig = configResponse.json<Record<string, unknown>>();
    assert.equal('googleClientSecret' in publicConfig, false);
    assert.equal(publicConfig.googleClientSecretConfigured, true);

    const invalidEmail = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { adminEmail: 'email-invalido' }
    });
    assert.equal(invalidEmail.statusCode, 400, invalidEmail.body);
    assert.equal(Boolean(invalidEmail.json<{ fields?: Record<string, string> }>().fields?.adminEmail), true);

    const emptyCompany = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { empresaNome: '   ' }
    });
    assert.equal(emptyCompany.statusCode, 400, emptyCompany.body);

    const nullEmail = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { adminEmail: null }
    });
    assert.equal(nullEmail.statusCode, 400, nullEmail.body);

    const excessiveCompany = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { empresaNome: 'A'.repeat(201) }
    });
    assert.equal(excessiveCompany.statusCode, 400, excessiveCompany.body);

    const unknownField = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { campoDesconhecido: true }
    });
    assert.equal(unknownField.statusCode, 400, unknownField.body);

    const preserveSecret = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { empresaNome: 'SkyGeo Atualizada', googleClientSecret: '' }
    });
    assert.equal(preserveSecret.statusCode, 200, preserveSecret.body);
    const persistedAfterPatch = await db.select().from(schema.configuracoes).limit(1);
    assert.equal(LocalSecretService.reveal(persistedAfterPatch[0].googleClientSecret), 'segredo-google-original');

    const maskedSecret = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { googleClientSecret: '••••••••' }
    });
    assert.equal(maskedSecret.statusCode, 400, maskedSecret.body);

    const replaceSecret = await request({
      method: 'PATCH',
      url: '/api/configuracoes',
      payload: { adminEmail: ' novo@skygeo.com.br ', googleClientSecret: 'segredo-google-substituto' }
    });
    assert.equal(replaceSecret.statusCode, 200, replaceSecret.body);
    assert.equal(replaceSecret.body.includes('segredo-google-substituto'), false);
    const persistedAfterReplacement = await db.select().from(schema.configuracoes).limit(1);
    assert.equal(persistedAfterReplacement[0].adminEmail, 'novo@skygeo.com.br');
    assert.equal(LocalSecretService.reveal(persistedAfterReplacement[0].googleClientSecret), 'segredo-google-substituto');
    const auditEntries = await db.select({ oldData: schema.auditLogs.oldData, newData: schema.auditLogs.newData })
      .from(schema.auditLogs);
    assert.equal(JSON.stringify(auditEntries).includes('segredo-google-original'), false);
    assert.equal(JSON.stringify(auditEntries).includes('segredo-google-substituto'), false);

    await db.insert(schema.clientes).values({ id: crypto.randomUUID(), nome: 'Marcador de reset' });
    const resetWithoutConfirmation = await request({ method: 'DELETE', url: '/api/sistema/reset' });
    assert.equal(resetWithoutConfirmation.statusCode, 400, resetWithoutConfirmation.body);

    const resetWithWrongConfirmation = await request({
      method: 'DELETE',
      url: '/api/sistema/reset',
      payload: { confirmation: 'APAGAR' }
    });
    assert.equal(resetWithWrongConfirmation.statusCode, 400, resetWithWrongConfirmation.body);

    const beforeRejectedReset = await db.select().from(schema.clientes).where(eq(schema.clientes.nome, 'Marcador de reset'));
    assert.equal(beforeRejectedReset.length, 1);

    const restoreWithoutConfirmation = await request({
      method: 'POST',
      url: '/api/sistema/restaurar-backup',
      payload: { bundlePath: path.join(testRoot, 'backup-inexistente') }
    });
    assert.equal(restoreWithoutConfirmation.statusCode, 400, restoreWithoutConfirmation.body);
    const restoreOutsideBackupRoot = await request({
      method: 'POST',
      url: '/api/sistema/restaurar-backup',
      payload: {
        bundlePath: path.join(testRoot, 'backup-inexistente'),
        confirmation: 'RESTAURAR BACKUP DO GEOGESTOR'
      }
    });
    assert.equal(restoreOutsideBackupRoot.statusCode, 422, restoreOutsideBackupRoot.body);

    const acceptedReset = await request({
      method: 'POST',
      url: '/api/sistema/reset-dados',
      payload: { confirmation: 'APAGAR DADOS DO GEOGESTOR' }
    });
    assert.equal(acceptedReset.statusCode, 200, acceptedReset.body);
    assert.equal((await db.select().from(schema.clientes)).length, 0);
    assert.equal((await db.select().from(schema.configuracoes)).length, 1);
  } finally {
    await server.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    });
  }
});
