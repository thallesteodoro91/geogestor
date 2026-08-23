import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

test('configuração inicial cria identidade e exige desbloqueio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.getByLabel('Nome da empresa').fill('SkyGeo E2E');
  await page.getByLabel('Pasta de dados').fill('~/GeoGestor-E2E');
  await page.getByLabel('Nome do administrador').fill('Thalles E2E');
  await page.getByLabel('E-mail').fill('thalles.e2e@example.test');
  await page.getByLabel('Senha local').fill(PASSWORD);
  await page.getByRole('button', { name: 'Concluir configuração' }).click();

  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
});
