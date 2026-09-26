import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';

const root = path.resolve(process.cwd(), 'scratch', 'financial-performance-benchmark');
const databasePath = path.join(root, 'benchmark.db');
const outputPath = path.join(root, 'after.json');
const token = 'synthetic-financial-benchmark-token';
const runs = Number(process.env.GEOGESTOR_BENCHMARK_RUNS || 20);

const volumes = {
  clients: 400,
  projects: 1_000,
  budgets: 2_000,
  installments: 5_000,
  expenses: 5_000,
  receipts: 10_000
};

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;

function percentile(values: number[], target: number) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(target * ordered.length) - 1))] || 0;
}

function stats(values: number[]) {
  return {
    calls: values.length,
    averageMs: Number((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(2)),
    p50Ms: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2))
  };
}

async function resetScratch() {
  await fs.mkdir(root, { recursive: true });
  for (const target of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`, outputPath]) {
    await fs.rm(target, { force: true, maxRetries: 5, retryDelay: 100 });
  }
  await fs.rm(path.join(root, 'logs'), { recursive: true, force: true });
}

async function writeBatches(client: Client, statements: Array<{ sql: string; args: Array<string | number | null> }>) {
  for (let offset = 0; offset < statements.length; offset += 100) {
    await client.batch(statements.slice(offset, offset + 100), 'write');
  }
}

async function seed(client: Client) {
  const now = '2026-08-01T12:00:00.000Z';
  await client.execute({
    sql: `insert into configuracoes (
      id, empresa_nome, dados_pasta, admin_nome, admin_email, admin_senha_hash, setup_concluido, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: ['benchmark-config', 'GeoGestor sintético', root, 'GeoGestor sintético', 'local@geogestor.invalid', 'disabled-local-auth', now, now]
  });
  const clients = Array.from({ length: volumes.clients }, (_, index) => ({
    sql: 'insert into clientes (id, nome, situacao, created_at, updated_at) values (?, ?, ?, ?, ?)',
    args: [`client-${index}`, `Cliente sintético ${index}`, 'Ativo', now, now]
  }));
  await writeBatches(client, clients);

  const projects = Array.from({ length: volumes.projects }, (_, index) => ({
    sql: 'insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
    args: [`project-${index}`, `client-${index % volumes.clients}`, `Projeto sintético ${index}`, 'Em Andamento', now, now]
  }));
  await writeBatches(client, projects);

  const budgets = Array.from({ length: volumes.budgets }, (_, index) => {
    const status = index < 1_000 ? 'aprovado' : index % 3 === 0 ? 'rejeitado' : 'emitido';
    return {
      sql: `insert into orcamentos (
        id, grupo_id, versao, cliente_id, projeto_id, valor_total, status, descricao,
        codigo_orcamento, data_orcamento, data_emissao, data_competencia, validade_ate,
        servico_tipo, impostos_previstos, honorarios_liquidos, created_at, updated_at
      ) values (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `budget-${index}`, `budget-${index}`, `client-${(index % volumes.projects) % volumes.clients}`, `project-${index % volumes.projects}`,
        100_000 + index, status, `Orçamento sintético ${index}`, `ORC-2026-${index}`,
        '2026-08-01', '2026-08-01', '2026-08-01', '2027-12-31', `Serviço ${index % 8}`,
        8_000, 70_000, now, now
      ]
    };
  });
  await writeBatches(client, budgets);

  const installments = Array.from({ length: volumes.installments }, (_, index) => ({
    sql: `insert into parcelas (
      id, orcamento_id, valor, numero, valor_pago, data_competencia, data_vencimento,
      status_pagamento, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `installment-${index}`, `budget-${index % 1_000}`, 10_000, (index % 5) + 1, 5_000,
      '2026-08-01', index % 2 === 0 ? '2026-08-15' : '2026-09-15', 'Pendente', now, now
    ]
  }));
  await writeBatches(client, installments);

  const expenses = Array.from({ length: volumes.expenses }, (_, index) => ({
    sql: `insert into despesas (
      id, cliente_id, projeto_id, descricao, fornecedor, valor, data, data_competencia,
      data_pagamento, categoria, categoria_codigo, tipo_custo, centro_custo, reembolsavel,
      status, forma_pagamento, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `expense-${index}`, `client-${(index % volumes.projects) % volumes.clients}`, `project-${index % volumes.projects}`,
      `Despesa sintética ${index}`, `Fornecedor ${index % 40}`, 1_000 + index,
      index % 2 === 0 ? '2026-08-10' : '2026-09-10', '2026-08-01',
      index % 3 === 0 ? '2026-08-11' : null, `Categoria ${index % 12}`, 'outros',
      index % 4 === 0 ? 'Fixo' : 'Variável de campo', `Centro ${index % 7}`, index % 5 === 0 ? 1 : 0,
      index % 3 === 0 ? 'Pago' : 'Pendente', 'Pix', now, now
    ]
  }));
  await writeBatches(client, expenses);

  const receipts = Array.from({ length: volumes.receipts }, (_, index) => ({
    sql: `insert into recebimentos (
      id, parcela_id, valor_principal, juros, multa, desconto, taxas, valor_recebido,
      data_recebimento, usuario_id, created_at, updated_at
    ) values (?, ?, ?, 0, 0, 0, 0, ?, ?, 'benchmark', ?, ?)`,
    args: [`receipt-${index}`, `installment-${Math.floor(index / 2)}`, 2_500, 2_500, '2026-08-12', now, now]
  }));
  await writeBatches(client, receipts);
}

async function measureRoute(server: Awaited<typeof import('./server')>['server'], url: string) {
  const startedAt = performance.now();
  const response = await server.inject({ method: 'GET', url, headers: { 'x-api-token': token } });
  const durationMs = performance.now() - startedAt;
  if (response.statusCode !== 200) throw new Error(`${url}: ${response.statusCode} ${response.body.slice(0, 500)}`);
  return { durationMs, bytes: Buffer.byteLength(response.body), payload: response.json<unknown>() };
}

async function routeComparison(server: Awaited<typeof import('./server')>['server'], legacyUrl: string, pageUrl: string) {
  const legacy = await measureRoute(server, legacyUrl);
  const page = await measureRoute(server, pageUrl);
  const samples = [];
  for (let index = 0; index < runs; index += 1) samples.push(await measureRoute(server, pageUrl));
  const payload = page.payload as { items?: unknown[]; total?: number };
  return {
    beforeLegacy: { calls: 1, errors: 0, durationMs: Number(legacy.durationMs.toFixed(2)), bytes: legacy.bytes },
    afterPage: { ...stats(samples.map((sample) => sample.durationMs)), errors: 0, averageResponseBytes: Math.round(samples.reduce((sum, sample) => sum + sample.bytes, 0) / Math.max(1, samples.length)), bytes: page.bytes, rows: payload.items?.length || 0, total: payload.total || 0 }
  };
}

async function routeStats(server: Awaited<typeof import('./server')>['server'], url: string) {
  const first = await measureRoute(server, url);
  const samples = [];
  for (let index = 0; index < runs; index += 1) samples.push(await measureRoute(server, url));
  const payload = first.payload as {
    analytics?: { kpis?: { receitaRecebida?: number }; categorias?: unknown[]; clientes?: unknown[] };
    recentEntries?: unknown[];
    meta?: { launchCount?: number; expenseCount?: number };
  };
  return {
    ...stats(samples.map((sample) => sample.durationMs)),
    errors: 0,
    coldMs: Number(first.durationMs.toFixed(2)),
    coldBytes: first.bytes,
    averageResponseBytes: Math.round(samples.reduce((sum, sample) => sum + sample.bytes, 0) / Math.max(1, samples.length)),
    bytes: first.bytes,
    launchCount: payload.meta?.launchCount || 0,
    expenseCount: payload.meta?.expenseCount || 0,
    receivedRevenue: payload.analytics?.kpis?.receitaRecebida || 0,
    categories: payload.analytics?.categorias?.length || 0,
    clients: payload.analytics?.clientes?.length || 0,
    recentEntries: payload.recentEntries?.length || 0
  };
}

async function groupingComparison(client: Client) {
  const [installments, receipts] = await Promise.all([
    client.execute('select id from parcelas'),
    client.execute('select parcela_id, valor_recebido, data_recebimento from recebimentos')
  ]);
  const legacyStarted = performance.now();
  const legacy = installments.rows.map((installment) => receipts.rows.filter((receipt) => receipt.parcela_id === installment.id));
  const legacyMs = performance.now() - legacyStarted;
  const mapStarted = performance.now();
  const grouped = new Map<string, unknown[]>();
  for (const receipt of receipts.rows) {
    const key = String(receipt.parcela_id);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(receipt);
    else grouped.set(key, [receipt]);
  }
  const optimized = installments.rows.map((installment) => grouped.get(String(installment.id)) || []);
  const mapMs = performance.now() - mapStarted;
  return {
    legacyQuadraticMs: Number(legacyMs.toFixed(2)),
    optimizedMapMs: Number(mapMs.toFixed(2)),
    groups: optimized.length,
    legacyReceipts: legacy.reduce((sum, group) => sum + group.length, 0),
    optimizedReceipts: optimized.reduce((sum, group) => sum + group.length, 0)
  };
}

async function plans(client: Client) {
  const statements = {
    installments: `select p.id from parcelas p join orcamentos o on o.id=p.orcamento_id join clientes c on c.id=o.cliente_id where p.deleted_at is null and p.cancelada_em is null and o.deleted_at is null and (p.status_pagamento='Pago' or lower(o.status) in ('aprovado','pago')) order by p.data_vencimento desc limit 25`,
    receipts: `select parcela_id from recebimentos where parcela_id in ('installment-1','installment-2') and deleted_at is null and estornado_em is null`,
    expenses: `select id from despesas where deleted_at is null and data >= '2026-08-01' order by data desc limit 25`,
    budgets: `select id from orcamentos where deleted_at is null order by created_at desc limit 25`,
    overviewReceipts: `select parcela_id, sum(valor_recebido) from recebimentos where deleted_at is null and estornado_em is null and data_recebimento between '2026-08-01' and '2026-09-30' group by parcela_id`,
    overviewExpenses: `select categoria, sum(valor) from despesas where deleted_at is null and cancelada_em is null and estornada_em is null and coalesce(data_pagamento, data_competencia, data) between '2026-08-01' and '2026-09-30' group by categoria`,
    overviewInstallments: `select p.id from parcelas p join orcamentos o on o.id = p.orcamento_id where p.deleted_at is null and p.cancelada_em is null and o.deleted_at is null and lower(o.status) in ('aprovado','pago')`,
    overviewClients: `select o.cliente_id, sum(o.valor_total) from orcamentos o where o.deleted_at is null and lower(o.status) in ('aprovado','pago') group by o.cliente_id`
  };
  return Object.fromEntries(await Promise.all(Object.entries(statements).map(async ([name, statement]) => {
    const result = await client.execute(`explain query plan ${statement}`);
    return [name, result.rows.map((row) => String(row.detail))];
  })));
}

async function main() {
  await resetScratch();
  const [{ server }, { dbReady }, { runRuntimeMigrations }, { closeDb }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('./db')
  ]);
  await dbReady;
  await runRuntimeMigrations();
  const client = createClient({ url: `file:${databasePath}` });
  try {
    await seed(client);
    const result = {
      generatedAt: new Date().toISOString(),
      database: '[SCRATCH]',
      volumes,
      runs,
      comparisons: {
        expenses: await routeComparison(server, '/api/financeiro/despesas?mode=legacy', '/api/financeiro/despesas?mode=page&page=1&limit=25&dataInicio=2026-08-01'),
        installments: await routeComparison(server, '/api/financeiro/parcelas?mode=legacy', '/api/financeiro/parcelas?mode=page&page=1&limit=25&status=pendentes'),
        budgets: await routeComparison(server, '/api/orcamentos?mode=legacy', '/api/orcamentos?mode=page&page=1&limit=25'),
        budgetKpis: await routeComparison(server, '/api/orcamentos?mode=legacy', '/api/orcamentos/kpis')
      },
      overview: await routeStats(server, '/api/financeiro/overview?inicio=2026-08-01&fim=2026-09-30'),
      receiptGrouping: await groupingComparison(client),
      plans: await plans(client)
    };
    const totals = [...Object.values(result.comparisons).map((comparison) => comparison.afterPage), result.overview];
    if (totals.some((sample) => sample.p95Ms >= 200 || sample.maxMs >= 1_000)) {
      throw new Error(`Performance budget exceeded: ${JSON.stringify(totals)}`);
    }
    if (result.overview.coldMs >= 1_000) {
      throw new Error(`Cold financial overview exceeded 1 second: ${result.overview.coldMs}ms`);
    }
    if (result.receiptGrouping.legacyReceipts !== volumes.receipts || result.receiptGrouping.optimizedReceipts !== volumes.receipts) {
      throw new Error('Receipt grouping lost or duplicated records.');
    }
    if (result.overview.launchCount !== volumes.installments + volumes.expenses
      || result.overview.expenseCount !== volumes.expenses
      || result.overview.receivedRevenue !== volumes.receipts * 2_500
      || result.overview.categories !== 12
      || result.overview.clients !== volumes.clients
      || result.overview.recentEntries !== 6) {
      throw new Error(`Financial overview aggregation mismatch: ${JSON.stringify(result.overview)}`);
    }
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
    await server.close();
    await closeDb();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
