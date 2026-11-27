import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

const workspace = process.cwd();
const root = path.join(workspace, 'scratch', `qa-restart-${process.pid}-${crypto.randomUUID()}`);
const tsx = createRequire(path.join(workspace, 'apps/api/package.json')).resolve('tsx');
const token = `qa-restart-${crypto.randomUUID()}`;
const active = new Set<ChildProcess>();
type Checkpoint = { phase: string; error?: string; importId?: string; payload?: Record<string, unknown>; bundle?: string; recoveryCode?: string; backupMs?: number; restoreMs?: number };

function spawnChild(entry: string, args: string[], directory: string, extra: Record<string, string> = {}) {
  const child = spawn(process.execPath, ['--import', pathToFileURL(tsx).href, path.join(workspace, entry), ...args], {
    cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, NODE_ENV: 'test', GEOGESTOR_DB_PATH: path.join(directory, 'geogestor.db'), GEOGESTOR_E2E_ROOT: directory, GEOGESTOR_API_TOKEN: token, GEOGESTOR_DISABLE_SCHEDULER: '1', GEOGESTOR_REQUIRE_UNLOCK: '0', ...extra }
  });
  active.add(child);
  child.once('exit', () => active.delete(child));
  let output = '';
  child.stdout?.on('data', data => { output = `${output}${data}`.slice(-16_000); });
  child.stderr?.on('data', data => { output = `${output}${data}`.slice(-16_000); });
  return { child, output: () => output };
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  child.kill('SIGKILL');
  await exited;
}

async function checkpoint(mode: string, directory: string, extra: Record<string, string> = {}) {
  const instance = spawnChild('apps/api/src/test-support/import-restart-child.ts', [mode], directory, extra);
  const message = await new Promise<Checkpoint>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Checkpoint ${mode} excedeu 60s. ${instance.output()}`)), 60_000);
    instance.child.once('message', data => { clearTimeout(timer); const value = data as Checkpoint; if (value.phase === 'error') reject(new Error(value.error)); else resolve(value); });
    instance.child.once('error', error => { clearTimeout(timer); reject(error); });
    instance.child.once('exit', code => { clearTimeout(timer); reject(new Error(`Auxiliar encerrou (${code}). ${instance.output()}`)); });
  });
  return { ...instance, message };
}

async function startApi(directory: string, extra: Record<string, string> = {}) {
  const port = await new Promise<number>((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const address = socket.address() as net.AddressInfo; socket.close(error => error ? reject(error) : resolve(address.port)); });
  });
  const instance = spawnChild('apps/api/src/server.ts', [], directory, { PORT: String(port), ...extra });
  const request = async (route: string, payload?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { method: payload ? 'POST' : 'GET', headers: { 'x-api-token': token, ...(payload ? { 'content-type': 'application/json' } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : { text: await response.text() };
    return { status: response.status, body: body as Record<string, unknown> };
  };
  for (const started = Date.now(); Date.now() - started < 60_000;) {
    if (instance.child.exitCode !== null) throw new Error(instance.output());
    try { if ((await request('/api/ready')).status === 200) return { ...instance, request }; } catch { /* aguardar porta local */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`API não iniciou: ${instance.output()}`);
}

async function terminal(api: Awaited<ReturnType<typeof startApi>>, importId: string) {
  for (const started = Date.now(); Date.now() - started < 30_000;) {
    const response = await api.request(`/api/importacoes/${importId}`);
    if (!['ready', 'queued', 'validating', 'processing'].includes(String(response.body.status))) return response.body;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('A importação não chegou a um estado terminal.');
}

test('interrupções reais do processo preservam importação e recuperação entre perfis', { timeout: 240_000 }, async t => {
  await fs.mkdir(root, { recursive: true });
  try {
    for (const mode of ['queued', 'transaction', 'committed']) {
      await t.test(`interrupção em ${mode}`, async () => {
        const directory = path.join(root, mode);
        const interrupted = await checkpoint(mode, directory);
        const { importId, payload } = interrupted.message;
        assert.ok(importId && payload);
        await stop(interrupted.child);
        const api = await startApi(directory);
        const result = await terminal(api, importId);
        const client = createClient({ url: `file:${path.join(directory, 'geogestor.db')}` });
        try {
          const count = async (table: string) => Number((await client.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
          if (mode === 'transaction') {
            assert.equal(result.status, 'failed');
            assert.equal(result.stage, 'Interrompido');
            for (const table of ['clientes', 'propriedades', 'projetos', 'orcamentos', 'notas_fiscais', 'despesas', 'filesystem_operations']) assert.equal(await count(table), 0, `${table} precisa voltar a zero`);
            const ledgers = await client.execute("SELECT chave FROM configuracoes_operacionais WHERE chave LIKE 'full-spreadsheet-import:%' OR chave LIKE 'full-spreadsheet-content:%'");
            assert.equal(ledgers.rows.length, 0);
          } else {
            for (const table of ['clientes', 'propriedades', 'projetos', 'orcamentos', 'notas_fiscais', 'despesas']) assert.equal(await count(table), 1, `${table}: exatamente um registro`);
            assert.equal((await client.execute('SELECT valor FROM notas_fiscais')).rows[0].valor, 105000);
            assert.equal((await client.execute('SELECT valor FROM despesas')).rows[0].valor, 7500);
            assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
            const links = await client.execute(`SELECT p.id FROM projetos p
              JOIN clientes c ON c.id = p.cliente_id
              JOIN propriedades i ON i.id = p.propriedade_id AND i.cliente_id = c.id
              JOIN orcamentos o ON o.projeto_id = p.id AND o.cliente_id = c.id
              JOIN notas_fiscais n ON n.projeto_id = p.id AND n.orcamento_id = o.id AND n.cliente_id = c.id
              JOIN despesas d ON d.projeto_id = p.id AND d.cliente_id = c.id`);
            assert.equal(links.rows.length, 1, 'os vínculos precisam apontar para os mesmos registros');
            if (mode === 'queued') assert.match(String(result.status), /^completed/);
            else {
              assert.equal(result.status, 'failed');
              assert.equal(result.stage, 'Interrompido');
              assert.match(JSON.stringify(result.error), /não pôde ser confirmado/);
            }
          }
          const repeated = await api.request('/api/importacoes/migracao-completa/preview', payload);
          assert.equal(repeated.status, 200);
          assert.equal(repeated.body.status, mode === 'transaction' ? 'ready' : 'already_imported');
          if (mode === 'transaction') {
            const retry = await api.request('/api/importacoes/migracao-completa/confirmar', { ...payload, previewId: repeated.body.previewId });
            assert.equal(retry.status, 202, JSON.stringify(retry.body));
            assert.match(String((await terminal(api, String(retry.body.importId))).status), /^completed/);
            assert.equal(await count('clientes'), 1);
          }
          console.log('[QA-SIMULATION]', JSON.stringify({ mode, checkpoint: 'actual-process-killed', recoveredStatus: result.status, repeatedPreview: repeated.body.status }));
        } finally { client.close(); await stop(api.child); }
      });
    }
    await t.test('backup portátil passa de um processo e chave para outro', async () => {
      const source = await checkpoint('backup', path.join(root, 'profile-a'), { GEOGESTOR_DB_ENCRYPTION_KEY: Buffer.alloc(32, 81).toString('base64'), GEOGESTOR_BACKUP_RECOVERY_KEY: Buffer.alloc(32, 82).toString('base64') });
      await stop(source.child);
      assert.ok(source.message.bundle && source.message.recoveryCode);
      const target = await checkpoint('restore', path.join(root, 'profile-b'), { GEOGESTOR_DB_ENCRYPTION_KEY: Buffer.alloc(32, 83).toString('base64'), GEOGESTOR_BACKUP_RECOVERY_KEY: '', QA_BUNDLE: source.message.bundle, QA_RECOVERY_CODE: source.message.recoveryCode });
      await stop(target.child);
      assert.equal(target.message.phase, 'restored');
      const targetDirectory = path.join(root, 'profile-b');
      const reopened = await startApi(targetDirectory, { GEOGESTOR_DB_ENCRYPTION_KEY: Buffer.alloc(32, 83).toString('base64'), GEOGESTOR_BACKUP_RECOVERY_KEY: '' });
      const configuration = await reopened.request('/api/configuracoes');
      assert.equal(configuration.status, 200);
      assert.equal(configuration.body.empresaNome, 'Empresa fictícia QA — não usar em produção');
      assert.equal(configuration.body.dadosPasta, path.join(targetDirectory, 'documents'));
      assert.equal((await reopened.request('/api/clientes')).status, 200);
      const document = await reopened.request(`/api/arquivos/download?path=${encodeURIComponent(path.join(targetDirectory, 'documents', 'documento.txt'))}`);
      assert.equal(document.status, 200);
      assert.equal(document.body.text, 'Documento fictício preservado entre perfis.');
      await stop(reopened.child);
      console.log('[QA-SIMULATION]', JSON.stringify({ profiles: 'separate-processes-and-keys-on-same-Windows', backupMs: source.message.backupMs, restoreMs: target.message.restoreMs }));
    });
  } finally {
    await Promise.all([...active].map(stop));
    // Evidência sintética preservada; nenhum diretório histórico é removido.
    console.log('[QA-SIMULATION] evidence', root);
  }
});
