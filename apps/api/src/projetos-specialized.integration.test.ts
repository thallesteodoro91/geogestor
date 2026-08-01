import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `projetos-specialized-${process.pid}`);
const dbPath = path.join(testRoot, 'projetos-specialized.integration.test.db');
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

test('preserva dados especializados e bloqueia alteração destrutiva do tipo do projeto', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente do projeto' });
    await db.insert(schema.projetos).values({
      id: projectId,
      clienteId: clientId,
      nome: 'Diagnóstico ambiental',
      tipo: 'Ambiental',
      status: 'Planejamento'
    });
    await db.insert(schema.ambiental).values({
      id: crypto.randomUUID(),
      projetoId: projectId,
      clienteId: clientId,
      orgaoAmbiental: 'IMA',
      tipoDemanda: 'Estudo ambiental',
      protocolo: 'IMA-2026-001',
      statusFase: 'Inicial'
    });

    const environmentalResponse = await server.inject({
      method: 'GET',
      url: `/api/projetos/${projectId}`,
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(environmentalResponse.statusCode, 200, environmentalResponse.body);
    const environmentalProject = environmentalResponse.json<{
      orgaoAmbiental: string;
      tipoDemanda: string;
      protocolo: string;
    }>();
    assert.equal(environmentalProject.orgaoAmbiental, 'IMA');
    assert.equal(environmentalProject.tipoDemanda, 'Estudo ambiental');
    assert.equal(environmentalProject.protocolo, 'IMA-2026-001');

    const changeTypeResponse = await server.inject({
      method: 'PATCH',
      url: `/api/projetos/${projectId}`,
      headers: authHeaders,
      payload: {
        tipo: 'Perícia',
        tipoPericia: 'Judicial',
        numeroProcesso: '5001234-56.2026.8.24.0000',
        dataVistoria: '2026-08-12'
      }
    });
    assert.equal(changeTypeResponse.statusCode, 409, changeTypeResponse.body);
    assert.equal(changeTypeResponse.json<{ code: string }>().code, 'PROJECT_TYPE_CHANGE_BLOCKED');

    const environmentalRows = await db.select().from(schema.ambiental).where(eq(schema.ambiental.projetoId, projectId));
    const expertAssessmentRows = await db.select().from(schema.pericias).where(eq(schema.pericias.projetoId, projectId));
    assert.equal(environmentalRows.length, 1);
    assert.equal(expertAssessmentRows.length, 0);

    const expertAssessmentResponse = await server.inject({
      method: 'GET',
      url: `/api/projetos/${projectId}`,
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(expertAssessmentResponse.statusCode, 200, expertAssessmentResponse.body);
    const expertAssessmentProject = expertAssessmentResponse.json<{
      tipo: string;
      orgaoAmbiental: string;
      tipoDemanda: string;
      protocolo: string;
    }>();
    assert.equal(expertAssessmentProject.tipo, 'Ambiental');
    assert.equal(expertAssessmentProject.orgaoAmbiental, 'IMA');
    assert.equal(expertAssessmentProject.tipoDemanda, 'Estudo ambiental');
    assert.equal(expertAssessmentProject.protocolo, 'IMA-2026-001');
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
