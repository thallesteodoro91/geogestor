import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `project-financial-polish-${process.pid}`);
const dbPath = path.join(testRoot, 'project-financial-polish.integration.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

async function removeTestDatabase() {
  await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
}

test('cancelamento exige decisão, consolida execução, eventos e comprovante sem duplicar KPIs', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const otherProjectId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const installmentId = crypto.randomUUID();
    const generalDocumentId = crypto.randomUUID();
    const projectDocumentId = crypto.randomUUID();
    const otherProjectDocumentId = crypto.randomUUID();

    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente financeiro' });
    await db.insert(schema.projetos).values([
      { id: projectId, clienteId: clientId, nome: 'Projeto cancelável', status: 'Em Andamento' },
      { id: otherProjectId, clienteId: clientId, nome: 'Outro projeto', status: 'Em Andamento' }
    ]);
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      clienteId: clientId,
      projetoId: projectId,
      descricao: 'Contrato principal',
      valorTotal: 10_000,
      status: 'Aprovado'
    });
    await db.insert(schema.parcelas).values({
      id: installmentId,
      orcamentoId: budgetId,
      valor: 10_000,
      valorPago: 0,
      dataVencimento: '2026-08-10',
      statusPagamento: 'Pendente'
    });
    await db.insert(schema.notasFiscais).values({
      id: crypto.randomUUID(),
      clienteId: clientId,
      projetoId: projectId,
      numero: 'NFS-001',
      dataEmissao: '2026-08-01',
      valor: 6_000,
      status: 'emitida'
    });
    await db.insert(schema.documentos).values([
      {
        id: generalDocumentId,
        clienteId: clientId,
        nome: 'Comprovante geral.pdf',
        extensao: '.pdf',
        caminho: path.join(testRoot, 'Comprovante geral.pdf')
      },
      {
        id: projectDocumentId,
        clienteId: clientId,
        projetoId: projectId,
        nome: 'Comprovante do projeto.pdf',
        extensao: '.pdf',
        caminho: path.join(testRoot, 'Comprovante do projeto.pdf')
      },
      {
        id: otherProjectDocumentId,
        clienteId: clientId,
        projetoId: otherProjectId,
        nome: 'Comprovante de outro projeto.pdf',
        extensao: '.pdf',
        caminho: path.join(testRoot, 'Comprovante de outro projeto.pdf')
      }
    ]);

    const cancelResponse = await server.inject({
      method: 'PATCH',
      url: `/api/projetos/${projectId}`,
      headers: authHeaders,
      payload: { status: 'Cancelado' }
    });
    assert.equal(cancelResponse.statusCode, 200, cancelResponse.body);

    const pendingContextResponse = await server.inject({
      method: 'GET',
      url: `/api/projetos/${projectId}/contexto-financeiro`,
      headers: authHeaders
    });
    assert.equal(pendingContextResponse.statusCode, 200, pendingContextResponse.body);
    const pendingContext = pendingContextResponse.json<{
      decisaoFinanceiraPendente: boolean;
      valorOrcado: number;
      valorContratado: number;
      valorFaturado: number;
      valorExecutadoInformado: number | null;
      eventosFinanceiros: Array<{ tipo: string }>;
    }>();
    assert.equal(pendingContext.decisaoFinanceiraPendente, true);
    assert.equal(pendingContext.valorOrcado, 10_000);
    assert.equal(pendingContext.valorContratado, 10_000);
    assert.equal(pendingContext.valorFaturado, 6_000);
    assert.equal(pendingContext.valorExecutadoInformado, null);
    assert.ok(pendingContext.eventosFinanceiros.some((event) => event.tipo === 'cancelamento_projeto_pendente'));
    const pendingDiagnosticResponse = await server.inject({
      method: 'GET',
      url: '/api/financeiro/diagnostico-vinculos',
      headers: authHeaders
    });
    assert.equal(
      pendingDiagnosticResponse.json<{ totais: { decisoesCancelamentoPendentes: number } }>()
        .totais.decisoesCancelamentoPendentes,
      1
    );

    const decisionResponse = await server.inject({
      method: 'POST',
      url: `/api/projetos/${projectId}/decisao-financeira`,
      headers: authHeaders,
      payload: {
        tipo: 'cobranca_parcial',
        percentualExecutado: 40,
        motivo: 'Quarenta por cento do serviço foi executado.'
      }
    });
    assert.equal(decisionResponse.statusCode, 201, decisionResponse.body);
    assert.equal(decisionResponse.json<{ valorExecutado: number }>().valorExecutado, 4_000);

    const completedContextResponse = await server.inject({
      method: 'GET',
      url: `/api/projetos/${projectId}/contexto-financeiro`,
      headers: authHeaders
    });
    const completedContext = completedContextResponse.json<{
      decisaoFinanceiraPendente: boolean;
      valorExecutadoInformado: number;
      eventosFinanceiros: Array<{ tipo: string }>;
    }>();
    assert.equal(completedContext.decisaoFinanceiraPendente, false);
    assert.equal(completedContext.valorExecutadoInformado, 4_000);
    assert.ok(completedContext.eventosFinanceiros.some((event) => event.tipo === 'decisao_financeira_projeto'));
    const completedDiagnosticResponse = await server.inject({
      method: 'GET',
      url: '/api/financeiro/diagnostico-vinculos',
      headers: authHeaders
    });
    assert.equal(
      completedDiagnosticResponse.json<{ totais: { decisoesCancelamentoPendentes: number } }>()
        .totais.decisoesCancelamentoPendentes,
      0
    );

    const updatedExecutionResponse = await server.inject({
      method: 'POST',
      url: `/api/projetos/${projectId}/decisao-financeira`,
      headers: authHeaders,
      payload: {
        tipo: 'cobranca_parcial',
        percentualExecutado: 50,
        motivo: 'Medição revisada para cinquenta por cento.'
      }
    });
    assert.equal(updatedExecutionResponse.statusCode, 201, updatedExecutionResponse.body);

    const clientDashboardResponse = await server.inject({
      method: 'GET',
      url: `/api/clientes/${clientId}/dashboard`,
      headers: authHeaders
    });
    assert.equal(clientDashboardResponse.statusCode, 200, clientDashboardResponse.body);
    const clientKpis = clientDashboardResponse.json<{
      kpis: { valorExecutadoInformado: number; execucaoInformada: boolean };
    }>().kpis;
    assert.equal(clientKpis.valorExecutadoInformado, 5_000);
    assert.equal(clientKpis.execucaoInformada, true);

    const documentsResponse = await server.inject({
      method: 'GET',
      url: `/api/financeiro/comprovantes?clienteId=${clientId}&projetoId=${projectId}`,
      headers: authHeaders
    });
    assert.equal(documentsResponse.statusCode, 200, documentsResponse.body);
    const availableDocumentIds = documentsResponse.json<Array<{ id: string }>>().map((document) => document.id);
    assert.deepEqual(new Set(availableDocumentIds), new Set([generalDocumentId, projectDocumentId]));

    const receiptResponse = await server.inject({
      method: 'POST',
      url: `/api/financeiro/parcelas/${installmentId}/recebimentos`,
      headers: authHeaders,
      payload: {
        valorPrincipal: 2_000,
        dataRecebimento: '2026-08-05',
        comprovanteDocumentoId: projectDocumentId
      }
    });
    assert.equal(receiptResponse.statusCode, 201, receiptResponse.body);
    assert.equal(
      receiptResponse.json<{ recebimento: { comprovanteDocumentoId: string } }>().recebimento.comprovanteDocumentoId,
      projectDocumentId
    );

    const [monthlyResponse, legacyMonthlyResponse] = await Promise.all([
      server.inject({ method: 'GET', url: '/api/financeiro/resumo-mensal', headers: authHeaders }),
      server.inject({ method: 'GET', url: '/api/financeiro/dre', headers: authHeaders })
    ]);
    assert.equal(monthlyResponse.statusCode, 200, monthlyResponse.body);
    assert.equal(legacyMonthlyResponse.statusCode, 200, legacyMonthlyResponse.body);
    assert.deepEqual(monthlyResponse.json(), legacyMonthlyResponse.json());
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await removeTestDatabase();
  }
});
