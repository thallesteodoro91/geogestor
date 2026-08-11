import { expect, test, type Page, type Route } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';
const selectedClientId = '11111111-1111-4111-8111-111111111111';

async function unlock(page: Page) {
  await page.goto('/');
  const setup = page.getByRole('heading', { name: 'Bem-vindo ao GeoGestor' });
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboard = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(setup.or(unlock).or(dashboard)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel('Nome da empresa').fill('SkyGeo Import Audit');
    await page.getByLabel('Pasta de dados').fill('~/GeoGestor-Import-Audit');
    await page.getByLabel('Nome do administrador').fill('Thalles Import Audit');
    await page.getByLabel('E-mail').fill('import.audit@example.test');
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Concluir configuração' }).click();
    await expect(unlock.or(dashboard)).toBeVisible();
  }
  if (await unlock.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboard).toBeVisible();
}

async function navigate(page: Page, path: string) {
  await page.evaluate(nextPath => {
    history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function selectCustomOption(page: Page, label: string, option: string) {
  const name = label === 'Tipo de importação' ? 'tipo-importacao' : 'entidade';
  const select = page.locator(`select[name="${name}"]`);
  const value = await select.locator('option').filter({ hasText: option }).getAttribute('value');
  if (!value) throw new Error(`A opção "${option}" não existe no seletor "${label}".`);
  await select.selectOption(value);
}

function projectPreview(payload: Array<Record<string, unknown>>) {
  if (payload.length === 1) {
    const item = payload[0];
    if (item.clienteId === selectedClientId) {
      return {
        status: 'ready', counts: { total: 1, automatic: 0, manual: 1, pending: 0, missing: 0, ambiguous: 0, invalid: 0 },
        rows: [{ index: 0, row: 2, projectName: String(item.nome), reference: 'Cliente repetido', status: 'resolved', reason: 'manual', message: 'Cliente confirmado manualmente.', association: { clientId: selectedClientId, clientName: 'Cliente Selecionado', documentMasked: 'CNPJ **.***.***/****-10', municipality: 'Florianópolis', method: 'manual' } }]
      };
    }
  }
  return {
    status: 'blocked', counts: { total: 2, automatic: 1, manual: 0, pending: 1, missing: 0, ambiguous: 1, invalid: 0 },
    rows: [
      { index: 0, row: 2, projectName: 'Projeto automático', reference: 'Cliente Único', status: 'resolved', reason: 'exact_name', message: 'Cliente identificado automaticamente.', association: { clientId: '22222222-2222-4222-8222-222222222222', clientName: 'Cliente Único', documentMasked: null, municipality: 'São José', method: 'exact_name' } },
      { index: 1, row: 3, projectName: 'Projeto ambíguo', reference: 'Cliente repetido', status: 'pending', reason: 'ambiguous', message: 'Cliente ambíguo. Faça a associação manual.' }
    ]
  };
}

async function mockProjectImport(route: Route) {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/api/projetos/lote/clientes')) {
    await route.fulfill({ json: [{ id: selectedClientId, nome: 'Cliente Selecionado', documentoMascarado: 'CNPJ **.***.***/****-10', municipio: 'Florianópolis' }] });
    return;
  }
  const payload = route.request().postDataJSON() as Array<Record<string, unknown>>;
  if (url.pathname.endsWith('/preview')) {
    await route.fulfill({ json: projectPreview(payload) });
    return;
  }
  await route.fulfill({ status: 201, json: {
    importId: 'importacao-e2e', status: 'completed', rowsRead: 2, imported: 2, updated: 0, reused: 0, ignored: 0, failed: 0, pendingReview: 0,
    startedAt: '2026-08-11T12:00:00.000Z', completedAt: '2026-08-11T12:00:01.000Z', durationMs: 1000,
    results: [
      { index: 0, row: 2, status: 'success', association: { clientId: '22222222-2222-4222-8222-222222222222', clientName: 'Cliente Único', method: 'exact_name' } },
      { index: 1, row: 3, status: 'success', association: { clientId: selectedClientId, clientName: 'Cliente Selecionado', method: 'manual' } }
    ]
  } });
}

test.describe.serial('importador acessível e associação manual', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await unlock(page);
    await navigate(page, '/importacao');
    await expect(page.getByRole('heading', { name: 'Importação de dados' })).toBeVisible();
  });

  test('aviso e exemplo são acessíveis por teclado', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Antes de importar sua planilha' })).toBeVisible();
    const example = page.getByText('Ver exemplo de planilha bem estruturada');
    await example.focus();
    await expect(example).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('columnheader', { name: 'Cliente' })).toBeVisible();
  });

  test('bloqueia, foca, associa uma linha e registra o critério no resultado', async ({ page }) => {
    await page.route('**/api/projetos/lote**', mockProjectImport);
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Projetos');
    await page.locator('#import-file').setInputFiles({ name: 'projetos.csv', mimeType: 'text/csv', buffer: Buffer.from('Projeto,Cliente\nProjeto automático,Cliente Único\nProjeto ambíguo,Cliente repetido') });

    await expect(page.getByText('A confirmação está bloqueada até que todas as linhas tenham um cliente definido.')).toBeVisible();
    const pendingRow = page.locator('#project-association-pending-1');
    await expect(pendingRow).toBeFocused();
    const confirm = page.getByRole('button', { name: 'Concluir importação' });
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveClass(/cursor-not-allowed/);
    await expect(confirm).not.toContainText('Gravando');

    const firstError = page.getByRole('button', { name: /Ir ao primeiro erro/ });
    await firstError.focus();
    await page.keyboard.press('Enter');
    await expect(pendingRow).toBeFocused();

    const clientSearch = page.getByLabel('Pesquisar cliente ativo');
    await clientSearch.fill('Cliente Selecionado');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Confirmação manual').first()).toBeVisible();
    await expect(page.getByText('A confirmação está bloqueada até que todas as linhas tenham um cliente definido.')).toHaveCount(0);

    const review = page.getByRole('checkbox', { name: /Revisei o mapeamento/ });
    await expect(review).toBeEnabled();
    await review.focus();
    await page.keyboard.press('Space');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Associações dos projetos importados' })).toBeVisible();
    await expect(page.getByText('Cliente Selecionado')).toBeVisible();
    await expect(page.getByText('Confirmação manual')).toBeVisible();
    await page.getByRole('button', { name: 'Conferir Projetos' }).click();
    await expect(page).toHaveURL(/\/projetos$/);
  });

  test('apresenta sucesso parcial e falha individual por linha', async ({ page }) => {
    await page.route('**/api/contatos/lote', route => route.fulfill({ status: 201, json: {
      importId: 'parcial-e2e', status: 'partial', rowsRead: 2, imported: 1, updated: 0, reused: 0, ignored: 0, failed: 1, pendingReview: 1,
      startedAt: '2026-08-11T12:00:00.000Z', completedAt: '2026-08-11T12:00:01.000Z', durationMs: 1000,
      results: [{ index: 0, row: 2, status: 'success' }, { index: 1, row: 3, status: 'failed', errors: ['Informe o nome do contato.'] }]
    } }));
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles({ name: 'contatos.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome,Email\nContato Válido,valido@example.test\n,semnome@example.test') });
    await page.getByRole('checkbox', { name: /Revisei o mapeamento/ }).check();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Importação concluída parcialmente' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Informe o nome do contato.' })).toBeVisible();
  });

  test('não mostra sucesso quando nenhuma linha é gravada', async ({ page }) => {
    await page.route('**/api/contatos/lote', route => route.fulfill({ status: 201, json: {
      importId: 'zero-e2e', status: 'failed', rowsRead: 1, imported: 0, updated: 0, reused: 0, ignored: 0, failed: 1, pendingReview: 1,
      startedAt: '2026-08-11T12:00:00.000Z', completedAt: '2026-08-11T12:00:01.000Z', durationMs: 1000,
      results: [{ index: 0, row: 2, status: 'failed', errors: ['Informe o nome do contato.'] }]
    } }));
    await selectCustomOption(page, 'Tipo de importação', 'Importação simples por cadastro');
    await selectCustomOption(page, 'Entidade de destino', 'Contatos');
    await page.locator('#import-file').setInputFiles({ name: 'contatos.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome,Email\n,semnome@example.test') });
    await page.getByRole('checkbox', { name: /Revisei o mapeamento/ }).check();
    await page.getByRole('button', { name: 'Concluir importação' }).click();
    await expect(page.getByRole('heading', { name: 'Nenhum registro foi importado' })).toBeVisible();
    await expect(page.getByText('Todos os registros válidos foram gravados.')).toHaveCount(0);
  });
});
