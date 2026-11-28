import { selectCalendarDate } from './support/calendar-assertions';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test';
import { e2eEvidenceRoot, e2eReferenceDate, relativeDate } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S01-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

function dateKey(offsetDays = 0) {
  return relativeDate(offsetDays);
}

function monthBoundary() {
  const today = new Date(`${e2eReferenceDate()}T12:00:00-03:00`);
  return dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0, 12).getDate() - today.getDate());
}

async function chooseDate(page: Page, fieldLabel: string, value: string) {
  await page.getByLabel(fieldLabel, { exact: true }).click();
  await selectCalendarDate(page.getByRole('dialog', { name: /^Selecionar data/ }), value);
}

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

async function reloadUnlocked(page: Page, expectedHeading: string) {
  await page.reload();
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const destinationHeading = page.getByRole('heading', { name: expectedHeading });
  await expect(unlockHeading.or(destinationHeading)).toBeVisible();
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(destinationHeading).toBeVisible();
}

async function authenticatedApi(dashboardRequest: Promise<Request>) {
  const request = await dashboardRequest;
  const requestHeaders = await request.allHeaders();
  return {
    origin: new URL(request.url()).origin,
    headers: Object.fromEntries(
      Object.entries(requestHeaders).filter(([name]) => ['x-api-token', 'x-local-session'].includes(name.toLowerCase())),
    ),
  };
}

async function postJson(api: APIRequestContext, origin: string, headers: Record<string, string>, route: string, data: unknown) {
  const response = await api.post(`${origin}${route}`, { headers, data });
  expect(response.status(), `${route}: ${await response.text()}`).toBeLessThan(400);
  return response.json();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test('Sessão 01 — painel e ciclo integrado de tarefas', async ({ page, request }) => {
  test.setTimeout(180_000);
  await fs.mkdir(evidenceRoot, { recursive: true });
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const invalidDashboardRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/dashboard/overview') && request.url().includes('tasksInicio') && request.url().includes('tasksFim')) {
      const url = new URL(request.url());
      if ((url.searchParams.get('tasksInicio') ?? '') > (url.searchParams.get('tasksFim') ?? '')) invalidDashboardRequests.push(request.url());
    }
  });

  const initialDashboardRequest = page.waitForRequest('**/api/dashboard/overview?**');
  await unlock(page);
  await expect(page.getByText('Sem tarefas com prazo neste período.')).toBeVisible();
  await expect(page.getByText('Nenhum projeto neste escopo.')).toBeVisible();
  await expect(page.getByText('Nenhum vencimento pendente para os próximos dias.')).toBeVisible();
  await page.screenshot({ path: path.join(evidenceRoot, '01-dashboard-vazio.png'), fullPage: true });
  await expectNoAxeViolations(page);

  const auth = await authenticatedApi(initialDashboardRequest);
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  const clientId = crypto.randomUUID();
  const activeProjectId = crypto.randomUUID();
  const completedProjectId = crypto.randomUUID();
  const pendingTaskId = crypto.randomUUID();
  const overdueTaskId = crypto.randomUUID();
  const completedTaskId = crypto.randomUUID();
  const budgetId = crypto.randomUUID();

  try {
    await database.batch([
      { sql: 'insert into clientes (id, nome, tipo_pessoa, situacao) values (?, ?, ?, ?)', args: [clientId, `${PREFIX}Cliente`, 'PF', 'Ativo'] },
      { sql: 'insert into projetos (id, cliente_id, nome, tipo, status, area_ha) values (?, ?, ?, ?, ?, ?)', args: [activeProjectId, clientId, `${PREFIX}Projeto ativo`, 'Topografia', 'Em Andamento', 123.45] },
      { sql: 'insert into projetos (id, cliente_id, nome, tipo, status, area_ha) values (?, ?, ?, ?, ?, ?)', args: [completedProjectId, clientId, `${PREFIX}Projeto concluído`, 'Ambiental', 'Concluído', 500] },
      { sql: 'insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite) values (?, ?, ?, ?, ?, ?, ?)', args: [pendingTaskId, clientId, activeProjectId, `${PREFIX}Pendente`, 'A Fazer', 'Média', dateKey(1)] },
      { sql: 'insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite) values (?, ?, ?, ?, ?, ?, ?)', args: [overdueTaskId, clientId, activeProjectId, `${PREFIX}Atrasada`, 'Em Progresso', 'Alta', dateKey(-1)] },
      { sql: 'insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite) values (?, ?, ?, ?, ?, ?, ?)', args: [completedTaskId, clientId, activeProjectId, `${PREFIX}Concluída`, 'Concluído', 'Baixa', dateKey()] },
      { sql: 'insert into orcamentos (id, cliente_id, projeto_id, descricao, valor_total, status, data_orcamento, data_competencia, data_pagamento) values (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [budgetId, clientId, activeProjectId, `${PREFIX}Receita`, 10_000, 'pago', dateKey(), dateKey(), dateKey()] },
      { sql: 'insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, data_competencia, data_pagamento, categoria, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [crypto.randomUUID(), clientId, activeProjectId, `${PREFIX}Despesa`, 4_000, dateKey(), dateKey(), dateKey(), 'Campo', 'Pago'] },
    ], 'write');

    const boundaryTask = await postJson(request, auth.origin, auth.headers, '/api/tarefas', {
      projetoId: activeProjectId,
      titulo: `${PREFIX}Limite do período`,
      descricao: 'Tarefa sintética no último dia do mês.',
      prioridade: 'Média',
      dataLimite: monthBoundary(),
      status: 'A Fazer',
    }) as { id: string };

    await reloadUnlocked(page, 'Visão Geral');
    const indicators = page.getByLabel('Indicadores gerais');
    await expect(indicators).toContainText('Clientes');
    await expect(indicators).toContainText('01');
    await expect(indicators).toContainText('Projetos');
    await expect(indicators).toContainText('02');
    await expect(indicators).toContainText('123,5');
    await expect(indicators).toContainText('25%');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('1 concluída');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('4 no período');
    await expect(page.getByText(`${PREFIX}Atrasada`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${PREFIX}Concluída`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: `Abrir tarefa: ${PREFIX}Limite do período` })).toBeVisible();
    await expect(page.getByText('1 projeto ativo, agrupados por categoria.', { exact: true })).toBeVisible();
    await expect(page.getByText('R$ 60,00', { exact: true }).first()).toBeVisible();

    const cashFlowChart = page.locator('.recharts-wrapper').first();
    const cashFlowBox = await cashFlowChart.boundingBox();
    if (!cashFlowBox) throw new Error('Gráfico de fluxo de caixa não foi renderizado.');
    await cashFlowChart.hover({ position: { x: cashFlowBox.width / 2, y: cashFlowBox.height / 2 } });
    await expect(page.getByText('Recebimentos', { exact: true })).toBeVisible();
    await expect(page.getByText('Pagamentos', { exact: true })).toBeVisible();
    await page.mouse.move(0, 0);

    await page.getByRole('button', { name: /^Notificações:/ }).click();
    const alertsDialog = page.getByRole('dialog', { name: 'Alertas e prazos' });
    await expect(alertsDialog).toContainText(`${PREFIX}Atrasada`);
    await alertsDialog.getByLabel('Filtrar alertas por período').click();
    await page.getByRole('option', { name: 'Vencidos', exact: true }).click();
    await expect(alertsDialog).toContainText(`${PREFIX}Atrasada`);
    await expect(alertsDialog).not.toContainText(`${PREFIX}Pendente`);
    await page.keyboard.press('Escape');

    await page.getByLabel('Escopo da distribuição de projetos').click();
    await page.getByRole('option', { name: 'Todos os projetos', exact: true }).click();
    await expect(page).toHaveURL(/projetosEscopo=all/);
    await expect(page.getByText('Todos os projetos · 2 cadastrados')).toBeVisible();
    await page.getByRole('button', { name: 'Unitário' }).click();
    await expect(page).toHaveURL(/projetosAgrupamento=unitario/);
    await expect(page.getByLabel('Filtrar distribuição por tipo de projeto')).toBeVisible();
    await page.getByLabel('Filtrar distribuição por tipo de projeto').click();
    await page.getByRole('option', { name: 'Ambiental', exact: true }).click();
    await expect(page).toHaveURL(/projetosTipo=Ambiental/);
    await expect(page.getByText('1 projeto do tipo Ambiental, agrupados por status.')).toBeVisible();
    await page.getByLabel('Filtrar distribuição por tipo de projeto').click();
    await page.getByRole('option', { name: 'Topografia', exact: true }).click();
    const distribution = page.getByRole('article', { name: 'Distribuição de projetos', exact: true });
    const projectStatus = distribution.getByRole('listitem').filter({ hasText: 'Em Andamento' });
    await expect(projectStatus).toContainText('100% · 1 projeto');
    await expect(distribution.getByRole('link', { name: 'Ver projetos' })).toHaveAttribute('href', '/projetos');
    await reloadUnlocked(page, 'Visão Geral');
    await expect(page.getByRole('button', { name: 'Unitário' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel('Período da taxa de conclusão').click();
    await page.getByRole('option', { name: 'Personalizado', exact: true }).click();
    await chooseDate(page, 'Data inicial', dateKey(1));
    await chooseDate(page, 'Data final', dateKey(-1));
    await expect(page.getByRole('alert')).toContainText('A data inicial não pode ser posterior à data final.');
    expect(invalidDashboardRequests).toEqual([]);
    await expect(page).toHaveURL(/tarefasPeriodo=custom/);
    await chooseDate(page, 'Data inicial', dateKey(-1));
    await chooseDate(page, 'Data final', monthBoundary());
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('1 concluída');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('4 no período');
    await reloadUnlocked(page, 'Visão Geral');
    await expect(page.getByLabel('Período da taxa de conclusão')).toContainText('Personalizado');

    await page.getByText('Ver composição', { exact: true }).click();
    await expect(page.getByText('R$ 60,00', { exact: true }).last()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(evidenceRoot, '02-dashboard-populado-claro.png'), fullPage: true });
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-dashboard-populado-escuro.png'), fullPage: true });

    await page.setViewportSize({ width: 360, height: 800 });
    const mobileMenuButton = page.getByRole('button', { name: 'Abrir menu de navegação' });
    await expect(mobileMenuButton).toBeVisible();
    await page.waitForTimeout(350);
    await mobileMenuButton.click();
    await expect(page.getByRole('button', { name: 'Fechar menu de navegação' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await page.locator('aside').boundingBox())?.x ?? 0).toBeLessThan(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: path.join(evidenceRoot, '04-dashboard-360px.png'), fullPage: true });
    await page.setViewportSize({ width: 1120, height: 680 });
    for (const width of [768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1120, height: 680 });

    await page.getByRole('link', { name: `Abrir tarefa: ${PREFIX}Pendente` }).click();
    await expect(page.getByRole('heading', { name: 'Tarefas' })).toBeVisible();
    await expect(page.getByText(`${PREFIX}Pendente`, { exact: true })).toBeVisible();
    for (const title of ['Atrasada', 'Concluída', 'Limite do período']) {
      await expect(page.getByText(`${PREFIX}${title}`, { exact: true })).toBeVisible();
    }
    await expect.poll(() => new URL(page.url()).searchParams.get('tarefaId')).toBeNull();
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Nova tarefa' }).click();
    await expect(page.getByLabel('Título da tarefa')).toBeFocused();
    expect(await page.getByLabel('Título da tarefa').evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
    await page.getByLabel('Título da tarefa').fill(`${PREFIX}Rascunho`);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Nova tarefa' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Nova tarefa' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova tarefa' })).toBeFocused();

    await page.getByRole('button', { name: 'Nova tarefa' }).click();
    await page.getByLabel('Título da tarefa').fill(`${PREFIX}CRUD`);
    await page.getByLabel('Projeto').click();
    await page.getByRole('option', { name: new RegExp(`${PREFIX}Projeto ativo`) }).click();
    await page.getByRole('combobox', { name: 'Prioridade', exact: true }).click();
    await page.getByRole('option', { name: 'Alta', exact: true }).click();
    await chooseDate(page, 'Data limite', dateKey());
    await page.getByLabel('Descrição').fill('Descrição sintética com acentuação: ação, imóvel e órgão.');
    await page.getByRole('button', { name: 'Criar tarefa' }).click();
    await expect(page.getByText(`${PREFIX}CRUD`, { exact: true })).toBeVisible();
    const createdTask = await database.execute({
      sql: 'select projeto_id, prioridade, data_limite, descricao from tarefas where titulo = ?',
      args: [`${PREFIX}CRUD`],
    });
    expect(createdTask.rows).toHaveLength(1);
    expect(createdTask.rows[0]?.projeto_id).toBe(activeProjectId);
    expect(createdTask.rows[0]?.prioridade).toBe('Alta');
    expect(createdTask.rows[0]?.data_limite).toBe(dateKey());
    expect(createdTask.rows[0]?.descricao).toBe('Descrição sintética com acentuação: ação, imóvel e órgão.');

    await page.getByRole('button', { name: `Editar tarefa: ${PREFIX}CRUD`, exact: true }).click();
    await page.getByLabel('Título da tarefa').fill(`${PREFIX}CRUD editada`);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText(`${PREFIX}CRUD editada`, { exact: true })).toBeVisible();
    await reloadUnlocked(page, 'Tarefas');
    await expect(page.getByText(`${PREFIX}CRUD editada`, { exact: true })).toBeVisible();
    const editedTaskCard = page.locator('[data-task-id]').filter({ hasText: `${PREFIX}CRUD editada` });
    await expect(editedTaskCard.getByText(new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateKey()}T12:00:00`)))).toBeVisible();

    await page.route(`**/api/tarefas/**`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha sintética' }) });
      } else await route.continue();
    }, { times: 1 });
    const consoleErrorCountBeforeExpectedFailure = consoleErrors.length;
    await page.getByRole('button', { name: `Concluir tarefa: ${PREFIX}CRUD editada`, exact: true }).click();
    await expect(page.getByText('A alteração foi desfeita.')).toBeVisible();
    await expect(page.getByRole('button', { name: `Concluir tarefa: ${PREFIX}CRUD editada`, exact: true })).toBeVisible();
    await expect.poll(() => consoleErrors.length).toBeGreaterThan(consoleErrorCountBeforeExpectedFailure);
    const expectedFailureErrors = consoleErrors.splice(consoleErrorCountBeforeExpectedFailure);
    expect(expectedFailureErrors).toEqual([
      'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
    ]);

    await page.getByRole('button', { name: `Concluir tarefa: ${PREFIX}CRUD editada`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Reabrir tarefa: ${PREFIX}CRUD editada`, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Visão Geral', exact: true }).click();
    await expect(indicators).toContainText('40%');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('2 concluídas');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('5 no período');

    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.getByRole('link', { name: 'Tarefas', exact: true }).click();
    await page.getByRole('button', { name: `Reabrir tarefa: ${PREFIX}CRUD editada`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Concluir tarefa: ${PREFIX}CRUD editada`, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Visão Geral', exact: true }).click();
    await expect(indicators).toContainText('20%');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('1 concluída');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('5 no período');
    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.getByRole('link', { name: 'Tarefas', exact: true }).click();

    await page.getByRole('button', { name: `Excluir tarefa: ${PREFIX}CRUD editada`, exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText(`${PREFIX}CRUD editada`);
    const taskIdToDelete = await page.locator('[data-task-id]').filter({ hasText: `${PREFIX}CRUD editada` }).getAttribute('data-task-id');
    expect(taskIdToDelete).toMatch(/^[0-9a-f-]{36}$/);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(`${PREFIX}CRUD editada`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Excluir tarefa: ${PREFIX}CRUD editada`, exact: true }).click();
    await page.getByRole('button', { name: 'Excluir tarefa', exact: true }).click();
    await expect(page.getByText(`${PREFIX}CRUD editada`, { exact: true })).toHaveCount(0);

    const deletedTask = await database.execute({
      sql: 'select deleted_at from tarefas where id = ? and titulo = ?',
      args: [taskIdToDelete!, `${PREFIX}CRUD editada`],
    });
    expect(String(deletedTask.rows[0]?.deleted_at || '')).not.toBe('');
    const visibleTasks = await request.get(`${auth.origin}/api/tarefas?mode=page&q=${encodeURIComponent(`${PREFIX}CRUD editada`)}`, { headers: auth.headers });
    expect((await visibleTasks.json() as { total: number }).total).toBe(0);
    await reloadUnlocked(page, 'Tarefas');
    await expect(page.getByText(`${PREFIX}CRUD editada`, { exact: true })).toHaveCount(0);

    await page.getByRole('link', { name: 'Visão Geral', exact: true }).click();
    await expect(indicators).toContainText('25%');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('1 concluída');
    await expect(page.getByRole('region', { name: 'Tarefas concluídas', exact: true })).toContainText('4 no período');
    await expect(page.getByRole('tab', { name: 'Tarefas' })).toBeVisible();
    await page.getByRole('tab', { name: 'Tarefas' }).click();
    await expect(page.getByText('removeu a tarefa').first()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '05-dashboard-apos-crud.png'), fullPage: true });

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    expect(failedResponses.filter((entry) => !entry.includes('/api/tarefas/')), failedResponses.join('\n')).toEqual([]);
    expect(boundaryTask.id).toMatch(/^[0-9a-f-]{36}$/);
  } finally {
    database.close();
  }
});
