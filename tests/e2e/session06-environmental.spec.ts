import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = process.env.GEOGESTOR_S06_PREFIX ?? 'QA-AUDIT-S06-20260911-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

const ids = {
  client: crypto.randomUUID(), property: crypto.randomUUID(), demand: crypto.randomUUID(), assessment: crypto.randomUUID(),
  license: crypto.randomUUID(), condition: crypto.randomUUID(), legacyCalculation: crypto.randomUUID()
};

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

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function ensureEnvironmentalFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(evidenceRoot, { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const existing = await database.execute({ sql: 'select id from projetos where id = ? limit 1', args: [ids.demand] });
    if (existing.rows.length > 0) return;
    const now = relativeInstant();
    const boundaryLicenses = [-1, 0, 60, 90, 120, 121].map(offset => ({ id: crypto.randomUUID(), offset }));
    await database.batch([
      { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PF', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente Açores`, now, now] },
      { sql: `insert into propriedades (id, cliente_id, nome, area_ha, municipio, uf, created_at, updated_at) values (?, ?, ?, 100, 'Florianópolis', 'SC', ?, ?)`, args: [ids.property, ids.client, `${PREFIX}Imóvel`, now, now] },
      { sql: `insert into projetos (id, cliente_id, propriedade_id, nome, descricao, status, tipo, data_inicio, data_entrega, created_at, updated_at) values (?, ?, ?, ?, ?, 'Em Andamento', 'Ambiental', ?, ?, ?, ?)`, args: [ids.demand, ids.client, ids.property, `${PREFIX}Demanda: Área <Norte> / CAR? *`, 'Descrição ambiental sintética para auditoria.', localDateKey(-20), localDateKey(30), now, now] },
      { sql: `insert into projetos (id, cliente_id, propriedade_id, nome, descricao, status, tipo, data_inicio, data_entrega, created_at, updated_at) values (?, ?, ?, ?, ?, 'Suspenso', 'Perícia', ?, ?, ?, ?)`, args: [ids.assessment, ids.client, ids.property, `${PREFIX}Perícia Judicial`, 'Perícia sintética.', localDateKey(-10), localDateKey(60), now, now] },
      { sql: `insert into ambiental (id, projeto_id, cliente_id, propriedade_id, orgao_ambiental, tipo_demanda, protocolo, status_fase, created_at, updated_at) values (?, ?, ?, ?, 'IMA/SC', 'Licenciamento ambiental', ?, 'Documentação', ?, ?)`, args: [crypto.randomUUID(), ids.demand, ids.client, ids.property, `${PREFIX}PROTOCOLO`, now, now] },
      { sql: `insert into pericias (id, projeto_id, cliente_id, propriedade_id, tipo_pericia, numero_processo, status, created_at, updated_at) values (?, ?, ?, ?, 'Judicial', ?, 'Em andamento', ?, ?)`, args: [crypto.randomUUID(), ids.assessment, ids.client, ids.property, `${PREFIX}PROCESSO`, now, now] },
      { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, created_at, updated_at) values (?, ?, ?, ?, 'A Fazer', 'Média', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.demand, `${PREFIX}Sem prazo`, now, now] },
      { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, 'A Fazer', 'Alta', ?, ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.demand, `${PREFIX}Ação vencida prioritária`, localDateKey(-1), now, now] },
      { sql: `insert into licencas (id, projeto_id, cliente_id, numero, protocolo, orgao, tipo_licenca, data_emissao, data_vencimento, status, created_at, updated_at) values (?, ?, ?, ?, ?, 'IMA/SC', 'LO', ?, ?, 'Válida', ?, ?)`, args: [ids.license, ids.demand, ids.client, `${PREFIX}LO-030`, `${PREFIX}P-030`, localDateKey(-365), localDateKey(30), now, now] },
      ...boundaryLicenses.map(({ id, offset }) => ({ sql: `insert into licencas (id, projeto_id, cliente_id, numero, orgao, tipo_licenca, data_emissao, data_vencimento, status, created_at, updated_at) values (?, ?, ?, ?, 'IMA/SC', 'LP', ?, ?, ?, ?, ?)`, args: [id, ids.demand, ids.client, `${PREFIX}LP-${offset}`, localDateKey(-100), localDateKey(offset), offset === 121 ? 'Status legado inesperado' : 'Válida', now, now] })),
      { sql: `insert into condicionantes_ambientais (id, licenca_id, titulo, descricao, data_limite, responsavel, status, created_at, updated_at) values (?, ?, ?, 'Entrega anual', ?, 'Equipe QA', 'Pendente', ?, ?)`, args: [ids.condition, ids.license, `${PREFIX}Condicionante vencida`, localDateKey(-1), now, now] },
      { sql: `insert into calculos_salvos (id, tipo, nome, data_calculo, entradas_json, resultado_json, created_at, updated_at) values (?, 'ambiental', ?, ?, '{json-invalido', '{json-invalido', ?, ?)`, args: [ids.legacyCalculation, `${PREFIX}Legado inválido`, localDateKey(), now, now] }
    ], 'write');
  } finally {
    database.close();
  }
}

test.describe('Sessão 06 — Ambiental', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(240_000);

  test('rotas, vazio, erro recuperável, seed e fronteiras de prazo', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const auth = await unlock(page, '/ambiental?tab=invalida&page=abc&action=new');
    if (!auth) throw new Error('Credenciais isoladas da suíte ausentes.');
    await expect(page).toHaveURL(/tab=ambiental/);
    await expect(page).not.toHaveURL(/page=|action=/);
    await expect(page.getByRole('heading', { name: 'Nenhuma demanda cadastrada' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.route('**/api/ambiental?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha controlada S06' }) }));
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar as demandas' })).toBeVisible();
    await page.unroute('**/api/ambiental?*');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { name: 'Nenhuma demanda cadastrada' })).toBeVisible();

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const now = relativeInstant();
    const boundaryLicenses = [-1, 0, 60, 90, 120, 121].map(offset => ({ id: crypto.randomUUID(), offset }));
    try {
      await database.batch([
        { sql: `insert into clientes (id, nome, tipo_pessoa, situacao, created_at, updated_at) values (?, ?, 'PF', 'Ativo', ?, ?)`, args: [ids.client, `${PREFIX}Cliente Açores`, now, now] },
        { sql: `insert into propriedades (id, cliente_id, nome, area_ha, municipio, uf, created_at, updated_at) values (?, ?, ?, 100, 'Florianópolis', 'SC', ?, ?)`, args: [ids.property, ids.client, `${PREFIX}Imóvel`, now, now] },
        { sql: `insert into projetos (id, cliente_id, propriedade_id, nome, descricao, status, tipo, data_inicio, data_entrega, created_at, updated_at) values (?, ?, ?, ?, ?, 'Em Andamento', 'Ambiental', ?, ?, ?, ?)`, args: [ids.demand, ids.client, ids.property, `${PREFIX}Demanda: Área <Norte> / CAR? *`, 'Descrição ambiental sintética para auditoria.', localDateKey(-20), localDateKey(30), now, now] },
        { sql: `insert into projetos (id, cliente_id, propriedade_id, nome, descricao, status, tipo, data_inicio, data_entrega, created_at, updated_at) values (?, ?, ?, ?, ?, 'Suspenso', 'Perícia', ?, ?, ?, ?)`, args: [ids.assessment, ids.client, ids.property, `${PREFIX}Perícia Judicial`, 'Perícia sintética.', localDateKey(-10), localDateKey(60), now, now] },
        { sql: `insert into ambiental (id, projeto_id, cliente_id, propriedade_id, orgao_ambiental, tipo_demanda, protocolo, status_fase, created_at, updated_at) values (?, ?, ?, ?, 'IMA/SC', 'Licenciamento ambiental', ?, 'Documentação', ?, ?)`, args: [crypto.randomUUID(), ids.demand, ids.client, ids.property, `${PREFIX}PROTOCOLO`, now, now] },
        { sql: `insert into pericias (id, projeto_id, cliente_id, propriedade_id, tipo_pericia, numero_processo, status, created_at, updated_at) values (?, ?, ?, ?, 'Judicial', ?, 'Em andamento', ?, ?)`, args: [crypto.randomUUID(), ids.assessment, ids.client, ids.property, `${PREFIX}PROCESSO`, now, now] },
        { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, created_at, updated_at) values (?, ?, ?, ?, 'A Fazer', 'Média', ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.demand, `${PREFIX}Sem prazo`, now, now] },
        { sql: `insert into tarefas (id, cliente_id, projeto_id, titulo, status, prioridade, data_limite, created_at, updated_at) values (?, ?, ?, ?, 'A Fazer', 'Alta', ?, ?, ?)`, args: [crypto.randomUUID(), ids.client, ids.demand, `${PREFIX}Ação vencida prioritária`, localDateKey(-1), now, now] },
        { sql: `insert into licencas (id, projeto_id, cliente_id, numero, protocolo, orgao, tipo_licenca, data_emissao, data_vencimento, status, created_at, updated_at) values (?, ?, ?, ?, ?, 'IMA/SC', 'LO', ?, ?, 'Válida', ?, ?)`, args: [ids.license, ids.demand, ids.client, `${PREFIX}LO-030`, `${PREFIX}P-030`, localDateKey(-365), localDateKey(30), now, now] },
        ...boundaryLicenses.map(({ id, offset }) => ({ sql: `insert into licencas (id, projeto_id, cliente_id, numero, orgao, tipo_licenca, data_emissao, data_vencimento, status, created_at, updated_at) values (?, ?, ?, ?, 'IMA/SC', 'LP', ?, ?, ?, ?, ?)`, args: [id, ids.demand, ids.client, `${PREFIX}LP-${offset}`, localDateKey(-100), localDateKey(offset), offset === 121 ? 'Status legado inesperado' : 'Válida', now, now] })),
        { sql: `insert into condicionantes_ambientais (id, licenca_id, titulo, descricao, data_limite, responsavel, status, created_at, updated_at) values (?, ?, ?, 'Entrega anual', ?, 'Equipe QA', 'Pendente', ?, ?)`, args: [ids.condition, ids.license, `${PREFIX}Condicionante vencida`, localDateKey(-1), now, now] },
        { sql: `insert into calculos_salvos (id, tipo, nome, data_calculo, entradas_json, resultado_json, created_at, updated_at) values (?, 'ambiental', ?, ?, '{json-invalido', '{json-invalido', ?, ?)`, args: [ids.legacyCalculation, `${PREFIX}Legado inválido`, localDateKey(), now, now] }
      ], 'write');
    } finally {
      database.close();
    }

    const demandResponse = await page.request.get(`${auth.origin}/api/ambiental?q=${encodeURIComponent(PREFIX)}`, { headers: auth.headers });
    expect(demandResponse.ok(), await demandResponse.text()).toBe(true);
    const demands = await demandResponse.json() as { total: number; items: Array<{ id: string; proximaAcao: string | null }> };
    expect(demands.total).toBe(2);
    expect(demands.items.find(item => item.id === ids.demand)?.proximaAcao).toBe(`${PREFIX}Ação vencida prioritária`);

    const expectedByWindow = new Map([['30d', 2], ['60d', 3], ['90d', 4], ['120d', 5], ['vencida', 1]]);
    for (const [window, expected] of expectedByWindow) {
      const response = await page.request.get(`${auth.origin}/api/licencas?vencimento=${window}`, { headers: auth.headers });
      expect(response.ok(), await response.text()).toBe(true);
      expect((await response.json() as unknown[]).length, window).toBe(expected);
    }
    const allLicenseResponse = await page.request.get(`${auth.origin}/api/licencas`, { headers: auth.headers });
    const allLicenses = await allLicenseResponse.json() as Array<{ numero: string; statusRegistrado: string; statusRegistradoReconhecido: boolean }>;
    expect(allLicenses.find(item => item.numero === `${PREFIX}LP-121`)).toMatchObject({ statusRegistrado: 'Status legado inesperado', statusRegistradoReconhecido: false });
    await page.screenshot({ path: path.join(evidenceRoot, '01-estado-vazio-recuperado.png'), fullPage: true });
  });

  test('demandas, teclado, andamento e os quatro tipos de PDF', async ({ page }) => {
    await ensureEnvironmentalFixture();
    await unlock(page, '/ambiental?tab=ambiental');
    await expect(page.getByRole('link', { name: new RegExp(`${PREFIX}Demanda`) })).toBeVisible();
    const demandTab = page.getByRole('tab', { name: 'Demandas Ambientais' });
    await demandTab.focus();
    await demandTab.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Licenciamento' })).toBeFocused();
    await expect(page).toHaveURL(/tab=licenciamento/);
    await page.getByRole('tab', { name: 'Demandas Ambientais' }).click();
    await expect(page).toHaveURL(/tab=ambiental/);

    await page.getByRole('link', { name: new RegExp(`${PREFIX}Demanda`) }).click();
    await expect(page.getByRole('heading', { name: `${PREFIX}Demanda: Área <Norte> / CAR? *` })).toBeVisible();

    await page.getByRole('button', { name: 'Alterar fase' }).click();
    await page.getByLabel('Nova fase').click();
    await page.getByRole('option', { name: 'Protocolo', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar fase' }).click();
    await expect(page.getByText('Protocolo', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Registrar andamento' }).click();
    await page.getByLabel('Título').fill(`${PREFIX}Protocolo confirmado`);
    await page.getByLabel('Descrição').fill('Movimentação sintética registrada pela suíte ambiental.');
    await page.getByRole('button', { name: 'Registrar andamento' }).last().click();
    await expect(page.getByText(`${PREFIX}Protocolo confirmado`)).toBeVisible();

    for (const [type, label] of [['vistoria', 'Vistoria Técnica'], ['fauna', 'Monitoramento de Fauna'], ['flora', 'Inventário Florestal'], ['outros', 'Laudo Ambiental Genérico']] as const) {
      await page.getByRole('button', { name: 'Gerar relatório' }).click();
      await page.getByLabel('Tipo de documento').click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill(`${PREFIX}Cliente Açores`);
      await page.getByLabel('Responsável pelo documento').fill('EXEMPLO FICTÍCIO — Responsável Técnico QA');
      await page.locator('#laudo-data').click();
      const reference = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${relativeDate()}T12:00:00-03:00`));
      await page.getByRole('gridcell', { name: reference, exact: true }).click();
      await page.getByLabel('Observações técnicas (opcional)').fill(`EXEMPLO FICTÍCIO — Documento sintético: ${label}.`);
      await page.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
      await expect(page.getByTitle('Pré-visualização do relatório')).toBeVisible();
      const issueResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/documentos/emitir'));
      await page.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
      const issue = await issueResponse; expect(issue.ok()).toBe(true);
      const issued = await issue.json() as { fileName: string };
      await expect(page.getByText('Emissão registrada', { exact: true })).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(issued.fileName);
      const destination = path.join(evidenceRoot, `laudo-${type}.pdf`);
      await download.saveAs(destination);
      expect((await fs.stat(destination)).size).toBeGreaterThan(1000);
      await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }

    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-demanda-historico-e-prazos.png'), fullPage: true });
  });

  test('licenças, filtros, status legado e link profundo de condicionante', async ({ page }) => {
    await ensureEnvironmentalFixture();
    await unlock(page, '/ambiental?tab=licenciamento');
    await expect(page.getByText(`${PREFIX}LO-030`, { exact: true }).last()).toBeVisible();
    await page.getByLabel('Filtrar licenças por vencimento').click();
    await page.getByRole('option', { name: 'Próximos 30 dias' }).click();
    await expect(page.getByText(`${PREFIX}LO-030`, { exact: true }).last()).toBeVisible();
    await expect(page.getByText(`${PREFIX}LP-60`, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceRoot, '03-licencas-fronteira-30-dias.png'), fullPage: true });

    await page.goto(`/ambiental/licencas/${ids.license}?tab=conditions&condicionante=${ids.condition}`);
    await unlockCurrent(page);
    const condition = page.locator(`#condition-${ids.condition}`);
    await expect(condition).toBeVisible();
    await expect(condition).toBeFocused();
    await expect(condition.getByText('Vencida', { exact: true })).toBeVisible();
    await condition.getByRole('button', { name: 'Marcar como cumprida' }).click();
    await expect(condition.getByText('Cumprida', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '04-condicionante-link-profundo.png'), fullPage: true });
  });

  test('CAR localizado, validações, artigos 12/15/67/68 e histórico resiliente', async ({ page }) => {
    await ensureEnvironmentalFixture();
    await unlock(page, '/ambiental?tab=car');
    await page.getByLabel('Área total do imóvel (ha)').fill('100,00');
    await page.getByLabel('APP conservada ou em recuperação (ha)').fill('10');
    await page.getByLabel('Vegetação nativa fora de APP (ha)').fill('15');
    await expect(page.getByText('Déficit quantitativo preliminar')).toBeVisible();
    await expect(page.getByText('5,00 ha', { exact: true })).toBeVisible();

    for (const label of ['O benefício não implicará conversão de novas áreas.', 'A APP está conservada ou em processo de recuperação.', 'A inclusão do imóvel no CAR foi requerida.']) {
      await page.getByText(label, { exact: true }).click();
    }
    await expect(page.getByText('Atendimento quantitativo preliminar')).toBeVisible();
    await expect(page.getByText('25,00 ha', { exact: true })).toBeVisible();

    await page.getByLabel('Área em módulos fiscais').fill('4');
    await page.getByText('O imóvel já detinha essa extensão em 22/07/2008.', { exact: true }).click();
    await page.getByLabel('Remanescente de vegetação nativa em 22/07/2008 (ha)').fill('10');
    await expect(page.getByText('Art. 67', { exact: true })).toBeVisible();
    await page.getByText('Há indícios de supressão regular conforme a legislação da época — art. 68.', { exact: true }).click();
    await expect(page.getByText('Análise documental necessária')).toBeVisible();

    await page.getByRole('button', { name: 'Salvar cálculo' }).click();
    await expect(page.getByText(`${PREFIX}Legado inválido`).first()).toBeVisible();
    await expect(page.getByText('Dados legados inválidos').first()).toBeVisible();
    await page.getByLabel('Nome do cálculo').fill(`${PREFIX}CAR localizado`);
    await page.getByRole('button', { name: 'Confirmar salvamento' }).click();
    await expect(page.getByText(`${PREFIX}CAR localizado`)).toBeVisible();
    await page.getByRole('button', { name: 'Fechar modal' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByLabel('Área total do imóvel (ha)').fill('1e4');
    await expect(page.getByText('Informe uma área total maior que zero.')).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '05-car-mobile-validacao.png'), fullPage: true });

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT!;
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    try {
      const saved = await database.execute({ sql: `select count(*) as total from calculos_salvos where nome = ?`, args: [`${PREFIX}CAR localizado`] });
      expect(Number(saved.rows[0].total)).toBe(1);
      const fulfilled = await database.execute({ sql: `select status, data_cumprimento from condicionantes_ambientais where id = ?`, args: [ids.condition] });
      expect(fulfilled.rows[0]).toMatchObject({ status: 'Cumprida', data_cumprimento: localDateKey() });
      const audit = await database.execute({ sql: `select count(*) as total from audit_logs where entity in ('Demanda Ambiental', 'Andamento Ambiental', 'Condicionante Ambiental', 'CalculoSalvo')`, args: [] });
      expect(Number(audit.rows[0].total)).toBeGreaterThanOrEqual(4);
    } finally {
      database.close();
    }
  });
});
