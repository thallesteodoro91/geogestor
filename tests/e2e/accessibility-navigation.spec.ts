import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const locked = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(locked).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo A11y E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-A11y-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles A11y E2E');
    await page.getByLabel('E-mail').fill('a11y@example.test');
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Concluir configuração' }).click();
    await expect(locked).toBeVisible();
  }
  if (await locked.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboard).toBeVisible();
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function expectNoWcag22Violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('navegação e diálogos globais acessíveis', () => {
  test('busca distingue falha de estado vazio, tenta novamente e restaura o foco', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/search**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({
          status: 500,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha sintética sem detalhes internos.' })
        });
      }
      return route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            id: 'cliente-a11y',
            type: 'Cliente',
            title: 'Cliente de acessibilidade',
            subtitle: 'Florianópolis',
            path: '/clientes/cliente-a11y'
          }]
        })
      });
    });

    await unlock(page);
    const trigger = page.getByRole('button', { name: 'Buscar no GeoGestor' });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Buscar no GeoGestor' });
    const input = page.getByRole('searchbox', { name: 'Termo de busca' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#root')).toHaveAttribute('inert', '');
    await expect(input).toBeFocused();
    await input.fill('cliente');
    await expect(dialog.getByRole('alert')).toContainText('Não foi possível concluir a busca');
    await expect(dialog.getByText('Nenhum resultado encontrado.')).toHaveCount(0);
    await expect(input).toHaveValue('cliente');

    await dialog.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(dialog.getByRole('button', { name: /Cliente de acessibilidade/ })).toBeVisible();
    await expect(input).toHaveValue('cliente');
    await expectNoWcag22Violations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    await expect(trigger).toBeFocused();
  });

  test('Central de Alertas contém o foco, preserva filtros e oferece retentativa', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/alertas**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 200, headers: CORS_HEADERS, contentType: 'application/json', body: '{"success":true}' });
      }
      attempts += 1;
      if (attempts <= 2) {
        return route.fulfill({ status: 500, headers: CORS_HEADERS, contentType: 'application/json', body: '{"message":"Falha sintética"}' });
      }
      return route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            occurrenceKey: 'task:a11y:once',
            category: 'task',
            categoryLabel: 'Tarefas',
            sourceId: 'a11y',
            title: 'Revisar acessibilidade',
            description: 'Alerta sintético',
            dueDate: '2026-08-13',
            daysUntilDue: 0,
            timingLabel: 'Vence hoje',
            severity: 'warning',
            link: '/tarefas?tarefaId=a11y',
            readAt: '2026-08-13T12:00:00.000Z',
            nativeNotifiedAt: null,
            createdAt: '2026-08-13T12:00:00.000Z'
          }],
          settings: { enabled: true, nativeEnabled: false, categories: [] },
          generatedAt: '2026-08-13T12:00:00.000Z'
        })
      });
    });

    await unlock(page);
    const trigger = page.locator('main button[aria-label^="Notificações:"]');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Alertas e prazos' });
    const categoryFilter = dialog.getByLabel('Filtrar alertas por categoria');
    const statusFilter = dialog.getByLabel('Filtrar alertas por leitura');
    await expect(dialog).toBeVisible();
    await expect(categoryFilter).toBeFocused();
    await expect(page.locator('#root')).toHaveAttribute('inert', '');
    await statusFilter.selectOption('read');
    await dialog.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(statusFilter).toHaveValue('read');
    await expect(dialog.getByRole('button', { name: 'Tarefas: Revisar acessibilidade. Vence hoje' })).toBeVisible();

    const closeButton = dialog.getByRole('button', { name: 'Fechar modal' });
    await closeButton.focus();
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expectNoWcag22Violations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    await expect(trigger).toBeFocused();
  });

  test('rota desconhecida preserva histórico e aliases conhecidos continuam válidos', async ({ page }) => {
    await unlock(page);
    await navigateInApp(page, '/endereco-inexistente?origem=teste');
    await expect(page.getByRole('heading', { name: 'Página não encontrada', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/endereco-inexistente\?origem=teste$/);
    await expect(page).toHaveTitle('Página não encontrada — GeoGestor');
    await expect(page.getByRole('link', { name: 'Voltar à Visão Geral' })).toBeVisible();
    await expectNoWcag22Violations(page);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();

    await navigateInApp(page, '/despesas?origem=favorito');
    await expect(page).toHaveURL(/\/financeiro\?origem=favorito&tab=pagar$/);
    await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();

    await navigateInApp(page, '/clientes/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toHaveCount(0);
  });
});
