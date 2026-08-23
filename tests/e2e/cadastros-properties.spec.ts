import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';
const SERVICE_NAME = 'Serviço E2E integrado';
const UPDATED_SERVICE_NAME = 'Serviço E2E integrado editado';
const EXPENSE_NAME = 'Categoria E2E integrada';
const CLIENT_NAME = 'Cliente propriedade E2E';
const PROPERTY_NAME = 'Fazenda Integração E2E';
const UPDATED_PROPERTY_NAME = 'Fazenda Integração E2E atualizada';

async function unlock(page: Page) {
  await page.goto('/');
  const setupHeading = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboardHeading = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setupHeading.or(unlockHeading).or(dashboardHeading)).toBeVisible();
  if (await setupHeading.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Cadastros E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Cadastros-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles Cadastros E2E');
    await page.getByLabel('E-mail').fill('cadastros.e2e@example.test');
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

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function expectNoBlockingA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include('body').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function expectDialogAccessibleInBothThemes(page: Page) {
  const activeDialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
  await expect(activeDialog).toHaveCSS('opacity', '1');
  for (const dark of [false, true]) {
    await page.evaluate((useDarkTheme) => {
      localStorage.setItem('geogestor_theme', useDarkTheme ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', useDarkTheme);
    }, dark);
    await activeDialog.evaluate(async (dialog) => {
      const animations = dialog.getAnimations({ subtree: true });
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    });
    await expectNoBlockingA11yViolations(page);
  }
  await page.evaluate(() => {
    localStorage.setItem('geogestor_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
}

async function expectModalPortalRemoved(page: Page) {
  await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
}

test.describe.serial('cadastros auxiliares e propriedades', () => {
  test.setTimeout(90_000);
  test.beforeEach(async ({ page }) => unlock(page));

  test('cache inválido não derruba a rota, abas funcionam por teclado e catálogos alimentam os consumidores', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geogestor_tipos_servico', '{inválido');
      localStorage.setItem('geogestor_tipos_despesa', '{inválido');
    });
    await navigateInApp(page, '/cadastros');
    await expect(page.getByRole('heading', { name: 'Cadastros Auxiliares' })).toBeVisible();

    const serviceTab = page.getByRole('tab', { name: /Tipos de serviço/ });
    const expenseTab = page.getByRole('tab', { name: /Categorias de despesa/ });
    await serviceTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(expenseTab).toHaveAttribute('aria-selected', 'true');
    await expect(expenseTab).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(serviceTab).toBeFocused();

    await page.getByRole('button', { name: 'Novo tipo de serviço' }).click();
    await expect(page.getByLabel('Nome do serviço')).toBeFocused();
    await page.getByLabel('Nome do serviço').fill(SERVICE_NAME);
    await page.getByLabel('Valor sugerido (R$)').fill('1250.00');
    await page.getByRole('button', { name: 'Criar cadastro' }).click();
    await expect(page.getByRole('heading', { name: SERVICE_NAME })).toBeVisible();
    await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: SERVICE_NAME }) })).toContainText(/1\.250,00/);

    await expenseTab.click();
    await page.getByRole('button', { name: 'Nova categoria de despesa' }).click();
    await page.getByLabel('Categoria da despesa').click();
    await page.getByRole('option', { name: 'Outra categoria…' }).click();
    await page.getByLabel('Nome da categoria').fill(EXPENSE_NAME);
    await page.getByLabel('Descrição').fill('Categoria criada pelo teste de integração.');
    await page.getByRole('button', { name: 'Criar cadastro' }).click();
    await expect(page.getByRole('heading', { name: EXPENSE_NAME })).toBeVisible();

    await navigateInApp(page, '/orcamentos');
    await expect(page.getByRole('heading', { name: 'Orçamentos' })).toBeVisible();
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('combobox', { name: 'Filtrar por tipo de serviço' }).click();
    await expect(page.getByRole('option', { name: SERVICE_NAME })).toBeVisible();

    await navigateInApp(page, '/financeiro');
    await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    await page.getByRole('menuitem', { name: /Nova despesa/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('combobox', { name: 'Categoria', exact: true }).click();
    await expect(page.getByRole('option', { name: EXPENSE_NAME })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    await navigateInApp(page, '/cadastros');
    await page.getByRole('tab', { name: /Tipos de serviço/ }).click();
    await page.getByRole('button', { name: `Editar ${SERVICE_NAME}` }).click();
    await page.getByLabel('Nome do serviço').fill(UPDATED_SERVICE_NAME);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toBeVisible();
    await page.getByRole('button', { name: `Inativar ${UPDATED_SERVICE_NAME}` }).click();
    await page.getByRole('button', { name: 'Inativar cadastro' }).click();
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toHaveCount(0);
    await page.getByRole('button', { name: 'inativos', exact: true }).click();
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toBeVisible();
    await page.getByRole('button', { name: `Reativar ${UPDATED_SERVICE_NAME}` }).click();
    await page.getByRole('button', { name: 'Reativar cadastro' }).click();
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toHaveCount(0);
    await page.getByRole('button', { name: 'ativos', exact: true }).click();
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toBeVisible();
  });

  test('estado da tela permanece na URL e histórico do navegador restaura aba, busca e filtro', async ({ page }) => {
    await navigateInApp(page, '/cadastros?aba=despesas&status=todos&busca=Categoria');
    await expect(page.getByRole('tab', { name: /Categorias de despesa/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Buscar categorias de despesa')).toHaveValue('Categoria');
    await expect(page.getByRole('button', { name: 'todos', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('tab', { name: /Tipos de serviço/ }).click();
    await expect(page).toHaveURL(/aba=servicos/);
    await page.goBack();
    await expect(page.getByRole('tab', { name: /Categorias de despesa/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Buscar categorias de despesa')).toHaveValue('Categoria');
    await page.goForward();
    await expect(page.getByRole('tab', { name: /Tipos de serviço/ })).toHaveAttribute('aria-selected', 'true');

    await page.getByLabel('Buscar tipos de serviço').fill('integrado');
    await expect(page).toHaveURL(/busca=integrado/);
    await page.reload();
    const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
    if (await unlockHeading.isVisible()) {
      await page.getByLabel('Senha local').fill(PASSWORD);
      await page.getByRole('button', { name: 'Desbloquear' }).click();
    }
    await expect(page.getByLabel('Buscar tipos de serviço')).toHaveValue('integrado');
  });

  test('erro de persistência mantém o modal e o rascunho abertos', async ({ page }) => {
    await page.route('**/api/dados-operacionais/configuracoes-operacionais', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha simulada. Tente novamente.' })
      });
    });
    await navigateInApp(page, '/cadastros');
    await page.getByRole('button', { name: 'Novo tipo de serviço' }).click();
    const serviceName = page.getByLabel('Nome do serviço');
    const suggestedValue = page.getByLabel('Valor sugerido (R$)');
    await expect(serviceName).toBeFocused();
    await serviceName.fill('Rascunho com falha de persistência');
    await suggestedValue.fill('800.00');
    await expect(serviceName).toHaveValue('Rascunho com falha de persistência');
    await expect(suggestedValue).toHaveValue('800.00');
    await page.getByRole('button', { name: 'Criar cadastro' }).click();
    await expect(page.getByRole('dialog', { name: 'Novo tipo de serviço' })).toBeVisible();
    await expect(serviceName).toHaveValue('Rascunho com falha de persistência');
    await expect(page.getByText('Falha simulada. Tente novamente.')).toBeVisible();
  });

  test('falha ao inativar permanece no diálogo, preserva o registro e permite tentar novamente', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/dados-operacionais/configuracoes-operacionais', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      attempts += 1;
      if (attempts === 1) return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha simulada no SQLite.' })
      });
      return route.continue();
    });
    await navigateInApp(page, '/cadastros?aba=servicos&status=ativos');
    await page.getByRole('button', { name: `Inativar ${UPDATED_SERVICE_NAME}` }).click();
    await page.getByRole('button', { name: 'Inativar cadastro' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('A inativação não foi concluída');
    await expect(dialog).toContainText('Tente novamente');
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Inativar cadastro' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Inativar cadastro' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: UPDATED_SERVICE_NAME })).toHaveCount(0);
    await page.getByRole('button', { name: 'inativos', exact: true }).click();
    await page.getByRole('button', { name: `Reativar ${UPDATED_SERVICE_NAME}` }).click();
    await page.getByRole('button', { name: 'Reativar cadastro' }).click();
  });

  test('tela reflowa em 390 px, modais protegem rascunhos e axe não encontra bloqueios', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateInApp(page, '/cadastros');
    await expect(page.getByRole('heading', { name: 'Cadastros Auxiliares' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoBlockingA11yViolations(page);

    await page.getByRole('button', { name: 'Novo tipo de serviço' }).click();
    await page.getByLabel('Nome do serviço').fill('Rascunho sem salvar');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Descartar alterações');
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await expect(page.getByRole('dialog', { name: 'Novo tipo de serviço' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toContainText('Descartar alterações');
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expectModalPortalRemoved(page);

    await page.evaluate(() => {
      localStorage.setItem('geogestor_theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await expect(page.getByRole('heading', { name: 'Cadastros Auxiliares' })).toBeVisible();
    await expectNoBlockingA11yViolations(page);
  });

  test('primeiro uso cria cliente sem perder o rascunho, persiste propriedade e alimenta consumidores', async ({ page }) => {
    await navigateInApp(page, '/propriedades');
    await page.getByRole('button', { name: 'Novo cadastro de propriedade' }).click();
    await page.getByLabel('Nome do imóvel').fill(PROPERTY_NAME);
    await page.getByRole('button', { name: 'Cadastrar cliente' }).click();
    await expect(page.getByRole('dialog', { name: /Novo cliente para o cadastro de propriedade/ })).toBeVisible();
    await page.getByLabel('Nome completo').fill('Cliente cancelado');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Voltar ao formulário' }).click();
    await expect(page.getByRole('dialog', { name: 'Novo cadastro de propriedade' })).toBeVisible();
    await expect(page.getByLabel('Nome do imóvel')).toHaveValue(PROPERTY_NAME);
    await expect(page.getByRole('button', { name: 'Cadastrar cliente' })).toBeFocused();
    await page.getByRole('button', { name: 'Cadastrar cliente' }).click();
    await page.getByLabel('Pessoa física').check();
    await page.getByLabel('Nome completo').fill(CLIENT_NAME);
    const cpfInput = page.getByLabel('CPF *');
    await cpfInput.fill('93541134780');
    await expect(cpfInput).toHaveValue('935.411.347-80');
    await page.locator('#client-celular').fill('48999996666');
    await page.getByRole('dialog', { name: /Novo cliente para o cadastro de propriedade/ }).getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
    const propertyDialog = page.getByRole('dialog', { name: 'Novo cadastro de propriedade' });
    await expect(propertyDialog).toBeVisible();
    await expect(page.getByLabel('Nome do imóvel')).toHaveValue(PROPERTY_NAME);
    await expect(propertyDialog.locator('#property-client')).toBeFocused();
    await expect(propertyDialog.locator('input[type="hidden"][name="clienteId"]')).not.toHaveValue('');
    await page.getByLabel('Nome do imóvel').focus();
    await expect(propertyDialog.locator('#property-client')).toHaveAttribute('aria-expanded', 'false');
    await expect(propertyDialog.locator('#property-client')).toHaveValue(CLIENT_NAME);
    await page.getByLabel('Matrícula').fill('E2E-12345');
    await page.getByLabel('Município').fill('Florianópolis');
    await page.getByLabel('Área (ha)').fill('12.5');

    await page.route('**/api/dados-operacionais/propriedades', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 350));
      return route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Criar propriedade' }).click();
    await expect(page.getByRole('button', { name: 'Salvando…' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Novo cadastro de propriedade' })).toBeVisible();
    await expect(page.getByRole('heading', { name: PROPERTY_NAME })).toBeVisible();
    await page.unroute('**/api/dados-operacionais/propriedades');

    await navigateInApp(page, '/orcamentos');
    await page.getByRole('button', { name: 'Novo orçamento' }).click();
    await expect(page).toHaveURL(/\/orcamentos\/novo\?retorno=/);
    await expect(page.getByRole('heading', { name: 'Novo orçamento', level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Novo orçamento' })).toHaveCount(0);
    await expect(page).toHaveTitle('Novo orçamento — GeoGestor');
    await page.locator('button[aria-controls="budget-section-client-content"]').click();
    await page.locator('#budget-client').click();
    await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click();
    const budgetClientValue = page.locator('select[name="clientId"]');
    const clientId = await budgetClientValue.inputValue();
    await page.locator('#budget-property').click();
    await expect(page.getByRole('option', { name: PROPERTY_NAME, exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Clientes', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('alterações não salvas');
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page).toHaveURL(/\/orcamentos\/novo\?retorno=/);
    await expect(budgetClientValue).toHaveValue(clientId);

    await page.getByRole('link', { name: 'Voltar para orçamentos' }).click();
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(page).toHaveURL(/\/orcamentos$/);

    const directBudgetPath = `/orcamentos/novo?clienteId=${encodeURIComponent(clientId)}&retorno=${encodeURIComponent('/orcamentos?status=rascunho&sort=valor_desc&page=2')}`;
    await navigateInApp(page, directBudgetPath);
    await expect(budgetClientValue).toHaveValue(clientId);
    await page.reload();
    const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
    if (await unlockHeading.isVisible()) {
      await page.getByLabel('Senha local').fill(PASSWORD);
      await page.getByRole('button', { name: 'Desbloquear' }).click();
    }
    await expect(page).toHaveURL(directBudgetPath);
    await expect(page.locator('select[name="clientId"]')).toHaveValue(clientId);
    await page.getByRole('link', { name: 'Voltar para orçamentos' }).click();
    await expect(page).toHaveURL(/\/orcamentos\?status=rascunho&sort=valor_desc&page=2$/);

    await navigateInApp(page, '/projetos');
    await page.getByRole('button', { name: 'Novo Projeto' }).first().click();
    await page.getByLabel('Cliente').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await page.getByRole('tab', { name: 'Imóvel e documentação' }).click();
    await page.getByLabel('Propriedade cadastrada').click();
    await expect(page.getByRole('option', { name: PROPERTY_NAME })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Novo projeto' }).getByRole('button', { name: 'Fechar modal' }).click();

    await navigateInApp(page, '/propriedades');
    await page.getByRole('button', { name: `Editar ${PROPERTY_NAME}` }).click();
    await page.getByLabel('Nome do imóvel').fill(UPDATED_PROPERTY_NAME);
    await expect(page.getByLabel('Nome do imóvel')).toHaveValue(UPDATED_PROPERTY_NAME);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar cadastro de propriedade' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: UPDATED_PROPERTY_NAME })).toBeVisible();

    await page.route('**/api/dados-operacionais/propriedades/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Falha simulada ao salvar propriedade. Tente novamente.' }) });
    });
    await page.getByRole('button', { name: `Editar ${UPDATED_PROPERTY_NAME}` }).click();
    await page.getByLabel('Nome do imóvel').fill('Rascunho de propriedade preservado');
    await expect(page.getByLabel('Nome do imóvel')).toHaveValue('Rascunho de propriedade preservado');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar cadastro de propriedade' })).toBeVisible();
    await expect(page.getByLabel('Nome do imóvel')).toHaveValue('Rascunho de propriedade preservado');
    await expect(page.getByText('Falha simulada ao salvar propriedade. Tente novamente.')).toBeVisible();
  });

  test('axe cobre todos os estados de modal em temas claro e escuro e o foco retorna ao acionador', async ({ page }) => {
    await navigateInApp(page, '/cadastros?aba=servicos&status=ativos');
    const newServiceButton = page.getByRole('button', { name: 'Novo tipo de serviço' });
    await newServiceButton.click();
    await expect(page.getByLabel('Nome do serviço')).toBeFocused();
    await expectDialogAccessibleInBothThemes(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar modal' }).click();
    await expectModalPortalRemoved(page);
    await expect(newServiceButton).toBeFocused();

    await page.getByRole('button', { name: `Editar ${UPDATED_SERVICE_NAME}` }).click();
    await expectDialogAccessibleInBothThemes(page);
    await page.keyboard.press('Escape');
    await expectModalPortalRemoved(page);

    await page.getByRole('tab', { name: /Categorias de despesa/ }).click();
    const newExpenseButton = page.getByRole('button', { name: 'Nova categoria de despesa' });
    await newExpenseButton.click();
    await expect(page.getByLabel('Categoria da despesa')).toBeFocused();
    await expectDialogAccessibleInBothThemes(page);
    await page.keyboard.press('Escape');
    await expectModalPortalRemoved(page);

    await page.getByRole('button', { name: `Editar ${EXPENSE_NAME}` }).click();
    await expectDialogAccessibleInBothThemes(page);
    await page.keyboard.press('Escape');
    await expectModalPortalRemoved(page);

    await page.getByRole('button', { name: `Inativar ${EXPENSE_NAME}` }).click();
    await expect(page.getByRole('alertdialog')).toHaveAccessibleDescription(/deixará de aparecer/);
    await expectDialogAccessibleInBothThemes(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
    await expectModalPortalRemoved(page);

    await newExpenseButton.click();
    await page.getByLabel('Descrição').fill('Rascunho para testar descarte acessível.');
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar modal' }).click();
    await expect(page.getByRole('alertdialog')).toHaveAccessibleName('Descartar alterações?');
    await expectDialogAccessibleInBothThemes(page);
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expectModalPortalRemoved(page);

    await navigateInApp(page, '/propriedades');
    const newPropertyButton = page.getByRole('button', { name: 'Novo cadastro de propriedade' });
    await newPropertyButton.click();
    await expect(page.locator('#property-client')).toBeFocused();
    await expectDialogAccessibleInBothThemes(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#property-client')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expectModalPortalRemoved(page);
    await expect(newPropertyButton).toBeFocused();

    await page.getByRole('button', { name: `Editar ${UPDATED_PROPERTY_NAME}` }).click();
    await expectDialogAccessibleInBothThemes(page);
    const modalClose = page.getByRole('dialog').getByRole('button', { name: 'Fechar modal' });
    await modalClose.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' })).toBeFocused();
    await page.keyboard.press('Escape');
  });

  test('cadastro de propriedade valida identificação e localização sem perder o rascunho', async ({ page }) => {
    await navigateInApp(page, '/propriedades');
    await expect(page.getByRole('heading', { name: 'Propriedades e imóveis' })).toBeVisible();
    await page.getByRole('button', { name: 'Novo cadastro de propriedade' }).click();
    await page.getByLabel('Nome do imóvel').fill('Imóvel incompleto');
    await page.getByRole('button', { name: 'Criar propriedade' }).click();
    await expect(page.getByText('Revise os campos indicados antes de salvar.')).toBeVisible();
    await expect(page.getByText('Informe o município.')).toBeVisible();
    await expect(page.getByText(/Informe ao menos uma identificação/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Descartar alterações');
  });
});
