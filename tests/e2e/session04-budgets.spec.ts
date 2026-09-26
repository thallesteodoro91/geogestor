import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, e2eReferenceDate, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S04-20260910-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

const ids = {
  client: crypto.randomUUID(),
  otherClient: crypto.randomUUID(),
  ruralProperty: crypto.randomUUID(),
  urbanProperty: crypto.randomUUID(),
  project: crypto.randomUUID(),
  otherProject: crypto.randomUUID(),
  opportunity: crypto.randomUUID()
};

let budgetId = '';
let revisionId = '';

type Auth = { origin: string; headers: Record<string, string> };

async function unlockCurrent(page: Page): Promise<Auth> {
  await expect(page.getByRole('main')).toBeVisible();
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  if (!await unlockHeading.isVisible()) throw new Error('A tela de desbloqueio esperada não foi exibida.');
  await page.getByLabel('Senha local').fill(PASSWORD);
  const unlockResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'));
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  const response = await unlockResponse;
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { token: string };
  const requestHeaders = await response.request().allHeaders();
  return {
    origin: new URL(response.url()).origin,
    headers: {
      ...Object.fromEntries(Object.entries(requestHeaders).filter(([key]) => key.toLowerCase() === 'x-api-token')),
      'x-local-session': payload.token
    }
  };
}

async function unlock(page: Page, target = '/orcamentos') {
  await page.goto(target);
  return unlockCurrent(page);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

function fullPayload() {
  return {
    clientId: ids.client,
    projectId: null,
    propertyId: ids.ruralProperty,
    description: `  ${PREFIX}Proposta completa com acentuação  `,
    internalNotes: 'CONTEUDO_INTERNO_S04_NAO_DEVE_APARECER',
    clientNotes: 'Acesso ao imóvel deve ser previamente autorizado.',
    terms: 'Termos comerciais da Sessão 04. Alterações exigem revisão formal.',
    issueDate: e2eReferenceDate(),
    validUntil: relativeDate(3650),
    technicalLead: 'Thalles Wesley Teodoro',
    source: 'auditoria-s04',
    serviceType: 'Georreferenciamento de imóvel rural',
    propertyType: 'rural',
    propertyName: `${PREFIX}Fazenda Açores`,
    municipality: 'Florianópolis',
    state: 'SC',
    methodology: 'Pontos de apoio físicos materializados no solo; estação base eletrônica GNSS independente.',
    deliverables: 'Planta, memorial, relatório e arquivos digitais.',
    executionDays: 20,
    characterization: {
      estimatedArea: '12.5',
      record: 'Matrícula 12.345',
      physicalGroundControl: 'Marcos M-01 e M-02 materializados no terreno',
      gnssElectronicBase: 'Receptor GNSS configurado como estação base eletrônica'
    },
    globalDiscount: { type: 'fixo', value: '852' },
    globalAddition: { type: 'percentual', value: '10' },
    items: [
      {
        description: 'Serviço GNSS RTK principal', unit: 'hectare', quantity: '1.5', unitCostCents: 4_000, unitPriceCents: 10_001,
        discount: { type: 'fixo', value: '1000' }, addition: { type: 'percentual', value: '5' }, taxable: true,
        component: 'servico', optional: false, required: true, notes: 'Execução técnica', order: 0
      },
      {
        description: 'Despesa cobrada do cliente', unit: 'deslocamento', quantity: '2', unitCostCents: 500, unitPriceCents: 2_500,
        discount: { type: 'percentual', value: '10' }, addition: { type: 'fixo', value: '100' }, taxable: false,
        component: 'despesa', optional: false, required: true, notes: null, order: 1
      },
      {
        description: 'Taxa cartorial repassada', unit: 'documento', quantity: '1', unitCostCents: 0, unitPriceCents: 2_000,
        discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: true,
        component: 'taxa_repassada', optional: false, required: true, notes: null, order: 2
      },
      {
        description: 'Implantação opcional de marco', unit: 'marco', quantity: '1', unitCostCents: 2_000, unitPriceCents: 5_000,
        discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' }, taxable: true,
        component: 'servico', optional: true, required: false, notes: 'Opcional', order: 3
      }
    ],
    costs: [
      { category: 'Equipe', description: 'Auxiliar de campo', amountCents: 1_000, classification: 'custo_proprio', taxable: false, order: 0 },
      { category: 'Viagem', description: 'Combustível reembolsável', amountCents: 3_000, classification: 'despesa_reembolsavel', taxable: true, order: 1 },
      { category: 'Taxas', description: 'Emolumento repassado', amountCents: 1_500, classification: 'taxa_repassada', taxable: false, order: 2 }
    ],
    taxes: [
      { name: 'ISS incluso', acronym: 'ISS', ratePercent: '5', calculationBase: 'servicos', includedInPrice: true, cumulative: false, manualAdjustmentCents: 0 },
      { name: 'PIS cumulativo', acronym: 'PIS', ratePercent: '3', calculationBase: 'tributavel', includedInPrice: false, cumulative: true, manualAdjustmentCents: 0 },
      { name: 'Taxa sobre repasses', acronym: 'TR', ratePercent: '2', calculationBase: 'taxas', includedInPrice: false, cumulative: false, manualAdjustmentCents: 0 },
      { name: 'Tributo sobre total', acronym: 'TT', ratePercent: '1', calculationBase: 'total', includedInPrice: false, cumulative: false, manualAdjustmentCents: 0 },
      { name: 'Adicional cumulativo', acronym: 'AC', ratePercent: '1', calculationBase: 'tributavel', includedInPrice: false, cumulative: false, manualAdjustmentCents: 3, adjustmentReason: 'Ajuste municipal documentado' }
    ],
    payment: {
      type: 'parcelas', description: 'Três parcelas com residual na última', paymentMethod: 'PIX', financialAccount: 'CONTA_INTERNA_S04',
      interestBasisPoints: 100, fineBasisPoints: 200, earlyDiscountBasisPoints: 50,
      installments: [
        { percentage: '33.33', daysAfterApproval: 0, label: 'Entrada' },
        { percentage: '33.33', daysAfterApproval: 30, label: 'Campo' },
        { percentage: '33.34', daysAfterApproval: 60, label: 'Entrega' }
      ]
    }
  };
}

async function ensureBudgetFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(path.join(evidenceRoot, 'pdfs'), { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const existing = await database.execute({ sql: 'select id from clientes where id = ? limit 1', args: [ids.client] });
    if (existing.rows.length > 0) return;
    const now = relativeInstant();
    await database.batch([
      { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cpf, documento_normalizado, email, telefone, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PF', ?, ?, ?, ?, ?, 'Florianópolis', 'SC', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente Principal`, '52998224725', '52998224725', '52998224725', 'principal.s04@example.invalid', '48999990001', now, now] },
      { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cnpj, documento_normalizado, email, telefone, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PJ', ?, ?, ?, ?, ?, 'São José', 'SC', 'Ativo', ?, ?)`, args: [ids.otherClient, `${PREFIX}Cliente Isolamento`, '11222333000181', '11222333000181', '11222333000181', 'isolamento.s04@example.invalid', '48999990002', now, now] },
      { sql: `insert into propriedades (id, cliente_id, nome, area_ha, matricula, municipio, cidade, uf, situacao_imovel, created_at, updated_at) values (?, ?, ?, 12.5, '12.345', 'Florianópolis', 'Florianópolis', 'SC', 'Rural', ?, ?)`, args: [ids.ruralProperty, ids.client, `${PREFIX}Fazenda Açores`, now, now] },
      { sql: `insert into propriedades (id, cliente_id, nome, area_ha, matricula, municipio, cidade, uf, situacao_imovel, created_at, updated_at) values (?, ?, ?, 0.08, '98.765', 'Florianópolis', 'Florianópolis', 'SC', 'Urbano', ?, ?)`, args: [ids.urbanProperty, ids.client, `${PREFIX}Lote Urbano`, now, now] },
      { sql: `insert into projetos (id, cliente_id, nome, status, municipio, cidade, tipo, propriedade_id, created_at, updated_at) values (?, ?, ?, 'Em Andamento', 'Florianópolis', 'SC', 'Topografia', ?, ?, ?)`, args: [ids.project, ids.client, `${PREFIX}Projeto Existente`, ids.ruralProperty, now, now] },
      { sql: `insert into projetos (id, cliente_id, nome, status, municipio, cidade, tipo, created_at, updated_at) values (?, ?, ?, 'Em Andamento', 'São José', 'SC', 'Topografia', ?, ?)`, args: [ids.otherProject, ids.otherClient, `${PREFIX}Projeto Outro Cliente`, now, now] }
    ], 'write');
  } finally {
    database.close();
  }
}

test.describe('Sessão 04 — Comercial — Orçamentos', () => {
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(300_000);

  test('estado vazio, falha recuperável, deep links inválidos e dados isolados', async ({ page }) => {
    await fs.mkdir(path.join(evidenceRoot, 'pdfs'), { recursive: true });
    const auth = await unlock(page);
    await expect(page.getByRole('heading', { name: 'Orçamentos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nenhum orçamento encontrado' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-lista-vazia.png'), fullPage: true });

    await page.route('**/api/orcamentos?*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/orcamentos' && url.searchParams.get('mode') === 'page') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha controlada S04' }) });
      } else await route.continue();
    });
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar os orçamentos' })).toBeVisible();
    await expect(page.getByText('Falha controlada S04')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '02-lista-erro-recuperavel.png'), fullPage: true });
    await page.unroute('**/api/orcamentos?*');
    await page.getByRole('button', { name: 'Tentar novamente' }).last().click();
    await expect(page.getByRole('heading', { name: 'Nenhum orçamento encontrado' })).toBeVisible();

    await page.goto('/orcamentos?budgetId=invalido');
    await unlockCurrent(page);
    await expect(page.getByText('O identificador informado é inválido.')).toBeVisible();
    await page.getByRole('button', { name: 'Remover referência' }).click();
    await expect(page).not.toHaveURL(/budgetId=/);
    await page.goto(`/orcamentos?budgetId=${crypto.randomUUID()}`);
    await unlockCurrent(page);
    await expect(page.getByText(/não existe|não (?:foi )?encontrado|não está acessível/i)).toBeVisible();
    await page.getByRole('button', { name: 'Remover referência' }).click();

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    try {
      await database.batch([
        { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cpf, documento_normalizado, email, telefone, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PF', ?, ?, ?, ?, ?, 'Florianópolis', 'SC', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente Principal`, '52998224725', '52998224725', '52998224725', 'principal.s04@example.invalid', '48999990001', now, now] },
        { sql: `insert into clientes (id, nome, tipo_pessoa, documento, cnpj, documento_normalizado, email, telefone, municipio, uf, situacao, created_at, updated_at) values (?, ?, 'PJ', ?, ?, ?, ?, ?, 'São José', 'SC', 'Ativo', ?, ?)`, args: [ids.otherClient, `${PREFIX}Cliente Isolamento`, '11222333000181', '11222333000181', '11222333000181', 'isolamento.s04@example.invalid', '48999990002', now, now] },
        { sql: `insert into propriedades (id, cliente_id, nome, area_ha, matricula, municipio, cidade, uf, situacao_imovel, created_at, updated_at) values (?, ?, ?, 12.5, '12.345', 'Florianópolis', 'Florianópolis', 'SC', 'Rural', ?, ?)`, args: [ids.ruralProperty, ids.client, `${PREFIX}Fazenda Açores`, now, now] },
        { sql: `insert into propriedades (id, cliente_id, nome, area_ha, matricula, municipio, cidade, uf, situacao_imovel, created_at, updated_at) values (?, ?, ?, 0.08, '98.765', 'Florianópolis', 'Florianópolis', 'SC', 'Urbano', ?, ?)`, args: [ids.urbanProperty, ids.client, `${PREFIX}Lote Urbano`, now, now] },
        { sql: `insert into projetos (id, cliente_id, nome, status, municipio, cidade, tipo, propriedade_id, created_at, updated_at) values (?, ?, ?, 'Em Andamento', 'Florianópolis', 'SC', 'Topografia', ?, ?, ?)`, args: [ids.project, ids.client, `${PREFIX}Projeto Existente`, ids.ruralProperty, now, now] },
        { sql: `insert into projetos (id, cliente_id, nome, status, municipio, cidade, tipo, created_at, updated_at) values (?, ?, ?, 'Em Andamento', 'São José', 'SC', 'Topografia', ?, ?)`, args: [ids.otherProject, ids.otherClient, `${PREFIX}Projeto Outro Cliente`, now, now] }
      ], 'write');
    } finally {
      database.close();
    }
    expect(auth.origin).toMatch(/^http:\/\/127\.0\.0\.1:/);
  });

  test('editor, cálculos conhecidos, filtros, detalhes e PDF de rascunho', async ({ page }) => {
    await ensureBudgetFixture();
    const auth = await unlock(page);
    const createResponse = await page.request.post(`${auth.origin}/api/orcamentos`, { headers: auth.headers, data: fullPayload() });
    const createBody = await createResponse.text();
    expect(createResponse.status(), createBody).toBe(201);
    const detail = JSON.parse(createBody) as Record<string, any>;
    budgetId = detail.id;
    expect(detail.descricao).toBe(`${PREFIX}Proposta completa com acentuação`);
    expect(detail).toMatchObject({
      subtotalServicos: 14_752,
      subtotalDespesas: 7_600,
      subtotalTaxas: 3_500,
      valorReembolsavel: 3_000,
      impostosPrevistos: 1_948,
      custoTotalEstimado: 12_500,
      honorariosLiquidos: 14_991,
      lucroEstimado: 12_335,
      margemPontosBase: 5_850,
      markupPontosBase: 9_868,
      valorTotal: 28_783
    });
    expect(detail.taxes.map((tax: any) => tax.amountCents)).toEqual([750, 632, 70, 276, 220]);
    expect(detail.items[3].optional).toBe(true);

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT!;
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    try {
      const databaseBudget = await database.execute({ sql: 'select valor_total, subtotal_servicos, subtotal_despesas, subtotal_taxas, impostos_previstos, custo_total_estimado, lucro_estimado from orcamentos where id = ?', args: [budgetId] });
      expect(databaseBudget.rows[0]).toMatchObject({ valor_total: 28_783, subtotal_servicos: 14_752, subtotal_despesas: 7_600, subtotal_taxas: 3_500, impostos_previstos: 1_948, custo_total_estimado: 12_500, lucro_estimado: 12_335 });
      await database.execute({ sql: `insert into oportunidades (id, cliente_id, titulo, valor_estimado, estagio, ordem, probabilidade_pontos_base, orcamento_id, estagio_alterado_em, created_at, updated_at) values (?, ?, ?, ?, 'Proposta', 0, 6500, ?, ?, ?, ?)`, args: [ids.opportunity, ids.client, `${PREFIX}Oportunidade`, 28_783, budgetId, relativeInstant(), relativeInstant(), relativeInstant()] });
    } finally {
      database.close();
    }

    await page.goto(`/orcamentos?query=${encodeURIComponent('proposta completa')}&clientId=${ids.client}&municipality=${encodeURIComponent('Florianópolis')}&propertyType=rural&linkedProject=nao&minValueCents=28783&maxValueCents=28783`);
    await unlockCurrent(page);
    await expect(page.getByRole('button', { name: new RegExp(`Visualizar orçamento de ${PREFIX}Cliente Principal`) })).toBeVisible();
    await expect(page.getByText('R$ 287,83', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Abrir análise comercial' }).click();
    await expect(page.getByRole('heading', { name: 'Análise comercial' })).toBeVisible();
    await expect(page.getByText('Ainda não há propostas encerradas suficientes para esta leitura.')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-lista-filtrada-calculos.png'), fullPage: true });

    await page.getByRole('button', { name: new RegExp(`Visualizar orçamento de ${PREFIX}Cliente Principal`) }).click();
    const dialog = page.getByRole('dialog', { name: /Rascunho.*versão 1/ });
    await expect(dialog).toContainText('Serviço GNSS RTK principal');
    await expect(dialog).toContainText('Implantação opcional de marco');
    await expect(dialog).toContainText('R$ 287,83');
    await expect(dialog.getByText('CONTEUDO_INTERNO_S04_NAO_DEVE_APARECER')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '04-detalhes-rascunho.png'), fullPage: true });

    await dialog.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Exportar orçamento em rascunho' })).toBeVisible();
    const draftDownloadPromise = page.waitForEvent('download', { timeout: 45_000 });
    await page.getByRole('button', { name: 'Exportar com marca-d’água' }).click();
    const draftDownload = await draftDownloadPromise;
    expect(draftDownload.suggestedFilename()).toMatch(/\.pdf$/i);
    await draftDownload.saveAs(path.join(evidenceRoot, 'pdfs', `rascunho-${draftDownload.suggestedFilename()}`));

    await page.goto(`/orcamentos/${budgetId}/editar?retorno=${encodeURIComponent('/orcamentos?status=rascunho&page=2')}`);
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Editar orçamento' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cliente e imóvel/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Pagamento/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Documento final/ }).first()).toBeVisible();
    await expect(page.locator('#global-discount')).toHaveValue('8,52');
    await page.locator('#budget-description').fill(`  ${PREFIX}Proposta editada e persistida  `);
    await page.getByRole('button', { name: 'Atualizar orçamento' }).click();
    await expect(page).toHaveURL(/\/orcamentos\?status=rascunho&page=2&highlightId=/);
    const edited = await page.request.get(`${auth.origin}/api/orcamentos/${budgetId}`, { headers: auth.headers });
    expect(await edited.json()).toMatchObject({ descricao: `${PREFIX}Proposta editada e persistida`, valorTotal: 28_783 });
  });

  test('emissão, aprovação idempotente, CRM, projeto, parcelas, revisão e regressão visual', async ({ page }) => {
    await ensureBudgetFixture();
    if (!budgetId) {
      const setupAuth = await unlock(page);
      const created = await page.request.post(`${setupAuth.origin}/api/orcamentos`, { headers: setupAuth.headers, data: fullPayload() });
      expect(created.status(), await created.text()).toBe(201);
      budgetId = (await created.json() as { id: string }).id;
      const database = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT!, 'geogestor.db')}` });
      try {
        await database.execute({ sql: `insert into oportunidades (id, cliente_id, titulo, valor_estimado, estagio, ordem, probabilidade_pontos_base, orcamento_id, estagio_alterado_em, created_at, updated_at) values (?, ?, ?, ?, 'Proposta', 0, 6500, ?, ?, ?, ?)`, args: [ids.opportunity, ids.client, `${PREFIX}Oportunidade`, 28_783, budgetId, relativeInstant(), relativeInstant(), relativeInstant()] });
      } finally {
        database.close();
      }
    }
    const auth = await unlock(page, `/orcamentos?budgetId=${budgetId}`);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Emitir' }).click();
    await expect(dialog.locator('header').first().getByText('Emitido', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Marcar como enviado' }).click();
    await expect(dialog.locator('header').first().getByText('Enviado', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Registrar visualização' }).click();
    await expect(dialog.getByRole('button', { name: 'Registrar visualização' })).toHaveCount(0);
    const viewedResponse = await page.request.get(`${auth.origin}/api/orcamentos/${budgetId}`, { headers: auth.headers });
    expect((await viewedResponse.json() as { visualizadoEm: string | null }).visualizadoEm).toBeTruthy();
    await dialog.getByRole('button', { name: 'Em negociação' }).click();
    await expect(dialog.locator('header').first().getByText('Em negociação', { exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Aprovar' }).click();
    const approvalDialog = page.getByRole('dialog', { name: 'Confirmar aprovação e efeitos financeiros' });
    await approvalDialog.getByText('Vincular projeto existente', { exact: true }).click();
    await approvalDialog.getByLabel('Projeto existente para vincular').click();
    await page.getByRole('option', { name: `${PREFIX}Projeto Existente` }).click();
    await expect(approvalDialog).toContainText('R$ 287,83');
    await approvalDialog.getByRole('button', { name: 'Aprovar e gerar efeitos' }).click();
    await expect(dialog.locator('header').first().getByText('Aprovado', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Parcela 1')).toBeVisible();
    await expect(dialog.getByText('Parcela 3')).toBeVisible();

    const repeatedKey = 'approval-s04-repeat-0001';
    const repeated = await Promise.all([
      page.request.post(`${auth.origin}/api/orcamentos/${budgetId}/approve`, { headers: auth.headers, data: { idempotencyKey: repeatedKey, project: { mode: 'existing', projectId: ids.project, name: null } } }),
      page.request.post(`${auth.origin}/api/orcamentos/${budgetId}/approve`, { headers: auth.headers, data: { idempotencyKey: 'approval-s04-different-0002', project: { mode: 'existing', projectId: ids.project, name: null } } })
    ]);
    expect(repeated.map(response => response.status())).toEqual([200, 200]);
    expect((await repeated[0].json() as { idempotent: boolean }).idempotent).toBe(true);
    expect((await repeated[1].json() as { idempotent: boolean }).idempotent).toBe(true);

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT!;
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    try {
      const installments = await database.execute({ sql: 'select valor, valor_pago, status_pagamento from parcelas where orcamento_id = ? order by numero', args: [budgetId] });
      expect(installments.rows.map(row => Number(row.valor))).toEqual([9_593, 9_593, 9_597]);
      expect(installments.rows.reduce((sum, row) => sum + Number(row.valor), 0)).toBe(28_783);
      expect(installments.rows.every(row => Number(row.valor_pago) === 0 && row.status_pagamento === 'Pendente')).toBe(true);
      expect(Number((await database.execute({ sql: 'select count(*) as total from recebimentos', args: [] })).rows[0].total)).toBe(0);
      expect(Number((await database.execute({ sql: 'select count(*) as total from orcamento_projetos where orcamento_id = ?', args: [budgetId] })).rows[0].total)).toBe(1);
      const opportunity = (await database.execute({ sql: 'select estagio, projeto_id from oportunidades where id = ?', args: [ids.opportunity] })).rows[0];
      expect(opportunity).toMatchObject({ estagio: 'Ganho', projeto_id: ids.project });
    } finally {
      database.close();
    }

    const emittedDownloadPromise = page.waitForEvent('download', { timeout: 45_000 });
    await dialog.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
    const emittedDownload = await emittedDownloadPromise;
    await emittedDownload.saveAs(path.join(evidenceRoot, 'pdfs', `emitido-${emittedDownload.suggestedFilename()}`));
    await page.screenshot({ path: path.join(evidenceRoot, '05-aprovacao-parcelas.png'), fullPage: true });

    await dialog.getByRole('button', { name: 'Criar revisão' }).click();
    const revisionDialog = page.getByRole('dialog', { name: 'Criar revisão formal' });
    await revisionDialog.getByLabel('Motivo').fill('Ampliação do escopo solicitada pelo cliente');
    await revisionDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('dialog').locator('header').first().getByText('Rascunho', { exact: true })).toBeVisible();
    revisionId = new URL(page.url()).searchParams.get('budgetId') || '';
    expect(revisionId).not.toBe(budgetId);
    const revisionResponse = await page.request.get(`${auth.origin}/api/orcamentos/${revisionId}`, { headers: auth.headers });
    const revision = await revisionResponse.json() as { versao: number; grupoId: string; status: string; items: Array<{ id: string }> };
    const originalResponse = await page.request.get(`${auth.origin}/api/orcamentos/${budgetId}`, { headers: auth.headers });
    const original = await originalResponse.json() as { grupoId: string; items: Array<{ id: string }> };
    expect(revision).toMatchObject({ versao: 2, grupoId: original.grupoId, status: 'rascunho' });
    expect(revision.items.map(item => item.id)).not.toEqual(original.items.map(item => item.id));

    expect((await page.request.post(`${auth.origin}/api/orcamentos/${revisionId}/emit`, { headers: auth.headers })).status()).toBe(200);
    expect((await page.request.post(`${auth.origin}/api/orcamentos/${revisionId}/approve`, { headers: auth.headers, data: { idempotencyKey: 'approval-s04-revision-0003', project: { mode: 'existing', projectId: ids.project, name: null } } })).status()).toBe(200);
    expect((await (await page.request.get(`${auth.origin}/api/orcamentos/${budgetId}`, { headers: auth.headers })).json() as { status: string }).status).toBe('substituido');
    expect((await (await page.request.get(`${auth.origin}/api/orcamentos/${revisionId}`, { headers: auth.headers })).json() as { status: string }).status).toBe('aprovado');

    for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 900 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`/orcamentos?budgetId=${revisionId}`);
      await unlockCurrent(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar modal' }).click();
    await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.goto(`/orcamentos?budgetId=${revisionId}`);
    await unlockCurrent(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '06-revisao-aprovada-1440-escuro.png'), fullPage: true });
  });
});
