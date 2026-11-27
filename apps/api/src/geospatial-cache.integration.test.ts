import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.join(os.tmpdir(), `geogestor-cache-${process.pid}`);
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.join(testRoot, 'geogestor.db');

test('cache informa arquivos ativos e remove somente arquivos órfãos', async () => {
  const cacheDir = path.join(testRoot, '.geogestor', 'cache', 'geospatial');
  await fs.mkdir(cacheDir, { recursive: true });
  const activePath = path.join(cacheDir, 'active.geojson');
  const orphanPath = path.join(cacheDir, 'orphan.geojson');
  const originalPath = path.join(testRoot, 'original.geojson');
  await Promise.all([
    fs.writeFile(activePath, Buffer.alloc(1024)),
    fs.writeFile(orphanPath, Buffer.alloc(2048)),
    fs.writeFile(originalPath, Buffer.from('original'))
  ]);
  const [{ runRuntimeMigrations }, { db, closeDb }, { schema }, { GeospatialImportService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./services/geospatial/geospatial-import.service')
  ]);
  try {
    await runRuntimeMigrations();
    await db.insert(schema.clientes).values({ id: 'cliente-cache', nome: 'Cliente cache' });
    await db.insert(schema.documentos).values({ id: 'documento-cache', clienteId: 'cliente-cache', nome: 'Original', extensao: '.geojson', caminho: originalPath });
    await db.insert(schema.camadasGeoespaciais).values({ id: 'camada-cache', clienteId: 'cliente-cache', documentoId: 'documento-cache', nome: 'Camada', formato: 'geojson', status: 'ready', caminhoCache: activePath });

    const status = await GeospatialImportService.cacheMaintenance(testRoot);
    assert.deepEqual({ activeFiles: status.activeFiles, activeBytes: status.activeBytes, orphanCount: status.orphanCount, orphanBytes: status.orphanBytes },
      { activeFiles: 1, activeBytes: 1024, orphanCount: 1, orphanBytes: 2048 });
    const cleaned = await GeospatialImportService.cacheMaintenance(testRoot, true);
    assert.equal(cleaned.removedFiles, 1);
    await assert.rejects(fs.stat(orphanPath), { code: 'ENOENT' });
    assert.equal((await fs.stat(activePath)).size, 1024);
    assert.equal((await fs.readFile(originalPath, 'utf8')), 'original');
  } finally {
    await closeDb();
  }
});
