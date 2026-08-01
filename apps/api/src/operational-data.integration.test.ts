import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), 'scratch', `operational-data-${process.pid}`);
const databasePath = path.join(root, 'operational-data.integration.test.db');
const files = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];
const headers = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

async function cleanup() {
  for (const file of files) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await fs.rm(file, { force: true });
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!['EBUSY', 'EPERM'].includes(code ?? '') || attempt === 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('v7 persiste propriedades, configurações migradas e histórico de cálculos', async () => {
  await fs.mkdir(root, { recursive: true });
  await cleanup();
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const request = (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>,
  ) => server.inject({
    method,
    url,
    ...(payload === undefined ? {} : { payload }),
    headers: payload === undefined ? { 'x-api-token': 'test-token' } : headers,
  });

  try {
    await dbReady;
    const migration = await runRuntimeMigrations();
    assert.equal(migration.schemaVersion, 7);
    const clientA = crypto.randomUUID();
    const clientB = crypto.randomUUID();
    const projectA = crypto.randomUUID();
    const projectB = crypto.randomUUID();
    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'Cliente A' },
      { id: clientB, nome: 'Cliente B' }
    ]);
    await db.insert(schema.projetos).values([
      { id: projectA, clienteId: clientA, nome: 'Projeto A' },
      { id: projectB, clienteId: clientB, nome: 'Projeto selecionado fora da busca' }
    ]);

    const propertyResponse = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: clientA,
      nome: 'Fazenda Modelo',
      matricula: '12.345',
      car: 'SC-123',
      areaHa: 42.5,
      municipio: 'Florianópolis'
    });
    assert.equal(propertyResponse.statusCode, 201, propertyResponse.body);
    const propertyId = propertyResponse.json<{ id: string }>().id;
    const propertyList = await request('GET', `/api/dados-operacionais/propriedades?clienteId=${clientA}`);
    assert.equal(propertyList.json<{ total: number }>().total, 1);
    const propertyOptions = await request('GET', `/api/dados-operacionais/propriedades/options?q=inexistente&selectedId=${propertyId}`);
    assert.equal(propertyOptions.statusCode, 200, propertyOptions.body);
    assert.equal(propertyOptions.json<Array<{ id: string }>>()[0]?.id, propertyId);

    const projectOptions = await request('GET', `/api/projetos/options?q=Projeto%20A&selectedId=${projectB}`);
    assert.equal(projectOptions.statusCode, 200, projectOptions.body);
    assert.equal(projectOptions.json<Array<{ id: string }>>().some((item) => item.id === projectB), true);

    const taskId = crypto.randomUUID();
    await db.insert(schema.tarefas).values({ id: taskId, clienteId: clientA, projetoId: projectA, titulo: 'Conferir memorial' });
    const taskOptions = await request('GET', `/api/tarefas/options?q=memorial&selectedId=${taskId}`);
    assert.equal(taskOptions.statusCode, 200, taskOptions.body);
    assert.deepEqual(Object.keys(taskOptions.json<Array<Record<string, unknown>>>()[0]).sort(), ['clienteId', 'id', 'projetoId', 'status', 'titulo']);

    const linkedProject = await request('PATCH', `/api/projetos/${projectA}`, { propriedadeId: propertyId });
    assert.equal(linkedProject.statusCode, 200, linkedProject.body);
    const blockedPropertyRemoval = await request('DELETE', `/api/dados-operacionais/propriedades/${propertyId}`);
    assert.equal(blockedPropertyRemoval.statusCode, 409, blockedPropertyRemoval.body);

    const invalidCalculation = await request('POST', '/api/dados-operacionais/calculos', {
      tipo: 'topografico',
      nome: 'Área incompatível',
      clienteId: clientB,
      projetoId: projectA,
      dataCalculo: '2026-08-01',
      entradas: { vertices: 4 },
      resultado: { area: 42.5 },
      unidade: 'ha'
    });
    assert.equal(invalidCalculation.statusCode, 400, invalidCalculation.body);

    const calculation = await request('POST', '/api/dados-operacionais/calculos', {
      tipo: 'topografico',
      nome: 'Área Fazenda Modelo',
      clienteId: clientA,
      projetoId: projectA,
      dataCalculo: '2026-08-01',
      entradas: { vertices: 4 },
      resultado: { area: 42.5 },
      unidade: 'ha',
      metodo: 'Coordenadas planas'
    });
    assert.equal(calculation.statusCode, 201, calculation.body);
    const calculations = await request('GET', '/api/dados-operacionais/calculos?tipo=topografico');
    assert.equal(calculations.json<Array<{ clienteId: string; projetoId: string; resultado: { area: number } }>>()[0].resultado.area, 42.5);

    const migrationResponse = await request('PUT', '/api/dados-operacionais/configuracoes-operacionais/migrar', {
      values: {
        geogestor_tipos_servico: ['Topografia', 'Georreferenciamento'],
        geogestor_empresa_template: { razao: 'SkyGeo' }
      }
    });
    assert.equal(migrationResponse.statusCode, 200, migrationResponse.body);
    await request('PUT', '/api/dados-operacionais/configuracoes-operacionais/migrar', {
      values: { geogestor_tipos_servico: ['Topografia', 'Ambiental'] }
    });
    const settings = await request('GET', '/api/dados-operacionais/configuracoes-operacionais');
    assert.deepEqual(settings.json<Record<string, unknown>>().geogestor_tipos_servico, ['Topografia', 'Ambiental']);
    const rows = await db.select().from(schema.configuracoesOperacionais);
    assert.equal(rows.filter((row) => row.chave === 'geogestor_tipos_servico').length, 1);
  } finally {
    await server.close();
    await closeDb();
    // On Windows, libSQL can retain the file handle until the test worker exits.
    // The database lives under scratch and is removed eagerly on the next run.
    await Promise.allSettled(files.map((file) => fs.rm(file, { force: true })));
  }
});
