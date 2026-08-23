import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';
const CLIENT_NAME = 'Cliente E2E GeoGestor';
const UPDATED_CLIENT_NAME = 'Cliente E2E Atualizado';
const PROJECT_NAME = 'Projeto Topográfico E2E';

async function unlock(page: Page) {
  await page.goto('/');
  const setupHeading = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboardHeading = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setupHeading.or(unlockHeading).or(dashboardHeading)).toBeVisible();
  if (await setupHeading.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles E2E');
    await page.getByLabel('E-mail').fill('thalles.e2e@example.test');
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Concluir configuração' }).click();
    await expect(unlockHeading).toBeVisible();
  }
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboardHeading).toBeVisible();
}

async function navigateBySidebar(page: Page, destination: 'Visão Geral' | 'Comercial' | 'Projetos' | 'Financeiro') {
  await page.getByRole('link', { name: destination, exact: true }).click();
  await expect(page.locator('h1')).toBeVisible();
}

async function expectNoSeriousA11yViolations(page: Page) {
  await expect.poll(async () => page.locator('main').evaluate((main) => {
    const elements = [...main.querySelectorAll<HTMLElement>('[style*="opacity"]')];
    let ancestor: HTMLElement | null = main;
    while (ancestor) {
      if (ancestor.style.opacity) elements.push(ancestor);
      ancestor = ancestor.parentElement;
    }
    return elements.every((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.99);
  }), {
    message: 'A página deve terminar as transições visuais antes da análise de contraste.'
  }).toBe(true);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe.serial('jornadas comerciais críticas do GeoGestor', () => {
  test.setTimeout(90_000);

  test('senha incorreta é recusada, desbloqueio mostra identidade e bloqueio manual funciona', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Senha local').fill('senha-incorreta');
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByRole('alert')).toContainText('Senha local incorreta');

    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
    await expect(page.getByText('Thalles E2E', { exact: true })).toBeVisible();
    await expect(page.getByText('thalles.e2e@example.test', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Bloquear sessão' }).click();
    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
  });

  test('cliente pode ser criado, pesquisado, editado e excluído', async ({ page }) => {
    await unlock(page);
    await navigateBySidebar(page, 'Comercial');
    await expect(page.getByRole('heading', { name: /Clientes/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Áreas do módulo Comercial' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clientes', exact: true })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await page.getByLabel('Pessoa física').check();
    await page.getByLabel('Nome completo').fill(CLIENT_NAME);
    await page.locator('#client-cpf').fill('52998224725');
    await page.locator('#client-celular').fill('48999998888');
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByText(CLIENT_NAME, { exact: true }).first()).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill(CLIENT_NAME);
    await expect(page.getByText(CLIENT_NAME, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\?q=Cliente(?:\+|%20)E2E/);
    await page.getByRole('link', { name: 'CRM e Funil', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('searchbox', { name: 'Buscar clientes' })).toHaveValue(CLIENT_NAME);

    await page.getByRole('button', { name: `Ações de ${CLIENT_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByLabel('Nome completo').fill(UPDATED_CLIENT_NAME);
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByRole('dialog', { name: /Editar cliente/ })).toHaveCount(0);
    const clientSearch = page.getByRole('searchbox', { name: 'Buscar clientes' });
    await clientSearch.fill(UPDATED_CLIENT_NAME);
    await expect(clientSearch).toHaveValue(UPDATED_CLIENT_NAME);
    await expect(page.getByText(UPDATED_CLIENT_NAME, { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: `Ações de ${UPDATED_CLIENT_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Excluir cliente' }).click();
    await expect(page.getByText(UPDATED_CLIENT_NAME, { exact: true })).toHaveCount(0);
  });

  test('projeto é criado em três etapas com cliente explícito', async ({ page }) => {
    await unlock(page);
    await navigateBySidebar(page, 'Comercial');
    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await page.getByLabel('Pessoa física').check();
    await page.getByLabel('Nome completo').fill(CLIENT_NAME);
    await page.locator('#client-cpf').fill('11144477735');
    await page.locator('#client-celular').fill('48999997777');
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByRole('dialog', { name: /Novo cliente/ })).toHaveCount(0);
    await expect(page.getByText(CLIENT_NAME, { exact: true }).first()).toBeVisible();

    await navigateBySidebar(page, 'Projetos');
    await page.getByRole('button', { name: 'Novo Projeto' }).first().click();
    await page.getByLabel('Nome do projeto').fill(PROJECT_NAME);
    await page.getByLabel('Cliente').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await page.getByLabel('Tipo do projeto ou serviço').click();
    await page.getByRole('option', { name: 'Rural', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Criar projeto' }).click();

    await expect(page.getByText(PROJECT_NAME, { exact: true }).first()).toBeVisible();
  });

  test('contas a receber ficam centralizadas no Financeiro e a rota antiga redireciona', async ({ page }) => {
    await unlock(page);
    await navigateBySidebar(page, 'Financeiro');
    await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Contas a receber' }).click();

    await expect(page).toHaveURL(/\/financeiro\?tab=faturas$/);
    await expect(page.getByRole('tab', { name: 'Contas a receber' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Buscar por cliente ou orçamento...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parcelas em aberto' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Histórico Recebido' })).toBeVisible();

    await page.goto('/faturas');
    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page).toHaveURL(/\/financeiro\?tab=faturas$/);
    await expect(page.getByRole('tab', { name: 'Contas a receber' })).toHaveAttribute('aria-selected', 'true');
  });

  test('despesas por categoria usam barras compactas e preservam os valores exatos', async ({ page }) => {
    await unlock(page);
    const expense = (id: string, categoria: string, valor: number) => ({
      id,
      categoria,
      valor,
      status: 'Pago',
      data: '2026-07-15',
      dataPagamento: '2026-07-15'
    });
    const fourCategories = [
      expense('expense-1', 'Combustível', 45_000),
      expense('expense-2', 'Taxas e cartório', 30_000),
      expense('expense-3', 'Hospedagem', 20_000),
      expense('expense-4', 'Alimentação', 5_000)
    ];
    await page.route('**/api/financeiro/despesas', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fourCategories)
    }));
    await navigateBySidebar(page, 'Financeiro');

    const categoryChart = page.getByRole('img', { name: 'Gráfico de barras das despesas por categoria' });
    await expect(page.locator('[data-chart-mode="bars"]')).toBeVisible();
    await expect(categoryChart.getByText('Combustível', { exact: true })).toBeVisible();
    await expect(categoryChart.getByText('R$ 450,00', { exact: true })).toBeVisible();

    await page.unroute('**/api/financeiro/despesas');
    await page.route('**/api/financeiro/despesas', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fourCategories.slice(0, 3))
    }));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();

    const updatedCategoryChart = page.getByRole('img', { name: 'Gráfico de barras das despesas por categoria' });
    await expect(page.locator('[data-chart-mode="bars"]')).toBeVisible();
    await expect(updatedCategoryChart.getByText('Combustível', { exact: true })).toBeVisible();
    await expect(updatedCategoryChart.getByText('Alimentação', { exact: true })).toHaveCount(0);
    await page.unroute('**/api/financeiro/despesas');
  });

  test('falha da API nunca vira KPIs zerados e permite reconexão', async ({ page }) => {
    await unlock(page);
    await page.route('**/api/auth/status', (route) => route.abort('failed'));
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Não foi possível conectar ao serviço local do GeoGestor' })).toBeVisible();
    await expect(page.getByText(/dados não foram necessariamente perdidos/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toHaveCount(0);

    await page.unroute('**/api/auth/status');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
  });

  test('mapa diferencia mapa-base indisponível dos dados do projeto', async ({ page }) => {
    const tileUrl = /https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/;
    await page.route(tileUrl, (route) => route.abort('internetdisconnected'));
    await unlock(page);
    await navigateBySidebar(page, 'Projetos');
    const tileRequest = page.waitForRequest(tileUrl);
    await page.getByRole('tab', { name: 'Mapa' }).click();
    await tileRequest;
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByText('Mapa-base indisponível')).toBeVisible();
    await expect(page.getByText(/marcadores, geometrias e dados próprios continuam visíveis/i)).toBeVisible();
  });

  test('visualizações de projetos têm estados vazios próprios, URL e navegação por teclado', async ({ page }) => {
    await page.route('**/api/projetos*', (route) => route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      contentType: 'application/json',
      body: route.request().method() === 'OPTIONS' ? '' : '[]'
    }));
    await unlock(page);
    await navigateBySidebar(page, 'Projetos');

    const projectsTab = page.getByRole('tab', { name: 'Projetos' });
    const mapTab = page.getByRole('tab', { name: 'Mapa' });
    const statisticsTab = page.getByRole('tab', { name: 'Estatísticas' });
    await expect(projectsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Você ainda não possui projetos cadastrados' })).toBeVisible();

    await mapTab.click();
    await expect(page).toHaveURL(/\/projetos\?visualizacao=mapa$/);
    await expect(mapTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Nenhum projeto georreferenciado para mostrar' })).toBeVisible();

    await mapTab.press('ArrowRight');
    await expect(statisticsTab).toBeFocused();
    await expect(statisticsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/projetos\?visualizacao=estatisticas$/);
    await expect(page.getByRole('heading', { name: 'Ainda não há dados para gerar estatísticas' })).toBeVisible();

    await statisticsTab.press('Home');
    await expect(projectsTab).toBeFocused();
    await expect(page).toHaveURL(/\/projetos$/);
    await page.unroute('**/api/projetos*');
  });

  test('Gestão e Sistema permanece estático e visível ao navegar entre páginas', async ({ page }) => {
    await unlock(page);
    await page.evaluate(() => {
      (window as typeof window & { __geogestorSidebar?: Element | null }).__geogestorSidebar = document.querySelector('aside');
    });
    const administrationLabel = page.getByText('GESTÃO E SISTEMA', { exact: true });
    await expect(administrationLabel).toBeVisible();
    await expect(page.getByRole('button', { name: 'GESTÃO E SISTEMA' })).toHaveCount(0);

    const navigationStartedAt = await page.evaluate(() => performance.now());
    await page.getByRole('link', { name: 'Relatórios', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    expect(await page.evaluate((startedAt) => performance.now() - startedAt, navigationStartedAt)).toBeLessThan(250);
    expect(await page.evaluate(() => (
      (window as typeof window & { __geogestorSidebar?: Element | null }).__geogestorSidebar === document.querySelector('aside')
    ))).toBe(true);
    await expect(page.getByText('Carregando GeoGestor…')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Relatórios', exact: true })).toHaveAttribute('aria-current', 'page');
    await navigateBySidebar(page, 'Comercial');

    await expect(administrationLabel).toBeVisible();
    await expect(page.getByRole('link', { name: 'Relatórios', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ajuda', exact: true })).toBeVisible();
  });

  test('central de alertas lê, apaga, restaura e abre o projeto informado', async ({ page }) => {
    const projectA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const projectB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const alertA = '11111111-1111-4111-8111-111111111111';
    const alertB = '22222222-2222-4222-8222-222222222222';
    const readIds = new Set<string>();
    const hiddenIds = new Set<string>();
    const alerts = [
      {
        id: alertA, occurrenceKey: `project:${projectA}:2026-08-10:once`, category: 'project',
        categoryLabel: 'Projetos e serviços', sourceId: projectA, title: 'Projeto Notificação A',
        description: 'Prazo de entrega do projeto', dueDate: '2026-08-10', daysUntilDue: -1,
        timingLabel: 'Vencido há 1 dia', severity: 'critical', link: `/projetos/${projectA}`,
        readAt: null, nativeNotifiedAt: null, createdAt: '2026-08-10T12:00:00.000Z'
      },
      {
        id: alertB, occurrenceKey: `project:${projectB}:2026-08-11:once`, category: 'project',
        categoryLabel: 'Projetos e serviços', sourceId: projectB, title: 'Projeto Notificação B',
        description: 'Prazo de entrega do projeto', dueDate: '2026-08-11', daysUntilDue: 0,
        timingLabel: 'Vence hoje', severity: 'warning', link: `/projetos/${projectB}`,
        readAt: null, nativeNotifiedAt: null, createdAt: '2026-08-10T12:00:00.000Z'
      }
    ];
    const settings = {
      enabled: true, nativeEnabled: false,
      categories: ['project', 'task', 'receivable', 'payable', 'budget', 'license', 'condition', 'appointment', 'crm']
        .map((category) => ({ category, enabled: true, daysBefore: 7, recurrence: 'daily', intervalDays: 1, alertOnDueDate: true, keepOverdue: true }))
    };

    await page.route('**/api/alertas**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS'
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      if (request.method() === 'GET' && pathname === '/api/alertas') {
        await route.fulfill({
          status: 200, contentType: 'application/json', headers: cors,
          body: JSON.stringify({
            items: alerts.filter((item) => !hiddenIds.has(item.id)).map((item) => ({
              ...item,
              readAt: readIds.has(item.id) ? '2026-08-11T12:00:00.000Z' : null
            })),
            settings,
            generatedAt: new Date().toISOString()
          })
        });
        return;
      }
      const ids = (request.postDataJSON() as { ids?: string[] } | null)?.ids ?? [];
      if (pathname === '/api/alertas/ler') ids.forEach((id) => readIds.add(id));
      if (pathname === '/api/alertas/ocultar') ids.forEach((id) => hiddenIds.add(id));
      if (pathname === '/api/alertas/restaurar') ids.forEach((id) => hiddenIds.delete(id));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{"success":true}' });
    });

    await unlock(page);
    const notificationTrigger = page.locator('main button[aria-label^="Notificações:"]');
    await expect(notificationTrigger).toHaveAttribute('aria-label', /2 não lida/);
    await notificationTrigger.click();

    const panel = page.getByRole('dialog', { name: 'Alertas e prazos' });
    await expect(panel).toContainText('2 não lidas');
    await expect(panel).toContainText('Projeto Notificação A');
    await expect(panel).toContainText('Projeto Notificação B');

    await panel.locator('article').filter({ hasText: 'Projeto Notificação A' }).getByRole('button').first().click();
    await expect(page).toHaveURL(new RegExp(`/projetos/${projectA}$`));
    await expect.poll(() => readIds.has(alertA)).toBe(true);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
    await expect(notificationTrigger).toHaveAttribute('aria-label', /1 não lida/);
    await notificationTrigger.click();
    await panel.getByRole('button', { name: 'Marcar alertas filtrados como lidos' }).click();
    await expect(notificationTrigger).toHaveAttribute('aria-label', /0 não lida/);
    await expect(panel).toContainText('Tudo lido');

    await panel.getByRole('button', { name: 'Apagar alertas filtrados' }).click();
    await expect(panel.locator('article')).toHaveCount(0);
    expect(hiddenIds.size).toBe(2);
    await panel.getByRole('button', { name: 'Desfazer' }).click();
    await expect(panel.locator('article')).toHaveCount(2);
    expect(hiddenIds.size).toBe(0);
  });

  test('alertas abrem todos os destinos canônicos do GeoGestor', async ({ page }) => {
    const entityId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const relatedId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const destinations = [
      { title: 'Destino projeto', category: 'project', categoryLabel: 'Projetos e serviços', link: `/projetos/${entityId}` },
      { title: 'Destino serviço do cliente', category: 'project', categoryLabel: 'Projetos e serviços', link: `/clientes/${entityId}` },
      { title: 'Destino tarefa', category: 'task', categoryLabel: 'Tarefas', link: `/tarefas?tarefaId=${entityId}` },
      { title: 'Destino conta a receber', category: 'receivable', categoryLabel: 'Contas a receber', link: `/financeiro?tab=faturas&parcela=${entityId}` },
      { title: 'Destino conta a pagar', category: 'payable', categoryLabel: 'Contas a pagar', link: `/financeiro?tab=pagar&despesa=${entityId}` },
      { title: 'Destino orçamento', category: 'budget', categoryLabel: 'Orçamentos', link: `/orcamentos/${entityId}/editar` },
      { title: 'Destino licença', category: 'license', categoryLabel: 'Licenças ambientais', link: `/ambiental/licencas/${entityId}` },
      { title: 'Destino condicionante', category: 'condition', categoryLabel: 'Condicionantes', link: `/ambiental/licencas/${entityId}?tab=conditions&condicionante=${relatedId}` },
      { title: 'Destino agenda', category: 'appointment', categoryLabel: 'Agenda', link: `/calendario/compromisso/${entityId}` },
      { title: 'Destino CRM', category: 'crm', categoryLabel: 'CRM', link: `/crm?oportunidade=${entityId}` }
    ];
    const items = destinations.map((destination, index) => ({
      id: `${(index + 1).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
      occurrenceKey: `${destination.category}:destination-${index}:once`,
      category: destination.category,
      categoryLabel: destination.categoryLabel,
      sourceId: `destination-${index}`,
      title: destination.title,
      description: 'Validação do destino canônico',
      dueDate: '2026-08-11',
      daysUntilDue: 0,
      timingLabel: 'Vence hoje',
      severity: 'warning',
      link: destination.link,
      readAt: null,
      nativeNotifiedAt: null,
      createdAt: '2026-08-11T12:00:00.000Z'
    }));

    await page.route('**/api/alertas**', async (route) => {
      const request = route.request();
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', headers, body: '{"success":true}' });
      return route.fulfill({
        status: 200, contentType: 'application/json', headers,
        body: JSON.stringify({
          items,
          settings: { enabled: true, nativeEnabled: false, categories: [] },
          generatedAt: new Date().toISOString()
        })
      });
    });

    await unlock(page);
    const trigger = page.locator('main button[aria-label^="Notificações:"]');
    for (const destination of destinations) {
      await trigger.click();
      const expected = new URL(destination.link, 'http://geogestor.local');
      const navigated = page.waitForURL((url) => (
        url.pathname === expected.pathname
        && [...expected.searchParams].every(([key, value]) => url.searchParams.get(key) === value)
      ));
      await page.getByRole('button', {
        name: `${destination.categoryLabel}: ${destination.title}. Vence hoje`,
        exact: true
      }).click();
      await navigated;
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
    }
  });

  test('alerta navega mesmo quando a gravação de leitura falha', async ({ page }) => {
    const projectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await page.route('**/api/alertas**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() === 'POST' && pathname === '/api/alertas/ler') {
        return route.fulfill({ status: 500, contentType: 'application/json', headers, body: '{"message":"Falha sintética"}' });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json', headers,
        body: JSON.stringify({
          items: [{
            id: '33333333-3333-4333-8333-333333333333', occurrenceKey: 'project:test:once', category: 'project',
            categoryLabel: 'Projetos e serviços', sourceId: projectId, title: 'Projeto resiliente', description: 'Teste de navegação',
            dueDate: '2026-08-11', daysUntilDue: 0, timingLabel: 'Vence hoje', severity: 'warning', link: `/projetos/${projectId}`,
            readAt: null, nativeNotifiedAt: null, createdAt: '2026-08-11T12:00:00.000Z'
          }],
          settings: { enabled: true, nativeEnabled: false, categories: [] },
          generatedAt: new Date().toISOString()
        })
      });
    });

    await unlock(page);
    await page.locator('main button[aria-label^="Notificações:"]').click();
    await page.getByRole('button', { name: /Projetos e serviços: Projeto resiliente/ }).click();
    await expect(page).toHaveURL(new RegExp(`/projetos/${projectId}$`));
    await expect(page.getByText('O alerta foi aberto, mas não foi possível marcá-lo como lido.')).toBeVisible();
  });

  test('notificação nativa só é confirmada quando o Windows informa exibição', async ({ page }) => {
    let nativeConfirmations = 0;
    await page.addInitScript(() => {
      const state = window as typeof window & { __nativeCalls?: number; __nativeShouldShow?: boolean };
      state.__nativeCalls = 0;
      state.__nativeShouldShow = false;
      Object.assign(window, {
        electronAPI: {
          showDeadlineNotification: async () => {
            state.__nativeCalls = (state.__nativeCalls ?? 0) + 1;
            return state.__nativeShouldShow === true;
          },
          onOpenDeadlineAlert: () => () => undefined
        }
      });
    });
    await page.route('**/api/alertas**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() === 'POST' && pathname === '/api/alertas/notificacao-nativa') {
        nativeConfirmations += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', headers, body: '{"success":true}' });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json', headers,
        body: JSON.stringify({
          items: [{
            id: '44444444-4444-4444-8444-444444444444', occurrenceKey: 'task:test:once', category: 'task',
            categoryLabel: 'Tarefas', sourceId: 'task-test', title: 'Tarefa nativa', description: 'Teste do Windows',
            dueDate: '2026-08-11', daysUntilDue: 0, timingLabel: 'Vence hoje', severity: 'warning', link: '/tarefas?tarefaId=task-test',
            readAt: null, nativeNotifiedAt: null, createdAt: '2026-08-11T12:00:00.000Z'
          }],
          settings: { enabled: true, nativeEnabled: true, categories: [] },
          generatedAt: new Date().toISOString()
        })
      });
    });

    await unlock(page);
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __nativeCalls?: number }).__nativeCalls ?? 0)).toBe(1);
    expect(nativeConfirmations).toBe(0);
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      (window as typeof window & { __nativeShouldShow?: boolean }).__nativeShouldShow = true;
      window.dispatchEvent(new CustomEvent('geogestor:alerts-invalidated'));
    });
    await expect.poll(() => nativeConfirmations).toBe(1);
  });

  test('Clientes, CRM e Orçamentos mantêm corpo amplo e cabeçalho alinhado em 1400 px', async ({ page }) => {
    const pdfMakeRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('pdfmake-')) pdfMakeRequests.push(request.url());
    });
    await page.setViewportSize({ width: 2560, height: 1440 });
    await unlock(page);
    await navigateBySidebar(page, 'Comercial');

    const measureCommercialLayout = async () => {
      await expect(page.locator('[data-page-content]')).toHaveClass(/max-w-\[1600px\]/);
      await expect.poll(async () => (
        await page.locator('[data-page-content]').boundingBox()
      )?.width).toBe(1600);
      const content = await page.locator('[data-page-content]').boundingBox();
      const header = await page.locator('main header > div').first().boundingBox();
      const heading = await page.locator('main header h1').first().boundingBox();
      const navigation = await page.locator('nav[aria-label*="Comercial"]').first().boundingBox();
      const action = await page.locator('main header button').first().boundingBox();
      if (!content || !header || !heading || !navigation || !action) {
        throw new Error('Não foi possível medir o layout Comercial.');
      }
      return { content, header, heading, navigation, action };
    };

    const clientes = await measureCommercialLayout();
    await page.getByRole('link', { name: 'CRM e Funil', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
    const crm = await measureCommercialLayout();
    await page.getByRole('link', { name: 'Orçamentos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Orçamentos' })).toBeVisible();
    const orcamentos = await measureCommercialLayout();
    expect(pdfMakeRequests).toHaveLength(0);

    expect(await page.evaluate(() => window.innerWidth)).toBe(2560);
    for (const [pageName, measurement] of Object.entries({ clientes, crm, orcamentos })) {
      expect(measurement.content.width, pageName).toBe(1600);
      expect(measurement.header.width, pageName).toBe(1400);
      expect(measurement.navigation.width, pageName).toBe(1400);
      expect(measurement.navigation.x, pageName).toBe(measurement.header.x);
      expect(measurement.heading.y, pageName).toBeLessThan(measurement.navigation.y);
      expect(measurement.action.height, pageName).toBe(44);
      expect(measurement.content.x + measurement.content.width / 2, pageName)
        .toBe(measurement.header.x + measurement.header.width / 2);
    }

    expect(crm.content.x).toBe(clientes.content.x);
    expect(orcamentos.content.x).toBe(clientes.content.x);
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBe(false);
  });

  test('páginas críticas atendem WCAG A/AA sem violações sérias e funcionam em 800×520', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 800, height: 520 });

    for (const destination of ['Visão Geral', 'Comercial', 'Projetos', 'Financeiro'] as const) {
      if (destination !== 'Visão Geral') await navigateBySidebar(page, destination);
      else await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    }

    await page.keyboard.press('Tab');
    const focusVisible = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return false;
      const style = getComputedStyle(active);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    });
    expect(focusVisible).toBe(true);
  });
});
