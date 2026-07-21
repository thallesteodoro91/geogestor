import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = path.join(rootDir, 'apps', 'desktop', 'dist', 'win-unpacked', 'resources', 'api', 'server.js');
if (!fs.existsSync(serverPath)) throw new Error(`API empacotada ausente: ${serverPath}`);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'geogestor-package-smoke-'));
const token = crypto.randomBytes(32).toString('hex');
const port = 41_000 + crypto.randomInt(1_000);
const output = [];
const child = spawn(process.execPath, [serverPath], {
  cwd: path.dirname(serverPath),
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    GEOGESTOR_API_TOKEN: token,
    GEOGESTOR_SECRET_KEY: crypto.randomBytes(32).toString('base64'),
    GEOGESTOR_DB_PATH: path.join(scratch, 'geogestor.db'),
    NODE_PATH: path.join(path.dirname(serverPath), 'native_modules')
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.on('data', (chunk) => output.push(String(chunk)));
child.stderr.on('data', (chunk) => output.push(String(chunk)));

const headers = { Authorization: `Bearer ${token}` };
async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API encerrou prematuramente. ${output.join('').slice(-4_000)}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timeout ao iniciar API empacotada. ${output.join('').slice(-4_000)}`);
}

try {
  await waitForHealth();
  for (const endpoint of ['/api/clientes', '/api/projetos', '/api/financeiro/orcamentos', '/api/audit-logs']) {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { headers });
    if (!response.ok) throw new Error(`${endpoint} retornou HTTP ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body) ? body : body?.data;
    if (!Array.isArray(rows) || rows.length !== 0) {
      throw new Error(`${endpoint} não iniciou vazio.`);
    }
  }
  if (!fs.existsSync(path.join(scratch, 'geogestor.db'))) throw new Error('Banco inicial vazio não foi criado.');
  console.log('Smoke test aprovado: API empacotada iniciou e todas as tabelas operacionais consultadas estão vazias.');
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  fs.rmSync(scratch, { recursive: true, force: true });
}
