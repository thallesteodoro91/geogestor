import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `filesystem-outbox-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const filesRoot = path.join(testRoot, 'files');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

function fileSystemError(code: string) {
  return Object.assign(new Error(`Falha sintética ${code}`), { code });
}

test('outbox persiste falhas, aplica retry idempotente e não sobrescreve colisões', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ runRuntimeMigrations }, { db }, { schema }, { FileSystemOutboxService }, { FileSystemService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./services/filesystem-outbox.service'),
    import('./services/fs.service')
  ]);
  await runRuntimeMigrations();
  await db.insert(schema.configuracoes).values({
    id: 'config-outbox',
    empresaNome: 'GeoGestor Teste',
    dadosPasta: filesRoot,
    adminNome: 'Administrador',
    adminEmail: 'admin@example.invalid',
    adminSenhaHash: 'scrypt:test:test',
    setupConcluido: true
  });
  await db.insert(schema.clientes).values({ id: 'client-outbox', nome: 'Cliente Sintético' });

  await FileSystemOutboxService.enqueue({
    idempotencyKey: 'test:create-client-folder',
    operationType: 'create-client-folder',
    aggregateType: 'client',
    aggregateId: 'client-outbox',
    payload: { clientId: 'client-outbox', clientName: 'Cliente Sintético' }
  });
  await FileSystemOutboxService.enqueue({
    idempotencyKey: 'test:create-client-folder',
    operationType: 'create-client-folder',
    aggregateType: 'client',
    aggregateId: 'client-outbox',
    payload: { clientId: 'client-outbox', clientName: 'Cliente Sintético' }
  });

  let injectedCode = 'ENOSPC';
  FileSystemService.setFailureInjectorForTests((operation) => {
    if (operation === 'mkdir') throw fileSystemError(injectedCode);
  });
  const firstAttempt = await FileSystemOutboxService.processPending();
  assert.equal(firstAttempt.failed, 1);
  let operations = await db.select().from(schema.filesystemOperations);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].status, 'failed');
  assert.equal(operations[0].attempts, 1);
  assert.match(operations[0].lastError || '', /ENOSPC/);

  for (const code of ['EACCES', 'EPERM']) {
    injectedCode = code;
    await db.update(schema.filesystemOperations).set({
      status: 'pending',
      nextAttemptAt: new Date(0).toISOString()
    }).where(eq(schema.filesystemOperations.id, operations[0].id));
    const attempt = await FileSystemOutboxService.processPending();
    assert.equal(attempt.failed, 1);
    operations = await db.select().from(schema.filesystemOperations);
    assert.match(operations[0].lastError || '', new RegExp(code));
  }

  FileSystemService.setFailureInjectorForTests(null);
  await db.update(schema.filesystemOperations).set({
    status: 'pending',
    nextAttemptAt: new Date(0).toISOString()
  }).where(eq(schema.filesystemOperations.id, operations[0].id));
  const [completed, concurrent] = await Promise.all([
    FileSystemOutboxService.processPending(),
    FileSystemOutboxService.processPending()
  ]);
  assert.equal(completed.succeeded + concurrent.succeeded, 1);
  assert.equal(completed.skipped || concurrent.skipped, true);
  assert.equal((await fs.stat(path.join(filesRoot, 'Clientes', 'Cliente Sintético'))).isDirectory(), true);

  await fs.mkdir(path.join(filesRoot, 'Clientes', 'Origem'), { recursive: true });
  await fs.mkdir(path.join(filesRoot, 'Clientes', 'Destino'), { recursive: true });
  await FileSystemOutboxService.enqueue({
    idempotencyKey: 'test:rename-collision',
    operationType: 'rename-client-folder',
    aggregateType: 'client',
    aggregateId: 'client-outbox',
    payload: { clientId: 'client-outbox', oldClientName: 'Origem', newClientName: 'Destino' }
  });
  const collision = await FileSystemOutboxService.processPending();
  assert.equal(collision.failed, 1);
  assert.equal((await fs.stat(path.join(filesRoot, 'Clientes', 'Origem'))).isDirectory(), true);
  assert.equal((await fs.stat(path.join(filesRoot, 'Clientes', 'Destino'))).isDirectory(), true);

  await db.insert(schema.clientes).values({ id: 'client-destination', nome: 'Cliente Destino' });
  await db.insert(schema.projetos).values({
    id: 'project-outbox',
    clienteId: 'client-destination',
    nome: 'Projeto Novo'
  });
  await fs.mkdir(path.join(filesRoot, 'Clientes', 'Cliente Sintético', 'Projeto Antigo'), { recursive: true });
  await FileSystemOutboxService.enqueue({
    idempotencyKey: 'test:move-project',
    operationType: 'rename-project-folder',
    aggregateType: 'project',
    aggregateId: 'project-outbox',
    payload: {
      projectId: 'project-outbox',
      oldClientName: 'Cliente Sintético',
      newClientName: 'Cliente Destino',
      oldProjectName: 'Projeto Antigo',
      newProjectName: 'Projeto Novo'
    }
  });
  const projectMove = await FileSystemOutboxService.processPending();
  assert.equal(projectMove.succeeded, 1);
  await assert.rejects(fs.access(path.join(filesRoot, 'Clientes', 'Cliente Sintético', 'Projeto Antigo')));
  assert.equal((await fs.stat(path.join(filesRoot, 'Clientes', 'Cliente Destino', 'Projeto Novo'))).isDirectory(), true);

  await FileSystemOutboxService.enqueue({
    idempotencyKey: 'test:recover-after-restart',
    operationType: 'create-client-folder',
    aggregateType: 'client',
    aggregateId: 'client-destination',
    payload: { clientId: 'client-destination', clientName: 'Cliente Destino' }
  });
  const restartOperation = (await db.select().from(schema.filesystemOperations)
    .where(eq(schema.filesystemOperations.idempotencyKey, 'test:recover-after-restart')))[0];
  await db.update(schema.filesystemOperations).set({
    status: 'processing',
    lockedAt: '2020-01-01T00:00:00.000Z',
    lockOwner: 'processo-interrompido'
  }).where(eq(schema.filesystemOperations.id, restartOperation.id));
  await FileSystemOutboxService.recoverStaleOperations();
  const recovered = (await db.select().from(schema.filesystemOperations)
    .where(eq(schema.filesystemOperations.id, restartOperation.id)))[0];
  assert.equal(recovered.status, 'failed');
  assert.match(recovered.lastError || '', /interrupção/);

  FileSystemService.setFailureInjectorForTests(null);
});
