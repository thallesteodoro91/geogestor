import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), 'scratch', 'runtime-migrations-v3-' + process.pid);
const databasePath = path.join(root, 'geogestor-v3.db');
const files = [databasePath, databasePath + '-shm', databasePath + '-wal'];

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;

test('estado instalado v3 avança até v7 sem perder entidades operacionais', async () => {
  await fs.mkdir(root, { recursive: true });
  await Promise.allSettled(files.map((file) => fs.rm(file, { force: true })));
  const [{ db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente preservado da v3' });
    await db.insert(schema.projetos).values({
      id: projectId,
      clienteId: clientId,
      nome: 'Projeto preservado da v3',
      areaHa: 42.5,
      matricula: '12.345',
      municipio: 'Florianópolis',
    });
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      clienteId: clientId,
      projetoId: projectId,
      valorTotal: 125_000,
      status: 'rascunho',
    });
    await db.insert(schema.documentos).values({
      id: documentId,
      clienteId: clientId,
      projetoId: projectId,
      nome: 'memorial-v3.pdf',
      extensao: '.pdf',
      caminho: 'scratch/memorial-v3.pdf',
    });

    const count = async (table: 'clientes' | 'projetos' | 'orcamentos' | 'documentos') => {
      const result = await db.$client.execute('SELECT COUNT(*) total FROM ' + table);
      return Number(result.rows[0]?.total || 0);
    };
    const before = {
      clientes: await count('clientes'),
      projetos: await count('projetos'),
      orcamentos: await count('orcamentos'),
      documentos: await count('documentos'),
    };

    await db.$client.execute('PRAGMA user_version = 3');
    await db.$client.execute("UPDATE schema_migrations SET status = 'failed' WHERE version IN (4, 5, 6, 7)");
    const migrated = await runRuntimeMigrations();

    assert.equal(migrated.schemaVersion, 7);
    assert.deepEqual({
      clientes: await count('clientes'),
      projetos: await count('projetos'),
      orcamentos: await count('orcamentos'),
      documentos: await count('documentos'),
    }, before);
    assert.equal(Number((await db.$client.execute('PRAGMA user_version')).rows[0]?.user_version), 7);
    assert.equal((await db.$client.execute('PRAGMA quick_check')).rows[0]?.quick_check, 'ok');
    assert.equal((await db.$client.execute('PRAGMA foreign_key_check')).rows.length, 0);
    const migratedProperty = (await db.$client.execute({
      sql: 'SELECT id, cliente_id, matricula FROM propriedades WHERE cliente_id = ?',
      args: [clientId],
    })).rows;
    assert.equal(migratedProperty.length, 1);
    assert.equal(migratedProperty[0]?.matricula, '12.345');
    assert.equal(
      (await db.$client.execute({ sql: 'SELECT propriedade_id FROM projetos WHERE id = ?', args: [projectId] })).rows[0]?.propriedade_id,
      migratedProperty[0]?.id,
    );
    assert.equal(
      (await db.$client.execute({ sql: 'SELECT propriedade_id FROM orcamentos WHERE id = ?', args: [budgetId] })).rows[0]?.propriedade_id,
      migratedProperty[0]?.id,
    );
    assert.deepEqual(
      (await db.$client.execute('SELECT version, status FROM schema_migrations ORDER BY version')).rows
        .map((row) => [Number(row.version), row.status]),
      [[1, 'success'], [2, 'success'], [3, 'success'], [4, 'success'], [5, 'success'], [6, 'success'], [7, 'success']],
    );
  } finally {
    await closeDb();
    await Promise.allSettled(files.map((file) => fs.rm(file, { force: true })));
  }
});
