import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { initDb } from '@geogestor/database';
import { sql } from 'drizzle-orm';
test('processo interrompido após aceitação remota retoma o journal sem duplicar', async () => {
  const directory = path.resolve('scratch', `calendar-restart-${process.pid}-${crypto.randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  const req = createRequire(path.resolve('apps/api/package.json'));
  const loader = pathToFileURL(req.resolve('tsx')).href;
  const id = crypto.randomUUID();
  const start = (mode: string) => spawn(process.execPath, ['--import', loader, path.resolve('apps/api/src/test-support/calendar-restart-child.ts'), mode, directory, id], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'test' } });
  const child = start('interrupt');
  let errorOutput = ''; child.stderr!.on('data', chunk => { errorOutput += chunk; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Sem aceitação remota: ${errorOutput}`)), 30000);
      child.once('message', () => { clearTimeout(timer); resolve(); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Processo antecipadamente encerrado (${code}): ${errorOutput}`)); });
    });
    const stopped = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await stopped;
    const database = initDb(path.join(directory, 'qa.db')); await database.ready;
    const rows = await database.db.all(sql`SELECT state_json FROM google_calendar_sync`);
    assert.ok(JSON.parse(String((rows[0] as { state_json: string }).state_json)).pending);
    // Clock expiry is advanced explicitly; the process interruption itself is real.
    await database.db.run(sql`UPDATE google_calendar_sync_lease SET expires_at=0`); database.close();
    const recovered = start('recover'); recovered.stderr!.on('data', chunk => { errorOutput += chunk; });
    const code = await new Promise<number | null>(resolve => recovered.once('exit', resolve)); assert.equal(code, 0, errorOutput);
    const result = JSON.parse(await fs.readFile(path.join(directory, 'recovered.json'), 'utf8'));
    assert.equal(result.localCount, 1); assert.equal(result.remoteCount, 1); assert.equal(result.remoteId, result.acceptedId);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
});
