import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const API_URL = 'http://127.0.0.1:3191';
const WEB_URL = 'http://127.0.0.1:5193';
const ARTIFACTS = resolve('scratch/e2e-orcamentos');
const CORPORATE_TERMS = 'Termos corporativos E2E — snapshot oficial preservado no orçamento.';

async function apiPost(path: string, payload: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const alreadyPrepared = response.status === 409 && (path === '/api/configuracoes' || path === '/api/clientes');
  assert.ok(response.ok || alreadyPrepared, `${path} retornou ${response.status}: ${await response.text()}`);
}

async function prepareData() {
  await apiPost('/api/configuracoes', {
    empresaNome: 'SkyGeo E2E',
    dadosPasta: ARTIFACTS,
    adminNome: 'Administrador E2E',
    adminEmail: 'admin.e2e@skygeo.local',
    adminSenha: 'teste-e2e-123'
  });
  await apiPost('/api/clientes', {
    tipoPessoa: 'PF',
    nome: 'Cliente E2E',
    cpf: '52998224725',
    celular: '48999999999',
    email: 'cliente.e2e@teste.local',
    categoria: 'Pessoa Física',
    situacao: 'Ativo'
  });
}

function budgetIdFromUrl(url: string) {
  const id = new URL(url).searchParams.get('budgetId');
  assert.ok(id, `URL sem budgetId: ${url}`);
  return id;
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  await prepareData();

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
    colorScheme: 'dark',
    locale: 'pt-BR'
  });
  const page = await context.newPage();
  const consoleErrors: Array<{ stage: string; text: string; location: string }> = [];
  const failedRequests: Array<{ stage: string; url: string; error: string }> = [];
  let stage = 'carregamento';
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ stage, text: message.text(), location: message.location().url });
  });
  page.on('requestfailed', (request) => failedRequests.push({ stage, url: request.url(), error: request.failure()?.errorText || 'Falha desconhecida' }));

  stage = 'configuração do modelo';
  await page.goto(`${WEB_URL}/configuracoes?secao=modelos`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Padrão visual dos PDFs' })).toBeVisible();
  await page.locator('#template-company-name').fill('SkyGeo E2E');
  await page.locator('#template-professional-council').fill('CREA-SC');
  await page.locator('#template-professional-registration').fill('000000-0');
  await page.locator('#template-terms').fill(CORPORATE_TERMS);
  await page.getByRole('button', { name: 'Usar a cor âmbar' }).click();
  await expect(page.getByLabel('Prévia do modelo de PDF')).toContainText(CORPORATE_TERMS);
  await page.screenshot({ path: resolve(ARTIFACTS, 'configuracao-modelo-pdf-desktop.png'), fullPage: true });
  const saveTemplateButton = page.getByRole('button', { name: 'Salvar alterações' });
  if (await saveTemplateButton.isEnabled()) {
    await saveTemplateButton.click();
    await expect(page.getByText('Salvo com sucesso', { exact: true })).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByText('Tudo salvo', { exact: true })).toBeVisible();
  }

  await page.goto(`${WEB_URL}/orcamentos`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Orçamentos' })).toBeVisible();

  stage = 'proteção contra descarte e responsividade';
  await page.getByRole('button', { name: 'Novo orçamento' }).first().click();
  await page.getByRole('button', { name: /Documento final/ }).first().click();
  await expect(page.locator('#budget-terms')).toHaveValue(CORPORATE_TERMS);
  await page.screenshot({ path: resolve(ARTIFACTS, 'editor-orcamento-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(ARTIFACTS, 'editor-orcamento-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Editor criou rolagem horizontal na largura móvel.');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator('#budget-description').fill('Rascunho que não deve ser perdido');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('alert')).toContainText('alterações não salvas');
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.locator('#budget-description')).toHaveValue('Rascunho que não deve ser perdido');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar alterações' }).click();

  stage = 'criação';
  await page.getByRole('button', { name: 'Novo orçamento' }).first().click();
  await page.getByRole('button', { name: 'Criar orçamento' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Revise 3 campos');
  await expect(page.locator('#budget-description')).toBeFocused();
  await page.locator('#budget-description').fill('Proposta E2E de levantamento');
  await page.getByRole('button', { name: /Cliente e imóvel/ }).first().click();
  await page.locator('#budget-client').click();
  await page.getByRole('option', { name: 'Cliente E2E' }).click();
  await page.getByRole('button', { name: /Itens do orçamento/ }).first().click();
  await page.locator('#budget-item-description-0').fill('Levantamento planialtimétrico cadastral');
  await page.locator('#budget-item-price-0').fill('1500,00');
  await page.getByRole('button', { name: 'Precificação e classificação' }).click();
  await page.locator('label[for="budget-item-taxable-0"]').click();
  await expect(page.locator('#budget-item-taxable-0')).not.toBeChecked();
  await page.getByRole('button', { name: 'Criar orçamento' }).click();
  await expect(page.getByRole('button', { name: 'Visualizar orçamento de Cliente E2E' }).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Visualizar orçamento de Cliente E2E' }).first().click();
  await expect(page.getByRole('heading', { name: /Rascunho.*versão 1/ })).toBeVisible({ timeout: 15_000 });
  const originalId = budgetIdFromUrl(page.url());

  stage = 'pdf';
  await page.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exportar orçamento em rascunho' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Exportar com marca-d’água' }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.pdf'));
  await download.saveAs(resolve(ARTIFACTS, download.suggestedFilename()));

  stage = 'edição';
  await page.getByRole('button', { name: 'Editar rascunho', exact: true }).click();
  await page.locator('#budget-description').fill('Proposta E2E revisada');
  await page.getByRole('button', { name: 'Atualizar orçamento' }).click();
  await expect(page.getByRole('button', { name: 'Visualizar orçamento de Cliente E2E' }).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Visualizar orçamento de Cliente E2E' }).first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Proposta E2E revisada', level: 2 })).toBeVisible({ timeout: 15_000 });

  stage = 'duplicação e exclusão';
  await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get('budgetId') !== id, originalId, { timeout: 15_000 });
  const duplicatedId = budgetIdFromUrl(page.url());
  assert.notEqual(duplicatedId, originalId);
  await page.getByLabel('Fechar modal').click();
  const matchingRows = page.locator('tbody tr').filter({ hasText: 'Proposta E2E revisada' });
  await expect(matchingRows).toHaveCount(2);
  await matchingRows.first().getByRole('button', { name: /Excluir rascunho/ }).click();
  await page.getByRole('button', { name: 'Excluir rascunho', exact: true }).click();
  await expect(matchingRows).toHaveCount(1, { timeout: 15_000 });

  stage = 'emissão e aprovação';
  await page.goto(`${WEB_URL}/orcamentos?budgetId=${originalId}`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByText('Emitido', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar aprovação e efeitos financeiros' })).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar e gerar efeitos' }).click();
  await expect(page.getByText('Aprovado', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Parcela 1')).toBeVisible();
  await page.screenshot({ path: resolve(ARTIFACTS, 'orcamentos-e2e-final.png'), fullPage: true });

  const applicationConsoleErrors = consoleErrors.filter((entry) => entry.location.startsWith(WEB_URL) || entry.location.startsWith(API_URL));
  const applicationFailedRequests = failedRequests.filter((entry) => entry.url.startsWith(WEB_URL) || entry.url.startsWith(API_URL));
  assert.deepEqual(applicationConsoleErrors, [], `Erros da aplicação no console: ${JSON.stringify({ applicationConsoleErrors, applicationFailedRequests }, null, 2)}`);
  assert.deepEqual(applicationFailedRequests, [], `Requisições locais com falha: ${JSON.stringify(applicationFailedRequests, null, 2)}`);
  await context.close();
  await browser.close();
}

void main();
