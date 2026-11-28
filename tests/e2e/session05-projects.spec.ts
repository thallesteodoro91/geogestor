import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S05-20260911-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

const ids = {
  client: crypto.randomUUID(),
  otherClient: crypto.randomUUID(),
  property: crypto.randomUUID(),
  project: crypto.randomUUID(),
  secondaryProject: crypto.randomUUID(),
  budget: crypto.randomUUID(),
  secondaryBudget: crypto.randomUUID(),
  installment: crypto.randomUUID()
};

type Auth = { origin: string; headers: Record<string, string> };

async function unlockCurrent(page: Page): Promise<Auth | undefined> {
  await expect(page.getByRole('main')).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  if (!await heading.isVisible()) return;
  await page.getByLabel('Senha local').fill(PASSWORD);
  const unlockResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'));
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  const response = await unlockResponse;
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { token: string };
  const requestHeaders = await response.request().allHeaders();
  await expect(heading).not.toBeVisible();
  return {
    origin: new URL(response.url()).origin,
    headers: {
      ...Object.fromEntries(Object.entries(requestHeaders).filter(([key]) => key.toLowerCase() === 'x-api-token')),
      'x-local-session': payload.token
    }
  };
}

async function unlock(page: Page, target: string) {
  await page.goto(target);
  return unlockCurrent(page);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

const dateKey = (offset: number) => {
  return relativeDate(offset);
};

const dateLabel = (offset: number) => {
  const date = new Date(`${relativeDate(offset)}T12:00:00-03:00`);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

async function ensureProjectsFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(evidenceRoot, { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const existing = await database.execute({ sql: 'select id, cliente_id, propriedade_id from projetos where nome = ? limit 1', args: [`${PREFIX}Projeto Principal Açores`] });
    if (existing.rows.length > 0) {
      ids.project = String(existing.rows[0].id); ids.client = String(existing.rows[0].cliente_id); ids.property = String(existing.rows[0].propriedade_id);
      const client = await database.execute({ sql: 'select id from clientes where nome = ?', args: [`${PREFIX}Cliente Isolado`] }); ids.otherClient = String(client.rows[0].id);
      const secondary = await database.execute({ sql: 'select id from projetos where nome = ?', args: [`${PREFIX}Projeto Receita Maior`] }); ids.secondaryProject = String(secondary.rows[0].id);
      const budgets = await database.execute({ sql: 'select id, descricao from orcamentos where projeto_id in (?, ?)', args: [ids.project, ids.secondaryProject] });
      ids.budget = String(budgets.rows.find(row => row.descricao === `${PREFIX}Contrato principal`)!.id); ids.secondaryBudget = String(budgets.rows.find(row => row.descricao === `${PREFIX}Contrato secundário`)!.id);
      const installment = await database.execute({ sql: 'select id from parcelas where orcamento_id = ?', args: [ids.budget] }); ids.installment = String(installment.rows[0].id);
      return;
    }
    const now = relativeInstant();
    const projects = [
      { id: ids.project, name: `${PREFIX}Projeto Principal Açores`, status: 'Em Andamento', type: 'Rural', start: dateKey(-10), end: dateKey(20) },
      { id: ids.secondaryProject, name: `${PREFIX}Projeto Receita Maior`, status: 'Finalizado', type: 'Urbano', start: relativeDate(-60), end: relativeDate(-50) },
      { id: crypto.randomUUID(), name: `${PREFIX}Finalizado 20 dias`, status: 'Finalizado', type: 'Ambiental', start: relativeDate(-50), end: relativeDate(-30) },
      { id: crypto.randomUUID(), name: `${PREFIX}Finalizado 30 dias`, status: 'Finalizado', type: 'Licenciamento', start: relativeDate(-40), end: relativeDate(-10) },
      ...Array.from({ length: 3 }, (_, index) => ({ id: crypto.randomUUID(), name: `${PREFIX}Atrasado ${index + 1}`, status: 'Em Andamento', type: 'Perícia', start: dateKey(-30), end: dateKey(-index - 1) })),
      ...Array.from({ length: 3 }, (_, index) => ({ id: crypto.randomUUID(), name: `${PREFIX}Em andamento ${index + 1}`, status: 'Em Andamento', type: 'Comercial', start: dateKey(-5), end: dateKey(index + 5) })),
      { id: crypto.randomUUID(), name: `${PREFIX}Planejamento`, status: 'Planejamento', type: 'Industrial', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Em análise`, status: 'Em Análise', type: 'Ambiental', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Suspenso`, status: 'Suspenso', type: 'Institucional', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Cancelado`, status: 'Cancelado', type: 'Outro', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Aguardando cliente`, status: 'Aguardando Cliente', type: 'Rural', start: null, end: null }
    ];
    await database.batch([
      { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cpf, documento_normalizado, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PF', '52998224725', '52998224725', '52998224725', 'Florianópolis', 'SC', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente Principal`, now, now] },
      { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cnpj, documento_normalizado, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PJ', '11222333000181', '11222333000181', '11222333000181', 'São José', 'SC', 'Ativo', ?, ?)`, args: [ids.otherClient, `${PREFIX}Cliente Isolado`, now, now] },
      { sql: `insert into propriedades (id, cliente_id, nome, area_ha, matricula, car, municipio, cidade, uf, latitude, longitude, created_at, updated_at) values (?, ?, ?, 12.5, '12.345', 'SC-123', 'Florianópolis', 'Florianópolis', 'SC', -27.59, -48.55, ?, ?)`, args: [ids.property, ids.client, `${PREFIX}Fazenda Açores`, now, now] },
      ...projects.map((project, index) => ({ sql: `insert into projetos (id, cliente_id, propriedade_id, nome, status, tipo, data_inicio, data_entrega, area_ha, matricula, car, municipio, cidade, latitude, longitude, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Florianópolis', 'SC', -27.59, -48.55, ?, ?)`, args: [project.id, ids.client, project.id === ids.project ? ids.property : null, project.name, project.status, project.type, project.start, project.end, project.id === ids.project ? 12.5 : null, project.id === ids.project ? '12.345' : null, project.id === ids.project ? 'SC-123' : null, now, relativeInstant(index)] })),
      { sql: `insert into orcamentos (id, cliente_id, projeto_id, descricao, valor_total, custo_total_estimado, status, created_at, updated_at) values (?, ?, ?, ?, 10000, 4000, 'Aprovado', ?, ?)`, args: [ids.budget, ids.client, ids.project, `${PREFIX}Contrato principal`, now, now] },
      { sql: `insert into orcamentos (id, cliente_id, projeto_id, descricao, valor_total, custo_total_estimado, status, created_at, updated_at) values (?, ?, ?, ?, 20000, 0, 'Aprovado', ?, ?)`, args: [ids.secondaryBudget, ids.client, ids.secondaryProject, `${PREFIX}Contrato secundário`, now, now] },
      { sql: `insert into parcelas (id, orcamento_id, numero, valor, valor_pago, data_vencimento, status_pagamento, created_at, updated_at) values (?, ?, 1, 10000, 3000, ?, 'Parcial', ?, ?)`, args: [ids.installment, ids.budget, dateKey(20), now, now] },
      { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, categoria, status, created_at, updated_at) values (?, ?, ?, ?, 2500, ?, 'Campo', 'Pago', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, `${PREFIX}Custo ativo`, dateKey(-1), now, now] },
      { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, categoria, status, cancelada_em, created_at, updated_at) values (?, ?, ?, ?, 500, ?, 'Campo', 'Cancelado', ?, ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, `${PREFIX}Custo cancelado`, dateKey(-1), now, now, now] },
      { sql: `insert into notas_fiscais (id, cliente_id, projeto_id, numero, data_emissao, valor, status, created_at, updated_at) values (?, ?, ?, 'NFS-S05', ?, 7000, 'emitida', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, dateKey(-2), now, now] }
    ], 'write');
  } finally {
    database.close();
  }
}

test.describe('Sessão 05 — Projetos', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(240_000);

  test('rotas, fallback seguro, vazio e erro recuperável', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const auth = await unlock(page, '/projetos?visualizacao=invalida&pagina=1.5&porPagina=99&ordenar=invalida&situacao=invalida');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    await expect(page).toHaveURL(/visualizacao=lista/);
    await expect(page).not.toHaveURL(/pagina=|porPagina=|ordenar=|situacao=/);
    await expect(page.getByRole('heading', { name: 'Você ainda não possui projetos cadastrados' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.route('**/api/projetos?*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/projetos' && url.searchParams.get('mode') === 'page') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha controlada S05' }) });
      } else await route.continue();
    });
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar os projetos' })).toBeVisible();
    await page.unroute('**/api/projetos?*');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { name: 'Você ainda não possui projetos cadastrados' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '01-lista-vazia-recuperada.png'), fullPage: true });

    await page.goto('/operacional');
    await unlockCurrent(page);
    await expect(page).toHaveURL(/\/projetos\?visualizacao=estatisticas/);

    await page.goto('/projetos/id-invalido');
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o projeto' })).toBeVisible();

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    const projects = [
      { id: ids.project, name: `${PREFIX}Projeto Principal Açores`, status: 'Em Andamento', type: 'Rural', start: dateKey(-10), end: dateKey(20) },
      { id: ids.secondaryProject, name: `${PREFIX}Projeto Receita Maior`, status: 'Finalizado', type: 'Urbano', start: relativeDate(-60), end: relativeDate(-50) },
      { id: crypto.randomUUID(), name: `${PREFIX}Finalizado 20 dias`, status: 'Finalizado', type: 'Ambiental', start: relativeDate(-50), end: relativeDate(-30) },
      { id: crypto.randomUUID(), name: `${PREFIX}Finalizado 30 dias`, status: 'Finalizado', type: 'Licenciamento', start: relativeDate(-40), end: relativeDate(-10) },
      ...Array.from({ length: 3 }, (_, index) => ({ id: crypto.randomUUID(), name: `${PREFIX}Atrasado ${index + 1}`, status: 'Em Andamento', type: 'Perícia', start: dateKey(-30), end: dateKey(-index - 1) })),
      ...Array.from({ length: 3 }, (_, index) => ({ id: crypto.randomUUID(), name: `${PREFIX}Em andamento ${index + 1}`, status: 'Em Andamento', type: 'Comercial', start: dateKey(-5), end: dateKey(index + 5) })),
      { id: crypto.randomUUID(), name: `${PREFIX}Planejamento`, status: 'Planejamento', type: 'Industrial', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Em análise`, status: 'Em Análise', type: 'Ambiental', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Suspenso`, status: 'Suspenso', type: 'Institucional', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Cancelado`, status: 'Cancelado', type: 'Outro', start: null, end: null },
      { id: crypto.randomUUID(), name: `${PREFIX}Aguardando cliente`, status: 'Aguardando Cliente', type: 'Rural', start: null, end: null }
    ];
    try {
      await database.batch([
        { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cpf, documento_normalizado, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PF', '52998224725', '52998224725', '52998224725', 'Florianópolis', 'SC', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente Principal`, now, now] },
        { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cnpj, documento_normalizado, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PJ', '11222333000181', '11222333000181', '11222333000181', 'São José', 'SC', 'Ativo', ?, ?)`, args: [ids.otherClient, `${PREFIX}Cliente Isolado`, now, now] },
        { sql: `insert into propriedades (id, cliente_id, nome, area_ha, matricula, car, municipio, cidade, uf, latitude, longitude, created_at, updated_at) values (?, ?, ?, 12.5, '12.345', 'SC-123', 'Florianópolis', 'Florianópolis', 'SC', -27.59, -48.55, ?, ?)`, args: [ids.property, ids.client, `${PREFIX}Fazenda Açores`, now, now] },
        ...projects.map((project, index) => ({
          sql: `insert into projetos (id, cliente_id, propriedade_id, nome, status, tipo, data_inicio, data_entrega, area_ha, matricula, car, municipio, cidade, latitude, longitude, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Florianópolis', 'SC', -27.59, -48.55, ?, ?)`,
          args: [project.id, ids.client, project.id === ids.project ? ids.property : null, project.name, project.status, project.type, project.start, project.end, project.id === ids.project ? 12.5 : null, project.id === ids.project ? '12.345' : null, project.id === ids.project ? 'SC-123' : null, now, relativeInstant(index)]
        })),
        { sql: `insert into orcamentos (id, cliente_id, projeto_id, descricao, valor_total, custo_total_estimado, status, created_at, updated_at) values (?, ?, ?, ?, 10000, 4000, 'Aprovado', ?, ?)`, args: [ids.budget, ids.client, ids.project, `${PREFIX}Contrato principal`, now, now] },
        { sql: `insert into orcamentos (id, cliente_id, projeto_id, descricao, valor_total, custo_total_estimado, status, created_at, updated_at) values (?, ?, ?, ?, 20000, 0, 'Aprovado', ?, ?)`, args: [ids.secondaryBudget, ids.client, ids.secondaryProject, `${PREFIX}Contrato secundário`, now, now] },
        { sql: `insert into parcelas (id, orcamento_id, numero, valor, valor_pago, data_vencimento, status_pagamento, created_at, updated_at) values (?, ?, 1, 10000, 3000, ?, 'Parcial', ?, ?)`, args: [ids.installment, ids.budget, dateKey(20), now, now] },
        { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, categoria, status, created_at, updated_at) values (?, ?, ?, ?, 2500, ?, 'Campo', 'Pago', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, `${PREFIX}Custo ativo`, dateKey(-1), now, now] },
        { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, categoria, status, cancelada_em, created_at, updated_at) values (?, ?, ?, ?, 500, ?, 'Campo', 'Cancelado', ?, ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, `${PREFIX}Custo cancelado`, dateKey(-1), now, now, now] },
        { sql: `insert into notas_fiscais (id, cliente_id, projeto_id, numero, data_emissao, valor, status, created_at, updated_at) values (?, ?, ?, 'NFS-S05', ?, 7000, 'emitida', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, dateKey(-2), now, now] }
      ], 'write');
    } finally {
      database.close();
    }
    const currentProject = await page.request.get(`${auth.origin}/api/projetos/${ids.project}`, { headers: auth.headers });
    expect(currentProject.ok()).toBe(true);
    const { updatedAt } = await currentProject.json();
    const invalidation = await page.request.patch(`${auth.origin}/api/projetos/${ids.project}`, {
      headers: { ...auth.headers, 'x-record-version': updatedAt },
      data: { observacoes: `${PREFIX}seed validado` }
    });
    expect(invalidation.ok(), await invalidation.text()).toBe(true);
  });

  test('lista, grade, filtros, paginação e estatísticas conhecidas', async ({ page }) => {
    await ensureProjectsFixture();
    await unlock(page, '/projetos?visualizacao=lista&porPagina=12');
    const pagination = page.getByLabel('Paginação de projetos');
    await expect(pagination.getByText('Exibindo 1–12 de 15 projetos')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Página 2' })).toBeVisible();

    await page.getByLabel('Buscar projetos').fill('Principal Açores');
    await expect(page.getByText(`${PREFIX}Projeto Principal Açores`).first()).toBeVisible();
    await expect(page.getByLabel('Busca e filtros de projetos').locator('p[tabindex="-1"]')).toContainText('Exibindo 1–1 de 1 projeto');
    await page.getByRole('button', { name: 'Limpar busca' }).click();

    await page.getByRole('tab', { name: 'Grade' }).click();
    await expect(page).toHaveURL(/visualizacao=grade/);
    await expect(page.getByRole('heading', { name: `${PREFIX}Aguardando cliente` })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('tab', { name: 'Estatísticas' }).click();
    await expect(page).toHaveURL(/visualizacao=estatisticas/);
    await expect(page.getByText('20%').first()).toBeVisible();
    await expect(page.getByText(/20 dias/).first()).toBeVisible();
    await expect(page.getByText('R$ 150,00').first()).toBeVisible();
    await expect(page.getByText(`${PREFIX}Projeto Principal Açores`).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-estatisticas-calculos.png'), fullPage: true });

    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-estatisticas-mobile.png'), fullPage: true });
  });

  test('detalhe, checklist, documentos e contexto financeiro', async ({ page }) => {
    await ensureProjectsFixture();
    await unlock(page, `/projetos/${ids.project}?aba=invalida`);
    await expect(page).toHaveURL(/aba=checklist/);
    await expect(page.getByRole('heading', { name: `${PREFIX}Projeto Principal Açores` })).toBeVisible();
    await expect(page.getByText('12,5 ha').first()).toBeVisible();

    await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
    await page.getByLabel('Título').fill(`${PREFIX}Emitir memorial`);
    await page.getByLabel('Prioridade').click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await page.getByLabel('Data limite').click();
    await page.getByRole('gridcell', { name: dateLabel(-1), exact: true }).click();
    await page.getByRole('button', { name: 'Criar tarefa' }).click();
    await expect(page.getByText(`${PREFIX}Emitir memorial`, { exact: true })).toBeVisible();
    await expect(page.getByText(/Atrasada/)).toBeVisible();
    const completion = page.getByLabel(`Marcar ${PREFIX}Emitir memorial como concluída`);
    await completion.focus();
    await completion.press('Space');
    await expect(page.getByText('1 de 1 concluídas', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: /Documentos/ }).click();
    await expect(page).toHaveURL(/aba=documentos/);
    const uploadPath = path.join(process.env.GEOGESTOR_E2E_ROOT!, 'QA-S05-acento.PDF');
    await fs.writeFile(uploadPath, '%PDF-1.4\n% GeoGestor QA S05\n%%EOF\n');
    await page.locator('#file-upload').setInputFiles(uploadPath);
    await expect(page.getByText('QA-S05-acento.PDF')).toBeVisible();

    await page.getByRole('tab', { name: /Financeiro/ }).click();
    await expect(page).toHaveURL(/aba=financeiro/);
    for (const amount of ['R$ 100,00', 'R$ 70,00', 'R$ 30,00', 'R$ 25,00']) {
      await expect(page.getByText(amount, { exact: true }).first()).toBeVisible();
    }
    const costWidget = page.getByRole('region', { name: 'Custo do projeto', exact: true });
    await expect(costWidget.getByText('Custo previsto R$ 40,00', { exact: true })).toBeVisible();
    const executedCostCard = page.getByText('Custo total executado no projeto', { exact: true }).locator('..');
    await expect(executedCostCard.getByText('R$ 25,00', { exact: true })).toBeVisible();
    await expect(executedCostCard.getByText('R$ 30,00', { exact: true })).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(evidenceRoot, '04-detalhe-financeiro.png'), fullPage: true });

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT!;
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    try {
      const task = await database.execute({ sql: 'select status, prioridade, data_limite from tarefas where titulo = ?', args: [`${PREFIX}Emitir memorial`] });
      expect(task.rows[0]).toMatchObject({ status: 'Concluído', prioridade: 'Alta', data_limite: dateKey(-1) });
      const context = await database.execute({ sql: 'select count(*) as total from documentos where projeto_id = ? and deleted_at is null', args: [ids.project] });
      expect(Number(context.rows[0].total)).toBe(1);
    } finally {
      database.close();
    }
  });
});
