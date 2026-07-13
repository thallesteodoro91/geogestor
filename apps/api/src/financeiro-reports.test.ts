import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { sql } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', 'api-tests');
const dbPath = path.join(testRoot, 'financeiro-reports.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('DRE ignora orcamentos e parcelas excluidos', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(dbFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();

    const timeout = await db.all<{ timeout: number }>(sql.raw('PRAGMA busy_timeout;'));
    assert.equal(timeout[0]?.timeout, 5000);

    const month = new Date().toISOString().slice(0, 7);
    const activeClientId = crypto.randomUUID();
    const deletedClientId = crypto.randomUUID();
    const activeBudgetId = crypto.randomUUID();
    const deletedBudgetId = crypto.randomUUID();

    await db.insert(schema.clientes).values([
      { id: activeClientId, nome: 'Cliente ativo' },
      { id: deletedClientId, nome: 'Cliente excluido', deletedAt: new Date().toISOString() }
    ]);
    await db.insert(schema.orcamentos).values([
      {
        id: activeBudgetId,
        clienteId: activeClientId,
        valorTotal: 10_000,
        status: 'Aprovado'
      },
      {
        id: deletedBudgetId,
        clienteId: deletedClientId,
        valorTotal: 90_000,
        status: 'Aprovado',
        deletedAt: new Date().toISOString()
      }
    ]);
    await db.insert(schema.parcelas).values([
      {
        id: crypto.randomUUID(),
        orcamentoId: activeBudgetId,
        valor: 10_000,
        dataVencimento: `${month}-10`,
        dataPagamento: `${month}-10`,
        statusPagamento: 'Pago'
      },
      {
        id: crypto.randomUUID(),
        orcamentoId: deletedBudgetId,
        valor: 90_000,
        dataVencimento: `${month}-10`,
        dataPagamento: `${month}-10`,
        statusPagamento: 'Pago',
        deletedAt: new Date().toISOString()
      }
    ]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/financeiro/dre',
      headers: { 'x-api-token': 'test-token' }
    });

    assert.equal(response.statusCode, 200);
    const currentMonth = response.json<Array<{ mes: string; receitas: number }>>()
      .find((item) => item.mes === month);
    assert.equal(currentMonth?.receitas, 10_000);

    const createBudgetResponse = await server.inject({
      method: 'POST',
      url: '/api/financeiro/orcamentos',
      headers: {
        'content-type': 'application/json',
        'x-api-token': 'test-token'
      },
      payload: {
        clienteId: activeClientId,
        valorTotal: 5_000,
        status: 'Em Analise',
        descricao: 'Orcamento com itens normalizados',
        itens: [
          {
            descricao: 'Servico tecnico',
            quantidade: 1,
            valorUnitario: 5_000,
            total: 5_000
          }
        ],
        despesas: [
          {
            descricao: 'ART',
            valor: 150
          }
        ]
      }
    });

    assert.equal(createBudgetResponse.statusCode, 200);
    const createdBudget = createBudgetResponse.json<{ id: string }>();

    const budgetsResponse = await server.inject({
      method: 'GET',
      url: '/api/financeiro/orcamentos',
      headers: { 'x-api-token': 'test-token' }
    });

    assert.equal(budgetsResponse.statusCode, 200);
    const budgets = budgetsResponse.json<Array<{
      id: string;
      itens?: Array<{ descricao: string; valorUnitario: number; total: number }>;
      despesas?: Array<{ descricao: string; valor: number }>;
    }>>();
    const normalizedBudget = budgets.find((item) => item.id === createdBudget.id);
    assert.equal(normalizedBudget?.itens?.length, 1);
    assert.equal(normalizedBudget?.itens?.[0]?.valorUnitario, 5_000);
    assert.equal(normalizedBudget?.itens?.[0]?.total, 5_000);
    assert.equal(normalizedBudget?.despesas?.length, 1);
    assert.equal(normalizedBudget?.despesas?.[0]?.valor, 150);

    const setupResponse = await server.inject({
      method: 'POST',
      url: '/api/configuracoes',
      headers: {
        'content-type': 'application/json',
        'x-api-token': 'test-token'
      },
      payload: {
        empresaNome: 'GeoGestor Teste',
        dadosPasta: testRoot,
        adminNome: 'Administrador',
        adminEmail: 'admin@teste.local',
        adminSenha: 'senha-segura'
      }
    });
    assert.equal(setupResponse.statusCode, 200);

    const updateConfigResponse = await server.inject({
      method: 'PATCH',
      url: '/api/configuracoes',
      headers: {
        'content-type': 'application/json',
        'x-api-token': 'test-token'
      },
      payload: { empresaNome: 'GeoGestor Atualizado' }
    });
    assert.equal(updateConfigResponse.statusCode, 200);

    const configResponse = await server.inject({
      method: 'GET',
      url: '/api/configuracoes',
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(configResponse.statusCode, 200);
    const config = configResponse.json<{ empresaNome: string; adminSenhaHash?: string }>();
    assert.equal(config.empresaNome, 'GeoGestor Atualizado');
    assert.equal('adminSenhaHash' in config, false);

    const categoryClientId = crypto.randomUUID();
    await db.insert(schema.clientes).values({
      id: categoryClientId,
      nome: 'Cliente industrial',
      categoria: 'Indústria',
      situacao: 'Ativo'
    });

    const updateClientResponse = await server.inject({
      method: 'PATCH',
      url: `/api/clientes/${categoryClientId}`,
      headers: {
        'content-type': 'application/json',
        'x-api-token': 'test-token'
      },
      payload: { nome: 'Cliente industrial atualizado' }
    });
    assert.equal(updateClientResponse.statusCode, 200);
    const updatedClient = updateClientResponse.json<{ categoria: string; situacao: string }>();
    assert.equal(updatedClient.categoria, 'Indústria');
    assert.equal(updatedClient.situacao, 'Ativo');

    const projectBatchResponse = await server.inject({
      method: 'POST',
      url: '/api/projetos/lote',
      headers: {
        'content-type': 'application/json',
        'x-api-token': 'test-token'
      },
      payload: [{
        clienteId: categoryClientId,
        nome: 'Projeto importado',
        status: 'Em Andamento',
        cidade: 'Florianópolis',
        areaHa: '12.5'
      }]
    });
    assert.equal(projectBatchResponse.statusCode, 201);
    assert.equal(projectBatchResponse.json<{ importedCount: number }>().importedCount, 1);

    const projectResponse = await server.inject({
      method: 'GET',
      url: `/api/projetos?clienteId=${categoryClientId}`,
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(projectResponse.statusCode, 200);
    const importedProject = projectResponse
      .json<Array<{ nome: string; clienteId: string; areaHa: number }>>()
      .find((project) => project.nome === 'Projeto importado');
    assert.equal(importedProject?.clienteId, categoryClientId);
    assert.equal(importedProject?.areaHa, 12.5);
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
  }
});
