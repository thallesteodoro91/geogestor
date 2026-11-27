import { test, expect, _electron as electron, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-18-raio-x-geogestor/revalidacao-expense-modal-premium');
const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const description = 'EXEMPLO FICTÍCIO — Combustível para visita de campo';

async function seed() {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !/^run-/.test(path.basename(root))) throw Error('Banco de teste isolado obrigatório');
  const db = createClient({ url: `file:${path.join(root, 'geogestor.db')}` });
  const client = crypto.randomUUID(), project = crypto.randomUUID(), otherProject = crypto.randomUUID();
  const document = crypto.randomUUID(), travel = crypto.randomUUID();
  const clientName = 'EXEMPLO FICTÍCIO — Cliente ' + client.slice(0, 5);
  const projectName = 'EXEMPLO FICTÍCIO — Levantamento ' + project.slice(0, 5);
  const otherName = 'EXEMPLO FICTÍCIO — Projeto alternativo ' + otherProject.slice(0, 5);
  const documentName = 'EXEMPLO FICTÍCIO — Comprovante de combustível.txt';
  const file = path.join(root, document + '.txt');
  await fs.writeFile(file, 'EXEMPLO FICTÍCIO. Arquivo de teste sem validade fiscal.');
  try {
    await db.batch([
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [client, clientName] },
      { sql: "insert into projetos (id,cliente_id,nome,tipo,status) values (?,?,?,'Topografia','Em Andamento')", args: [project, client, projectName] },
      { sql: "insert into projetos (id,cliente_id,nome,tipo,status) values (?,?,?,'Topografia','Em Andamento')", args: [otherProject, client, otherName] },
      { sql: "insert into documentos (id,cliente_id,projeto_id,nome,extensao,caminho,categoria) values (?,?,?,?,'txt',?,'Outros')", args: [document, client, project, documentName, file] },
      { sql: "insert into viagens (id,cliente_id,projeto_id,finalidade,destino,data_inicio,status) values (?,?,?,'EXEMPLO FICTÍCIO — Visita','Local fictício','2026-10-15','planejada')", args: [travel, client, project] }
    ], 'write');
  } finally { db.close(); }
  return { client, project, otherProject, document, travel, clientName, projectName, otherName, documentName };
}

const auditAuthHeaders=new WeakMap<Page,Record<string,string>>();
async function prepare(page: Page) {
 await fs.mkdir(evidence,{recursive:true});page.on('request',r=>{const h=r.headers();if(h['x-local-session'])auditAuthHeaders.set(page,{'x-local-session':h['x-local-session'],...(h['x-api-token']?{'x-api-token':h['x-api-token']}:{})});});
  await page.addInitScript(port => { (window as any).electronAPI = { getApiPort: () => port }; }, Number(process.env.GEOGESTOR_E2E_API_PORT));
 await auditGoto(page, origin + '/');const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});await expect(page.locator('#main-content').or(locked)).toBeVisible();if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();

}

async function openForm(page: Page, theme = 'light') {
  await auditGoto(page, origin + '/financeiro?tab=pagar');
  const opener = page.getByRole('button', { name: 'Nova despesa', exact: true });
  await expect(opener).toBeVisible();
  await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Nova despesa', exact: true });
  await expect(dialog.locator('#despesa-desc')).toBeFocused();
  await expect(dialog).toHaveCSS('opacity', '1');
  return { dialog, opener };
}

async function section(dialog: Locator, name: string) {
  await dialog.getByRole('navigation', { name: 'Seções da despesa' }).getByRole('button', { name, exact: true }).click();
}

async function date(page: Page, dialog: Locator, id: string, day = 16) {
  const trigger = dialog.locator('#' + id);
  await trigger.press('ArrowDown');
  const calendar = page.locator('.geo-expense-calendar');
  await expect(calendar).toBeVisible();
  await calendar.getByRole('gridcell', { name: '15 de outubro de 2026', exact: true }).click();
  if (day !== 15) {
    await trigger.press('ArrowDown');
    await expect(calendar.locator('[role=gridcell][tabindex="0"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  }
  await expect(trigger).toContainText(`${day}/10/2026`);
  await expect(trigger).toBeFocused();
  expect(await trigger.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

async function choose(page: Page, dialog: Locator, id: string, label: string) {
  await dialog.locator('#' + id).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function chooseProject(page: Page, dialog: Locator, name: string) {
  const input = dialog.locator('#despesa-projeto');
  await input.fill(name);
  const popup = page.getByRole('listbox', { name: 'Projetos da despesa' });
  await popup.getByRole('option').filter({ hasText: name }).click();
  await expect(input).toHaveValue(name);
  if (await popup.isVisible()) await page.keyboard.press('Escape');
}

async function panelBounds(dialog: Locator) {
  const bounds = await dialog.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, width: innerWidth, height: innerHeight, scroll: el.scrollWidth, client: el.clientWidth };
  });
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  for (const name of ['Cancelar', 'Cadastrar despesa']) {
    const r = (await dialog.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height).toBeLessThanOrEqual(bounds.height);
  }
}

test('teclado, validação, seções, calendário e descarte preservado', async ({ page }) => {
  await prepare(page);
  const { dialog, opener } = await openForm(page);
  const submit = dialog.getByRole('button', { name: 'Cadastrar despesa', exact: true });
  await submit.click();
  await expect(dialog.locator('#despesa-desc')).toBeFocused();
  await expect(dialog.locator('#despesa-desc')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: 'Dados principais, 2 erros', exact: true })).toBeVisible();
  await dialog.locator('#despesa-desc').fill(description);
  await submit.click();
  await expect(dialog.locator('#despesa-valor')).toBeFocused();
  await dialog.locator('label[for="despesa-valor"]').click();
  await expect(dialog.locator('#despesa-valor')).toBeFocused();
  await dialog.locator('#despesa-valor').fill('1234.56');
  await date(page, dialog, 'despesa-data');
  await section(dialog, 'Classificação');
  const category = dialog.locator('#despesa-categoria');
  await expect(category).toHaveText('Combustível');
  await category.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(category).toBeFocused();
  await expect(dialog.locator('#despesa-tipo-custo')).toHaveText('Variável de campo');
  await expect(dialog.locator('#despesa-centro-custo')).toHaveText('Campo');
  await submit.focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Fechar modal' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(submit).toBeFocused();
  await page.keyboard.press('Escape');
  let confirm = page.getByRole('alertdialog', { name: 'Descartar alterações?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(dialog.locator('#despesa-desc')).toHaveValue(description);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  confirm = page.getByRole('alertdialog', { name: 'Descartar alterações?' });
  await confirm.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.locator('#despesa-desc')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Fechar modal' }).click();
  await expect(dialog).toHaveCount(0);
});

test('vínculos, comprovante, pagamento e preservação dos valores escolhidos', async ({ page }) => {
  const fixture = await seed();
  await prepare(page);
  const { dialog } = await openForm(page);
  await section(dialog, 'Vínculos');
  await expect(dialog.locator('#despesa-comprovante-vinculado')).toBeDisabled();
  await expect(dialog.locator('#despesa-comprovante-help')).toContainText('Selecione um projeto');
  await dialog.locator('#despesa-cliente').fill(fixture.clientName);
  await page.getByRole('option', { name: fixture.clientName, exact: true }).click();
  await chooseProject(page, dialog, fixture.projectName);
  await expect(dialog.locator('#despesa-cliente')).toBeDisabled();
  await expect(dialog.locator('#despesa-cliente')).toHaveValue(fixture.clientName);
  await choose(page, dialog, 'despesa-comprovante-vinculado', 'Projeto — ' + fixture.documentName);
  await chooseProject(page, dialog, fixture.otherName);
  await expect(dialog.locator('select[name="comprovanteDocumentoId"]')).toHaveValue('');
  await expect(page.getByText('O comprovante foi desvinculado porque o projeto mudou. Selecione um arquivo compatível.', { exact: true })).toBeVisible();
  await chooseProject(page, dialog, fixture.projectName);
  await choose(page, dialog, 'despesa-comprovante-vinculado', 'Projeto — ' + fixture.documentName);
  await choose(page, dialog, 'despesa-viagem', 'EXEMPLO FICTÍCIO — Visita · Local fictício');
  await section(dialog, 'Pagamento');
  await choose(page, dialog, 'despesa-status', 'Pago');
  await choose(page, dialog, 'despesa-forma', 'Dinheiro');
  await date(page, dialog, 'despesa-data-pagamento', 15);
  await dialog.locator('label[for="despesa-reembolsavel"]').click();
  await expect(dialog.getByLabel('Despesa reembolsável pelo cliente')).toBeChecked();
  await section(dialog, 'Dados principais');
  await dialog.locator('#despesa-desc').fill(description + ' — vínculos');
  await dialog.locator('#despesa-valor').fill('0.01');
  await date(page, dialog, 'despesa-data');
  await date(page, dialog, 'despesa-competencia', 15);
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/financeiro/despesas') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Cadastrar despesa', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const saved = await response.json();
  expect(saved).toMatchObject({ clienteId: fixture.client, projetoId: fixture.project, comprovanteDocumentoId: fixture.document, viagemId: fixture.travel, valor: 1, data: '2026-10-16', dataCompetencia: '2026-10-15', dataPagamento: '2026-10-15', status: 'Pago', formaPagamento: 'Dinheiro', reembolsavel: true });
  await expect(dialog).toHaveCount(0);
  await fs.writeFile(path.join(evidence, 'vinculos-payload.json'), JSON.stringify(saved, null, 2));
});

test('falhas, envio lento, duplicação, criação e edição com centavos', async ({ page }) => {
  await prepare(page);
  const { dialog, opener } = await openForm(page);
  const title = description + ' — tentativa';
  await dialog.locator('#despesa-desc').fill(title);
  await dialog.locator('#despesa-valor').fill('1234.56');
  await date(page, dialog, 'despesa-data');
  await section(dialog, 'Observações');
  await dialog.locator('#despesa-obs').fill('EXEMPLO FICTÍCIO — Não perder o preenchimento.');
  const endpoint = '**/api/financeiro/despesas';
  const submit = dialog.getByRole('button', { name: 'Cadastrar despesa', exact: true });
  await page.route(endpoint, route => route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha fictícia do serviço"}' }) : route.continue());
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('tente novamente');
  await expect(dialog.locator('#despesa-desc')).toHaveValue(title);
  await expect(dialog.locator('#despesa-valor')).toHaveValue('1234.56');
  await expect(dialog.locator('input[name=data]')).toHaveValue('2026-10-16');
  await expect(dialog.locator('#despesa-obs')).toHaveValue('EXEMPLO FICTÍCIO — Não perder o preenchimento.');
  await dialog.screenshot({ path: path.join(evidence, 'falha-preservada.png') });
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('antes de tentar novamente');
  await expect(dialog.locator('#despesa-obs')).toHaveValue('EXEMPLO FICTÍCIO — Não perder o preenchimento.');
  await page.unroute(endpoint);
  let calls = 0, finish = () => {};
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route(endpoint, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls++;
    await pending;
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  const before = (await submit.boundingBox())!;
  await submit.click();
  const busy = dialog.getByRole('button', { name: 'Salvando…', exact: true });
  await expect(busy).toBeDisabled();
  const after = (await busy.boundingBox())!;
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  await expect(dialog.locator('#despesa-desc')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Fechar modal' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await dialog.locator('form').evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  await expect.poll(() => calls).toBe(1);
  await dialog.screenshot({ path: path.join(evidence, 'salvando.png') });
  finish();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.unroute(endpoint);
  const edit = page.getByRole('button', { name: 'Editar despesa ' + title, exact: true });
  await edit.click();
  const editor = page.getByRole('dialog', { name: 'Editar despesa', exact: true });
  await expect(editor.locator('#despesa-valor')).toHaveValue('1234.56');
  await editor.locator('#despesa-desc').fill(title + ' — editada');
  await editor.locator('#despesa-valor').fill('1234.57');
  const responsePromise = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/api/financeiro/despesas/'));
  await editor.getByRole('button', { name: 'Salvar despesa', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const saved = await response.json();
  expect(saved.valor).toBe(123457);
  await expect(editor).toHaveCount(0);
  const records = await (await auditGet(page, apiOrigin + '/api/financeiro/despesas?mode=legacy')).json();
  expect(records.filter((row: any) => row.descricao === title + ' — editada')).toHaveLength(1);
  await fs.writeFile(path.join(evidence, 'criacao-edicao.json'), JSON.stringify({ calls, saved }, null, 2));
});

test('temas e larguras: formulário, navegação e seletores abertos', async ({ page }) => {
  const fixture = await seed();
  await prepare(page);
  const records = [];
  for (const width of [1440, 360]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    const { dialog } = await openForm(page, theme);
    await dialog.locator('#despesa-desc').fill(description);
    await dialog.locator('#despesa-valor').fill('1234.56');
    await panelBounds(dialog);
    let axe = await new AxeBuilder({ page }).include('.geo-expense-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations).toEqual([]);
    await dialog.screenshot({ path: path.join(evidence, `despesa-${theme}-${width}.png`) });
    await dialog.locator('#despesa-data').click();
    await expect(page.locator('.geo-expense-calendar')).toBeVisible();
    axe = await new AxeBuilder({ page }).include('.geo-expense-calendar').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: path.join(evidence, `calendario-${theme}-${width}.png`) });
    await page.keyboard.press('Escape');
    await section(dialog, 'Vínculos');
    const projectInput = dialog.locator('#despesa-projeto');
    await projectInput.fill(fixture.projectName);
    const projectPopup = page.getByRole('listbox', { name: 'Projetos da despesa' });
    await expect(projectPopup.getByRole('option').filter({ hasText: fixture.projectName })).toBeVisible();
    const a = (await projectInput.boundingBox())!, b = (await projectPopup.boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: path.join(evidence, `projeto-${theme}-${width}.png`) });
    await page.keyboard.press('Escape');
    await section(dialog, 'Classificação');
    const category = dialog.locator('#despesa-categoria');
    await category.click();
    const popup = page.getByRole('listbox');
    await expect(popup).toBeVisible();
    const c = (await category.boundingBox())!, p = (await popup.boundingBox())!;
    expect(Math.abs(c.width - p.width)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(evidence, `categoria-${theme}-${width}.png`) });
    await page.keyboard.press('Escape');
    await section(dialog, 'Pagamento');
    await panelBounds(dialog);
    await dialog.locator('#despesa-status').focus();
    expect(await dialog.locator('#despesa-status').evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
    await dialog.screenshot({ path: path.join(evidence, `pagamento-${theme}-${width}.png`) });
    records.push({ width, theme, axe: 0, popupWidthDelta: Math.abs(c.width - p.width), footerReachable: true });
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Descartar alterações?' }).getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  }
  await fs.writeFile(path.join(evidence, 'matriz.json'), JSON.stringify(records, null, 2));
});

test('zoom real 200% no Electron: formulário rolável e ações acessíveis', async () => {
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
    const { dialog } = await openForm(page);
    await panelBounds(dialog);
    await dialog.locator('#despesa-desc').fill(description);
    await dialog.locator('#despesa-valor').fill('12.34');
    await date(page, dialog, 'despesa-data');
    await section(dialog, 'Classificação');
    await dialog.locator('#despesa-categoria').press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await section(dialog, 'Pagamento');
    await panelBounds(dialog);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const png = await win.evaluate(async window => (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(evidence, 'zoom-real-200.png'), Buffer.from(png, 'base64'));
    await fs.writeFile(path.join(evidence, 'zoom-real.json'), JSON.stringify({ factor: await win.evaluate(window => window.webContents.getZoomFactor()), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), footerReachable: true }, null, 2));
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Descartar alterações?' }).getByRole('button', { name: 'Descartar alterações', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

async function auditGoto(page:Page,url:string){await page.goto(url);const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});await expect(page.locator('#main-content').or(locked)).toBeVisible();if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();}

async function auditGet(page:Page,url:string){return page.request.get(url,{headers:auditAuthHeaders.get(page)||{}});}
