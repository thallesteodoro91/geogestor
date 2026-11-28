import { test, expect, _electron as electron, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { relativeDate } from './support/runtime';
import { openIsolatedPage, prepareIsolatedPage } from './support/isolated-session';
import { expectUnclipped } from './support/calendar-assertions';

test.setTimeout(240_000);
const output = path.resolve('docs/auditorias/2026-11-02-planejamento-validacao-final');
const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const api = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;

async function fixture(request: APIRequestContext) {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !path.resolve(root).startsWith(path.resolve('scratch/commercial-e2e') + path.sep)) throw new Error('Banco fictício gerenciado obrigatório');
  await fs.mkdir(output, { recursive: true });
  const unlocked = await request.post(api + '/api/auth/unlock', { data: { password: 'GeoGestor-E2E-2026' } });
  expect(unlocked.ok()).toBe(true);
  const session = await unlocked.json();
  const headers = { 'x-local-session': session.token };
  async function post(route: string, data: Record<string, unknown>) {
    const response = await request.post(api + '/api/planejamento/' + route, { headers, data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const cycle = await post('ciclos', { nome: 'EXEMPLO FICTÍCIO — Validação final', dataInicio: relativeDate(-10), dataFim: relativeDate(120), visao: 'Preservar dados e acompanhar entregas.', status: 'ativo', proximaRevisao: relativeDate(30) });
  const pillar = await post('pilares', { cicloId: cycle.id, nome: 'EXEMPLO FICTÍCIO — Qualidade', ordem: 0 });
  const objective = await post('objetivos', { cicloId: cycle.id, pilarId: pillar.id, titulo: 'EXEMPLO FICTÍCIO — Entregas', responsavel: 'Equipe fictícia', dataLimite: relativeDate(90), status: 'em_andamento', prioridade: 'alta', ordem: 0 });
  const initiative = await post('iniciativas', { objetivoId: objective.id, titulo: 'EXEMPLO FICTÍCIO — Conferência', responsavel: 'Equipe fictícia', dataLimite: relativeDate(45), progresso: 25, status: 'em_andamento' });
  const risk = await post('riscos', { cicloId: cycle.id, objetivoId: null, iniciativaId: initiative.id, descricao: 'EXEMPLO FICTÍCIO — Risco por iniciativa', impacto: 'critico', probabilidade: 'alto', responsavel: 'Equipe fictícia', status: 'aberto' });
  const review = await post('checkins', { cicloId: cycle.id, objetivoId: objective.id, data: relativeDate(), narrativa: 'EXEMPLO FICTÍCIO — Revisão com seis decisões', status: 'atencao', confianca: 'media', decisoes: 'Anotação anterior preservada.', proximosPassos: 'Passo anterior preservado.', proximaRevisao: relativeDate(20) });
  for (let index = 1; index <= 6; index++) await post('decisoes', { cicloId: cycle.id, objetivoId: objective.id, checkinId: review.id, descricao: `EXEMPLO FICTÍCIO — Decisão ${index}`, responsavel: 'Equipe fictícia', prazo: relativeDate(10), status: 'pendente' });
  return { cycle, objective, risk, review };
}

async function gradientContrast(page: Page, selector: string, name: string) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const records = [];
  for (const state of ['rest', 'hover']) {
    if (state === 'hover') await target.hover();
    else await page.mouse.move(0, 0);
    const data = await target.evaluate(element => {
      const style = getComputedStyle(element);
      const values = style.backgroundImage.match(/(?:rgb|rgba|hsl|hsla)\([^)]*\)/g) || [];
      const ctx = document.createElement('canvas').getContext('2d')!;
      function rgb(color: string) {
        ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      }
      function luminance(color: number[]) {
        return color.map(value => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      }
      const fg = luminance(rgb(style.color));
      const stops = values.map(value => rgb(value));
      const samples = stops.flatMap((stop, index) => index === stops.length - 1 ? [stop] : Array.from({ length: 101 }, (_, step) => stop.map((value, channel) => value + (stops[index + 1][channel] - value) * step / 100)));
      const ratios = samples.map(sample => { const bg = luminance(sample); return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05); });
      return { foreground: style.color, gradient: style.backgroundImage, minimumContrast: Math.min(...ratios), sampleCount: samples.length };
    });
    expect(data.sampleCount).toBeGreaterThan(0);
    expect(data.minimumContrast).toBeGreaterThanOrEqual(4.5);
    records.push({ state, ...data });
  }
  await fs.writeFile(path.join(output, name + '-gradient-contrast.json'), JSON.stringify(records, null, 2));
}

async function axe(page: Page, name: string) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
  const results = await new AxeBuilder({ page }).setLegacyMode().withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  await fs.writeFile(path.join(output, name + '-axe.json'), JSON.stringify({ violations: results.violations, incomplete: results.incomplete, passes: results.passes.map(item => item.id) }, null, 2));
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test('vínculo indireto, decisões compactas e falha ao salvar mantêm contexto e preenchimento', async ({ page, request }) => {
  const data = await fixture(request);
  await prepareIsolatedPage(page);
  await openIsolatedPage(page, origin + `/planejamento?ciclo=${data.cycle.id}&aba=visao`);
  await expect(page.getByRole('heading', { name: 'Planejamento estratégico', exact: true })).toBeVisible();
  const summary = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Objetivos em risco', exact: true }) });
  await expect(summary.locator('.tabular-nums')).toHaveText('1');
  await page.getByRole('button', { name: 'Abrir risco', exact: true }).click();
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
  await page.getByLabel('Filtrar por objetivo', { exact: true }).click();
  await page.getByRole('option', { name: data.objective.titulo, exact: true }).click();
  await expect(page.getByText(data.risk.descricao, { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Filtros do planejamento"] [role="status"]')).toContainText('1 de 1');
  await page.getByRole('link', { name: 'Revisões (1)', exact: true }).click();
  const decisions = page.locator(`#checkin-decisions-${data.review.id}`);
  await expect(decisions.locator('li')).toHaveCount(3);
  const expand = page.getByRole('button', { name: 'Ver todas as 6 decisões', exact: true });
  await expand.focus(); await expand.press('Enter');
  await expect(decisions.locator('li')).toHaveCount(6);
  await page.getByRole('button', { name: 'Mostrar menos decisões', exact: true }).press('Space');
  await expect(decisions.locator('li')).toHaveCount(3);
  await page.getByRole('button', { name: /^Editar revisão de / }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar revisão estratégica', exact: true });
  const narrative = dialog.getByLabel('Leitura executiva', { exact: true });
  await narrative.fill('EXEMPLO FICTÍCIO — Rascunho preservado após falha');
  let fail = true;
  await page.route(`**/api/planejamento/checkins/${data.review.id}`, async route => {
    if (route.request().method() === 'PATCH' && fail) { fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Falha fictícia de salvamento. Tente novamente.' }) }); }
    else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  const error = dialog.getByRole('alert');
  await expect(error).toContainText('Falha fictícia de salvamento');
  await expect(error).toBeFocused();
  await expect(narrative).toHaveValue('EXEMPLO FICTÍCIO — Rascunho preservado após falha');
  await axe(page, 'erro-no-formulario');
  await page.screenshot({ path: path.join(output, 'erro-no-formulario.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await openIsolatedPage(page, await page.url());
  await expect(page.getByText('EXEMPLO FICTÍCIO — Rascunho preservado após falha', { exact: true })).toBeVisible();
  await page.getByText('Anotações anteriores', { exact: true }).click();
  await expect(page.getByText('Anotação anterior preservada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Passo anterior preservado.', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, 'revisao-compacta-preservada.png'), fullPage: true });
});

test('Electron em zoom nativo 200%: teclado, formulários e contraste nos dois temas', async ({ request }) => {
  const data = await fixture(request);
  const requireRoot = createRequire(path.resolve('package.json'));
  let executablePath: string;
  try { executablePath = requireRoot('electron'); } catch { executablePath = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); }
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE')), GEOGESTOR_E2E_OFFSCREEN: '1' };
  const desktop = await electron.launch({ executablePath, args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env, timeout: 30_000 });
  const records = [];
  try {
    const page = await desktop.firstWindow();
    const win = await desktop.browserWindow(page);
    await prepareIsolatedPage(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await win.evaluate(window => { window.webContents.setBackgroundThrottling(false); window.setContentSize(1280, 960); window.webContents.setZoomFactor(2); });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(640);
    for (const theme of ['light', 'dark']) {
      await page.addInitScript(value => localStorage.setItem('geogestor_theme', value), theme);
      await openIsolatedPage(page, origin + `/planejamento?ciclo=${data.cycle.id}&aba=revisoes&revisoes.lista=revisoes`);
      await expect(page.getByRole('heading', { name: 'Revisões estratégicas', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await axe(page, 'governanca-200-' + theme);
      await gradientContrast(page, '.planning-workspace .geo-button-primary', 'cabecalho-' + theme);
      await page.getByRole('tab', { name: 'Revisões e riscos', exact: true }).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByRole('tab', { name: 'Iniciativas', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { name: 'Revisões e riscos', exact: true })).toBeFocused();
      const primary = page.getByRole('button', { name: 'Registrar revisão', exact: true });
      await primary.focus(); await primary.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Registrar revisão estratégica', exact: true });
      await expect(dialog).toHaveCSS('opacity', '1');
      const submit = dialog.getByRole('button', { name: 'Registrar revisão', exact: true });
      await expectUnclipped(submit);
      await expectUnclipped(dialog.getByRole('button', { name: 'Cancelar', exact: true }));
      const controls = dialog.locator('button:visible,input:visible,textarea:visible,[role="combobox"]:visible');
      const steps = await controls.count() + 2;
      for (let step = 0; step < steps; step++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      }
      await dialog.getByRole('combobox', { name: 'Situação', exact: true }).focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Data da revisão', exact: true }).click();
      await expect(page.getByRole('grid')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await axe(page, 'formulario-200-' + theme);
      await gradientContrast(page, '.planning-editor-submit', 'formulario-' + theme);
      const image = await win.evaluate(async window => (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      await fs.writeFile(path.join(output, 'zoom-nativo-200-' + theme + '.png'), Buffer.from(image, 'base64'));
      records.push({ theme, zoom: await win.evaluate(window => window.webContents.getZoomFactor()), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth })), keyboardFocusContained: true, footerUnclipped: true });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(primary).toBeFocused();
    }
    await fs.writeFile(path.join(output, 'zoom-e-teclado.json'), JSON.stringify(records, null, 2));
  } finally {
    await desktop.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await desktop.close().catch(() => {});
  }
});
