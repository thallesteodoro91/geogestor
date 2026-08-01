import AxeBuilder from '@axe-core/playwright';
import type { ManagerialReport } from '@geogestor/contracts';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const locked = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(locked).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Reports E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Reports-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles Reports E2E');
    await page.getByLabel('E-mail').fill('reports.e2e@example.test');
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

function fixture(overrides: Partial<ManagerialReport['state']> = {}): ManagerialReport {
  return {
    generatedAt: '2026-07-30T12:00:00.000Z',
    period: {
      startDate: '2026-07-01',
      endDate: '2026-07-30',
      previousStartDate: '2026-06-01',
      previousEndDate: '2026-06-30',
      label: '2026-07-01 a 2026-07-30',
      comparisonLabel: '2026-06-01 a 2026-06-30',
      rules: {
        contractedRevenue: 'Competência do orçamento.',
        receivedRevenue: 'Regime de caixa por data do recebimento.',
        pendingRevenue: 'Competência da parcela.',
        paidExpenses: 'Regime de caixa por data do pagamento.',
        projects: 'Coorte por data de início.',
        activeArea: 'Somente áreas conhecidas.'
      }
    },
    state: {
      hasSourceData: true,
      hasFilteredData: true,
      sourceRecordCount: 4500,
      filteredRecordCount: 3100,
      ...overrides
    },
    financial: {
      kpis: {
        contractedRevenue: 2_000_000,
        receivedRevenue: 1_500_000,
        pendingRevenue: 500_000,
        overdueRevenue: 100_000,
        paidExpenses: 900_000,
        cashResult: 600_000,
        estimatedTaxes: 120_000,
        approvedBudgets: 18,
        decidedBudgets: 30,
        conversionRate: 60
      },
      previous: {
        contractedRevenue: 1_800_000,
        receivedRevenue: 1_200_000,
        paidExpenses: 800_000,
        cashResult: 400_000
      },
      monthly: [{ month: '2026-07', receivedRevenue: 1_500_000, paidExpenses: 900_000, cashResult: 600_000 }],
      expensesByCategory: [{
        category: 'Deslocamentos, hospedagens e alimentação de equipes em levantamentos de campo',
        paidTotal: 900_000,
        launchedTotal: 900_000,
        count: 1200
      }],
      alerts: [{
        id: 'overdue',
        code: 'overdue_revenue',
        severity: 'critical',
        href: '/financeiro',
        valueCents: 100_000
      }]
    },
    operational: {
      kpis: {
        totalProjects: 2500,
        activeProjects: 1800,
        completedProjects: 650,
        cancelledProjects: 50,
        overdueProjects: 1,
        dueSoonProjects: 2,
        activeAreaHa: 0,
        projectsWithKnownArea: 1799
      },
      previousCompletedProjects: 500,
      byStatus: [{ label: 'Em andamento com dependência de análise externa', count: 1800 }],
      byType: [{ label: 'Georreferenciamento', count: 2500 }],
      byMunicipality: [{ label: 'Florianópolis', count: 2500 }],
      deadlines: [{
        id: 'project-1',
        name: 'Projeto com uma descrição deliberadamente longa para validar quebra de linha',
        status: 'Em andamento',
        dueDate: '2026-07-20',
        daysUntilDue: -10
      }],
      alerts: [{
        id: 'deadline',
        code: 'overdue_projects',
        severity: 'critical',
        href: '/projetos',
        count: 1
      }]
    }
  };
}

async function mockReport(page: Page, report = fixture()) {
  await page.route('**/api/relatorios/geral*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(report) });
  });
}

async function navigate(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test.describe.serial('relatórios gerenciais', () => {
  test.beforeEach(async ({ page }) => {
    await unlock(page);
  });

  test('preserva URL, atalhos, teclado, leitura acessível e impressão', async ({ page }) => {
    await mockReport(page);
    await navigate(page, '/relatorios?inicio=2026-07-01&fim=2026-07-30');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await expect(page).toHaveURL(/inicio=2026-07-01.*fim=2026-07-30/);
    await expect(page.locator('#report-panel')).toHaveAttribute('data-report-type', 'financeiro');
    await expect(page.getByRole('heading', { name: 'Caixa e recebíveis' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Personalizado' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#custom-period-fields')).toBeVisible();
    await page.getByRole('button', { name: 'Todo o histórico' }).click();
    await expect(page).not.toHaveURL(/inicio=/);
    await expect(page.locator('#custom-period-fields')).not.toBeAttached();

    await page.getByRole('button', { name: 'Personalizado' }).click();
    await expect(page).toHaveURL(/periodo=personalizado/);
    await expect(page.locator('#custom-period-fields')).toBeVisible();
    await page.getByRole('button', { name: 'Todo o histórico' }).click();

    const financialTab = page.getByRole('tab', { name: 'Financeiro' });
    await financialTab.focus();
    await financialTab.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Projetos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tipo=projetos/);
    await expect(page.locator('#report-panel')).toHaveAttribute('data-report-type', 'projetos');
    await expect(page.getByRole('heading', { name: 'Carteira de projetos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Caixa e recebíveis' })).not.toBeVisible();

    await page.getByRole('tab', { name: 'Executivo' }).click();
    await expect(page.locator('#report-panel')).toHaveAttribute('data-report-type', 'executivo');
    await expect(page.getByRole('heading', { name: 'O que merece sua atenção neste período' })).toBeVisible();
    await expect(page.getByText('Recebimentos vencidos exigem atenção')).toBeVisible();

    await page.getByRole('button', { name: 'Pré-visualização do documento' }).click();
    await expect(page.locator('[data-report-document]').first()).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-report-document]').last()).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
  });

  test('mantém o conteúdo estável em celular, tablet e desktop', async ({ page }) => {
    await mockReport(page);
    for (const viewport of [
      { width: 360, height: 720 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      await navigate(page, '/relatorios');
      await expect(page.getByRole('tab', { name: 'Financeiro' })).toBeVisible();
      const overflow = await page.locator('main').evaluate((main) => main.scrollWidth > main.clientWidth + 1);
      expect(overflow).toBe(false);
    }
  });

  test('diferencia carregamento, erro recuperável, base vazia e recorte sem resultados', async ({ page }) => {
    let attempt = 0;
    await page.route('**/api/relatorios/geral*', async (route) => {
      attempt += 1;
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha controlada"}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture({
        hasSourceData: false,
        hasFilteredData: false,
        sourceRecordCount: 0,
        filteredRecordCount: 0
      })) });
    });
    await navigate(page, '/relatorios');
    await expect(page.getByText('Carregando relatório…')).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o relatório' })).toBeVisible();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { name: 'Ainda não há dados financeiros para analisar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cadastrar orçamento' })).toHaveAttribute('href', '/orcamentos');
    await expect(page.getByRole('link', { name: 'Registrar recebimento' })).toHaveAttribute('href', '/financeiro?tab=faturas');
    await expect(page.getByRole('link', { name: 'Adicionar despesa' })).toHaveAttribute('href', '/financeiro?tab=pagar');
    await page.getByRole('tab', { name: 'Projetos' }).click();
    await expect(page.getByRole('heading', { name: 'Ainda não há projetos para analisar' })).toBeVisible();
  });
});
