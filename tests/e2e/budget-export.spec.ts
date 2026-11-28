import { _electron, expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { e2eReferenceDate, relativeDate } from './support/runtime';

const root = process.cwd();
const evidence = path.resolve(root, process.env.GEOGESTOR_BUDGET_EVIDENCE || 'docs/auditorias/2026-10-10-exportacao-orcamento/evidencias/interface');
const requireApi = createRequire(path.join(root, 'apps/api/package.json'));
const { createClient } = requireApi('@libsql/client') as typeof import('@libsql/client');

test('PDF real: dados atuais, edição, duplicação, isolamento, salvamento e abertura no Electron', async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  await fs.mkdir(evidence, { recursive: true });
  const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
  const clientId = crypto.randomUUID();
  const otherClientId = crypto.randomUUID();
  await database.batch([
    { sql: `insert into clientes (id, nome, tipo_pessoa, documento, email, telefone, situacao) values (?, 'Cliente fictício — São João', 'PF', '52998224725', 'teste@example.invalid', '48999990000', 'Ativo')`, args: [clientId] },
    { sql: `insert into clientes (id, nome, tipo_pessoa, documento, situacao) values (?, 'OUTRO_CLIENTE_NAO_EXPORTAR', 'PF', '11144477735', 'Ativo')`, args: [otherClientId] }
  ], 'write');
  await page.goto('/orcamentos');
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  const unlockPromise = page.waitForResponse(r => r.url().endsWith('/api/auth/unlock') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  const unlock = await unlockPromise;
  const apiOrigin = new URL(unlock.url()).origin;
  const headers = { 'x-local-session': (await unlock.json()).token };
  const payload = {
    clientId, description: 'Proposta fictícia antes da edição', internalNotes: 'SIGILO_NOTAS', clientNotes: '',
    terms: '', issueDate: e2eReferenceDate(), validUntil: relativeDate(30),
    technicalLead: 'Profissional fictício', serviceType: 'Levantamento cadastral', methodology: 'Pontos de apoio físicos no solo e estação base eletrônica GNSS.', deliverables: 'Planta e memorial.',
    characterization: { estimatedArea: '12.345678', areaUnit: 'ha' },
    globalDiscount: { type: 'fixo', value: '852' }, globalAddition: { type: 'percentual', value: '7.5' },
    items: Array.from({ length: 4 }, (_, index) => ({
      description: `ITEM-${String(index+1).padStart(3, '0')} — Medição de São João, área técnica e confrontação. FIM-ITEM-${index+1}`,
      unit: 'hectare', quantity: '1.234567', unitCostCents: 999, unitPriceCents: 10001+index,
      discount: { type: 'percentual', value: '10' }, addition: { type: 'fixo', value: '57' },
      taxable: true, component: 'servico', optional: index === 3, notes: 'NOTA_ITEM_INTERNA_NAO_EXPORTAR'
    })),
    costs: [
      { category: 'Equipe', description: 'SIGILO_CUSTO', amountCents: 5000, classification: 'custo_proprio', taxable: false },
      { category: 'Viagem', description: 'Despesa reembolsável', amountCents: 3000, classification: 'despesa_reembolsavel', taxable: true },
      { category: 'Taxas', description: 'Taxa repassada', amountCents: 1500, classification: 'taxa_repassada', taxable: false }
    ],
    taxes: [
      { name: 'ISS', acronym: 'ISS', ratePercent: '5.555', calculationBase: 'servicos', includedInPrice: true, cumulative: false, manualAdjustmentCents: 0 },
      { name: 'Tributo', acronym: 'EXT', ratePercent: '3', calculationBase: 'tributavel', includedInPrice: false, cumulative: false, manualAdjustmentCents: 3, adjustmentReason: 'SIGILO_JUSTIFICATIVA' }
    ],
    payment: { type: 'avista', paymentMethod: 'PIX', financialAccount: 'CONTA_INTERNA_NAO_EXPORTAR', installments: [{ percentage: '100', daysAfterApproval: 0, label: 'Pagamento' }] }
  };
  const createdResponse = await page.request.post(`${apiOrigin}/api/orcamentos`, { headers, data: payload });
  expect(createdResponse.status(), await createdResponse.text()).toBe(201);
  const created = await createdResponse.json();
  expect(created.valorTotal).toBe(41_165);
  expect(created.taxes[0]).toMatchObject({ ratePercent: '5.56', amountCents: 1858 });
  const other = await page.request.post(`${apiOrigin}/api/orcamentos`, { headers, data: { ...payload, clientId: otherClientId, description: 'ORCAMENTO_OUTRO_CLIENTE_NAO_EXPORTAR' } });
  expect(other.status()).toBe(201);
  // A mounted details modal is intentionally made stale before export.
  await page.goto(`/orcamentos?budgetId=${created.id}`);
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toContainText('Proposta fictícia antes da edição');
  const updatedPayload = { ...payload, description: 'Proposta editada antes da exportação — Açores' };
  const updatedResponse = await page.request.patch(`${apiOrigin}/api/orcamentos/${created.id}`, { headers: { ...headers, 'x-record-version': created.updatedAt }, data: updatedPayload });
  expect(updatedResponse.status(), await updatedResponse.text()).toBe(200);
  const updated = await updatedResponse.json();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Mais ações', exact: true }).click();
  await dialog.getByRole('menuitem', { name: 'Gerar PDF', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar com marca-d’água', exact: true }).click();
  const draftDownload = await download;
  await draftDownload.saveAs(path.join(evidence, 'rascunho-editado.pdf'));
  expect(await draftDownload.failure()).toBeNull();
  await fs.writeFile(path.join(evidence, 'rascunho-editado.json'), JSON.stringify({ budget: updated }, null, 2));
  const beforeExport = await page.request.get(`${apiOrigin}/api/orcamentos/${created.id}`, { headers });
  expect(await beforeExport.json()).toEqual(updated);
  const duplicateResponse = await page.request.post(`${apiOrigin}/api/orcamentos/${created.id}/duplicate`, { headers });
  expect(duplicateResponse.status()).toBe(201);
  const duplicate = await duplicateResponse.json();
  expect(duplicate).toMatchObject({ status: 'rascunho', codigoOrcamento: null, versao: 1, valorTotal: 41_165 });
  expect(duplicate.items.every((item: { id: string }) => !updated.items.some((source: { id: string }) => source.id === item.id))).toBe(true);
  const emittedResponse = await page.request.post(`${apiOrigin}/api/orcamentos/${created.id}/emit`, { headers });
  expect(emittedResponse.status(), await emittedResponse.text()).toBe(200);
  const emitted = await emittedResponse.json();
  await database.execute({ sql: `update clientes set nome = 'CADASTRO_ALTERADO_NAO_SUBSTITUI_SNAPSHOT', email = 'alterado@example.invalid' where id = ?`, args: [clientId] });
  const frozenResponse = await page.request.get(`${apiOrigin}/api/orcamentos/${created.id}`, { headers });
  expect((await frozenResponse.json()).clientName).toBe('Cliente fictício — São João');
  // Each run owns its destination; a PDF opened by a previous run may still be
  // locked by the Windows reader and must not be overwritten by this test.
  const nativeDirectory = path.join(evidence, 'Destino com espaços e acentos', created.id);
  await fs.mkdir(nativeDirectory, { recursive: true });
  const harness = path.join(process.env.GEOGESTOR_E2E_ROOT!, 'budget-export-harness.cjs');
  await fs.writeFile(harness, `
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { createBudgetPdfService } = require(${JSON.stringify(path.join(root, 'apps/desktop/budget-pdf.cjs'))});
globalThis.audit = { destination: null, pending: false, selections: 0, opened: [], openResults: [], release: null };
ipcMain.on('get-api-token', e => { e.returnValue = ''; });
ipcMain.on('get-api-port', e => { e.returnValue = ${new URL(apiOrigin).port}; });
ipcMain.on('set-local-session-token', () => {});
const service = createBudgetPdfService({ chooseDestination: async () => { audit.selections++; if(audit.pending) return new Promise(resolve => { audit.release = resolve; }); return audit.destination; },
  openPath: async destination => { audit.opened.push(destination); const result = await shell.openPath(destination); audit.openResults.push(result); return result; } });
ipcMain.handle('save-budget-pdf', (_event, payload) => service.save(payload));
ipcMain.handle('open-budget-pdf', (_event, destination) => service.open(destination));
app.whenReady().then(() => { const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { preload: ${JSON.stringify(path.join(root, 'apps/desktop/preload.js'))}, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } }); win.loadURL(${JSON.stringify(`${baseURL}/orcamentos?budgetId=${created.id}`)}); });
app.on('window-all-closed', () => app.quit());
`);
  const electronEnv = { ...process.env };
  delete electronEnv.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [harness], env: electronEnv, executablePath: process.env.GEOGESTOR_E2E_ELECTRON_PATH });
  try {
    const nativePage = await app.firstWindow();
    await nativePage.emulateMedia({ reducedMotion: 'reduce' });
    await nativePage.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await nativePage.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    const nativeDialog = nativePage.getByRole('dialog').first();
    await expect(nativeDialog).toContainText('Cliente fictício — São João');
    await expect(nativeDialog).toContainText('R$ 411,65');
    const button = nativeDialog.getByRole('button', { name: 'Gerar PDF', exact: true });
    // Cancelled destination: no success and no file.
    await button.click();
    await expect(button).toBeEnabled();
    await expect(nativePage.getByText('Orçamento salvo em PDF.', { exact: true })).toHaveCount(0);
    // Hold destination selection to verify the loading state and duplicate clicks.
    await app.evaluate(() => { (globalThis as any).audit.pending = true; });
    await button.click();
    await expect(nativeDialog.getByRole('button', { name: 'Gerando PDF…' })).toBeDisabled();
    await expect.poll(() => app.evaluate(() => Boolean((globalThis as any).audit.release))).toBe(true);
    await nativeDialog.getByRole('button', { name: 'Gerando PDF…' }).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
    expect(await app.evaluate(() => (globalThis as any).audit.selections)).toBe(2);
    const savedPath = path.join(nativeDirectory, 'Orçamento São João');
    await app.evaluate((_context, destination) => { (globalThis as any).audit.pending = false; (globalThis as any).audit.release(destination); }, savedPath);
    await expect(nativePage.getByText('Orçamento salvo em PDF.', { exact: true })).toBeVisible();
    const pdfPath = `${savedPath}.pdf`;
    expect((await fs.readFile(pdfPath)).subarray(0, 5).toString()).toBe('%PDF-');
    await nativePage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const screenshot = await app.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
      return image.toPNG().toString('base64');
    });
    await fs.writeFile(path.join(evidence, 'desktop-sucesso.png'), Buffer.from(screenshot, 'base64'));
    await fs.copyFile(pdfPath, path.join(evidence, 'emitido-desktop.pdf'));
    await fs.writeFile(path.join(evidence, 'emitido-desktop.json'), JSON.stringify({ budget: emitted }, null, 2));
    // Failure happens during writing; the previous file remains intact.
    const savedBytes = await fs.readFile(pdfPath);
    await app.evaluate((_context, destination) => { (globalThis as any).audit.destination = destination; }, path.join(nativeDirectory, 'pasta-inexistente', 'falha.pdf'));
    await button.click();
    await expect(nativePage.getByText(/Não foi possível salvar o orçamento/)).toBeVisible();
    expect(await fs.readFile(pdfPath)).toEqual(savedBytes);
    // Replacing an existing export is exercised using the service after destination approval.
    await app.evaluate((_context, destination) => { (globalThis as any).audit.destination = destination; }, pdfPath);
    await button.click();
    await expect(button).toBeEnabled();
    await expect(nativePage.getByText('Orçamento salvo em PDF.', { exact: true })).toBeVisible();
    expect((await fs.readFile(pdfPath)).subarray(0, 5).toString()).toBe('%PDF-');
    // Opening is last: Windows PDF readers can lock the file against replacement.
    await nativePage.getByRole('button', { name: 'Abrir arquivo', exact: true }).click();
    await expect.poll(() => app.evaluate(() => (globalThis as any).audit.opened.length)).toBe(1);
    await expect.poll(() => app.evaluate(() => (globalThis as any).audit.openResults)).toEqual(['']);
    await expect(nativePage.getByText(/O PDF foi salvo, mas não pôde ser aberto/)).toHaveCount(0);
    await fs.writeFile(path.join(evidence, 'desktop-fluxo.json'), JSON.stringify(await app.evaluate(() => ({ selections: (globalThis as any).audit.selections, opened: (globalThis as any).audit.opened, nativeDialogsControlled: true, actualShellOpenPath: true })), null, 2));
  } finally { await app.close(); }
  // Browser export of the duplicate uses its own ID and watermark.
  await page.goto(`/orcamentos?budgetId=${duplicate.id}`);
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  const duplicateDownload = page.waitForEvent('download');
  await page.getByRole('dialog').first().getByRole('button', { name: 'Mais ações', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Gerar PDF', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar com marca-d’água', exact: true }).click();
  await (await duplicateDownload).saveAs(path.join(evidence, 'duplicado.pdf'));
  // Duplicated drafts use the live client; emitted proposals retain their snapshot.
  const currentDuplicate = await page.request.get(`${apiOrigin}/api/orcamentos/${duplicate.id}`, { headers });
  await fs.writeFile(path.join(evidence, 'duplicado.json'), JSON.stringify({ budget: await currentDuplicate.json() }, null, 2));
  const databaseBudget = await database.execute({ sql: 'select valor_total, subtotal_servicos, subtotal_despesas, subtotal_taxas from orcamentos where id = ?', args: [created.id] });
  expect(databaseBudget.rows[0]).toMatchObject({ valor_total: 41_165, subtotal_servicos: 33_510, subtotal_despesas: 3_000, subtotal_taxas: 1_500 });
  const finalBudget = await page.request.get(`${apiOrigin}/api/orcamentos/${created.id}`, { headers });
  expect((await finalBudget.json()).updatedAt).toBe(emitted.updatedAt);
  await fs.writeFile(path.join(evidence, 'correspondencia.json'), JSON.stringify({ created, updated, emitted, databaseBudget: databaseBudget.rows, expectedTotalCents: 41165, exportDidNotMutateBudget: true, repeatedClicksBlocked: true, cancelledWithoutSuccess: true, actualPdfOpenedThroughShell: true }, null, 2));
  database.close();
});
