import { protectedSourceBytes } from './support/isolated-session';
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(240000);
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve(process.env.GEOGESTOR_E2E_EVIDENCE_DIR!);
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const tabs = ['visao-geral', 'propriedades', 'servicos', 'ambiental', 'orcamentos', 'financeiro', 'arquivos'];
const tokens = new WeakMap<Page, string>();
const observedPages = new WeakSet<Page>();
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

async function open(page: Page, client: string, tab = 'visao-geral', extra = '') {
  if (!observedPages.has(page)) { observedPages.add(page); page.on('request', request => { const token = request.headers()['x-local-session']; if (token) tokens.set(page, token); }); }
  await page.goto(`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}/clientes/${client}${tab === 'visao-geral' ? '' : '?tab=' + tab}${extra ? (tab === 'visao-geral' ? '?' : '&') + extra : ''}`);
  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).or(page.locator('#cliente-tab-' + tab))).toBeVisible();
  if (await page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await expect(page.locator('#cliente-panel-' + tab)).toBeVisible();
}


async function protectedView(page:Page){return page.evaluate(()=>{
 const selectors=['#main-content h1','.client-contact-card','[aria-labelledby="client-summary-title"]','[aria-label^="Mapa das propriedades"]','[role=tablist]','aside','header'];
 return selectors.map(selector=>{const el=document.querySelector<HTMLElement>(selector);if(!el)return {selector,missing:true};const s=getComputedStyle(el),r=el.getBoundingClientRect();return {selector,className:el.className,width:r.width,font:s.fontSize,color:s.color,background:s.background,children:[...el.children].map(n=>({tag:n.tagName,classes:n.className}))};});
 });}
test('estrutura protegida antes e depois',async({page})=>{
 await page.addInitScript(port => { (window as any).electronAPI = { getApiPort: () => port }; }, Number(process.env.GEOGESTOR_E2E_API_PORT));
 const fixture=await seed();await open(page,fixture.client,'propriedades');await expect(page.locator('.client-contact-card')).toBeVisible();await page.waitForTimeout(800);
 await fs.mkdir(evidence,{recursive:true});const view=await protectedView(page);const baseline=path.resolve('tests/e2e/fixtures/ui-protected-2026-10-18.json');
 if(process.env.CLIENT_TABS_BASELINE==='1'){await fs.writeFile(baseline,JSON.stringify(view,null,2));await page.screenshot({path:path.join(evidence,'antes.png'),fullPage:true});}
 else{expect(view).toEqual(JSON.parse(await fs.readFile(baseline,'utf8')).view);await fs.writeFile(path.join(evidence,'estrutura-depois.json'),JSON.stringify(view,null,2));await page.screenshot({path:path.join(evidence,'depois.png'),fullPage:true});}
});

const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGo0AAAAASUVORK5CYII=','base64');
async function choose(page:Page,label:string,option:string){await page.getByLabel(label,{exact:true}).click();await page.getByRole('option',{name:option,exact:true}).click();}
async function filesFixture(page:Page,count=105){
 const fixture=await seed();await open(page,fixture.client,'arquivos');
 const response=await page.request.get(apiOrigin+'/api/arquivos/cliente/'+fixture.client+'?scope=all',{headers:{'x-local-session':tokens.get(page)||''}});expect(response.ok()).toBe(true);
 const folder=(await response.json()).path;expect(path.resolve(folder).startsWith(path.resolve(fixture.root)+path.sep)).toBe(true);
 await Promise.all(Array.from({length:count},(_,i)=>fs.writeFile(path.join(folder,`EXEMPLO-FICTÍCIO-${String(i).padStart(3,'0')}.png`),bytes)));
 await open(page,fixture.client,'arquivos');await expect(page.locator('#cliente-panel-arquivos [data-client-file-id]')).toHaveCount(Math.min(24,count));
 return fixture;
}
async function assertReadingStart(page:Page,panel:ReturnType<Page['locator']>){
 const start=panel.locator('.client-list-start');await expect(start).toBeFocused();
 const position=await start.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});expect(position.top).toBeGreaterThanOrEqual(90);expect(position.bottom).toBeLessThan(position.height);
}
test('paginação das quatro listas: mouse, teclado, posição de leitura e busca sem roubar foco',async({page})=>{
 const fixture=await seed();const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});
 try{await db.batch(Array.from({length:30},(_,i)=>[
  {sql:'insert into propriedades(id,cliente_id,nome,area_ha) values(?,?,?,1)',args:[id(),fixture.client,`EXEMPLO FICTÍCIO — imóvel ${i}`]},
  {sql:"insert into projetos(id,cliente_id,nome,tipo,status) values(?,?,?,'Ambiental','Em Andamento')",args:[id(),fixture.client,`EXEMPLO FICTÍCIO — serviço ${i}`]},
  {sql:"insert into orcamentos(id,cliente_id,codigo_orcamento,status,valor_total) values(?,?,?,'rascunho',100)",args:[id(),fixture.client,`ORC-FICTÍCIO-${i}`]}
 ]).flat(),'write');}finally{db.close();}
 for(const [tab,noun] of [['propriedades','propriedades'],['servicos','serviços'],['ambiental','demandas ambientais'],['orcamentos','orçamentos']]){
  await open(page,fixture.client,tab,'sentinela=preservada');const panel=page.locator('#cliente-panel-'+tab);
  await panel.getByRole('button',{name:'Próxima',exact:true}).click();await assertReadingStart(page,panel);await expect(panel.locator('.client-list-start')).toContainText('Página 2');expect(page.url()).toContain('sentinela=preservada');
  await panel.getByRole('button',{name:'Anterior',exact:true}).focus();await page.keyboard.press('Enter');await assertReadingStart(page,panel);await expect(panel.locator('.client-list-start')).toContainText('Página 1');
  await page.keyboard.press('Tab');const first=panel.locator('[data-client-record-id]').first();expect(await first.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  const search=page.getByLabel('Buscar '+noun,{exact:true});await search.fill('FICTICIO');await expect(search).toBeFocused();const y=await page.evaluate(()=>scrollY);await search.press('End');await search.press('Backspace');await expect(search).toBeFocused();expect(Math.abs((await page.evaluate(()=>scrollY))-y)).toBeLessThan(2);
 }
});
test('105 arquivos acessíveis, critérios preservados, ordenação ausente e vínculos diretos',async({page})=>{
 const fixture=await filesFixture(page);const panel=page.locator('#cliente-panel-arquivos');const seen=new Set<string>();
 await expect(panel.getByText('105 de 105 documentos',{exact:true})).toBeVisible();
 for(let n=1;n<=5;n++){
  await expect(panel.locator('.client-list-start')).toContainText(`Página ${n} de 5`);
  for(const value of await panel.locator('[data-client-file-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-client-file-id')!)))seen.add(value);
  if(n<5){const next=panel.getByRole('button',{name:'Próxima',exact:true});if(n%2){await next.click();}else{await next.focus();await next.press('Space');}await assertReadingStart(page,panel);}
 }
 await page.screenshot({path:path.join(evidence,'paginacao-arquivos.png')});expect(seen.size).toBe(105);const target=await panel.locator('[data-client-file-id]').last().getAttribute('data-client-file-id');
 const search=page.getByLabel('Buscar arquivos',{exact:true});await search.fill('FICTICIO-10');await expect(search).toBeFocused();await expect(panel.locator('[data-client-file-id]')).toHaveCount(5);await expect(panel.locator('.client-list-start')).toContainText('Mostrando 1–5 de 5');
 await choose(page,'Ordenar arquivos','Nome (Z–A)');await page.locator('#cliente-tab-servicos').click();await page.locator('#cliente-tab-arquivos').click();await expect(search).toHaveValue('FICTICIO-10');await expect(page.getByLabel('Ordenar arquivos',{exact:true})).toHaveText('Nome (Z–A)');
 await open(page,fixture.client,'arquivos','documentId='+target+'&arquivosPagina=1');await expect(panel.locator('.client-list-start')).toContainText('Página 5 de 5');await expect(panel.locator('[data-client-file-id="'+target+'"]')).toBeVisible();
 await panel.getByRole('button',{name:'Anterior',exact:true}).click();await page.locator('#cliente-tab-servicos').click();await page.locator('#cliente-tab-arquivos').click();await expect(panel.locator('.client-list-start')).toContainText('Página 4 de 5');
 await open(page,fixture.client,'arquivos','documentId='+target+'&arquivo=FICTICIO-000');await expect(search).toHaveValue('FICTICIO-000');await expect(panel.getByText(/oculto pelos critérios atuais/)).toBeVisible();await expect(panel.locator('[data-client-file-id]')).toHaveCount(1);
 await panel.getByRole('button',{name:'Mostrar documento e limpar filtros',exact:true}).click();await expect(panel.locator('.client-list-start')).toContainText('Página 5 de 5');await expect(panel.locator('[data-client-file-id="'+target+'"]')).toBeVisible();
 // Missing metadata is simulated in the response from the isolated local collection.
 await page.route('**/api/arquivos/cliente/*?scope=all',async route=>{const response=await route.fetch();const data=await response.json();data.files.forEach((file:any,i:number)=>{file.modifiedAt=i<2?null:`2026-01-${String(i%28+1).padStart(2,'0')}T12:00:00Z`;file.sizeBytes=i<2?null:i*100;});await route.fulfill({response,json:data});});
 await open(page,fixture.client,'arquivos','arquivosOrdem=tamanho-desc&arquivosPagina=5');await expect(panel.getByText(/Tamanho não informado/)).toHaveCount(2);await expect(panel.getByText(/Data de modificação não informada/)).toHaveCount(2);await expect(panel.getByText(/Invalid Date|NaN/)).toHaveCount(0);
 await choose(page,'Ordenar arquivos','Modificação mais recente');await expect(panel.locator('.client-list-start')).toContainText('Página 1');await expect(panel.getByText(/Data de modificação não informada/)).toHaveCount(0);
 await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'arquivos-105.json'),JSON.stringify({accessible:seen.size,criteriaPreserved:true,directLink:true,missingMetadata:true},null,2));
});
test('exclusão do único arquivo na última página ajusta URL e lista',async({page})=>{
 const fixture=await filesFixture(page,25);const panel=page.locator('#cliente-panel-arquivos');await panel.getByRole('button',{name:'Próxima',exact:true}).click();await expect(panel.locator('[data-client-file-id]')).toHaveCount(1);
 await panel.getByRole('button',{name:/^Excluir arquivo /}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Excluir arquivo',exact:true}).click();await expect(panel.locator('[data-client-file-id]')).toHaveCount(24);await expect(panel.locator('.client-list-start')).toContainText('Página 1 de 1');await expect(page).toHaveURL(/arquivosPagina=1/);
 expect(fixture.root).toBeTruthy();
});
test('aberturas locais: HTTP, recusa, comunicação, andamento e duplicações',async({page})=>{
 await filesFixture(page,2);const panel=page.locator('#cliente-panel-arquivos');await page.getByLabel('Buscar arquivos',{exact:true}).fill('FICTICIO');
 for(const endpoint of ['open-file','open-folder']){
  const button=endpoint==='open-file'?panel.getByRole('button',{name:/no aplicativo padrão$/}).first():panel.getByRole('button',{name:/^(Abrir no Windows|Solicitando abertura…)$/});
  for(const failure of ['http','recusa','comunicacao']){
   await page.route('**/api/arquivos/'+endpoint,async route=>{if(failure==='comunicacao')await route.abort('failed');else await route.fulfill({status:failure==='http'?500:200,contentType:'application/json',body:failure==='http'?'{}':'{"success":false}'});});
   await button.click();await expect(panel.getByRole('status').filter({hasText:'Não foi possível solicitar'})).toContainText('Tente novamente');if(failure==='http') await panel.screenshot({path:path.join(evidence,`falha-${endpoint}.png`)});await expect(button).toBeEnabled();await expect(page.getByLabel('Buscar arquivos',{exact:true})).toHaveValue('FICTICIO');await expect(panel.locator('[data-client-file-id]')).toHaveCount(2);await page.unroute('**/api/arquivos/'+endpoint);
  }
  let calls=0;let complete:()=>void=()=>{};const pending=new Promise<void>(resolve=>{complete=resolve;});
  await page.route('**/api/arquivos/'+endpoint,async route=>{calls++;await pending;await route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'});});
  await button.click();await expect(button).toBeDisabled();await expect(button).toHaveAttribute('aria-busy','true');await expect(panel.getByRole('status').filter({hasText:'Solicitando abertura'})).toBeVisible();await button.evaluate((el:HTMLButtonElement)=>{el.click();el.click();});await expect.poll(()=>calls).toBe(1);complete();await expect(button).toBeEnabled();await expect(panel.getByRole('status').filter({hasText:'Solicitação encaminhada'})).toBeVisible();await expect(panel.getByText(/aplicativo aberto|pasta aberta/i)).toHaveCount(0);await page.unroute('**/api/arquivos/'+endpoint);
 }
 await panel.screenshot({path:path.join(evidence,'abertura-local.png')});
});
test('sete abas renderizadas, claro, escuro e painel estreito',async({page})=>{
 const fixture=await filesFixture(page,25);const records=[];
 for(const scenario of [{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:360,theme:'dark'}]){
  await page.setViewportSize({width:scenario.width,height:960});
  for(const tab of tabs){await open(page,fixture.client,tab);await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),scenario.theme);const panel=page.locator('#cliente-panel-'+tab);await panel.scrollIntoViewIfNeeded();
   const axe=await new AxeBuilder({page}).include('#cliente-panel-'+tab).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   const measurement=await panel.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.width+1);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
   await page.screenshot({path:path.join(evidence,`aba-${tab}-${scenario.theme}-${scenario.width}.png`)});records.push({tab,...scenario,...measurement,axeViolations:axe.violations.length});
  }
 }
 await fs.writeFile(path.join(evidence,'matriz-renderizada.json'),JSON.stringify(records,null,2));
 const protectedFiles=Object.entries(JSON.parse(await fs.readFile('tests/e2e/fixtures/ui-protected-2026-10-18.json','utf8')).sources).map(([path,hash])=>({path,hash}));for(const item of protectedFiles){item.after=crypto.createHash('sha256').update(await protectedSourceBytes(item.path)).digest('hex');expect(item.after).toBe(item.hash);}await fs.writeFile(path.join(evidence,'fontes-protegidas.json'),JSON.stringify(protectedFiles,null,2));
});
test('zoom real desktop 200% com paginação por teclado nos sete painéis',async()=>{
 test.setTimeout(180000);const fixture=await seed();const requireRoot=createRequire(path.resolve('package.json'));let executablePath:string;try{executablePath=requireRoot('electron');}catch{executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');}
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='ELECTRON_RUN_AS_NODE'));const desktop=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30000});
 try{
  const page=await desktop.firstWindow();await filesFixture(page,25);const win=await desktop.browserWindow(page);await win.evaluate(window=>{window.webContents.setBackgroundThrottling(false);window.setContentSize(1000,800);window.webContents.setZoomFactor(2);});expect(await win.evaluate(window=>window.webContents.getZoomFactor())).toBe(2);
  for(const tab of tabs){await open(page,fixture.client,tab);const panel=page.locator('#cliente-panel-'+tab);await expect(panel).toBeVisible();const sizes=await panel.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+1);}
  const docs=await filesFixture(page,25);await open(page,docs.client,'arquivos');const panel=page.locator('#cliente-panel-arquivos');const next=panel.getByRole('button',{name:'Próxima',exact:true});await next.focus();await expect(next).toBeFocused();await next.press('Enter');await expect(panel.locator('.client-list-start')).toContainText('Página 2');await assertReadingStart(page,panel);await expect(panel.locator('[data-client-file-id]')).toHaveCount(1);
  const png=await win.evaluate(async window=>(await window.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await fs.writeFile(path.join(evidence,'desktop-zoom-real-200.png'),Buffer.from(png,'base64'));await fs.writeFile(path.join(evidence,'zoom-real.json'),JSON.stringify({factor:2,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),tabs:7,keyboard:true},null,2));
 }finally{await desktop.evaluate(({app})=>app.exit(0)).catch(()=>{});await desktop.close().catch(()=>{});}
});

async function upload(page:Page,fixture:Awaited<ReturnType<typeof seed>>,project=false){
  const name=project?'EXEMPLO-FICTÍCIO-PROJETO-'+ 'protocolo'.repeat(8)+'.png':'EXEMPLO-FICTÍCIO-Documento-geral.png';
  const response=await page.request.post(apiOrigin+'/api/arquivos/upload/stream',{headers:{'x-local-session':tokens.get(page)||''},multipart:{...(project?{projetoId:fixture.project}:{clienteId:fixture.client}),category:'Outros',file:{name,mimeType:'image/png',buffer:bytes}}});expect(response.ok()).toBe(true);return name;
}

  test('regressão: arquivos de duas origens, filtros, ações identificáveis, prévia e download íntegro',async({page})=>{
    const fixture=await seed();await open(page,fixture.client,'arquivos');await upload(page,fixture);const projectName=await upload(page,fixture,true);await open(page,fixture.client,'arquivos');const panel=page.locator('#cliente-panel-arquivos');await expect(panel.getByText('2 de 2 documentos',{exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'Por projeto',exact:true}).click();await expect(panel.getByText('1 de 2 documentos neste filtro',{exact:true})).toBeVisible();await page.getByLabel('Buscar arquivos',{exact:true}).fill('PROJETO');await page.locator('#cliente-tab-servicos').click();await page.locator('#cliente-tab-arquivos').click();await expect(page.getByLabel('Buscar arquivos',{exact:true})).toHaveValue('PROJETO');await expect(panel.getByRole('button',{name:'Por projeto',exact:true})).toHaveAttribute('aria-pressed','true');
    await panel.getByRole('button',{name:'Documentos gerais',exact:true}).click();await expect(panel.getByText('0 de 2 documentos neste filtro',{exact:true})).toBeVisible();await panel.getByRole('button',{name:'Limpar filtros',exact:true}).click();await expect(panel.getByText('2 de 2 documentos',{exact:true})).toBeVisible();
    const preview=panel.getByRole('button',{name:'Visualizar arquivo '+projectName,exact:true});await preview.focus();if(!await preview.locator('.client-file-action-label').isVisible())await expect(preview.getByRole('tooltip')).toBeVisible();await preview.press('Enter');const dialog=page.getByRole('dialog',{name:projectName,exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('#client-preview-open')).toBeFocused();await expect.poll(()=>dialog.locator('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);await page.keyboard.press('Escape');await expect(preview).toBeFocused();
    const downloading=page.waitForEvent('download');await panel.getByRole('button',{name:'Baixar arquivo '+projectName,exact:true}).click();expect(await fs.readFile((await(await downloading).path())!)).toEqual(bytes);
    await panel.getByRole('button',{name:'Excluir arquivo '+projectName,exact:true}).click();const confirm=page.getByRole('alertdialog',{name:/^Excluir arquivo/});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(panel.getByText(projectName,{exact:true})).toBeVisible();
    let pathSent='';await page.route('**/api/arquivos/open-file',async route=>{pathSent=route.request().postDataJSON().path;await route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'});});await panel.getByRole('button',{name:'Abrir arquivo '+projectName+' no aplicativo padrão',exact:true}).click();await expect.poll(()=>pathSent).toContain(projectName);await page.unroute('**/api/arquivos/open-file');
  });
