import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page, target = '/') {
  await page.goto(target);
  const setupHeading = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });

  await expect(setupHeading.or(unlockHeading).or(page.locator('[data-app-layout]'))).toBeVisible();

  if (await setupHeading.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Layout E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Layout-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles Layout E2E');
    await page.getByLabel('E-mail').fill('layout@example.test');
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Concluir configuração' }).click();
    await expect(unlockHeading).toBeVisible();
  }

  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }

  await expect(page.locator('[data-app-layout]')).toBeVisible();
}

async function expectSingleLayout(page: Page) {
  await expect(page.locator('[data-app-layout]')).toHaveCount(1);
  await expect(page.locator('aside')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('#main-content')).toHaveCount(1);
}

async function clickDesktopRoute(page: Page, name: 'Ajuda' | 'Topografia') {
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL(name === 'Ajuda' ? /\/ajuda$/ : /\/topografia$/);
  await expectSingleLayout(page);
}

test.describe.serial('persistência do layout principal', () => {
  test.setTimeout(120_000);

  test('mantém uma única instância durante 20 navegações e no histórico', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await unlock(page);
    await expectSingleLayout(page);
    consoleErrors.length = 0;
    pageErrors.length = 0;

    for (let index = 0; index < 10; index += 1) {
      await clickDesktopRoute(page, 'Ajuda');
      await clickDesktopRoute(page, 'Topografia');
    }

    await page.goBack();
    await expect(page).toHaveURL(/\/ajuda$/);
    await expectSingleLayout(page);
    await page.goForward();
    await expect(page).toHaveURL(/\/topografia$/);
    await expectSingleLayout(page);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('preserva o shell no celular e fecha o menu após navegar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await unlock(page);
    await expectSingleLayout(page);

    for (const name of ['Ajuda', 'Topografia', 'Ajuda', 'Topografia'] as const) {
      await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeInViewport();
      await sidebar.getByRole('link', { name, exact: true }).click();
      await expectSingleLayout(page);
      await expect(sidebar).not.toBeInViewport();
    }
  });

  test('carrega uma rota interna diretamente sem criar outro layout', async ({ page }) => {
    await unlock(page, '/ajuda');
    if (!/\/ajuda$/.test(new URL(page.url()).pathname)) {
      await page.goto('/ajuda');
      const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
      if (await unlockHeading.isVisible()) {
        await page.getByLabel('Senha local').fill(PASSWORD);
        await page.getByRole('button', { name: 'Desbloquear' }).click();
      }
    }
    await expect(page).toHaveURL(/\/ajuda$/);
    await expect(page.getByRole('heading', { name: 'Central de Ajuda' })).toBeVisible();
    await expectSingleLayout(page);
  });
});
