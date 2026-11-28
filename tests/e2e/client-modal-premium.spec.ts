import { test, expect, _electron as electron, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });
const evidence = path.resolve('docs/auditorias/2026-10-16-modal-cliente/evidencias');
const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const title = () => 'EXEMPLO FICTÍCIO — Cliente ' + crypto.randomUUID().slice(0, 8);
function fictionalCpf() {
  const digits = [...crypto.randomBytes(9)].map(value => value % 10);
  for (const factor of [10, 11]) {
    const remainder = digits.reduce((sum, digit, index) => sum + digit * (factor - index), 0) % 11;
    digits.push(remainder < 2 ? 0 : 11 - remainder);
  }
  return digits.join('');
}

test.beforeAll(async () => {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !/^run-/.test(path.basename(root))) throw Error('Armazenamento fictício isolado obrigatório');
  await fs.mkdir(evidence, { recursive: true });
});
async function prepare(page: Page) {
  await page.addInitScript(port => { (window as any).electronAPI = { getApiPort: () => port }; }, Number(process.env.GEOGESTOR_E2E_API_PORT));
}
async function theme(page: Page, value = 'light') {
  await page.evaluate(value => {
    localStorage.setItem('geogestor_theme', value);
    document.documentElement.classList.toggle('dark', value === 'dark');
  }, value);
}
async function open(page: Page, value = 'light') {
  await page.goto(origin + '/clientes');
  const opener = page.getByRole('button', { name: 'Novo cliente', exact: true }).first();
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  await expect(opener.or(unlock)).toBeVisible();
  if (await unlock.isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await opener.click();
  const dialog = page.getByRole('dialog', { name: /^Novo cliente/ });
  await expect(dialog.locator('#client-nome')).toBeFocused();
  await expect(dialog).toHaveCSS('opacity', '1');
  await theme(page, value);
  return { dialog, opener };
}
async function section(dialog: Locator, label: string) {
  await dialog.getByRole('navigation', { name: 'Seções do cadastro do cliente' }).getByRole('button', { name: label, exact: true }).click();
  const ids: Record<string, string> = { Identificação: 'identification', Contato: 'contact', Endereço: 'address', Comercial: 'commercial' };
  await expect(dialog.locator('#client-section-' + ids[label] + '-title')).toBeFocused();
}
async function valid(dialog: Locator, name = title()) {
  await dialog.getByRole('radio', { name: /Pessoa física/ }).check();
  await dialog.locator('#client-nome').fill(name);
  await dialog.locator('#client-cpf').fill(fictionalCpf());
  await section(dialog, 'Contato');
  await dialog.locator('#client-celular').fill('48999991234');
  return name;
}
async function discard(page: Page, dialog: Locator) {
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Descartar alterações do cliente?' });
  if (await confirmation.count()) await confirmation.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function bounds(page: Page, dialog: Locator) {
  const result = await dialog.evaluate(el => {
    const r = el.getBoundingClientRect();
    const body = el.querySelector('#client-form-scroll-region')!;
    const submit = el.querySelector('button[form="client-registration-form"]')!;
    const b = submit.getBoundingClientRect();
    return { x: r.x, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight,
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, bodyHeight: body.clientHeight,
      footerVisible: submit.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) };
  });
  expect(result.x).toBeGreaterThanOrEqual(0);
  expect(result.right).toBeLessThanOrEqual(result.width);
  expect(result.bottom).toBeLessThanOrEqual(result.height);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth);
  expect(result.bodyHeight).toBeGreaterThan(40);
  expect(result.footerVisible).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  return result;
}
async function focusVisible(field: Locator) {
  await field.focus();
  await expect(field).toBeFocused();
  await expect.poll(() => field.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

test('validação, PF/PJ, feedback ao sair, seções, notas, teclado e descarte', async ({ page }) => {
  await prepare(page);
  const { dialog, opener } = await open(page);
  await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: /Pessoa física/ })).toBeFocused();
  await valid(dialog);
  await section(dialog, 'Identificação');
  await dialog.locator('#client-cpf').fill('529');
  await expect(dialog.locator('#client-cpf-feedback')).toHaveCount(0);
  await dialog.locator('#client-nome').click();
  await expect(dialog.locator('#client-cpf-feedback')).toContainText('incompleto');
  await dialog.locator('#client-cpf').fill('52998224725');
  await dialog.getByRole('radio', { name: /Pessoa jurídica/ }).check();
  await dialog.locator('#client-cnpj').fill('11222333000181');
  await dialog.getByRole('radio', { name: /Pessoa física/ }).check();
  await expect(dialog.locator('#client-cpf')).toHaveValue('529.982.247-25');
  await dialog.getByRole('radio', { name: /Pessoa jurídica/ }).check();
  await expect(dialog.locator('#client-cnpj')).toHaveValue('11.222.333/0001-81');
  await dialog.getByRole('radio', { name: /Pessoa física/ }).check();
  await section(dialog, 'Contato');
  await dialog.getByText('Este celular possui WhatsApp', { exact: true }).click();
  await expect(dialog.locator('#client-celularWhatsapp')).toBeChecked();
  await dialog.locator('#client-celular').fill('');
  await expect(dialog.locator('#client-celularWhatsapp')).not.toBeChecked();
  await expect(dialog.locator('#client-celularWhatsapp')).toBeDisabled();
  await dialog.locator('#client-telefone').fill('4833334444');
  await section(dialog, 'Endereço');
  await dialog.locator('#client-cep').fill('123');
  await dialog.locator('#client-section-address').getByRole('button', { name: 'Endereço', exact: true }).click();
  await expect(dialog.locator('#client-cep')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(dialog.locator('#client-cep')).toBeFocused();
  await dialog.locator('#client-cep').fill('88010000');
  await dialog.locator('#client-endereco').fill('Rua EXEMPLO FICTÍCIO');
  await dialog.locator('#client-section-address').getByRole('button', { name: 'Endereço', exact: true }).click();
  await expect(dialog.locator('#client-section-address')).toContainText('Rua EXEMPLO FICTÍCIO');
  await dialog.getByRole('tab', { name: 'Anotações fixas' }).click();
  await dialog.locator('#client-anotacoes').fill('EXEMPLO FICTÍCIO — Prefere contato pela manhã');
  await dialog.getByRole('tab', { name: 'Cadastro', exact: true }).click();
  await expect(dialog.locator('#client-section-address').getByRole('button', { name: 'Endereço', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await section(dialog, 'Endereço');
  await expect(dialog.locator('#client-cep')).toHaveValue('88010-000');
  await dialog.getByRole('tab', { name: 'Anotações fixas' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('tab', { name: 'Cadastro', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Fechar modal' })).toBeFocused();
  await page.keyboard.press('Escape');
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.getByRole('button', { name: 'Continuar editando' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('button', { name: 'Fechar modal' })).toBeFocused();
  await dialog.getByRole('tab', { name: 'Anotações fixas' }).click();
  await expect(dialog.locator('#client-anotacoes')).toHaveValue('EXEMPLO FICTÍCIO — Prefere contato pela manhã');
  await discard(page, dialog);
  await expect(opener).toBeFocused();
});

test('criação PF/PJ, vínculos comerciais e edição preservam o contrato', async ({ page }) => {
  await prepare(page);
  const { dialog, opener } = await open(page);
  const name = await valid(dialog);
  await section(dialog, 'Identificação');
  const cpf = await dialog.locator('#client-cpf').inputValue();
  await dialog.locator('#client-categoriaPrincipal').click();
  await page.getByRole('option', { name: 'Produtor Rural', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Parceiro', exact: true }).check();
  await section(dialog, 'Comercial');
  await dialog.locator('#client-origemPrincipal').click();
  await page.getByRole('option', { name: 'Indicação', exact: true }).click();
  await dialog.locator('#client-indicadoPor').fill('EXEMPLO FICTÍCIO — Indicação');
  await dialog.getByRole('checkbox', { name: 'Georreferenciamento', exact: true }).check();
  const responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/clientes'));
  await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  const saved = await response.json();
  expect(saved).toMatchObject({ nome: name, tipoPessoa: 'PF', cpf, categoria: 'Produtor Rural', perfis: 'Parceiro', servicos: 'Georreferenciamento' });
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.getByRole('button', { name: 'Ações de ' + name, exact: true }).filter({ visible: true }).click();
  await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
  const editor = page.getByRole('dialog', { name: /^Editar cliente/ });
  await page.evaluate(() => {
    (window as any).__clientFocusLog = [];
    document.addEventListener('focusin', event => (window as any).__clientFocusLog.push((event.target as HTMLElement).outerHTML.slice(0, 400)));
  });
  await editor.locator('#client-nome').fill(name + ' — editado');
  const patchPromise = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/api/clientes/' + saved.id));
  await editor.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  expect((await patchPromise).ok()).toBe(true);
  await expect(editor).toHaveCount(0);
  await fs.writeFile(path.join(evidence, 'foco-edicao.json'), JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 400), log: (window as any).__clientFocusLog })), null, 2));
  await expect(page.locator(`[data-client-actions="${saved.id}"]:visible`)).toBeFocused();
  const second = await open(page);
  await second.dialog.getByRole('radio', { name: /Pessoa jurídica/ }).check();
  await second.dialog.locator('#client-nome').fill(title());
  await second.dialog.locator('#client-cnpj').fill('11222333000181');
  await section(second.dialog, 'Contato');
  await second.dialog.locator('#client-telefone').fill('4833331234');
  const businessPromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/clientes'));
  await second.dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  const business = await businessPromise;
  expect(business.ok(), await business.text()).toBe(true);
  expect(await business.json()).toMatchObject({ tipoPessoa: 'PJ', cnpj: '11.222.333/0001-81', cpf: null });
  await expect(second.dialog).toHaveCount(0);
  await fs.writeFile(path.join(evidence, 'cadastro-edicao.json'), JSON.stringify({ saved, business: await business.json() }, null, 2));
});

test('envio lento, falhas HTTP e comunicação, preenchimento, nova tentativa e trava imediata', async ({ page }) => {
  await prepare(page);
  const { dialog } = await open(page);
  const name = await valid(dialog);
  await dialog.getByRole('tab', { name: 'Anotações fixas' }).click();
  await dialog.locator('#client-anotacoes').fill('EXEMPLO FICTÍCIO — Preservar após falha');
  const endpoint = '**/api/clientes';
  await page.route(endpoint, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Revise os dados e tente novamente');
  await expect(dialog.locator('#client-anotacoes')).toHaveValue('EXEMPLO FICTÍCIO — Preservar após falha');
  await dialog.screenshot({ path: path.join(evidence, 'falha-preservada.png') });
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Confira a lista de clientes antes de reenviar');
  await page.unroute(endpoint);
  let release!: () => void, calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(endpoint, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls++; await gate; await route.continue();
  });
  const before = await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).boundingBox();
  await dialog.locator('#client-registration-form').evaluate(form => {
    (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit();
  });
  const pending = dialog.getByRole('button', { name: 'Salvando…', exact: true });
  await expect(pending).toBeDisabled();
  expect((await pending.boundingBox())!.width).toBe(before!.width);
  await expect(dialog.locator('#client-anotacoes')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Fechar modal' })).toBeDisabled();
  await expect(dialog.locator('#client-save-status')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('#client-save-status')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('#client-save-status')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect.poll(() => calls).toBe(1);
  await dialog.screenshot({ path: path.join(evidence, 'salvando.png') });
  release();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill(name);
  await expect(page.getByRole('link', { name: 'Abrir cadastro de ' + name, exact: true }).filter({ visible: true })).toHaveCount(1);
});

test('navegação com rascunho: voltar, continuar editando e descartar', async ({ page }) => {
  await prepare(page);
  const first = await open(page);
  await first.dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('link', { name: 'Financeiro', exact: true }).click();
  await page.getByRole('link', { name: 'Comercial', exact: true }).click();
  const opener = page.getByRole('button', { name: 'Novo cliente', exact: true }).first();
  await opener.click();
  const dialog = page.getByRole('dialog', { name: /^Novo cliente/ });
  const name = await valid(dialog);
  await page.goBack();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page).toHaveURL(origin + '/clientes');
  await section(dialog, 'Identificação');
  await expect(dialog.locator('#client-nome')).toHaveValue(name);
  await page.goBack();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(page).toHaveURL(origin + '/financeiro');
});

test('temas claro/escuro, amplo/estreito, seletor aberto e acessibilidade', async ({ page }) => {
  await prepare(page);
  const matrix = [];
  for (const width of [1440, 360]) for (const value of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    const { dialog } = await open(page, value);
    await valid(dialog, 'EXEMPLO FICTÍCIO — Maria da Silva');
    await section(dialog, 'Identificação');
    await bounds(page, dialog);
    const axe = await new AxeBuilder({ page }).include('.geo-client-registration').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations).toEqual([]);
    await dialog.screenshot({ path: path.join(evidence, `cliente-${value}-${width}.png`) });
    const category = dialog.locator('#client-categoriaPrincipal');
    await category.press('ArrowDown');
    const popup = page.getByRole('listbox');
    await expect(popup).toBeVisible();
    const a = (await category.boundingBox())!, b = (await popup.boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    const popupAxe = await new AxeBuilder({ page }).include('.geo-client-registration-options').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(popupAxe.violations).toEqual([]);
    await page.screenshot({ path: path.join(evidence, `categoria-${value}-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(category).toBeFocused();
    await section(dialog, 'Contato');
    await focusVisible(dialog.locator('#client-celular'));
    await dialog.screenshot({ path: path.join(evidence, `contato-${value}-${width}.png`) });
    await section(dialog, 'Comercial');
    await dialog.locator('#client-origemPrincipal').click();
    await page.getByRole('option', { name: 'Outro', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
    await expect(dialog.locator('#client-origemDetalhe')).toBeFocused();
    await dialog.locator('#client-origemDetalhe').fill('EXEMPLO FICTÍCIO — Evento');
    matrix.push({ width, theme: value, axe: axe.violations.length, bounds: await bounds(page, dialog), popupWidthDelta: Math.abs(a.width - b.width) });
    await discard(page, dialog);
  }
  await fs.writeFile(path.join(evidence, 'matriz.json'), JSON.stringify(matrix, null, 2));
});

test('zoom real de 200% no Electron, dois temas, campos e ações acessíveis', async () => {
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
    const results = [];
    for (const value of ['light', 'dark']) {
      const { dialog } = await open(page, value);
      await valid(dialog, 'EXEMPLO FICTÍCIO — Cliente zoom 200%');
      await section(dialog, 'Identificação');
      await dialog.locator('#client-categoriaPrincipal').press('ArrowDown');
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await section(dialog, 'Contato');
      await focusVisible(dialog.locator('#client-celular'));
      results.push({ theme: value, bounds: await bounds(page, dialog) });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const png = await win.evaluate(async window => (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      await fs.writeFile(path.join(evidence, `zoom-real-200-${value}.png`), Buffer.from(png, 'base64'));
      await discard(page, dialog);
    }
    await fs.writeFile(path.join(evidence, 'zoom-real.json'), JSON.stringify({ factor: await win.evaluate(window => window.webContents.getZoomFactor()), results }, null, 2));
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
