import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { e2eReferenceDate, relativeDate } from './support/runtime';
import { budgetGroup } from './support/budget-editor-groups';

test.setTimeout(180_000);
test.use({ actionTimeout: 12_000 });
const evidence = path.resolve(process.env.GEOGESTOR_BUDGET_GROUP_EVIDENCE || 'docs/auditorias/2026-10-16-novo-orcamento-seis-grupos/evidencias');
const api = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const web = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const root = process.env.GEOGESTOR_E2E_ROOT!;
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
let budget: any;
const clientName = 'EXEMPLO FICTÍCIO — Associação com nome extenso para validar todos os campos do orçamento';
const clientId = crypto.randomUUID(), projectId = crypto.randomUUID();
function database() { if (!root || !/^run-/.test(path.basename(root))) throw Error('Somente banco fictício isolado'); return createClient({ url: `file:${path.join(root, 'geogestor.db')}` }); }
async function prepare(page: Page) { await page.addInitScript(port => { (window as any).electronAPI = { getApiPort: () => port }; }, Number(process.env.GEOGESTOR_E2E_API_PORT)); }
async function visit(page: Page, route: string) {
  await page.goto(web + route);
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  await expect(unlock.or(page.getByRole('heading', { name: /^(Novo orçamento|Editar orçamento|Orçamentos)$/ }))).toBeVisible();
  if (await unlock.isVisible()) { await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026'); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click(); }
  await expect(page.locator('#budget-description')).toBeVisible();
}
async function theme(page: Page, value: string) { await page.evaluate(value => { localStorage.setItem('geogestor_theme', value); document.documentElement.classList.toggle('dark', value === 'dark'); }, value); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }

test.beforeAll(async ({ request }) => {
  await fs.mkdir(evidence, { recursive: true });
  const db = database();
  await db.execute('PRAGMA busy_timeout = 5000');
  await db.batch([
    { sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [clientId, clientName] },
    { sql: "insert into projetos (id,cliente_id,nome,tipo,status) values (?,?,?,'Topografia','Em Andamento')", args: [projectId, clientId, 'EXEMPLO FICTÍCIO — Projeto vinculado'] }
  ], 'write'); db.close();
  const auth = await request.post(api + '/api/auth/unlock', { data: { password: 'GeoGestor-E2E-2026' } });
  const headers = { 'x-local-session': (await auth.json()).token };
  const response = await request.post(api + '/api/orcamentos', { headers, data: {
    clientId, projectId, description: 'EXEMPLO FICTÍCIO — Proposta completa em seis grupos', issueDate: e2eReferenceDate(), validUntil: relativeDate(30),
    technicalLead: 'EXEMPLO FICTÍCIO — Responsável técnico', source: 'manual', serviceType: 'Levantamento cadastral', propertyType: 'rural', propertyName: 'EXEMPLO FICTÍCIO — Imóvel', municipality: 'Florianópolis', state: 'SC', executionDays: 15,
    methodology: 'EXEMPLO FICTÍCIO — Método GNSS RTK', deliverables: 'EXEMPLO FICTÍCIO — Planta e memorial', internalNotes: 'EXEMPLO FICTÍCIO — SIGILO_INTERNO', clientNotes: 'EXEMPLO FICTÍCIO — Observação pública', terms: 'EXEMPLO FICTÍCIO — Termos preservados',
    characterization: { executionStart: { type: 'initial_payment' }, scopeDescription: 'EXEMPLO FICTÍCIO — Escopo preservado', estimatedArea: '12.34', areaUnit: 'hectare', estimatedVertices: '12', neighbors: '3', distanceKm: '15.5', complexity: 'média', surveyMethod: 'RTK', physicalGroundControl: 'EXEMPLO FICTÍCIO — Marco físico', gnssElectronicBase: 'EXEMPLO FICTÍCIO — Receptor de referência', equipment: 'EXEMPLO FICTÍCIO — GNSS', travelRequired: true, lodgingRequired: false, additionalTeam: true },
    globalDiscount: { type: 'fixo', value: '0' }, globalAddition: { type: 'fixo', value: '0' },
    items: [{ code: 'FIC-01', group: 'EXEMPLO FICTÍCIO — Grupo', description: 'EXEMPLO FICTÍCIO — Serviço de levantamento', unit: 'serviço', quantity: '1', unitPriceCents: 123457, unitCostCents: 12000, discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: true, optional: false, component: 'servico', notes: 'EXEMPLO FICTÍCIO — Nota preservada' }],
    costs: [{ category: 'Outros custos', description: 'EXEMPLO FICTÍCIO — Deslocamento', amountCents: 1234, classification: 'custo_proprio', taxable: false, notes: 'EXEMPLO FICTÍCIO — Custo reservado' }],
    taxes: [{ name: 'EXEMPLO FICTÍCIO — Tributo', acronym: 'FIC', ratePercent: '1.25', calculationBase: 'servicos', includedInPrice: true, cumulative: false, manualAdjustmentCents: 0 }],
    payment: { type: 'avista', paymentMethod: 'PIX', financialAccount: 'EXEMPLO FICTÍCIO — Conta interna', description: 'EXEMPLO FICTÍCIO — Condição complementar', installments: [{ percentage: '100', daysAfterApproval: 0, label: 'Pagamento' }], interestBasisPoints: 100, fineBasisPoints: 200, earlyDiscountBasisPoints: 50 }
  } });
  expect(response.status(), await response.text()).toBe(201); budget = await response.json();
  await fs.writeFile(path.join(root, 'six-fixture.json'), JSON.stringify({ clientId, projectId, budget }));
});

test('seis grupos: temas, larguras, controles, calendários e análise interna', async ({ page }) => {
  await prepare(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  const measurements = [];
  for (const width of [1440, 1280, 360]) for (const value of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 }); await visit(page, `/orcamentos/${budget.id}/editar`); await theme(page, value);
    await expect(page.locator('[data-budget-group]')).toHaveCount(6);
    await expect(page.locator('#budget-description')).toBeFocused();
    await expect(page.locator('#budget-client')).toContainText(clientName);
    if (value === 'light') {
      const compact = page.locator('#budget-group');
      if (await compact.isVisible()) {
        await compact.focus(); await page.keyboard.press('Enter');
        const option = page.getByRole('option', { name: /Itens e preços/ });
        await option.focus(); await page.keyboard.press('Enter');
      } else {
        await page.locator('[data-budget-nav-section="items"]').focus(); await page.keyboard.press('Enter');
      }
      await expect(page.locator('#budget-section-items h3 > button')).toBeFocused();
      await page.keyboard.press('Tab'); await expect(page.locator('#budget-template')).toBeFocused();
      await budgetGroup(page, 'header');
      await page.locator('#budget-description').fill('EXEMPLO FICTÍCIO — Digitação com foco preservado');
      await expect(page.locator('#budget-description')).toBeFocused();
      await page.locator('#budget-description').fill(budget.descricao);
    }
    await page.locator('.budget-editor-navigation').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await noOverflow(page);
    await page.screenshot({ path: path.join(evidence, `proposta-${width}-${value}.png`) });
    await budgetGroup(page, 'characterization');
    await expect(page.locator('#budget-execution-days')).toHaveValue('15');
    await page.getByRole('button', { name: /^Método e infraestrutura de campo/ }).click();
    await expect(page.locator('#budget-ground-control')).toHaveValue('EXEMPLO FICTÍCIO — Marco físico');
    await expect(page.locator('#budget-gnss-base')).toHaveValue('EXEMPLO FICTÍCIO — Receptor de referência');
    await budgetGroup(page, 'items');
    await expect.poll(() => page.locator('.budget-editor-navigation').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(0);
    await expect(page.locator('#budget-item-description-0')).toHaveValue('EXEMPLO FICTÍCIO — Serviço de levantamento');
    const containedTools = await page.locator('.budget-item-tools button').evaluateAll(buttons => buttons.every(button => {
      const parent = button.closest('section')!.getBoundingClientRect(); const rect = button.getBoundingClientRect();
      return rect.left >= parent.left && rect.right <= parent.right && rect.bottom <= parent.bottom;
    }));
    expect(containedTools).toBe(true);
    await page.getByRole('button', { name: /^Detalhes do item/ }).click();
    await expect(page.locator('#budget-item-code-0')).toHaveValue('FIC-01');
    await noOverflow(page);
    await page.screenshot({ path: path.join(evidence, `itens-${width}-${value}.png`) });
    await budgetGroup(page, 'header');
    await page.locator('#budget-issue-date').click();
    await expect(page.getByRole('dialog', { name: 'Selecionar data', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidence, `calendario-${width}-${value}.png`) });
    await page.keyboard.press('Escape'); await expect(page.locator('#budget-issue-date')).toBeFocused();
    await page.locator('#budget-client').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await budgetGroup(page, 'fees');
    await page.getByRole('button', { name: /^Custos internos/ }).click();
    await expect(page.locator('#budget-cost-description-0')).toHaveValue('EXEMPLO FICTÍCIO — Deslocamento');
    await budgetGroup(page, 'payment');
    await expect(page.locator('#financial-account')).toHaveValue('EXEMPLO FICTÍCIO — Conta interna');
    const remove = await page.getByRole('button', {name:'Remover parcela 1',exact:true}).boundingBox();
    expect(remove!.width).toBe(44); expect(remove!.height).toBe(44);
    for (const id of ['payment-interest','payment-fine','payment-early-discount']) expect((await page.locator('#'+id).boundingBox())!.width).toBeLessThanOrEqual(144);
    expect((await page.locator('#installment-count').boundingBox())!.width).toBeLessThanOrEqual(100);
    await page.locator('.budget-payment-installments').scrollIntoViewIfNeeded(); await noOverflow(page);
    await page.screenshot({path:path.join(evidence,`pagamento-compacto-${width}-${value}.png`)});
    await budgetGroup(page, 'document');
    await expect(page.locator('#internal-notes')).toHaveValue('EXEMPLO FICTÍCIO — SIGILO_INTERNO');
    await expect(page.locator('#budget-terms')).toHaveValue('EXEMPLO FICTÍCIO — Termos preservados');
    await page.getByText('Análise interna', { exact: true }).click();
    await expect(page.locator('.budget-internal-analysis')).toContainText('Lucro estimado');
    await noOverflow(page);
    measurements.push({ width, theme: value, overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) });
    if (width === 1440 && value === 'light') {
      const axe = await new AxeBuilder({ page }).include('.budget-editor').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      await fs.writeFile(path.join(evidence, 'axe.json'), JSON.stringify(axe.violations, null, 2));
      expect(axe.violations.map(v => v.id)).toEqual([]);
    }
  }
  await fs.writeFile(path.join(evidence, 'medidas.json'), JSON.stringify(measurements, null, 2));
});

test('criação: validação, custos condicionais, falhas, proteção de envio e retorno ao Financeiro', async ({ page }) => {
  await prepare(page);
  const returnPath = '/financeiro?tab=faturas&periodo=custom&inicio=2026-10-01&fim=2026-10-31';
  await visit(page, '/orcamentos/novo?retorno=' + encodeURIComponent(returnPath));
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  await expect(page.locator('#budget-description')).toBeFocused();
  await page.locator('#budget-description').fill('EXEMPLO FICTÍCIO — Nova proposta de teste');
  await page.locator('#budget-client').click(); await page.getByRole('option', { name: clientName, exact: true }).click();
  await budgetGroup(page, 'items');
  await page.locator('#budget-item-description-0').fill('EXEMPLO FICTÍCIO — Item com centavos');
  await page.locator('#budget-item-price-0').fill('1.234,57');
  await budgetGroup(page, 'fees');
  await page.getByRole('button', { name: /^Custos internos/ }).click();
  await page.getByRole('button', { name: 'Adicionar custo', exact: true }).click();
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  await expect(page.locator('#budget-cost-description-0')).toBeFocused();
  await page.locator('#budget-cost-description-0').fill('EXEMPLO FICTÍCIO — Custo de teste');
  let release!: () => void; const pause = new Promise<void>(resolve => { release = resolve; }); let requests = 0;
  await page.route('**/api/orcamentos', async route => { if (route.request().method() !== 'POST') return route.continue(); requests++; await pause; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'EXEMPLO FICTÍCIO — Falha temporária' }) }); });
  const submit = page.getByRole('button', { name: 'Criar orçamento', exact: true }); const before = (await submit.boundingBox())!.width;
  await submit.click(); const saving = page.getByRole('button', { name: 'Salvando…', exact: true });
  await expect(saving).toBeDisabled(); expect((await saving.boundingBox())!.width).toBeCloseTo(before, 0);
  await expect(page.locator('#budget-description')).toBeDisabled();
  await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(requests).toBe(1); release();
  await expect(page.getByText(/Confira a lista e o histórico/)).toBeVisible();
  await expect(page.locator('form > fieldset > [tabindex="-1"]').first()).toBeFocused();
  await page.screenshot({ path: path.join(evidence, 'falha-preservada.png') });
  await page.unroute('**/api/orcamentos');
  await page.route('**/api/orcamentos', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  await expect(page.getByText(/Não foi possível conectar ao serviço local/)).toBeVisible();
  await expect(page.locator('#budget-description')).toHaveValue('EXEMPLO FICTÍCIO — Nova proposta de teste');
  await page.unroute('**/api/orcamentos');
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/orcamentos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  const response = await responsePromise; expect(response.status(), await response.text()).toBe(201); const created = await response.json();
  expect(created.valorTotal).toBe(123457); expect(created.status).toBe('rascunho'); expect(created.installments).toHaveLength(0);
  await expect(page).toHaveURL(web + returnPath);
});

test('edição: erros remapeados, campos preservados, modelos, perfil, salvamento e descarte', async ({ page }) => {
  await prepare(page); await visit(page, `/orcamentos/${budget.id}/editar?retorno=${encodeURIComponent('/orcamentos?query=EXEMPLO&sort=valor_desc')}`);
  await budgetGroup(page, 'characterization');
  await page.locator('#budget-execution-start').click(); await page.getByRole('option', { name: 'Outra condição', exact: true }).click();
  await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
  await expect(page.locator('#budget-execution-start-description')).toBeFocused();
  await page.locator('#budget-execution-start-description').fill('EXEMPLO FICTÍCIO — Liberação de acesso');
  await budgetGroup(page, 'fees'); await page.getByRole('button', { name: /^Impostos/ }).click();
  await page.locator('#budget-tax-name-0').fill('');
  await budgetGroup(page, 'header');
  await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
  await expect(page.locator('#budget-tax-name-0')).toBeFocused();
  await page.locator('#budget-tax-name-0').fill('EXEMPLO FICTÍCIO — Tributo');
  await budgetGroup(page, 'items');
  await page.getByRole('button', { name: 'Salvar como modelo', exact: true }).click();
  await page.locator('#budget-template').click();
  await page.getByRole('option', { name: 'Levantamento cadastral — modelo', exact: true }).click();
  await page.getByRole('button', { name: 'Usar modelo', exact: true }).click();
  await expect(page.locator('#budget-item-description-0')).toHaveValue('EXEMPLO FICTÍCIO — Serviço de levantamento');
  await budgetGroup(page, 'fees');
  const taxesToggle = page.getByRole('button', { name: /^Impostos/ });
  if (await taxesToggle.getAttribute('aria-expanded') === 'false') await taxesToggle.click();
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
  await page.getByRole('combobox', { name: 'Perfil tributário', exact: true }).click();
  await page.getByRole('option', { name: 'Levantamento cadastral — impostos', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar perfil', exact: true }).click();
  await expect(page.locator('#budget-tax-name-0')).toHaveValue('EXEMPLO FICTÍCIO — Tributo');
  await budgetGroup(page, 'document'); await page.locator('#internal-notes').fill('EXEMPLO FICTÍCIO — SIGILO_INTERNO atualizado');
  const update = page.waitForResponse(r => r.url().endsWith('/api/orcamentos/' + budget.id) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
  const response = await update; expect(response.status(), await response.text()).toBe(200); const saved = await response.json();
  for (const key of ['valorTotal','custoTotalEstimado','impostosPrevistos','honorariosBrutos','honorariosLiquidos','lucroEstimado','margemPontosBase']) expect(saved[key], key).toBe(budget[key]);
  expect(saved.projetoId).toBe(projectId); expect(saved.characterization.gnssElectronicBase).toBe('EXEMPLO FICTÍCIO — Receptor de referência');
  expect(saved.observacoesCliente).toBe(budget.observacoesCliente); expect(saved.termosCondicoes).toBe(budget.termosCondicoes);
  await expect(page).toHaveURL(/\/orcamentos\?.*query=EXEMPLO/);
  await visit(page, `/orcamentos/${budget.id}/editar`); await page.locator('#budget-description').fill('EXEMPLO FICTÍCIO — Alteração descartável');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(page.locator('#budget-description')).toHaveValue('EXEMPLO FICTÍCIO — Alteração descartável');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click(); await expect(page).toHaveURL(web + '/orcamentos');
});

test('zoom real de 200%: novo e editar nos dois temas', async () => {
  const requireRoot = createRequire(path.resolve('package.json')); let executablePath: string;
  try { executablePath = requireRoot('electron'); } catch { executablePath = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); }
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE')), GEOGESTOR_E2E_OFFSCREEN: '1' };
  const app = await electron.launch({ executablePath, args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env, timeout: 30_000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(12_000); const win = await app.browserWindow(page);
    await win.evaluate(w => { w.webContents.setBackgroundThrottling(false); w.setContentSize(1000, 800); w.webContents.setZoomFactor(2); });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(500);
    const capture = async (name: string) => {
      // A hidden native window needs a compositor frame before its final capture.
      await win.evaluate(async w => { await w.capturePage(undefined, { stayHidden: true, stayAwake: true }); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const png = await win.evaluate(async w => (await w.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      await fs.writeFile(path.join(evidence, name), Buffer.from(png, 'base64'));
    };
    const measures = [];
    for (const editing of [false, true]) for (const value of ['light','dark']) {
      console.log(`[zoom] ${editing ? 'editar' : 'novo'} / ${value}`);
      await visit(page, editing ? `/orcamentos/${budget.id}/editar` : '/orcamentos/novo'); await theme(page, value);
      const issueDate = page.locator('#budget-issue-date'); const selectedDate = await issueDate.innerText();
      await issueDate.click();
      const calendar = page.getByRole('dialog', { name: 'Selecionar data', exact: true });
      await expect(calendar).toBeVisible();
      await expect.poll(() => calendar.evaluate(el => { const rect = el.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight + 1; })).toBe(true);
      if (editing && value === 'light') await capture('zoom-200-calendario-light.png');
      await page.keyboard.press('Escape'); await expect(issueDate).toBeFocused(); await expect(issueDate).toHaveText(selectedDate);
      console.log('[zoom] calendário e retorno do foco aprovados');
      await budgetGroup(page, 'items'); await noOverflow(page);
      await capture(`zoom-200-${editing ? 'editar' : 'novo'}-${value}.png`);
      await budgetGroup(page, 'payment'); await page.locator('#payment-type').click();
      await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape');
      console.log('[zoom] seletor de pagamento aprovado');
      await page.locator('.budget-payment-installments').scrollIntoViewIfNeeded(); await noOverflow(page);
      const remove = await page.getByRole('button',{name:'Remover parcela 1',exact:true}).boundingBox();
      expect(remove!.width).toBe(44); expect(remove!.height).toBe(44);
      if (editing) await capture(`pagamento-compacto-zoom-200-${value}.png`);
      if (editing) {
        await budgetGroup(page, 'fees');
        const taxes = page.getByRole('button', { name: /^Impostos/ });
        if (await taxes.getAttribute('aria-expanded') === 'false') await taxes.click();
        const name = page.locator('#budget-tax-name-0'); const original = await name.inputValue();
        await name.fill(''); await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
        await expect(name).toBeFocused();
        await expect.poll(() => name.evaluate(el => {
          const rect = el.getBoundingClientRect(); const nav = document.querySelector('.budget-editor-navigation')!.getBoundingClientRect();
          return rect.top >= nav.bottom && rect.bottom <= innerHeight - 80;
        })).toBe(true);
        await name.fill(original);
      }
      await budgetGroup(page, 'document'); await page.getByRole('button', { name: editing ? 'Atualizar orçamento' : 'Criar orçamento', exact: true }).scrollIntoViewIfNeeded();
      await noOverflow(page); measures.push({ editing, theme: value, factor: await win.evaluate(w => w.webContents.getZoomFactor()), width: await page.evaluate(() => innerWidth) });
    }
    await fs.writeFile(path.join(evidence, 'zoom-real.json'), JSON.stringify(measures, null, 2));
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
