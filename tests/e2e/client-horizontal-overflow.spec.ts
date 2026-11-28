import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(240000);
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-13-cliente-largura/evidencias');
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




async function measure(page:Page){return page.evaluate(()=>{
 const main=document.querySelector<HTMLElement>('#main-content')!;const content=main.lastElementChild as HTMLElement;const bounds=content.getBoundingClientRect();
 const roots=[content,...content.children].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,classes:el.className,width:r.width,left:r.left,right:r.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,columns:s.gridTemplateColumns};});
 const escaped=[...content.querySelectorAll<HTMLElement>('*')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&s.position!=='absolute'&&s.position!=='fixed'&&r.right>bounds.right+1&&!el.closest('[role="tablist"]')&&!el.closest('[aria-label="Filtrar jornada do cliente"]');}).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,classes:el.className,text:el.innerText?.slice(0,60),left:r.left,right:r.right,width:r.width,minWidth:s.minWidth,overflow:s.overflowX};}).slice(0,24);
 return {viewport:innerWidth,mainWidth:main.clientWidth,mainScroll:main.scrollWidth,contentWidth:content.clientWidth,contentScroll:content.scrollWidth,roots,escaped};
});}
test('diagnóstico e verificação da largura da Central do Cliente',async({page})=>{
 const fixture=await seed();await fs.mkdir(evidence,{recursive:true});const results=[];
 for(const width of [360,768,1024,1280,1366,1440,1920]){
  await page.setViewportSize({width,height:960});await open(page,fixture.client);await expect(page.getByRole('heading',{name:/^Jornada do cliente/})).toBeVisible();await page.waitForTimeout(200);if(process.env.CLIENT_OVERFLOW_PREVIEW==='1') await page.evaluate(()=>{const card=document.querySelector<HTMLElement>('.client-contact-card')!;for(const el of [card,card.parentElement!,card.parentElement!.parentElement!])el.style.minWidth='0';for(const el of [card.parentElement!,card.parentElement!.parentElement!])el.style.gridTemplateColumns='minmax(0,1fr)';});const value=await measure(page);results.push({width,...value});
  if(width===1440||width===360){await page.screenshot({path:path.join(evidence,`${process.env.CLIENT_OVERFLOW_BASELINE==='1'?'antes':process.env.CLIENT_OVERFLOW_PREVIEW==='1'?'proposta':'depois'}-${width}.png`)});}

 }
 await fs.writeFile(path.join(evidence,`${process.env.CLIENT_OVERFLOW_BASELINE==='1'?'antes':process.env.CLIENT_OVERFLOW_PREVIEW==='1'?'proposta':'depois'}.json`),JSON.stringify(results,null,2));
 if(process.env.CLIENT_OVERFLOW_BASELINE!=='1')for(const value of results){expect(value.mainScroll).toBeLessThanOrEqual(value.mainWidth+1);expect(value.contentScroll).toBeLessThanOrEqual(value.contentWidth+1);}
});

test('largura em Electron com zoom real de 200%',async()=>{
 const fixture=await seed();const requireRoot=createRequire(path.resolve('package.json'));let executablePath:string;try{executablePath=requireRoot('electron');}catch{executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');}
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='ELECTRON_RUN_AS_NODE'));const desktop=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30000});
 try{const page=await desktop.firstWindow();await open(page,fixture.client);const win=await desktop.browserWindow(page);await win.evaluate(window=>{window.webContents.setBackgroundThrottling(false);window.setContentSize(1000,800);window.webContents.setZoomFactor(2);});await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(500);await expect(page.locator('.client-contact-card')).toBeVisible();const before=await measure(page);
 if(process.env.CLIENT_OVERFLOW_PREVIEW==='1')await page.evaluate(()=>{const card=document.querySelector<HTMLElement>('.client-contact-card')!;for(const el of [card,card.parentElement!,card.parentElement!.parentElement!])el.style.minWidth='0';for(const el of [card.parentElement!,card.parentElement!.parentElement!])el.style.gridTemplateColumns='minmax(0,1fr)';});const after=await measure(page);
 await fs.writeFile(path.join(evidence,'zoom-200.json'),JSON.stringify({factor:await win.evaluate(window=>window.webContents.getZoomFactor()),before,after},null,2));if(process.env.CLIENT_OVERFLOW_BASELINE!=='1'){expect(after.mainScroll).toBeLessThanOrEqual(after.mainWidth+1);expect(after.contentScroll).toBeLessThanOrEqual(after.contentWidth+1);}
 }finally{await desktop.evaluate(({app})=>app.exit(0)).catch(()=>{});await desktop.close().catch(()=>{});}
});
