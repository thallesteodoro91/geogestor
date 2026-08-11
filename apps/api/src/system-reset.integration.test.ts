import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { count } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `system-reset-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const filesRoot = path.join(testRoot, 'files');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

let closeDatabase: (() => void | Promise<void>) | null = null;

async function removeTestRoot() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

test.after(async () => {
  const { SystemResetService } = await import('./services/system-reset.service');
  SystemResetService.configureForTests(null);
  await closeDatabase?.();
  closeDatabase = null;
});

test('reset exige backup válido, faz rollback integral e preserva configuração e arquivos', async () => {
  await removeTestRoot();
  await fs.mkdir(filesRoot, { recursive: true });
  await fs.writeFile(path.join(filesRoot, 'documento-preservado.txt'), 'conteúdo sintético', 'utf8');
  const [{ runRuntimeMigrations }, { db, closeDb }, { schema }, { SystemResetService, ResetInProgressError }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./services/system-reset.service')
  ]);
  closeDatabase = closeDb;
  await runRuntimeMigrations();
  await db.insert(schema.configuracoes).values({
    id: 'config-reset',
    empresaNome: 'GeoGestor Teste',
    dadosPasta: filesRoot,
    adminNome: 'Administrador',
    adminEmail: 'admin@example.invalid',
    adminSenhaHash: 'scrypt:test:test',
    setupConcluido: true
  });
  await db.insert(schema.clientes).values({ id: 'client-reset', nome: 'Cliente Sintético' });
  await db.insert(schema.viagens).values({
    id: 'trip-reset',
    clienteId: 'client-reset',
    finalidade: 'Vistoria sintética',
    destino: 'Campo de teste',
    dataInicio: '2026-08-08'
  });
  await db.insert(schema.calculosSalvos).values({
    id: 'calculation-reset',
    tipo: 'topografico',
    nome: 'Cálculo sintético',
    clienteId: 'client-reset',
    dataCalculo: '2026-08-08',
    entradasJson: '{}',
    resultadoJson: '{}'
  });
  await db.insert(schema.ciclosEstrategicos).values({
    id: 'cycle-reset',
    nome: 'Ciclo sintético',
    dataInicio: '2026-01-01',
    dataFim: '2026-12-31',
    visao: 'Validar o reset operacional'
  });
  await db.insert(schema.auditLogs).values({
    id: 'audit-preserved',
    action: 'INSERT',
    entity: 'TesteReset'
  });

  SystemResetService.configureForTests({
    validateBackup: async () => {
      throw new Error('Backup sintético inválido');
    }
  });
  await assert.rejects(SystemResetService.resetOperationalData(), /Backup sintético inválido/);
  assert.equal(Number((await db.select({ total: count() }).from(schema.clientes))[0].total), 1);

  SystemResetService.configureForTests({
    beforeDelete: async (tableName) => {
      if (tableName === 'clientes') throw new Error('Interrupção sintética');
    }
  });
  await assert.rejects(SystemResetService.resetOperationalData(), /Interrupção sintética/);
  assert.equal(Number((await db.select({ total: count() }).from(schema.clientes))[0].total), 1);

  SystemResetService.configureForTests(null);
  const firstReset = SystemResetService.resetOperationalData();
  await assert.rejects(SystemResetService.resetOperationalData(), (error: unknown) => error instanceof ResetInProgressError);
  const result = await firstReset;
  assert.match(result.message, /dados operacionais do banco de dados/i);
  assert.equal(result.removedByTable.viagens, 1);
  assert.equal(result.removedByTable.calculos_salvos, 1);
  assert.equal(result.removedByTable.ciclos_estrategicos, 1);
  assert.equal(Number((await db.select({ total: count() }).from(schema.clientes))[0].total), 0);
  assert.equal(Number((await db.select({ total: count() }).from(schema.viagens))[0].total), 0);
  assert.equal(Number((await db.select({ total: count() }).from(schema.calculosSalvos))[0].total), 0);
  assert.equal(Number((await db.select({ total: count() }).from(schema.ciclosEstrategicos))[0].total), 0);
  assert.equal(Number((await db.select({ total: count() }).from(schema.configuracoes))[0].total), 1);
  assert.ok(Number((await db.select({ total: count() }).from(schema.auditLogs))[0].total) >= 2);
  assert.equal(await fs.readFile(path.join(filesRoot, 'documento-preservado.txt'), 'utf8'), 'conteúdo sintético');
  assert.equal((await fs.stat(result.recoveryBackupPath)).isDirectory(), true);

  const operationalLog = await fs.readFile(path.join(testRoot, 'logs', 'operational.ndjson'), 'utf8');
  assert.match(operationalLog, /operational-data-reset-completed/);
  assert.doesNotMatch(operationalLog, /Cliente Sintético/);
  SystemResetService.configureForTests(null);
});
