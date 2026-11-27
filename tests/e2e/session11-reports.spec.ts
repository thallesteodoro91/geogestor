import AxeBuilder from '@axe-core/playwright';
import type { ManagerialReport } from '@geogestor/contracts';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S11-20260917-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

type Auth = { origin: string; headers: Record<string, string> };

function dateKey(offset = 0) {
  return relativeDate(offset);
}

async function unlock(page: Page, target: string): Promise<Auth> {
  await page.goto(target);
  const heading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  await expect(heading).toBeVisible();
  await page.getByLabel('Senha local').fill(PASSWORD);
  const unlockResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'));
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

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function downloadPdf(page: Page, type: 'financeiro' | 'projetos' | 'executivo', expectedName: string) {
  await page.getByRole('tab', { name: type === 'financeiro' ? 'Financeiro' : type === 'projetos' ? 'Projetos' : 'Executivo' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(expectedName);
  const destination = path.join(evidenceRoot, expectedName);
  await download.saveAs(destination);
  const stat = await fs.stat(destination);
  expect(stat.size).toBeGreaterThan(5_000);
  await expect(page.getByText('PDF gerado com os filtros aplicados.').last()).toBeVisible();
  return destination;
}

test.describe('Sessão 11 — Relatórios', () => {
  test.use({ actionTimeout: 25_000 });
  test.setTimeout(300_000);

  test('reconcilia API, tela, acessibilidade, impressão e três PDFs reais', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    const today = dateKey();
    const logo = `data:image/png;base64,${await fs.readFile(path.resolve(process.cwd(), 'apps', 'web', 'src', 'assets', 'magnific-icons', 'analysis_5706212.png'), 'base64')}`;
    const clientId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const installmentId = crypto.randomUUID();
    try {
      const statements: Array<{ sql: string; args: Array<string | number | null> }> = [
        {
          sql: `insert into configuracoes_operacionais (id, chave, valor_json, origem, created_at, updated_at) values (?, 'geogestor_empresa_template', ?, 'auditoria', ?, ?)`,
          args: [crypto.randomUUID(), JSON.stringify({
            version: 1, appLogo: '', logo, razao: 'Empresa QA GeoGestor', cnpj: '', telefone: '(48) 3333-4444',
            email: 'qa@geogestor.test', endereco: 'Florianópolis/SC', conselhoProfissional: '', registroProfissional: '',
            cor: '#4338ca', termos: ''
          }), now, now]
        },
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PJ', 'Ativo', ?, ?)`, args: [clientId, `${PREFIX}Cliente`, now, now] },
        { sql: `insert into orcamentos (id, cliente_id, valor_total, status, descricao, data_competencia, impostos_previstos, created_at, updated_at) values (?, ?, 10000, 'aprovado', ?, ?, 1000, ?, ?)`, args: [budgetId, clientId, `${PREFIX}Contrato`, today, now, now] },
        { sql: `insert into parcelas (id, orcamento_id, valor, numero, valor_pago, data_competencia, data_vencimento, status_pagamento, created_at, updated_at) values (?, ?, 10000, 1, 4000, ?, ?, 'Pendente', ?, ?)`, args: [installmentId, budgetId, today, dateKey(-1), now, now] },
        { sql: `insert into recebimentos (id, parcela_id, valor_principal, valor_recebido, data_recebimento, created_at, updated_at) values (?, ?, 4000, 4000, ?, ?, ?)`, args: [crypto.randomUUID(), installmentId, today, now, now] },
        { sql: `insert into despesas (id, cliente_id, descricao, valor, data, data_pagamento, categoria, categoria_codigo, status, created_at, updated_at) values (?, ?, ?, 3000, ?, ?, 'Campo principal', 'outros', 'Pago', ?, ?)`, args: [crypto.randomUUID(), clientId, `${PREFIX}Despesa`, today, today, now, now] }
      ];
      for (let index = 0; index < 4; index += 1) {
        statements.push({
          sql: `insert into orcamentos (id, cliente_id, valor_total, status, descricao, data_competencia, created_at, updated_at) values (?, ?, 999999, 'rejeitado', ?, ?, ?, ?)`,
          args: [crypto.randomUUID(), clientId, `${PREFIX}Rejeitado ${index + 1}`, today, now, now]
        });
      }
      for (let index = 0; index < 24; index += 1) {
        statements.push({
          sql: `insert into despesas (id, cliente_id, descricao, valor, data, data_pagamento, categoria, categoria_codigo, status, created_at, updated_at) values (?, ?, ?, 100, ?, ?, ?, 'outros', 'Pago', ?, ?)`,
          args: [crypto.randomUUID(), clientId, `${PREFIX}Despesa ${index + 1}`, today, today, `${PREFIX}Categoria longa ${String(index + 1).padStart(2, '0')} com acentos & símbolo <inerte>`, now, now]
        });
      }
      const projects = [
        { name: `${PREFIX}<img src=x onerror=alert(1)>`, status: 'Em Andamento', area: null, due: dateKey(-1) },
        { name: `${PREFIX}Vence hoje`, status: 'Planejamento', area: 0, due: today },
        { name: `${PREFIX}Vence +30`, status: 'Aguardando Cliente', area: 12.5, due: dateKey(30) },
        { name: `${PREFIX}Vence +31`, status: 'Suspenso', area: 3, due: dateKey(31) },
        { name: `${PREFIX}Concluído`, status: 'Concluído', area: 100, due: dateKey(-2) },
        { name: `${PREFIX}Cancelado`, status: 'Cancelado', area: 100, due: dateKey(-2) },
        ...Array.from({ length: 12 }, (_, index) => ({
          name: `${PREFIX}Projeto crítico ${String(index + 1).padStart(2, '0')} com nome longo para documento multipágina`,
          status: 'Em Andamento', area: 1, due: dateKey(-2)
        }))
      ];
      for (const project of projects) {
        statements.push({
          sql: `insert into projetos (id, cliente_id, nome, status, data_inicio, data_entrega, area_ha, tipo, municipio, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, 'Rural', 'Florianópolis', ?, ?)`,
          args: [crypto.randomUUID(), clientId, project.name, project.status, today, project.due, project.area, now, now]
        });
      }
      await database.batch(statements, 'write');
    } finally {
      database.close();
    }

    const reportUrl = `/relatorios?inicio=${today}&fim=${today}&periodo=personalizado`;
    const auth = await unlock(page, reportUrl);
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await expect(page.getByText('R$ 40,00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('R$ 60,00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('R$ 54,00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('-R$ 14,00', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Indicadores comerciais').getByText('20%', { exact: true })).toBeVisible();

    const apiResponse = await page.request.get(`${auth.origin}/api/relatorios/geral?inicio=${today}&fim=${today}`, { headers: auth.headers });
    expect(apiResponse.ok(), await apiResponse.text()).toBe(true);
    const report = await apiResponse.json() as ManagerialReport;
    expect(report.financial.kpis).toMatchObject({
      contractedRevenue: 10_000, receivedRevenue: 4_000, pendingRevenue: 6_000,
      overdueRevenue: 6_000, paidExpenses: 5_400, cashResult: -1_400,
      estimatedTaxes: 1_000, approvedBudgets: 1, decidedBudgets: 5, conversionRate: 20
    });
    expect(report.financial.expensesByCategory.reduce((sum, item) => sum + item.paidTotal, 0)).toBe(5_400);
    expect(report.operational.kpis).toMatchObject({
      totalProjects: 18, activeProjects: 16, completedProjects: 1, cancelledProjects: 1,
      overdueProjects: 13, dueSoonProjects: 2, activeAreaHa: 27.5, projectsWithKnownArea: 15
    });
    expect([...report.financial.alerts, ...report.operational.alerts].map((alert) => alert.code)).toEqual([
      'overdue_revenue', 'negative_cash', 'low_conversion', 'overdue_projects', 'unknown_area'
    ]);
    await fs.writeFile(path.join(evidenceRoot, 'resposta-gerencial-sanitizada.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const receivedCard = page.getByText('Receita recebida', { exact: true }).first().locator('xpath=ancestor::article');
    await receivedCard.getByText('Ver composição', { exact: true }).click();
    await expect(receivedCard.getByText('Registros').locator('..').getByText('1', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-financeiro-reconciliado.png'), fullPage: true });

    await page.getByRole('tab', { name: 'Projetos' }).click();
    await expect(page.getByText('16', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('15 projeto(s) ativo(s) com área', { exact: true })).toBeVisible();
    await expect(page.getByText('Mostrando 8 de 15 entregas')).toBeVisible();
    await expect(page.locator('main img[src="x"]')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-projetos-agenda.png'), fullPage: true });

    await page.getByRole('tab', { name: 'Executivo' }).click();
    for (const title of [
      'Recebimentos vencidos exigem atenção', 'Resultado de caixa negativo', 'Conversão comercial abaixo de 30%',
      'Projetos com prazo vencido', 'Área não informada em projetos ativos'
    ]) await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-executivo-alertas.png'), fullPage: true });

    await page.getByRole('button', { name: 'Pré-visualização do documento' }).click();
    const screenPreview = page.locator('#report-print-preview [data-report-document]');
    await expect(screenPreview.getByText('Síntese executiva')).toBeVisible();
    await expect(screenPreview.getByText('Pontos de atenção')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-report-document]').last()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '04-impressao-executivo.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });

    const expectedSuffix = `${today}-${today}.pdf`;
    const pdfs = [
      await downloadPdf(page, 'financeiro', `geogestor-financeiro-${expectedSuffix}`),
      await downloadPdf(page, 'projetos', `geogestor-projetos-${expectedSuffix}`),
      await downloadPdf(page, 'executivo', `geogestor-executivo-${expectedSuffix}`)
    ];
    await fs.writeFile(path.join(evidenceRoot, 'pdfs-gerados.json'), `${JSON.stringify(pdfs, null, 2)}\n`, 'utf8');

    await unlock(page, `/relatorio-executivo?inicio=${today}&fim=${today}`);
    await expect.poll(() => {
      const url = new URL(page.url());
      return [url.pathname, url.searchParams.get('inicio'), url.searchParams.get('fim'), url.searchParams.get('tipo')];
    }).toEqual(['/relatorios', today, today, 'executivo']);
    await expect(page.getByRole('tab', { name: 'Executivo' })).toHaveAttribute('aria-selected', 'true');

    await unlock(page, '/relatorios?tipo=FINANCEIRO&tipo=projetos&periodo=invalido');
    await expect(page).toHaveURL(/\/relatorios$/);
    await expect(page.getByRole('tab', { name: 'Financeiro' })).toHaveAttribute('aria-selected', 'true');

    await unlock(page, '/relatorios?inicio=2026-02-30&periodo=personalizado');
    await expect(page.getByRole('heading', { name: 'Período inválido' })).toBeVisible();
    await page.getByRole('button', { name: /Selecionar período de análise/ }).click();
    await expect(page.locator('#report-period-error')).toContainText('datas reais');

    for (const viewport of [
      { width: 360, height: 800 }, { width: 768, height: 900 }, { width: 1024, height: 800 }, { width: 1440, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      await unlock(page, reportUrl);
      await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
      expect(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth + 1)).toBe(true);
    }
  });
});
