import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { e2eDataDirectory, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const selectedClientId = '11111111-1111-4111-8111-111111111111';
const startedAt = relativeInstant(-1);
const completedAt = new Date(Date.parse(startedAt) + 1_000).toISOString();

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(unlock).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Import Audit');
    await page.getByLabel('Pasta de dados').fill(e2eDataDirectory());
    await page.getByLabel('Nome do administrador').fill('Thalles Import Audit');
    await page.getByLabel('E-mail').fill('import.audit@example.test');
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Concluir configuração' }).click();
    await expect(unlock.or(dashboard)).toBeVisible();
  }
  if (await unlock.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboard).toBeVisible();
}

async function navigate(page: Page, path: string) {
  await page.evaluate(nextPath => {
    history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function selectCustomOption(page: Page, label: string, option: string) {
  const name = label === 'Tipo de importação' ? 'tipo-importacao' : 'entidade';
  const select = page.locator(`select[name="${name}"]`);
  const value = await select.locator('option').filter({ hasText: option }).getAttribute('value');
  if (!value) throw new Error(`A opção "${option}" não existe no seletor "${label}".`);
  await select.selectOption(value);
}

function projectPreview(payload: Array<Record<string, unknown>>) {
  if (payload.length === 1) {
    const item = payload[0];
    if (item.clienteId === selectedClientId) {
      return {
        status: 'ready', counts: { total: 1, automatic: 0, manual: 1, pending: 0, missing: 0, ambiguous: 0, invalid: 0 },
        rows: [{ index: 0, row: 2, projectName: String(item.nome), reference: 'Cliente repetido', status: 'resolved', reason: 'manual', message: 'Cliente confirmado manualmente.', association: { clientId: selectedClientId, clientName: 'Cliente Selecionado', documentMasked: 'CNPJ **.***.***/****-10', municipality: 'Florianópolis', method: 'manual' } }]
      };
    }
  }
  return {
    status: 'blocked', counts: { total: 2, automatic: 1, manual: 0, pending: 1, missing: 0, ambiguous: 1, invalid: 0 },
    rows: [
      { index: 0, row: 2, projectName: 'Projeto automático', reference: 'Cliente Único', status: 'resolved', reason: 'exact_name', message: 'Cliente identificado automaticamente.', association: { clientId: '22222222-2222-4222-8222-222222222222', clientName: 'Cliente Único', documentMasked: null, municipality: 'São José', method: 'exact_name' } },
      { index: 1, row: 3, projectName: 'Projeto ambíguo', reference: 'Cliente repetido', status: 'pending', reason: 'ambiguous', message: 'Cliente ambíguo. Faça a associação manual.' }
    ]
  };
}

async function mockProjectImport(route: Route) {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/api/projetos/lote/clientes')) {
    await route.fulfill({ json: [{ id: selectedClientId, nome: 'Cliente Selecionado', documentoMascarado: 'CNPJ **.***.***/****-10', municipio: 'Florianópolis' }] });
    return;
  }
  const requestBody = route.request().postDataJSON() as Array<Record<string, unknown>> | { rows: Array<Record<string, unknown>> };
  const payload = Array.isArray(requestBody) ? requestBody : requestBody.rows;
  if (url.pathname.endsWith('/preview')) {
    await route.fulfill({ json: projectPreview(payload) });
    return;
  }
  await route.fulfill({ status: 201, json: {
    importId: 'importacao-e2e', status: 'completed', rowsRead: 2, imported: 2, updated: 0, reused: 0, ignored: 0, failed: 0, pendingReview: 0,
    startedAt, completedAt, durationMs: 1000,
    results: [
      { index: 0, row: 2, status: 'success', association: { clientId: '22222222-2222-4222-8222-222222222222', clientName: 'Cliente Único', method: 'exact_name' } },
      { index: 1, row: 3, status: 'success', association: { clientId: selectedClientId, clientName: 'Cliente Selecionado', method: 'manual' } }
    ]
  } });
}

test.describe('importador acessível e associação manual', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await unlock(page);
    await navigate(page, '/importacao');
    await expect(page.getByRole('heading', { name: 'Importação de dados' })).toBeVisible();
  });

  test('aviso e exemplo são acessíveis por teclado', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Antes de importar sua planilha' })).toBeVisible();
    const example = page.getByText('Ver exemplo de planilha bem estruturada');
    await example.focus();
    await expect(example).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('columnheader', { name: 'Cliente' })).toBeVisible();
  });

  test('bloqueia, foca, associa uma linha e registra o critério no resultado', async ({ page }) => {
    await page.route('**/api/projetos/lote**', mockProjectImport);
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Projetos');
    await page.locator('#import-file').setInputFiles({ name: 'projetos.csv', mimeType: 'text/csv', buffer: Buffer.from('Projeto,Cliente\nProjeto automático,Cliente Único\nProjeto ambíguo,Cliente repetido') });

    await expect(page.getByText('A confirmação está bloqueada até que todas as linhas tenham um cliente definido.')).toBeVisible();
    const pendingRow = page.locator('#project-association-pending-1');
    await expect(pendingRow).toBeFocused();
    const confirm = page.getByRole('button', { name: 'Concluir importação' });
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveClass(/cursor-not-allowed/);
    await expect(confirm).not.toContainText('Gravando');

    const firstError = page.getByRole('button', { name: /Ir ao primeiro erro/ });
    await firstError.focus();
    await page.keyboard.press('Enter');
    await expect(pendingRow).toBeFocused();

    const clientSearch = page.getByLabel('Pesquisar cliente ativo');
    await clientSearch.fill('Cliente Selecionado');
    await expect(page.getByRole('option', { name: /Cliente Selecionado/ })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Confirmação manual').first()).toBeVisible();
    await expect(page.getByText('A confirmação está bloqueada até que todas as linhas tenham um cliente definido.')).toHaveCount(0);

    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(review).toBeEnabled();
    await review.focus();
    await page.keyboard.press('Space');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Associações dos projetos importados' })).toBeVisible();
    await expect(page.getByText('Cliente Selecionado')).toBeVisible();
    await expect(page.getByText('Confirmação manual')).toBeVisible();
    await page.getByRole('button', { name: 'Conferir Projetos' }).click();
    await expect(page).toHaveURL(/\/projetos(?:\?.*)?$/);
  });

  test('apresenta sucesso parcial e falha individual por linha', async ({ page }) => {
    await page.route('**/api/contatos/lote', route => route.fulfill({ status: 201, json: {
      importId: 'parcial-e2e', status: 'partial', rowsRead: 2, imported: 1, updated: 0, reused: 0, ignored: 0, failed: 1, pendingReview: 1,
      startedAt, completedAt, durationMs: 1000,
      results: [{ index: 0, row: 2, status: 'success' }, { index: 1, row: 3, status: 'failed', errors: ['Informe o nome do contato.'] }]
    } }));
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles({ name: 'contatos.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome,Email\nContato Válido,valido@example.test\n,semnome@example.test') });
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await review.focus();
    await page.keyboard.press('Space');
    await expect(review).toBeChecked();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída parcialmente' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Informe o nome do contato.' })).toBeVisible();
  });

  test('não mostra sucesso quando nenhuma linha é gravada', async ({ page }) => {
    await page.route('**/api/contatos/lote', route => route.fulfill({ status: 201, json: {
      importId: 'zero-e2e', status: 'failed', rowsRead: 1, imported: 0, updated: 0, reused: 0, ignored: 0, failed: 1, pendingReview: 1,
      startedAt, completedAt, durationMs: 1000,
      results: [{ index: 0, row: 2, status: 'failed', errors: ['Informe o nome do contato.'] }]
    } }));
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles({ name: 'contatos.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome,Email\n,semnome@example.test') });
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await review.focus();
    await page.keyboard.press('Space');
    await expect(review).toBeChecked();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Nenhum registro foi importado' })).toBeVisible();
    await expect(page.getByText('Todos os registros válidos foram gravados.')).toHaveCount(0);
  });

  test('CSV sintético percorre interface, API real e listagem de contatos', async ({ page }) => {
    const contactName = 'QA-IMPORT-20260923-2320-Contato Integrado';
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(path.resolve(
      'docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-sintetico.csv'
    ));
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(review).toBeEnabled();
    await review.focus();
    await page.keyboard.press('Space');
    await expect(review).toBeChecked();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await expect(page.getByText('Linhas lidas')).toBeVisible();
    await page.getByRole('button', { name: 'Conferir Contatos' }).click();
    await expect(page).toHaveURL(/\/crm\?view=leads$/);
    await page.getByRole('searchbox', { name: 'Buscar leads' }).fill(contactName);
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
  });

  test('CSV com BOM, ponto e vírgula, linha vazia e aspas multilinha preserva linha física', async ({ page }) => {
    const fixturePath = path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-bom-multilinha.csv');
    const contactName = 'QA-IMPORT-20260924-Contato BOM';
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(fixturePath);
    await expect(page.getByText('1 registros encontrados para contatos.')).toBeVisible();
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await review.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      const contacts = await database.execute({ sql: 'SELECT id, observacoes FROM contatos WHERE nome = ?', args: [contactName] });
      expect(contacts.rows).toHaveLength(1);
      expect(String(contacts.rows[0].observacoes)).toContain('Segunda linha com "aspas"');
      const lines = await database.execute({
        sql: 'SELECT ir.row_number FROM import_rows ir JOIN import_runs run ON run.id = ir.import_id WHERE run.entity = ? AND ir.record_id = ?',
        args: ['contatos', String(contacts.rows[0].id)]
      });
      expect(lines.rows).toHaveLength(1);
      expect(Number(lines.rows[0].row_number)).toBe(3);
    } finally {
      database.close();
    }
  });

  test('XLSX sintético escolhe a aba de dados e importa contato pela API real', async ({ page }) => {
    const contactName = 'QA-IMPORT-20260923-2320-Contato XLSX';
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(path.resolve(
      'docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-sintetico.xlsx'
    ));
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(review).toBeEnabled();
    await review.focus();
    await page.keyboard.press('Space');
    await expect(review).toBeChecked();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await page.getByRole('button', { name: 'Conferir Contatos' }).click();
    await expect(page).toHaveURL(/\/crm\?view=leads$/);
    await page.getByRole('searchbox', { name: 'Buscar leads' }).fill(contactName);
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
  });

  test('CSV sintético ambíguo exige escolher manualmente a linha de cabeçalho', async ({ page }) => {
    const contactName = 'QA-IMPORT-20260923-2320-Contato Cabeçalho';
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(path.resolve(
      'docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-cabecalho-ambiguo.csv'
    ));
    await expect(page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' })).toBeVisible();
    await expect(page.getByLabel('Linha com os nomes das colunas')).toBeFocused();
    await expect(page.getByRole('checkbox', { name: /Revisei o mapeamento/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Usar esta linha e gerar prévia' })).toBeDisabled();
    await page.getByLabel('Linha com os nomes das colunas').selectOption('0');
    await page.getByRole('button', { name: 'Usar esta linha e gerar prévia' }).click();
    await expect(page.getByText('1 registros encontrados para contatos.')).toBeVisible();
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await review.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await page.getByRole('button', { name: 'Conferir Contatos' }).click();
    await page.getByRole('searchbox', { name: 'Buscar leads' }).fill(contactName);
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
  });

  test('XLSX com cabeçalho ambíguo exige escolha manual antes da importação', async ({ page }) => {
    const contactName = 'QA-IMPORT-20260923-2320-Contato XLSX Cabeçalho';
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(path.resolve(
      'docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-cabecalho-ambiguo.xlsx'
    ));
    await expect(page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' })).toBeVisible();
    await page.getByLabel('Linha com os nomes das colunas').selectOption('0');
    await page.getByRole('button', { name: 'Usar esta linha e gerar prévia' }).click();
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(review).toBeEnabled();
    await review.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await page.getByRole('button', { name: 'Conferir Contatos' }).click();
    await page.getByRole('searchbox', { name: 'Buscar leads' }).fill(contactName);
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
  });

  test('migração completa com cabeçalho ambíguo exige escolha antes da prévia', async ({ page }) => {
    await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
    await page.locator('#import-file').setInputFiles(path.resolve(
      'docs/auditorias/2026-09-23-importacao-planilhas/evidencias/migracao-cabecalho-ambiguo.csv'
    ));
    await expect(page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar migração completa' })).toHaveCount(0);
    await page.getByLabel('Linha com os nomes das colunas').selectOption('0');
    await page.getByRole('button', { name: 'Usar esta linha e gerar prévia' }).click();
    await expect(page.getByText('Planilha pronta para confirmação')).toBeVisible();
    await expect(page.getByText('1 registros encontrados')).toBeVisible();
  });

  test('troca de arquivo invalida prévia anterior e seleção manual funciona por teclado', async ({ page }) => {
    const fixtures = path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias');
    await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'migracao-cabecalho-ambiguo.csv'));
    const header = page.getByLabel('Linha com os nomes das colunas');
    await expect(header).toBeFocused();
    await expect(page.getByRole('button', { name: 'Usar esta linha e gerar prévia' })).toBeDisabled();
    await header.press('ArrowDown');
    await expect(header).toHaveValue('0');
    await header.press('Tab');
    await expect(page.getByRole('button', { name: 'Usar esta linha e gerar prévia' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Planilha pronta para confirmação')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'contato-cabecalho-ambiguo.xlsx'));
    await expect(page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' })).toBeVisible();
    await expect(page.getByText('Planilha pronta para confirmação')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirmar migração completa' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Usar esta linha e gerar prévia' })).toBeDisabled();

    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'migracao-cabecalho-ambiguo.csv'));
    await expect(page.getByRole('button', { name: 'Usar esta linha e gerar prévia' })).toBeDisabled();
    await expect(page.getByLabel('Linha com os nomes das colunas')).toHaveValue('');
  });

  test('arquivo XLSX corrompido é recusado antes de gerar prévia', async ({ page }) => {
    await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
    await page.locator('#import-file').setInputFiles({
      name: 'QA-IMPORT-20260924-corrompido.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('conteudo-sintetico-invalido')
    });
    await expect(page.getByRole('alert').filter({ hasText: /não|invalid|zip|unsupported|arquivo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar migração completa' })).toHaveCount(0);
  });

  test('matriz hostil pequena é recusada pela interface antes da prévia', async ({ page }) => {
    await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
    const fixture = readFileSync(path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-sintetico.xlsx'));
    const central = fixture.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(central).toBeGreaterThan(0);
    const encrypted = Buffer.from(fixture);
    encrypted.writeUInt16LE(encrypted.readUInt16LE(central + 8) | 1, central + 8);
    const expanded = Buffer.from(fixture);
    expanded.writeUInt32LE(65 * 1024 * 1024, central + 24);
    const fflate = createRequire(path.resolve('apps/web/package.json'))('fflate') as {
      unzipSync: (data: Uint8Array) => Record<string, Uint8Array>;
      zipSync: (data: Record<string, Uint8Array>, options?: { mtime: Date }) => Uint8Array;
    };
    const xmlFiles = fflate.unzipSync(fixture);
    xmlFiles['xl/workbook.xml'] = new TextEncoder().encode('<workbook><broken>');
    const brokenXml = Buffer.from(fflate.zipSync(xmlFiles, { mtime: new Date('2020-01-01T00:00:00Z') }));
    const cases = [
      { name: 'invalid-utf8.csv', buffer: Buffer.from([0x4e, 0x6f, 0x6d, 0x65, 0x0a, 0xff]), error: /UTF-8/ },
      { name: 'zip-as-csv.csv', buffer: fixture, error: /extensão CSV/ },
      { name: 'text-as-xlsx.xlsx', buffer: Buffer.from('Nome\nTeste'), error: /não corresponde/ },
      { name: 'encrypted.xlsx', buffer: encrypted, error: /protegido/ },
      { name: 'truncated.xlsx', buffer: fixture.subarray(0, fixture.length - 5), error: /ZIP/ },
      { name: 'expanded.xlsx', buffer: expanded, error: /limite de expansão/ },
      { name: 'broken-xml.xlsx', buffer: brokenXml, error: /Não foi possível ler o XLSX/ }
    ];
    for (const item of cases) {
      const sha256 = crypto.createHash('sha256').update(item.buffer).digest('hex');
      await page.locator('#import-file').setInputFiles({ name: item.name, mimeType: 'application/octet-stream', buffer: item.buffer });
      await expect(page.getByRole('alert').filter({ hasText: item.error })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirmar migração completa' })).toHaveCount(0);
      console.log('[QA-IMPORT-HOSTIL]', JSON.stringify({ fixture: item.name, sha256, bytes: item.buffer.length, observed: 'rejected-before-preview' }));
    }
  });

  test('limite de 20 MiB pela interface aceita o tamanho exato e rejeita um byte acima', async ({ page }) => {
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    const exact = Buffer.alloc(20 * 1024 * 1024, 0x61);
    exact.write('Nome\nQA-IMPORT-', 0, 'utf8');
    const above = Buffer.concat([exact, Buffer.from('a')]);
    await page.locator('#import-file').setInputFiles({ name: 'above-20-mib.csv', mimeType: 'text/csv', buffer: above });
    await expect(page.getByRole('alert').filter({ hasText: /limite é 20 MB/ })).toBeVisible();
    await page.locator('#import-file').setInputFiles({ name: 'exact-20-mib.csv', mimeType: 'text/csv', buffer: exact });
    await expect(page.getByRole('alert').filter({ hasText: /célula com mais de 20.000 caracteres/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('alert').filter({ hasText: /limite é 20 MB/ })).toHaveCount(0);
    console.log('[QA-IMPORT-LIMITE]', JSON.stringify({ exact: { bytes: exact.length, sha256: crypto.createHash('sha256').update(exact).digest('hex'), observed: 'accepted-by-file-gate-rejected-by-cell-limit' }, above: { bytes: above.length, sha256: crypto.createHash('sha256').update(above).digest('hex'), observed: 'rejected-by-file-gate' } }));
  });

  test('importação mantém leitura em 360, 768, 1024 e 1440 px com verificação axe auxiliar', async ({ page }) => {
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-sintetico.csv'));
    await expect(page.getByRole('checkbox', { name: /Revisei o mapeamento/ })).toBeVisible();
    const layouts = [];
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const state = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      layouts.push({ width, ...state });
      expect(state.scroll).toBeLessThanOrEqual(state.viewport + 1);
      await expect(page.getByRole('checkbox', { name: /Revisei o mapeamento/ })).toBeVisible();
    }
    await page.evaluate(() => { document.documentElement.style.zoom = '200%'; });
    const zoom = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(zoom.scroll).toBeLessThanOrEqual(zoom.viewport + 1);
    await expect(page.getByRole('checkbox', { name: /Revisei o mapeamento/ })).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    console.log('[QA-IMPORT-ACESSIBILIDADE]', JSON.stringify({ layouts, cssZoom200: zoom, axeViolations: axe.violations.map(item => ({ id: item.id, impact: item.impact, count: item.nodes.length })) }));
    expect(axe.violations).toHaveLength(0);
  });

  test('cabeçalho fora das 20 primeiras linhas recebe orientação sem prévia', async ({ page }) => {
    const content = `${Array.from({ length: 20 }, (_, index) => `Título ${index + 1}`).join('\n')}\nCliente,Projeto\nQA-IMPORT-20260924-Cliente,Projeto`;
    await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
    await page.locator('#import-file').setInputFiles({ name: 'QA-IMPORT-20260924-cabecalho-linha-21.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });
    await expect(page.getByRole('alert').filter({ hasText: /depois das 20 primeiras linhas/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar migração completa' })).toHaveCount(0);
  });

  test('CSV sintético cria cliente e projeto associado pela interface e API reais', async ({ page }) => {
    const clientName = 'QA-IMPORT-20260923-2320-Cliente Simples';
    const projectName = 'QA-IMPORT-20260923-2320-Projeto Simples';
    const fixtures = path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias');
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Clientes');
    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'cliente-sintetico.csv'));
    const clientReview = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(clientReview).toBeEnabled();
    await clientReview.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();

    await page.getByRole('button', { name: 'Nova importação' }).click();
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Projetos');
    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'projeto-sintetico.csv'));
    await expect(page.getByText('A confirmação está bloqueada até que todas as linhas tenham um cliente definido.')).toHaveCount(0);
    const projectReview = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(projectReview).toBeEnabled();
    await projectReview.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();

    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      const clients = await database.execute({ sql: 'SELECT id, telefone FROM clientes WHERE nome = ?', args: [clientName] });
      expect(clients.rows).toHaveLength(1);
      expect(String(clients.rows[0].telefone).replace(/\D/gu, '')).toBe('48988887777');
      const projects = await database.execute({ sql: 'SELECT id, cliente_id FROM projetos WHERE nome = ?', args: [projectName] });
      expect(projects.rows).toHaveLength(1);
      expect(projects.rows[0].cliente_id).toBe(clients.rows[0].id);
      const runs = await database.execute({ sql: "SELECT status, import_type FROM import_runs WHERE import_type = 'simple' ORDER BY created_at DESC LIMIT 2", args: [] });
      expect(runs.rows).toHaveLength(2);
      expect(runs.rows.every(row => row.status === 'completed')).toBe(true);
      console.log('[QA-IMPORT] cliente/projeto simples', JSON.stringify({ clientId: clients.rows[0].id, projectId: projects.rows[0].id }));
    } finally {
      database.close();
    }
    await page.getByRole('button', { name: 'Conferir Projetos' }).click();
    await expect(page).toHaveURL(/\/projetos(?:\?.*)?$/);
    await expect(page.getByText(projectName).first()).toBeVisible();
  });

  test('lotes parciais de Clientes e Contatos e bloqueio de duplicata de Projeto na interface real', async ({ page }) => {
    const inputs = [
      {
        entity: 'Clientes', endpoint: '/api/clientes/lote', name: 'qa-recon-clientes.csv',
        content: 'Nome,CPF,Telefone,Tipo de pessoa\nQA-RECON-Cliente,12345678909,48988887777,PF\nQA-RECON-Duplicado,12345678909,48988887778,PF\nQA-RECON-Inválido,123,48988887779,PF',
        expected: { imported: 1, failed: 2, rows: [2, 3, 4] }
      },
      {
        entity: 'Contatos', endpoint: '/api/contatos/lote', name: 'qa-recon-contatos.csv',
        content: 'Nome,Email\nQA-RECON-Contato,qa.recon@example.test\nQA-RECON-Duplicado,qa.recon@example.test\n,invalid',
        expected: { imported: 1, failed: 2, rows: [2, 3, 4] }
      },
      {
        entity: 'Projetos', endpoint: '/api/projetos/lote', name: 'qa-recon-projetos.csv',
        content: 'Projeto,Cliente\nQA-RECON-Projeto,QA-RECON-Cliente\nQA-RECON-Projeto,QA-RECON-Cliente',
        expected: { imported: 1, failed: 1, rows: [2, 3] }
      }
    ];
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    const captured = [];
    for (const [index, input] of inputs.entries()) {
      await selectCustomOption(page, 'Entidade de destino', input.entity);
      const projectPreviewPromise = input.entity === 'Projetos'
        ? page.waitForResponse(response => response.url().includes('/api/projetos/lote/preview') && response.request().method() === 'POST')
        : null;
      await page.locator('#import-file').setInputFiles({ name: input.name, mimeType: 'text/csv', buffer: Buffer.from(input.content) });
      const chooseHeader = page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' });
      const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
      await expect(chooseHeader.or(review)).toBeVisible();
      if (await chooseHeader.isVisible()) {
        await page.getByLabel('Linha com os nomes das colunas').selectOption('0');
        await page.getByRole('button', { name: 'Usar esta linha e gerar prévia' }).click();
      }
      if (input.entity === 'Projetos') {
        const previewResponse = await projectPreviewPromise;
        expect(previewResponse?.status()).toBe(200);
        await expect(page.getByRole('alert').filter({ hasText: /confirmação está bloqueada/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Concluir importação' })).toBeDisabled();
        captured.push({ entity: input.entity, sha256: crypto.createHash('sha256').update(input.content).digest('hex'), bytes: Buffer.byteLength(input.content), http: previewResponse!.status(), importId: '', rows: [] });
        continue;
      }
      await review.focus();
      await page.keyboard.press('Space');
      const responsePromise = page.waitForResponse(response => response.url().includes(input.endpoint) && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Concluir importação' }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const result = await response.json() as { importId: string; status: string; rowsRead: number; imported: number; updated: number; failed: number; results: Array<{ row: number; status: string; id?: string }> };
      expect([result.status, result.rowsRead, result.imported, result.updated, result.failed]).toEqual(['partial', input.expected.rows.length, input.expected.imported, 0, input.expected.failed]);
      expect(result.results.map(row => row.row)).toEqual(input.expected.rows);
      await expect(page.getByRole('heading', { name: 'Importação concluída parcialmente' })).toBeVisible();
      captured.push({ entity: input.entity, sha256: crypto.createHash('sha256').update(input.content).digest('hex'), bytes: Buffer.byteLength(input.content), http: response.status(), importId: result.importId, rows: result.results });
      if (index < inputs.length - 1) {
        await page.getByRole('button', { name: 'Nova importação' }).click();
        await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
      }
    }
    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      for (const item of captured) {
        if (!item.importId) continue;
        const rows = await database.execute({ sql: 'SELECT row_number, status, record_id FROM import_rows WHERE import_id = ? ORDER BY row_number', args: [item.importId] });
        expect(rows.rows.map(row => [Number(row.row_number), row.status])).toEqual(item.rows.map(row => [row.row, row.status]));
      }
      const clients = await database.execute({ sql: "SELECT id FROM clientes WHERE nome = 'QA-RECON-Cliente'", args: [] });
      const contacts = await database.execute({ sql: "SELECT id FROM contatos WHERE nome = 'QA-RECON-Contato'", args: [] });
      const projects = await database.execute({ sql: "SELECT id, cliente_id FROM projetos WHERE nome = 'QA-RECON-Projeto'", args: [] });
      expect([clients.rows.length, contacts.rows.length, projects.rows.length]).toEqual([1, 1, 0]);
      expect(clients.rows[0].id).toBe(captured[0].rows[0].id);
      expect(contacts.rows[0].id).toBe(captured[1].rows[0].id);
      console.log('[QA-IMPORT-RECON-UI]', JSON.stringify({ captured, clientId: clients.rows[0].id, contactId: contacts.rows[0].id, persistedProjects: 0, financialDifferenceCents: 0 }));
    } finally {
      database.close();
    }
  });

  test('projeto com clientes homônimos exige associação manual na interface real', async ({ page }) => {
    const fixtures = path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias');
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Clientes');
    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'clientes-homonimos.csv'));
    const clientReview = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    const chooseHeader = page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' });
    await expect(chooseHeader.or(clientReview)).toBeVisible();
    if (await chooseHeader.isVisible()) {
      await page.getByLabel('Linha com os nomes das colunas').selectOption('0');
      await page.getByRole('button', { name: 'Usar esta linha e gerar prévia' }).click();
    }
    await clientReview.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await page.getByRole('button', { name: 'Nova importação' }).click();
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Projetos');
    await page.locator('#import-file').setInputFiles(path.join(fixtures, 'projeto-homonimo.csv'));
    await expect(page.getByRole('heading', { name: 'Conferência dos clientes dos projetos' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /confirmação está bloqueada/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concluir importação' })).toBeDisabled();
    const association = page.getByRole('combobox', { name: 'Pesquisar cliente ativo' });
    await association.fill('QA-IMPORT-20260924-Cliente Homônimo');
    await expect(page.getByRole('option', { name: /QA-IMPORT-20260924-Cliente Homônimo/ })).toHaveCount(2);
    await page.getByRole('option', { name: /QA-IMPORT-20260924-Cliente Homônimo/ }).first().click();
    await expect(page.getByText('Confirmação manual')).toBeVisible();
    const projectReview = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await projectReview.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      const clients = await database.execute({ sql: 'SELECT id FROM clientes WHERE nome = ?', args: ['QA-IMPORT-20260924-Cliente Homônimo'] });
      expect(clients.rows).toHaveLength(2);
      const project = await database.execute({ sql: 'SELECT id, cliente_id FROM projetos WHERE nome = ?', args: ['QA-IMPORT-20260924-Projeto Manual'] });
      expect(project.rows).toHaveLength(1);
      expect(clients.rows.some(client => client.id === project.rows[0].cliente_id)).toBe(true);
      const importRows = await database.execute({ sql: 'SELECT association_method FROM import_rows WHERE record_id = ?', args: [String(project.rows[0].id)] });
      expect(importRows.rows).toHaveLength(1);
      expect(importRows.rows[0].association_method).toBe('manual');
    } finally {
      database.close();
    }
  });

  test('interface bloqueia associação inexistente, inativa, excluída e homônima sem executar texto hostil', async ({ page }) => {
    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    const clientRows = [
      [crypto.randomUUID(), 'QA-AUDIT-Inativo', 'Inativo', null],
      [crypto.randomUUID(), 'QA-AUDIT-Excluído', 'Ativo', new Date().toISOString()],
      [crypto.randomUUID(), 'QA-AUDIT-Homônimo', 'Ativo', null],
      [crypto.randomUUID(), 'QA-AUDIT-Homônimo', 'Ativo', null]
    ];
    try {
      for (const client of clientRows) {
        await database.execute({ sql: 'INSERT INTO clientes (id, nome, situacao, deleted_at) VALUES (?, ?, ?, ?)', args: client });
      }
    } finally {
      database.close();
    }
    const xss = '<img src=x onerror="window.__geoXss=1">';
    const formula = '=1+1';
    const csv = `Projeto,Cliente\n${xss},QA-AUDIT-Inexistente\n${formula},QA-AUDIT-Inativo\nQA-AUDIT-Projeto Excluído,QA-AUDIT-Excluído\nQA-AUDIT-Projeto Homônimo,QA-AUDIT-Homônimo`;
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Projetos');
    const previewResponsePromise = page.waitForResponse(response => response.url().includes('/api/projetos/lote/preview'));
    await page.locator('#import-file').setInputFiles({ name: 'associacoes-pendentes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    const previewResponse = await previewResponsePromise;
    expect(previewResponse.status()).toBe(200);
    const previewBody = await previewResponse.json() as { counts: { total: number; pending: number; missing: number; ambiguous: number } };
    expect(previewBody.counts).toMatchObject({ total: 4, pending: 4, missing: 3, ambiguous: 1 });
    await expect(page.getByRole('heading', { name: 'Conferência dos clientes dos projetos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concluir importação' })).toBeDisabled();
    await expect(page.getByText(xss, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(formula, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as Window & { __geoXss?: number }).__geoXss)).toBeUndefined();
    await expect(page.locator('table img')).toHaveCount(0);
    const searches = page.getByRole('combobox', { name: 'Pesquisar cliente ativo' });
    await expect(searches).toHaveCount(4);
    await searches.nth(1).fill('QA-AUDIT-Inativo');
    await expect(page.getByRole('option', { name: 'QA-AUDIT-Inativo' })).toHaveCount(0);
    await searches.nth(2).fill('QA-AUDIT-Excluído');
    await expect(page.getByRole('option', { name: 'QA-AUDIT-Excluído' })).toHaveCount(0);
    await searches.nth(3).fill('QA-AUDIT-Homônimo');
    await expect(page.getByRole('option', { name: 'QA-AUDIT-Homônimo' })).toHaveCount(2);
    const verify = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      const projects = await verify.execute({ sql: "SELECT id FROM projetos WHERE nome LIKE 'QA-AUDIT-Projeto%' OR nome LIKE '<img%' OR nome = '=1+1'", args: [] });
      expect(projects.rows).toHaveLength(0);
    } finally {
      verify.close();
    }
    console.log('[QA-IMPORT-ASSOCIACAO]', JSON.stringify({ sha256: crypto.createHash('sha256').update(csv).digest('hex'), previewHttpStatus: previewResponse.status(), counts: previewBody.counts, persistedProjects: 0, xssExecuted: false, formulaRenderedAsText: true }));
  });

  test('migração completa sintética percorre prévia, worker e consumidor', async ({ page }) => {
    const fixturePath = path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias/migracao-sintetica.csv');
    const fileHash = crypto.createHash('sha256').update(readFileSync(fixturePath)).digest('hex');
    await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
    await page.locator('#import-file').setInputFiles(fixturePath);
    await expect(page.getByText('Planilha pronta para confirmação')).toBeVisible();
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(review).toBeEnabled();
    await review.focus();
    await page.keyboard.press('Space');
    await expect(review).toBeChecked();
    await page.getByRole('button', { name: 'Confirmar migração completa' }).click();
    await expect(page.getByText('Migração concluída e conciliada')).toBeVisible({ timeout: 30_000 });
    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      const clients = await database.execute({
        sql: 'SELECT id FROM clientes WHERE nome = ?', args: ['QA-IMPORT-20260923-2320-Cliente Migração']
      });
      expect(clients.rows).toHaveLength(1);
      const clientId = String(clients.rows[0].id);
      const properties = await database.execute({ sql: 'SELECT id, cliente_id FROM propriedades WHERE nome = ?', args: ['QA-IMPORT-20260923-2320-Propriedade'] });
      expect(properties.rows).toHaveLength(1);
      expect(properties.rows[0].cliente_id).toBe(clientId);
      const projects = await database.execute({ sql: 'SELECT id, cliente_id, propriedade_id FROM projetos WHERE nome = ?', args: ['QA-IMPORT-20260923-2320-Projeto'] });
      expect(projects.rows).toHaveLength(1);
      expect(projects.rows[0].cliente_id).toBe(clientId);
      expect(projects.rows[0].propriedade_id).toBe(properties.rows[0].id);
      const projectId = String(projects.rows[0].id);
      const budgets = await database.execute({ sql: 'SELECT id, cliente_id, projeto_id, valor_total FROM orcamentos WHERE projeto_id = ?', args: [projectId] });
      expect(budgets.rows).toHaveLength(1);
      expect(budgets.rows[0].cliente_id).toBe(clientId);
      expect(Number(budgets.rows[0].valor_total)).toBe(210_000);
      const budgetItems = await database.execute({ sql: 'SELECT quantidade, valor_unitario, total FROM orcamento_itens WHERE orcamento_id = ?', args: [String(budgets.rows[0].id)] });
      expect(budgetItems.rows).toHaveLength(1);
      expect(Number(budgetItems.rows[0].quantidade)).toBe(2);
      expect(Number(budgetItems.rows[0].valor_unitario)).toBe(100_000);
      expect(Number(budgetItems.rows[0].total)).toBe(200_000);
      const billings = await database.execute({ sql: 'SELECT id, cliente_id, projeto_id, orcamento_id, valor FROM notas_fiscais WHERE projeto_id = ?', args: [projectId] });
      expect(billings.rows).toHaveLength(1);
      expect(billings.rows[0].cliente_id).toBe(clientId);
      expect(billings.rows[0].orcamento_id).toBe(budgets.rows[0].id);
      expect(Number(billings.rows[0].valor)).toBe(210_000);
      const expenses = await database.execute({ sql: 'SELECT id, cliente_id, projeto_id, valor FROM despesas WHERE projeto_id = ?', args: [projectId] });
      expect(expenses.rows).toHaveLength(1);
      expect(expenses.rows[0].cliente_id).toBe(clientId);
      expect(Number(expenses.rows[0].valor)).toBe(35_000);
      const receivables = await database.execute({ sql: 'SELECT id FROM parcelas WHERE orcamento_id = ?', args: [String(budgets.rows[0].id)] });
      expect(receivables.rows).toHaveLength(0);
      const receipts = await database.execute({ sql: 'SELECT r.id FROM recebimentos r JOIN parcelas p ON p.id = r.parcela_id WHERE p.orcamento_id = ?', args: [String(budgets.rows[0].id)] });
      expect(receipts.rows).toHaveLength(0);
      const ledgers = await database.execute({ sql: 'SELECT valor_json FROM configuracoes_operacionais WHERE chave = ?', args: [`full-spreadsheet-import:${fileHash}`] });
      expect(ledgers.rows).toHaveLength(1);
      const ledger = JSON.parse(String(ledgers.rows[0].valor_json)) as { historicalSnapshot: Record<string, number> };
      expect(ledger.historicalSnapshot.receita).toBe(200_000);
      expect(ledger.historicalSnapshot.custo).toBe(120_000);
      expect(ledger.historicalSnapshot.despesasHistoricas).toBe(35_000);
      expect(ledger.historicalSnapshot.receitaRealizada).toBe(0);
      const runs = await database.execute({ sql: "SELECT id, status, source_hash, imported_count FROM import_runs WHERE import_type = 'complete' AND source_hash = ?", args: [fileHash] });
      expect(runs.rows).toHaveLength(1);
      expect(runs.rows[0].status).toBe('completed_with_warnings');
      expect(Number(runs.rows[0].imported_count)).toBe(7);
      console.log('[QA-IMPORT] reconciliação sintética', JSON.stringify({
        runId: runs.rows[0].id, clientId, propertyId: properties.rows[0].id,
        projectId, budgetId: budgets.rows[0].id, billingId: billings.rows[0].id,
        expenseId: expenses.rows[0].id, budgetCents: 210_000, billingCents: 210_000,
        expenseCents: 35_000, sourceHash: fileHash
      }));
    } finally {
      database.close();
    }
    await navigate(page, '/clientes');
    await expect(page.getByRole('link', { name: 'Abrir cadastro de QA-IMPORT-20260923-2320-Cliente Migração' }).first()).toBeVisible();
  });

  for (const format of ['csv', 'xlsx'] as const) {
    test(`migração completa ${format.toUpperCase()} de duas linhas reconcilia vínculos e centavos`, async ({ page }) => {
      const fixturePath = path.resolve(`docs/auditorias/2026-09-23-importacao-planilhas/evidencias/migracao-multilinha.${format}`);
      const fileHash = crypto.createHash('sha256').update(readFileSync(fixturePath)).digest('hex');
      const marker = format === 'xlsx' ? 'Multilinha XLSX' : 'Multilinha';
      await selectCustomOption(page, 'Tipo de importação', 'Migração completa de planilha');
      await page.locator('#import-file').setInputFiles(fixturePath);
      await expect(page.getByText('Planilha pronta para confirmação')).toBeVisible();
      const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
      await review.focus();
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: 'Confirmar migração completa' }).click();
      await expect(page.getByText('Migração concluída e conciliada')).toBeVisible({ timeout: 30_000 });
      const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
      if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
      const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
      const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
      try {
        const clients = await database.execute({ sql: 'SELECT id, nome FROM clientes WHERE nome LIKE ?', args: [`QA-IMPORT-20260924-Cliente ${marker} %`] });
        expect(clients.rows).toHaveLength(2);
        const projects = await database.execute({
          sql: 'SELECT p.id, p.cliente_id, p.propriedade_id FROM projetos p WHERE p.nome LIKE ?',
          args: [`QA-IMPORT-20260924-Projeto ${marker} %`]
        });
        expect(projects.rows).toHaveLength(2);
        for (const project of projects.rows) {
          expect(clients.rows.some(client => client.id === project.cliente_id)).toBe(true);
          const properties = await database.execute({ sql: 'SELECT cliente_id FROM propriedades WHERE id = ?', args: [String(project.propriedade_id)] });
          expect(properties.rows).toHaveLength(1);
          expect(properties.rows[0].cliente_id).toBe(project.cliente_id);
        }
        const budgets = await database.execute({
          sql: 'SELECT SUM(o.valor_total) AS cents, COUNT(*) AS total FROM orcamentos o JOIN projetos p ON p.id = o.projeto_id WHERE p.nome LIKE ?',
          args: [`QA-IMPORT-20260924-Projeto ${marker} %`]
        });
        expect(Number(budgets.rows[0].total)).toBe(2);
        expect(Number(budgets.rows[0].cents)).toBe(483_000);
        const billings = await database.execute({
          sql: 'SELECT SUM(n.valor) AS cents, COUNT(*) AS total FROM notas_fiscais n JOIN projetos p ON p.id = n.projeto_id WHERE p.nome LIKE ?',
          args: [`QA-IMPORT-20260924-Projeto ${marker} %`]
        });
        expect(Number(billings.rows[0].total)).toBe(2);
        expect(Number(billings.rows[0].cents)).toBe(483_000);
        const expenses = await database.execute({
          sql: 'SELECT SUM(d.valor) AS cents, COUNT(*) AS total FROM despesas d JOIN projetos p ON p.id = d.projeto_id WHERE p.nome LIKE ?',
          args: [`QA-IMPORT-20260924-Projeto ${marker} %`]
        });
        expect(Number(expenses.rows[0].total)).toBe(2);
        expect(Number(expenses.rows[0].cents)).toBe(80_500);
        const ledgers = await database.execute({ sql: 'SELECT valor_json FROM configuracoes_operacionais WHERE chave = ?', args: [`full-spreadsheet-import:${fileHash}`] });
        expect(ledgers.rows).toHaveLength(1);
        const ledger = JSON.parse(String(ledgers.rows[0].valor_json)) as { sourceReferences: number[] };
        expect(ledger.sourceReferences).toEqual(format === 'csv' ? [2, 4] : [2, 3]);
      } finally {
        database.close();
      }
    });
  }

  test('cache de esquemas corrompido não derruba a área administrativa', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('import_schemas', '{json-inválido'));
    await navigate(page, '/importacao/esquemas');
    await expect(page.getByRole('heading', { name: 'Esquemas de importação' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nova importação' })).toBeVisible();
  });

  test('esquema salvo no SQLite reaparece após apagar e corromper o cache local', async ({ page }) => {
    const fixture = path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-esquema.csv');
    const schemaName = 'Esquema Contatos - contato-esquema.csv';
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles(fixture);
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await review.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('import_schemas') ?? '')).toContain(schemaName);

    const isolatedRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolatedRoot) throw new Error('O banco isolado do E2E não foi informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolatedRoot, 'geogestor.db')}` });
    try {
      const stored = await database.execute({ sql: 'SELECT valor_json FROM configuracoes_operacionais WHERE chave = ?', args: ['import_schemas'] });
      expect(stored.rows).toHaveLength(1);
      expect(String(stored.rows[0].valor_json)).toContain(schemaName);
    } finally {
      database.close();
    }

    for (const value of [null, '{json-inválido']) {
      await page.evaluate(next => {
        if (next === null) localStorage.removeItem('import_schemas');
        else localStorage.setItem('import_schemas', next);
      }, value);
      await unlock(page);
      await navigate(page, '/importacao/esquemas');
      await expect(page.getByText(schemaName)).toBeVisible();
    }
  });
});
