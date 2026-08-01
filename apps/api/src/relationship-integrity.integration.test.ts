import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `relationship-integrity-${process.pid}`);
const databasePath = path.join(testRoot, 'relationship-integrity.integration.test.db');
const databaseFiles = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

async function removeTestDatabase() {
  for (const file of databaseFiles) {
    try {
      await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    }
  }
}

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('impede vínculos cruzados em PATCH, licença, CRM e reatribuição de projeto', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = (options: {
    method: 'GET' | 'POST' | 'PATCH';
    url: string;
    payload?: Record<string, unknown>;
  }) => server.inject({
    ...options,
    headers: options.payload ? authHeaders : { 'x-api-token': 'test-token' }
  });

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clientA = crypto.randomUUID();
    const clientB = crypto.randomUUID();
    const projectA = crypto.randomUUID();
    const projectB = crypto.randomUUID();
    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'Cliente A' },
      { id: clientB, nome: 'Cliente B' }
    ]);
    await db.insert(schema.projetos).values([
      { id: projectA, clienteId: clientA, nome: 'Projeto A', tipo: 'Licenciamento' },
      { id: projectB, clienteId: clientB, nome: 'Projeto B', tipo: 'Topografia' }
    ]);

    const task = await request({
      method: 'POST',
      url: '/api/tarefas',
      payload: { titulo: 'Tarefa vinculada', clienteId: clientA, projetoId: projectA }
    });
    assert.equal(task.statusCode, 200, task.body);
    const taskId = task.json<{ id: string }>().id;
    const invalidTaskPatch = await request({
      method: 'PATCH',
      url: `/api/tarefas/${taskId}`,
      payload: { clienteId: clientB }
    });
    assert.equal(invalidTaskPatch.statusCode, 400, invalidTaskPatch.body);

    const appointment = await request({
      method: 'POST',
      url: '/api/compromissos',
      payload: { titulo: 'Vistoria', data: '2026-08-20', clienteId: clientA, projetoId: projectA }
    });
    assert.equal(appointment.statusCode, 200, appointment.body);
    const invalidAppointmentPatch = await request({
      method: 'PATCH',
      url: `/api/compromissos/${appointment.json<{ id: string }>().id}`,
      payload: { clienteId: clientB }
    });
    assert.equal(invalidAppointmentPatch.statusCode, 400, invalidAppointmentPatch.body);

    const invalidLicense = await request({
      method: 'POST',
      url: '/api/licencas',
      payload: {
        projetoId: projectA,
        clienteId: clientB,
        numero: 'LAO-001',
        orgao: 'IMA',
        tipoLicenca: 'LAO',
        dataVencimento: '2027-08-20',
        status: 'Válida'
      }
    });
    assert.equal(invalidLicense.statusCode, 400, invalidLicense.body);

    const budgetId = crypto.randomUUID();
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      grupoId: budgetId,
      clienteId: clientA,
      projetoId: projectA,
      valorTotal: 125_000,
      status: 'enviado',
      descricao: 'Orçamento A'
    });
    const opportunity = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: { clienteId: clientA, titulo: 'Oportunidade A', orcamentoId: budgetId }
    });
    assert.equal(opportunity.statusCode, 201, opportunity.body);
    const invalidOpportunityPatch = await request({
      method: 'PATCH',
      url: `/api/oportunidades/${opportunity.json<{ id: string }>().id}`,
      payload: { clienteId: clientB }
    });
    assert.equal(invalidOpportunityPatch.statusCode, 400, invalidOpportunityPatch.body);

    const impact = await request({
      method: 'GET',
      url: `/api/projetos/${projectA}/reassignment-impact?clienteId=${clientB}`
    });
    assert.equal(impact.statusCode, 200, impact.body);
    assert.equal(impact.json<{ allowed: boolean; hasFinancialDependencies: boolean }>().allowed, false);
    assert.equal(impact.json<{ allowed: boolean; hasFinancialDependencies: boolean }>().hasFinancialDependencies, true);

    const invalidProjectReassignment = await request({
      method: 'PATCH',
      url: `/api/projetos/${projectA}`,
      payload: { clienteId: clientB }
    });
    assert.equal(invalidProjectReassignment.statusCode, 409, invalidProjectReassignment.body);
    assert.equal(
      invalidProjectReassignment.json<{ code: string }>().code,
      'PROJECT_REASSIGNMENT_BLOCKED'
    );

    const projectStillLinked = await request({ method: 'GET', url: `/api/projetos/${projectA}` });
    assert.equal(projectStillLinked.json<{ clienteId: string }>().clienteId, clientA);

    const editableProject = crypto.randomUUID();
    await db.insert(schema.projetos).values({ id: editableProject, clienteId: clientA, nome: 'Projeto editável' });
    const editableTask = await request({
      method: 'POST', url: '/api/tarefas',
      payload: { titulo: 'Tarefa reatribuível', clienteId: clientA, projetoId: editableProject }
    });
    assert.equal(editableTask.statusCode, 200, editableTask.body);
    const editableImpact = await request({
      method: 'GET', url: `/api/projetos/${editableProject}/reassignment-impact?clienteId=${clientB}`
    });
    assert.equal(editableImpact.statusCode, 200, editableImpact.body);
    assert.equal(editableImpact.json<{ allowed: boolean }>().allowed, true);
    const reassigned = await request({
      method: 'POST', url: `/api/projetos/${editableProject}/reassign-client`,
      payload: {
        clienteId: clientB,
        confirmation: `REATRIBUIR ${editableProject} PARA ${clientB}`
      }
    });
    assert.equal(reassigned.statusCode, 200, reassigned.body);
    const [reassignedProject] = await db.select().from(schema.projetos)
      .where((await import('drizzle-orm')).eq(schema.projetos.id, editableProject)).limit(1);
    const [reassignedTask] = await db.select().from(schema.tarefas)
      .where((await import('drizzle-orm')).eq(schema.tarefas.id, editableTask.json<{ id: string }>().id)).limit(1);
    assert.equal(reassignedProject.clienteId, clientB);
    assert.equal(reassignedTask.clienteId, clientB);
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
