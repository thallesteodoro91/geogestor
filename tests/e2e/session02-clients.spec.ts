import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type Request } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S02-';
const CLIENT_NAME = `${PREFIX}Cliente Árvore`;
const UPDATED_CLIENT_NAME = `${PREFIX}Cliente Árvore Atualizado`;
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

async function unlock(page: Page) {
  await page.goto('/');
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboardHeading = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(unlockHeading.or(dashboardHeading)).toBeVisible();
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboardHeading).toBeVisible();
}

async function openClients(page: Page) {
  await page.getByRole('link', { name: 'Comercial', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
}

async function reloadClients(page: Page) {
  await page.reload();
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const search = page.getByRole('searchbox', { name: 'Buscar clientes' });
  await expect(unlockHeading.or(search)).toBeVisible();
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(search).toBeVisible();
}

async function authenticatedApi(listRequest: Promise<Request>) {
  const request = await listRequest;
  const requestHeaders = await request.allHeaders();
  return {
    origin: new URL(request.url()).origin,
    headers: Object.fromEntries(
      Object.entries(requestHeaders).filter(([name]) => ['x-api-token', 'x-local-session'].includes(name.toLowerCase())),
    ),
  };
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test.describe('Sessão 02 — Comercial — Clientes', () => {
  test.use({ actionTimeout: 10_000 });
  test.setTimeout(180_000);

  test('diretório, validações, todos os grupos do formulário, filtros e paginação', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

    await unlock(page);
    const listRequest = page.waitForRequest('**/api/clientes?**');
    await openClients(page);
    const auth = await authenticatedApi(listRequest);
    await expect(page.getByText('Nenhum cliente cadastrado')).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-clientes-vazio.png'), fullPage: true });

    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Novo cliente' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await page.getByLabel('Nome completo').fill(`${PREFIX}Rascunho`);
    page.once('dialog', async (confirmation) => {
      expect(confirmation.message()).toContain('Descartar as alterações não salvas');
      await confirmation.dismiss();
    });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeVisible();
    page.once('dialog', async (confirmation) => confirmation.accept());
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByLabel('Nome completo')).toBeFocused();
    await expect(page.getByText('Informe o nome completo ou a razão social.')).toBeVisible();
    await expect(page.getByText('Informe um CPF válido com 11 dígitos.')).toBeVisible();
    await expect(page.getByText('Informe um celular ou telefone com DDD e 10 ou 11 dígitos.')).toBeVisible();

    await page.getByLabel('Nome completo').fill(`  ${CLIENT_NAME}  `);
    await page.getByLabel('CPF *').fill('52998224725');
    await expect(page.getByLabel('CPF *')).toHaveValue('529.982.247-25');
    await page.getByRole('textbox', { name: 'RG', exact: true }).fill('12.345.678-9');
    await dialog.getByText('Produtor Rural', { exact: true }).click();
    await page.getByLabel('E-mail').fill('qa.s02@example.invalid');
    await page.getByRole('textbox', { name: 'Celular', exact: true }).fill('48999991234');
    await dialog.getByText('Este número possui WhatsApp', { exact: true }).click();
    await page.getByLabel('Telefone adicional').fill('4833334444');
    await page.getByLabel('CEP').fill('88010000');
    await page.getByLabel('Logradouro').fill('Rua das Araucárias');
    const addressNumber = page.getByRole('textbox', { name: 'Número', exact: true });
    await addressNumber.fill('120');
    await dialog.getByText('Sem número', { exact: true }).click();
    await expect(addressNumber).toBeDisabled();
    await dialog.getByText('Sem número', { exact: true }).click();
    await addressNumber.fill('120');
    await page.getByLabel('Complemento').fill('Sala 4');
    await page.getByLabel('Bairro').fill('Centro');
    await page.getByLabel('Município').fill('Florianópolis');
    await page.getByLabel('UF').fill('sc');
    await expect(page.getByLabel('UF')).toHaveValue('SC');
    await page.getByLabel('Origem do cliente').click();
    await page.getByRole('option', { name: 'Indicação', exact: true }).click();
    await page.getByLabel('Quem indicou? *').fill('QA indicação');
    await dialog.getByText('Georreferenciamento', { exact: true }).click();
    await page.getByRole('tab', { name: 'Anotações fixas' }).click();
    await page.getByLabel('Observações').fill('Nota sintética com acentuação e quebra\nde linha.');
    await page.getByRole('tab', { name: 'Cadastro' }).click();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByText(CLIENT_NAME, { exact: true }).first()).toBeVisible();

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    try {
      const rows = Array.from({ length: 31 }, (_, index) => ({
        sql: `insert into clientes (id, nome, tipo_pessoa, cpf, documento, documento_normalizado, celular, situacao, categoria, perfis, origem, origem_principal, created_at, updated_at)
          values (?, ?, 'PF', ?, ?, ?, '(48) 99999-0000', ?, 'Produtor Rural', 'Produtor Rural', ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          `${PREFIX}Cliente ${String(index).padStart(2, '0')}`,
          `000000000${String(index).padStart(2, '0')}`,
          `000000000${String(index).padStart(2, '0')}`,
          `000000000${String(index).padStart(2, '0')}`,
          index === 30 ? 'Inativo' : 'Ativo',
          index === 30 ? 'Google' : 'Indicação',
          index === 30 ? 'Google' : 'Indicação',
          relativeInstant(index),
          relativeInstant(index),
        ],
      }));
      await database.batch(rows, 'write');
    } finally {
      database.close();
    }

    await reloadClients(page);
    await expect(page.getByText('32 resultados encontrados')).toBeVisible();
    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    await page.getByRole('button', { name: 'Próxima página' }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByText('Página 2 de 2')).toBeVisible();
    await page.getByRole('button', { name: 'Página anterior' }).click();

    const search = page.getByRole('searchbox', { name: 'Buscar clientes' });
    await search.fill('Cliente 30');
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByLabel('Filtrar por status').click();
    await page.getByRole('option', { name: 'Inativo', exact: true }).click();
    await page.getByLabel('Filtrar por origem').click();
    await page.getByRole('option', { name: 'Google', exact: true }).click();
    await page.getByLabel('Ordenar clientes').click();
    await page.getByRole('option', { name: 'Nome (Z–A)', exact: true }).click();
    await expect(page.getByText(`${PREFIX}Cliente 30`, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/q=Cliente(?:\+|%20)30/);
    await expect(page).toHaveURL(/status=Inativo/);
    await reloadClients(page);
    await expect(search).toHaveValue('Cliente 30');
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await search.fill(`${PREFIX}inexistente`);
    await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByText('32 resultados encontrados')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-clientes-populado.png'), fullPage: true });
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
    }
    await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Ativar modo claro' }).click();
    await page.setViewportSize({ width: 1120, height: 680 });

    const direct = await page.request.get(`${auth.origin}/api/clientes?mode=page&q=${encodeURIComponent(CLIENT_NAME)}`, { headers: auth.headers });
    expect(direct.status()).toBe(200);
    expect((await direct.json() as { total: number }).total).toBe(1);
    expect(consoleErrors).toEqual([]);
  });

  test('persistência, edição, histórico, arquivos, abas, vínculos e exclusão segura', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await unlock(page);
    const listRequest = page.waitForRequest('**/api/clientes?**');
    await openClients(page);
    const auth = await authenticatedApi(listRequest);
    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });

    const existingClient = await database.execute({ sql: 'select id from clientes where nome = ? and deleted_at is null limit 1', args: [CLIENT_NAME] });
    if (existingClient.rows.length === 0) {
      await database.execute({
        sql: `insert into clientes (id, nome, tipo_pessoa, cpf, documento, documento_normalizado, celular, email, municipio, anotacoes, situacao)
          values (?, ?, 'PF', ?, ?, ?, ?, ?, ?, ?, 'Ativo')`,
        args: ['a2e20000-0000-4000-8000-000000000001', CLIENT_NAME, '52998224725', '52998224725',
          '52998224725', '(48) 99999-1234', 'qa.s02@example.invalid', 'Florianópolis',
          'Nota sintética com acentuação e quebra\nde linha.']
      });
      await reloadClients(page);
      await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
    }

    const created = await database.execute({ sql: 'select * from clientes where nome = ?', args: [CLIENT_NAME] });
    const clientId = String(created.rows[0]?.id || '');
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.rows[0]?.email).toBe('qa.s02@example.invalid');
    expect(created.rows[0]?.municipio).toBe('Florianópolis');
    expect(created.rows[0]?.anotacoes).toContain('Nota sintética');

    const search = page.getByRole('searchbox', { name: 'Buscar clientes' });
    await search.fill(CLIENT_NAME);
    await page.getByRole('button', { name: `Ações de ${CLIENT_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar cliente' });
    await expect(dialog).toBeVisible();
    await page.getByRole('tab', { name: 'Histórico CRM' }).click();
    await page.getByLabel('Tipo de Interação').click();
    await page.getByRole('option', { name: 'E-mail', exact: true }).click();
    await page.getByLabel('Descrição da Interação').fill('Interação sintética confirmada pela interface.');
    await page.getByRole('button', { name: 'Registrar no Histórico' }).click();
    await expect(dialog.getByText('Interação sintética confirmada pela interface.')).toBeVisible();

    await page.getByRole('tab', { name: 'Arquivos' }).click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await dialog.locator('input[type="file"]').setInputFiles({ name: `${PREFIX}evidência ÁÇÃO.PNG`, mimeType: 'image/png', buffer: png });
    await expect(dialog.getByText(`${PREFIX}evidência ÁÇÃO.PNG`, { exact: true })).toBeVisible();
    const filesBeforeRename = await page.request.get(`${auth.origin}/api/arquivos/cliente/${clientId}`, { headers: auth.headers });
    expect(filesBeforeRename.status()).toBe(200);
    const firstPath = String((await filesBeforeRename.json() as { files: Array<{ path: string }> }).files[0]?.path || '');
    expect(firstPath).toContain(CLIENT_NAME);

    await page.getByRole('tab', { name: 'Cadastro' }).click();
    await page.getByLabel('Nome completo').fill(UPDATED_CLIENT_NAME);
    await page.getByLabel('Situação').click();
    await page.getByRole('option', { name: 'Em Prospecção', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByText(UPDATED_CLIENT_NAME, { exact: true }).first()).toBeVisible();

    const filesAfterRename = await page.request.get(`${auth.origin}/api/arquivos/cliente/${clientId}`, { headers: auth.headers });
    const renamedFile = (await filesAfterRename.json() as { files: Array<{ name: string; path: string }> }).files[0];
    expect(renamedFile.name).toBe(`${PREFIX}evidência ÁÇÃO.PNG`);
    expect(renamedFile.path).toContain(UPDATED_CLIENT_NAME);

    const projectId = crypto.randomUUID();
    const propertyId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    await database.batch([
      { sql: 'insert into propriedades (id, cliente_id, nome, matricula, municipio, area_ha, latitude, longitude) values (?, ?, ?, ?, ?, ?, ?, ?)', args: [propertyId, clientId, `${PREFIX}Fazenda`, 'S02-123', 'Florianópolis', 12.5, -27.59, -48.55] },
      { sql: 'insert into projetos (id, cliente_id, propriedade_id, nome, tipo, status, area_ha, latitude, longitude) values (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [projectId, clientId, propertyId, `${PREFIX}Projeto`, 'Topografia', 'Em Andamento', 12.5, -27.59, -48.55] },
      { sql: 'insert into orcamentos (id, cliente_id, projeto_id, descricao, valor_total, status, data_orcamento) values (?, ?, ?, ?, ?, ?, ?)', args: [budgetId, clientId, projectId, `${PREFIX}Orçamento`, 150_000, 'aprovado', relativeDate()] },
    ], 'write');

    await search.fill(UPDATED_CLIENT_NAME);
    await page.getByRole('link', { name: `Abrir cadastro de ${UPDATED_CLIENT_NAME}` }).click();
    await expect(page.getByRole('heading', { name: UPDATED_CLIENT_NAME })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar para clientes' })).toBeVisible();
    await expect(page).toHaveTitle(`${UPDATED_CLIENT_NAME} — GeoGestor`);
    await page.screenshot({ path: path.join(evidenceRoot, '03-cliente-detalhes.png'), fullPage: true });
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
    }
    await page.setViewportSize({ width: 1120, height: 680 });

    const tabRoutes = new Map([
      ['Propriedades', 'propriedades'],
      ['Serviços', 'servicos'],
      ['Ambiental', 'ambiental'],
      ['Orçamentos', 'orcamentos'],
      ['Financeiro', 'financeiro'],
      ['Arquivos', 'arquivos'],
    ]);
    for (const [tab, route] of tabRoutes) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await expect(page).toHaveURL(new RegExp(`tab=${route}`));
      if (tab === 'Propriedades') {
        await expect(page.getByText(`${PREFIX}Fazenda`, { exact: true }).first()).toBeVisible();
      }
      if (tab === 'Serviços') {
        await expect(page.getByText(`${PREFIX}Projeto`, { exact: true }).first()).toBeVisible();
      }
      if (tab === 'Orçamentos') {
        await expect(page.getByText(`${PREFIX}Orçamento`, { exact: true }).first()).toBeVisible();
      }
    }
    await expect(page.getByText(`${PREFIX}evidência ÁÇÃO.PNG`, { exact: true })).toBeVisible();
    const previewResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET' && response.url().includes('/api/arquivos/preview?path=')
    ));
    await page.getByRole('button', { name: `Visualizar arquivo ${PREFIX}evidência ÁÇÃO.PNG` }).click();
    expect((await previewResponse).status()).toBe(200);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    const download = await page.request.get(`${auth.origin}/api/arquivos/download?path=${encodeURIComponent(renamedFile.path)}`, { headers: auth.headers });
    expect(download.status()).toBe(200);
    expect((await download.body()).length).toBe(png.length);

    await page.getByRole('button', { name: `Excluir arquivo ${PREFIX}evidência ÁÇÃO.PNG` }).click();
    const deleteFileResponse = page.waitForResponse((response) => (
      response.request().method() === 'DELETE' && response.url().includes('/api/arquivos?path=')
    ));
    await page.getByRole('button', { name: 'Excluir arquivo', exact: true }).click();
    expect((await deleteFileResponse).status()).toBe(200);
    await expect(page.getByText(`${PREFIX}evidência ÁÇÃO.PNG`, { exact: true })).toHaveCount(0);
    expect(await fs.stat(renamedFile.path).then(() => true).catch(() => false)).toBe(false);

    await page.goto('/clientes');
    const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
    if (await unlockHeading.isVisible()) {
      await page.getByLabel('Senha local').fill(PASSWORD);
      await page.getByRole('button', { name: 'Desbloquear' }).click();
    }
    await search.fill(UPDATED_CLIENT_NAME);
    await page.getByRole('button', { name: `Ações de ${UPDATED_CLIENT_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(UPDATED_CLIENT_NAME, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: `Ações de ${UPDATED_CLIENT_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Excluir cliente' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/Remova ou reassocie os vínculos ativos/)).toBeVisible();

    const deletedAt = relativeInstant();
    await database.batch([
      { sql: 'update orcamentos set deleted_at = ? where id = ?', args: [deletedAt, budgetId] },
      { sql: 'update projetos set deleted_at = ? where id = ?', args: [deletedAt, projectId] },
      { sql: 'update propriedades set deleted_at = ? where id = ?', args: [deletedAt, propertyId] },
    ], 'write');
    await page.getByRole('button', { name: 'Excluir cliente' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByText(UPDATED_CLIENT_NAME, { exact: true })).toHaveCount(0);

    const directClient = await page.request.get(`${auth.origin}/api/clientes/${clientId}`, { headers: auth.headers });
    expect(directClient.status()).toBe(404);
    await page.goto(`/clientes/${clientId}`);
    const deletedHeading = page.getByRole('heading', { name: 'Cliente não encontrado' });
    await expect(unlockHeading.or(deletedHeading)).toBeVisible();
    if (await unlockHeading.isVisible()) {
      await page.getByLabel('Senha local').fill(PASSWORD);
      await page.getByRole('button', { name: 'Desbloquear' }).click();
    }
    await expect(deletedHeading).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar para lista de clientes' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '04-cliente-excluido.png'), fullPage: true });
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: 'Voltar para lista de clientes' }).click();
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
    expect(consoleErrors.filter((message) => !/status of (409|404)/.test(message))).toEqual([]);
    database.close();
  });
});
