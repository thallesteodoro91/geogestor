import { expect, test, type Page } from '@playwright/test';

const log = {
  id: 'audit-navigation-regression', action: 'INSERT', entity: 'Cliente',
  userId: 'Administrador de teste', oldData: null, newData: '{"nome":"Cliente de teste"}',
  createdAt: '2026-10-01T12:00:00.000Z'
};
const auditPage = {
  items: [log], page: 1, total: 1, totalPages: 1,
  summary: { inserts: 1, updates: 0, deletes: 0 }
};

async function openAudit(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
  await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
  await page.locator('aside').getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Logs de auditoria', exact: true }).click();
}

async function expectNavigationWorks(page: Page) {
  await expect(page.locator('[data-app-layout]')).toHaveCount(1);
  await expect(page.locator('aside')).toBeVisible();
  await page.locator('aside').getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
}

for (const [name, payload] of [['paginada', auditPage], ['legada', [log]]] as const) {
  test(`Auditoria ${name} mantém os registros e a navegação lateral`, async ({ page }) => {
    await page.route('**/api/audit-logs?**', (route) => route.fulfill({ json: payload }));
    await openAudit(page);
    await expect(page.getByRole('heading', { name: 'Auditoria de Logs' })).toBeVisible();
    await expect(page.getByRole('cell', { name: log.userId, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar às configurações' })).toBeVisible();
    await expectNavigationWorks(page);
  });
}

test('resposta incompleta da Auditoria mostra erro local e permite tentar novamente', async ({ page }) => {
  let valid = false;
  await page.route('**/api/audit-logs?**', (route) => route.fulfill({
    json: valid ? auditPage : { items: [log], page: 1, total: 1, totalPages: 1 }
  }));
  await openAudit(page);
  await expect(page.getByRole('heading', { name: 'Auditoria de Logs' })).toBeVisible();
  await expect(page.getByText(/Resposta de auditoria inválida/)).toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
  valid = true;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByRole('cell', { name: log.userId, exact: true })).toBeVisible();
  await expectNavigationWorks(page);
});

test('Auditoria abre com o serviço local e permite voltar às configurações', async ({ page }) => {
  await openAudit(page);
  await expect(page.getByRole('heading', { name: 'Auditoria de Logs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Detalhes', exact: true }).first()).toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
  await page.getByRole('link', { name: 'Voltar às configurações' }).click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
});

for (const width of [1120, 390]) {
  test(`falha de renderização em Auditoria preserva a navegação em ${width} px`, async ({ page }) => {
    await page.route('**/AuditLogs-*.js', (route) => route.fulfill({
      contentType: 'application/javascript', body: 'throw new Error("Falha sintética da tela de Auditoria");'
    }));
    await openAudit(page);
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name: 'Ops! Ocorreu um erro ao exibir esta tela' })).toBeVisible();
    if (width < 768) {
      await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
    }
    await expectNavigationWorks(page);
  });
}
