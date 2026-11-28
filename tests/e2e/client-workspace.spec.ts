import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-12-central-cliente/evidencias-implementacao');
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
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao,email,celular,categoria,municipio,uf,anotacoes) values (?,?,'PF','Ativo','cliente@example.invalid','(48) 99999-0000','Produtor Rural','Florianópolis','SC',?)", args: [client, 'EXEMPLO FICTÍCIO — Cliente da central de acompanhamento ' + client.slice(0,4), 'Preferência fictícia: receber um registro resumido das atividades.'] },
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
  await page.goto(`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}/clientes/${client}${tab === 'visao-geral' ? '' : '?tab=' + tab}`);
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

test.describe('Central do cliente — implementação', () => {
  test.use({ actionTimeout: 10000 });
  test.setTimeout(240000);
  async function uploadApi(page: Page, client: string) {
    const response = await page.request.post(apiOrigin + '/api/arquivos/upload/stream', { headers: { 'x-local-session': tokens.get(page) || '' }, multipart: { clienteId: client, category: 'Outros', file: { name: 'EXEMPLO-FICTICIO-documento.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGo0AAAAASUVORK5CYII=', 'base64') } } });
    expect(response.ok()).toBe(true);
  }

  test('entrada direta mantém resumo e contadores; orçamento, licença e mais de cem imóveis', async ({ page }) => {
    await fs.mkdir(evidence, { recursive: true }); const fixture = await seed();
    await open(page, fixture.client); await uploadApi(page, fixture.client);
    for (const tab of tabs) {
      await open(page, fixture.client, tab);
      const summary = page.locator('[aria-labelledby="client-summary-title"]');
      await expect(summary.getByText('42,50 ha', { exact: true })).toBeVisible();
      await expect(summary.getByText('R$ 5.000,00', { exact: true })).toBeVisible();
      await expect(page.locator('#cliente-tab-propriedades')).toHaveText(/Propriedades1/);
      await expect(page.locator('#cliente-tab-servicos')).toHaveText(/Serviços2/);
      await expect(page.locator('#cliente-tab-orcamentos')).toHaveText(/Orçamentos2/);
      if (tab === 'financeiro') { await expect(page.locator('#cliente-panel-financeiro').getByText('R$ 3.000,00', { exact: true }).first()).toBeVisible(); await expect(page.getByText('A vencer: R$ 0,00 · Vencido: R$ 3.000,00')).toBeVisible(); }
      if (tab === 'ambiental') await expect(page.getByRole('link', { name: 'Consultar licença', exact: true })).toHaveAttribute('href', /\/ambiental\/licencas\//);
    }
    await open(page, fixture.client, 'orcamentos');
    const budget = page.locator('#cliente-panel-orcamentos').locator('div').filter({ has: page.getByRole('heading', { name: 'ORC-FICTÍCIO-001', exact: true }) }).filter({ has: page.getByRole('button', { name: 'Abrir orçamento', exact: true }) }).last();
    await budget.getByRole('button', { name: 'Abrir orçamento', exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/orcamentos/${fixture.budget}/editar`));
    await open(page, fixture.client, 'orcamentos'); await page.getByRole('button', { name: 'Novo orçamento', exact: true }).click(); await expect(page).toHaveURL(/\/orcamentos\/novo\?clienteId=/);
    await open(page, fixture.client, 'propriedades'); await page.getByRole('button', { name: 'Propriedade', exact: true }).click(); await expect(page).toHaveURL(/\/propriedades/); await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /Cancelar|Fechar modal/ }).first().click();
    const db = createClient({ url: `file:${path.join(fixture.root, 'geogestor.db')}` });
    try { await db.batch(Array.from({ length: 104 }, (_, index) => ({ sql: "insert into propriedades (id,cliente_id,nome,area_ha) values (?,?,?,1)", args: [id(), fixture.client, `EXEMPLO FICTÍCIO — Imóvel ${String(index).padStart(3,'0')}`] })), 'write'); } finally { db.close(); }
    await open(page, fixture.client, 'propriedades'); await expect(page.locator('#cliente-tab-propriedades')).toHaveText(/Propriedades105/); await expect(page.locator('#cliente-panel-propriedades article')).toHaveCount(24); await expect(page.getByText('146,50 ha', { exact: true })).toBeVisible();
    const allProperties=new Set<string>();for(let pageNumber=1;pageNumber<=5;pageNumber++){for(const propertyId of await page.locator('#cliente-panel-propriedades [data-client-record-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-client-record-id')!)))allProperties.add(propertyId);if(pageNumber<5)await page.locator('#cliente-panel-propriedades').getByRole('button',{name:'Próxima',exact:true}).click();}expect(allProperties.size).toBe(105);
  });

  test('jornada permite consultar todos os eventos em cada cardinalidade e filtrar sem negar o histórico', async ({ page }) => {
    const fixture = await seed();
    for (const count of [0,1,2,3,12,13]) {
      const db = createClient({ url: `file:${path.join(fixture.root, 'geogestor.db')}` });
      try {
        await db.execute({ sql: 'delete from interacoes_cliente where cliente_id=?', args: [fixture.empty] });
        if (count) await db.batch(Array.from({ length: count }, (_, index) => ({ sql: "insert into interacoes_cliente (id,cliente_id,tipo,titulo,descricao,data,manual) values (?,?,'Observação',?,?,'2026-10-01',1)", args: [id(), fixture.empty, `Evento fictício ${index + 1}`, `Descrição fictícia ${index + 1}`] })), 'write');
      } finally { db.close(); }
      await open(page, fixture.empty);
      const panel=page.locator('#cliente-panel-visao-geral');
      if (!count) await expect(panel.getByText('Nenhum evento registrado para este cliente.', { exact: true })).toBeVisible();
      else await expect(panel.getByRole('heading', { name: /^Evento fictício \d+$/ })).toHaveCount(Math.min(count,4));
      if (count>4) { await panel.getByRole('button', { name: 'Ver histórico completo', exact: true }).click(); await expect(panel.getByRole('heading', { name: /^Evento fictício \d+$/ })).toHaveCount(count); await panel.getByRole('button', { name: 'Mostrar somente recentes', exact: true }).click(); }
      await panel.getByRole('button', { name: 'Agenda', exact: true }).click(); await expect(panel.getByText('Nenhum evento de Agenda neste filtro.', { exact: true })).toBeVisible(); await panel.getByRole('button', { name: 'Mostrar todos os eventos', exact: true }).click();
    }
  });

  test('saldo com parcelas vencidas, a vencer e recebidas parcialmente; rascunho preservado em falha de tarefa', async ({page})=>{
    const fixture=await seed();const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});
    try {
      const row=await db.execute({sql:'select id from parcelas where orcamento_id=?',args:[fixture.budget]});const parcel=String(row.rows[0].id);const other=id();
      const future=new Date();future.setUTCDate(future.getUTCDate()+7);const futureDay=future.toISOString().slice(0,10);
      await db.batch([
        {sql:'update parcelas set valor=300000,valor_pago=100000 where id=?',args:[parcel]},
        {sql:'update recebimentos set valor_principal=100000,valor_recebido=100000 where parcela_id=?',args:[parcel]},
        {sql:"insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,200000,100000,?,'Pendente')",args:[other,fixture.budget,futureDay]},
        {sql:"insert into recebimentos (id,parcela_id,valor_principal,valor_recebido,data_recebimento) values (?,?,100000,100000,'2026-09-15')",args:[id(),other]}
      ],'write');
    } finally {db.close();}
    await open(page,fixture.client,'financeiro');await expect(page.getByText('A vencer: R$ 1.000,00 · Vencido: R$ 2.000,00',{exact:true})).toBeVisible();
    await open(page,fixture.client);await page.getByRole('button',{name:'Nova tarefa',exact:true}).click();await page.getByLabel('Título da tarefa',{exact:true}).fill('EXEMPLO FICTÍCIO — Tarefa preservada');
    await page.route('**/api/tarefas',route=>route.request().method()==='POST'?route.fulfill({status:500,contentType:'application/json',body:'{"error":"Falha fictícia"}'}):route.continue());
    await page.getByRole('button',{name:'Salvar tarefa',exact:true}).click();await expect(page.getByLabel('Título da tarefa',{exact:true})).toHaveValue('EXEMPLO FICTÍCIO — Tarefa preservada');await expect(page.getByRole('button',{name:'Salvar tarefa',exact:true})).toBeEnabled();
    await page.unroute('**/api/tarefas');await page.getByRole('button',{name:'Salvar tarefa',exact:true}).click();await expect(page.getByText('EXEMPLO FICTÍCIO — Tarefa preservada',{exact:true})).toBeVisible();
  });

  test('anexar por teclado, prévia com foco, download íntegro e recuperação de falhas', async ({ page }) => {
    const fixture=await seed(); await open(page,fixture.client,'arquivos');
    const uploadFile=path.join(fixture.root,'EXEMPLO-FICTICIO-upload.png'); const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGo0AAAAASUVORK5CYII=','base64'); await fs.writeFile(uploadFile,bytes);
    const attach=page.getByRole('button',{name:/Anexar novo arquivo ao cliente/}); await attach.focus(); const choose=page.waitForEvent('filechooser'); await attach.press('Enter'); await (await choose).setFiles(uploadFile);
    await expect(page.getByText('EXEMPLO-FICTICIO-upload.png',{exact:true})).toBeVisible();
    const preview=page.getByRole('button',{name:'Visualizar arquivo EXEMPLO-FICTICIO-upload.png',exact:true}); await preview.click();
    const dialog=page.getByRole('dialog',{name:'EXEMPLO-FICTICIO-upload.png',exact:true}); await expect(dialog).toBeVisible(); await expect(dialog.locator('#client-preview-open')).toBeFocused();
    await expect.poll(()=>dialog.locator('img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
    await dialog.getByRole('button',{name:'Fechar modal',exact:true}).focus(); await page.keyboard.press('Shift+Tab'); await expect(dialog.locator('#client-preview-open')).toBeFocused(); await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(preview).toBeFocused();
    const downloading=page.waitForEvent('download'); await page.getByRole('button',{name:'Baixar arquivo EXEMPLO-FICTICIO-upload.png',exact:true}).click(); const download=await downloading; expect(await fs.readFile((await download.path())!)).toEqual(bytes);
    const cases=[{tab:'propriedades',pattern:'**/api/dados-operacionais/propriedades?**',label:'as propriedades'},{tab:'servicos',pattern:'**/api/projetos?**',label:'os serviços e demandas'},{tab:'arquivos',pattern:'**/api/arquivos/cliente/**',label:'os arquivos'},{tab:'financeiro',pattern:'**/api/clientes/*/dashboard',label:'os dados do cliente'}];
    for(const scenario of cases){
      let failed=true; await page.route(scenario.pattern,route=>failed?route.fulfill({status:500,contentType:'application/json',body:'{"error":"Falha fictícia"}'}):route.continue());
      await page.goto(`/clientes/${fixture.client}?tab=${scenario.tab}`); await expect(page.getByRole('heading',{name:'Desbloquear GeoGestor'})).toBeVisible(); await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026'); await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
      const target=scenario.tab==='financeiro'?page.locator('#main-content'):page.locator('#cliente-panel-'+scenario.tab);
      await expect(target.getByText(`Não foi possível carregar ${scenario.label}. Seus registros não foram alterados.`,{exact:true})).toBeVisible();
      if(scenario.tab==='arquivos') await page.getByLabel('Buscar arquivos').fill('EXEMPLO');
      await capture(page,'erro-recuperavel-'+scenario.tab,false); failed=false; await target.getByRole('button',{name:'Tentar novamente',exact:true}).click(); await expect(page.locator('#cliente-panel-'+scenario.tab)).toBeVisible();
      if(scenario.tab==='arquivos') await expect(page.getByText('EXEMPLO-FICTICIO-upload.png',{exact:true})).toBeVisible();
      await page.unroute(scenario.pattern);
    }
  });

  test('inspeção visual conjunta: sete abas, temas, janelas pequenas e texto ampliado', async ({page})=>{
    await fs.mkdir(evidence,{recursive:true}); const fixture=await seed(); await open(page,fixture.client); await uploadApi(page,fixture.client);
    const findings=[];
    for(const scenario of [{theme:'light',width:1440,scale:100},{theme:'dark',width:1440,scale:100},{theme:'dark',width:360,scale:100},{theme:'light',width:768,scale:100},{theme:'dark',width:1440,scale:200}]){
      await page.setViewportSize({width:scenario.width,height:960});
      for(const tab of tabs){await open(page,fixture.client,tab); await page.evaluate(({theme,scale})=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.style.fontSize=`${scale}%`;},scenario);await expect(page.locator('[aria-labelledby="client-summary-title"]').getByText('42,50 ha',{exact:true})).toBeVisible();if(tab==='arquivos')await expect(page.getByText('EXEMPLO-FICTICIO-documento.png',{exact:true})).toBeVisible();findings.push(await capture(page,`final-${tab}-${scenario.width}-${scenario.theme}-${scenario.scale}`,scenario.scale===100));}
    }
    await page.setViewportSize({width:1440,height:960});for(const tab of tabs){await open(page,fixture.empty,tab);findings.push(await capture(page,'final-vazio-'+tab,false));}
    await fs.writeFile(path.join(evidence,'inspecao-conjunta.json'),JSON.stringify(findings,null,2));
  });

  test('alertas distinguem falha de consulta, imóvel e trabalho; recarga e abas preservam contexto', async ({page}) => {
    const fixture=await seed();
    let failed=true;
    await page.route('**/api/dados-operacionais/propriedades?**', route=>failed?route.fulfill({status:500,contentType:'application/json',body:'{"error":"Falha fictícia"}'}):route.continue());
    await page.route('**/api/arquivos/cliente/**', route=>failed?route.fulfill({status:500,contentType:'application/json',body:'{"error":"Falha fictícia"}'}):route.continue());
    await open(page,fixture.client,'servicos');
    await expect(page.locator('#cliente-tab-propriedades')).toHaveText(/Propriedades—/);
    await page.getByRole('button',{name:/^Alertas/}).click();
    const alerts=page.getByRole('dialog',{name:'Alertas do cliente',exact:true});
    await expect(alerts.getByText('Não foi possível carregar todos os dados dos alertas. Seus registros não foram alterados.',{exact:true})).toBeVisible();
    await expect(alerts.getByText('Cliente sem propriedade',{exact:true})).toHaveCount(0);
    await expect(alerts.getByText(/Nenhum documento encontrado/)).toHaveCount(0);
    await expect(alerts.getByText(/orçamento.*sem propriedade/)).toHaveCount(0);
    failed=false;await alerts.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(page.locator('[aria-labelledby="client-summary-title"]').getByText('42,50 ha',{exact:true})).toBeVisible();
    await expect(alerts.getByText('2 trabalho(s) sem coordenadas de localização registradas',{exact:true})).toBeVisible();
    await expect(alerts.getByRole('alert')).toHaveCount(0);
    await alerts.getByRole('button',{name:'Fechar alertas',exact:true}).click();
    for(const tab of tabs){await page.locator('#cliente-tab-'+tab).click();await expect(page.locator('#cliente-panel-'+tab)).toBeVisible();await expect(page.locator('[aria-labelledby="client-summary-title"]').getByText('42,50 ha',{exact:true})).toBeVisible();}
    await page.reload();await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
    await expect(page.locator('#cliente-panel-arquivos')).toBeVisible();await expect(page.locator('[aria-labelledby="client-summary-title"]').getByText('42,50 ha',{exact:true})).toBeVisible();
  });

  test('desktop preserva leitura e navegação com zoom real de 200%', async () => {
    const fixture=await seed();
    const requireRoot=createRequire(path.resolve('package.json'));
    let executablePath:string; try { executablePath=requireRoot('electron'); } catch { executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); }
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='ELECTRON_RUN_AS_NODE'));
    const desktop=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30000});
    try {
      const page=await desktop.firstWindow({timeout:30000});await open(page,fixture.client,'financeiro');
      const nativeWindow=await desktop.browserWindow(page);
      await nativeWindow.evaluate(window=>{window.webContents.setBackgroundThrottling(false);window.setContentSize(1000,800);});
      const captureNative=async(label:string)=>{const png=await nativeWindow.evaluate(async window=>(await window.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await fs.writeFile(path.join(evidence,label+'.png'),Buffer.from(png,'base64'));};
      await expect(page.locator('[aria-labelledby="client-summary-title"]').getByText('42,50 ha',{exact:true})).toBeVisible();
      await page.locator('#cliente-panel-financeiro').getByRole('heading',{name:'Financeiro do cliente',exact:true}).scrollIntoViewIfNeeded();
      await captureNative('desktop-zoom-100');
      await nativeWindow.evaluate(window=>window.webContents.setZoomFactor(2));
      expect(await nativeWindow.evaluate(window=>window.webContents.getZoomFactor())).toBe(2);
      await expect(page.locator('#cliente-panel-financeiro').getByText('R$ 3.000,00',{exact:true}).first()).toBeVisible();
      await page.locator('#cliente-panel-financeiro').getByText('R$ 3.000,00',{exact:true}).first().scrollIntoViewIfNeeded();
      await captureNative('desktop-zoom-200');
      await page.locator('#cliente-tab-financeiro').focus();await page.locator('#cliente-tab-financeiro').press('End');await expect(page.locator('#cliente-tab-arquivos')).toBeFocused();
      await fs.writeFile(path.join(evidence,'zoom-desktop.json'),JSON.stringify({zoomFactor:2,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),keyboard:'passed',isolated:true},null,2));
    } finally { await desktop.evaluate(({app})=>app.exit(0)).catch(()=>{});await desktop.close().catch(()=>{}); }
  });
});
