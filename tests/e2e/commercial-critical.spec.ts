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

async function navigateBySidebar(page: Page, destination: 'Visão Geral' | 'Clientes' | 'Projetos' | 'Financeiro') {
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
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe.serial('jornadas comerciais críticas do GeoGestor', () => {
  test('configuração inicial cria identidade e exige desbloqueio', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel('Nome da empresa').fill('SkyGeo E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles E2E');
    await page.getByLabel('E-mail').fill('thalles.e2e@example.test');
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Concluir configuração' }).click();

    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
  });

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
    await navigateBySidebar(page, 'Clientes');
    await expect(page.getByRole('heading', { name: /Clientes/ })).toBeVisible();

    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await page.getByLabel('Pessoa física').check();
    await page.getByLabel('Nome completo').fill(CLIENT_NAME);
    await page.locator('#client-cpf').fill('52998224725');
    await page.locator('#client-celular').fill('48999998888');
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByText(CLIENT_NAME, { exact: true }).first()).toBeVisible();

    await page.getByPlaceholder('Buscar clientes por nome, documento ou contato…').fill(CLIENT_NAME);
    await expect(page.getByText(CLIENT_NAME, { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: `Ações de ${CLIENT_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByLabel('Nome completo').fill(UPDATED_CLIENT_NAME);
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page.getByRole('dialog', { name: /Editar cliente/ })).toHaveCount(0);
    const clientSearch = page.getByPlaceholder('Buscar clientes por nome, documento ou contato…');
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
    await navigateBySidebar(page, 'Clientes');
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

  test('receita começa sem cliente, valida em português e protege rascunho', async ({ page }) => {
    await unlock(page);
    await navigateBySidebar(page, 'Financeiro');
    await expect(page.getByRole('heading', { name: 'Gestão financeira 360' })).toBeVisible();
    await page.getByRole('button', { name: 'Nova Receita' }).click();

    await expect(page.getByRole('combobox', { name: /Cliente vinculado/ })).toHaveText('Selecione um cliente…');
    await page.getByRole('button', { name: 'Salvar recebimento' }).click();
    await expect(page.getByText('Selecione o cliente responsável pela receita.')).toBeVisible();
    await expect(page.getByText('Informe a descrição da receita.')).toBeVisible();
    await expect(page.getByText('Informe o valor da receita.')).toBeVisible();
    await expect(page.getByText(/Expected number|received nan/i)).toHaveCount(0);

    await page.getByRole('textbox', { name: /Descrição ou serviço/ }).fill('Receita E2E não salva');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Descartar alterações?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.getByRole('textbox', { name: /Descrição ou serviço/ })).toHaveValue('Receita E2E não salva');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(page.getByRole('dialog', { name: /Nova Receita/ })).toHaveCount(0);
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
    await page.getByRole('button', { name: 'Mapa' }).click();
    await tileRequest;
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByText('Mapa-base indisponível')).toBeVisible();
    await expect(page.getByText(/marcadores, geometrias e dados próprios continuam visíveis/i)).toBeVisible();
  });

  test('páginas críticas atendem WCAG A/AA sem violações sérias e funcionam em 800×520', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 800, height: 520 });

    for (const destination of ['Visão Geral', 'Clientes', 'Projetos', 'Financeiro'] as const) {
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
