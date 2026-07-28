import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { normalizeLicenseStatus } from '@geogestor/contracts';

const testRoot = path.resolve(process.cwd(), 'scratch', `environmental-${process.pid}`);
const dbPath = path.join(testRoot, `environmental.integration.${process.pid}.test.db`);
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

async function removeTestDatabase() {
  for (const file of dbFiles) {
    try {
      await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    }
  }
}

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('opera demandas, licenças e condicionantes ambientais com dados persistentes', async () => {
  assert.equal(normalizeLicenseStatus('Ativa'), 'Válida');
  assert.equal(normalizeLicenseStatus('em renovacao'), 'Em renovação');
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

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
    headers: options.payload ? authHeaders : { 'x-api-token': 'test-token' }
  });

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clienteId = crypto.randomUUID();
    const demandaId = crypto.randomUUID();
    const topografiaId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clienteId, nome: 'Cliente Ambiental SC' });
    await db.insert(schema.projetos).values([
      {
        id: demandaId,
        clienteId,
        nome: 'Licenciamento de empreendimento rural',
        tipo: 'Ambiental',
        status: 'Em andamento',
        dataInicio: '2026-07-01',
        dataEntrega: '2026-09-30'
      },
      {
        id: topografiaId,
        clienteId,
        nome: 'Levantamento planialtimétrico',
        tipo: 'Topografia',
        status: 'Em andamento'
      }
    ]);
    await db.insert(schema.ambiental).values({
      id: crypto.randomUUID(),
      projetoId: demandaId,
      clienteId,
      orgaoAmbiental: 'IMA/SC',
      tipoDemanda: 'Licenciamento ambiental',
      protocolo: 'IMA-2026-0042',
      statusFase: 'Documentação'
    });

    const filteredDemands = await request({ method: 'GET', url: '/api/ambiental?q=IMA-2026-0042' });
    assert.equal(filteredDemands.statusCode, 200, filteredDemands.body);
    const demandList = filteredDemands.json<{ items: Array<{ id: string; tipo: string }>; total: number }>();
    assert.equal(demandList.total, 1);
    assert.deepEqual(demandList.items.map((item) => item.id), [demandaId]);
    assert.equal(demandList.items[0].tipo, 'Ambiental');

    const phaseUpdate = await request({
      method: 'PATCH',
      url: `/api/ambiental/${demandaId}/fase`,
      payload: { statusFase: 'Protocolo' }
    });
    assert.equal(phaseUpdate.statusCode, 200, phaseUpdate.body);

    const progress = await request({
      method: 'POST',
      url: `/api/ambiental/${demandaId}/andamentos`,
      payload: {
        titulo: 'Protocolo realizado',
        descricao: 'Documentação protocolada no órgão ambiental.',
        data: '2026-07-18',
        categoria: 'Protocolo'
      }
    });
    assert.equal(progress.statusCode, 201, progress.body);

    const detail = await request({ method: 'GET', url: `/api/ambiental/${demandaId}` });
    assert.equal(detail.statusCode, 200, detail.body);
    const demandDetail = detail.json<{ statusFase: string; createdAt: string; history: Array<{ titulo: string }> }>();
    assert.equal(demandDetail.statusFase, 'Protocolo');
    assert.ok(demandDetail.createdAt);
    assert.ok(demandDetail.history.some((item) => item.titulo === 'Protocolo realizado'));

    const invalidLicense = await request({
      method: 'POST',
      url: '/api/licencas',
      payload: {
        projetoId: demandaId,
        numero: 'LAO 100/2026',
        orgao: 'IMA/SC',
        tipoLicenca: 'LAO',
        status: 'Válida'
      }
    });
    assert.equal(invalidLicense.statusCode, 400, invalidLicense.body);

    const createLicense = await request({
      method: 'POST',
      url: '/api/licencas',
      payload: {
        projetoId: demandaId,
        clienteId,
        numero: 'LAO 100/2026',
        protocolo: 'IMA-2026-0042',
        orgao: 'IMA/SC',
        tipoLicenca: 'LAO',
        dataEmissao: '2020-01-10',
        dataVencimento: '2020-12-31',
        status: 'Válida',
        observacoes: 'Licença histórica para teste de vencimento.'
      }
    });
    assert.equal(createLicense.statusCode, 201, createLicense.body);
    const license = createLicense.json<{ id: string; numero: string }>();
    assert.equal(license.numero, 'LAO 100/2026');

    const licenseList = await request({ method: 'GET', url: '/api/licencas' });
    assert.equal(licenseList.statusCode, 200, licenseList.body);
    const licenses = licenseList.json<Array<{
      id: string;
      status: string;
      statusRegistrado: string;
      projetoNome: string;
      clienteNome: string;
    }>>();
    const listedLicense = licenses.find((item) => item.id === license.id);
    assert.equal(listedLicense?.status, 'Vencida');
    assert.equal(listedLicense?.statusRegistrado, 'Válida');
    assert.equal(listedLicense?.projetoNome, 'Licenciamento de empreendimento rural');
    assert.equal(listedLicense?.clienteNome, 'Cliente Ambiental SC');

    const startRenewal = await request({
      method: 'PATCH',
      url: `/api/licencas/${license.id}`,
      payload: { status: 'Em renovação' }
    });
    assert.equal(startRenewal.statusCode, 200, startRenewal.body);

    const renewalList = await request({ method: 'GET', url: '/api/licencas?status=Em%20renova%C3%A7%C3%A3o' });
    assert.equal(renewalList.statusCode, 200, renewalList.body);
    const renewingLicense = renewalList.json<Array<{ id: string; status: string; statusRegistrado: string }>>()
      .find((item) => item.id === license.id);
    assert.equal(renewingLicense?.status, 'Vencida');
    assert.equal(renewingLicense?.statusRegistrado, 'Em renovação');

    const createCondition = await request({
      method: 'POST',
      url: `/api/licencas/${license.id}/condicionantes`,
      payload: {
        titulo: 'Apresentar relatório de monitoramento',
        descricao: 'Relatório anual com registros fotográficos.',
        dataLimite: '2020-10-30',
        periodicidade: 'Anual',
        responsavel: 'Responsável técnico',
        status: 'Pendente'
      }
    });
    assert.equal(createCondition.statusCode, 201, createCondition.body);
    const condition = createCondition.json<{ id: string; status: string }>();
    assert.equal(condition.status, 'Vencida');

    const fulfillCondition = await request({
      method: 'PATCH',
      url: `/api/licencas/${license.id}/condicionantes/${condition.id}`,
      payload: { status: 'Cumprida', dataCumprimento: '2026-07-18', comprovante: 'relatorio-2026.pdf' }
    });
    assert.equal(fulfillCondition.statusCode, 200, fulfillCondition.body);
    assert.equal(fulfillCondition.json<{ status: string }>().status, 'Cumprida');

    const conditionList = await request({ method: 'GET', url: `/api/licencas/${license.id}/condicionantes` });
    assert.equal(conditionList.statusCode, 200, conditionList.body);
    assert.equal(conditionList.json<Array<{ id: string }>>().length, 1);

    await db.delete(schema.licencas).where(eq(schema.licencas.id, license.id));
    const remainingConditions = await db.select().from(schema.condicionantesAmbientais)
      .where(eq(schema.condicionantesAmbientais.licencaId, license.id));
    assert.equal(remainingConditions.length, 0, 'a exclusão física da licença deve remover condicionantes em cascata');
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
