import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-12-central-cliente/evidencias');
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const tabs = ['visao-geral', 'propriedades', 'servicos', 'ambiental', 'orcamentos', 'financeiro', 'arquivos'];
const tokens = new WeakMap<Page, string>();
const id = () => crypto.randomUUID();

async function seed() {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !/^run-/.test(path.basename(root))) throw new Error('Banco isolado obrigatório');
  const db = createClient({ url: `file:${path.join(root, 'geogestor.db')}` });
  const client = id(), empty = id(), property = id(), project = id(), environmental = id(), budget = id(), parcel = id();
  try {
    await db.batch([
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao,email,celular,categoria,municipio,uf,anotacoes) values (?,?,'PF','Ativo','cliente@example.invalid','(48) 99999-0000','Produtor Rural','Florianópolis','SC',?)", args: [client, 'EXEMPLO FICTÍCIO — Cliente da central de acompanhamento', 'Preferência fictícia: receber um registro resumido das atividades.'] },
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [empty, 'EXEMPLO FICTÍCIO — Cliente sem registros'] },
      { sql: "insert into propriedades (id,cliente_id,nome,area_ha,matricula,car,municipio,uf,situacao_imovel) values (?,?,?,42.5,'MATRÍCULA-FICTÍCIA-001',?,'Florianópolis','SC','Em revisão documental')", args: [property, client, 'EXEMPLO FICTÍCIO — Fazenda das Araucárias com denominação extensa', 'PROTOCOLOFICTICIO'.repeat(10)] },
      { sql: "insert into projetos (id,cliente_id,propriedade_id,nome,tipo,status,data_inicio,data_entrega,descricao) values (?,?,?,?,'Topografia','Em Andamento','2026-09-01','2026-10-05',?)", args: [project, client, property, 'EXEMPLO FICTÍCIO — Levantamento planialtimétrico do imóvel rural', 'Levantamento fictício em preparação. Documentação recebida, próxima etapa a revisar com o cliente.'] },
      { sql: "insert into projetos (id,cliente_id,propriedade_id,nome,tipo,status,data_inicio,data_entrega,descricao) values (?,?,?,?,'Ambiental','Concluído','2026-09-02','2026-10-10',?)", args: [environmental, client, property, 'EXEMPLO FICTÍCIO — Acompanhamento do CAR com nome extenso', 'Acompanhamento documental fictício encerrado. Não representa aprovação do cadastro ambiental.'] },
      { sql: "insert into ambiental (id,projeto_id,cliente_id,propriedade_id,tipo_demanda,protocolo) values (?,?,?,?,'CAR','CAR-FICTÍCIO-001')", args: [id(), environmental, client, property] },
      { sql: "insert into licencas (id,projeto_id,cliente_id,numero,orgao,data_vencimento,status) values (?,?,?,'LICENÇA-FICTÍCIA-001','Órgão fictício','2026-10-05','Vencida')", args: [id(), project, client] },
      { sql: "insert into orcamentos (id,cliente_id,projeto_id,valor_total,status,codigo_orcamento,descricao,data_emissao,data_orcamento,created_at) values (?,?,?,500000,'aprovado','ORC-FICTÍCIO-001',?,'2026-09-10','2026-09-09','2026-09-01T12:00:00Z')", args: [budget, client, project, 'EXEMPLO FICTÍCIO — Escopo extenso para acompanhamento da execução e elaboração de produtos cartográficos.'] },
      { sql: "insert into orcamentos (id,cliente_id,valor_total,status,codigo_orcamento,descricao) values (?,?,150000,'rascunho','ORC-FICTÍCIO-002','EXEMPLO FICTÍCIO — Proposta ainda em elaboração')", args: [id(), client] },
      { sql: "insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,500000,200000,'2026-10-05','Pendente')", args: [parcel, budget] },
      { sql: "insert into recebimentos (id,parcela_id,valor_principal,valor_recebido,data_recebimento) values (?,?,200000,200000,'2026-09-15')", args: [id(), parcel] },
      { sql: "insert into despesas (id,cliente_id,projeto_id,descricao,valor,data,data_pagamento,categoria,status) values (?,?,?,'EXEMPLO FICTÍCIO — Deslocamento',50000,'2026-09-12','2026-09-12','Combustível','Pago')", args: [id(), client, project] },
      { sql: "insert into tarefas (id,cliente_id,projeto_id,titulo,status,prioridade,data_limite) values (?,?,?,'EXEMPLO FICTÍCIO — Conferir documentação','A Fazer','Alta','2026-10-05')", args: [id(), client, project] },
      { sql: "insert into compromissos (id,cliente_id,projeto_id,titulo,data,hora,tipo) values (?,?,?,'EXEMPLO FICTÍCIO — Revisão com cliente','2026-10-20','14:00','Reunião')", args: [id(), client, project] },
      { sql: "insert into interacoes_cliente (id,cliente_id,tipo,titulo,descricao,data,manual) values (?,?, 'Observação','EXEMPLO FICTÍCIO — Documentos recebidos','Documentos fictícios disponíveis; próxima análise a confirmar.','2026-10-01',1)", args: [id(), client] }
    ], 'write');
  } finally { db.close(); }
  return { client, empty, property, project, environmental, budget, root };
}

async function open(page: Page, client: string, tab = 'visao-geral') {
  page.on('request', request => { const token = request.headers()['x-local-session']; if (token) tokens.set(page, token); });
  await page.goto(`/clientes/${client}${tab === 'visao-geral' ? '' : '?tab=' + tab}`);
  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).or(page.locator('#cliente-tab-' + tab))).toBeVisible();
  if (await page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await expect(page.locator('#cliente-panel-' + tab)).toBeVisible();
}

async function capture(page: Page, label: string, runAxe = true) {
  const rootSelector = await page.locator('#main-content').count() ? '#main-content' : 'body';
  const measurements = await page.locator(rootSelector).evaluate(main => ({
    pageWidth: document.documentElement.clientWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
    hiddenNamedText: Array.from(main.querySelectorAll<HTMLElement>('[title]')).filter(el => el.textContent?.trim() && (el.getBoundingClientRect().width < 1 || el.getBoundingClientRect().height < 1)).map(el => ({ text: el.textContent, title: el.title, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
    headings: Array.from(main.querySelectorAll('h1,h2,h3')).map(el => ({ tag: el.tagName, text: el.textContent })),
    tabs: Array.from(main.querySelectorAll('[role=tab]')).map(el => ({ text: el.textContent, selected: el.getAttribute('aria-selected') })),
    shortTargets: Array.from(main.querySelectorAll<HTMLElement>('button,a,input,select,textarea')).filter(el => el.getClientRects().length).map(el => ({ label: el.getAttribute('aria-label') || el.textContent?.trim(), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })).filter(el => el.width < 44 || el.height < 44),
    text: main.innerText,
    links: Array.from(main.querySelectorAll('a')).map(el => ({ text: el.textContent, href: el.getAttribute('href') }))
  }));
  const axe = runAxe ? await new AxeBuilder({ page }).include('#main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze() : null;
  await page.screenshot({ path: path.join(evidence, label + '.png'), fullPage: true });
  const finding = { label, url: page.url(), rootSelector, ...measurements, violations: axe?.violations || [] };
  await fs.writeFile(path.join(evidence, label + '.json'), JSON.stringify(finding, null, 2));
  return finding;
}

test('auditoria das sete abas com dados fictícios, teclado, falhas e telas pequenas', async ({ page }) => {
  test.setTimeout(240000);
  await fs.mkdir(evidence, { recursive: true });
  const fixture = await seed();
  await fs.writeFile(path.join(evidence, 'fixture.json'), JSON.stringify({ ...fixture, explicitlyFictitious: true }, null, 2));
  await open(page, fixture.client);
  const upload = await page.request.post(apiOrigin + '/api/arquivos/upload/stream', { headers: { 'x-local-session': tokens.get(page) || '' }, multipart: { clienteId: fixture.client, category: 'Outros', file: { name: 'EXEMPLO-FICTICIO-documento.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGo0AAAAASUVORK5CYII=', 'base64') } } });
  expect(upload.ok()).toBe(true);
  const runs: unknown[] = [];
  const remaining = process.env.GEOGESTOR_CLIENT_AUDIT_STAGE === 'remaining';
  const failuresOnly = process.env.GEOGESTOR_CLIENT_AUDIT_STAGE === 'failures';
  for (const scenario of failuresOnly ? [] : remaining ? [{ theme: 'dark', width: 1440, scale: 200 }] : [{ theme: 'light', width: 1440, scale: 100 }, { theme: 'dark', width: 1440, scale: 100 }, { theme: 'dark', width: 360, scale: 100 }, { theme: 'light', width: 768, scale: 100 }, { theme: 'dark', width: 1440, scale: 200 }]) {
    await page.setViewportSize({ width: scenario.width, height: 960 });
    for (const tab of remaining ? ['arquivos'] : tabs) {
      await open(page, fixture.client, tab);
      await page.evaluate(({ theme, scale }) => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.fontSize = `${scale}%`; }, scenario);
      await expect(page.locator('#cliente-tab-' + tab)).toHaveAttribute('aria-selected', 'true');
      if (tab === 'arquivos') await expect(page.getByText('EXEMPLO-FICTICIO-documento.png', { exact: true })).toBeAttached(); // An audit records hidden/truncated text as a finding rather than aborting the remaining scenarios.
      if (tab === 'orcamentos') await expect(page.locator('#cliente-panel-orcamentos').getByText('ORC-FICTÍCIO-001', { exact: true })).toBeVisible();
      runs.push(await capture(page, `populado-${tab}-${scenario.width}-${scenario.theme}-${scenario.scale}`, scenario.scale === 100));
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  for (const tab of failuresOnly ? [] : tabs) { await open(page, fixture.empty, tab); await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.style.fontSize = '100%'; }); runs.push(await capture(page, `vazio-${tab}`, false)); }
  await open(page, fixture.client);
  await page.locator('#cliente-tab-visao-geral').focus();
  await page.locator('#cliente-tab-visao-geral').press('ArrowRight');
  await expect(page.locator('#cliente-tab-propriedades')).toBeFocused();
  await page.locator('#cliente-tab-propriedades').press('End');
  await expect(page.locator('#cliente-tab-arquivos')).toBeFocused();
  await page.locator('#cliente-tab-arquivos').press('Home');
  await expect(page.locator('#cliente-tab-visao-geral')).toBeFocused();
  await fs.writeFile(path.join(evidence, 'teclado.json'), JSON.stringify({ arrowRight: 'propriedades', end: 'arquivos', home: 'visao-geral', focusAssertions: 'passed', onlyTabNavigation: true }, null, 2));
  for (const failure of [{ tab: 'propriedades', match: '**/api/dados-operacionais/propriedades?**' }, { tab: 'servicos', match: '**/api/projetos?**' }, { tab: 'arquivos', match: '**/api/arquivos/cliente/**' }, { tab: 'financeiro', match: '**/api/clientes/*/dashboard' }]) {
    await page.route(failure.match, route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Falha fictícia de carregamento"}' }));
    await page.goto(`/clientes/${fixture.client}?tab=${failure.tab}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await page.waitForTimeout(8500); // Wait through the configured query retry schedule before recording the failure state.
    runs.push(await capture(page, 'falha-' + failure.tab, false));
    await page.unroute(failure.match);
  }
  await fs.writeFile(path.join(evidence, 'resultados.json'), JSON.stringify(runs, null, 2));
});
