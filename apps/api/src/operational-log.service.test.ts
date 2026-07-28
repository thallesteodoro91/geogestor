import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), 'scratch', `operational-log-${process.pid}`);
const logPath = path.join(root, 'logs', 'operational.ndjson');
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.join(root, 'geogestor.db');

function actualFileSystem() {
  return {
    mkdir: fs.mkdir,
    appendFile: fs.appendFile,
    stat: fs.stat,
    rm: fs.rm,
    rename: fs.rename,
    readFile: fs.readFile,
    writeFile: fs.writeFile
  };
}

test('logger usa lote limitado, preserva eventos obrigatórios e remove dados sensíveis', async () => {
  await fs.rm(root, { recursive: true, force: true });
  const { OperationalLogService } = await import('./services/operational-log.service');
  OperationalLogService.resetForTests();
  OperationalLogService.configureForTests({ options: { batchSize: 500, queueCapacity: 250, flushIntervalMs: 60_000 } });

  await Promise.all(Array.from({ length: 200 }, (_, index) => OperationalLogService.info('synthetic-read', { index })));
  assert.equal(OperationalLogService.getStatistics().queueDepth, 200);
  await OperationalLogService.flush();
  let raw = await fs.readFile(logPath, 'utf8');
  assert.equal(raw.trim().split(/\r?\n/).length, 200);
  assert.equal(OperationalLogService.getStatistics().batches, 1);

  OperationalLogService.resetForTests();
  let releaseSlowWrite: () => void = () => undefined;
  let markSlowWriteStarted: () => void = () => undefined;
  const slowWriteStarted = new Promise<void>((resolve) => { markSlowWriteStarted = resolve; });
  const slowWriteRelease = new Promise<void>((resolve) => { releaseSlowWrite = resolve; });
  OperationalLogService.configureForTests({
    fileSystem: {
      ...actualFileSystem(),
      appendFile: async (...args: Parameters<typeof fs.appendFile>) => {
        markSlowWriteStarted();
        await slowWriteRelease;
        return fs.appendFile(...args);
      }
    },
    options: { batchSize: 2, queueCapacity: 3, flushIntervalMs: 60_000 }
  });
  await Promise.all(Array.from({ length: 20 }, (_, index) => OperationalLogService.info('slow-disk-read', { index })));
  await slowWriteStarted;
  assert.ok(OperationalLogService.getStatistics().queueDepth <= 3);
  assert.ok(OperationalLogService.getStatistics().dropped >= 15);
  releaseSlowWrite();
  await OperationalLogService.shutdown();

  OperationalLogService.resetForTests();
  OperationalLogService.configureForTests({ options: { batchSize: 100, queueCapacity: 3, flushIntervalMs: 60_000 } });
  await Promise.all(Array.from({ length: 5 }, (_, index) => OperationalLogService.info('saturating-read', { index })));
  assert.equal(OperationalLogService.getStatistics().queueDepth, 3);
  assert.equal(OperationalLogService.getStatistics().dropped, 2);

  await OperationalLogService.error('synthetic-failure', {
    requestId: 'req-1',
    cpf: '529.982.247-25',
    token: 'segredo-token',
    nested: { email: 'pessoa@example.com' },
    filename: 'contrato-confidencial.pdf',
    error: new Error('Falha em C:\\Dados\\cliente\\contrato-confidencial.pdf params: pessoa@example.com, 52998224725')
  });
  raw = await fs.readFile(logPath, 'utf8');
  assert.match(raw, /synthetic-failure/);
  assert.doesNotMatch(raw, /pessoa@example\.com|529\.982|52998224725|segredo-token|contrato-confidencial|C:\\\\Dados/);
  const requiredEntry = raw.trim().split(/\r?\n/).map((line) => JSON.parse(line) as { event: string; data: Record<string, unknown> })
    .find((entry) => entry.event === 'synthetic-failure');
  assert.equal(requiredEntry?.data.cpf, '[REDACTED]');
  assert.equal(requiredEntry?.data.token, '[REDACTED]');

  OperationalLogService.resetForTests();
  OperationalLogService.configureForTests({ options: { maxLogBytes: 1, maxLogFiles: 2 } });
  await OperationalLogService.writeRequired('rotation-first', { safe: true });
  await OperationalLogService.writeRequired('rotation-second', { safe: true });
  assert.equal((await fs.stat(`${logPath}.1`)).isFile(), true);
  assert.match(await fs.readFile(logPath, 'utf8'), /rotation-second/);

  OperationalLogService.resetForTests();
  OperationalLogService.configureForTests({
    fileSystem: {
      ...actualFileSystem(),
      appendFile: async () => {
        throw Object.assign(new Error('disco sintético indisponível'), { code: 'EIO' });
      }
    },
    options: { flushIntervalMs: 60_000 }
  });
  await OperationalLogService.info('non-blocking-disk-failure');
  await assert.rejects(OperationalLogService.flush(), /disco sintético indisponível/);
  assert.equal(OperationalLogService.getStatistics().writeFailures, 1);
  await assert.rejects(OperationalLogService.writeRequired('required-disk-failure'), /disco sintético indisponível/);
  assert.equal(OperationalLogService.getStatistics().writeFailures, 2);

  OperationalLogService.resetForTests();
  OperationalLogService.configureForTests({ options: { flushIntervalMs: 60_000 } });
  await OperationalLogService.info('shutdown-flush');
  await OperationalLogService.shutdown();
  assert.match(await fs.readFile(logPath, 'utf8'), /shutdown-flush/);
  OperationalLogService.resetForTests();
});
