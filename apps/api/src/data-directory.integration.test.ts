import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `data-directory-${process.pid}`);
const databaseRoot = path.resolve(process.cwd(), 'scratch', `data-directory-db-${process.pid}`);
const dbPath = path.join(databaseRoot, 'geogestor.db');
const currentRoot = path.join(testRoot, 'current-documents');
const copyRoot = path.join(testRoot, 'copied-documents');
const cancelledRoot = path.join(testRoot, 'cancelled-documents');
const relativeDocument = path.join('Clientes', 'Cliente Sintético', 'documento.txt');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('valida e copia a pasta de documentos sem quebrar os vínculos persistidos', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.rm(databaseRoot, { recursive: true, force: true });
  await fs.mkdir(path.dirname(path.join(currentRoot, relativeDocument)), { recursive: true });
  await fs.writeFile(path.join(currentRoot, relativeDocument), 'conteúdo preservado', 'utf8');

  const [{ runRuntimeMigrations }, { db, closeDb }, { schema }, { DataDirectoryService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./services/data-directory.service')
  ]);
  try {
    await runRuntimeMigrations();
    await db.insert(schema.configuracoes).values({
      id: 'config-directory',
      empresaNome: 'GeoGestor Teste',
      dadosPasta: currentRoot,
      adminNome: 'Administrador',
      adminEmail: 'admin@example.invalid',
      adminSenhaHash: 'scrypt:test:test',
      setupConcluido: true
    });
    await db.insert(schema.clientes).values({ id: 'client-directory', nome: 'Cliente Sintético' });
    await db.insert(schema.documentos).values({
      id: 'document-directory',
      clienteId: 'client-directory',
      categoria: 'Outros',
      nome: 'documento.txt',
      extensao: '.txt',
      caminho: path.join(currentRoot, relativeDocument),
      caminhoRelativo: relativeDocument,
      tamanhoBytes: 19
    });

    const preflight = await DataDirectoryService.preflight(copyRoot);
    assert.equal(preflight.canCopyOrMove, true);
    assert.equal(preflight.canUseExisting, false);
    assert.equal(preflight.current.files, 1);

    await assert.rejects(() => DataDirectoryService.migrate({
      targetDirectory: copyRoot,
      strategy: 'use',
      confirmation: 'ALTERAR PASTA DE DADOS DO GEOGESTOR'
    }), /não contém todos os documentos vinculados/i);

    const result = await DataDirectoryService.migrate({
      targetDirectory: copyRoot,
      strategy: 'copy',
      confirmation: 'ALTERAR PASTA DE DADOS DO GEOGESTOR'
    });
    assert.equal(result.changed, true);
    assert.equal(result.copiedFiles, 1);
    assert.ok('checksumFilesVerified' in result);
    assert.equal(result.checksumFilesVerified, 1);
    assert.equal(await fs.readFile(path.join(copyRoot, relativeDocument), 'utf8'), 'conteúdo preservado');
    assert.equal(await fs.readFile(path.join(currentRoot, relativeDocument), 'utf8'), 'conteúdo preservado');

    const [configuration] = await db.select().from(schema.configuracoes).where(eq(schema.configuracoes.id, 'config-directory'));
    const [document] = await db.select().from(schema.documentos).where(eq(schema.documentos.id, 'document-directory'));
    assert.equal(configuration.dadosPasta, copyRoot);
    assert.equal(document.caminho, path.join(copyRoot, relativeDocument));

    const secondRelativeDocument = path.join('Clientes', 'Cliente Sintético', 'segundo.txt');
    await fs.writeFile(path.join(copyRoot, secondRelativeDocument), 'segundo conteúdo', 'utf8');
    await db.insert(schema.documentos).values({
      id: 'document-directory-second',
      clienteId: 'client-directory',
      categoria: 'Outros',
      nome: 'segundo.txt',
      extensao: '.txt',
      caminho: path.join(copyRoot, secondRelativeDocument),
      caminhoRelativo: secondRelativeDocument,
      tamanhoBytes: 16
    });
    let cancelRequested = false;
    await assert.rejects(() => DataDirectoryService.migrate({
      targetDirectory: cancelledRoot,
      strategy: 'copy',
      confirmation: 'ALTERAR PASTA DE DADOS DO GEOGESTOR',
      shouldCancel: () => cancelRequested,
      onProgress: ({ processedFiles }) => { if (processedFiles === 0) cancelRequested = true; }
    }), /cancelada/i);
    const cancelledFiles = await fs.readdir(cancelledRoot, { recursive: true }).catch(() => []);
    assert.equal(cancelledFiles.filter((entry) => path.extname(String(entry))).length, 0);
    const [configurationAfterCancel] = await db.select().from(schema.configuracoes).where(eq(schema.configuracoes.id, 'config-directory'));
    assert.equal(configurationAfterCancel.dadosPasta, copyRoot);
  } finally {
    await closeDb();
  }
});
