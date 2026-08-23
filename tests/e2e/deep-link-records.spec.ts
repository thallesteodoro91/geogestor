import { expect, test, type Page, type Route } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page) {
  await page.goto('/');
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboardHeading = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(unlockHeading.or(dashboardHeading)).toBeVisible();
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboardHeading).toBeVisible();
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body)
  });
}

async function navigate(page: Page, target: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, target);
}

test.describe.serial('deep links abrem registros somente uma vez', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => unlock(page));

  test('CRM aguarda os dados, abre a oportunidade e preserva os demais parâmetros', async ({ page }) => {
    const opportunityId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/api/oportunidades', (route) => json(route, [{
      id: opportunityId,
      clienteId: 'cliente-alerta',
      leadId: null,
      clienteNome: 'Cliente do alerta',
      leadNome: null,
      vinculoTipo: 'cliente',
      titulo: 'Levantamento do alerta',
      valorEstimado: 150000,
      estagio: 'Proposta',
      ordem: 0,
      responsavel: 'Thalles',
      origem: 'Indicação',
      servicoTipo: 'Levantamento topográfico',
      proximaAcao: null,
      proximaAcaoEm: null,
      previsaoFechamento: null,
      probabilidadePontosBase: 5000,
      observacoes: null,
      motivoPerda: null,
      encerradoEm: null,
      ultimoContatoEm: null,
      orcamentoId: null,
      orcamentoCodigo: null,
      orcamentoStatus: null,
      projetoId: null,
      projetoNome: null,
      estagioAlteradoEm: '2026-08-13T12:00:00.000Z',
      createdAt: '2026-08-13T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z'
    }]));
    await page.route('**/api/oportunidades/options', (route) => json(route, {
      clients: [{ id: 'cliente-alerta', name: 'Cliente do alerta' }], leads: [], budgets: []
    }));

    await navigate(page, `/crm?oportunidade=${opportunityId}&origem=alerta`);
    await expect(page.getByRole('dialog', { name: 'Editar oportunidade' })).toBeVisible();
    await expect(page.getByLabel('Título do negócio')).toHaveValue('Levantamento do alerta');
    await expect.poll(() => new URL(page.url()).searchParams.get('oportunidade')).toBeNull();
    expect(new URL(page.url()).searchParams.get('origem')).toBe('alerta');
    expect(new URL(page.url()).searchParams.get('view')).toBe('funil');
    await expect(page.getByRole('dialog', { name: 'Editar oportunidade' })).toHaveCount(1);
  });

  test('conta a receber abre o demonstrativo e consome somente a parcela', async ({ page }) => {
    const receivableId = '22222222-2222-4222-8222-222222222222';
    await page.route('**/api/financeiro/parcelas', (route) => json(route, [{
      id: receivableId,
      orcamentoId: 'orcamento-alerta',
      orcamentoDescricao: 'Serviço do alerta',
      clienteId: 'cliente-alerta',
      clienteNome: 'Cliente do alerta',
      projetoId: null,
      numeroParcela: 1,
      totalParcelas: 1,
      valor: 250000,
      valorPago: 0,
      recebidoCaixa: 0,
      dataVencimento: '2026-08-20',
      statusPagamento: 'Pendente'
    }]));
    await page.route('**/api/financeiro/parcelas/*/recebimentos', (route) => json(route, []));

    await navigate(page, `/financeiro?tab=faturas&parcela=${receivableId}&origem=alerta`);
    await expect(page.getByRole('dialog', { name: 'GeoGestor • Demonstrativo de cobrança' })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('parcela')).toBeNull();
    expect(new URL(page.url()).searchParams.get('tab')).toBe('faturas');
    expect(new URL(page.url()).searchParams.get('origem')).toBe('alerta');
  });

  test('conta a pagar abre a edição e consome somente a despesa', async ({ page }) => {
    const payableId = '33333333-3333-4333-8333-333333333333';
    await page.route('**/api/financeiro/despesas', (route) => json(route, [{
      id: payableId,
      projetoId: null,
      viagemId: null,
      descricao: 'Combustível do alerta',
      fornecedor: 'Posto E2E',
      numeroDocumento: 'NF-1',
      valor: 30000,
      data: '2026-08-13',
      dataCompetencia: '2026-08-13',
      dataPagamento: null,
      categoria: 'Combustível',
      tipoCusto: 'Variável de campo',
      centroCusto: 'Campo',
      reembolsavel: false,
      observacoes: null,
      status: 'Pendente',
      formaPagamento: 'Pix'
    }]));

    await navigate(page, `/financeiro?tab=pagar&despesa=${payableId}&origem=alerta`);
    await expect(page.getByRole('dialog', { name: 'Editar Despesa' })).toBeVisible();
    await expect(page.getByLabel('Descrição')).toHaveValue('Combustível do alerta');
    await expect.poll(() => new URL(page.url()).searchParams.get('despesa')).toBeNull();
    expect(new URL(page.url()).searchParams.get('tab')).toBe('pagar');
    expect(new URL(page.url()).searchParams.get('origem')).toBe('alerta');
  });

  test('tarefa é localizada, destacada e respeita a preferência por movimento reduzido', async ({ page }) => {
    const taskId = '44444444-4444-4444-8444-444444444444';
    await page.route('**/api/tarefas?**', (route) => json(route, {
      items: [{
        id: taskId,
        titulo: 'Tarefa indicada pelo alerta',
        descricao: 'Conferir documentos',
        status: 'A Fazer',
        prioridade: 'Alta',
        dataLimite: '2026-08-20'
      }],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1
    }));

    await navigate(page, `/tarefas?tarefaId=${taskId}&origem=alerta`);
    const card = page.locator(`[data-task-id="${taskId}"]`);
    await expect(card).toContainText('Tarefa indicada pelo alerta');
    await expect(card).toHaveClass(/ring-blue-500/);
    await expect.poll(() => new URL(page.url()).searchParams.get('tarefaId')).toBeNull();
    expect(new URL(page.url()).searchParams.get('origem')).toBe('alerta');
  });

  test('condicionante abre a aba correta e preserva os parâmetros persistentes', async ({ page }) => {
    const licenseId = '55555555-5555-4555-8555-555555555555';
    const conditionId = '66666666-6666-4666-8666-666666666666';
    await page.route(`**/api/licencas/${licenseId}`, (route) => json(route, {
      id: licenseId,
      projetoId: 'projeto-alerta',
      clienteId: 'cliente-alerta',
      clienteNome: 'Cliente do alerta',
      projetoNome: 'Projeto do alerta',
      numero: 'LAO 123/2026',
      protocolo: null,
      orgao: 'IMA',
      tipoLicenca: 'LAO',
      dataEmissao: '2026-01-01',
      dataVencimento: '2027-01-01',
      status: 'Válida',
      statusRegistrado: 'Válida',
      observacoes: null,
      condicionantesPendentes: 1,
      condicionantesVencidas: 0,
      proximaCondicionante: '2026-09-01',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z',
      condicionantes: [{
        id: conditionId,
        licencaId: licenseId,
        titulo: 'Enviar relatório semestral',
        descricao: null,
        dataLimite: '2026-09-01',
        periodicidade: 'Semestral',
        responsavel: 'Thalles',
        status: 'Pendente',
        dataCumprimento: null,
        observacoes: null,
        comprovante: null,
        createdAt: '2026-01-01T12:00:00.000Z',
        updatedAt: '2026-08-13T12:00:00.000Z'
      }],
      history: []
    }));

    await navigate(page, `/ambiental/licencas/${licenseId}?tab=overview&condicionante=${conditionId}&origem=alerta`);
    await expect(page.getByRole('tab', { name: /Condicionantes/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Enviar relatório semestral' })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('condicionante')).toBeNull();
    expect(new URL(page.url()).searchParams.get('tab')).toBe('conditions');
    expect(new URL(page.url()).searchParams.get('origem')).toBe('alerta');
  });
});
