import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `full-spreadsheet-import-${process.pid}`);
const dbPath = path.join(testRoot, 'full-spreadsheet-import.test.db');
const workbookPath = 'C:\\Users\\Thalles\\Desktop\\Skygeo\\Planilhas\\skygeo.xlsx';

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_API_TOKEN = 'full-import-test-token';

async function removeDatabase() {
  for (const suffix of ['', '-shm', '-wal']) await fs.rm(`${dbPath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 50 });
}

function syntheticInput(hashSeed: string, clientName = 'Cliente Migração Segura') {
  const headers = [
    'Cliente', 'CNPJ', 'Telefone', 'Data_Cadastro', 'Nome da Propriedade', 'Cidade', 'Área_ha',
    'CAR', 'CCIR', 'ITR', 'Projeto', 'Categoria do Projeto', 'Situação do Serviço',
    'Data do Serviço (Início)', 'Data do Serviço (Fim)', 'Valor Unitário', 'Quantidade',
    'Receita Esperada', 'Valor Imposto', 'Receita Esperada + Imposto', 'Lucro Esperado',
    'Margem Esperada', 'Data_Orcamento', 'Orçamento Convertido', 'Valor Faturado',
    'Data do Faturamento', 'Situação do Pagamento', 'Forma de Pagamento', 'Categoria de Gasto',
    'SubCategoria de Gasto', 'Valor da Despesa', 'Data da Despesa', 'Receita', 'Custo',
    'Despesas', 'Receita Realizada'
  ];
  return {
    fileName: `${hashSeed}.xlsx`,
    fileHash: crypto.createHash('sha256').update(hashSeed).digest('hex'),
    headers,
    rows: [{
      Cliente: clientName,
      CNPJ: '45.723.174/0001-10',
      Telefone: '+55 (48) 99999-0000',
      Data_Cadastro: 43831,
      'Nome da Propriedade': 'Fazenda Modelo',
      Cidade: 'Florianópolis',
      Área_ha: 125.5,
      CAR: 'Sim', CCIR: 'Não', ITR: 'Sim',
      Projeto: 'Georreferenciamento da Fazenda Modelo',
      'Categoria do Projeto': 'Topografia',
      'Situação do Serviço': 'Concluido',
      'Data do Serviço (Início)': 45292,
      'Data do Serviço (Fim)': 45322,
      'Valor Unitário': 10000,
      Quantidade: 1,
      'Receita Esperada': 10000,
      'Valor Imposto': 500,
      'Receita Esperada + Imposto': 10500,
      'Lucro Esperado': 4000,
      'Margem Esperada': 40,
      Data_Orcamento: 45280,
      'Orçamento Convertido': 'Sim',
      'Valor Faturado': 10500,
      'Data do Faturamento': 45323,
      'Situação do Pagamento': 'Faturado',
      'Forma de Pagamento': 'Pix',
      'Categoria de Gasto': '',
      'SubCategoria de Gasto': '',
      'Valor da Despesa': 750,
      'Data da Despesa': 45300,
      Receita: 20000,
      Custo: 12000,
      Despesas: 3000,
      'Receita Realizada': 9000
    }]
  };
}

test('migração completa reconhece a planilha real, grava vínculos, concilia, evita reimportação e faz rollback', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeDatabase();
  const [{ db, dbReady, closeDb }, { schema }, migration, service, { server }, { AuditLogService }] = await Promise.all([
    import('./db'),
    import('@geogestor/database'),
    import('./services/runtime-migrations.service'),
    import('./services/full-spreadsheet-import.service'),
    import('./server'),
    import('./services/audit.service')
  ]);
  try {
    await dbReady;
    await migration.runRuntimeMigrations();

    assert.equal(service.FULL_IMPORT_HEADERS.length, 64);
    assert.equal(service.excelDateToIso(43831), '2020-01-01');
    assert.equal(service.moneyToCents('R$ 1.234,565'), 123457);
    assert.equal(service.normalizeNationalPhone('+55 (48) 99999-0000'), '48999990000');
    assert.equal(service.normalizeNationalPhone('(48) 3333-4444'), '4833334444');

    const clientSpecificInput = {
      fileName: 'modelo-proprio-do-cliente.xlsx',
      fileHash: crypto.createHash('sha256').update('modelo-proprio-do-cliente').digest('hex'),
      headers: ['Contratante principal', 'Trabalho executado', 'Preço negociado', 'Quando foi cobrado'],
      rows: [{
        'Contratante principal': 'Cliente com modelo próprio',
        'Trabalho executado': 'Levantamento planialtimétrico',
        'Preço negociado': 'R$ 4.500,00',
        'Quando foi cobrado': '15/07/2026'
      }],
      firstDataRow: 6
    };
    const unconfirmedSuggestions = await service.previewFullSpreadsheetImport(clientSpecificInput);
    assert.equal(unconfirmedSuggestions.status, 'blocked');
    assert.ok(unconfirmedSuggestions.columns.recognized.some(column => column.method === 'semantic'));

    const clientSpecificPreview = await service.previewFullSpreadsheetImport({
      ...clientSpecificInput,
      mappingOverrides: {
        'Contratante principal': 'cliente',
        'Trabalho executado': 'projeto',
        'Preço negociado': 'valorFaturado',
        'Quando foi cobrado': 'dataFaturamento'
      }
    });
    assert.equal(clientSpecificPreview.status, 'ready');
    assert.equal(clientSpecificPreview.columns.recognized.length, 4);
    assert.ok(clientSpecificPreview.columns.recognized.every(column => column.method === 'manual'));
    assert.equal(clientSpecificPreview.counts.clientsCreated, 1);
    assert.equal(clientSpecificPreview.counts.projects, 1);
    assert.equal(clientSpecificPreview.counts.billings, 1);
    assert.equal(clientSpecificPreview.reconciliation.find(item => item.key === 'valorFaturado')?.spreadsheet, 450_000);

    const documentCases = {
      fileName: 'casos-documentais.xlsx',
      fileHash: crypto.createHash('sha256').update('casos-documentais').digest('hex'),
      headers: ['Cliente', 'CNPJ'],
      rows: [
        { Cliente: 'Sem documento', CNPJ: '' },
        { Cliente: 'Documento inválido', CNPJ: '11.111.111/1111-11' },
        { Cliente: 'Mesmo cliente', CNPJ: '45.723.174/0001-10' },
        { Cliente: 'Mesmo cliente', CNPJ: '45.723.174/0001-10' }
      ]
    };
    const documentPreview = await service.previewFullSpreadsheetImport(documentCases);
    assert.equal(documentPreview.status, 'ready');
    assert.ok(documentPreview.issues.some(issue => issue.message.startsWith('Documento ausente.')));
    assert.ok(documentPreview.issues.some(issue => issue.message.includes('inválido')));
    assert.ok(documentPreview.issues.some(issue => issue.message.includes('repetido para o mesmo cliente')));

    const conflictingDocumentInput = {
      ...documentCases,
      fileHash: crypto.createHash('sha256').update('conflito-documental').digest('hex'),
      rows: [
        { Cliente: 'Cliente A', CNPJ: '45.723.174/0001-10' },
        { Cliente: 'Cliente B', CNPJ: '45.723.174/0001-10' }
      ]
    };
    const conflictingDocumentPreview = await service.previewFullSpreadsheetImport(conflictingDocumentInput);
    assert.equal(conflictingDocumentPreview.status, 'blocked');
    assert.equal(conflictingDocumentPreview.counts.duplicateDocuments, 2);
    assert.ok(conflictingDocumentPreview.issues.every(issue => !issue.message.includes('45723174000110')));
    const ignoredDocumentPreview = await service.previewFullSpreadsheetImport({
      ...conflictingDocumentInput,
      mappingOverrides: { CNPJ: null }
    });
    assert.equal(ignoredDocumentPreview.status, 'ready');
    assert.equal(ignoredDocumentPreview.counts.blocking, 0);

    let realImportedProjects = 0;
    let realImportedBudgets = 0;
    try {
      await fs.access(workbookPath);
      const requireFromWeb = createRequire(path.resolve(process.cwd(), 'apps/web/package.json'));
      const excelModule = requireFromWeb('read-excel-file/node') as { readSheet: (file: string) => Promise<unknown[][]> };
      const readXlsx = excelModule.readSheet;
      const sheet = await readXlsx(workbookPath);
      const [headerRow, ...body] = sheet;
      const headers = headerRow.map(value => String(value ?? '').trim());
      const rows = body
        .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])))
        .filter(row => Object.values(row).some(value => value !== null && String(value).trim() !== ''));
      const fileBytes = await fs.readFile(workbookPath);
      const realInput = {
        fileName: 'skygeo.xlsx',
        fileHash: crypto.createHash('sha256').update(fileBytes).digest('hex'),
        headers,
        rows
      };
      const preview = await service.previewFullSpreadsheetImport(realInput);
      assert.equal(headers.length, 64);
      assert.equal(preview.columns.recognized.length, 64);
      assert.equal(preview.counts.rowsRead, 73);
      assert.equal(preview.counts.budgets, 73);
      assert.equal(preview.counts.billings, 73);
      assert.equal(preview.counts.receipts, 0);
      assert.equal(preview.status, 'blocked');
      assert.equal(preview.counts.blocking, 29);
      assert.deepEqual(
        Object.fromEntries(preview.reconciliation.map(item => [item.key, item.spreadsheet])),
        {
          receita: 1_828_393_307,
          custo: 1_162_349_413,
          despesasHistoricas: 238_347_142,
          valorDespesa: 2_035_400,
          receitaEsperada: 150_395_340,
          valorImposto: 17_145_585,
          receitaEsperadaImposto: 167_540_925,
          lucroEsperado: 38_990_623,
          receitaRealizada: 45_709_077,
          valorFaturado: 50_107_600
        }
      );
      assert.ok(preview.reconciliation.every(item => item.difference === 0));
      const reviewedInput = { ...realInput, mappingOverrides: { CPF: null, CNPJ: null } };
      const reviewedPreview = await service.previewFullSpreadsheetImport(reviewedInput);
      assert.equal(reviewedPreview.status, 'ready');
      assert.equal(reviewedPreview.counts.blocking, 0);
      assert.equal(reviewedPreview.counts.invalidDocuments, 0);
      const realResult = await service.commitFullSpreadsheetImport(reviewedInput);
      assert.equal(realResult.status, 'completed');
      assert.equal(realResult.counts.clients, 73);
      assert.equal(realResult.counts.properties, 72);
      assert.equal(realResult.counts.projects, 73);
      assert.equal(realResult.counts.budgets, 73);
      assert.equal(realResult.counts.billings, 73);
      assert.equal(realResult.counts.expenses, 72);
      realImportedProjects = realResult.counts.projects;
      realImportedBudgets = realResult.counts.budgets;
      assert.equal((await db.select().from(schema.clientes)).length, 73);
      assert.equal((await db.select().from(schema.propriedades)).length, 72);
      assert.equal((await db.select().from(schema.projetos)).length, 73);
      assert.equal((await db.select().from(schema.orcamentos)).length, 73);
      assert.equal((await db.select().from(schema.notasFiscais)).length, 73);
      assert.equal((await db.select().from(schema.despesas)).length, 72);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const input = syntheticInput('successful-full-import');
    const preview = await service.previewFullSpreadsheetImport(input);
    assert.equal(preview.status, 'ready');
    assert.equal(preview.counts.clientsCreated, 1);
    assert.equal(preview.counts.properties, 1);
    assert.equal(preview.counts.projects, 1);
    assert.equal(preview.counts.budgets, 1);
    assert.equal(preview.counts.billings, 1);
    assert.equal(preview.counts.receipts, 0);
    assert.equal(preview.counts.expenses, 1);

    const result = await service.commitFullSpreadsheetImport(input);
    assert.equal(result.status, 'completed');
    assert.ok(result.counts.imported > 0);
    assert.equal(result.counts.receipts, 0);
    assert.equal(result.counts.receivables, 0);
    assert.ok(result.reconciliation.every(item => item.difference === 0));

    const [client] = await db.select().from(schema.clientes).where(eq(schema.clientes.nome, 'Cliente Migração Segura'));
    assert.equal(client.telefone, '48999990000');
    assert.equal(client.tipoPessoa, 'PJ');
    const [property] = await db.select().from(schema.propriedades).where(eq(schema.propriedades.clienteId, client.id));
    assert.equal(property.car, null, 'Indicador Sim não pode virar número de CAR');
    const [project] = await db.select().from(schema.projetos).where(eq(schema.projetos.clienteId, client.id));
    assert.equal(project.propriedadeId, property.id);
    assert.equal(project.status, 'Concluído');
    const [budget] = await db.select().from(schema.orcamentos).where(eq(schema.orcamentos.clienteId, client.id));
    assert.equal(budget.valorTotal, 1_050_000);
    assert.equal(budget.status, 'aprovado');
    const [invoice] = await db.select().from(schema.notasFiscais).where(eq(schema.notasFiscais.clienteId, client.id));
    assert.equal(invoice.status, 'emitida');
    assert.equal((await db.select().from(schema.recebimentos)).length, 0);
    assert.equal((await db.select().from(schema.parcelas)).length, 0);
    const [expense] = await db.select().from(schema.despesas).where(eq(schema.despesas.clienteId, client.id));
    assert.equal(expense.status, 'Pendente');
    assert.equal(expense.categoria, 'Outros — revisão necessária');

    const extraProjects = Array.from({ length: 120 }, (_, index) => ({
      id: crypto.randomUUID(), clienteId: client.id, nome: `Projeto de paginação ${index + 1}`, status: 'Em Andamento'
    }));
    await db.insert(schema.projetos).values(extraProjects);
    await db.insert(schema.orcamentos).values(extraProjects.map((project, index) => ({
      id: crypto.randomUUID(), grupoId: crypto.randomUUID(), clienteId: client.id, projetoId: project.id,
      valorTotal: 10_000 + index, status: 'aprovado', descricao: `Orçamento de paginação ${index + 1}`
    })));
    const budgetPage = await server.inject({
      method: 'GET', url: '/api/financeiro/orcamentos?mode=page&page=1&limit=100',
      headers: { 'x-api-token': 'full-import-test-token' }
    });
    assert.equal(budgetPage.statusCode, 200, budgetPage.body);
    const budgetPayload = budgetPage.json<{ items: unknown[]; total: number; totalPages: number }>();
    assert.equal(budgetPayload.items.length, 100);
    assert.equal(budgetPayload.total, 121 + realImportedBudgets);
    assert.equal(budgetPayload.totalPages, 2);
    const projectPage = await server.inject({
      method: 'GET', url: '/api/projetos?mode=page&page=1&limit=48',
      headers: { 'x-api-token': 'full-import-test-token' }
    });
    assert.equal(projectPage.statusCode, 200, projectPage.body);
    const projectPayload = projectPage.json<{ items: unknown[]; total: number; totalPages: number }>();
    assert.equal(projectPayload.items.length, 48);
    assert.equal(projectPayload.total, 121 + realImportedProjects);
    assert.equal(projectPayload.totalPages, Math.ceil((121 + realImportedProjects) / 48));

    await assert.rejects(() => service.commitFullSpreadsheetImport(input), /já foi importado/);

    const rollbackInput = syntheticInput('rollback-full-import', 'Cliente que deve ser revertido');
    AuditLogService.setFailureInjectorForTests(() => { throw new Error('falha de auditoria simulada'); });
    await assert.rejects(() => service.commitFullSpreadsheetImport(rollbackInput), /falha de auditoria simulada/);
    AuditLogService.setFailureInjectorForTests(null);
    assert.equal((await db.select().from(schema.clientes).where(eq(schema.clientes.nome, 'Cliente que deve ser revertido'))).length, 0);
    assert.equal((await db.select().from(schema.configuracoesOperacionais).where(eq(schema.configuracoesOperacionais.chave, `full-spreadsheet-import:${rollbackInput.fileHash}`))).length, 0);
  } finally {
    const { AuditLogService } = await import('./services/audit.service');
    AuditLogService.setFailureInjectorForTests(null);
    closeDb();
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await removeDatabase();
    } catch (error) {
      assert.equal((error as NodeJS.ErrnoException).code, 'EBUSY');
    }
  }
});
