import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S07-20260912-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

const fixtureKeys = [
  'client', 'project', 'paidBudget', 'scheduledBudget', 'overdueInstallment', 'partialInstallment', 'paidInstallment',
  'partialReceipt', 'paidReceipt', 'paidExpense', 'directPaidExpense', 'overdueExpense', 'futureExpense', 'travel'
] as const;
const ids = Object.fromEntries(fixtureKeys.map((key, index) => [key, `07000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`])) as Record<typeof fixtureKeys[number], string>;

type Auth = { origin: string; headers: Record<string, string> };

const localDateKey = (offset = 0) => {
  return relativeDate(offset);
};

async function unlockCurrent(page: Page): Promise<Auth | undefined> {
  await expect(page.getByRole('main')).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  if (!await heading.isVisible()) return;
  await page.getByLabel('Senha local').fill(PASSWORD);
  const unlockResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'));
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  const response = await unlockResponse;
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { token: string };
  const requestHeaders = await response.request().allHeaders();
  await expect(heading).not.toBeVisible();
  return {
    origin: new URL(response.url()).origin,
    headers: {
      ...Object.fromEntries(Object.entries(requestHeaders).filter(([key]) => key.toLowerCase() === 'x-api-token')),
      'x-local-session': payload.token
    }
  };
}

async function unlock(page: Page, target: string) {
  await page.goto(target);
  return unlockCurrent(page);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function ensureFinancialJourneyFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(evidenceRoot, { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const existing = await database.execute({ sql: 'select id from clientes where id = ? limit 1', args: [ids.client] });
    if (existing.rows.length > 0) return;
    const now = relativeInstant();
    const today = localDateKey();
    await database.batch([
      { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente`, now, now] },
      { sql: `insert into projetos (id, cliente_id, nome, status, data_inicio, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?, ?)`, args: [ids.project, ids.client, `${PREFIX}Projeto`, today, now, now] },
      { sql: `insert into orcamentos (id, cliente_id, projeto_id, valor_total, status, descricao, data_orcamento, data_competencia, created_at, updated_at) values (?, ?, ?, 300000, 'aprovado', ?, ?, ?, ?, ?)`, args: [ids.scheduledBudget, ids.client, ids.project, `${PREFIX}Contrato parcelado`, today, today, now, now] },
      { sql: `insert into parcelas (id, orcamento_id, valor, numero, valor_pago, data_vencimento, status_pagamento, created_at, updated_at) values (?, ?, 100000, 2, 40000, ?, 'Pendente', ?, ?)`, args: [ids.partialInstallment, ids.scheduledBudget, localDateKey(10), now, now] },
      { sql: `insert into recebimentos (id, parcela_id, valor_principal, juros, multa, desconto, taxas, valor_recebido, data_recebimento, created_at, updated_at) values (?, ?, 40000, 2000, 0, 0, 0, 42000, ?, ?, ?)`, args: [ids.partialReceipt, ids.partialInstallment, today, now, now] },
      { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, data_competencia, data_pagamento, categoria, categoria_codigo, tipo_custo, centro_custo, status, created_at, updated_at) values (?, ?, ?, ?, 50000, ?, ?, ?, 'Software', 'outros', 'Fixo', 'Administrativo', 'Pago', ?, ?)`, args: [ids.paidExpense, ids.client, ids.project, `${PREFIX}Software`, today, today, today, now, now] },
      { sql: `insert into viagens (id, cliente_id, projeto_id, finalidade, destino, data_inicio, adiantamento, status, created_at, updated_at) values (?, ?, ?, ?, 'Florianópolis', ?, 30000, 'em_andamento', ?, ?)`, args: [ids.travel, ids.client, ids.project, `${PREFIX}Levantamento`, today, now, now] },
      { sql: `insert into notas_fiscais (id, cliente_id, projeto_id, numero, data_emissao, valor, status, municipio, link, created_at, updated_at) values (?, ?, ?, ?, ?, 142000, 'emitida', 'Florianópolis', 'https://example.test/nf', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, `${PREFIX}NF-001`, today, now, now] }
    ], 'write');
  } finally {
    database.close();
  }
}

test.describe('Sessão 07 — Financeiro', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(240_000);

  test('reconcilia centavos entre SQLite, API, interface e CSV', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const auth = await unlock(page, '/clientes');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    const today = localDateKey();
    try {
      await database.batch([
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente`, now, now] },
        { sql: `insert into projetos (id, cliente_id, nome, status, data_inicio, created_at, updated_at) values (?, ?, ?, 'Em Andamento', ?, ?, ?)`, args: [ids.project, ids.client, `${PREFIX}Projeto`, today, now, now] },
        { sql: `insert into orcamentos (id, cliente_id, projeto_id, valor_total, status, descricao, data_orcamento, data_competencia, data_pagamento, created_at, updated_at) values (?, ?, ?, 500000, 'pago', ?, ?, ?, ?, ?, ?)`, args: [ids.paidBudget, ids.client, ids.project, `${PREFIX}Contrato quitado`, today, today, today, now, now] },
        { sql: `insert into orcamentos (id, cliente_id, projeto_id, valor_total, status, descricao, data_orcamento, data_competencia, created_at, updated_at) values (?, ?, ?, 300000, 'aprovado', ?, ?, ?, ?, ?)`, args: [ids.scheduledBudget, ids.client, ids.project, `${PREFIX}Contrato parcelado`, today, today, now, now] },
        { sql: `insert into orcamentos (id, cliente_id, valor_total, status, descricao, data_orcamento, created_at, updated_at) values (?, ?, 9900000, 'rejeitado', ?, ?, ?, ?)`, args: [crypto.randomUUID(), ids.client, `${PREFIX}Excluído do consolidado`, today, now, now] },
        { sql: `insert into parcelas (id, orcamento_id, valor, numero, valor_pago, data_vencimento, status_pagamento, created_at, updated_at) values (?, ?, 100000, 1, 0, ?, 'Pendente', ?, ?)`, args: [ids.overdueInstallment, ids.scheduledBudget, localDateKey(-1), now, now] },
        { sql: `insert into parcelas (id, orcamento_id, valor, numero, valor_pago, data_vencimento, status_pagamento, created_at, updated_at) values (?, ?, 100000, 2, 40000, ?, 'Pendente', ?, ?)`, args: [ids.partialInstallment, ids.scheduledBudget, localDateKey(10), now, now] },
        { sql: `insert into parcelas (id, orcamento_id, valor, numero, valor_pago, data_vencimento, data_pagamento, status_pagamento, created_at, updated_at) values (?, ?, 100000, 3, 100000, ?, ?, 'Pago', ?, ?)`, args: [ids.paidInstallment, ids.scheduledBudget, today, today, now, now] },
        { sql: `insert into parcelas (id, orcamento_id, valor, numero, valor_pago, data_vencimento, status_pagamento, cancelada_em, created_at, updated_at) values (?, ?, 8800000, 4, 0, ?, 'Pendente', ?, ?, ?)`, args: [crypto.randomUUID(), ids.scheduledBudget, today, now, now, now] },
        { sql: `insert into recebimentos (id, parcela_id, valor_principal, juros, multa, desconto, taxas, valor_recebido, data_recebimento, created_at, updated_at) values (?, ?, 40000, 2000, 0, 0, 0, 42000, ?, ?, ?)`, args: [ids.partialReceipt, ids.partialInstallment, today, now, now] },
        { sql: `insert into recebimentos (id, parcela_id, valor_principal, juros, multa, desconto, taxas, valor_recebido, data_recebimento, created_at, updated_at) values (?, ?, 100000, 0, 0, 0, 0, 100000, ?, ?, ?)`, args: [ids.paidReceipt, ids.paidInstallment, today, now, now] },
        { sql: `insert into recebimentos (id, parcela_id, valor_principal, juros, multa, desconto, taxas, valor_recebido, data_recebimento, estornado_em, motivo_estorno, created_at, updated_at) values (?, ?, 7000000, 0, 0, 0, 0, 7000000, ?, ?, 'QA', ?, ?)`, args: [crypto.randomUUID(), ids.paidInstallment, today, now, now, now] },
        { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, data_competencia, data_pagamento, categoria, categoria_codigo, tipo_custo, centro_custo, status, created_at, updated_at) values (?, ?, ?, ?, 50000, ?, ?, ?, 'Software', 'outros', 'Fixo', 'Administrativo', 'Pago', ?, ?)`, args: [ids.paidExpense, ids.client, ids.project, `${PREFIX}Software`, today, today, today, now, now] },
        { sql: `insert into despesas (id, cliente_id, descricao, valor, data, data_competencia, data_pagamento, categoria, categoria_codigo, tipo_custo, centro_custo, status, created_at, updated_at) values (?, ?, ?, 20000, ?, ?, ?, 'Taxas', 'cartorio_taxas', 'Cartório e taxas', 'Administrativo', 'Pago', ?, ?)`, args: [ids.directPaidExpense, ids.client, `${PREFIX}Taxa`, today, today, today, now, now] },
        { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, data_competencia, categoria, categoria_codigo, tipo_custo, centro_custo, status, created_at, updated_at) values (?, ?, ?, ?, 30000, ?, ?, 'Combustível', 'outros', 'Variável de campo', 'Campo', 'Pendente', ?, ?)`, args: [ids.overdueExpense, ids.client, ids.project, `${PREFIX}Vencida`, localDateKey(-1), localDateKey(-1), now, now] },
        { sql: `insert into despesas (id, cliente_id, projeto_id, descricao, valor, data, data_competencia, categoria, categoria_codigo, tipo_custo, centro_custo, status, created_at, updated_at) values (?, ?, ?, ?, 10000, ?, ?, 'Alimentação', 'outros', 'Variável de campo', 'Campo', 'Pendente', ?, ?)`, args: [ids.futureExpense, ids.client, ids.project, `${PREFIX}Futura`, localDateKey(10), localDateKey(10), now, now] },
        { sql: `insert into despesas (id, cliente_id, descricao, valor, data, categoria, categoria_codigo, status, cancelada_em, motivo_cancelamento, created_at, updated_at) values (?, ?, ?, 6000000, ?, 'Outros', 'outros', 'Pendente', ?, 'QA', ?, ?)`, args: [crypto.randomUUID(), ids.client, `${PREFIX}Cancelada`, today, now, now, now] },
        { sql: `insert into despesas (id, cliente_id, descricao, valor, data, data_pagamento, categoria, categoria_codigo, status, estornada_em, motivo_estorno, created_at, updated_at) values (?, ?, ?, 5000000, ?, ?, 'Outros', 'outros', 'Pago', ?, 'QA', ?, ?)`, args: [crypto.randomUUID(), ids.client, `${PREFIX}Estornada`, today, today, now, now, now] },
        { sql: `insert into despesas (id, cliente_id, descricao, valor, data, categoria, categoria_codigo, status, deleted_at, created_at, updated_at) values (?, ?, ?, 4000000, ?, 'Outros', 'outros', 'Pendente', ?, ?, ?)`, args: [crypto.randomUUID(), ids.client, `${PREFIX}Excluída`, today, now, now, now] },
        { sql: `insert into viagens (id, cliente_id, projeto_id, finalidade, destino, data_inicio, adiantamento, status, created_at, updated_at) values (?, ?, ?, ?, 'Florianópolis', ?, 30000, 'em_andamento', ?, ?)`, args: [ids.travel, ids.client, ids.project, `${PREFIX}Levantamento`, today, now, now] },
        { sql: `insert into notas_fiscais (id, cliente_id, projeto_id, numero, data_emissao, valor, status, municipio, link, created_at, updated_at) values (?, ?, ?, ?, ?, 142000, 'emitida', 'Florianópolis', 'https://example.test/nf', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.project, `${PREFIX}NF-001`, today, now, now] }
      ], 'write');
    } finally {
      database.close();
    }

    const response = await page.request.get(`${auth.origin}/api/financeiro/overview`, { headers: auth.headers });
    expect(response.ok(), await response.text()).toBe(true);
    const overview = await response.json() as { analytics: { kpis: Record<string, number>; monthly: Array<Record<string, number | string>> }; meta: Record<string, number | boolean | string> };
    expect(overview.analytics.kpis).toMatchObject({
      receitaContratada: 800000, receitaRecebida: 642000, receitaPendente: 60000, receitaAtrasada: 100000,
      despesasLancadas: 110000, despesasPagas: 70000, despesasAtrasadas: 30000, resultadoCaixa: 572000
    });
    expect(overview.meta).toMatchObject({ expenseCount: 4, openAccountCount: 4, hasSourceData: true, hasFilteredData: true });
    await fs.writeFile(path.join(evidenceRoot, 'reconciliacao-api.json'), `${JSON.stringify(overview, null, 2)}\n`, 'utf8');

    await page.goto('/financeiro?periodo=12m');
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();
    await page.getByText('Indicadores complementares', { exact: true }).click();
    for (const [label, value] of [['Recebido', 'R$ 6.420,00'], ['A receber', 'R$ 600,00'], ['Despesas pagas', 'R$ 700,00'], ['Resultado de caixa', 'R$ 5.720,00']] as const) {
      const card = page.getByRole('article', { name: label, exact: true });
      await expect(card).toBeVisible();
      await expect(card.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('region', { name: 'Pendências', exact: true }).getByText('Recebimentos atrasados', { exact: true })).toBeVisible();
    await page.getByText('Ver todas as pendências', { exact: true }).click();
    await expect(page.getByText('Contas vencidas', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-visao-geral-reconciliada.png'), fullPage: true });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = await downloadPromise;
    const csvPath = path.join(evidenceRoot, 'fluxo-caixa.csv');
    await download.saveAs(csvPath);
    const csv = await fs.readFile(csvPath, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Período";"Recebido";"Despesas";"Resultado"');
    expect(csv).toContain('"6420,00";"700,00";"5720,00"');
  });

  test('rotas, erros, teclado e links profundos permanecem recuperáveis', async ({ page }) => {
    await ensureFinancialJourneyFixture();
    await unlock(page, '/dashboard-financeiro?periodo=invalido');
    await expect(page).toHaveURL(/\/financeiro/);
    await expect(page.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
    const overviewTab = page.getByRole('tab', { name: 'Visão geral' });
    await overviewTab.focus();
    await overviewTab.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Contas a receber' })).toBeFocused();
    await expect(page).toHaveURL(/tab=faturas/);

    await page.route('**/api/financeiro/parcelas?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha controlada S07"}' }));
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByRole('alert').getByText('Não foi possível carregar as contas a receber.')).toBeVisible();
    await page.unroute('**/api/financeiro/parcelas?*');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByText(`${PREFIX}Cliente`, { exact: true }).first()).toBeVisible();

    await page.goto(`/financeiro?tab=faturas&parcela=${ids.partialInstallment}`);
    await unlockCurrent(page);
    const receivableDialog = page.getByRole('dialog', { name: 'GeoGestor • Demonstrativo de cobrança' });
    await expect(receivableDialog).toBeVisible();
    await expect(receivableDialog.getByText(`${PREFIX}Contrato parcelado`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar modal' }).click();

    await page.getByRole('tab', { name: 'Contas a pagar' }).click();
    await page.route('**/api/financeiro/despesas?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha controlada S07"}' }));
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByRole('alert').getByText('Não foi possível carregar as contas a pagar.')).toBeVisible();
    await page.unroute('**/api/financeiro/despesas?*');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('button', { name: `Editar despesa ${PREFIX}Software`, exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '02-contas-e-recuperacao.png'), fullPage: true });
  });

  test('auxiliares, diagnóstico somente leitura, modo escuro e mobile', async ({ page }) => {
    await ensureFinancialJourneyFixture();
    const auth = await unlock(page, '/financeiro?tab=auxiliares');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    await expect(page.getByRole('tabpanel', { name: 'Viagens e prestação' }).getByText(`${PREFIX}Levantamento`, { exact: true })).toBeVisible();
    const travelTab = page.getByRole('tab', { name: 'Viagens e prestação' });
    await travelTab.focus();
    await travelTab.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Documentos fiscais' })).toBeFocused();
    await expect(page.getByText('O GeoGestor apenas registra os dados informados. Ele não emite NFS-e e não calcula tributos.')).toBeVisible();
    await page.getByRole('tab', { name: 'Diagnóstico de vínculos' }).click();

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT!;
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const countBefore = await database.execute('select count(*) as total from financeiro_eventos');
    const before = Number(countBefore.rows[0].total);
    await expect(page.getByText('O diagnóstico não altera os registros.')).toBeVisible();
    await page.getByRole('button', { name: 'Executar novamente' }).click();
    await expect(page.getByRole('button', { name: 'Executar novamente' })).toBeEnabled();
    const countAfter = await database.execute('select count(*) as total from financeiro_eventos');
    expect(Number(countAfter.rows[0].total)).toBe(before);
    database.close();

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-auxiliares-mobile-escuro.png'), fullPage: true });
  });
});
