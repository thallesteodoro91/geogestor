import { budgetGroup } from './support/budget-editor-groups';
import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { e2eReferenceDate, relativeDate } from './support/runtime';

const evidence = path.resolve(process.env.GEOGESTOR_BUDGET_ORGANIZATION_EVIDENCE || 'docs/auditorias/2026-10-11-organizacao-orcamentos/evidencias/interface');
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client') as typeof import('@libsql/client');

test('organização: temas, notebooks, condições estruturadas, edição, emissão e resumo público', async ({ page }) => {
  test.setTimeout(180_000);
  await fs.mkdir(evidence, { recursive: true });
  const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
  const clientId = crypto.randomUUID();
  await database.execute({ sql: "insert into clientes (id,nome,tipo_pessoa,documento,situacao) values (?, 'Cliente fictício de acabamento', 'PF', '52998224725', 'Ativo')", args: [clientId] });
  await page.goto('/orcamentos');
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  const unlockPromise = page.waitForResponse(r => r.url().endsWith('/api/auth/unlock') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  const unlock = await unlockPromise;
  const apiOrigin = new URL(unlock.url()).origin;
  const headers = { 'x-local-session': (await unlock.json()).token };
  const logo = (await fs.readFile('docs/auditorias/2026-10-11-organizacao-orcamentos/evidencias/pdfs/logo-horizontal.png')).toString('base64');
  const companyResponse = await page.request.put(`${apiOrigin}/api/dados-operacionais/configuracoes-operacionais`, { headers, data: { values: { geogestor_empresa_template: { version: 1, razao: 'Cartografia São João', logo: `data:image/png;base64,${logo}`, cor: '#059669', termos: 'Condições complementares.' } } } });
  expect(companyResponse.ok(), await companyResponse.text()).toBe(true);
  const created = await page.request.post(`${apiOrigin}/api/orcamentos`, { headers, data: {
    clientId, description: 'Levantamento cadastral — acabamento', issueDate: e2eReferenceDate(), validUntil: relativeDate(30),
    technicalLead: 'Profissional fictício', serviceType: 'Levantamento cadastral', municipality: 'Florianópolis', state: 'SC',
    internalNotes: 'SIGILO_NOTAS', clientNotes: 'Agendar o acesso ao imóvel.', terms: 'Condições acordadas para esta proposta.',
    globalDiscount: { type: 'fixo', value: '0' }, globalAddition: { type: 'fixo', value: '0' },
    items: [{ description: 'Serviço cadastral', unit: 'serviço', quantity: '1', unitPriceCents: 123457, unitCostCents: 12000,
      discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: false, component: 'servico', notes: 'NOTA_ITEM_INTERNA_NAO_EXPORTAR' }],
    costs: [{ category: 'Equipe', description: 'SIGILO_CUSTO', amountCents: 12000, classification: 'custo_proprio', taxable: false }], taxes: [],
    executionDays: 15,
    characterization: { executionStart: { type: 'initial_payment' }, scopeDescription: 'Escopo cadastral fornecido pelo usuário.', estimatedArea: '', areaUnit: 'hectare' },
    payment: { type: 'avista', paymentMethod: 'PIX', financialAccount: 'CONTA_INTERNA_NAO_EXPORTAR', installments: [{ percentage: '100', daysAfterApproval: 0, label: 'Pagamento' }] }
  } });
  expect(created.status(), await created.text()).toBe(201);
  const budget = await created.json();
  const measurements: unknown[] = [];
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('geogestor_theme', value), theme);
      await page.goto(`/orcamentos?budgetId=${budget.id}`);
      await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
      await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
      const dialog = page.getByRole('dialog').first();
      await expect(dialog.getByRole('button', { name: 'Editar orçamento', exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Emitir orçamento', exact: true })).toBeVisible();
      const summary = dialog.locator('.budget-client-summary');
      await expect(summary).toContainText('À vista');
      await expect(summary).toContainText('Cartografia São João');
      await expect(summary.getByRole('img', { name: 'Logo de Cartografia São João' })).toBeVisible();
      await expect(summary).not.toContainText('GeoGestor');
      await expect(summary).not.toContainText('Metodologia a detalhar');
      await expect(summary.getByText('Investimento total', { exact: true })).toHaveCount(1);
      await expect(summary).toContainText('R$ 1.234,57');
      await expect(summary).toContainText('100% (R$ 1.234,57)');
      await expect(summary).toContainText('15 dias após o pagamento inicial');
      await expect(summary).not.toContainText(/SIGILO|CONTA_INTERNA|NOTA_ITEM_INTERNA|Lucro|Margem|Custos operacionais/);
      const colors = await summary.evaluate(node => ({ ink: getComputedStyle(node).color, paper: getComputedStyle(node).backgroundColor, secondary: getComputedStyle(node.querySelector('.budget-paper-secondary')!).color }));
      expect(colors).toEqual({ ink: 'rgb(24, 24, 27)', paper: 'rgb(255, 255, 255)', secondary: 'rgb(82, 82, 91)' });
      measurements.push({ width, theme, colors });
      expect(await summary.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await summary.screenshot({ path: path.join(evidence, `resumo-${width}-${theme}.png`) });
      await page.screenshot({ path: path.join(evidence, `rascunho-${width}-${theme}.png`) });
      const table = dialog.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Preço unit.', exact: true }) });
      await table.scrollIntoViewIfNeeded();
      const tableColors = await table.evaluate(node => {
        const header = node.querySelector('thead')!;
        const cell = node.querySelector('td')!;
        const backgrounds: string[] = [];
        for (let ancestor: Element | null = header; ancestor; ancestor = ancestor.parentElement) backgrounds.push(getComputedStyle(ancestor).backgroundColor);
        const color = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const surface = (element: Element) => {
          const layers: number[][] = [];
          for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) layers.push(color(getComputedStyle(ancestor).backgroundColor));
          return layers.reverse().reduce((base, layer) => base.map((value, index) => layer[index] * (layer[3] ?? 1) + value * (1 - (layer[3] ?? 1))), [255, 255, 255]);
        };
        const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const ratio = (element: Element) => {
          const ink = luminance(color(getComputedStyle(element).color));
          const paper = luminance(surface(element));
          return (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
        };
        return { headerInk: getComputedStyle(header).color, cellInk: getComputedStyle(cell).color, backgrounds, headerRatio: ratio(header), cellRatio: ratio(cell) };
      });
      expect(tableColors.headerRatio).toBeGreaterThanOrEqual(4.5);
      expect(tableColors.cellRatio).toBeGreaterThanOrEqual(4.5);
      measurements.push({ width, theme, tableColors });
      await table.screenshot({ path: path.join(evidence, `tabela-${width}-${theme}.png`) });
      const trigger = dialog.getByRole('button', { name: 'Mais ações', exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('menuitem', { name: 'Gerar PDF', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(dialog.getByRole('menuitem', { name: 'Duplicar', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Editar orçamento', exact: true }).click();
      await expect(page.locator('#budget-description')).toBeVisible();
      for (const id of ['budget-issue-date', 'budget-valid-until']) {
        const date = page.locator(`#${id}`);
        const bounds = await date.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(175);
        await expect(date).toContainText('/');
      }
      await expect(page.locator('form')).not.toContainText('Concluído');
      await expect(page.locator('form')).toContainText('1 parcela · À vista');
      await budgetGroup(page, 'characterization');
      await expect(page.locator('#budget-execution-start')).toContainText('Pagamento inicial');
      await page.locator('#budget-execution-start').click();
      await page.getByRole('option', { name: 'Aprovação da proposta', exact: true }).click();
      await expect(page.locator('#budget-execution-start')).toContainText('Aprovação da proposta');
      await page.locator('#budget-execution-start').click();
      await page.getByRole('option', { name: 'Outra condição', exact: true }).click();
      await page.locator('#budget-execution-start-description').fill('Liberação de acesso ao imóvel e entrega dos documentos.');
      await page.locator('#budget-execution-start-description').scrollIntoViewIfNeeded();
      await expect(page.getByRole('complementary', { name: 'Revisão das condições comerciais' })).toHaveCount(0);
      await page.screenshot({ path: path.join(evidence, `editor-${width}-${theme}.png`) });
      await page.locator('#budget-execution-start').click();
      await page.getByRole('option', { name: 'Pagamento inicial', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
  }
  // Save a real edit and verify the details and PDF use its persisted values.
  await page.goto(`/orcamentos?budgetId=${budget.id}`);
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Editar orçamento', exact: true }).click();
  await page.locator('#budget-description').fill('Proposta editada e persistida');
  await budgetGroup(page, 'characterization');
  await page.locator('#budget-execution-start').click();
  await page.getByRole('option', { name: 'Outra condição', exact: true }).click();
  await page.locator('#budget-execution-start-description').fill('Liberação de acesso ao imóvel e entrega dos documentos.');
  await page.locator('[data-budget-nav-section="payment"]:visible').click();
  await expect(page.getByLabel('Valor da parcela 1', { exact: true })).toHaveText('R$ 1.234,57');
  await page.getByLabel('Percentual da parcela 1', { exact: true }).fill('50');
  await expect(page.getByLabel('Valor da parcela 1', { exact: true })).toHaveText('Valor a calcular');
  await page.getByLabel('Percentual da parcela 1', { exact: true }).fill('100');
  const updatePromise = page.waitForResponse(r => r.url().endsWith(`/api/orcamentos/${budget.id}`) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Atualizar orçamento', exact: true }).click();
  expect((await updatePromise).status()).toBe(200);
  await page.goto(`/orcamentos?budgetId=${budget.id}`);
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toContainText('Proposta editada e persistida');
  const saved = await page.request.get(`${apiOrigin}/api/orcamentos/${budget.id}`, { headers });
  expect((await saved.json()).descricao).toBe('Proposta editada e persistida');
  expect((await saved.json()).characterization.scopeDescription).toBe('Escopo cadastral fornecido pelo usuário.');
  expect((await saved.json()).characterization.executionStart).toEqual({ type: 'custom', description: 'Liberação de acesso ao imóvel e entrega dos documentos.' });
  await dialog.getByRole('button', { name: 'Emitir orçamento', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Gerar PDF', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Editar orçamento', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
  await (await downloadPromise).saveAs(path.join(evidence, 'emitido-refinado.pdf'));
  await expect(dialog.getByText('PDF gerado. Confira o arquivo nos downloads.', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'emitido-1440-dark.png') });
  const persisted = await page.request.get(`${apiOrigin}/api/orcamentos/${budget.id}`, { headers });
  await fs.writeFile(path.join(evidence, 'emitido-refinado.json'), JSON.stringify({ budget: await persisted.json() }, null, 2));
  await fs.writeFile(path.join(evidence, 'medicoes.json'), JSON.stringify(measurements, null, 2));
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('geogestor_theme', value), theme);
      await page.goto(`/orcamentos?budgetId=${budget.id}`);
      await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
      await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
      await expect(page.getByRole('dialog').first().getByRole('button', { name: 'Gerar PDF', exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(evidence, `emitido-${width}-${theme}.png`) });
    }
  }
  // Editing issued proposals remains blocked by the existing business rule.
  expect((await page.request.patch(`${apiOrigin}/api/orcamentos/${budget.id}`, { headers, data: {} })).status()).toBeGreaterThanOrEqual(400);
  const issuedDialog = page.getByRole('dialog').first();
  await issuedDialog.getByRole('button', { name: 'Aprovar', exact: true }).click();
  const approval = page.getByRole('dialog', { name: 'Confirmar aprovação e efeitos financeiros' });
  await approval.getByRole('button', { name: 'Aprovar e gerar efeitos' }).click();
  await expect(approval).toHaveCount(0);
  const approvedResponse = await page.request.get(`${apiOrigin}/api/orcamentos/${budget.id}`, { headers });
  const approved = await approvedResponse.json();
  expect(approved.status).toBe('aprovado');
  expect(approved.valorTotal).toBe(123457);
  expect(approved.installments).toHaveLength(1);
  expect(approved.installments[0].valor).toBe(123457);
  expect(approved.characterization.executionStart).toEqual({ type: 'custom', description: 'Liberação de acesso ao imóvel e entrega dos documentos.' });
  const approvedDownload = page.waitForEvent('download');
  await page.getByRole('dialog').first().getByRole('button', { name: 'Gerar PDF', exact: true }).click();
  await (await approvedDownload).saveAs(path.join(evidence, 'aprovado.pdf'));
  await page.keyboard.press('Escape');
  await expect(page.getByText('Role para os lados para ver todas as colunas')).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'listagem-1440-dark.png') });
  // Legacy contradictions remain exactly as authored and are advisory in editing.
  const legacy = await page.request.post(`${apiOrigin}/api/orcamentos`, { headers, data: {
    clientId, description: 'Proposta com condições legadas', issueDate: e2eReferenceDate(), validUntil: relativeDate(15),
    serviceType: 'Levantamento cadastral', terms: 'Validade: 15 dias úteis. Pagamento: 50% na aprovação e 50% na entrega.',
    globalDiscount: { type: 'fixo', value: '0' }, globalAddition: { type: 'fixo', value: '0' },
    items: [{ description: 'Serviço', unit: 'serviço', quantity: '1', unitPriceCents: 100000, unitCostCents: 0, discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: false, component: 'servico' }],
    costs: [], taxes: [],
    payment: { type: 'parcelas', description: 'À vista na aprovação', installments: [{ percentage: '100', dueDate: relativeDate(45) }] }
  } });
  expect(legacy.status(), await legacy.text()).toBe(201);
  const legacyBudget = await legacy.json();
  await page.goto(`/orcamentos?budgetId=${legacyBudget.id}`);
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Editar orçamento', exact: true }).click();
  const warning = page.getByRole('complementary', { name: 'Revisão das condições comerciais' });
  await expect(page.locator('#budget-execution-start')).toContainText('Não definido');
  await expect(warning).toContainText('Seus textos e dados foram preservados');
  await expect(warning.getByRole('listitem')).toHaveCount(3);
  await page.locator('[data-budget-nav-section="payment"]:visible').click();
  await expect(page.getByLabel('Vencimento da parcela 1', { exact: true })).toContainText(new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${relativeDate(45)}T12:00:00Z`)));
  await page.screenshot({ path: path.join(evidence, 'revisao-condicoes-legadas.png') });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const unchanged = await page.request.get(`${apiOrigin}/api/orcamentos/${legacyBudget.id}`, { headers });
  const finalLegacy = await unchanged.json();
  expect(finalLegacy.termosCondicoes).toBe(legacyBudget.termosCondicoes);
  expect(finalLegacy.payment).toEqual(legacyBudget.payment);
  database.close();
});
