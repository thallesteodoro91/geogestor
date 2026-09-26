import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eDataDirectory } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const locked = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(locked).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Settings E2E');
    await page.getByLabel('Pasta de dados').fill(e2eDataDirectory());
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

test.describe('Configurações confiáveis e acessíveis', () => {
  test('as nove seções têm URL própria, navegação por teclado e não geram overflow em 800 px', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 800, height: 520 });
    await navigate(page, '/configuracoes?secao=empresa');
    await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();

    const sections = [
      ['Empresa e usuário', 'empresa'],
      ['Arquivos e pastas', 'arquivos'],
      ['Segurança', 'seguranca'],
      ['Alertas', 'alertas'],
      ['Modelo dos PDFs', 'modelos'],
      ['Integrações', 'integracoes'],
      ['Aparência', 'aparencia'],
      ['Manutenção e segurança', 'manutencao'],
      ['Backup e proteção', 'backups']
    ] as const;

    for (const [index, [label, section]] of sections.entries()) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.focus();
      await page.keyboard.press(index % 2 === 0 ? 'Enter' : 'Space');
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

  test('campos principais possuem nomes acessíveis e a página passa WCAG 2.2 A/AA sem violações', async ({ page }) => {
    await unlock(page);
    await navigate(page, '/configuracoes?secao=empresa');
    await expect(page.getByLabel('Nome da empresa')).toBeVisible();
    await expect(page.getByLabel('Nome completo do responsável')).toBeVisible();
    await expect(page.getByLabel('E-mail operacional')).toBeVisible();
    for (const section of ['empresa', 'arquivos', 'seguranca', 'backups', 'alertas', 'modelos', 'integracoes', 'aparencia', 'manutencao']) {
      await navigate(page, `/configuracoes?secao=${section}`);
      await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
        .analyze();
      expect(results.violations, `${section}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
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
    await page.getByRole('button', { name: 'Backup e proteção', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('secao')).toBe('empresa');

    const runRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!runRoot || !/^run-[a-z0-9-]+$/i.test(path.basename(runRoot))) {
      throw new Error('GEOGESTOR_E2E_ROOT deve apontar para a execução comercial gerenciada.');
    }
    const evidence = path.join(runRoot, 'settings-audit');
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'configuracoes-800px.png'), fullPage: false, animations: 'disabled' });
  });

  test('modelo dos PDFs valida campos, restaura e descarta alterações com segurança', async ({ page }) => {
    await unlock(page);
    await navigate(page, '/configuracoes?secao=modelos');
    await expect(page.getByRole('heading', { name: 'Padrão visual dos PDFs' })).toBeVisible();

    const email = page.getByLabel('E-mail comercial');
    const originalEmail = await email.inputValue();
    await email.fill('email-inválido');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Informe um e-mail válido.', { exact: true })).toBeVisible();
    await expect(email).toBeFocused();
    await expect(email).toHaveValue('email-inválido');

    const companyName = page.getByLabel('Razão social / nome no PDF');
    await email.fill('modelo@example.test');
    await companyName.fill('Modelo persistido para descarte');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Salvo com sucesso', { exact: true })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Restaurar os padrões do modelo');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Restaurar padrões' }).click();
    await expect(page.getByText('Alterações não salvas', { exact: true })).toBeVisible();
    await expect(companyName).toHaveValue('');

    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(email).toHaveValue('modelo@example.test');
    await expect(companyName).toHaveValue('Modelo persistido para descarte');
    await expect(page.getByText('Tudo salvo', { exact: true })).toBeVisible();
    expect(originalEmail).not.toBe('email-inválido');
  });

  test('confirmação destrutiva exige a frase exata, inclusive caixa e espaços', async ({ page }) => {
    await unlock(page);
    await navigate(page, '/configuracoes?secao=manutencao');
    await page.getByRole('button', { name: 'Apagar dados operacionais' }).click();
    const confirmation = page.getByLabel(/Digite APAGAR DADOS DO GEOGESTOR/);
    const submit = page.getByRole('button', { name: 'Confirmar Exclusão Total' });

    await confirmation.fill('apagar dados do geogestor');
    await expect(submit).toBeDisabled();
    await confirmation.fill(' APAGAR DADOS DO GEOGESTOR ');
    await expect(submit).toBeDisabled();
    await confirmation.fill('APAGAR DADOS DO GEOGESTOR');
    await expect(submit).toBeEnabled();
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('acesso direto mobile revela a aba ativa e o upload é acionável por teclado', async ({ page }) => {
    await unlock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(page, '/configuracoes?secao=modelos');
    const activeTab = page.getByRole('button', { name: 'Modelo dos PDFs', exact: true });
    await expect(activeTab).toHaveAttribute('aria-current', 'page');
    await expect(activeTab).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);

    const upload = page.getByRole('button', { name: /Enviar logotipo|Substituir imagem/ });
    await upload.focus();
    await expect(upload).toBeFocused();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(false);
    await expect(page.locator('#template-logo-file')).toBeAttached();
  });
});
