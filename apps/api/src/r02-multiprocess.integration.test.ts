import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';
import { initDb, schema } from '@geogestor/database';
import { mutationRecordPath } from '@geogestor/contracts/src/record-concurrency';

const workspaceRoot = path.resolve(process.cwd());
const testRoot = path.join(workspaceRoot, 'scratch', `run-r02-multiprocess-${process.pid}-${crypto.randomUUID()}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const apiToken = `r02-${crypto.randomUUID()}`;
const requireFromApi = createRequire(path.join(workspaceRoot, 'apps', 'api', 'package.json'));
const tsxCli = requireFromApi.resolve('tsx/cli');
const apiEntry = path.join(workspaceRoot, 'apps', 'api', 'src', 'server.ts');

type ApiProcess = {
  child: ChildProcess;
  port: number;
  output: () => string;
};

async function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const socket = net.createServer();
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (!address || typeof address === 'string') {
        socket.close();
        reject(new Error('Não foi possível reservar uma porta para o teste multiprocesso.'));
        return;
      }
      socket.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForReady(api: ApiProcess) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (api.child.exitCode !== null) {
      throw new Error(`API ${api.port} encerrou durante a inicialização.\n${api.output()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${api.port}/api/ready`, {
        headers: { 'x-api-token': apiToken }
      });
      if (response.ok) return;
    } catch {
      // O processo ainda está inicializando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Tempo esgotado aguardando a API ${api.port}.\n${api.output()}`);
}

async function startApi(label: string): Promise<ApiProcess> {
  const port = await availablePort();
  const chunks: string[] = [];
  const child = spawn(process.execPath, [tsxCli, apiEntry], {
    cwd: workspaceRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      GEOGESTOR_API_TOKEN: apiToken,
      GEOGESTOR_DB_PATH: databasePath,
      GEOGESTOR_E2E_ROOT: testRoot,
      GEOGESTOR_DISABLE_SCHEDULER: '1',
      GEOGESTOR_REQUIRE_UNLOCK: '0'
    }
  });
  child.stdout?.on('data', (chunk) => chunks.push(`[${label}:out] ${String(chunk)}`));
  child.stderr?.on('data', (chunk) => chunks.push(`[${label}:err] ${String(chunk)}`));
  const api = { child, port, output: () => chunks.join('') };
  await waitForReady(api);
  return api;
}

async function stopApi(api: ApiProcess | undefined) {
  if (!api || api.child.exitCode !== null) return;
  if (api.child.connected) api.child.send({ type: 'geogestor:e2e-shutdown' });
  else api.child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => api.child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 8_000))
  ]);
  if (api.child.exitCode === null) api.child.kill('SIGKILL');
}

async function request(
  api: ApiProcess,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  route: string,
  body?: unknown, extraHeaders: Record<string, string> = {}
) {
  const recordPath = mutationRecordPath(route);
  if (recordPath && ['PATCH', 'PUT', 'DELETE'].includes(method) && !extraHeaders['x-record-version']) {
    const current = await request(api, 'GET', `/api/edicao/atual?path=${encodeURIComponent(recordPath)}`);
    if (current.status === 200) extraHeaders = { ...extraHeaders, 'x-record-version': current.json<{ updatedAt: string }>().updatedAt };
  }
  const response = await fetch(`http://127.0.0.1:${api.port}${route}`, {
    method,
    headers: {
      'x-api-token': apiToken,
      ...extraHeaders,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    json: <T>() => JSON.parse(text) as T
  };
}

test('R02 preserva invariantes em dois processos sobre um SQLite descartável', async (t) => {
  await fs.mkdir(testRoot, { recursive: true });
  let firstApi: ApiProcess | undefined;
  let secondApi: ApiProcess | undefined;
  let closeDatabase: (() => void) | undefined;

  try {
    firstApi = await startApi('api-a');
    secondApi = await startApi('api-b');

    const database = initDb(databasePath);
    closeDatabase = database.close;
    await database.ready;
    const db = database.db;
    const clientA = crypto.randomUUID();
    const clientB = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const installmentId = crypto.randomUUID();
    const referenceDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'QA-R02-Cliente A', situacao: 'Ativo' },
      { id: clientB, nome: 'QA-R02-Cliente B', situacao: 'Ativo' }
    ]);
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      clienteId: clientA,
      descricao: 'QA-R02-Contrato concorrente',
      valorTotal: 10_000,
      status: 'aprovado',
      dataOrcamento: referenceDate
    });
    await db.insert(schema.parcelas).values({
      id: installmentId,
      orcamentoId: budgetId,
      valor: 10_000,
      valorPago: 0,
      dataVencimento: referenceDate,
      statusPagamento: 'Pendente'
    });

    await t.test('a unicidade normalizada vale entre processos', async () => {
      const payload = (clienteId: string, nome: string, matricula: string) => ({
        clienteId,
        nome,
        matricula,
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      const attempts = await Promise.all([
        request(firstApi!, 'POST', '/api/dados-operacionais/propriedades', payload(clientA, 'QA-R02-Imóvel A', 'R02.123/ABC')),
        request(secondApi!, 'POST', '/api/dados-operacionais/propriedades', payload(clientB, 'QA-R02-Imóvel B', ' r02 123 abc '))
      ]);
      assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [201, 409], attempts.map((attempt) => attempt.text).join('\n'));
      const active = await db.select().from(schema.propriedades).where(and(
        eq(schema.propriedades.matriculaNormalizada, 'R02123ABC'),
        isNull(schema.propriedades.deletedAt)
      ));
      assert.equal(active.length, 1);
    });

    await t.test('uma gravação aguarda o lock temporário e conclui sem corromper o banco', async () => {
      const rawClient = (db as unknown as { $client: { execute: (sql: string) => Promise<unknown> } }).$client;
      await rawClient.execute('BEGIN IMMEDIATE;');
      const pending = request(firstApi!, 'POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientA,
        nome: 'QA-R02-Após lock',
        matricula: 'R02-LOCK-001',
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
      await rawClient.execute('COMMIT;');
      const result = await pending;
      assert.equal(result.status, 201, result.text);
    });

    await t.test('uma leitura mantém a última visão confirmada enquanto outro processo escreve', async () => {
      const created = await request(firstApi!, 'POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientA,
        nome: 'QA-R02-Leitura durante escrita',
        matricula: 'R02-READ-001',
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      assert.equal(created.status, 201, created.text);
      const propertyId = created.json<{ id: string }>().id;
      const rawClient = (db as unknown as { $client: { execute: (sql: string) => Promise<unknown> } }).$client;
      await rawClient.execute('BEGIN IMMEDIATE;');
      try {
        await rawClient.execute(`UPDATE propriedades SET observacoes = 'ainda não confirmado' WHERE id = '${propertyId}';`);
        const read = await request(secondApi!, 'GET', `/api/dados-operacionais/propriedades/${propertyId}`);
        assert.equal(read.status, 200, read.text);
        assert.notEqual(read.json<{ observacoes: string | null }>().observacoes, 'ainda não confirmado');
      } finally {
        await rawClient.execute('ROLLBACK;');
      }
      const readAfterRollback = await request(firstApi!, 'GET', `/api/dados-operacionais/propriedades/${propertyId}`);
      assert.equal(readAfterRollback.status, 200, readAfterRollback.text);
      assert.notEqual(readAfterRollback.json<{ observacoes: string | null }>().observacoes, 'ainda não confirmado');
    });

    let policyPropertyId = '';
    await t.test('edições simultâneas nunca produzem estado mesclado ou parcial', async () => {
      const created = await request(firstApi!, 'POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientA,
        nome: 'QA-R02-Política pendente',
        matricula: 'R02-POLICY-001',
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      assert.equal(created.status, 201, created.text);
      const propertyId = created.json<{ id: string }>().id;
      policyPropertyId = propertyId;
      const frozenToken = created.json<{ editToken: string }>().editToken;
      const candidates = ['Edição do processo A', 'Edição do processo B'];
      const attempts = await Promise.all([
        request(firstApi!, 'PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, { observacoes: candidates[0] }, { 'if-match': frozenToken }),
        request(secondApi!, 'PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, { observacoes: candidates[1] }, { 'if-match': frozenToken })
      ]);
      assert.ok(attempts.every((attempt) => [200, 409].includes(attempt.status)), attempts.map((attempt) => attempt.text).join('\n'));
      assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [200, 409]);
      const finalState = await request(firstApi!, 'GET', `/api/dados-operacionais/propriedades/${propertyId}`);
      assert.equal(finalState.status, 200, finalState.text);
      assert.ok(candidates.includes(finalState.json<{ observacoes: string }>().observacoes));
    });

    await t.test('reatribuição e exclusão simultâneas não deixam registro ativo incoerente', async () => {
      const created = await request(firstApi!, 'POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientA,
        nome: 'QA-R02-Reatribuição ou exclusão',
        matricula: 'R02-RACE-001',
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      assert.equal(created.status, 201, created.text);
      const propertyId = created.json<{ id: string }>().id;
      const attempts = await Promise.all([
        request(firstApi!, 'PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, { clienteId: clientB }, { 'if-match': created.json<{ editToken: string }>().editToken }),
        request(secondApi!, 'DELETE', `/api/dados-operacionais/propriedades/${propertyId}`, undefined, { 'if-match': created.json<{ editToken: string }>().editToken })
      ]);
      assert.ok([200, 404, 409].includes(attempts[0].status), attempts[0].text);
      assert.ok([204, 404, 409].includes(attempts[1].status), attempts[1].text);
      const [stored] = await db.select().from(schema.propriedades).where(eq(schema.propriedades.id, propertyId));
      assert.ok(stored);
      if (stored.deletedAt === null) assert.equal(stored.clienteId, clientB);
      const read = await request(secondApi!, 'GET', `/api/dados-operacionais/propriedades/${propertyId}`);
      assert.equal(read.status, stored.deletedAt === null ? 200 : 404, read.text);
    });

    await t.test('duas liquidações não ultrapassam o principal nem envenenam conexões', async () => {
      const payload = { valorPrincipal: 6_000, dataRecebimento: referenceDate };
      const attempts = await Promise.all([
        request(firstApi!, 'POST', `/api/financeiro/parcelas/${installmentId}/recebimentos`, payload),
        request(secondApi!, 'POST', `/api/financeiro/parcelas/${installmentId}/recebimentos`, payload)
      ]);
      assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [201, 409], attempts.map((attempt) => attempt.text).join('\n'));
      const receipts = await db.select().from(schema.recebimentos).where(and(
        eq(schema.recebimentos.parcelaId, installmentId),
        isNull(schema.recebimentos.deletedAt),
        isNull(schema.recebimentos.estornadoEm)
      ));
      assert.equal(receipts.reduce((sum, receipt) => sum + receipt.valorPrincipal, 0), 6_000);
      const reads = await Promise.all([
        request(firstApi!, 'GET', `/api/dados-operacionais/propriedades/${policyPropertyId}`),
        request(secondApi!, 'GET', `/api/dados-operacionais/propriedades/${policyPropertyId}`)
      ]);
      assert.deepEqual(reads.map((result) => result.status), [200, 200], reads.map((result) => result.text).join('\n'));
    });

    await t.test('mutação durante o snapshot produz uma cópia íntegra, anterior ou posterior', async () => {
      const results = await Promise.all([
        request(firstApi!, 'POST', '/api/sistema/backup'),
        request(secondApi!, 'POST', '/api/dados-operacionais/propriedades', {
          clienteId: clientA,
          nome: 'QA-R02-Snapshot concorrente',
          matricula: 'R02-SNAPSHOT-001',
          municipio: 'Florianópolis',
          uf: 'SC'
        })
      ]);
      assert.equal(results[0].status, 200, results[0].text);
      assert.equal(results[1].status, 201, results[1].text);
      const { bundlePath } = results[0].json<{ bundlePath: string }>();
      const resolvedBundle = path.resolve(bundlePath);
      assert.ok(resolvedBundle.startsWith(`${path.resolve(testRoot)}${path.sep}`), resolvedBundle);
      const snapshot = initDb(path.join(resolvedBundle, 'database.db'));
      try {
        await snapshot.ready;
        const copied = await snapshot.db.select().from(schema.propriedades).where(
          eq(schema.propriedades.matriculaNormalizada, 'R02SNAPSHOT001')
        );
        assert.ok(copied.length <= 1);
        if (copied.length === 1) {
          assert.equal(copied[0].nome, 'QA-R02-Snapshot concorrente');
          assert.equal(copied[0].clienteId, clientA);
        }
        const integrity = await (snapshot.db as unknown as { $client: { execute: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }> } }).$client.execute('PRAGMA quick_check;');
        assert.equal(Object.values(integrity.rows[0] || {})[0], 'ok');
      } finally {
        snapshot.close();
      }
    });

    await t.test('ativação simultânea de ciclos conserva no máximo um ativo', async () => {
      const firstCycleId = crypto.randomUUID();
      const secondCycleId = crypto.randomUUID();
      const endDate = new Date(`${referenceDate}T12:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 365);
      await db.insert(schema.ciclosEstrategicos).values([firstCycleId, secondCycleId].map((id, index) => ({
        id, nome: `QA-R02-Ciclo ${index + 1}`, dataInicio: referenceDate,
        dataFim: endDate.toISOString().slice(0, 10), visao: 'Teste de exclusividade', status: 'rascunho'
      })));
      const attempts = await Promise.all([
        request(firstApi!, 'PATCH', `/api/planejamento/ciclos/${firstCycleId}`, { status: 'ativo' }),
        request(secondApi!, 'PATCH', `/api/planejamento/ciclos/${secondCycleId}`, { status: 'ativo' })
      ]);
      assert.ok(attempts.every((attempt) => [200, 409].includes(attempt.status)), attempts.map((attempt) => attempt.text).join('\n'));
      const active = await db.select().from(schema.ciclosEstrategicos).where(and(
        eq(schema.ciclosEstrategicos.status, 'ativo'), isNull(schema.ciclosEstrategicos.deletedAt)
      ));
      assert.equal(active.length, 1);
    });

    await t.test('reordenações simultâneas do CRM não deixam uma permutação parcial', async () => {
      const opportunityIds = Array.from({ length: 3 }, () => crypto.randomUUID());
      await db.insert(schema.oportunidades).values(opportunityIds.map((id, index) => ({
        id, clienteId: clientA, titulo: `QA-R02-Funil ${index + 1}`,
        estagio: 'Prospectado', ordem: index, valorEstimado: 10_000
      })));
      const candidateA = opportunityIds.map((id, ordem) => ({ id, estagio: 'Prospectado', ordem }));
      const candidateB = [...opportunityIds].reverse().map((id, ordem) => ({ id, estagio: 'Prospectado', ordem }));
      const attempts = await Promise.all([
        request(firstApi!, 'PATCH', '/api/oportunidades/reorder', candidateA),
        request(secondApi!, 'PATCH', '/api/oportunidades/reorder', candidateB)
      ]);
      assert.ok(attempts.some((attempt) => attempt.status === 200), attempts.map((attempt) => attempt.text).join('\n'));
      assert.ok(attempts.every((attempt) => [200, 409].includes(attempt.status)), attempts.map((attempt) => attempt.text).join('\n'));
      const finalRows = await db.select().from(schema.oportunidades).where(eq(schema.oportunidades.clienteId, clientA));
      const finalOrder = finalRows.filter((row) => opportunityIds.some((id) => id === row.id))
        .sort((left, right) => left.ordem - right.ordem).map((row) => row.id);
      assert.ok([
        candidateA.map((item) => item.id),
        candidateB.map((item) => item.id)
      ].some((candidate) => candidate.join(',') === finalOrder.join(',')), finalOrder.join(','));
    });

    await t.test('substituições simultâneas de catálogos não misturam versões', async () => {
      const payload = (label: 'A' | 'B') => ({ values: {
        geogestor_tipos_servico: [{ id: `r02-service-${label}`, nome: `QA-R02-Serviço ${label}`, categoria: 'Topografia', valorSugerido: 10_000, ativo: true }],
        geogestor_tipos_despesa: [{ id: `r02-expense-${label}`, categoria: `QA-R02-Despesa ${label}`, descricao: `Versão ${label}`, subcategorias: [], ativo: true }]
      } });
      const attempts = await Promise.all([
        request(firstApi!, 'PUT', '/api/dados-operacionais/configuracoes-operacionais', payload('A')),
        request(secondApi!, 'PUT', '/api/dados-operacionais/configuracoes-operacionais', payload('B'))
      ]);
      assert.ok(attempts.some((attempt) => attempt.status === 200), attempts.map((attempt) => attempt.text).join('\n'));
      assert.ok(attempts.every((attempt) => [200, 409].includes(attempt.status)), attempts.map((attempt) => attempt.text).join('\n'));
      const finalState = await request(firstApi!, 'GET', '/api/dados-operacionais/configuracoes-operacionais');
      assert.equal(finalState.status, 200, finalState.text);
      const catalogs = finalState.json<Record<string, Array<{ id: string }>>>();
      const serviceId = catalogs.geogestor_tipos_servico?.[0]?.id;
      const expenseId = catalogs.geogestor_tipos_despesa?.[0]?.id;
      assert.ok((serviceId === 'r02-service-A' && expenseId === 'r02-expense-A')
        || (serviceId === 'r02-service-B' && expenseId === 'r02-expense-B'), JSON.stringify(catalogs));
    });
  } finally {
    closeDatabase?.();
    await Promise.all([stopApi(firstApi), stopApi(secondApi)]);
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
});
