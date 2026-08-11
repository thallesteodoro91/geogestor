import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), 'scratch', `maintenance-history-${process.pid}`);
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.join(root, 'geogestor.db');

test('histórico operacional filtra, exporta CSV e redige caminhos e segredos', async () => {
  await fs.rm(root, { recursive: true, force: true });
  const { MaintenanceHistoryService } = await import('./services/maintenance-history.service');
  await MaintenanceHistoryService.record({
    type: 'diagnostic_export',
    status: 'success',
    startedAt: '2026-08-08T12:00:00.000Z',
    completedAt: '2026-08-08T12:00:01.000Z',
    sourceLabel: 'C:\\Users\\Pessoa\\dados-secretos',
    destinationLabel: 'C:\\Users\\Pessoa\\diagnostico.json',
    files: 1,
    bytes: 100,
    user: 'admin',
    auditId: 'audit-1',
    details: { token: 'segredo', note: 'arquivo em C:\\Users\\Pessoa\\privado.txt' }
  });
  await MaintenanceHistoryService.record({
    type: 'restore_test',
    status: 'failed',
    startedAt: '2026-08-08T13:00:00.000Z',
    sourceLabel: 'backup local',
    destinationLabel: 'área isolada',
    files: 2,
    bytes: 200,
    user: 'admin',
    auditId: null,
    error: new Error('Falha em C:\\Users\\Pessoa\\backup com token=abc123')
  });

  const filtered = await MaintenanceHistoryService.list({ status: 'failed' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.type, 'restore_test');
  assert.doesNotMatch(filtered[0]?.error || '', /Users\\Pessoa|abc123/);

  const raw = await fs.readFile(MaintenanceHistoryService.getPathForTests(), 'utf8');
  assert.doesNotMatch(raw, /dados-secretos|segredo|privado\.txt|abc123/);
  const csv = await MaintenanceHistoryService.exportCsv();
  assert.match(csv, /Diagn|diagnostic_export/);
  assert.doesNotMatch(csv, /Users\\Pessoa|abc123/);
});
