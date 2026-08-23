import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

const completedAt = '2026-08-22T15:00:00.000Z';

function backupStatus() {
  return {
    policy: {
      destinationDirectory: 'D:\\GeoGestor Backups\\SkyGeo',
      automaticEnabled: true,
      changeDebounceMinutes: 5,
      databaseIntervalHours: 6,
      completeIntervalDays: 1,
      retention: 7,
      retentionRecentHours: 24,
      retentionDailyDays: 30,
      retentionMonthlyMonths: 12,
      maxStorageBytes: 0,
      overdueGraceHours: 12,
      runOnStartup: true,
      runOnShutdown: true,
      runRestoreTests: true,
      restoreTestIntervalDays: 30
    },
    storage: {
      backupDirectory: 'D:\\GeoGestor Backups\\SkyGeo',
      versions: 1,
      totalBytes: 48 * 1024 * 1024,
      availableBytes: 500 * 1024 * 1024,
      history: [
        {
          directory: 'backup-2026-08-22',
          type: 'complete',
          createdAt: completedAt,
          completedAt,
          files: 18,
          bytes: 48 * 1024 * 1024,
          integrity: 'verified',
          integrityState: 'verified_again',
          integrityVerifiedAt: completedAt,
          restoreTestedAt: null,
          credentialsExcluded: true,
          encrypted: true
        }
      ]
    },
    activity: { pendingChanges: 0, lastChangeAt: completedAt, lastProtectedAt: completedAt },
    device: { id: 'device-a11y-e2e', name: 'Estação SkyGeo' },
    cloud: {
      confirmation: 'unavailable',
      message: 'A pasta está configurada, mas o provedor externo não pode ser confirmado automaticamente.',
      confirmedAt: null,
      error: null
    },
    recovery: {
      configured: true,
      confirmed: false,
      confirmedAt: null,
      keyId: 'key-a11y-e2e',
      state: 'not_confirmed'
    },
    database: { attemptedAt: completedAt, completedAt, nextAt: '2026-08-22T21:00:00.000Z', durationMs: 1200, totalBytes: 1024, totalFiles: 1, status: 'current', error: null },
    complete: { attemptedAt: completedAt, completedAt, nextAt: '2026-08-23T15:00:00.000Z', durationMs: 2400, totalBytes: 48 * 1024 * 1024, totalFiles: 18, status: 'current', error: null },
    restoreTest: null,
    activeOperation: null as null | Record<string, unknown>,
    protection: {
      local: {
        state: 'current',
        lastBackupAt: completedAt,
        integrity: 'verified',
        verifiedAt: completedAt
      },
      external: { state: 'configured_unverified', message: 'Destino configurado, sem confirmação.' },
      recovery: { state: 'not_confirmed' },
      restoreTest: { state: 'never_tested', completedAt: null, durationMs: null },
      objectives: { maximumUnprotectedMinutes: 5, observedRestoreTimeMs: null }
    },
    summary: {
      state: 'recovery_incomplete',
      configured: true,
      pendingChanges: 0,
      lastBackupAt: completedAt,
      integrity: 'verified',
      label: 'Backup local íntegro; recuperação pendente',
      description: 'Se este computador for perdido, o kit ainda precisa estar validado fora dele.'
    }
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const locked = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(locked).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Backup E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Backup-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles Backup E2E');
    await page.getByLabel('E-mail').fill('backup@example.test');
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

function visibleBackupTrigger(page: Page) {
  return page.locator('button[aria-label^="Status do backup:"]:visible').first();
}

async function navigate(page: Page, target: string) {
  await page.evaluate((next) => {
    history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, target);
}

test.describe('proteção dos dados', () => {
  test('mantém um CTA primário, reflow sem overflow e leva os detalhes para Ferramentas', async ({ page }) => {
    const status = backupStatus();
    await page.route('**/api/sistema/backups/status', (route) => fulfillJson(route, status));
    await unlock(page);

    const trigger = visibleBackupTrigger(page);
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Proteção dos dados' });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await dialog.boundingBox())?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(448);
    await expect(dialog.locator('[data-backup-primary-action="true"]')).toHaveCount(1);
    await expect(dialog.locator('[data-backup-primary-action="true"]')).toHaveText(
      'Validar kit de recuperação'
    );
    await expect(dialog.locator('section[aria-labelledby="backup-summary-title"] button')).toHaveCount(0);
    await expect(dialog.getByText('Jornada de proteção')).toHaveCount(0);
    await expect(dialog.getByText('Recuperação de emergência')).toHaveCount(0);
    await expect(dialog.getByText('Detalhes técnicos')).toHaveCount(0);
    await expect(dialog.getByText('Destino', { exact: true })).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1536, height: 960 },
      { width: 640, height: 720 }
    ]) {
      await page.setViewportSize(viewport);
      await expect.poll(() =>
        dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)
      ).toBe(true);
    }

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
      .analyze();
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);

    await dialog.getByRole('link', { name: 'Ver detalhes do backup' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/configuracoes\?secao=backups&foco=backup-protection-details-title/);
    const detailsTitle = page.getByRole('heading', { name: 'Backup e proteção de dados' });
    await expect(detailsTitle).toBeVisible();
    await expect(detailsTitle).toBeFocused();
    await expect(page.getByText('Jornada de proteção', { exact: true })).toBeVisible();
    await expect(page.getByText('Recuperação de emergência')).toBeVisible();
  });

  test('controles da política têm alvos de 44 px, nomes humanos e teclado funcional', async ({ page }) => {
    const status = backupStatus();
    await page.route('**/api/sistema/backups/status', (route) => fulfillJson(route, status));
    await unlock(page);
    await navigate(page, '/configuracoes?secao=backups');
    await expect(page.getByRole('heading', { name: 'Backup e proteção de dados' })).toBeVisible();

    const decrement = page.getByRole('button', { name: 'Diminuir tempo de consolidação' });
    const increment = page.getByRole('button', { name: 'Aumentar tempo de consolidação' });
    const input = page.getByLabel('Consolidar alterações após (minutos)');
    for (const control of [decrement, increment]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      const visibleSurface = await control.locator('span').boundingBox();
      expect(visibleSurface?.width).toBe(32);
      expect(visibleSurface?.height).toBe(32);
    }
    await expect(input).toHaveValue('5');
    await increment.focus();
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('6');
    await expect(increment).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('7');
    await decrement.focus();
    await page.keyboard.press('Space');
    await expect(input).toHaveValue('6');
    await expect(decrement).toBeFocused();
    await page.keyboard.press('Space');
    await expect(input).toHaveValue('5');

    const automatic = page.getByRole('checkbox', { name: /Backup automático/i });
    const automaticTarget = page.locator('label[for="backup-automatic-enabled"]');
    expect((await automaticTarget.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await automatic.focus();
    await page.keyboard.press('Space');
    await expect(automatic).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(automatic).toBeChecked();

    const runRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!runRoot || !/^run-[a-z0-9-]+$/i.test(path.basename(runRoot))) {
      throw new Error('GEOGESTOR_E2E_ROOT deve apontar para a execução gerenciada.');
    }
    const evidence = path.join(runRoot, 'backup-ui-audit');
    mkdirSync(evidence, { recursive: true });
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      }, theme);
      for (const viewport of [{ width: 1536, height: 960 }, { width: 800, height: 520 }]) {
        await page.setViewportSize(viewport);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
        const advancedGrid = page.locator('[aria-label="Configurações e informações avançadas de proteção"]');
        await expect(advancedGrid.locator(':scope > details')).toHaveCount(4);
        const columns = await advancedGrid.evaluate((element) =>
          window.getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
        );
        expect(columns).toBe(viewport.width >= 1280 ? 2 : 1);
        await page.screenshot({
          path: path.join(evidence, `backup-${theme}-${viewport.width}x${viewport.height}.png`),
          fullPage: false,
          animations: 'disabled'
        });
      }
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
        .analyze();
      expect(axe.violations, `${theme}: ${JSON.stringify(axe.violations, null, 2)}`).toEqual([]);
    }

    const visibleHeadingLevels = await page.locator('h1:visible, h2:visible, h3:visible, h4:visible').evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1)))
    );
    for (let index = 1; index < visibleHeadingLevels.length; index += 1) {
      expect(visibleHeadingLevels[index] - visibleHeadingLevels[index - 1]).toBeLessThanOrEqual(1);
    }
  });

  test('exibe skeleton e recupera uma consulta que falhou', async ({ page }) => {
    const status = backupStatus();
    let releaseFirstRequest: (() => void) | undefined;
    const firstRequestGate = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    let mode: 'loading' | 'error' | 'success' = 'loading';

    await page.route('**/api/sistema/backups/status', async (route) => {
      if (mode === 'loading') {
        await firstRequestGate;
        mode = 'error';
      }
      if (mode === 'error') {
        await fulfillJson(route, { message: 'Falha sintética' }, 500);
        return;
      }
      await fulfillJson(route, status);
    });

    await unlock(page);
    const trigger = visibleBackupTrigger(page);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Proteção dos dados' });
    await expect(dialog.getByText('Consultando o estado do backup…')).toBeVisible();

    releaseFirstRequest?.();
    await expect(dialog.getByRole('alert')).toContainText('Não foi possível consultar');
    mode = 'success';
    await dialog.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(dialog.getByText('Último backup')).toBeVisible();
    await expect(dialog.getByText('Jornada de proteção')).toHaveCount(0);
  });

  test('permite fechar durante etapa não cancelável e oferece cancelamento quando seguro', async ({ page }) => {
    const status = backupStatus();
    const operation = {
      id: 'operation-a11y-e2e',
      type: 'backup_complete',
      status: 'running',
      stage: 'Verificando arquivos',
      startedAt: new Date(Date.now() - 5_000).toISOString(),
      processedFiles: 5,
      processedBytes: 50,
      totalFiles: 10,
      totalBytes: 100,
      cancelRequested: false,
      cancellable: false
    };
    status.activeOperation = operation;
    status.summary.state = 'running';
    status.summary.label = 'Backup em andamento';

    await page.route('**/api/sistema/backups/status', (route) => fulfillJson(route, status));
    await page.route('**/api/sistema/operacoes/*/cancelar', async (route) => {
      operation.cancelRequested = true;
      await fulfillJson(route, { accepted: true });
    });
    await unlock(page);
    const trigger = visibleBackupTrigger(page);
    const tooltipId = await trigger.getAttribute('aria-describedby');
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Proteção dos dados' });
    const progress = dialog.getByRole('progressbar', { name: 'Progresso da operação de backup' });
    await expect(progress).toHaveAttribute('aria-valuenow', '50');
    await expect(dialog.getByRole('button', { name: 'Fechar modal' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator(`[id="${tooltipId}"]`)).toBeHidden();

    await trigger.click();
    await expect(dialog.locator('[data-backup-primary-action="true"]')).toHaveCount(0);

    operation.cancellable = true;
    await expect(dialog.getByRole('button', { name: 'Cancelar com segurança' })).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Cancelar com segurança' }).click();
    await expect(dialog.getByText('Cancelamento solicitado', { exact: true })).toBeVisible();
  });
});
