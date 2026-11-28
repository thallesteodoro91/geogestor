import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { buildCalendarFixture } from './support/calendar-fixture-build';
import { prepareIsolatedPage, openIsolatedPage } from './support/isolated-session';
import { expectUnclipped, expectCalendarCommands } from './support/calendar-assertions';

test.setTimeout(240000);
const out = path.resolve('docs/auditorias/2026-10-18-calendario-200/componente');
const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
let code: string;
test.beforeAll(async () => { await fs.mkdir(out, { recursive: true }); code = await buildCalendarFixture(); });

test('componente em áreas equivalentes a 200%: dias, comandos, mouse, teclado, restrições e datas', async ({ page }) => {
  const records = [];
  try {
    page.on('pageerror', error => console.log('Fixture error:', error.message));
    page.on('console', message => { if (message.type() === 'error') console.log('Fixture console:', message.text()); });
    await prepareIsolatedPage(page); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, route => route.abort());
    await openIsolatedPage(page, origin + '/');
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => (link as HTMLLinkElement).href));
    await page.route('**/__calendar-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="pt-BR"><head><title>EXEMPLO FICTÍCIO — Calendário isolado</title><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map(href => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><div id="root"></div></body></html>` }));
    for (const theme of ['dark', 'light']) for (const size of [{ width: 1280, height: 960 }, { width: 640, height: 960 }, { width: 1280, height: 560 }]) {
      await page.setViewportSize({ width: size.width / 2, height: size.height / 2 });
      await page.goto(origin + '/__calendar-fixture');
      await page.addScriptTag({ content: code });
      console.log('Fixture loaded', code.length, await page.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 350), root: document.getElementById('root')?.innerHTML.slice(0, 350), scripts: document.scripts.length })));
      await expect(page.getByRole('button', { name: 'Abrir formulário fictício', exact: true })).toBeVisible({ timeout: 10000 });
      await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
      await page.getByRole('button', { name: 'Abrir formulário fictício', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'EXEMPLO FICTÍCIO — Formulário', exact: true }); await expect(form).toHaveCSS('opacity', '1');
      const open = async (id: string) => { const trigger = page.locator('#fixture-' + id); await trigger.scrollIntoViewIfNeeded(); await trigger.click(); const popup = page.getByRole('dialog', { name: 'Selecionar data', exact: true }); await expect(popup).toBeVisible(); await expectCalendarCommands(popup); return popup; };
      let popup = await open('stored');
      await expect(popup.getByRole('gridcell')).toHaveCount(42);
      await expect(popup.getByRole('gridcell', { name: '31 de dezembro de 2026', exact: true })).toBeFocused();
      await expect(page.locator('input[name="stored"]')).toHaveValue('2026-12-31');
      await popup.getByRole('gridcell', { name: '31 de dezembro de 2026', exact: true }).press('ArrowDown');
      const active = popup.locator('[role="gridcell"][tabindex="0"]'); await expect(active).toBeFocused(); await expectUnclipped(active); await expectCalendarCommands(popup);
      await page.keyboard.press('Escape'); await expect(page.locator('#fixture-stored')).toBeFocused(); await expect(form).toBeVisible(); await expect(page.locator('input[name="stored"]')).toHaveValue('2026-12-31');
      popup = await open('stored');
      await popup.getByRole('button', { name: 'Próximo mês', exact: true }).click(); await expect(popup.getByRole('button', { name: 'Próximo mês', exact: true })).toBeFocused();
      await popup.getByRole('button', { name: 'Mês anterior', exact: true }).click();
      const today = popup.getByRole('button', { name: 'Hoje', exact: true }); await today.focus(); await today.press('Tab'); await expect(popup.getByRole('button', { name: 'Mês anterior', exact: true })).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(today).toBeFocused();
      await popup.getByRole('button', { name: 'Dezembro de 2026', exact: true }).click();
      const december = popup.getByRole('button', { name: 'Dez', exact: true }); await december.scrollIntoViewIfNeeded(); await expectUnclipped(december); await december.click();
      const grid = popup.getByRole('grid'); await grid.hover(); await page.mouse.wheel(0, 1000);
      const last = popup.getByRole('gridcell').last(); await expectUnclipped(last); await expectCalendarCommands(popup);
      const geometry = await popup.evaluate(el => { const r = el.getBoundingClientRect(), grid = el.querySelector('[role="grid"]')!; return { top: r.top, bottom: r.bottom, width: r.width, viewport: { width: innerWidth, height: innerHeight }, grid: { height: grid.clientHeight, scrollHeight: grid.scrollHeight, scrollTop: grid.scrollTop, overflow: getComputedStyle(grid).overflowY } }; });
      expect(geometry.top).toBeGreaterThanOrEqual(0); expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport.height); expect(geometry.grid.overflow).toBe('auto');
      await page.screenshot({ path: path.join(out, `${theme}-${size.width}-${size.height}-ultima-semana.png`), animations: 'disabled' });
      await last.click(); await expect(page.locator('input[name="stored"]')).toHaveValue('2027-01-09'); await expect(page.locator('#fixture-stored')).toContainText('09/01/2027');
      popup = await open('stored'); await popup.getByRole('button', { name: 'Limpar', exact: true }).click(); await expect(page.locator('input[name="stored"]')).toHaveValue('');
      popup = await open('stored'); const openedAxe = await new AxeBuilder({ page }).include('.geo-popover-surface').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(openedAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]); await popup.getByRole('button', { name: 'Hoje', exact: true }).click(); const date = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }); await expect(page.locator('input[name="stored"]')).toHaveValue(date);
      popup = await open('limits'); await expect(popup.getByRole('gridcell', { name: '17 de outubro de 2026', exact: true })).toBeDisabled(); await expect(popup.getByRole('gridcell', { name: '23 de outubro de 2026', exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.locator('input[name="limits"]')).toHaveValue('2026-10-20');
      popup = await open('required'); await expect(popup.getByRole('button', { name: 'Limpar', exact: true })).toHaveCount(0); await page.keyboard.press('Escape');
      popup = await open('noclear'); await expect(popup.getByRole('button', { name: 'Limpar', exact: true })).toHaveCount(0); await page.keyboard.press('Escape');
      popup = await open('readonly'); await expect(popup.getByRole('button', { name: 'Hoje', exact: true })).toBeDisabled(); await expect(popup.getByRole('button', { name: 'Limpar', exact: true })).toHaveCount(0); await popup.getByRole('gridcell', { name: '21 de outubro de 2026', exact: true }).click(); await expect(page.locator('input[name="readonly"]')).toHaveValue('2026-10-20'); await page.keyboard.press('Escape');
      await expect(page.locator('#fixture-disabled')).toBeDisabled();
      popup = await open('default'); await popup.getByRole('gridcell', { name: '22 de outubro de 2026', exact: true }).click(); await expect(page.locator('input[name="uncontrolled"]')).toHaveValue('2026-10-22');
      await page.locator('#fixture-select').click(); await page.getByRole('option', { name: 'EXEMPLO FICTÍCIO — opção 2', exact: true }).click(); await expect(page.locator('#fixture-select')).toContainText('opção 2');
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
      records.push({ theme, size, equivalentZoom: 2, nativeZoom: false, ...geometry, valuesPreserved: true, limitsPreserved: true, mouseLastDay: true, keyboardFocus: true });
      await fs.writeFile(path.join(out, 'resultados.json'), JSON.stringify(records, null, 2));
    }
  } finally { /* Browser lifecycle belongs to the isolated Playwright harness. */ }
});
