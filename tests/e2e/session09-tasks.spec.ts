import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S09-20260913-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

const ids = {
  clients: [crypto.randomUUID(), crypto.randomUUID()],
  projects: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  directTask: crypto.randomUUID(),
  legacyTask: crypto.randomUUID(),
  secondPageTask: crypto.randomUUID()
};

type Auth = { origin: string; headers: Record<string, string> };

function dateKey(offsetDays = 0) {
  return relativeDate(offsetDays);
}

async function unlockCurrent(page: Page): Promise<Auth | undefined> {
  await expect(page.getByRole('main')).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  if (!await heading.isVisible()) return;
  await page.getByLabel('Senha local').fill(PASSWORD);
  const unlockResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'));
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  const response = await unlockResponse;
  const payload = await response.json() as { token: string };
  const requestHeaders = await response.request().allHeaders();
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
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function batchWithLockRetry(database: ReturnType<typeof createClient>, statements: Parameters<typeof database.batch>[0]) {
  await database.execute('PRAGMA busy_timeout = 10000');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await database.batch(statements, 'write');
      return;
    } catch (error) {
      if (!String(error).includes('database is locked') || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }
}

async function ensureTasksJourneyFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(evidenceRoot, { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const existing = await database.execute({ sql: 'select id from projetos where id = ? limit 1', args: [ids.projects[0]] });
    if (existing.rows.length > 0) return;
    const now = relativeInstant(-1).replace('T', ' ').replace(/\.\d{3}Z$/, '');
    const volume = Array.from({ length: 101 }, (_, index) => ({
      id: index === 100 ? ids.secondPageTask : crypto.randomUUID(),
      title: `${PREFIX}Volume ${String(index).padStart(3, '0')}`,
      description: index === 0 ? 'Memorial descritivo especial' : '',
      status: (['A Fazer', 'Em Progresso', 'Concluído'] as const)[index % 3],
      priority: (['Baixa', 'Média', 'Alta'] as const)[index % 3],
      due: index === 0 ? dateKey(-1) : index === 1 ? dateKey() : index === 2 ? dateKey(1) : ''
    }));
    await batchWithLockRetry(database, [
      { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [ids.clients[0], `${PREFIX}Cliente Açores`, now, now] },
      { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PF', 'Ativo', ?, ?)`, args: [ids.clients[1], `${PREFIX}Cliente B`, now, now] },
      { sql: `insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?)`, args: [ids.projects[0], ids.clients[0], `${PREFIX}Projeto São José`, now, now] },
      { sql: `insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?)`, args: [ids.projects[1], ids.clients[1], `${PREFIX}Projeto B`, now, now] },
      { sql: `insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?)`, args: [ids.projects[2], ids.clients[0], `${PREFIX}Projeto vazio`, now, now] },
      { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, descricao, status, prioridade, data_limite, created_at, updated_at) values (?, ?, null, ?, ?, 'A Fazer', 'Baixa', ?, ?, ?)`, args: [ids.directTask, ids.clients[0], `${PREFIX}Tarefa direta`, 'Somente cliente', dateKey(), now, now] },
      { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, descricao, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, '', 'Aguardando terceiro', 'Urgente', '', ?, ?)`, args: [ids.legacyTask, ids.clients[0], ids.projects[0], `${PREFIX}Status legado`, now, now] },
      ...volume.map((row) => ({ sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, descricao, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [row.id, ids.clients[0], ids.projects[0], row.title, row.description, row.status, row.priority, row.due, now, now] }))
    ]);
  } finally {
    database.close();
  }
}

test.describe('Sessão 09 — Agenda — Tarefas', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(240_000);

  test('reconcilia 101+, busca composta, paginação, deep link e status legado', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const auth = await unlock(page, '/tarefas');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    const volume = Array.from({ length: 101 }, (_, index) => ({
      id: index === 100 ? ids.secondPageTask : crypto.randomUUID(),
      title: `${PREFIX}Volume ${String(index).padStart(3, '0')}`,
      description: index === 0 ? 'Memorial descritivo especial' : '',
      status: (['A Fazer', 'Em Progresso', 'Concluído'] as const)[index % 3],
      priority: (['Baixa', 'Média', 'Alta'] as const)[index % 3],
      due: index === 0 ? dateKey(-1) : index === 1 ? dateKey() : index === 2 ? dateKey(1) : ''
    }));
    try {
      await batchWithLockRetry(database, [
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [ids.clients[0], `${PREFIX}Cliente Açores`, now, now] },
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PF', 'Ativo', ?, ?)`, args: [ids.clients[1], `${PREFIX}Cliente B`, now, now] },
        { sql: `insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?)`, args: [ids.projects[0], ids.clients[0], `${PREFIX}Projeto São José`, now, now] },
        { sql: `insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?)`, args: [ids.projects[1], ids.clients[1], `${PREFIX}Projeto B`, now, now] },
        { sql: `insert into projetos (id, cliente_id, nome, status, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?)`, args: [ids.projects[2], ids.clients[0], `${PREFIX}Projeto vazio`, now, now] },
        { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, descricao, status, prioridade, data_limite, created_at, updated_at) values (?, ?, null, ?, ?, 'A Fazer', 'Baixa', ?, ?, ?)`, args: [ids.directTask, ids.clients[0], `${PREFIX}Tarefa direta`, 'Somente cliente', dateKey(), now, now] },
        { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, descricao, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, '', 'Aguardando terceiro', 'Urgente', '', ?, ?)`, args: [ids.legacyTask, ids.clients[0], ids.projects[0], `${PREFIX}Status legado`, now, now] },
        ...volume.map((row) => ({
          sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, descricao, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [row.id, ids.clients[0], ids.projects[0], row.title, row.description, row.status, row.priority, row.due, now, now]
        }))
      ]);
    } finally {
      database.close();
    }

    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByText(/100 tarefas exibidas nesta página · 103 tarefas no conjunto filtrado/)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Paginação de tarefas' })).toContainText('Página 1 de 2');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText(/3 tarefas exibidas nesta página · 103 tarefas no conjunto filtrado/)).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar tarefas' }).fill('memorial descritivo');
    await expect(page.getByText(/1 tarefa exibida nesta página · 1 tarefa no conjunto filtrado/)).toBeVisible();
    await expect(page.getByText(`${PREFIX}Volume 000`, { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar tarefas' }).fill('sao jose');
    await expect(page.getByText(/102 tarefas no conjunto filtrado/)).toBeVisible();

    await page.goto(`/tarefas?tarefaId=${ids.secondPageTask}`);
    await unlockCurrent(page);
    const deepLinkedCard = page.locator(`[data-task-id="${ids.secondPageTask}"]`);
    await expect(deepLinkedCard).toBeVisible();
    await expect(deepLinkedCard).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('tarefaId'), { timeout: 6_000 }).toBeNull();
    await expect(page.getByRole('searchbox', { name: 'Buscar tarefas' })).toHaveValue('');

    await page.goto(`/tarefas?tarefaId=${ids.legacyTask}`);
    await unlockCurrent(page);
    await expect(page.getByText(`Status legado: Aguardando terceiro · exibida em A Fazer`)).toBeVisible();
    await expect(page.getByText('Prioridade legada: Urgente')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-kanban-paginacao-legado.png'), fullPage: true });
  });

  test('exercita CRUD, descarte, rollback otimista, conclusão, reabertura e soft delete', async ({ page, request }) => {
    await ensureTasksJourneyFixture();
    const auth = await unlock(page, '/tarefas');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    const title = `${PREFIX}CRUD interface`;
    await page.getByRole('button', { name: 'Nova tarefa' }).click();
    await page.getByLabel('Título da tarefa').fill(`${PREFIX}Rascunho`);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Nova tarefa' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Nova tarefa' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Nova tarefa' }).click();
    await page.getByLabel('Título da tarefa').fill(title);
    await page.getByLabel('Projeto').click();
    await page.getByRole('option', { name: new RegExp(`${PREFIX}Projeto B`) }).click();
    await page.getByRole('combobox', { name: 'Prioridade', exact: true }).click();
    await page.getByRole('option', { name: 'Alta', exact: true }).click();
    await page.getByLabel('Descrição').fill('<script>inerte()</script> descrição com emoji 🧭');
    await page.getByRole('button', { name: 'Criar tarefa' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Editar tarefa: ${title}` }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Editar tarefa' })).toHaveCount(0);

    await page.route(`**/api/tarefas/**`, async (route) => {
      if (route.request().method() === 'PATCH') await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha controlada S09"}' });
      else await route.continue();
    }, { times: 1 });
    await page.getByRole('button', { name: `Concluir tarefa: ${title}` }).click();
    await expect(page.getByText('A alteração foi desfeita.')).toBeVisible();
    await expect(page.getByRole('button', { name: `Concluir tarefa: ${title}` })).toBeVisible();
    await page.getByRole('button', { name: `Concluir tarefa: ${title}` }).click();
    await expect(page.getByRole('button', { name: `Reabrir tarefa: ${title}` })).toBeVisible();
    await page.getByRole('button', { name: `Reabrir tarefa: ${title}` }).click();
    await expect(page.getByRole('button', { name: `Concluir tarefa: ${title}` })).toBeVisible();

    await page.getByRole('button', { name: `Excluir tarefa: ${title}` }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Excluir tarefa: ${title}` }).click();
    await page.getByRole('button', { name: 'Excluir tarefa', exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    const list = await request.get(`${auth.origin}/api/tarefas?mode=page&q=${encodeURIComponent(title)}`, { headers: auth.headers });
    expect((await list.json() as { total: number }).total).toBe(0);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-crud-transicoes-exclusao.png'), fullPage: true });
  });

  test('gerencia modelos, aplica idempotente e reconcilia projeto, cliente, calendário, painel e alertas', async ({ page, request }) => {
    await ensureTasksJourneyFixture();
    const auth = await unlock(page, '/configuracoes?secao=modelos');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    await expect(page.getByRole('heading', { name: 'Modelos de checklist' })).toBeVisible();
    await page.getByRole('button', { name: 'Novo modelo' }).click();
    await page.getByLabel('Nome *').fill(`${PREFIX}Modelo interface`);
    await page.getByLabel('Tipo de projeto').fill('Topografia');
    await page.getByLabel('Título *').fill('Conferir matrícula');
    await page.getByRole('button', { name: 'Adicionar etapa' }).click();
    await page.getByLabel('Título *').nth(1).fill('Emitir relatório final');
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    const modelCard = page.locator('article').filter({ hasText: `${PREFIX}Modelo interface` }).first();
    await expect(modelCard).toContainText('2 etapa(s)');
    await modelCard.getByRole('button', { name: 'Duplicar' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar modelo de checklist' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Editar modelo de checklist' })).toHaveCount(0);

    const modelsResponse = await request.get(`${auth.origin}/api/tarefas/modelos`, { headers: auth.headers });
    const models = await modelsResponse.json() as Array<{ id: string; nome: string }>;
    const model = models.find((item) => item.nome === `${PREFIX}Modelo interface`);
    expect(model).toBeTruthy();
    const first = await request.post(`${auth.origin}/api/tarefas/modelos/${model?.id}/aplicar`, { headers: auth.headers, data: { projetoId: ids.projects[2] } });
    const second = await request.post(`${auth.origin}/api/tarefas/modelos/${model?.id}/aplicar`, { headers: auth.headers, data: { projetoId: ids.projects[2] } });
    expect(await first.json()).toMatchObject({ criadas: 2, ignoradas: 0 });
    expect(await second.json()).toMatchObject({ criadas: 0, ignoradas: 2 });

    await page.goto(`/projetos/${ids.projects[0]}?aba=checklist`);
    await unlockCurrent(page);
    await expect(page.getByText(/33 de 102 concluídas · 32% · 100 exibidas nesta página/)).toBeVisible();
    await page.goto(`/clientes/${ids.clients[0]}`);
    await unlockCurrent(page);
    await expect(page.getByText(`${PREFIX}Tarefa direta`, { exact: true })).toBeVisible();

    const taskCreate = await request.post(`${auth.origin}/api/tarefas`, { headers: auth.headers, data: {
      projetoId: ids.projects[1], titulo: `${PREFIX}Integrações`, dataLimite: dateKey(), prioridade: 'Alta'
    } });
    const integratedTask = await taskCreate.json() as { id: string };
    const calendar = await request.get(`${auth.origin}/api/tarefas/calendar?inicio=${dateKey()}&fim=${dateKey()}`, { headers: auth.headers });
    expect((await calendar.json() as Array<{ id: string }>).some((item) => item.id === integratedTask.id)).toBe(true);
    const dashboard = await request.get(`${auth.origin}/api/dashboard/overview?projectScope=active&tasksInicio=${dateKey()}&tasksFim=${dateKey()}`, { headers: auth.headers });
    expect((await dashboard.json() as { taskCompletion: { total: number } }).taskCompletion.total).toBeGreaterThanOrEqual(2);
    const alerts = await request.get(`${auth.origin}/api/alertas?category=task&period=today&limit=100`, { headers: auth.headers });
    expect((await alerts.json() as { items: Array<{ sourceId: string }> }).items.some((item) => item.sourceId === integratedTask.id)).toBe(true);

    await page.goto('/configuracoes?secao=modelos');
    await unlockCurrent(page);
    const originalCard = page.locator('article').filter({ hasText: `${PREFIX}Modelo interface` }).filter({ hasNotText: 'cópia' });
    await originalCard.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: /Confirmar|Excluir/ }).last().click();
    await expect(originalCard).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-modelos-integracoes.png'), fullPage: true });
  });
});
