import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const locked = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(locked).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Settings E2E');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Settings-E2E');
    await page.getByLabel('Nome do administrador').fill('Thalles Settings E2E');
    await page.getByLabel('E-mail').fill('settings@example.test');
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

test.describe.serial('Configurações confiáveis e acessíveis', () => {
  test('as oito seções têm URL própria, navegação por teclado e não geram overflow em 800 px', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 800, height: 520 });
    await navigate(page, '/configuracoes?secao=empresa');
    await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();

    const sections = [
      ['Empresa e usuário', 'empresa'],
      ['Arquivos e pastas', 'arquivos'],
      ['Backups', 'backups'],
      ['Alertas', 'alertas'],
      ['Modelos e documentos', 'modelos'],
      ['Integrações', 'integracoes'],
      ['Aparência', 'aparencia'],
      ['Manutenção e segurança', 'manutencao']
    ] as const;

    for (const [label, section] of sections) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => new URL(page.url()).searchParams.get('secao')).toBe(section);
      await expect(button).toHaveAttribute('aria-current', 'page');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    }

    const search = page.getByRole('searchbox', { name: 'Buscar nas configurações' });
    await search.fill('checksum');
    await page.getByRole('button', { name: /Restaurar e testar backup/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('secao')).toBe('backups');
    await expect(page.locator('#backup-actions')).toBeVisible();
  });

  test('campos principais possuem nomes acessíveis e a página passa WCAG 2.1 A/AA sem violações sérias', async ({ page }) => {
    await unlock(page);
    await navigate(page, '/configuracoes?secao=empresa');
    await expect(page.getByLabel('Nome da empresa')).toBeVisible();
    await expect(page.getByLabel('Nome completo do responsável')).toBeVisible();
    await expect(page.getByLabel('E-mail operacional')).toBeVisible();
    for (const section of ['empresa', 'arquivos', 'backups', 'alertas', 'modelos', 'integracoes', 'aparencia', 'manutencao']) {
      await navigate(page, `/configuracoes?secao=${section}`);
      await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'), `${section}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
    }
  });

  test('avisa antes de descartar alterações e registra evidência visual', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 800, height: 520 });
    await navigate(page, '/configuracoes?secao=empresa');
    await page.getByLabel('Nome da empresa').fill('Alteração ainda não salva');
    await expect(page.getByText('Alterações não salvas', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Descartar alterações' })).toBeEnabled();
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('alterações não salvas');
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Backups', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('secao')).toBe('empresa');

    const evidence = path.join(process.cwd(), 'scratch', 'settings-audit');
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'configuracoes-800px.png'), fullPage: false, animations: 'disabled' });
  });
});
