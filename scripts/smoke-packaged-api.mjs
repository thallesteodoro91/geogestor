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
const databaseKey = crypto.randomBytes(32).toString('base64');
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
    GEOGESTOR_DB_ENCRYPTION_KEY: databaseKey,
    GEOGESTOR_DATABASE_WORKER: path.join(path.dirname(serverPath), 'database-security-worker.js'),
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
  const lockedBeforeSetup = await fetch(`http://127.0.0.1:${port}/api/clientes`, { headers });
  if (lockedBeforeSetup.status !== 423) {
    throw new Error(`Rota operacional sem configuração deveria retornar HTTP 423; retornou ${lockedBeforeSetup.status}.`);
  }
  const password = `smoke-${crypto.randomBytes(12).toString('hex')}`;
  const setup = await fetch(`http://127.0.0.1:${port}/api/configuracoes`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      empresaNome: 'GeoGestor Smoke',
      dadosPasta: scratch,
      adminNome: 'Administrador de Teste',
      adminEmail: 'smoke@example.test',
      adminSenha: password
    })
  });
  if (!setup.ok) throw new Error(`Configuração inicial retornou HTTP ${setup.status}: ${await setup.text()}`);
  const unlocked = await fetch(`http://127.0.0.1:${port}/api/auth/unlock`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!unlocked.ok) throw new Error(`Desbloqueio retornou HTTP ${unlocked.status}: ${await unlocked.text()}`);
  const session = await unlocked.json();
  const operationalHeaders = { ...headers, 'x-local-session': session.token };
  for (const endpoint of ['/api/clientes', '/api/projetos', '/api/financeiro/orcamentos']) {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { headers: operationalHeaders });
    if (!response.ok) throw new Error(`${endpoint} retornou HTTP ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body) ? body : body?.data;
    if (!Array.isArray(rows) || rows.length !== 0) {
      throw new Error(`${endpoint} não iniciou vazio.`);
    }
  }
  const auditResponse = await fetch(`http://127.0.0.1:${port}/api/audit-logs`, { headers: operationalHeaders });
  if (!auditResponse.ok) throw new Error(`/api/audit-logs retornou HTTP ${auditResponse.status}`);
  const auditRows = await auditResponse.json();
  if (!Array.isArray(auditRows) || !auditRows.some((row) => row?.action === 'INSERT' && row?.entity === 'Configuração')) {
    throw new Error('A configuração inicial não gerou o registro de auditoria esperado.');
  }
  const serializedAudit = JSON.stringify(auditRows);
  for (const sensitiveValue of [password, token, session.token]) {
    if (serializedAudit.includes(sensitiveValue)) {
      throw new Error('O registro de auditoria expôs uma senha ou token sensível.');
    }
  }
  const databasePath = path.join(scratch, 'geogestor.db');
  if (!fs.existsSync(databasePath)) throw new Error('Banco inicial vazio não foi criado.');
  const databaseBytes = fs.readFileSync(databasePath);
  if (databaseBytes.subarray(0, 16).toString('ascii') === 'SQLite format 3\u0000') {
    throw new Error('O banco empacotado permaneceu em texto claro.');
  }
  if (databaseBytes.includes(Buffer.from('GeoGestor Smoke', 'utf8'))) {
    throw new Error('O banco empacotado expôs dados de teste em texto claro.');
  }
  console.log('Smoke test aprovado: API empacotada iniciou com banco criptografado, protegeu o acesso, manteve os dados operacionais vazios e auditou a configuração sem expor segredos.');
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  fs.rmSync(scratch, { recursive: true, force: true });
}
