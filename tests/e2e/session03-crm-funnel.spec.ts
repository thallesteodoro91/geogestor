import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { e2eEvidenceRoot, relativeDate, relativeInstant } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S03-';
const evidenceRoot = e2eEvidenceRoot();
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps', 'api', 'package.json'));
const { createClient } = requireFromApi('@libsql/client') as typeof import('@libsql/client');

function dateKey(offsetDays: number) {
  return relativeDate(offsetDays);
}

function dateLabel(offsetDays: number) {
  const [year, month, day] = dateKey(offsetDays).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
}

async function selectDate(page: Page, trigger: Locator, offsetDays: number) {
  await trigger.click();
  const target = page.getByRole('gridcell', { name: dateLabel(offsetDays) });
  for (let attempts = 0; attempts < 14 && !await target.isVisible(); attempts += 1) {
    const direction = dateKey(offsetDays).localeCompare(dateKey(0));
    await page.getByRole('button', { name: direction >= 0 ? /próximo mês/i : /mês anterior/i }).click();
  }
  await target.click();
}

async function selectCombobox(page: Page, trigger: Locator, optionName: string) {
  await trigger.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function unlockCurrent(page: Page) {
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  await expect(page.getByRole('main')).toBeVisible();
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    const unlockResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/auth/unlock'), { timeout: 30_000 });
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    const response = await unlockResponse;
    expect(response.ok()).toBe(true);
    const payload = await response.json() as { token: string };
    const requestHeaders = await response.request().allHeaders();
    return {
      origin: new URL(response.url()).origin,
      headers: {
        ...Object.fromEntries(Object.entries(requestHeaders).filter(([key]) => key.toLowerCase() === 'x-api-token')),
        'x-local-session': payload.token,
      },
    };
  }
  throw new Error('A sessão já estava desbloqueada sem uma requisição capturável.');
}

async function unlock(page: Page, target = '/') {
  await page.goto(target);
  return unlockCurrent(page);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function ensureFunilFixture() {
  const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
  if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
  await fs.mkdir(evidenceRoot, { recursive: true });
  const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
  try {
    const existing = await database.execute({ sql: 'select id from oportunidades where titulo = ? limit 1', args: [`${PREFIX}Prospectado Atrasado`] });
    if (existing.rows.length > 0) return;
    const clientId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const now = relativeInstant();
    const stale = relativeInstant(-16);
    const opportunities = [
      { title: `${PREFIX}Prospectado Atrasado`, stage: 'Prospectado', value: 100_000, probability: 1_000, action: 'Retomar contato', actionDate: dateKey(-1), changedAt: stale },
      { title: `${PREFIX}Contato Hoje`, stage: 'Contato', value: 200_000, probability: 3_000, action: 'Reunião técnica', actionDate: dateKey(0), changedAt: now },
      { title: `${PREFIX}Proposta Futura`, stage: 'Proposta', value: 300_000, probability: 6_500, action: 'Enviar revisão', actionDate: dateKey(1), changedAt: now },
      { title: `${PREFIX}Ganho`, stage: 'Ganho', value: 400_000, probability: 10_000, action: null, actionDate: null, changedAt: now },
      { title: `${PREFIX}Perdido`, stage: 'Perdido', value: 500_000, probability: 0, action: null, actionDate: null, changedAt: now },
    ].map((item) => ({ ...item, id: crypto.randomUUID() }));
    await database.batch([
      { sql: `insert into clientes (id, nome, email, telefone, situacao, created_at, updated_at) values (?, ?, ?, ?, 'Ativo', ?, ?)`, args: [clientId, `${PREFIX}Cliente Sintético`, 'cliente.s03@example.invalid', '48988887777', now, now] },
      { sql: `insert into orcamentos (id, grupo_id, cliente_id, valor_total, status, codigo_orcamento, descricao, created_at, updated_at) values (?, ?, ?, ?, 'enviado', ?, ?, ?, ?)`, args: [budgetId, budgetId, clientId, 700_000, 'QA-S03-001', `${PREFIX}Orçamento`, now, now] },
      ...opportunities.map((item, index) => ({ sql: `insert into oportunidades (id, cliente_id, titulo, valor_estimado, estagio, ordem, responsavel, origem, servico_tipo, proxima_acao, proxima_acao_em, previsao_fechamento, probabilidade_pontos_base, observacoes, motivo_perda, encerrado_em, estagio_alterado_em, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [item.id, clientId, item.title, item.value, item.stage, index, index % 2 ? 'Maria QA' : 'Thalles QA', index % 2 ? 'Site' : 'Indicação', index % 2 ? 'Topografia' : 'Georreferenciamento rural', item.action, item.actionDate, dateKey(20 + index), item.probability, `${PREFIX}Observação longa ${'á'.repeat(120)}`, item.stage === 'Perdido' ? 'Preço' : null, ['Ganho', 'Perdido'].includes(item.stage) ? now : null, item.changedAt, now, now] })),
      ...opportunities.map((item) => ({ sql: `insert into oportunidade_estagios_historico (id, oportunidade_id, estagio_anterior, estagio_novo, motivo, usuario_id, created_at) values (?, ?, null, ?, 'Carga QA isolada', 'admin', ?)`, args: [crypto.randomUUID(), item.id, item.stage, item.changedAt] })),
    ], 'write');
  } finally {
    database.close();
  }
}

test.describe('Sessão 03 — Comercial — CRM e Funil', () => {
  test.use({ actionTimeout: 12_000 });
  test.setTimeout(300_000);

  test('estados vazios, navegação, leads, validações, URL, conversão e persistência', async ({ page }) => {
    await fs.mkdir(evidenceRoot, { recursive: true });
    const consoleErrors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    let auth = await unlock(page, '/crm?view=leads');
    await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
    await expect(page.getByText('Nenhum lead encontrado.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'CRM e Funil' })).toHaveAttribute('aria-current', 'page');
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '01-leads-vazio.png'), fullPage: true });

    await page.getByRole('link', { name: 'Funil de vendas' }).click();
    await expect(page).toHaveURL(/view=funil/);
    for (const stage of ['Prospectado', 'Contato', 'Proposta', 'Ganho', 'Perdido']) {
      await expect(page.getByRole('heading', { name: stage })).toBeVisible();
    }
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '02-funil-vazio.png'), fullPage: true });

    await page.getByRole('link', { name: 'Indicadores' }).click();
    await expect(page.getByText('Comece pelo primeiro lead')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '03-indicadores-vazio.png'), fullPage: true });

    auth = await unlock(page, '/crm?view=invalida');
    await expect(page.getByRole('button', { name: 'Nova oportunidade' })).toBeVisible();
    auth = await unlock(page, '/contatos');
    await expect(page).toHaveURL(/\/crm\?view=leads/);

    await page.getByRole('button', { name: 'Novo lead' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Novo lead' });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Nome Completo / Referência *')).toBeFocused();
    await page.getByLabel('Nome Completo / Referência *').fill(`${PREFIX}Rascunho`);
    page.once('dialog', async confirmation => {
      expect(confirmation.message()).toContain('Descartar as alterações não salvas');
      await confirmation.dismiss();
    });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeVisible();
    page.once('dialog', confirmation => confirmation.accept());
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Novo lead' }).first().click();
    await dialog.getByRole('button', { name: 'Salvar lead' }).click();
    await expect(page.getByLabel('Nome Completo / Referência *')).toBeFocused();
    await expect(page.getByText('Informe o nome ou referência do contato.')).toBeVisible();
    await page.getByLabel('Nome Completo / Referência *').fill(`  ${PREFIX}Lead Interface  `);
    await page.getByLabel('Telefone / Celular (com DDD)').fill('123');
    await page.getByLabel('E-mail').fill('email-invalido');
    await dialog.getByRole('button', { name: 'Salvar lead' }).click();
    await expect(page.getByText('Informe um telefone com DDD e 10 ou 11 dígitos.')).toBeVisible();
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();

    await page.getByLabel('Telefone / Celular (com DDD)').fill('(48) 99999-1001');
    await page.getByLabel('E-mail').fill('s03.interface@example.invalid');
    await page.getByLabel('Empresa / Organização').fill('  Empresa Açores  ');
    await page.getByLabel('Cidade / Região').fill('  Florianópolis  ');
    await dialog.getByRole('button', { name: 'Outro' }).click();
    await page.getByLabel('Origem personalizada').fill('Evento técnico');
    await page.getByLabel('Anotações Rápidas / Interesse').fill('<script>alert("xss")</script> Interesse válido com acentuação.');
    await dialog.getByRole('button', { name: 'Salvar lead' }).click();
    await expect(page.getByText(`${PREFIX}Lead Interface`, { exact: true })).toBeVisible();

    const createdResponse = await page.request.get(`${auth.origin}/api/contatos?page=1&pageSize=12&q=${encodeURIComponent(`${PREFIX}Lead Interface`)}`, { headers: auth.headers });
    expect(createdResponse.status()).toBe(200);
    const createdPayload = await createdResponse.json() as { items: Array<{ id: string; nome: string; email: string; telefone: string; empresa: string }> };
    expect(createdPayload.items).toHaveLength(1);
    expect(createdPayload.items[0]).toMatchObject({ nome: `${PREFIX}Lead Interface`, email: 's03.interface@example.invalid', telefone: '48999991001', empresa: 'Empresa Açores' });
    const interfaceLeadId = createdPayload.items[0].id;

    const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
    if (!e2eRoot) throw new Error('GEOGESTOR_E2E_ROOT ausente.');
    const database = createClient({ url: `file:${path.join(e2eRoot, 'geogestor.db')}` });
    const clientId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const matchingLeadId = crypto.randomUUID();
    const noOpportunityLeadId = crypto.randomUUID();
    const now = relativeInstant();
    const stale = relativeInstant(-16);
    const opportunities = [
      { id: crypto.randomUUID(), title: `${PREFIX}Prospectado Atrasado`, stage: 'Prospectado', value: 100_000, probability: 1_000, action: 'Retomar contato', actionDate: dateKey(-1), changedAt: stale },
      { id: crypto.randomUUID(), title: `${PREFIX}Contato Hoje`, stage: 'Contato', value: 200_000, probability: 3_000, action: 'Reunião técnica', actionDate: dateKey(0), changedAt: now },
      { id: crypto.randomUUID(), title: `${PREFIX}Proposta Futura`, stage: 'Proposta', value: 300_000, probability: 6_500, action: 'Enviar revisão', actionDate: dateKey(1), changedAt: now },
      { id: crypto.randomUUID(), title: `${PREFIX}Ganho`, stage: 'Ganho', value: 400_000, probability: 10_000, action: null, actionDate: null, changedAt: now },
      { id: crypto.randomUUID(), title: `${PREFIX}Perdido`, stage: 'Perdido', value: 500_000, probability: 0, action: null, actionDate: null, changedAt: now },
    ];
    try {
      await database.batch([
        { sql: `insert into clientes (id, nome, email, telefone, situacao, created_at, updated_at) values (?, ?, ?, ?, 'Ativo', ?, ?)`, args: [clientId, `${PREFIX}Cliente Sintético`, 'cliente.s03@example.invalid', '48988887777', now, now] },
        { sql: `insert into orcamentos (id, grupo_id, cliente_id, valor_total, status, codigo_orcamento, descricao, created_at, updated_at) values (?, ?, ?, ?, 'enviado', ?, ?, ?, ?)`, args: [budgetId, budgetId, clientId, 700_000, 'QA-S03-001', `${PREFIX}Orçamento`, now, now] },
        { sql: `insert into contatos (id, nome, email, telefone, status, created_at, updated_at) values (?, ?, ?, ?, 'ativo', ?, ?)`, args: [matchingLeadId, `${PREFIX}Lead Correspondente`, 'CLIENTE.S03@example.invalid', '48988887777', now, now] },
        { sql: `insert into contatos (id, nome, status, created_at, updated_at) values (?, ?, 'ativo', ?, ?)`, args: [noOpportunityLeadId, `${PREFIX}Lead Sem Oportunidade`, now, now] },
        ...Array.from({ length: 12 }, (_, index) => ({ sql: `insert into contatos (id, nome, status, created_at, updated_at) values (?, ?, 'ativo', ?, ?)`, args: [crypto.randomUUID(), `${PREFIX}Lead Paginação ${String(index).padStart(2, '0')}`, now, now] })),
        ...opportunities.map((item, index) => ({ sql: `insert into oportunidades (id, cliente_id, titulo, valor_estimado, estagio, ordem, responsavel, origem, servico_tipo, proxima_acao, proxima_acao_em, previsao_fechamento, probabilidade_pontos_base, observacoes, motivo_perda, encerrado_em, estagio_alterado_em, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [item.id, clientId, item.title, item.value, item.stage, index, index % 2 ? 'Maria QA' : 'Thalles QA', index % 2 ? 'Site' : 'Indicação', index % 2 ? 'Topografia' : 'Georreferenciamento rural', item.action, item.actionDate, dateKey(20 + index), item.probability, `${PREFIX}Observação longa ${'á'.repeat(120)}`, item.stage === 'Perdido' ? 'Preço' : null, ['Ganho', 'Perdido'].includes(item.stage) ? now : null, item.changedAt, now, now] })),
        ...opportunities.map(item => ({ sql: `insert into oportunidade_estagios_historico (id, oportunidade_id, estagio_anterior, estagio_novo, motivo, usuario_id, created_at) values (?, ?, null, ?, 'Carga QA isolada', 'admin', ?)`, args: [crypto.randomUUID(), item.id, item.stage, item.changedAt] })),
      ], 'write');
    } finally {
      database.close();
    }

    await page.reload();
    auth = await unlockCurrent(page);
    await expect(page.getByText(/Página 1 de 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.reload();
    auth = await unlockCurrent(page);
    await expect(page.getByText(/Página 2 de 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Anterior' }).click();
    const leadSearch = page.getByLabel('Buscar leads');
    await leadSearch.fill('Lead Correspondente');
    await page.getByRole('button', { name: 'Leads Ativos' }).click();
    await expect(page).toHaveURL(/status=ativo/);
    await expect(page.getByText(`${PREFIX}Lead Correspondente`, { exact: true })).toBeVisible();
    await page.reload();
    auth = await unlockCurrent(page);
    await expect(leadSearch).toHaveValue('Lead Correspondente');
    page.once('dialog', confirmation => confirmation.accept());
    await page.getByRole('button', { name: 'Converter lead' }).click();
    await expect(page.getByText('Lead convertido em cliente e oportunidade comercial.')).toBeVisible();
    const matchingConversion = await page.request.post(`${auth.origin}/api/contatos/${matchingLeadId}/converter`, { headers: auth.headers });
    expect(matchingConversion.status()).toBe(200);
    expect((await matchingConversion.json() as { idempotent: boolean; clientCreated: boolean }).idempotent).toBe(true);
    expect((await page.request.get(`${auth.origin}/api/clientes?mode=page&q=${encodeURIComponent(`${PREFIX}Cliente Sintético`)}`, { headers: auth.headers })).status()).toBe(200);

    await page.screenshot({ path: path.join(evidenceRoot, '04-leads-populado-convertido.png'), fullPage: true });
    expect(consoleErrors).toEqual([]);
    expect(interfaceLeadId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('funil, filtros, histórico, transições, indicadores, erro recuperável e responsividade', async ({ page }) => {
    await ensureFunilFixture();
    const consoleErrors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const auth = await unlock(page, '/crm?view=funil');
    await expect(page.getByText(`${PREFIX}Prospectado Atrasado`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${PREFIX}Ganho`, { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, '05-funil-completo.png'), fullPage: true });
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Nova oportunidade' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Nova oportunidade' });
    await createDialog.getByLabel('Cliente ou lead').fill(`Cliente · ${PREFIX}Cliente Sintético`);
    await createDialog.getByLabel('Título do negócio').fill(`${PREFIX}Oportunidade Interface`);
    await createDialog.getByLabel('Serviço de interesse').fill('Levantamento planialtimétrico');
    await createDialog.getByLabel('Responsável comercial').fill('Thalles QA');
    await createDialog.getByLabel('Origem').fill('Evento técnico');
    await createDialog.getByLabel('Valor estimado').fill('6.000,00');
    await createDialog.getByLabel('Probabilidade de ganho').fill('40');
    await selectDate(page, createDialog.getByLabel('Previsão de fechamento'), 30);
    await createDialog.getByRole('textbox', { name: 'Próxima ação', exact: true }).fill('Enviar proposta técnica');
    await selectDate(page, createDialog.getByLabel('Data da próxima ação'), 2);
    await createDialog.getByLabel('Observações').fill('<img src=x onerror=alert(1)> Conteúdo comercial válido com acentuação.');
    await createDialog.getByRole('button', { name: 'Salvar oportunidade' }).click();
    await expect(page.getByText(`${PREFIX}Oportunidade Interface`, { exact: true })).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Buscar oportunidades' });
    await search.fill('Proposta Futura');
    await expect(page.getByText(`${PREFIX}Proposta Futura`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${PREFIX}Contato Hoje`, { exact: true })).toBeHidden();
    await expect(page).toHaveURL(/q=Proposta(?:\+|%20)Futura/);
    await page.getByRole('button', { name: 'Filtros' }).click();
    await selectCombobox(page, page.getByLabel('Filtrar por responsável'), 'Thalles QA');
    await selectCombobox(page, page.getByLabel('Filtrar oportunidades que exigem atenção'), 'Paradas há mais de 14 dias');
    await expect(page.getByLabel('Filtros ativos do funil')).toContainText('Oportunidades paradas');
    await page.getByRole('button', { name: /Oportunidades paradas/ }).click();
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(search).toHaveValue('');

    await page.getByRole('button', { name: `Ver histórico de ${PREFIX}Prospectado Atrasado` }).click();
    const historyDialog = page.getByRole('dialog', { name: 'Histórico da oportunidade' });
    await expect(historyDialog.getByText('Oportunidade criada em Prospectado')).toBeVisible();
    await expect(historyDialog).toHaveCSS('opacity', '1');
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '06-historico-oportunidade.png'), fullPage: true });
    await historyDialog.getByRole('button', { name: 'Fechar', exact: true }).click();

    await page.getByRole('button', { name: `Mover ${PREFIX}Prospectado Atrasado para a próxima etapa` }).click();
    const contactStage = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Contato', exact: true }) });
    await expect(contactStage).toContainText(`${PREFIX}Prospectado Atrasado`);
    await page.getByRole('button', { name: `Marcar ${PREFIX}Contato Hoje como perdido` }).click();
    const lossDialog = page.getByRole('dialog', { name: 'Registrar oportunidade perdida' });
    await lossDialog.getByRole('button', { name: 'Registrar perda' }).click();
    await expect(page.getByText('Informe o motivo da perda.')).toBeVisible();
    await page.getByLabel('Motivo da perda').fill('Cliente adiou o investimento');
    await lossDialog.getByRole('button', { name: 'Registrar perda' }).click();
    await expect(page.getByRole('button', { name: `Reabrir ${PREFIX}Contato Hoje em Proposta` })).toBeVisible();
    await page.getByRole('button', { name: `Reabrir ${PREFIX}Contato Hoje em Proposta` }).click();
    await expect(page.getByRole('button', { name: `Marcar ${PREFIX}Contato Hoje como ganho` })).toBeVisible();

    await page.getByRole('button', { name: `Editar ${PREFIX}Proposta Futura` }).click();
    const editDialog = page.getByRole('dialog', { name: 'Editar oportunidade' });
    await page.getByLabel('Valor estimado').fill('7.000,00');
    await page.getByLabel('Probabilidade de ganho').fill('70');
    await page.getByLabel('Orçamento relacionado').click();
    await page.getByRole('option', { name: /QA-S03-001/ }).click();
    await editDialog.getByRole('button', { name: 'Salvar oportunidade' }).click();
    await expect(page.getByText('Oportunidade atualizada.')).toBeVisible();
    const budgetLink = page.getByRole('link', { name: 'QA-S03-001' });
    await budgetLink.click();
    await expect(page).toHaveURL(/\/orcamentos\?budgetId=/);
    await page.goBack();
    await expect(page).toHaveURL(/\/crm\?view=funil/);

    await page.getByRole('button', { name: 'Criar projeto' }).click();
    await expect(page).toHaveURL(/\/projetos\/[0-9a-f-]{36}$/);
    const opportunityResponse = await page.request.get(`${auth.origin}/api/oportunidades`, { headers: auth.headers });
    const opportunityPayload = await opportunityResponse.json() as Array<{ id: string; titulo: string }>;
    const wonOpportunity = opportunityPayload.find(item => item.titulo === `${PREFIX}Ganho`);
    expect(wonOpportunity).toBeTruthy();
    const repeatedProjectConversion = await page.request.post(`${auth.origin}/api/oportunidades/${wonOpportunity!.id}/convert-project`, { headers: auth.headers, data: { nomeProjeto: `${PREFIX}Ganho` } });
    expect(repeatedProjectConversion.status()).toBe(200);
    expect((await repeatedProjectConversion.json() as { idempotent: boolean }).idempotent).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(/\/crm\?view=funil/);
    await expect(page.getByRole('link', { name: 'Projeto', exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Excluir ${PREFIX}Oportunidade Interface` }).click();
    const deleteDialog = page.getByRole('alertdialog', { name: 'Excluir oportunidade' });
    await deleteDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(`${PREFIX}Oportunidade Interface`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Excluir ${PREFIX}Oportunidade Interface` }).click();
    await deleteDialog.getByRole('button', { name: 'Excluir oportunidade' }).click();
    await expect(page.getByText(`${PREFIX}Oportunidade Interface`, { exact: true })).toBeHidden();
    await page.screenshot({ path: path.join(evidenceRoot, '07-funil-apos-transicoes-exclusao.png'), fullPage: true });

    await page.getByRole('link', { name: 'Indicadores' }).click();
    await expect(page.getByText('Leads ativos')).toBeVisible();
    await expect(page.getByText('Pipeline em aberto')).toBeVisible();
    await page.getByRole('button', { name: 'Ver todos os indicadores' }).click();
    await expect(page.getByText('Oportunidades ganhas')).toBeVisible();
    await expect(page.getByRole('row', { name: /Proposta/ })).toBeVisible();
    const analytics = await page.request.get(`${auth.origin}/api/oportunidades/analytics`, { headers: auth.headers });
    expect(analytics.status()).toBe(200);
    const metrics = await analytics.json() as { openPipelineCents: number; weightedPipelineCents: number; counts: Record<string, number> };
    expect(metrics.openPipelineCents).toBe(1_000_000);
    expect(metrics.weightedPipelineCents).toBe(615_000);
    expect(metrics.counts.Perdido).toBe(1);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '08-indicadores-populado.png'), fullPage: true });

    await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: path.join(evidenceRoot, '09-indicadores-escuro.png'), fullPage: true });

    for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 900 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await unlock(page, '/crm?view=funil');
      await expect(page.getByRole('heading', { name: 'Prospectado', exact: true })).toBeVisible();
      await expectNoHorizontalPageOverflow(page);
    }
    await page.screenshot({ path: path.join(evidenceRoot, '10-funil-1440px-escuro.png'), fullPage: true });

    await page.route('**/api/oportunidades', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha controlada S03' }) }));
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByText('Falha controlada S03')).toBeVisible();
    await page.unroute('**/api/oportunidades');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByText(`${PREFIX}Proposta Futura`, { exact: true })).toBeVisible();
    expect(consoleErrors.filter(message => !message.includes('500'))).toEqual([]);
  });
});
