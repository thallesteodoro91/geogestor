import { protectedSourceBytes } from './support/isolated-session';
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-12-central-cliente/evidencias-polimento-abas');
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

const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGo0AAAAASUVORK5CYII=','base64');
async function choose(page:Page,label:string,option:string){await page.getByLabel(label,{exact:true}).click();await page.getByRole('option',{name:option,exact:true}).click();}
async function upload(page:Page,fixture:Awaited<ReturnType<typeof seed>>,project=false){
  const name=project?'EXEMPLO-FICTÍCIO-PROJETO-'+ 'protocolo'.repeat(8)+'.png':'EXEMPLO-FICTÍCIO-Documento-geral.png';
  const response=await page.request.post(apiOrigin+'/api/arquivos/upload/stream',{headers:{'x-local-session':tokens.get(page)||''},multipart:{...(project?{projetoId:fixture.project}:{clienteId:fixture.client}),category:'Outros',file:{name,mimeType:'image/png',buffer:bytes}}});expect(response.ok()).toBe(true);return name;
}
async function extraStatuses(fixture:Awaited<ReturnType<typeof seed>>){
  const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});
  try {await db.batch(['Em Andamento','Concluido','Suspenso','Pausado','Cancelado','Estado legado específico',''].map((status,index)=>({sql:"insert into projetos (id,cliente_id,nome,tipo,status,data_inicio,data_entrega,descricao) values (?,?,?,'Ambiental',?,'2026-09-01','2026-10-05',?)",args:[id(),fixture.client,`EXEMPLO FICTÍCIO — Situação ${index}`,status,'Descrição fictícia para revisão, sem afirmar aprovação ambiental.']})),'write');}finally{db.close();}
}
async function longDescription(fixture:Awaited<ReturnType<typeof seed>>){
  const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});
  try{await db.execute({sql:'update projetos set descricao=? where id=?',args:[Array.from({length:18},(_,i)=>`EXEMPLO FICTÍCIO — Registro ${i}: documentação informada para acompanhamento, sem conclusão automática sobre regularidade.`).join('\n')+'\nFIM DO REGISTRO FICTÍCIO COMPLETO',fixture.project]});}finally{db.close();}
}
async function presentation(page:Page){return page.evaluate(()=>{
  const style=(selector:string)=>{const el=document.querySelector<HTMLElement>(selector);if(!el)return null;const s=getComputedStyle(el);return {className:el.className,fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,background:s.background,borderRadius:s.borderRadius,display:s.display};};
  return {header:style('#main-content h1'),contact:style('.client-contact-card'),summary:style('[aria-labelledby="client-summary-title"]'),map:style('[aria-label^="Mapa das propriedades"]'),tabs:style('[role=tablist]')};
});}
async function capturePanel(page:Page,label:string,tab:string,runAxe=true){
  await fs.mkdir(evidence,{recursive:true});const panel=page.locator('#cliente-panel-'+tab);await panel.scrollIntoViewIfNeeded();
  const measurement=await panel.evaluate(el=>{const rect=el.getBoundingClientRect();return {width:rect.width,height:rect.height,text:(el as HTMLElement).innerText,collapsedDescriptions:el.querySelectorAll('[aria-expanded="false"][aria-controls]').length,hiddenText:Array.from(el.querySelectorAll<HTMLElement>('h2,h3,p,dd')).filter(n=>n.textContent?.trim()&&getComputedStyle(n).display!=='none'&&n.getBoundingClientRect().width<1).map(n=>n.textContent)};});
  const axe=runAxe?await new AxeBuilder({page}).include('#cliente-panel-'+tab).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze():null;
  await panel.screenshot({path:path.join(evidence,label+'.png')});const record={label,tab,url:page.url(),...measurement,axeChecked:runAxe,violations:axe?.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))||[]};
  await fs.writeFile(path.join(evidence,label+'.json'),JSON.stringify(record,null,2));return record;
}

test.describe('Polimento restrito às abas da Central do Cliente',()=>{
  test.setTimeout(240000);
  test('situações reais, legadas, ausentes e cores neutras sem contagens indevidas',async({page})=>{
    const fixture=await seed();await extraStatuses(fixture);await open(page,fixture.client,'ambiental');const panel=page.locator('#cliente-panel-ambiental');
    const metrics=panel.locator('.client-environment-metrics');await expect(metrics.getByText('Demandas vinculadas',{exact:true})).toBeVisible();await expect(metrics.locator('> div').nth(0).getByText('8',{exact:true})).toBeVisible();await expect(metrics.locator('> div').nth(1).getByText('1',{exact:true})).toBeVisible();await expect(metrics.locator('> div').nth(2).getByText('2',{exact:true})).toBeVisible();
    await expect(panel.getByText('Suspensas ou pausadas: 2 · Canceladas: 1 · Outras situações: 2',{exact:true})).toBeVisible();
    const unknown=panel.locator('[data-client-record-id]').filter({has:page.getByRole('heading',{name:'EXEMPLO FICTÍCIO — Situação 5',exact:true})});await expect(unknown.getByText('Estado legado específico',{exact:true})).toBeVisible();
    const missing=panel.locator('[data-client-record-id]').filter({has:page.getByRole('heading',{name:'EXEMPLO FICTÍCIO — Situação 6',exact:true})});await expect(missing.getByText('Situação não informada',{exact:true})).toBeVisible();
    await choose(page,'Situação de demandas ambientais','Concluído');await expect(panel.locator('[data-client-record-id]')).toHaveCount(2);await expect(panel.getByText('2 de 8 demandas ambientais neste filtro',{exact:true})).toBeVisible();await expect(page.locator('#cliente-tab-ambiental')).toHaveText(/Ambiental8/);
    await open(page,fixture.client,'propriedades');const badge=page.locator('#cliente-panel-propriedades article').getByText('Em revisão documental',{exact:true});await expect(badge).toHaveClass(/bg-zinc-100/);
  });
  test('105 imóveis acessíveis, busca sem acentos, ordenação e filtros preservados entre abas',async({page})=>{
    const fixture=await seed();const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});try{await db.batch(Array.from({length:104},(_,i)=>({sql:'insert into propriedades(id,cliente_id,nome,area_ha) values(?,?,?,1)',args:[id(),fixture.client,`EXEMPLO FICTÍCIO — Imóvel ${String(i).padStart(3,'0')}`]})),'write');}finally{db.close();}
    await open(page,fixture.client,'propriedades');const panel=page.locator('#cliente-panel-propriedades');await expect(panel.getByText('105 de 105 propriedades',{exact:true})).toBeVisible();const before=await presentation(page);await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'estrutura-antes-dos-filtros.json'),JSON.stringify(before,null,2));
    await page.getByLabel('Buscar propriedades',{exact:true}).fill('araucarias');await expect(panel.locator('[data-client-record-id]')).toHaveCount(1);await expect(panel.getByText('1 de 105 propriedades neste filtro',{exact:true})).toBeVisible();await expect(page.locator('#cliente-tab-propriedades')).toHaveText(/Propriedades105/);await expect(panel.getByText('PROTOCOLOFICTICIO'.repeat(10),{exact:true})).toBeVisible();
    await choose(page,'Ordenar propriedades','Área decrescente');await panel.getByRole('button',{name:'Limpar filtros',exact:true}).click();await expect(page.getByLabel('Ordenar propriedades',{exact:true})).toHaveText(/Área decrescente/);
    await page.locator('#cliente-tab-servicos').click();await choose(page,'Ordenar serviços','Prazo mais próximo');await page.locator('#cliente-tab-visao-geral').click();await page.locator('#cliente-tab-propriedades').click();await expect(page.getByLabel('Ordenar propriedades',{exact:true})).toHaveText(/Área decrescente/);
    const seen=new Set<string>();for(let n=1;n<=5;n++){await expect(panel.getByText(new RegExp(`Página ${n} de 5`))).toBeVisible();for(const value of await panel.locator('[data-client-record-id]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-client-record-id')!)))seen.add(value);if(n<5)await panel.getByRole('button',{name:'Próxima',exact:true}).click();}expect(seen.size).toBe(105);
    await page.getByLabel('Buscar propriedades',{exact:true}).fill('registro-inexistente');await expect(panel.getByText('Nenhum registro corresponde à busca ou aos filtros.',{exact:true})).toBeVisible();await expect(panel.getByText('Nenhuma propriedade cadastrada',{exact:true})).toHaveCount(0);await panel.getByRole('button',{name:'Mostrar todos os registros',exact:true}).click();await expect(panel.locator('[data-client-record-id]')).toHaveCount(24);
    const after=await presentation(page);expect(after).toEqual(before);await fs.writeFile(path.join(evidence,'estrutura-depois-dos-filtros.json'),JSON.stringify(after,null,2));
    const reference = JSON.parse(await fs.readFile('tests/e2e/fixtures/ui-protected-2026-10-18.json', 'utf8'));
    const protectedPaths = [
      'apps/web/src/pages/Clientes/ClienteDetalhes.tsx',
      'apps/web/src/pages/Clientes/ClienteDetalhes/ClienteMapaCard.tsx',
      'apps/web/src/components/Layout.tsx',
      'apps/web/src/index.css'
    ];
    const hashes = [];
    for (const file of protectedPaths) {
      const actual = crypto.createHash('sha256').update(await protectedSourceBytes(file)).digest('hex');
      expect(actual, file).toBe(reference.sources[file]);
      hashes.push({ path: file, sha256: actual });
    }
    await fs.writeFile(path.join(evidence, 'arquivos-protegidos.json'), JSON.stringify(hashes, null, 2));
  });
  test('estados vazios sem ações duplicadas; busca e ordenação de orçamentos',async({page})=>{
    const fixture=await seed();await open(page,fixture.empty,'servicos');await expect(page.locator('#cliente-panel-servicos').getByRole('button',{name:'Novo serviço',exact:true})).toHaveCount(1);await open(page,fixture.empty,'orcamentos');await expect(page.locator('#cliente-panel-orcamentos').getByRole('button',{name:'Novo orçamento',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Gerar Orçamento',exact:true})).toHaveCount(0);
    await open(page,fixture.client,'orcamentos');const panel=page.locator('#cliente-panel-orcamentos');await choose(page,'Ordenar orçamentos','Valor decrescente');await expect(panel.locator('[data-client-record-id]').first().getByRole('heading',{name:'ORC-FICTÍCIO-001',exact:true})).toBeVisible();await page.getByLabel('Buscar orçamentos',{exact:true}).fill('ORC-FICTICIO-002');await expect(panel.locator('[data-client-record-id]')).toHaveCount(1);await expect(panel.getByText('1 de 2 orçamentos neste filtro',{exact:true})).toBeVisible();await expect(page.locator('#cliente-tab-orcamentos')).toHaveText(/Orçamentos2/);
    await page.locator('#cliente-tab-servicos').click();await page.locator('#cliente-tab-orcamentos').click();await expect(page.getByLabel('Buscar orçamentos',{exact:true})).toHaveValue('ORC-FICTICIO-002');await panel.getByRole('button',{name:'Limpar filtros',exact:true}).click();await expect(panel.locator('[data-client-record-id]')).toHaveCount(2);
    const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});try{await db.batch(Array.from({length:30},(_,i)=>({sql:"insert into orcamentos(id,cliente_id,codigo_orcamento,status,valor_total) values(?,?,?,'rascunho',100000)",args:[id(),fixture.client,'ORC-FICTÍCIO-ADICIONAL-'+i]})),'write');}finally{db.close();}
    await open(page,fixture.client,'orcamentos','orcamentoId='+fixture.budget);await expect(panel.getByRole('heading',{name:'ORC-FICTÍCIO-001',exact:true})).toBeVisible();await expect(panel.getByText(/Página 2 de 2/)).toBeVisible();await panel.getByRole('button',{name:'Anterior',exact:true}).click();await expect(panel.getByText(/Página 1 de 2/)).toBeVisible();await expect(panel.getByRole('heading',{name:'ORC-FICTÍCIO-001',exact:true})).toHaveCount(0);
  });
  test('descrição curta sem controle extra e descrição longa expandida e recolhida por teclado',async({page})=>{
    const fixture=await seed();await longDescription(fixture);await open(page,fixture.client,'servicos');const card=page.locator('#cliente-panel-servicos [data-client-record-id]').filter({has:page.getByRole('heading',{name:'EXEMPLO FICTÍCIO — Levantamento planialtimétrico do imóvel rural',exact:true})});
    const expand=card.getByRole('button',{name:'Mostrar descrição completa',exact:true});await expect(expand).toBeVisible();const text=card.locator('p').filter({hasText:'FIM DO REGISTRO FICTÍCIO COMPLETO'});const collapsed=(await text.boundingBox())!.height;await expand.focus();await expand.press('Enter');const collapse=card.getByRole('button',{name:'Recolher descrição',exact:true});await expect(collapse).toHaveAttribute('aria-expanded','true');expect((await text.boundingBox())!.height).toBeGreaterThan(collapsed);expect(await text.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);await collapse.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','false');
    const db=createClient({url:`file:${path.join(fixture.root,'geogestor.db')}`});try{await db.execute({sql:'update projetos set descricao=? where id=?',args:['EXEMPLO FICTÍCIO — Descrição curta.',fixture.project]});}finally{db.close();}await open(page,fixture.client,'servicos');await expect(card.getByRole('button',{name:'Mostrar descrição completa',exact:true})).toHaveCount(0);
  });
  test('arquivos de duas origens, filtros, ações identificáveis, prévia e download íntegro',async({page})=>{
    const fixture=await seed();await open(page,fixture.client,'arquivos');await upload(page,fixture);const projectName=await upload(page,fixture,true);await open(page,fixture.client,'arquivos');const panel=page.locator('#cliente-panel-arquivos');await expect(panel.getByText('2 de 2 documentos',{exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'Por projeto',exact:true}).click();await expect(panel.getByText('1 de 2 documentos neste filtro',{exact:true})).toBeVisible();await page.getByLabel('Buscar arquivos',{exact:true}).fill('PROJETO');await page.locator('#cliente-tab-servicos').click();await page.locator('#cliente-tab-arquivos').click();await expect(page.getByLabel('Buscar arquivos',{exact:true})).toHaveValue('PROJETO');await expect(panel.getByRole('button',{name:'Por projeto',exact:true})).toHaveAttribute('aria-pressed','true');
    await panel.getByRole('button',{name:'Documentos gerais',exact:true}).click();await expect(panel.getByText('0 de 2 documentos neste filtro',{exact:true})).toBeVisible();await panel.getByRole('button',{name:'Limpar filtros',exact:true}).click();await expect(panel.getByText('2 de 2 documentos',{exact:true})).toBeVisible();
    const preview=panel.getByRole('button',{name:'Visualizar arquivo '+projectName,exact:true});await preview.focus();if(!await preview.locator('.client-file-action-label').isVisible())await expect(preview.getByRole('tooltip')).toBeVisible();await preview.press('Enter');const dialog=page.getByRole('dialog',{name:projectName,exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('#client-preview-open')).toBeFocused();await expect.poll(()=>dialog.locator('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);await page.keyboard.press('Escape');await expect(preview).toBeFocused();
    const downloading=page.waitForEvent('download');await panel.getByRole('button',{name:'Baixar arquivo '+projectName,exact:true}).click();expect(await fs.readFile((await(await downloading).path())!)).toEqual(bytes);
    await panel.getByRole('button',{name:'Excluir arquivo '+projectName,exact:true}).click();const confirm=page.getByRole('alertdialog',{name:/^Excluir arquivo/});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(panel.getByText(projectName,{exact:true})).toBeVisible();
    let pathSent='';await page.route('**/api/arquivos/open-file',async route=>{pathSent=route.request().postDataJSON().path;await route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'});});await panel.getByRole('button',{name:'Abrir arquivo '+projectName+' no aplicativo padrão',exact:true}).click();await expect.poll(()=>pathSent).toContain(projectName);await page.unroute('**/api/arquivos/open-file');
  });
  test('inspeção conjunta das sete abas com temas, largura do painel, texto ampliado e estados vazios',async({page})=>{
    const fixture=await seed();await extraStatuses(fixture);await longDescription(fixture);await open(page,fixture.client);await upload(page,fixture);await upload(page,fixture,true);const findings=[];
    for(const scenario of [{width:1440,theme:'light',scale:100},{width:1440,theme:'dark',scale:100},{width:360,theme:'dark',scale:100},{width:768,theme:'light',scale:100},{width:1920,theme:'dark',scale:200}]){
      await page.setViewportSize({width:scenario.width,height:960});for(const tab of tabs){await open(page,fixture.client,tab);await page.evaluate(({theme,scale})=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.style.fontSize=scale+'%';},scenario);findings.push(await capturePanel(page,`abas-${tab}-${scenario.width}-${scenario.theme}-${scenario.scale}`,tab,scenario.scale===100));}
    }
    await page.setViewportSize({width:1440,height:960});for(const tab of tabs){await open(page,fixture.empty,tab);findings.push(await capturePanel(page,'vazio-'+tab,tab,false));}await fs.writeFile(path.join(evidence,'matriz.json'),JSON.stringify(findings,null,2));
  });
  test('zoom real de 200% na janela desktop reduzida, separado da ampliação de fonte',async()=>{
    const fixture=await seed();const requireRoot=createRequire(path.resolve('package.json'));let executablePath:string;try{executablePath=requireRoot('electron');}catch{executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');}const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='ELECTRON_RUN_AS_NODE'));const desktop=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30000});
    try{const page=await desktop.firstWindow();await open(page,fixture.client,'financeiro');const win=await desktop.browserWindow(page);await win.evaluate(window=>{window.webContents.setBackgroundThrottling(false);window.setContentSize(1000,800);});
      const png=async(label:string)=>{const image=await win.evaluate(async window=>(await window.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await fs.writeFile(path.join(evidence,label+'.png'),Buffer.from(image,'base64'));};await fs.mkdir(evidence,{recursive:true});await png('desktop-100');await win.evaluate(window=>window.webContents.setZoomFactor(2));expect(await win.evaluate(window=>window.webContents.getZoomFactor())).toBe(2);await expect(page.locator('#cliente-panel-financeiro').getByText('R$ 3.000,00',{exact:true}).first()).toBeVisible();
      await page.locator('#cliente-tab-arquivos').click();await upload(page,fixture);await open(page,fixture.client,'arquivos');const file=page.getByText('EXEMPLO-FICTÍCIO-Documento-geral.png',{exact:true});await expect(file).toBeVisible();expect((await file.boundingBox())!.width).toBeGreaterThan(100);await png('desktop-200');await page.locator('#cliente-tab-arquivos').focus();await page.locator('#cliente-tab-arquivos').press('Home');await expect(page.locator('#cliente-tab-visao-geral')).toBeFocused();await fs.writeFile(path.join(evidence,'zoom-real.json'),JSON.stringify({factor:2,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),keyboard:'passed',isolated:true},null,2));
    }finally{await desktop.evaluate(({app})=>app.exit(0)).catch(()=>{});await desktop.close().catch(()=>{});}
  });
});
