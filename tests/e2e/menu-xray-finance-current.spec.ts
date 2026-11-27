import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-18-raio-x-geogestor/revalidacao-finance-entry-flow');
const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;

function database() {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !/^run-/.test(path.basename(root))) throw Error('Somente banco fictício isolado');
  return createClient({ url: `file:${path.join(root, 'geogestor.db')}` });
}
async function rows(sql: string, args: any[] = []) {
  const db = database();
  try { return (await db.execute({ sql, args })).rows; } finally { db.close(); }
}
async function seed() {
  const id = () => crypto.randomUUID();
  const client = id(), budget = id(), installment = id(), draft = id(), project = id(), document = id();
  const name = 'EXEMPLO FICTÍCIO — Cliente ' + client.slice(0, 6);
  const description = 'EXEMPLO FICTÍCIO — Levantamento ' + budget.slice(0, 6);
  const file = path.join(process.env.GEOGESTOR_E2E_ROOT!, document + '.txt');
  await fs.writeFile(file, 'EXEMPLO FICTÍCIO. Comprovante sem validade fiscal.');
  const db = database();
  try {
    await db.batch([
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [client, name] },
      { sql: "insert into projetos (id,cliente_id,nome,tipo,status) values (?,?,?,'Topografia','Em Andamento')", args: [project, client, 'EXEMPLO FICTÍCIO — Projeto'] },
      { sql: "insert into orcamentos (id,cliente_id,projeto_id,descricao,status,valor_total) values (?,?,?,?,'aprovado',100000)", args: [budget, client, project, description] },
      { sql: "insert into orcamentos (id,cliente_id,descricao,status,valor_total) values (?,?,'EXEMPLO FICTÍCIO — Rascunho não elegível','rascunho',999999)", args: [draft, client] },
      { sql: "insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,100000,0,'2026-10-25','Pendente')", args: [installment, budget] },
      { sql: "insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,999999,0,'2026-10-25','Pendente')", args: [id(), draft] },
      { sql: "insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento,cancelada_em) values (?,?,999999,0,'2026-10-25','Pendente','2026-10-14')", args: [id(), budget] },
      { sql: "insert into documentos (id,cliente_id,projeto_id,nome,extensao,caminho) values (?,?,?,'EXEMPLO FICTÍCIO — Comprovante.txt','txt',?)", args: [document, client, project, file] }
    ], 'write');
  } finally { db.close(); }
  return { client, budget, installment, name, description, document };
}
async function prepare(page: Page) {
  await page.addInitScript(port => { (window as any).electronAPI = { getApiPort: () => port }; }, Number(process.env.GEOGESTOR_E2E_API_PORT));
 await auditGoto(page, origin + '/');const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});await expect(page.locator('#main-content').or(locked)).toBeVisible();if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();

}
async function applyTheme(page: Page, theme: string) {
  await page.evaluate(theme => {
    localStorage.setItem('geogestor_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, theme);
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
}
async function menu(page: Page) {
  const trigger = page.getByRole('button', { name: 'Novo lançamento', exact: true });
  await trigger.click();
  const popup = page.getByRole('menu', { name: 'Novo lançamento' });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('menuitem', { name: /^Novo orçamento/ })).toBeFocused();
  return popup;
}
async function selectReceivable(page: Page, fixture: Awaited<ReturnType<typeof seed>>, theme = 'light', useCurrent = false) {
  if (!useCurrent) await auditGoto(page, origin + '/financeiro?tab=faturas');
  await applyTheme(page, theme);
  const popup = await menu(page);
  await popup.getByRole('menuitem', { name: /^Registrar recebimento/ }).click();
  await expect(page.getByRole('heading', { name: 'Selecione uma conta a receber' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar contas a receber' }).fill(fixture.description);
  const card = page.getByRole('group', { name: 'Conta a receber de ' + fixture.name });
  await expect(card).toContainText('Saldo disponível');
  await expect(page.getByText('EXEMPLO FICTÍCIO — Rascunho não elegível', { exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Receber', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar recebimento', exact: true });
  await expect(dialog.locator('#receipt-principal')).toBeFocused();
  await expect(dialog).toHaveCSS('opacity', '1');
  await applyTheme(page, theme);
  return dialog;
}

test('menu e seleção vazia: teclado, ausência de contas e falha de consulta', async ({ page }) => {
  await prepare(page);
  await auditGoto(page, origin + '/financeiro');
  let popup = await menu(page);
  await expect(popup.getByText('Nova receita', { exact: true })).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(popup.getByRole('menuitem', { name: /^Registrar recebimento/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Novo lançamento', exact: true })).toBeFocused();
  popup = await menu(page);
  await popup.getByRole('menuitem', { name: /^Registrar recebimento/ }).click();
  await expect(page).toHaveURL(/\/financeiro\?.*tab=faturas/);
  await expect(page.getByText('Não há contas em aberto disponíveis para recebimento.', { exact: false })).toBeVisible();
  expect((await rows('select count(*) as n from orcamentos'))[0].n).toBe(0);
  expect((await rows('select count(*) as n from parcelas'))[0].n).toBe(0);
  await page.screenshot({ path: path.join(evidence, 'selecao-vazia.png') });
  await page.route('**/api/financeiro/parcelas?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.getByRole('textbox', { name: 'Buscar contas a receber' }).fill('EXEMPLO FICTÍCIO — Falha');
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await page.unroute('**/api/financeiro/parcelas?*');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByText('Nenhuma conta em aberto encontrada com estes filtros.', { exact: false })).toBeVisible();
});

test('orçamento: origem Financeiro, critérios, cancelamento, histórico e rascunho salvo', async ({ page }) => {
  const fixture = await seed();
  await prepare(page);
  const returnPath = '/financeiro?tab=faturas&periodo=custom&inicio=2026-10-01&fim=2026-10-31&cliente=' + fixture.client + '&receberBusca=EXEMPLO&receberSituacao=pendentes';
  await auditGoto(page, origin + returnPath);
  let popup = await menu(page);
  await popup.getByRole('menuitem', { name: /^Novo orçamento/ }).click();
  await expect(page.locator('#budget-description')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('retorno')).toBe(returnPath);
  const back = page.getByRole('link', { name: 'Voltar ao Financeiro', exact: true });
  await expect(back).toHaveAttribute('href', returnPath);
  await page.locator('#budget-description').fill('EXEMPLO FICTÍCIO — Alteração não salva');
  await back.click();
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(page.locator('#budget-description')).toHaveValue('EXEMPLO FICTÍCIO — Alteração não salva');
  await page.goBack();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(page).toHaveURL(origin + returnPath);
  await expect(page.getByRole('textbox', { name: 'Buscar contas a receber' })).toHaveValue('EXEMPLO');
  popup = await menu(page);
  await popup.getByRole('menuitem', { name: /^Novo orçamento/ }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(origin + returnPath);
  popup = await menu(page);
  await popup.getByRole('menuitem', { name: /^Novo orçamento/ }).click();
  await page.locator('#budget-description').fill('EXEMPLO FICTÍCIO — Proposta criada pelo Financeiro');
  await page.locator('[data-budget-nav-section="items"]:visible').click();
  await page.locator('#budget-item-description-0').fill('EXEMPLO FICTÍCIO — Serviço proposto');
  await page.locator('#budget-item-price-0').fill('100,00');
  const countsBefore = await rows('select (select count(*) from parcelas) as p, (select count(*) from recebimentos) as r');
  const responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/orcamentos'));
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  const saved = await response.json();
  expect(saved.status).toBe('rascunho');
  await expect(page).toHaveURL(origin + returnPath);
  expect(await rows('select (select count(*) from parcelas) as p, (select count(*) from recebimentos) as r')).toEqual(countsBefore);
  await fs.writeFile(path.join(evidence, 'retorno-financeiro.json'), JSON.stringify({ returnPath, savedId: saved.id, status: saved.status, countsBefore }, null, 2));
  await auditGoto(page, origin + '/orcamentos/novo');
  await expect(page.getByRole('link', { name: 'Voltar para orçamentos', exact: true })).toHaveAttribute('href', '/orcamentos');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(origin + '/orcamentos');
  await auditGoto(page, origin + '/orcamentos/novo?retorno=' + encodeURIComponent('https://example.invalid/financeiro'));
  await expect(page.getByRole('link', { name: 'Voltar para orçamentos', exact: true })).toHaveAttribute('href', '/orcamentos');
});

test('recebimento parcial e integral: caixa, saldo, comprovante e ausência de geração indevida', async ({ page }) => {
  const fixture = await seed();
  await prepare(page);
  const before = await rows('select (select count(*) from orcamentos) as b, (select count(*) from parcelas) as p');
  let dialog = await selectReceivable(page, fixture);
  await dialog.locator('#receipt-principal').fill('400,00');
  await dialog.locator('input[name=juros]').fill('10,00');
  await dialog.locator('input[name=multa]').fill('2,00');
  await dialog.locator('input[name=desconto]').fill('1,00');
  await dialog.locator('input[name=taxas]').fill('0,50');
  await dialog.locator('input[name=meioPagamento]').fill('Pix');
  await dialog.locator('#receipt-document').click();
  await page.getByRole('option', { name: /EXEMPLO FICTÍCIO — Comprovante.txt/ }).click();
  let responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/recebimentos'));
  await dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true }).click();
  let response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  let result = await response.json();
  expect(result.recebimento).toMatchObject({ valorPrincipal: 40000, valorRecebido: 41050, comprovanteDocumentoId: fixture.document });
  await expect(dialog).toHaveCount(0);
  dialog = await selectReceivable(page, fixture, 'light', true);
  await expect(dialog.locator('#receipt-principal')).toHaveValue('600,00');
  responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/recebimentos'));
  await dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true }).click();
  response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  result = await response.json();
  expect(result.parcela).toMatchObject({ valorPago: 100000, statusPagamento: 'Pago' });
  const totals = await rows('select sum(valor_principal) as principal, sum(valor_recebido) as caixa, count(*) as n from recebimentos where parcela_id=?', [fixture.installment]);
  expect(totals[0]).toMatchObject({ principal: 100000, caixa: 101050, n: 2 });
  expect(await rows('select (select count(*) from orcamentos) as b, (select count(*) from parcelas) as p')).toEqual(before);
  await fs.writeFile(path.join(evidence, 'reconciliacao.json'), JSON.stringify({ totals, before, installment: fixture.installment }, null, 2));
  await auditGoto(page, origin + '/financeiro?tab=faturas&parcela=' + fixture.installment);
  await expect(page.getByRole('dialog', { name: 'GeoGestor • Recibo', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('parcela')).toBe(null);
  expect(new URL(page.url()).searchParams.get('receberSituacao')).toBe('recebidas');
});

test('falha, preenchimento, bloqueio de duplicações e cancelamento do recebimento', async ({ page }) => {
  const fixture = await seed();
  await prepare(page);
  const dialog = await selectReceivable(page, fixture);
  await dialog.locator('#receipt-principal').fill('123,45');
  await dialog.locator('textarea[name=observacoes]').fill('EXEMPLO FICTÍCIO — Preservar o preenchimento.');
  const endpoint = '**/api/financeiro/parcelas/' + fixture.installment + '/recebimentos';
  const submit = dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true });
  await page.route(endpoint, route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('tente novamente');
  await expect(dialog.locator('#receipt-principal')).toHaveValue('123,45');
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.abort('failed'));
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('Confira o histórico');
  await expect(dialog.locator('textarea[name=observacoes]')).toHaveValue('EXEMPLO FICTÍCIO — Preservar o preenchimento.');
  await dialog.screenshot({ path: path.join(evidence, 'falha-preservada.png') });
  await page.unroute(endpoint);
  await page.keyboard.press('Escape');
  const discard = page.getByRole('alertdialog', { name: 'Descartar recebimento não salvo?' });
  await discard.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(dialog.locator('#receipt-principal')).toHaveValue('123,45');
  let calls = 0, finish = () => {};
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route(endpoint, async route => { calls++; await pending; const response = await route.fetch(); await route.fulfill({ response }); });
  const before = (await submit.boundingBox())!;
  await submit.click();
  const busy = dialog.getByRole('button', { name: 'Registrando…' });
  await expect(busy).toBeDisabled();
  const after = (await busy.boundingBox())!;
  expect(after.width).toBe(before.width); expect(after.height).toBe(before.height);
  await expect(dialog.locator('#receipt-principal')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
  await dialog.locator('form').evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  await expect.poll(() => calls).toBe(1);
  await dialog.screenshot({ path: path.join(evidence, 'registrando.png') });
  finish();
  await expect(dialog).toHaveCount(0);
  expect((await rows('select count(*) as n from recebimentos where parcela_id=?', [fixture.installment]))[0].n).toBe(1);
});

test('temas, largura estreita, seleção, calendário e foco', async ({ page }) => {
  const fixture = await seed();
  await prepare(page);
  const matrix = [];
  for (const width of [1440, 360]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await auditGoto(page, origin + '/financeiro?tab=faturas');
    await applyTheme(page, theme);
    await menu(page);
    await applyTheme(page, theme);
    await page.screenshot({ path: path.join(evidence, `menu-${theme}-${width}.png`) });
    await page.keyboard.press('Escape');
    const dialog = await selectReceivable(page, fixture, theme, true);
    const r = await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight, scroll: el.scrollWidth, client: el.clientWidth }; });
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(r.w); expect(r.bottom).toBeLessThanOrEqual(r.h); expect(r.scroll).toBeLessThanOrEqual(r.client + 1);
    for (const label of ['Cancelar', 'Confirmar recebimento']) {
      const b = (await dialog.getByRole('button', { name: label, exact: true }).boundingBox())!;
      expect(b.y + b.height).toBeLessThanOrEqual(900);
    }
    const axe = await new AxeBuilder({ page }).include('.geo-receipt-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations).toEqual([]);
    await dialog.screenshot({ path: path.join(evidence, `recebimento-${theme}-${width}.png`) });
    await dialog.getByRole('button', { name: 'Data do recebimento', exact: true }).press('ArrowDown');
    await expect(page.getByRole('grid')).toBeVisible();
    await page.screenshot({ path: path.join(evidence, `calendario-${theme}-${width}.png`) });
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    matrix.push({ width, theme, axe: 0, footerReachable: true });
  }
  await fs.writeFile(path.join(evidence, 'matriz.json'), JSON.stringify(matrix, null, 2));
});

test('Electron 200% real: menu, seleção e recebimento', async () => {
  const fixture = await seed();
  const requireRoot = createRequire(path.resolve('package.json'));
  let executablePath: string;
  try { executablePath = requireRoot('electron'); } catch { executablePath = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
  const app = await electron.launch({ executablePath, args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env, timeout: 30_000 });
  try {
    const page = await app.firstWindow();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const win = await app.browserWindow(page);
    await win.evaluate(window => { window.webContents.setBackgroundThrottling(false); window.setContentSize(1000, 800); window.webContents.setZoomFactor(2); });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(500);
    const dialog = await selectReceivable(page, fixture);
    await dialog.locator('#receipt-principal').fill('10,00');
    await dialog.getByRole('button', { name: 'Data do recebimento', exact: true }).press('ArrowDown');
    await expect(page.getByRole('grid')).toBeVisible();
    await page.keyboard.press('Escape');
    for (const label of ['Cancelar', 'Confirmar recebimento']) {
      const r = (await dialog.getByRole('button', { name: label, exact: true }).boundingBox())!;
      expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y + r.height).toBeLessThanOrEqual(400);
    }
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const png = await win.evaluate(async window => (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(evidence, 'zoom-real-200.png'), Buffer.from(png, 'base64'));
    await fs.writeFile(path.join(evidence, 'zoom-real.json'), JSON.stringify({ factor: await win.evaluate(window => window.webContents.getZoomFactor()), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })) }, null, 2));
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Descartar recebimento não salvo?' }).getByRole('button', { name: 'Descartar alterações', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

async function auditGoto(page:Page,url:string){await page.goto(url);const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});await expect(page.locator('#main-content').or(locked)).toBeVisible();if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();}
