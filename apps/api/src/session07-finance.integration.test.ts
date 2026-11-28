import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `session07-finance-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const databaseFiles = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];
const token = 'session07-finance-token';
const headers = { 'x-api-token': token };

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;

test('Sessão 07 preserva contratos, reconciliação, concorrência e diagnóstico somente leitura', async (t) => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(databaseFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const clientA = crypto.randomUUID();
  const clientB = crypto.randomUUID();
  const deletedClient = crypto.randomUUID();
  const projectA = crypto.randomUUID();
  const projectB = crypto.randomUUID();
  const budgetA = crypto.randomUUID();
  const budgetB = crypto.randomUUID();
  const legacyBudget = 'legacy-budget-s07';
  const installmentA = crypto.randomUUID();
  const installmentConcurrency = crypto.randomUUID();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const yesterdayDate = new Date(`${today}T12:00:00-03:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(yesterdayDate);

  const request = (input: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: Record<string, unknown> }) =>
    injectWithRecordVersion(server, { ...input, headers });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const now = new Date().toISOString();
    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'QA-AUDIT-S07-Cliente A', situacao: 'Ativo' },
      { id: clientB, nome: 'QA-AUDIT-S07-Cliente B', situacao: 'Ativo' },
      { id: deletedClient, nome: 'QA-AUDIT-S07-Cliente removido', situacao: 'Ativo', deletedAt: now }
    ]);
    await db.insert(schema.projetos).values([
      { id: projectA, clienteId: clientA, nome: 'QA-AUDIT-S07-Projeto A', status: 'Em Andamento' },
      { id: projectB, clienteId: clientB, nome: 'QA-AUDIT-S07-Projeto B', status: 'Em Andamento' }
    ]);
    await db.insert(schema.orcamentos).values([
      { id: budgetA, clienteId: clientA, projetoId: projectA, descricao: 'QA-AUDIT-S07-Contrato A', valorTotal: 30_000, status: 'aprovado', dataOrcamento: today },
      { id: budgetB, clienteId: clientB, projetoId: projectB, descricao: 'QA-AUDIT-S07-Contrato B', valorTotal: 10_000, status: 'aprovado', dataOrcamento: today },
      { id: legacyBudget, clienteId: clientA, projetoId: projectA, descricao: 'QA-AUDIT-S07-Contrato legado', valorTotal: 1_000, status: 'aprovado', dataOrcamento: today }
    ]);
    await db.insert(schema.parcelas).values([
      { id: installmentA, orcamentoId: budgetA, valor: 20_000, valorPago: 0, dataVencimento: yesterday, statusPagamento: 'Pendente' },
      { id: installmentConcurrency, orcamentoId: budgetB, valor: 10_000, valorPago: 0, dataVencimento: today, statusPagamento: 'Pendente' }
    ]);

    await t.test('rejeita datas impossíveis, intervalos invertidos e campos extras', async () => {
      const invalidOverview = await request({ method: 'GET', url: '/api/financeiro/overview?inicio=2026-02-30&fim=2026-03-01' });
      assert.equal(invalidOverview.statusCode, 400, invalidOverview.body);
      const invertedOverview = await request({ method: 'GET', url: '/api/financeiro/overview?inicio=2026-03-02&fim=2026-03-01' });
      assert.equal(invertedOverview.statusCode, 400, invertedOverview.body);

      const invalidExpense = await request({
        method: 'POST', url: '/api/financeiro/despesas', payload: {
          clienteId: clientA, descricao: 'QA-AUDIT-S07-Data impossível', valor: 100, data: '2026-02-30', categoria: 'Outros'
        }
      });
      assert.equal(invalidExpense.statusCode, 400, invalidExpense.body);

      const extraExpense = await request({
        method: 'POST', url: '/api/financeiro/despesas', payload: {
          clienteId: clientA, descricao: 'QA-AUDIT-S07-Campo extra', valor: 100, data: today, categoria: 'Outros', segredo: 'não persistir'
        }
      });
      assert.equal(extraExpense.statusCode, 400, extraExpense.body);

      const patchTarget = await request({ method: 'POST', url: '/api/financeiro/despesas', payload: { clienteId: clientA, descricao: 'QA alvo de validação', valor: 100, data: today, categoria: 'Outros' } });
      assert.equal(patchTarget.statusCode, 200, patchTarget.body);
      const emptyExpensePatch = await request({ method: 'PATCH', url: `/api/financeiro/despesas/${patchTarget.json<{ id: string }>().id}`, payload: {} });
      assert.equal(emptyExpensePatch.statusCode, 400, emptyExpensePatch.body);
      await request({ method: 'DELETE', url: `/api/financeiro/despesas/${patchTarget.json<{ id: string }>().id}` });

      const invalidInstallment = await request({
        method: 'POST', url: '/api/financeiro/parcelas', payload: {
          orcamentoId: budgetA, valor: 100, dataVencimento: '2026-02-30'
        }
      });
      assert.equal(invalidInstallment.statusCode, 400, invalidInstallment.body);

      const legacyInstallment = await request({
        method: 'POST', url: '/api/financeiro/parcelas', payload: {
          orcamentoId: legacyBudget, valor: 100, dataVencimento: today
        }
      });
      assert.equal(legacyInstallment.statusCode, 200, legacyInstallment.body);

      const extraReceipt = await request({
        method: 'POST', url: `/api/financeiro/parcelas/${installmentA}/recebimentos`, payload: {
          valorPrincipal: 100, dataRecebimento: today, valorCalculadoPeloCliente: 999_999
        }
      });
      assert.equal(extraReceipt.statusCode, 400, extraReceipt.body);
    });

    await t.test('rejeita cliente removido e vínculos fiscais inseguros ou inexistentes', async () => {
      const deletedClientExpense = await request({
        method: 'POST', url: '/api/financeiro/despesas', payload: {
          clienteId: deletedClient, descricao: 'QA-AUDIT-S07-Cliente removido', valor: 100, data: today, categoria: 'Outros'
        }
      });
      assert.equal(deletedClientExpense.statusCode, 400, deletedClientExpense.body);

      const unsafeLink = await request({
        method: 'POST', url: '/api/financeiro/notas-fiscais', payload: {
          clienteId: clientA, numero: 'QA-S07-NF-001', dataEmissao: today, valor: 100, link: 'javascript:alert(1)'
        }
      });
      assert.equal(unsafeLink.statusCode, 400, unsafeLink.body);

      const missingReplacement = await request({
        method: 'POST', url: '/api/financeiro/notas-fiscais', payload: {
          clienteId: clientA, numero: 'QA-S07-NF-002', dataEmissao: today, valor: 100, substituiNotaId: crypto.randomUUID()
        }
      });
      assert.equal(missingReplacement.statusCode, 400, missingReplacement.body);
    });

    await t.test('filtra despesas pelo status efetivo e mantém o resumo no mesmo recorte', async () => {
      await db.insert(schema.despesas).values([
        { id: crypto.randomUUID(), clienteId: clientA, projetoId: projectA, descricao: 'QA-AUDIT-S07-Vencida', valor: 1_111, data: yesterday, categoria: 'Outros', status: 'Pendente' },
        { id: crypto.randomUUID(), clienteId: clientA, projetoId: projectA, descricao: 'QA-AUDIT-S07-Futura', valor: 2_222, data: '2099-01-01', categoria: 'Outros', status: 'Pendente' }
      ]);
      const response = await request({ method: 'GET', url: '/api/financeiro/despesas?mode=page&status=Atrasado&q=QA-AUDIT-S07' });
      assert.equal(response.statusCode, 200, response.body);
      const payload = response.json<{ items: Array<{ descricao: string; status: string }>; summary: { totalPrevisto: number; totalPago: number; totalPendente: number; totalAtrasado: number } }>();
      assert.deepEqual(payload.items.map((item) => ({ descricao: item.descricao, status: item.status })), [
        { descricao: 'QA-AUDIT-S07-Vencida', status: 'Atrasado' }
      ]);
      assert.deepEqual(payload.summary, { totalPrevisto: 1_111, totalPago: 0, totalPendente: 0, totalAtrasado: 1_111 });
    });

    await t.test('serializa duas liquidações concorrentes sem ultrapassar o principal', async () => {
      const attempts = await Promise.all([
        request({ method: 'POST', url: `/api/financeiro/parcelas/${installmentConcurrency}/recebimentos`, payload: { valorPrincipal: 6_000, dataRecebimento: today } }),
        request({ method: 'POST', url: `/api/financeiro/parcelas/${installmentConcurrency}/recebimentos`, payload: { valorPrincipal: 6_000, dataRecebimento: today } })
      ]);
      assert.deepEqual(attempts.map((response) => response.statusCode).sort(), [201, 409]);
      const active = await db.select().from(schema.recebimentos);
      assert.equal(active.filter((item) => item.parcelaId === installmentConcurrency && !item.estornadoEm && !item.deletedAt).reduce((sum, item) => sum + item.valorPrincipal, 0), 6_000);
    });

    await t.test('diagnóstico é somente leitura', async () => {
      const counts = async () => Promise.all([
        db.select().from(schema.clientes), db.select().from(schema.projetos), db.select().from(schema.orcamentos),
        db.select().from(schema.parcelas), db.select().from(schema.recebimentos), db.select().from(schema.despesas),
        db.select().from(schema.viagens), db.select().from(schema.notasFiscais), db.select().from(schema.financeiroEventos)
      ]).then((rows) => rows.map((row) => row.length));
      const before = await counts();
      const first = await request({ method: 'GET', url: '/api/financeiro/diagnostico-vinculos' });
      const second = await request({ method: 'GET', url: '/api/financeiro/diagnostico-vinculos' });
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(second.statusCode, 200, second.body);
      assert.equal(first.json<{ somenteDiagnostico: boolean }>().somenteDiagnostico, true);
      assert.deepEqual(await counts(), before);
    });
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
