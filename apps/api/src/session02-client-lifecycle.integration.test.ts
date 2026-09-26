import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { and, eq, isNull, like } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `session02-client-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const token = 'session02-client-token';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;

test('sessão 02 protege ciclo de vida, vínculos e histórico do cliente', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = (options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) => server.inject({
    ...options,
    headers: options.payload
      ? { 'content-type': 'application/json', 'x-api-token': token }
      : { 'x-api-token': token }
  });

  const clientId = crypto.randomUUID();
  const otherClientId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const propertyId = crypto.randomUUID();

  try {
    await dbReady;
    await runRuntimeMigrations();
    await db.insert(schema.clientes).values([
      { id: clientId, nome: 'QA-AUDIT-S02-Cliente', tipoPessoa: 'PF', cpf: '529.982.247-25', documento: '529.982.247-25', documentoNormalizado: '52998224725', celular: '(48) 99999-9999' },
      { id: otherClientId, nome: 'QA-AUDIT-S02-Outro', tipoPessoa: 'PF', cpf: '935.411.347-80', documento: '935.411.347-80', documentoNormalizado: '93541134780', celular: '(48) 98888-8888' }
    ]);
    await db.insert(schema.projetos).values({ id: projectId, clienteId: otherClientId, nome: 'Projeto de outro cliente' });

    const invalidDate = await request({
      method: 'POST',
      url: `/api/clientes/${clientId}/historico`,
      payload: { tipo: 'Reunião', data: '2026-02-31', descricao: 'Data impossível.' }
    });
    assert.equal(invalidDate.statusCode, 400, invalidDate.body);

    const foreignProject = await request({
      method: 'POST',
      url: `/api/clientes/${clientId}/historico`,
      payload: { projetoId: projectId, tipo: 'Reunião', data: '2026-09-07', descricao: 'Vínculo inválido.' }
    });
    assert.equal(foreignProject.statusCode, 400, foreignProject.body);

    const historyCreate = await request({
      method: 'POST',
      url: `/api/clientes/${clientId}/historico`,
      payload: { tipo: 'Reunião', data: '2026-09-07', descricao: 'Interação sintética.' }
    });
    assert.equal(historyCreate.statusCode, 201, historyCreate.body);
    const historyId = historyCreate.json<{ id: string }>().id;

    const auditAfterHistory = await db.select().from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entity, 'Interação do cliente'),
        like(schema.auditLogs.newData, `%${historyId}%`)
      ));
    assert.equal(auditAfterHistory.length, 1, 'a criação do histórico precisa aparecer na trilha de auditoria');

    await db.insert(schema.propriedades).values({ id: propertyId, clienteId: clientId, nome: 'Propriedade vinculada' });
    const blockedDelete = await request({ method: 'DELETE', url: `/api/clientes/${clientId}` });
    assert.equal(blockedDelete.statusCode, 409, blockedDelete.body);
    assert.match(blockedDelete.body, /Propriedades/);

    const stillActive = await db.select({ deletedAt: schema.clientes.deletedAt }).from(schema.clientes)
      .where(eq(schema.clientes.id, clientId)).limit(1);
    assert.equal(stillActive[0]?.deletedAt, null);

    await db.update(schema.propriedades).set({ deletedAt: new Date().toISOString() }).where(eq(schema.propriedades.id, propertyId));
    const deleted = await request({ method: 'DELETE', url: `/api/clientes/${clientId}` });
    assert.equal(deleted.statusCode, 204, deleted.body);

    for (const url of [
      `/api/clientes/${clientId}`,
      `/api/clientes/${clientId}/dashboard`,
      `/api/clientes/${clientId}/historico`
    ]) {
      const response = await request({ method: 'GET', url });
      assert.equal(response.statusCode, 404, `${url}: ${response.body}`);
    }

    const patchDeleted = await request({
      method: 'PATCH',
      url: `/api/clientes/${clientId}`,
      payload: { nome: 'Não pode voltar' }
    });
    assert.equal(patchDeleted.statusCode, 404, patchDeleted.body);

    const patchDeletedHistory = await request({
      method: 'PATCH',
      url: `/api/clientes/${clientId}/historico/${historyId}`,
      payload: { descricao: 'Não pode alterar histórico excluído.' }
    });
    assert.equal(patchDeletedHistory.statusCode, 404, patchDeletedHistory.body);

    const repeatedDelete = await request({ method: 'DELETE', url: `/api/clientes/${clientId}` });
    assert.equal(repeatedDelete.statusCode, 404, repeatedDelete.body);

    const hiddenHistory = await db.select({ deletedAt: schema.interacoes_cliente.deletedAt })
      .from(schema.interacoes_cliente)
      .where(and(eq(schema.interacoes_cliente.id, historyId), isNull(schema.interacoes_cliente.deletedAt)));
    assert.equal(hiddenHistory.length, 0, 'o histórico subordinado deve acompanhar a exclusão lógica do cliente');
  } finally {
    await server.close();
  }
});
