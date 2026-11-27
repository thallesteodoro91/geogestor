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
const evidence = path.resolve(process.env.GEOGESTOR_BUDGET_AUDIT_EVIDENCE || 'docs/auditorias/2026-10-16-orcamentos-implementacao/evidencias');
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const root = process.env.GEOGESTOR_E2E_ROOT!;
function assertIsolated() { if (!root || !/^run-/.test(path.basename(root))) throw Error('Somente armazenamento fictício isolado'); }
async function prepare(page: Page) {
  await page.addInitScript(port => { (window as any).electronAPI = { getApiPort: () => port }; }, Number(process.env.GEOGESTOR_E2E_API_PORT));
}
async function visit(page: Page, route: string) {
  await page.goto(origin + route);
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  await expect(unlock.or(page.getByRole('heading', { name: /^(Orçamentos|Novo orçamento|Editar orçamento)$/ }))).toBeVisible();
  if (await unlock.isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
}
async function theme(page: Page, value: string) {
  await page.evaluate(value => { localStorage.setItem('geogestor_theme', value); document.documentElement.classList.toggle('dark', value === 'dark'); }, value);
}
async function geometry(page: Page) {
  return page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[aria-label="Tabela de propostas comerciais"]');
    const table = region?.querySelector('table');
    const first = table?.querySelector('tbody tr');
    const identity = first?.querySelector('td:first-child');
    const actions = first?.querySelector('td:last-child');
    return { viewport: { width: innerWidth, height: innerHeight }, documentOverflow: document.documentElement.scrollWidth - innerWidth,
      table: region ? { clientWidth: region.clientWidth, scrollWidth: region.scrollWidth, scrollTop: region.scrollTop, top: region.getBoundingClientRect().top,
        firstRowTop: first?.getBoundingClientRect().top, identityWidth: identity?.getBoundingClientRect().width,
        actionsWidth: actions?.getBoundingClientRect().width, visibleComparisonWidth: region.clientWidth - (identity?.getBoundingClientRect().width || 0) - (actions?.getBoundingClientRect().width || 0) } : null,
      active: document.activeElement?.textContent?.slice(0, 100) };
  });
}

test('regressão renderizada: tabela, filtros, páginas, detalhes e editor', async ({ page }) => {
  assertIsolated();
  await fs.mkdir(evidence, { recursive: true });
  await prepare(page);
  const requireApi = createRequire(path.resolve('apps/api/package.json'));
  const { createClient } = requireApi('@libsql/client');
  const db = createClient({ url: `file:${path.join(root, 'geogestor.db')}` });
  await db.execute('PRAGMA busy_timeout = 5000');
  const clientId = crypto.randomUUID();
  const clientName = 'EXEMPLO FICTÍCIO — Associação de produtores e serviços geográficos com nome extenso para auditoria';
  await db.execute({ sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [clientId, clientName] });
  const session = await page.request.post(apiOrigin + '/api/auth/unlock', { data: { password: 'GeoGestor-E2E-2026' } });
  const headers = { 'x-local-session': (await session.json()).token };
  const created = await page.request.post(apiOrigin + '/api/orcamentos', { headers, data: {
    clientId, description: 'EXEMPLO FICTÍCIO — Levantamento cadastral e georreferenciamento', issueDate: e2eReferenceDate(), validUntil: relativeDate(30),
    technicalLead: 'EXEMPLO FICTÍCIO — Responsável técnico', serviceType: 'Levantamento cadastral', municipality: 'Florianópolis', state: 'SC',
    internalNotes: 'EXEMPLO FICTÍCIO — Anotação interna de auditoria', clientNotes: 'EXEMPLO FICTÍCIO — Agendar acesso ao imóvel.', terms: 'EXEMPLO FICTÍCIO — Condições da proposta.',
    globalDiscount: { type: 'fixo', value: '0' }, globalAddition: { type: 'fixo', value: '0' },
    items: [{ description: 'EXEMPLO FICTÍCIO — Levantamento', unit: 'serviço', quantity: '1', unitPriceCents: 123457, unitCostCents: 12000,
      discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: false, component: 'servico', notes: 'EXEMPLO FICTÍCIO — Nota interna' }],
    costs: [], taxes: [], executionDays: 15,
    characterization: { executionStart: { type: 'initial_payment' }, scopeDescription: 'EXEMPLO FICTÍCIO — Escopo do levantamento cadastral.', estimatedArea: '', areaUnit: 'hectare' },
    payment: { type: 'avista', paymentMethod: 'PIX', installments: [{ percentage: '100', daysAfterApproval: 0, label: 'Pagamento' }] }
  } });
  expect(created.status(), await created.text()).toBe(201);
  const budget = await created.json();
  await db.batch(Array.from({ length: 50 }, (_, index) => ({
    sql: "insert into orcamentos (id,cliente_id,descricao,servico_tipo,status,valor_total,created_at) values (?,?,?,'Topografia','rascunho',? ,?)",
    args: [crypto.randomUUID(), clientId, `EXEMPLO FICTÍCIO — Proposta ${String(index + 1).padStart(2, '0')}`, 100000 + index * 123, `2026-01-01 12:${String(index).padStart(2, '0')}:00`]
  })), 'write');
  const ordered = await page.request.get(apiOrigin + '/api/orcamentos?mode=page&limit=25&page=1&sort=valor_asc', { headers });
  expect(ordered.status()).toBe(200);
  const ascending = await ordered.json();
  expect(ascending.total).toBe(51);
  expect(ascending.items[0].totalCents).toBe(100000);
  expect(ascending.items[24].totalCents).toBe(100000 + 24 * 123);
  const dates = await page.request.get(apiOrigin + '/api/orcamentos?mode=page&limit=25&page=1&sort=emissao', { headers });
  const dated = await dates.json();
  expect(dated.items[0].id).toBe(budget.id);
  expect(dated.items.slice(1).every((row: any) => row.issueDate === null)).toBe(true);
  db.close();
  await fs.writeFile(path.join(root, 'ux-fixture.json'), JSON.stringify({ clientId, budgetId: budget.id }));
  await visit(page, '/orcamentos');
  const findings: Record<string, any> = {};
  const samples = [];
  for (const width of [1440, 1280, 360]) for (const value of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/orcamentos');
    const region = page.getByRole('region', { name: 'Tabela de propostas comerciais' });
    await expect(page.locator('.budget-desktop-list tbody tr')).toHaveCount(25);
    await theme(page, value);
    if (width > 760) await region.scrollIntoViewIfNeeded();
    else { await expect(page.locator('.budget-card-list article')).toHaveCount(25); await expect(page.locator('.budget-card-list')).toBeVisible(); await page.locator('.budget-card-list article').first().scrollIntoViewIfNeeded(); }
    expect((await geometry(page)).documentOverflow).toBeLessThanOrEqual(1);
    const sample = { theme: value, ...await geometry(page) };
    samples.push(sample);
    await page.screenshot({ path: path.join(evidence, `lista-${value}-${width}.png`) });
    if (width === 1440 && value === 'light') {
      const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      findings.listAxe = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })) }));
    }
  }
  findings.matrix = samples;
  await page.setViewportSize({ width: 1280, height: 900 });
  await visit(page, '/orcamentos');
  const region = page.getByRole('region', { name: 'Tabela de propostas comerciais' });
  await expect(region.locator('tbody tr')).toHaveCount(25);
  await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const before = await geometry(page);
  const pageTwo = page.waitForResponse(r => r.url().includes('/api/orcamentos?') && new URL(r.url()).searchParams.get('page') === '2');
  await page.getByRole('navigation', { name: 'Paginação de orçamentos' }).getByRole('button', { name: 'Próxima' }).click();
  await pageTwo;
  await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
  findings.pagination = { before, after: await geometry(page), pageChip: await page.getByRole('button', { name: 'Remover filtro page: 2', exact: true }).count() };
  await expect(page.locator('.budget-results')).toBeFocused();
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBe(0);
  expect(findings.pagination.pageChip).toBe(0);
  await expect(page.locator('.budget-results')).toHaveText('26–50 de 51 orçamentos');
  await page.screenshot({ path: path.join(evidence, 'paginacao-segunda-pagina.png') });
  await page.getByRole('navigation', { name: 'Paginação de orçamentos' }).getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByText('Página 1 de 3', { exact: true })).toBeVisible();
  await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const next = page.getByRole('navigation', { name: 'Paginação de orçamentos' }).getByRole('button', { name: 'Próxima' });
  await next.focus(); await next.press('Enter');
  await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
  await expect(page.locator('.budget-results')).toBeFocused();
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBe(0);
  findings.paginationKeyboard = await geometry(page);
  await next.click();
  await expect(region.locator('tbody tr')).toHaveCount(1);
  await region.getByRole('button', { name: /^Mais ações de/ }).click();
  await page.getByRole('menuitem', { name: 'Excluir rascunho' }).click();
  const deletion = page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().includes('/api/orcamentos/'));
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir rascunho', exact: true }).click();
  await deletion;
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();
  await expect(region.locator('tbody tr')).toHaveCount(25);
  await expect(page.locator('.budget-results')).toBeFocused();
  findings.afterDelete = { page: new URL(page.url()).searchParams.get('page'), empty: await page.getByRole('heading', { name: 'Nenhum orçamento encontrado' }).count(), pagination: await page.getByRole('navigation', { name: 'Paginação de orçamentos' }).innerText() };
  await page.screenshot({ path: path.join(evidence, 'exclusao-pagina-ajustada.png') });

  await visit(page, '/orcamentos');
  const search = page.getByRole('searchbox', { name: 'Buscar por número, cliente, imóvel ou descrição' });
  let requests = 0;
  const count = (request: any) => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/orcamentos') && url.searchParams.has('query')) requests++; };
  page.on('request', count);
  await search.pressSequentially('EXEMPLO', { delay: 60 });
  await expect(search).toBeFocused();
  await expect.poll(() => page.getByRole('navigation', { name: 'Paginação de orçamentos' }).textContent()).toContain('Página 1 de 2');
  await page.waitForTimeout(400);
  expect(requests).toBeLessThanOrEqual(4);
  await expect(search).toBeFocused();
  findings.search = { typedCharacters: 7, intervalMs: 60, requestsDuringTyping: requests, focusPreserved: await search.evaluate(el => document.activeElement === el) };
  page.off('request', count);
  await search.fill('FICTÍCIO');
  await expect(page.getByRole('navigation', { name: 'Paginação de orçamentos' })).toContainText('Página 1 de 2');
  await expect(search).toHaveValue('FICTÍCIO');
  const sort = page.getByRole('combobox', { name: 'Ordenar por' });
  await sort.click();
  await page.getByRole('option', { name: 'Menor valor', exact: true }).click();
  await expect(sort).toBeFocused();
  await expect(page.locator('.budget-results')).toContainText('1–25');
  expect(new URL(page.url()).searchParams.get('sort')).toBe('valor_asc');
  expect(new URL(page.url()).searchParams.get('query')).toBe('FICTÍCIO');
  await page.getByRole('button', { name: 'Limpar busca de orçamentos' }).click();
  await expect(search).toBeFocused();
  await page.waitForTimeout(400);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('valor_asc');

  for (const width of [1440, 360]) for (const value of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/orcamentos?budgetId=' + budget.id);
    const dialog = page.getByRole('dialog').first();
    await expect(dialog.getByRole('button', { name: 'Editar orçamento', exact: true })).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    await theme(page, value);
    await dialog.getByRole('button', { name: 'Mais ações', exact: true }).click();
    const popup = dialog.getByRole('menu', { name: 'Mais ações', exact: true });
    await expect(popup).toBeVisible();
    await expect(popup).toHaveCSS('opacity', '1');
    await expect.poll(() => popup.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
    findings['menu' + width] = await popup.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, viewport: innerWidth }; });
    await page.screenshot({ path: path.join(evidence, `detalhes-menu-${width}-${value}.png`) });
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Editar orçamento', exact: true }).click();
    await expect(page.locator('#budget-description')).toBeVisible();
    const dates = await page.locator('#budget-issue-date, #budget-valid-until').evaluateAll(elements => elements.map(el => ({ text: el.textContent, width: el.getBoundingClientRect().width, overflow: el.scrollWidth > el.clientWidth })));
    findings['editor' + width] = { dates, documentOverflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) };
    await page.screenshot({ path: path.join(evidence, `editor-${width}-${value}.png`) });
    const issueDate = page.locator('#budget-issue-date');
    const originalDate = await issueDate.innerText();
    await issueDate.click();
    await expect(page.getByRole('dialog', { name: 'Selecionar data', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidence, `calendario-${width}-${value}.png`) });
    await page.keyboard.press('Escape');
    await expect(issueDate).toBeFocused();
    await expect(issueDate).toHaveText(originalDate);
    await budgetGroup(page, 'payment');
    await page.screenshot({ path: path.join(evidence, `pagamento-${width}-${value}.png`) });
  }
  await fs.writeFile(path.join(evidence, 'observacoes.json'), JSON.stringify(findings, null, 2));
});

test('envio protegido, falhas recuperáveis, centavos e retorno ao Financeiro', async ({ page }) => {
  assertIsolated();
  await prepare(page);
  const returnPath = '/financeiro?tab=faturas&periodo=custom&inicio=2026-10-01&fim=2026-10-31';
  await visit(page, '/orcamentos/novo?retorno=' + encodeURIComponent(returnPath));
  const title = page.locator('#budget-description');
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  await expect(title).toBeFocused();
  await title.fill('EXEMPLO FICTÍCIO — Recuperação de envio');
  await budgetGroup(page, 'header');
  await page.locator('#budget-client').click();
  await page.getByRole('option', { name: /^EXEMPLO FICTÍCIO — Associação/ }).click();
  await budgetGroup(page, 'items');
  await page.locator('#budget-item-description-0').fill('EXEMPLO FICTÍCIO — Serviço de teste');
  await page.locator('#budget-item-price-0').fill('1.234,57');
  const submit = page.getByRole('button', { name: 'Criar orçamento', exact: true });
  const widthBefore = (await submit.boundingBox())!.width;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let submissions = 0;
  await page.route('**/api/orcamentos', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    submissions++;
    await pending;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'EXEMPLO FICTÍCIO — Serviço temporariamente indisponível.' }) });
  });
  await submit.click();
  const saving = page.getByRole('button', { name: 'Salvando…', exact: true });
  await expect(saving).toBeDisabled();
  expect((await saving.boundingBox())!.width).toBeCloseTo(widthBefore, 0);
  await expect(title).toBeDisabled();
  await page.locator('form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(submissions).toBe(1);
  await page.screenshot({ path: path.join(evidence, 'envio-protegido.png') });
  release();
  await expect(page.getByText(/Confira a lista e o histórico/)).toBeVisible();
  await expect(title).toHaveValue('EXEMPLO FICTÍCIO — Recuperação de envio');
  await expect(title).toBeEnabled();
  await expect(page.locator('form > fieldset > [tabindex="-1"]').first()).toBeFocused();
  await page.screenshot({ path: path.join(evidence, 'falha-preenchimento-preservado.png') });
  await page.unroute('**/api/orcamentos');
  await page.route('**/api/orcamentos', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  await expect(page.getByText(/Não foi possível conectar ao serviço local/)).toBeVisible();
  await expect(title).toHaveValue('EXEMPLO FICTÍCIO — Recuperação de envio');
  await page.unroute('**/api/orcamentos');
  const created = page.waitForResponse(r => r.url().endsWith('/api/orcamentos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Criar orçamento', exact: true }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const budget = await response.json();
  expect(budget.valorTotal).toBe(123457);
  expect(budget.status).toBe('rascunho');
  expect(budget.installments).toHaveLength(0);
  await expect(page).toHaveURL(origin + returnPath);
  await visit(page, '/orcamentos?query=Recuperação&sort=valor_desc&page=1&budgetId=' + budget.id);
  await page.getByRole('dialog').getByRole('button', { name: 'Editar orçamento', exact: true }).click();
  await title.fill('EXEMPLO FICTÍCIO — Edição preservada');
  const patchUrl = '**/api/orcamentos/' + budget.id;
  await page.route(patchUrl, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'EXEMPLO FICTÍCIO — Revise a solicitação.' }) }) : route.continue());
  await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
  await expect(page.getByText(/Revise as informações e tente novamente/)).toBeVisible();
  await expect(title).toHaveValue('EXEMPLO FICTÍCIO — Edição preservada');
  await page.unroute(patchUrl);
  const updated = page.waitForResponse(r => r.url().endsWith('/api/orcamentos/' + budget.id) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
  expect((await updated).status()).toBe(200);
  await expect(page).toHaveURL(/\/orcamentos\?.*query=Recupera/);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('valor_desc');
  await expect(page.getByText('1 orçamento destacado fora dos filtros.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Visualizar/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar orçamento', exact: true }).click();
  await title.fill('EXEMPLO FICTÍCIO — Alteração descartável');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(title).toHaveValue('EXEMPLO FICTÍCIO — Alteração descartável');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(page).toHaveURL(/\/orcamentos\?.*query=Recupera/);
});

test('emissão, motivo e aprovação: falhas preservam dados e efeitos não se duplicam', async ({ page }) => {
  assertIsolated();
  const { budgetId } = JSON.parse(await fs.readFile(path.join(root, 'ux-fixture.json'), 'utf8'));
  await prepare(page);
  await visit(page, '/orcamentos?budgetId=' + budgetId);
  const detail = page.getByRole('dialog').first();
  const summary = detail.locator('.budget-client-summary');
  await expect(summary).not.toContainText('Anotação interna de auditoria');
  await expect(summary).toContainText('À vista');
  await detail.getByRole('button', { name: 'Emitir orçamento', exact: true }).click();
  await expect(detail.getByRole('button', { name: 'Aprovar', exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Mais ações comerciais', exact: true }).click();
  await detail.getByRole('menuitem', { name: 'Rejeitar', exact: true }).click();
  const reasonDialog = page.getByRole('dialog', { name: 'Rejeitar orçamento', exact: true });
  await reasonDialog.getByLabel('Motivo').fill('EXEMPLO FICTÍCIO — Motivo preservado');
  const transitions = '**/api/orcamentos/' + budgetId + '/transitions';
  await page.route(transitions, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'EXEMPLO FICTÍCIO — Falha de resposta.' }) }));
  await reasonDialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(reasonDialog.getByText(/Confira a lista e o histórico/)).toBeVisible();
  await expect(reasonDialog.getByLabel('Motivo')).toHaveValue('EXEMPLO FICTÍCIO — Motivo preservado');
  await page.unroute(transitions);
  await reasonDialog.getByRole('button', { name: 'Voltar', exact: true }).click();
  await detail.getByRole('button', { name: 'Aprovar', exact: true }).click();
  const approval = page.getByRole('dialog', { name: 'Confirmar aprovação e efeitos financeiros' });
  const project = approval.getByRole('textbox', { name: 'Nome do novo projeto' });
  await project.fill('EXEMPLO FICTÍCIO — Projeto de aprovação');
  const approvalUrl = '**/api/orcamentos/' + budgetId + '/approve';
  let release!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  let attempts = 0;
  const keys: string[] = [];
  await page.route(approvalUrl, async route => {
    attempts++;
    keys.push(route.request().postDataJSON().idempotencyKey);
    await pause;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'EXEMPLO FICTÍCIO — Falha temporária de aprovação.' }) });
  });
  await approval.getByRole('button', { name: 'Aprovar e gerar efeitos', exact: true }).click();
  await expect(approval.getByRole('button', { name: 'Aprovando…', exact: true })).toBeDisabled();
  await expect(project).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(approval).toBeVisible();
  expect(attempts).toBe(1);
  release();
  await expect(approval.getByText(/Confira a lista e o histórico/)).toBeVisible();
  await expect(project).toHaveValue('EXEMPLO FICTÍCIO — Projeto de aprovação');
  await page.screenshot({ path: path.join(evidence, 'aprovacao-falha-preservada.png') });
  await page.unroute(approvalUrl);
  await page.route(approvalUrl, route => { keys.push(route.request().postDataJSON().idempotencyKey); return route.continue(); });
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/approve') && r.request().method() === 'POST');
  await approval.getByRole('button', { name: 'Aprovar e gerar efeitos', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  await expect(approval).toHaveCount(0);
  expect(keys[1]).toBe(keys[0]);
  const requireApi = createRequire(path.resolve('apps/api/package.json'));
  const { createClient } = requireApi('@libsql/client');
  const db = createClient({ url: `file:${path.join(root, 'geogestor.db')}` });
  const counts = await db.execute({ sql: 'select count(*) as n, sum(valor_pago) as recebido from parcelas where orcamento_id=?', args: [budgetId] });
  expect(counts.rows[0].n).toBe(1);
  expect(Number(counts.rows[0].recebido || 0)).toBe(0);
  db.close();
});

test('regressão de zoom real: orçamento a 200% no Electron', async () => {
  assertIsolated();
  const requireRoot = createRequire(path.resolve('package.json'));
  let executablePath: string;
  try { executablePath = requireRoot('electron'); } catch { executablePath = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
  const app = await electron.launch({ executablePath, args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env, timeout: 30_000 });
  try {
    const page = await app.firstWindow();
    const win = await app.browserWindow(page);
    await win.evaluate(w => { w.webContents.setBackgroundThrottling(false); w.setContentSize(1000, 800); w.webContents.setZoomFactor(2); });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(500);
    await visit(page, '/orcamentos/novo');
    await expect(page.locator('#budget-description')).toBeVisible();
    await theme(page, 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth, dates: [...document.querySelectorAll('#budget-issue-date, #budget-valid-until')].map(el => ({ text: el.textContent, width: el.getBoundingClientRect().width })) }));
    const png = await win.evaluate(async w => (await w.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(evidence, 'zoom-real-200.png'), Buffer.from(png, 'base64'));
    await fs.writeFile(path.join(evidence, 'zoom-real.json'), JSON.stringify({ factor: await win.evaluate(w => w.webContents.getZoomFactor()), metrics }, null, 2));
    for (const value of ['light', 'dark']) {
      await visit(page, '/orcamentos');
      await theme(page, value);
      const cards = page.locator('.budget-card-list');
      await expect(cards).toBeVisible();
      await cards.locator('article').first().getByRole('button', { name: /^Mais ações de/ }).click();
      const popup = page.getByRole('menu').last();
      await expect(popup).toBeVisible();
      expect(await popup.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const png = await win.evaluate(async w => (await w.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      await fs.writeFile(path.join(evidence, `lista-zoom-real-200-${value}.png`), Buffer.from(png, 'base64'));
      await page.keyboard.press('Escape');
    }
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
