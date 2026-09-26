import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import path from 'node:path';

const PASSWORD = 'GeoGestor-E2E-2026';

test('configuração inicial cria identidade e exige desbloqueio', async ({ page }) => {
  await page.route('**/api/configuracoes', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();
    const basicConfiguration = request.postDataJSON() as Record<string, unknown>;
    await route.continue({
      postData: JSON.stringify({
        ...basicConfiguration,
        adminNome: 'Thalles E2E',
        adminEmail: 'thalles.e2e@example.test',
        adminSenha: PASSWORD,
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.getByLabel('Nome da empresa').fill('SkyGeo E2E');
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await page.getByLabel('Pasta de dados').fill(path.join(e2eRoot, 'files'));
  await page.getByRole('button', { name: 'Concluir configuração' }).click();

  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
});
