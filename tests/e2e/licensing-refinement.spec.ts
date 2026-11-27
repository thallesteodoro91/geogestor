import AxeBuilder from '@axe-core/playwright';
import { _electron as electron, expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { relativeDate, relativeInstant } from './support/runtime';

const evidence = path.resolve('docs/auditorias/2026-10-11-impeccable-licencas/implementacao/evidencias');
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const requireRoot = createRequire(path.resolve('package.json'));
const { createClient } = requireApi('@libsql/client') as typeof import('@libsql/client');
const ids = { client: 'ac46b832-145e-4fb6-91fd-923af99d1001', project: 'ac46b832-145e-4fb6-91fd-923af99d1002', analysis: 'ac46b832-145e-4fb6-91fd-923af99d1003', expired: 'ac46b832-145e-4fb6-91fd-923af99d1004', condition: 'ac46b832-145e-4fb6-91fd-923af99d1005' };
const longProject = 'Empreendimento fictício de monitoramento ambiental em Florianópolis — avaliação de obrigações e documentos de uma licença com identificação extensa';
const fullDescription = 'Apresentar relatório de monitoramento com metodologia, resultados, registros de campo e avaliação das medidas adotadas. '.repeat(7);

async function seed() {
  await fs.mkdir(evidence, { recursive: true });
  const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
  try {
    if ((await database.execute({ sql: 'select id from projetos where id = ?', args: [ids.project] })).rows.length) return;
    const now = relativeInstant();
    await database.batch([
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao,created_at,updated_at) values (?,?,'PF','Ativo',?,?)", args: [ids.client, 'Cliente fictício de demonstração com nome extenso', now, now] },
      { sql: "insert into projetos (id,cliente_id,nome,descricao,status,tipo,created_at,updated_at) values (?,?,?,?,'Em Andamento','Ambiental',?,?)", args: [ids.project, ids.client, longProject, 'Dados sintéticos exclusivos da auditoria.', now, now] },
      ...Array.from({ length: 28 }, (_, index) => ({
        sql: 'insert into licencas (id,projeto_id,cliente_id,numero,orgao,tipo_licenca,data_emissao,data_vencimento,status,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?)',
        args: [index === 0 ? ids.analysis : index === 1 ? ids.expired : crypto.randomUUID(), ids.project, ids.client, index === 0 ? 'QA-LIC-ANALISE' : index === 1 ? 'QA-LIC-EXPIRADA' : `QA-LIC-${String(index).padStart(3, '0')}`, 'Órgão ambiental fictício de demonstração', 'LO', relativeDate(-300), relativeDate(index === 0 ? 300 : index === 1 ? -1 : index + 30), index === 0 ? 'Em análise' : index === 1 ? 'Em renovação' : 'Válida', now, now]
      })),
      { sql: "insert into condicionantes_ambientais (id,licenca_id,titulo,descricao,data_limite,periodicidade,responsavel,status,data_cumprimento,observacoes,comprovante,created_at,updated_at) values (?,?,?,?,?,?,?,'Cumprida',?,?,?,?,?)", args: [ids.condition, ids.analysis, 'Relatório de monitoramento ambiental com descrição completa', fullDescription, relativeDate(30), 'Semestral', 'Equipe técnica fictícia com nome extenso', relativeDate(-2), 'Observação de leitura: conferir todos os resultados antes da próxima entrega.', 'Documentos/Monitoramento/Relatório anual de demonstração.pdf', now, now] }
    ], 'write');
  } finally { database.close(); }
}

async function open(page: Page, target: string) {
  await page.goto(target);
  await expect(page.getByRole('main')).toBeVisible();
  if (await page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await expect(page.locator('.licensing-surface')).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
async function scan(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  return result.violations;
}

async function electronExecutable() {
  try { return requireRoot('electron') as string; } catch {
    // Optional official runtime cache for environments with an incomplete npm
    // install. The cache must be prepared and checksum-verified before testing.
    const executable = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');
    await fs.access(executable);
    return executable;
  }
}

test.describe('Licenciamento — melhorias Impeccable', () => {
  test.use({ actionTimeout: 15_000, navigationTimeout: 20_000 });
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => { await seed(); page.on('pageerror', error => console.error('[LICENSING_PAGE_ERROR]', error.message)); });

  test('busca estável, paginação válida, atalhos e retorno com filtros', async ({ page }) => {
    await open(page, '/ambiental?tab=licenciamento&lic_page=Infinity');
    await expect(page).not.toHaveURL(/lic_page=/);
    await expect(page.getByRole('link', { name: 'Abrir licença QA-LIC-EXPIRADA', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(page).toHaveURL(/lic_page=2/);
    await page.getByRole('link', { name: 'Abrir licença QA-LIC-ANALISE', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Esta licença está em análise.' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Licença válida por' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Voltar ao licenciamento', exact: true }).click();
    await expect(page).toHaveURL(/lic_page=2/);
    await expect(page.getByRole('link', { name: 'Abrir licença QA-LIC-ANALISE', exact: true })).toBeVisible();

    const requested: string[] = [];
    await page.route('**/api/licencas?*', async route => {
      const q = new URL(route.request().url()).searchParams.get('q');
      if (q) { requested.push(q); await new Promise(resolve => setTimeout(resolve, 600)); }
      await route.continue();
    });
    const search = page.getByRole('searchbox', { name: 'Buscar licenças' });
    await search.pressSequentially('QA-LIC-EXPIRADA', { delay: 15 });
    await expect.poll(() => requested.length).toBe(1);
    await expect(page.getByRole('link', { name: 'Abrir licença QA-LIC-ANALISE', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir licença QA-LIC-EXPIRADA', exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '1 licença encontrada.' })).toBeVisible();
    expect(requested).toEqual(['QA-LIC-EXPIRADA']);
    await page.getByRole('link', { name: 'Abrir licença QA-LIC-EXPIRADA', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Renovação em andamento.' })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar ao licenciamento', exact: true }).click();
    await expect(search).toHaveValue('QA-LIC-EXPIRADA');
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    await page.getByRole('button', { name: 'Filtrar licenças: Vencidas', exact: true }).click();
    await expect(page).toHaveURL(/lic_status=Vencida/);
    await page.getByRole('button', { name: 'Filtrar licenças: Até 120 dias', exact: true }).click();
    await expect(page).toHaveURL(/lic_vencimento=120d/);
    await expect(page).not.toHaveURL(/lic_status=/);
  });

  test('rascunhos protegidos em Escape, Cancelar, clique fora e navegação', async ({ page }) => {
    await open(page, '/ambiental?tab=licenciamento');
    await page.getByRole('button', { name: 'Nova licença', exact: true }).click();
    await page.locator('#license-numero').fill('RASCUNHO A PRESERVAR');
    await page.keyboard.press('Escape');
    let confirmation = page.getByRole('alertdialog', { name: 'Descartar alterações não salvas?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.locator('#license-numero')).toHaveValue('RASCUNHO A PRESERVAR');
    await page.getByRole('dialog', { name: 'Nova licença ambiental' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Use an in-app history entry so Back exercises the SPA navigation guard.
    await page.getByRole('searchbox', { name: 'Buscar licenças' }).fill('QA-LIC-ANALISE');
    await page.getByRole('link', { name: 'Abrir licença QA-LIC-ANALISE', exact: true }).click();
    await page.getByRole('tab', { name: /Condicionantes/ }).click();
    await page.getByRole('button', { name: 'Nova condicionante' }).click();
    await page.locator('#condition-titulo').fill('Rascunho da condicionante');
    await page.mouse.click(5, 5);
    confirmation = page.getByRole('alertdialog', { name: 'Descartar alterações não salvas?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.locator('#condition-titulo')).toHaveValue('Rascunho da condicionante');
    await page.goBack();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.locator('#condition-titulo')).toHaveValue('Rascunho da condicionante');
    await page.getByRole('dialog', { name: 'Nova condicionante', exact: true }).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nova condicionante' })).toBeFocused();
  });

  test('leitura integral, documentos, obrigatoriedade e salvamento real', async ({ page }) => {
    await open(page, `/ambiental/licencas/${ids.analysis}?tab=conditions`);
    const condition = page.locator(`#condition-${ids.condition}`);
    await condition.locator('summary').click();
    await expect(condition.locator('details').getByText(fullDescription, { exact: true })).toBeVisible();
    await expect(condition.getByText('Observação de leitura: conferir todos os resultados antes da próxima entrega.', { exact: true })).toBeVisible();
    await expect(condition.getByText('Data de cumprimento', { exact: true })).toBeVisible();
    await expect(condition.getByRole('button', { name: 'Copiar referência' })).toBeVisible();
    await page.getByRole('tab', { name: 'Documentos', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Abrir documentos do projeto' })).toHaveAttribute('href', `/projetos/${ids.project}?aba=documentos`);
    await page.getByRole('tab', { name: /Condicionantes/ }).click();
    await page.getByRole('button', { name: 'Nova condicionante' }).click();
    await page.locator('#condition-titulo').fill('Obrigação salva durante validação isolada');
    await page.locator('#condition-status').click();
    await page.getByRole('option', { name: 'Cumprida', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Nova condicionante', exact: true }).getByText('obrigatório')).toHaveCount(2);
    const saveCondition = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/api/licencas/${ids.analysis}/condicionantes`));
    await page.getByRole('button', { name: 'Salvar condicionante', exact: true }).click();
    expect((await saveCondition).status()).toBe(201);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.locator('#license-numero')).toBeFocused();
    await page.locator('#license-numero').fill('QA-LIC-EDITADA');
    const saveLicense = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/api/licencas/${ids.analysis}`));
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    expect((await saveLicense).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'QA-LIC-EDITADA', exact: true })).toBeVisible();
    const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
    try {
      expect((await database.execute({ sql: 'select numero from licencas where id = ?', args: [ids.analysis] })).rows[0].numero).toBe('QA-LIC-EDITADA');
      const saved = await database.execute({ sql: 'select status,data_cumprimento from condicionantes_ambientais where titulo = ?', args: ['Obrigação salva durante validação isolada'] });
      expect(saved.rows[0]).toMatchObject({ status: 'Cumprida', data_cumprimento: relativeDate() });
      // Restore the fixture identifier for the visual pass.
      await database.execute({ sql: 'update licencas set numero = ? where id = ?', args: ['QA-LIC-ANALISE', ids.analysis] });
    } finally { database.close(); }
  });

  test('indicadores diferenciam erro inicial, recuperação e cache desatualizado', async ({ page }) => {
    let failed = true;
    await page.route('**/api/licencas/summary', async route => failed ? route.fulfill({ status: 500, json: { message: 'Falha sintética de indicadores.' } }) : route.continue());
    await open(page, '/ambiental?tab=licenciamento');
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os indicadores.' })).toBeVisible();
    await expect(page.locator('.license-summary')).toHaveCount(0);
    await page.screenshot({ path: path.join(evidence, 'erro-inicial-indicadores.png'), fullPage: true });
    failed = false;
    await page.getByRole('button', { name: 'Tentar atualizar indicadores' }).click();
    await expect(page.locator('.license-summary')).toBeVisible();
    // A mutation invalidates the cached summary without destroying its data.
    failed = true;
    await page.getByRole('link', { name: 'Abrir licença QA-LIC-EXPIRADA', exact: true }).click();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.locator('#license-protocolo').fill('Atualização sintética para testar o cache');
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link', { name: 'Voltar ao licenciamento', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Os últimos valores foram preservados.' })).toBeVisible();
    await expect(page.locator('.license-summary')).toBeVisible();
    await page.screenshot({ path: path.join(evidence, 'indicadores-preservados-apos-falha.png'), fullPage: true });
  });

  test('datas legadas inválidas identificam o campo e recebem foco', async ({ page }) => {
    const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
    try {
      await database.execute({ sql: 'update licencas set data_emissao = ? where id = ?', args: ['2026-02-31', ids.analysis] });
      await database.execute({ sql: 'update condicionantes_ambientais set data_limite = ? where id = ?', args: ['2026-02-31', ids.condition] });
      await open(page, `/ambiental/licencas/${ids.analysis}?tab=conditions`);
      await page.getByRole('button', { name: 'Editar', exact: true }).click();
      await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expect(page.locator('#license-dataEmissao-error')).toContainText('data válida');
      await expect(page.locator('#license-dataEmissao')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#license-dataEmissao')).toBeFocused();
      await page.screenshot({ path: path.join(evidence, 'erro-data-emissao-legada.png') });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.locator(`#condition-${ids.condition}`).getByRole('button', { name: /^Editar condicionante/ }).click();
      await page.getByRole('button', { name: 'Salvar condicionante', exact: true }).click();
      await expect(page.locator('#condition-dataLimite-error')).toContainText('data válida');
      await expect(page.locator('#condition-dataLimite')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#condition-dataLimite')).toBeFocused();
      await page.screenshot({ path: path.join(evidence, 'erro-data-limite-legada.png') });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    } finally {
      await database.execute({ sql: 'update licencas set data_emissao = ? where id = ?', args: [relativeDate(-300), ids.analysis] });
      await database.execute({ sql: 'update condicionantes_ambientais set data_limite = ? where id = ?', args: [relativeDate(30), ids.condition] });
      database.close();
    }
  });

  test('ações mostram progresso durante renovação e cumprimento', async ({ page }) => {
    const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
    try {
      await database.execute({ sql: "update condicionantes_ambientais set status = 'Pendente' where id = ?", args: [ids.condition] });
      await open(page, `/ambiental/licencas/${ids.analysis}?tab=conditions`);
      let release!: () => void;
      let gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**/api/licencas/${ids.analysis}`, async route => {
        if (route.request().method() === 'PATCH') await gate;
        await route.continue();
      });
      await page.getByRole('button', { name: 'Iniciar renovação', exact: true }).click();
      const renewal = page.getByRole('button', { name: 'Iniciando renovação…', exact: true });
      await expect(renewal).toBeDisabled();
      await expect(renewal).toHaveAttribute('aria-busy', 'true');
      release();
      await expect(page.getByRole('button', { name: 'Iniciar renovação', exact: true })).toHaveAttribute('aria-busy', 'false');
      gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**/api/licencas/${ids.analysis}/condicionantes/${ids.condition}`, async route => { await gate; await route.continue(); });
      await page.locator(`#condition-${ids.condition}`).getByRole('button', { name: 'Marcar como cumprida', exact: true }).click();
      const fulfillment = page.getByRole('button', { name: 'Registrando cumprimento…', exact: true });
      await expect(fulfillment).toBeDisabled();
      await expect(fulfillment).toHaveAttribute('aria-busy', 'true');
      release();
      await expect(page.locator(`#condition-${ids.condition}`).getByText('Cumprida', { exact: true })).toBeVisible();
      await expect(fulfillment).toHaveCount(0);
    } finally {
      await database.execute({ sql: "update licencas set status = 'Em análise' where id = ?", args: [ids.analysis] });
      database.close();
    }
  });

  test('janela nativa protege o rascunho antes do encerramento', async () => {
    const nativeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
    const desktop = await electron.launch({ executablePath: await electronExecutable(), args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env: nativeEnv });
    try {
      const page = await desktop.firstWindow();
      // Electron resolves its native unload decision as the DevTools session
      // closes; own this prompt to avoid Playwright's automatic-dismiss race.
      page.on('dialog', dialog => { void dialog.accept().catch(() => {}); });
      await expect(page.getByRole('main')).toBeVisible();
      if (await page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).isVisible()) {
        await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
        await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
      }
      await expect(page.locator('.licensing-surface')).toBeVisible();
      await page.getByRole('button', { name: 'Nova licença', exact: true }).click();
      await page.locator('#license-numero').fill('RASCUNHO NATIVO A PRESERVAR');
      await expect.poll(() => desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.states.some((state: any) => state.dirty))).toBe(true);
      await desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.close());
      await expect(page.locator('#license-numero')).toHaveValue('RASCUNHO NATIVO A PRESERVAR');
      const cancelled = await desktop.evaluate(() => {
        const native = (globalThis as any).__licensingDesktopTest;
        return { shutdownStarted: native.shutdownStarted, records: native.records };
      });
      expect(cancelled.shutdownStarted).toBe(false);
      expect(cancelled.records[0]).toMatchObject({ title: 'Descartar alterações não salvas?', defaultId: 0, cancelId: 0 });
      // A direct Quit follows the same guard, before any shutdown work starts.
      await desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.quit());
      await expect(page.locator('#license-numero')).toHaveValue('RASCUNHO NATIVO A PRESERVAR');
      await desktop.evaluate(() => {
        const native = (globalThis as any).__licensingDesktopTest;
        native.setResponse(1); native.close();
      });
      await expect.poll(() => page.isClosed()).toBe(true);
      expect(await desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.shutdownCompleted)).toBe(true);
      await fs.writeFile(path.join(evidence, 'fechamento-nativo.json'), JSON.stringify(cancelled, null, 2));
    } finally { await desktop.close(); }
  });

  test('inspeção conjunta: três larguras, dois temas, teclado, contraste e ampliação', async ({ page }) => {
    const results: unknown[] = [];
    await page.goto('/ambiental?tab=licenciamento');
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => localStorage.setItem('geogestor_theme', value), theme);
        await open(page, '/ambiental?tab=licenciamento');
        expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
        await expect(page.locator('.license-summary')).toBeVisible();
        await noOverflow(page);
        const listViolations = await scan(page, '.licensing-surface');
        for (const filter of ['status', 'tipo', 'vencimento']) {
          const control = page.getByRole('combobox', { name: `Filtrar licenças por ${filter}` });
          expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
          expect(await control.locator('span').first().evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        }
        const labels = await page.locator('.license-summary-label').evaluateAll(nodes => nodes.map(node => ({ label: node.textContent, overflow: node.scrollWidth > node.clientWidth, color: getComputedStyle(node).color })));
        expect(labels.every(label => !label.overflow)).toBe(true);
        await page.screenshot({ path: path.join(evidence, `lista-${width}-${theme}.png`) });
        await page.getByRole('button', { name: 'Nova licença', exact: true }).click();
        await expect.poll(() => page.locator('.licensing-dialog').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
        const projectOptions = page.getByRole('listbox', { name: 'Projetos ou empreendimentos encontrados' });
        await expect(projectOptions).toBeVisible();
        await expect(projectOptions.getByRole('option').first()).toBeVisible();
        const projectViolations = await scan(page, '.licensing-dialog');
        await page.screenshot({ path: path.join(evidence, `projetos-abertos-${width}-${theme}.png`), fullPage: true });
        await page.keyboard.press('Escape');
        if (await page.getByRole('dialog', { name: 'Nova licença ambiental' }).isVisible()) {
          await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        }
        await open(page, `/ambiental/licencas/${ids.analysis}?tab=conditions`);
        await page.locator(`#condition-${ids.condition} summary`).click();
        await noOverflow(page);
        const detailViolations = await scan(page, '.licensing-surface');
        const editIcon = page.locator(`#condition-${ids.condition}`).getByRole('button', { name: /^Editar condicionante/ });
        const target = await editIcon.boundingBox();
        expect(target?.width).toBeGreaterThanOrEqual(44);
        expect(target?.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: path.join(evidence, `condicionantes-${width}-${theme}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Editar', exact: true }).click();
        await expect(page.locator('#license-numero')).toBeFocused();
        // Contrast must be measured after the modal's entrance has settled.
        await expect.poll(() => page.locator('.licensing-dialog').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
        const formViolations = await scan(page, '.licensing-dialog');
        const focus = await page.locator('#license-numero').evaluate(node => ({ style: getComputedStyle(node).outlineStyle, color: getComputedStyle(node).outlineColor, dialogOpacity: getComputedStyle(node.closest('.licensing-dialog')!).opacity }));
        expect(focus.style).toBe('solid');
        await page.locator('#license-status').click();
        await expect(page.getByRole('listbox')).toBeVisible();
        const statusViolations = await scan(page, '.licensing-dialog, .geo-popover-surface');
        await page.keyboard.press('Escape');
        await page.locator('#license-dataVencimento').click();
        await expect(page.getByRole('grid')).toBeVisible();
        const calendarViolations = await scan(page, '.licensing-dialog, .geo-popover-surface');
        await page.screenshot({ path: path.join(evidence, `calendario-aberto-${width}-${theme}.png`), fullPage: true });
        await page.keyboard.press('Escape');
        await page.screenshot({ path: path.join(evidence, `formulario-${width}-${theme}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page.getByRole('button', { name: 'Nova condicionante', exact: true }).click();
        await expect.poll(() => page.locator('.licensing-dialog').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
        const conditionFormViolations = await scan(page, '.licensing-dialog');
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        const conditionsTab = page.getByRole('tab', { name: /Condicionantes/ });
        await conditionsTab.focus(); await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('tab', { name: 'Documentos', exact: true })).toBeFocused();
        await page.keyboard.press('Home');
        await expect(page.getByRole('tab', { name: 'Visão geral', exact: true })).toBeFocused();
        results.push({ width, theme, labels, listViolations, detailViolations, formViolations, projectViolations, statusViolations, calendarViolations, conditionFormViolations, focus });
        await fs.writeFile(path.join(evidence, 'inspecao.json'), JSON.stringify(results, null, 2));
      }
    }
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 360, height: 900 });
      await page.evaluate(value => localStorage.setItem('geogestor_theme', value), theme);
      await open(page, '/ambiental?tab=licenciamento');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await noOverflow(page);
      await page.screenshot({ path: path.join(evidence, `texto-200-360-${theme}.png`), fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await fs.writeFile(path.join(evidence, 'inspecao.json'), JSON.stringify(results, null, 2));
    // Persist all measurements before reporting a defect in the batched pass.
    expect(results.flatMap((item: any) => Object.entries(item).filter(([key]) => key.endsWith('Violations')).flatMap(([, value]) => value as unknown[])), JSON.stringify(results, null, 2)).toEqual([]);
  });
});
