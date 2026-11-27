import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { e2eReferenceDate, relativeDate } from './support/runtime';

const evidence = path.resolve('docs/auditorias/2026-10-11-impeccable-orcamentos/implementacao/evidencias/interface');
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client') as typeof import('@libsql/client');

test('refinamento: temas, notebooks, teclado, edição, emissão e resumo público', async ({ page }) => {
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
  const created = await page.request.post(`${apiOrigin}/api/orcamentos`, { headers, data: {
    clientId, description: 'Levantamento cadastral — acabamento', issueDate: e2eReferenceDate(), validUntil: relativeDate(30),
    technicalLead: 'Profissional fictício', serviceType: 'Levantamento cadastral', municipality: 'Florianópolis', state: 'SC',
    internalNotes: 'SIGILO_NOTAS', clientNotes: 'Agendar o acesso ao imóvel.', terms: 'Condições acordadas para esta proposta.',
    globalDiscount: { type: 'fixo', value: '0' }, globalAddition: { type: 'fixo', value: '0' },
    items: [{ description: 'Serviço cadastral', unit: 'serviço', quantity: '1', unitPriceCents: 123457, unitCostCents: 12000,
      discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: true, component: 'servico', notes: 'NOTA_ITEM_INTERNA_NAO_EXPORTAR' }],
    costs: [{ category: 'Equipe', description: 'SIGILO_CUSTO', amountCents: 12000, classification: 'custo_proprio', taxable: false }], taxes: [],
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
      await expect(summary).toContainText('R$ 1.234,57');
      await expect(summary).not.toContainText(/SIGILO|CONTA_INTERNA|NOTA_ITEM_INTERNA|Lucro|Margem|Custos operacionais/);
      const colors = await summary.evaluate(node => ({ ink: getComputedStyle(node).color, paper: getComputedStyle(node).backgroundColor, secondary: getComputedStyle(node.querySelector('.budget-paper-secondary')!).color }));
      expect(colors).toEqual({ ink: 'rgb(24, 24, 27)', paper: 'rgb(255, 255, 255)', secondary: 'rgb(82, 82, 91)' });
      measurements.push({ width, theme, colors });
      await page.screenshot({ path: path.join(evidence, `rascunho-${width}-${theme}.png`) });
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
      await page.screenshot({ path: path.join(evidence, `editor-${width}-${theme}.png`) });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
  }
  // Save a real edit and verify the details and PDF use its persisted values.
  await page.goto(`/orcamentos?budgetId=${budget.id}`);
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Editar orçamento', exact: true }).click();
  await page.locator('#budget-description').fill('Proposta editada e persistida');
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
  await page.keyboard.press('Escape');
  await expect(page.getByText('Role para os lados para ver todas as colunas')).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'listagem-1440-dark.png') });
  database.close();
});
