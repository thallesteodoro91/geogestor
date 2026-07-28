import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';

type Sample = {
  totalMs: number;
  statusCode: number;
  bytes: number;
  rows: number;
};

type QueryBreakdown = {
  clientesMs: number;
  structuredAggregationMs: number;
  legacyAggregationMs: number;
  mergeMs: number;
  serializationMs: number;
  bytes: number;
  rows: number;
};

type SingleQueryBreakdown = {
  queryMs: number;
  serializationMs: number;
  bytes: number;
  rows: number;
};

const root = path.resolve(process.cwd(), 'scratch', 'client-list-benchmark');
const databasePath = path.join(root, 'benchmark.db');
const outputPath = path.join(root, process.argv.includes('--after') ? 'after.json' : 'baseline.json');
const token = 'synthetic-benchmark-token';
const clientCount = Number(process.env.GEOGESTOR_BENCHMARK_CLIENTS || 400);
const warmRuns = Number(process.env.GEOGESTOR_BENCHMARK_RUNS || 20);

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;

function percentile(values: number[], percentileValue: number) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(percentileValue * ordered.length) - 1));
  return ordered[index] || 0;
}

function summary(values: number[]) {
  return {
    minMs: Math.min(...values),
    medianMs: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: Math.max(...values)
  };
}

async function resetScratch() {
  await fs.mkdir(root, { recursive: true });
  for (const file of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
    await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
  }
  await fs.rm(path.join(root, 'logs'), { recursive: true, force: true });
}

async function seedSyntheticData(client: Client) {
  const now = new Date().toISOString();
  const statements = [];
  for (let index = 0; index < clientCount; index += 1) {
    const clienteId = `cliente-${String(index).padStart(4, '0')}-${crypto.randomUUID()}`;
    statements.push({
      sql: `INSERT INTO clientes (
        id, nome, tipo_pessoa, documento, email, telefone, endereco, numero, complemento,
        bairro, municipio, uf, cep, celular, cpf, rg, origem, categoria, anotacoes,
        situacao, servicos, created_at, updated_at
      ) VALUES (?, ?, 'PF', ?, ?, ?, ?, ?, ?, ?, ?, 'SC', ?, ?, ?, ?, ?, ?, ?, 'Ativo', ?, ?, ?)`,
      args: [
        clienteId,
        `Cliente sintético ${String(index).padStart(4, '0')}`,
        `doc-${index}`,
        `cliente-${index}@example.invalid`,
        `telefone-${index}`,
        `Endereço sintético ${index}`,
        String(index),
        `Complemento ${index}`,
        `Bairro ${index % 20}`,
        `Município ${index % 15}`,
        `00000-${String(index % 1000).padStart(3, '0')}`,
        `celular-${index}`,
        `cpf-${index}`,
        `rg-${index}`,
        'Benchmark',
        'Sintético',
        'Texto sintético suficiente para representar o volume médio do cadastro sem usar dados reais.',
        'Georreferenciamento, Topografia',
        now,
        now
      ]
    });

    if (index % 2 === 0) {
      statements.push({
        sql: 'INSERT INTO propriedades (id, cliente_id, nome, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), clienteId, `Propriedade ${index}`, now, now]
      });
    }
    if (index % 3 === 0) {
      statements.push({
        sql: 'INSERT INTO projetos (id, cliente_id, nome, propriedade_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
        args: [crypto.randomUUID(), clienteId, `Projeto legado ${index}`, now, now]
      });
    }
    if (index % 10 === 0) {
      statements.push({
        sql: 'INSERT INTO propriedades (id, cliente_id, nome, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), clienteId, `Propriedade excluída ${index}`, now, now, now]
      });
      statements.push({
        sql: 'INSERT INTO projetos (id, cliente_id, nome, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), clienteId, `Projeto excluído ${index}`, now, now, now]
      });
    }
  }
  const chunkSize = 100;
  for (let offset = 0; offset < statements.length; offset += chunkSize) {
    await client.batch(statements.slice(offset, offset + chunkSize), 'write');
  }
}

async function measureHttp(server: Awaited<typeof import('./server')>['server']): Promise<Sample> {
  const startedAt = performance.now();
  const response = await server.inject({
    method: 'GET',
    url: '/api/clientes?limit=500',
    headers: { 'x-api-token': token }
  });
  const totalMs = performance.now() - startedAt;
  const rows = response.json<unknown[]>();
  return {
    totalMs,
    statusCode: response.statusCode,
    bytes: Buffer.byteLength(response.body),
    rows: rows.length
  };
}

async function measureCurrentQueries(client: Client): Promise<QueryBreakdown> {
  const clientsStartedAt = performance.now();
  const clientesResult = await client.execute(`
    SELECT * FROM clientes
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 500 OFFSET 0
  `);
  const clientesMs = performance.now() - clientsStartedAt;
  const ids = clientesResult.rows.map((row) => String(row.id));
  const placeholders = ids.map(() => '?').join(', ');

  const structuredStartedAt = performance.now();
  const structured = await client.execute({
    sql: `SELECT cliente_id, count(*) AS value FROM propriedades
      WHERE cliente_id IN (${placeholders}) AND deleted_at IS NULL
      GROUP BY cliente_id`,
    args: ids
  });
  const structuredAggregationMs = performance.now() - structuredStartedAt;

  const legacyStartedAt = performance.now();
  const legacy = await client.execute({
    sql: `SELECT cliente_id, count(*) AS value FROM projetos
      WHERE cliente_id IN (${placeholders}) AND propriedade_id IS NULL AND deleted_at IS NULL
      GROUP BY cliente_id`,
    args: ids
  });
  const legacyAggregationMs = performance.now() - legacyStartedAt;

  const mergeStartedAt = performance.now();
  const counts = new Map<string, number>();
  for (const row of structured.rows) counts.set(String(row.cliente_id), Number(row.value));
  for (const row of legacy.rows) counts.set(String(row.cliente_id), (counts.get(String(row.cliente_id)) || 0) + Number(row.value));
  const merged = clientesResult.rows.map((row) => ({ ...row, propriedadesCount: counts.get(String(row.id)) || 0 }));
  const mergeMs = performance.now() - mergeStartedAt;
  const serializationStartedAt = performance.now();
  const body = JSON.stringify(merged);
  const serializationMs = performance.now() - serializationStartedAt;

  return {
    clientesMs,
    structuredAggregationMs,
    legacyAggregationMs,
    mergeMs,
    serializationMs,
    bytes: Buffer.byteLength(body),
    rows: clientesResult.rows.length
  };
}

async function measureSingleQuery(client: Client): Promise<SingleQueryBreakdown> {
  const queryStartedAt = performance.now();
  const response = await client.execute(`
    SELECT c.*,
      CAST(
        (SELECT COUNT(*) FROM propriedades AS structured_properties
          WHERE structured_properties.cliente_id = c.id
            AND structured_properties.deleted_at IS NULL)
        +
        (SELECT COUNT(*) FROM projetos AS legacy_projects
          WHERE legacy_projects.cliente_id = c.id
            AND legacy_projects.propriedade_id IS NULL
            AND legacy_projects.deleted_at IS NULL)
        AS INTEGER
      ) AS propriedadesCount
    FROM clientes AS c
    WHERE c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 500 OFFSET 0
  `);
  const queryMs = performance.now() - queryStartedAt;
  const serializationStartedAt = performance.now();
  const body = JSON.stringify(response.rows);
  const serializationMs = performance.now() - serializationStartedAt;
  return {
    queryMs,
    serializationMs,
    bytes: Buffer.byteLength(body),
    rows: response.rows.length
  };
}

async function explainPlans(client: Client) {
  const statements = {
    clientes: `SELECT * FROM clientes WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500 OFFSET 0`,
    structuredProperties: `SELECT cliente_id, count(*) FROM propriedades WHERE cliente_id IN ('synthetic-id') AND deleted_at IS NULL GROUP BY cliente_id`,
    legacyProjects: `SELECT cliente_id, count(*) FROM projetos WHERE cliente_id IN ('synthetic-id') AND propriedade_id IS NULL AND deleted_at IS NULL GROUP BY cliente_id`,
    singleQueryCandidate: `SELECT c.*,
      (SELECT count(*) FROM propriedades p WHERE p.cliente_id = c.id AND p.deleted_at IS NULL)
      + (SELECT count(*) FROM projetos pr WHERE pr.cliente_id = c.id AND pr.propriedade_id IS NULL AND pr.deleted_at IS NULL)
      AS propriedades_count
      FROM clientes c WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT 500 OFFSET 0`
  };
  return Object.fromEntries(await Promise.all(Object.entries(statements).map(async ([name, statement]) => {
    const result = await client.execute(`EXPLAIN QUERY PLAN ${statement}`);
    return [name, result.rows.map((row) => Object.fromEntries(Object.entries(row)))] as const;
  })));
}

async function main() {
  await resetScratch();
  const [{ server }, { dbReady }, { runRuntimeMigrations }, { OperationalLogService }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('./services/operational-log.service')
  ]);
  await dbReady;
  await runRuntimeMigrations();

  const client = createClient({ url: `file:${databasePath}` });
  try {
    await seedSyntheticData(client);
    const plans = await explainPlans(client);
    const cold = await measureHttp(server);
    const warmSamples: Sample[] = [];
    for (let index = 0; index < warmRuns; index += 1) warmSamples.push(await measureHttp(server));

    const querySamples: QueryBreakdown[] = [];
    for (let index = 0; index < warmRuns; index += 1) querySamples.push(await measureCurrentQueries(client));
    const singleQuerySamples: SingleQueryBreakdown[] = [];
    for (let index = 0; index < warmRuns; index += 1) singleQuerySamples.push(await measureSingleQuery(client));

    const logPath = path.join(root, 'logs', 'operational.ndjson');
    const logContent = await fs.readFile(logPath, 'utf8').catch(() => '');
    const result = {
      generatedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        clients: clientCount,
        warmRuns,
        databasePath: '[SCRATCH]'
      },
      route: {
        cold,
        warm: summary(warmSamples.map((sample) => sample.totalMs)),
        statusCodes: [...new Set(warmSamples.map((sample) => sample.statusCode))],
        bytes: warmSamples[0]?.bytes || 0,
        rows: warmSamples[0]?.rows || 0
      },
      breakdown: {
        previousThreeQueryStrategy: {
          clientesQuery: summary(querySamples.map((sample) => sample.clientesMs)),
          structuredAggregation: summary(querySamples.map((sample) => sample.structuredAggregationMs)),
          legacyAggregation: summary(querySamples.map((sample) => sample.legacyAggregationMs)),
          merge: summary(querySamples.map((sample) => sample.mergeMs)),
          serialization: summary(querySamples.map((sample) => sample.serializationMs))
        },
        optimizedSingleQueryStrategy: {
          query: summary(singleQuerySamples.map((sample) => sample.queryMs)),
          serialization: summary(singleQuerySamples.map((sample) => sample.serializationMs))
        }
      },
      logging: {
        recordsWritten: logContent.trim() ? logContent.trim().split(/\r?\n/).length : 0,
        service: OperationalLogService.getStatistics()
      },
      queryPlans: plans
    };
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
    await server.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
