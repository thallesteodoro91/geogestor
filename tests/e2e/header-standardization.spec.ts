import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

function managedCaptureDirectory() {
  const runRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!runRoot || !/^run-[a-z0-9-]+$/i.test(path.basename(runRoot))) {
    throw new Error('GEOGESTOR_E2E_ROOT deve apontar para a execução comercial gerenciada.');
  }
  return path.join(runRoot, 'header-audit');
}

const routes = [
  { path: '/', heading: 'Visão Geral' },
  { path: '/clientes', heading: 'Clientes' },
  { path: '/crm', heading: 'CRM' },
  { path: '/orcamentos', heading: 'Orçamentos' },
  { path: '/projetos', heading: 'Projetos' },
  { path: '/ambiental', heading: 'Gestão Ambiental e Perícias' },
  { path: '/financeiro', heading: 'Financeiro' },
  { path: '/calendario', heading: 'Calendário' },
  { path: '/tarefas', heading: 'Tarefas' },
  { path: '/topografia', heading: 'Topografia' },
  { path: '/importacao', heading: 'Importação de dados' },
  { path: '/relatorios', heading: 'Relatórios' },
  { path: '/planejamento', heading: 'Planejamento estratégico' },
  { path: '/cadastros', heading: 'Cadastros Auxiliares' },
  { path: '/configuracoes', heading: 'Configurações' },
  { path: '/audit-logs', heading: 'Auditoria de Logs' },
  { path: '/ajuda', heading: 'Central de Ajuda' },
] as const;

async function unlock(page: Page) {
  await page.goto('/');
  const setupHeading = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboardHeading = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setupHeading.or(unlockHeading).or(dashboardHeading)).toBeVisible();

  if (await setupHeading.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Header Audit');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Header-Audit');
    await page.getByLabel('Nome do administrador').fill('Thalles Header Audit');
    await page.getByLabel('E-mail').fill('header.audit@example.test');
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

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((nextTheme) => {
    localStorage.setItem('geogestor_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, theme);
}

async function navigate(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
}

async function auditCurrentHeader(page: Page, wide: boolean) {
  const metrics = await page.locator('main').evaluate((main) => {
    const header = main.querySelector<HTMLElement>('header');
    const frame = header?.firstElementChild as HTMLElement | null;
    const heading = header?.querySelector<HTMLElement>('h1');
    if (!header || !frame || !heading) throw new Error('Cabeçalho compartilhado não encontrado.');

    const navigation = [...main.querySelectorAll<HTMLElement>('nav, [role="tablist"]')]
      .find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.height > 0 && rect.top >= heading.getBoundingClientRect().top;
      });
    const primaryAction = header.querySelector<HTMLElement>('.geo-button-primary');
    const filterBar = main.querySelector<HTMLElement>('section[aria-label="Busca e filtros"]');
    const filterControls = filterBar
      ? [...filterBar.querySelectorAll<HTMLElement>('input, select, button')]
        .filter((element) => (
          element.getBoundingClientRect().height > 4
          && (!element.closest('.geo-numeric-input') || element.matches('input'))
        ))
        .map((element) => ({
          height: element.getBoundingClientRect().height,
          tag: element.tagName,
          label: element.getAttribute('aria-label') || element.textContent?.trim() || '',
          className: element.className,
        }))
      : [];
    const headingStyle = getComputedStyle(heading);

    return {
      frameWidth: Math.round(frame.getBoundingClientRect().width),
      headingTop: heading.getBoundingClientRect().top,
      navigationTop: navigation?.getBoundingClientRect().top ?? null,
      primaryActionHeight: primaryAction?.getBoundingClientRect().height ?? null,
      filterControlHeights: filterControls,
      fontSize: Number.parseFloat(headingStyle.fontSize),
      lineHeight: Number.parseFloat(headingStyle.lineHeight),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

  expect(metrics.frameWidth).toBeLessThanOrEqual(1400);
  expect(metrics.horizontalOverflow).toBe(false);
  expect(metrics.lineHeight).toBe(40);
  expect(metrics.fontSize).toBe(wide ? 36 : 30);
  if (metrics.navigationTop !== null) expect(metrics.headingTop).toBeLessThan(metrics.navigationTop);
  if (metrics.primaryActionHeight !== null) expect(metrics.primaryActionHeight).toBe(44);
  for (const control of metrics.filterControlHeights) {
    expect(control.height, JSON.stringify(control)).toBe(40);
  }
}

test.describe('padronização dos cabeçalhos principais', () => {
  test.setTimeout(180_000);

  test('as 17 rotas preservam ordem, dimensões e ausência de overflow em três larguras', async ({ page }) => {
    await unlock(page);

    const scenarios = [
      { width: 1920, height: 1080, theme: 'light' as const, wide: true },
      { width: 1366, height: 768, theme: 'dark' as const, wide: true },
      { width: 390, height: 844, theme: 'light' as const, wide: false },
    ];

    for (const scenario of scenarios) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await setTheme(page, scenario.theme);

      for (const route of routes) {
        await navigate(page, route.path);
        await expect(page.locator('main header h1')).toContainText(route.heading);
        await auditCurrentHeader(page, scenario.wide);

        if (scenario.width === 1366) {
          const filterButton = page.getByRole('button', { name: /^Filtros(?:\s+\d+)?$/ }).first();
          if (await filterButton.isVisible().catch(() => false)) {
            await filterButton.click();
            await expect(filterButton).toHaveAttribute('aria-expanded', 'true');
            await auditCurrentHeader(page, scenario.wide);
            await filterButton.click();
            await expect(filterButton).toHaveAttribute('aria-expanded', 'false');
          }
        }
      }
    }
  });

  test('filtros ambientais preservam o parâmetro de busca na URL', async ({ page }) => {
    await unlock(page);
    await navigate(page, '/ambiental');
    const search = page.getByPlaceholder('Buscar por demanda, cliente, órgão ou processo…');
    await search.fill('licença');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('licença');
    await page.getByRole('button', { name: 'Filtros' }).click();
    await expect(page.getByRole('button', { name: 'Limpar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
  });

  test('Topografia e Importação preservam alinhamento após a reorganização da navegação', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await setTheme(page, 'dark');

    await navigate(page, '/topografia');
    await expect(page.locator('main header h1')).toContainText('Topografia');
    const topographyMetrics = await page.locator('main').evaluate((main) => {
      const header = main.querySelector<HTMLElement>('header');
      const description = header?.querySelector<HTMLElement>('p');
      const toolNavigation = header?.querySelector<HTMLElement>('[role="tablist"]');
      const toolIcon = toolNavigation?.querySelector<HTMLElement>('button span');
      if (!header || !description || !toolNavigation || !toolIcon) {
        throw new Error('Estrutura de topografia incompleta.');
      }

      return {
        descriptionHeight: description.getBoundingClientRect().height,
        descriptionBottom: description.getBoundingClientRect().bottom,
        toolTop: toolNavigation.getBoundingClientRect().top,
        toolIconBackground: getComputedStyle(toolIcon).backgroundColor,
      };
    });

    expect(topographyMetrics.descriptionHeight).toBe(24);
    expect(topographyMetrics.toolTop - topographyMetrics.descriptionBottom).toBeGreaterThanOrEqual(14);
    expect(topographyMetrics.toolTop - topographyMetrics.descriptionBottom).toBeLessThanOrEqual(18);
    expect(topographyMetrics.toolIconBackground).toBe('rgba(0, 0, 0, 0)');

    const areaTabBox = await page.getByRole('tab', { name: 'Área e perímetro' }).boundingBox();
    const saveCalculationBox = await page.getByRole('button', { name: 'Salvar cálculo' }).boundingBox();
    const topographyHeaderBox = await page.locator('main header').boundingBox();
    const spatialReferenceBox = await page.locator('section[aria-labelledby="spatial-reference-title"]').boundingBox();
    const converterPanelBox = await page.locator('#topography-panel-conversor').boundingBox();
    expect(areaTabBox).not.toBeNull();
    expect(saveCalculationBox).not.toBeNull();
    expect(topographyHeaderBox).not.toBeNull();
    expect(spatialReferenceBox).not.toBeNull();
    expect(converterPanelBox).not.toBeNull();
    expect(Math.abs(
      areaTabBox!.y + areaTabBox!.height / 2 - (saveCalculationBox!.y + saveCalculationBox!.height / 2),
    )).toBeLessThanOrEqual(1);
    expect(spatialReferenceBox!.y - (topographyHeaderBox!.y + topographyHeaderBox!.height)).toBeGreaterThanOrEqual(14);
    expect(spatialReferenceBox!.y - (topographyHeaderBox!.y + topographyHeaderBox!.height)).toBeLessThanOrEqual(18);
    expect(converterPanelBox!.y - (spatialReferenceBox!.y + spatialReferenceBox!.height)).toBeGreaterThanOrEqual(14);
    expect(converterPanelBox!.y - (spatialReferenceBox!.y + spatialReferenceBox!.height)).toBeLessThanOrEqual(18);

    await navigate(page, '/configuracoes');
    await expect(page.getByRole('link', { name: 'Importação de dados' })).toBeVisible();

    await navigate(page, '/importacao');
    await expect(page.locator('main header h1')).toContainText('Importação de dados');
    await expect(page.locator('main header')).toContainText('Configurações');
    await expect(page.getByRole('link', { name: 'Configurações', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Topografia', exact: true })).not.toHaveAttribute('aria-current', 'page');
    const importAlignment = await page.locator('main').evaluate((main) => {
      const frame = main.querySelector<HTMLElement>('header > div');
      const steps = main.querySelector<HTMLElement>('ol[aria-label="Etapas da importação"]');
      if (!frame || !steps) throw new Error('Estrutura de importação incompleta.');
      const frameRect = frame.getBoundingClientRect();
      const stepsRect = steps.getBoundingClientRect();
      return {
        leftDifference: Math.abs(frameRect.left - stepsRect.left),
        widthDifference: Math.abs(frameRect.width - stepsRect.width),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    expect(importAlignment.leftDifference).toBeLessThanOrEqual(1);
    expect(importAlignment.widthDifference).toBeLessThanOrEqual(1);
    expect(importAlignment.horizontalOverflow).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/topografia', '/importacao']) {
      await navigate(page, route);
      await expect(page.locator('main header h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    }
  });

  test('gera as capturas comparativas solicitadas', async ({ page }) => {
    await unlock(page);
    const captureDirectory = managedCaptureDirectory();
    mkdirSync(captureDirectory, { recursive: true });
    await page.setViewportSize({ width: 1600, height: 900 });
    await setTheme(page, 'light');

    const captures = [
      { path: '/ambiental', name: 'ambiental', heading: 'Gestão Ambiental e Perícias' },
      { path: '/clientes', name: 'clientes', heading: 'Clientes' },
      { path: '/orcamentos', name: 'orcamentos', heading: 'Orçamentos' },
      { path: '/tarefas', name: 'tarefas', heading: 'Tarefas' },
      { path: '/topografia', name: 'topografia', heading: 'Topografia' },
      { path: '/importacao', name: 'importacao', heading: 'Importação de dados' },
    ] as const;

    for (const capture of captures) {
      await navigate(page, capture.path);
      await expect(page.locator('main header h1')).toContainText(capture.heading);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(captureDirectory, `${capture.name}-desktop.png`),
        fullPage: false,
        animations: 'disabled',
      });
    }

    for (const capture of captures.filter((item) => item.name === 'clientes' || item.name === 'orcamentos')) {
      await navigate(page, capture.path);
      await expect(page.locator('main header h1')).toContainText(capture.heading);
      const filterButton = page.getByRole('button', { name: /^Filtros(?:\s+\d+)?$/ }).first();
      await filterButton.click();
      await expect(filterButton).toHaveAttribute('aria-expanded', 'true');
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(captureDirectory, `${capture.name}-filtros-abertos.png`),
        fullPage: false,
        animations: 'disabled',
      });
    }

    const toolCaptures = captures.filter((item) => item.name === 'topografia' || item.name === 'importacao');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const capture of toolCaptures) {
      await navigate(page, capture.path);
      await expect(page.locator('main header h1')).toContainText(capture.heading);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(captureDirectory, `${capture.name}-mobile.png`),
        fullPage: false,
        animations: 'disabled',
      });
    }

    await page.setViewportSize({ width: 1366, height: 768 });
    await setTheme(page, 'dark');
    await navigate(page, '/importacao');
    await expect(page.locator('main header h1')).toContainText('Importação de dados');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(captureDirectory, 'importacao-dark.png'),
      fullPage: false,
      animations: 'disabled',
    });
  });
});
