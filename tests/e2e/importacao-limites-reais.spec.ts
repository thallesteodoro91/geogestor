import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { e2eDataDirectory } from './support/runtime';

async function openImporter(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(unlock).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('QA Limites Fictícios');
    await page.getByLabel('Pasta de dados').fill(e2eDataDirectory());
    await page.getByLabel('Nome do administrador').fill('QA');
    await page.getByLabel('E-mail').fill('qa.limits@example.test');
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Concluir configuração' }).click();
    await expect(unlock.or(dashboard)).toBeVisible();
  }
  if (await unlock.isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboard).toBeVisible();
  await page.evaluate(() => { history.pushState({}, '', '/importacao'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByRole('heading', { name: 'Importação de dados' })).toBeVisible();
}

async function choose(page: Page, name: string, label: string) {
  const select = page.locator(`select[name="${name}"]`);
  const value = await select.locator('option').filter({ hasText: label }).getAttribute('value');
  if (!value) throw new Error(`Opção ausente: ${label}`);
  await select.selectOption(value);
}

test.describe('limites reais pela interface com API e SQLite descartáveis', () => {
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => { await openImporter(page); });

  for (const variant of ['20mib-20000-rows', '300-columns'] as const) {
    test(`prévia completa válida: ${variant}`, async ({ page }) => {
      await choose(page, 'tipo-importacao', 'Migração completa de planilha');
      let contents: string;
      if (variant === '20mib-20000-rows') {
        const rows = Array.from({ length: 20_000 }, (_, index) => `QA-LIMIT-${String(index).padStart(5, '0')};${'x'.repeat(1020)}\n`);
        const initial = `Cliente;Campo extra\n${rows.join('')}`;
        const remaining = 20 * 1024 * 1024 - Buffer.byteLength(initial);
        expect(remaining).toBeGreaterThanOrEqual(0);
        // Distribuir o preenchimento mantém cada célula abaixo de 20 mil caracteres.
        const each = Math.floor(remaining / rows.length);
        const remainder = remaining % rows.length;
        contents = `Cliente;Campo extra\n${rows.map((row, index) => `${row.slice(0, -1)}${'x'.repeat(each + (index < remainder ? 1 : 0))}\n`).join('')}`;
        expect(Buffer.byteLength(contents)).toBe(20 * 1024 * 1024);
      } else {
        contents = `${['Cliente', ...Array.from({ length: 299 }, (_, i) => `Extra ${i}`)].join(';')}\n${['QA-LIMIT-300-COLS', ...Array.from({ length: 299 }, () => 'valor')].join(';')}\n`;
      }
      const start = performance.now();
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/importacoes/migracao-completa/preview') && response.request().method() === 'POST', { timeout: 90_000 });
      await page.locator('#import-file').setInputFiles({ name: `${variant}.csv`, mimeType: 'text/csv', buffer: Buffer.from(contents) });
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const sent = response.request().postDataJSON() as { rows: unknown[]; headers: string[]; clientTimings: { readingMs: number; hashingMs: number } };
      expect(sent.rows).toHaveLength(variant === '20mib-20000-rows' ? 20_000 : 1);
      expect(sent.headers).toHaveLength(variant === '300-columns' ? 300 : 2);
      await expect(page.getByText('Planilha pronta para confirmação')).toBeVisible();
      const isolated = process.env.GEOGESTOR_E2E_ROOT;
      if (!isolated) throw new Error('Banco descartável não informado.');
      const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
      const database = createClient({ url: `file:${path.join(isolated, 'geogestor.db')}` });
      try {
        // A resposta extensa pode sair do cache de inspeção do navegador.
        // Conferir a prévia persistida também comprova a passagem pela API real.
        const stored = await database.execute({ sql: 'SELECT status, total_rows, result_json FROM import_runs WHERE source_name = ?', args: [`${variant}.csv`] });
        expect(stored.rows).toHaveLength(1);
        expect(stored.rows[0].status).toBe('ready');
        expect(Number(stored.rows[0].total_rows)).toBe(sent.rows.length);
        expect(JSON.parse(String(stored.rows[0].result_json)).status).toBe('ready');
      } finally { database.close(); }
      console.log('[QA-SIMULATION]', JSON.stringify({ variant, bytes: Buffer.byteLength(contents), rows: sent.rows.length, columns: sent.headers.length, uploadToPreviewMs: performance.now() - start, readingAndParsingMs: sent.clientTimings.readingMs, hashingMs: sent.clientTimings.hashingMs }));
    });
  }

  test('500 contatos são confirmados na tela e reconciliados no SQLite', async ({ page }) => {
    await choose(page, 'tipo-importacao', 'Importação simples por cadastro');
    await choose(page, 'entidade', 'Contatos');
    const contents = `Nome,Email\n${Array.from({ length: 500 }, (_, i) => `QA-LIMIT-CONTATO-${i},qa.limit.${i}@example.test`).join('\n')}`;
    await page.locator('#import-file').setInputFiles({ name: '500-contatos.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) });
    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    const chooseHeader = page.getByRole('heading', { name: 'Escolha a linha de cabeçalho' });
    await expect(chooseHeader.or(review)).toBeVisible();
    if (await chooseHeader.isVisible()) {
      await page.getByLabel('Linha com os nomes das colunas').selectOption('0');
      await page.getByRole('button', { name: 'Usar esta linha e gerar prévia' }).click();
    }
    await review.focus();
    await page.keyboard.press('Space');
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/contatos/lote') && response.request().method() === 'POST');
    const start = performance.now();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const result = await response.json();
    expect([result.rowsRead, result.imported, result.failed]).toEqual([500, 500, 0]);
    expect(result.results).toHaveLength(500);
    expect(new Set(result.results.map((row: { id: string }) => row.id)).size).toBe(500);
    await expect(page.getByRole('heading', { name: 'Importação concluída', exact: true })).toBeVisible();
    const isolated = process.env.GEOGESTOR_E2E_ROOT;
    if (!isolated) throw new Error('Banco descartável não informado.');
    const { createClient } = createRequire(path.resolve('apps/api/package.json'))('@libsql/client');
    const database = createClient({ url: `file:${path.join(isolated, 'geogestor.db')}` });
    try {
      const rows = await database.execute("SELECT id FROM contatos WHERE nome LIKE 'QA-LIMIT-CONTATO-%'");
      expect(rows.rows).toHaveLength(500);
      expect(rows.rows.map((row: { id: string }) => row.id).sort()).toEqual(result.results.map((row: { id: string }) => row.id).sort());
      console.log('[QA-SIMULATION]', JSON.stringify({ variant: '500-contacts-committed', imported: result.imported, databaseRows: rows.rows.length, confirmToResultMs: performance.now() - start }));
    } finally { database.close(); }
  });
});
