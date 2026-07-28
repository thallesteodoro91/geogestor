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

test('reset exige backup válido, faz rollback integral e preserva configuração e arquivos', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(filesRoot, { recursive: true });
  await fs.writeFile(path.join(filesRoot, 'documento-preservado.txt'), 'conteúdo sintético', 'utf8');
  const [{ runRuntimeMigrations }, { db }, { schema }, { SystemResetService, ResetInProgressError }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./services/system-reset.service')
  ]);
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

  SystemResetService.configureForTests({
    validateBackup: async () => {
      throw new Error('Backup sintético inválido');
    }
  });
  await assert.rejects(SystemResetService.resetOperationalData(), /Backup sintético inválido/);
  assert.equal(Number((await db.select({ total: count() }).from(schema.clientes))[0].total), 1);

  SystemResetService.configureForTests({
    beforeDelete: async (tableName) => {
      if (tableName === 'audit_logs') throw new Error('Interrupção sintética');
    }
  });
  await assert.rejects(SystemResetService.resetOperationalData(), /Interrupção sintética/);
  assert.equal(Number((await db.select({ total: count() }).from(schema.clientes))[0].total), 1);

  SystemResetService.configureForTests(null);
  const firstReset = SystemResetService.resetOperationalData();
  await assert.rejects(SystemResetService.resetOperationalData(), (error: unknown) => error instanceof ResetInProgressError);
  const result = await firstReset;
  assert.match(result.message, /dados operacionais do banco de dados/i);
  assert.equal(Number((await db.select({ total: count() }).from(schema.clientes))[0].total), 0);
  assert.equal(Number((await db.select({ total: count() }).from(schema.configuracoes))[0].total), 1);
  assert.equal(await fs.readFile(path.join(filesRoot, 'documento-preservado.txt'), 'utf8'), 'conteúdo sintético');
  assert.equal((await fs.stat(result.recoveryBackupPath)).isDirectory(), true);

  const operationalLog = await fs.readFile(path.join(testRoot, 'logs', 'operational.ndjson'), 'utf8');
  assert.match(operationalLog, /operational-data-reset-completed/);
  assert.doesNotMatch(operationalLog, /Cliente Sintético/);
  SystemResetService.configureForTests(null);
});
