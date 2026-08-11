import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const locked = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(locked).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Help E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Help-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles Help E2E');
    await page.getByLabel('E-mail').fill('help@example.test');
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

async function navigate(page: Page, target: string) {
  await page.evaluate((next) => {
    history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, target);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const typeUiButton = page.getByRole('button', { name: 'Minimize TypeUI panel' });
  if (await typeUiButton.isVisible().catch(() => false)) await typeUiButton.click();
  await page.waitForTimeout(350);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'), JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test.describe.serial('Central de Ajuda operacional e acessível', () => {
  test('restaura estado pela URL, combina filtros e acompanha o histórico', async ({ page }) => {
    await unlock(page);
    await navigate(page, '/ajuda?categoria=projetos&artigo=projetos-checklist&q=checklist');
    await expect(page.getByRole('heading', { name: 'Projetos e checklist operacional', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Projetos', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('searchbox', { name: 'Pesquisar na Central de Ajuda' })).toHaveValue('checklist');

    await page.getByRole('searchbox', { name: 'Pesquisar na Central de Ajuda' }).fill('licenciamento');
    await expect(page.getByRole('heading', { name: 'Projetos e checklist operacional', level: 2 })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Nenhum guia encontrado' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click();
    await expect.poll(() => new URL(page.url()).search).toBe('');

    await page.getByRole('button', { name: 'Abrir guia: CRM e oportunidades' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('artigo')).toBe('crm-oportunidades');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Comece por aqui', level: 2 })).toBeVisible();

    await navigate(page, '/ajuda?categoria=inválida&artigo=inexistente');
    await expect.poll(() => new URL(page.url()).search).toBe('');
    await expect(page.getByRole('button', { name: 'Todos os guias' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('preserva o foco ao abrir e fechar um artigo no celular', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(page, '/ajuda');
    const card = page.getByRole('button', { name: 'Abrir guia: Projetos e checklist operacional' });
    await card.focus();
    await page.keyboard.press('Enter');
    const title = page.getByRole('heading', { name: 'Projetos e checklist operacional', level: 2 });
    await expect(title).toBeFocused();
    await page.getByRole('button', { name: 'Voltar para a lista' }).click();
    await expect(card).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  });

  test('anuncia resultados, mantém semântica e passa WCAG AA em estados representativos', async ({ page }) => {
    await unlock(page);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((nextTheme) => {
        localStorage.setItem('geogestor_theme', nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      }, theme);
      await navigate(page, '/ajuda');
      await expect(page.getByRole('status').filter({ hasText: 'guias encontrados' })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await page.getByRole('button', { name: 'Abrir guia: Primeira configuração e pasta de dados' }).click();
      await expect(page.locator('article')).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await page.getByRole('searchbox', { name: 'Pesquisar na Central de Ajuda' }).fill('termo sem resultado xyz');
      await expect(page.getByRole('heading', { name: 'Nenhum guia encontrado' })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
    }
  });

  test('respeita movimento reduzido e mantém links dos guias navegáveis', async ({ page }) => {
    await unlock(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navigate(page, '/ajuda?categoria=financeiro&artigo=orcamentos-aprovacao');
    const article = page.locator('article');
    await expect(article).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir Orçamentos' })).toHaveAttribute('href', '/orcamentos');
    const categoryTransition = await page.getByRole('button', { name: 'Financeiro', exact: true }).evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(categoryTransition).toBe('0s');
  });
});
