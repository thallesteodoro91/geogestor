import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S08-20260912-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

const ids = {
  clients: [crypto.randomUUID(), crypto.randomUUID()],
  projects: Array.from({ length: 5 }, () => crypto.randomUUID()),
  tasks: Array.from({ length: 5 }, () => crypto.randomUUID()),
  appointments: Array.from({ length: 11 }, () => crypto.randomUUID())
};

type Auth = { origin: string; headers: Record<string, string> };

async function unlockCurrent(page: Page): Promise<Auth | undefined> {
  await expect(page.getByRole('main')).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  if (!await heading.isVisible()) return;
  await page.getByLabel('Senha local').fill(PASSWORD);
  const unlockResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'));
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

async function ensureCalendarJourneyFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(evidenceRoot, { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const now = relativeInstant();
    await batchWithLockRetry(database, [
      { sql: `insert or ignore into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [ids.clients[0], `${PREFIX}Cliente A`, now, now] },
      { sql: `insert or ignore into projetos (id, cliente_id, nome, status, data_inicio, data_entrega, created_at, updated_at) values (?, ?, ?, 'Em Andamento', '2024-02-01', '2024-02-29', ?, ?)`, args: [ids.projects[0], ids.clients[0], `${PREFIX}Projeto bordas`, now, now] },
      { sql: `insert or ignore into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, 'Em Progresso', 'Média', '2024-02-29', ?, ?)`, args: [ids.tasks[1], ids.clients[0], ids.projects[0], `${PREFIX}Tarefa em progresso`, now, now] },
      { sql: `insert or ignore into compromissos (id, titulo, tipo, data, hora, cliente_id, projeto_id, descricao, created_at, updated_at) values (?, ?, 'Reunião', '2024-02-29', '09:00', ?, ?, 'Ordem', ?, ?)`, args: [ids.appointments[8], `${PREFIX}Mesmo dia 09`, ids.clients[0], ids.projects[0], now, now] }
    ]);
  } finally {
    database.close();
  }
}

test.describe('Sessão 08 — Agenda — Calendário', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(240_000);

  test('reconcilia grade, três fontes, filtros, ordem e links Google', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const auth = await unlock(page, '/calendario?mes=2024-02&data=2024-02-29');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    const projectRows = [
      [ids.projects[0], ids.clients[0], `${PREFIX}Projeto bordas`, '2024-02-01', '2024-02-29'],
      [ids.projects[1], ids.clients[1], `${PREFIX}Projeto atravessa meses`, '2024-01-31', '2024-03-01'],
      [ids.projects[2], ids.clients[0], `${PREFIX}Projeto só início`, '2024-02-15', null],
      [ids.projects[3], ids.clients[1], `${PREFIX}Projeto só entrega`, null, '2024-02-15'],
      [ids.projects[4], ids.clients[0], `${PREFIX}Projeto sem datas`, null, null]
    ];
    const taskRows = [
      [ids.tasks[0], ids.clients[0], ids.projects[0], `${PREFIX}Tarefa pendente`, 'A Fazer', '2024-02-01', null],
      [ids.tasks[1], ids.clients[0], ids.projects[0], `${PREFIX}Tarefa em progresso`, 'Em Progresso', '2024-02-29', null],
      [ids.tasks[2], ids.clients[1], ids.projects[3], `${PREFIX}Tarefa concluída`, 'Concluído', '2024-02-15', null],
      [ids.tasks[3], ids.clients[0], ids.projects[0], `${PREFIX}Tarefa sem prazo`, 'A Fazer', null, null],
      [ids.tasks[4], ids.clients[0], ids.projects[0], `${PREFIX}Tarefa removida`, 'A Fazer', '2024-02-29', now]
    ];
    const appointmentRows = [
      [ids.appointments[0], `${PREFIX}Visita Açores`, 'Visita de Campo', '2024-02-05', '09:00', ids.clients[0], ids.projects[0], 'Descrição com acentos & símbolos <script>inerte()</script>'],
      [ids.appointments[1], `${PREFIX}Reunião`, 'Reunião', '2024-02-10', '12:30', null, null, 'Geral'],
      [ids.appointments[2], `${PREFIX}Ligação`, 'Ligação', '2024-02-12', '00:00', ids.clients[1], null, 'Somente cliente'],
      [ids.appointments[3], `${PREFIX}Administrativo`, 'Administrativo', '2024-02-14', null, null, null, 'Dia inteiro'],
      [ids.appointments[4], `${PREFIX}Serviço`, 'Serviço', '2024-02-16', '23:59', ids.clients[0], ids.projects[0], 'Fim do dia'],
      [ids.appointments[5], `${PREFIX}Entrega`, 'Entrega', '2024-02-20', '13:30', ids.clients[1], ids.projects[3], 'Entrega'],
      [ids.appointments[6], `${PREFIX}Outro`, 'Outro', '2024-02-25', null, null, null, 'Outro'],
      [ids.appointments[7], `${PREFIX}Mesmo dia 00`, 'Ligação', '2024-02-29', '00:00', ids.clients[0], ids.projects[0], 'Ordem'],
      [ids.appointments[8], `${PREFIX}Mesmo dia 09`, 'Reunião', '2024-02-29', '09:00', ids.clients[0], ids.projects[0], 'Ordem'],
      [ids.appointments[9], `${PREFIX}Mesmo dia 23`, 'Serviço', '2024-02-29', '23:59', ids.clients[0], ids.projects[0], 'Ordem'],
      [ids.appointments[10], `${PREFIX}Mesmo dia inteiro`, 'Outro', '2024-02-29', null, ids.clients[0], ids.projects[0], 'Ordem']
    ];
    try {
      await batchWithLockRetry(database, [
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [ids.clients[0], `${PREFIX}Cliente A`, now, now] },
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PF', 'Ativo', ?, ?)`, args: [ids.clients[1], `${PREFIX}Cliente B`, now, now] },
        ...projectRows.map((row) => ({ sql: `insert into projetos (id, cliente_id, nome, status, data_inicio, data_entrega, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?, ?, ?)`, args: [...row, now, now] })),
        ...taskRows.map((row) => ({ sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite, deleted_at, created_at, updated_at) values (?, ?, ?, ?, ?, 'Média', ?, ?, ?, ?)`, args: [...row, now, now] })),
        ...appointmentRows.map((row) => ({ sql: `insert into compromissos (id, titulo, tipo, data, hora, cliente_id, projeto_id, descricao, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [...row, now, now] }))
      ]);
    } finally {
      database.close();
    }

    await page.reload();
    await unlockCurrent(page);
    await expect(page).toHaveURL(/mes=2024-02.*data=2024-02-29/);
    await expect(page.getByRole('heading', { name: 'Fevereiro de 2024' })).toBeVisible();
    await expect(page.getByRole('gridcell')).toHaveCount(35);
    await expect(page.getByText('18 eventos em fevereiro de 2024.')).toBeVisible();
    const selectedAgenda = page.getByRole('complementary');
    const orderedTitles = await selectedAgenda.locator('article a > p.text-sm').allTextContents();
    expect(orderedTitles).toEqual([
      `${PREFIX}Mesmo dia 00`, `${PREFIX}Mesmo dia 09`, `${PREFIX}Mesmo dia 23`,
      `${PREFIX}Mesmo dia inteiro`, 'Entrega: ' + `${PREFIX}Projeto bordas`, `${PREFIX}Tarefa em progresso`
    ]);

    await page.getByLabel('Buscar eventos no calendário').fill('reuniao');
    await expect(page.getByText('2 de 18 eventos encontrados em fevereiro de 2024.')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByText('18 eventos em fevereiro de 2024.')).toBeVisible();

    const googleLink = selectedAgenda.getByLabel(`Adicionar ${PREFIX}Mesmo dia 23 ao Google Agenda`);
    const href = await googleLink.getAttribute('href');
    const googleUrl = new URL(href || '');
    expect(googleUrl.origin).toBe('https://calendar.google.com');
    expect(googleUrl.searchParams.get('action')).toBe('TEMPLATE');
    expect(googleUrl.searchParams.get('dates')).toBe('20240229T235900/20240301T005900');
    expect(googleUrl.searchParams.get('ctz')).toBe('America/Sao_Paulo');
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-grade-fontes-ordenacao.png'), fullPage: true });
  });

  test('cria, persiste, detalha, exclui e desfaz sem tocar nas origens derivadas', async ({ page }) => {
    await ensureCalendarJourneyFixture();
    const auth = await unlock(page, '/calendario?mes=2024-02&data=2024-02-29');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    const title = `${PREFIX}Criado pela interface`;
    await page.getByRole('button', { name: 'Agendar compromisso' }).click();
    const createDialog = page.getByRole('dialog', { name: /Novo compromisso/ });
    await expect(createDialog).toBeVisible();
    await page.getByLabel('Título do compromisso').fill('   ');
    await createDialog.getByRole('button', { name: 'Agendar compromisso' }).click();
    await expect(page.getByText('Informe um título para identificar o compromisso.')).toBeVisible();
    await expect(page.getByLabel('Título do compromisso')).toBeFocused();
    await page.getByLabel('Título do compromisso').fill(title);
    const timeInput = page.getByRole('combobox', { name: /Horário/ });
    await timeInput.fill('930');
    await timeInput.press('Tab');
    await expect(timeInput).toHaveValue('09:30');
    await page.getByLabel('Descrição').fill('<img src=x onerror=alert(1)> conteúdo inerte');
    const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/compromissos'));
    await createDialog.getByRole('button', { name: 'Agendar compromisso' }).click();
    expect((await createResponse).status()).toBe(200);
    await expect(page.getByRole('complementary').getByText(title, { exact: true })).toBeVisible();
    await expect(page.locator('p').getByText('<img src=x onerror=alert(1)> conteúdo inerte', { exact: true })).toBeVisible();

    const createdRows = await page.request.get(`${auth.origin}/api/compromissos?inicio=2024-02-29&fim=2024-02-29`, { headers: auth.headers });
    const created = (await createdRows.json() as Array<{ id: string; titulo: string; hora: string }>).find((item) => item.titulo === title);
    expect(created).toBeTruthy();
    expect(created?.hora).toBe('09:30');

    await page.locator(`a[href="/calendario/compromisso/${created?.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/calendario/compromisso/${created?.id}`));
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar para o calendário' }).click();
    await expect(page.getByRole('complementary').getByText(title, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Excluir ${title}` }).click();
    await page.getByRole('button', { name: 'Excluir compromisso' }).click();
    await expect(page.getByRole('complementary').getByText(title, { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByRole('complementary').getByText(title, { exact: true })).toBeVisible();
    const restoredRows = await page.request.get(`${auth.origin}/api/compromissos?inicio=2024-02-29&fim=2024-02-29`, { headers: auth.headers });
    const restored = (await restoredRows.json() as Array<{ id: string; titulo: string }>).filter((item) => item.titulo === title);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).not.toBe(created?.id);

    await page.goto(`/calendario/tarefa/${ids.tasks[1]}`);
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: `${PREFIX}Tarefa em progresso` })).toBeVisible();
    await page.goto(`/calendario/desconhecido/${ids.tasks[1]}`);
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Evento não encontrado' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-detalhe-e-recuperacao.png'), fullPage: true });
  });

  test('mantém fontes válidas em falha parcial, URL canônica, teclado, mobile e tema escuro', async ({ page }) => {
    await ensureCalendarJourneyFixture();
    await page.route('**/api/tarefas/calendar*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha controlada S08 em Tarefas"}' }));
    await unlock(page, '/calendario?mes=2024-13&data=2024-02-30&tipo=adulterado&status=legado');
    await expect(page).not.toHaveURL(/2024-13|2024-02-30|tipo=adulterado|status=legado/);
    await page.goto('/calendario?mes=2024-02&data=2024-02-29');
    await unlockCurrent(page);
    await expect(page.getByRole('alert')).toContainText('Falha controlada S08 em Tarefas');
    const partialAgenda = page.getByRole('complementary');
    await expect(partialAgenda.getByText('Entrega: ' + `${PREFIX}Projeto bordas`, { exact: true })).toBeVisible();
    await expect(partialAgenda.getByText(`${PREFIX}Mesmo dia 09`, { exact: true })).toBeVisible();
    await page.unroute('**/api/tarefas/calendar*');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(partialAgenda.getByText(`${PREFIX}Tarefa em progresso`, { exact: true })).toBeVisible();

    const selectedDay = page.getByRole('button', { name: /29 de fevereiro de 2024/ });
    await selectedDay.focus();
    await selectedDay.press('PageUp');
    await expect(page).toHaveURL(/mes=2024-01.*data=2024-01-29/);
    await page.goBack();
    await expect(page).toHaveURL(/mes=2024-02.*data=2024-02-29/);
    await expect(page.getByRole('heading', { name: 'Fevereiro de 2024' })).toBeVisible();

    await page.goto('/calendario?mes=2026-02&data=2026-02-01');
    await unlockCurrent(page);
    await expect(page.getByRole('gridcell')).toHaveCount(28);
    await page.goto('/calendario?mes=2026-08&data=2026-08-01');
    await unlockCurrent(page);
    await expect(page.getByRole('gridcell')).toHaveCount(42);
    await page.goto('/calendario?mes=2024-01&data=2024-01-31');
    await unlockCurrent(page);
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page).toHaveURL(/mes=2024-02.*data=2024-02-29/);

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-falha-parcial-mobile-escuro.png'), fullPage: true });
  });
});
