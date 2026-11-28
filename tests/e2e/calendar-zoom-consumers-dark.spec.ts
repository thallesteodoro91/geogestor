import {test,expect,_electron as electron,type Page} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import AxeBuilder from '@axe-core/playwright';
test.setTimeout(900_000);test.use({actionTimeout:6000});
const out=path.resolve('docs/auditorias/2026-10-18-calendario-200/consumidores-dark');
const origin=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`,api=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const ids={client:'8a8a8a8a-8888-4888-8888-888888888881',project:'8a8a8a8a-8888-4888-8888-888888888882',property:'8a8a8a8a-8888-4888-8888-888888888883',license:'8a8a8a8a-8888-4888-8888-888888888884',budget:'8a8a8a8a-8888-4888-8888-888888888885',parcel:'8a8a8a8a-8888-4888-8888-888888888886',environment:'8a8a8a8a-8888-4888-8888-888888888887',task:'8a8a8a8a-8888-4888-8888-888888888888'};
test.beforeAll(async()=>{const root=process.env.GEOGESTOR_E2E_ROOT;if(!root||!/^run-/.test(path.basename(root))||!path.resolve(root).startsWith(path.resolve('scratch/commercial-e2e')+path.sep))throw Error('Somente banco fictício isolado');await fs.mkdir(out,{recursive:true});
 const req=createRequire(path.resolve('apps/api/package.json')),db=req('@libsql/client').createClient({url:`file:${path.join(root,'geogestor.db')}`});
 try{await db.batch([
 {sql:"insert or ignore into clientes (id,nome,tipo_pessoa,situacao,email,celular,municipio,uf) values (?,?,'PF','Ativo','ficticio@example.invalid','(48) 99999-0000','Cidade fictícia','SC')",args:[ids.client,'EXEMPLO FICTÍCIO — Cliente da auditoria']},
 {sql:"insert or ignore into propriedades (id,cliente_id,nome,area_ha,municipio,uf) values (?,?,?,12.5,'Cidade fictícia','SC')",args:[ids.property,ids.client,'EXEMPLO FICTÍCIO — Imóvel de auditoria']},
 {sql:"insert or ignore into projetos (id,cliente_id,propriedade_id,nome,tipo,status,data_inicio,data_entrega,descricao) values (?,?,?,?,'Topografia','Em Andamento','2026-10-01','2026-11-30',?)",args:[ids.project,ids.client,ids.property,'EXEMPLO FICTÍCIO — Projeto da auditoria','EXEMPLO FICTÍCIO — Sem validade operacional']},
 {sql:"insert or ignore into projetos (id,cliente_id,propriedade_id,nome,tipo,status) values (?,?,?,?,'Ambiental','Em Andamento')",args:[ids.environment,ids.client,ids.property,'EXEMPLO FICTÍCIO — Demanda ambiental']},
 {sql:"insert or ignore into ambiental (id,cliente_id,projeto_id,propriedade_id,tipo_demanda,orgao_ambiental,protocolo) values (?,?,?,?,'CAR','Órgão fictício','PROTOCOLO-FICTÍCIO')",args:['8a8a8a8a-8888-4888-8888-888888888889',ids.client,ids.environment,ids.property]},
 {sql:"insert or ignore into licencas (id,cliente_id,projeto_id,numero,orgao,tipo_licenca,data_emissao,data_vencimento,status) values (?,?,?,'EXEMPLO-FICTÍCIO-001','Órgão fictício','LO','2026-10-01','2026-11-30','Válida')",args:[ids.license,ids.client,ids.environment]},
 {sql:"insert or ignore into orcamentos (id,cliente_id,projeto_id,descricao,status,valor_total) values (?,?,?,?,'aprovado',123456)",args:[ids.budget,ids.client,ids.project,'EXEMPLO FICTÍCIO — Orçamento da auditoria']},
 {sql:"insert or ignore into parcelas (id,orcamento_id,numero,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,1,123456,0,'2026-11-30','Pendente')",args:[ids.parcel,ids.budget]},
 {sql:"insert or ignore into despesas (id,cliente_id,projeto_id,descricao,valor,data,categoria,status) values (?,?,?, ?,12345,'2026-11-30','Campo','Pendente')",args:['8a8a8a8a-8888-4888-8888-888888888890',ids.client,ids.project,'EXEMPLO FICTÍCIO — Despesa da auditoria']},
 {sql:"insert or ignore into tarefas (id,cliente_id,projeto_id,titulo,status,prioridade,data_limite) values (?,?,?,?,'A Fazer','Alta','2026-11-30')",args:[ids.task,ids.client,ids.project,'EXEMPLO FICTÍCIO — Tarefa da auditoria']},
 {sql:"insert or ignore into compromissos (id,cliente_id,projeto_id,titulo,tipo,data,hora) values (?,?,?,?,'Reunião','2026-10-18','10:30')",args:['8a8a8a8a-8888-4888-8888-888888888891',ids.client,ids.project,'EXEMPLO FICTÍCIO — Reunião da auditoria']}
 ],'write');}finally{db.close();}
});
async function visit(page:Page,route:string){await page.goto(origin+route);const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});await expect(page.locator('#main-content').or(locked)).toBeVisible();if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();await expect(page.locator('[data-route-pathname]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
async function prepare(page:Page){await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};localStorage.setItem('geogestor_theme','dark');},Number(process.env.GEOGESTOR_E2E_API_PORT));await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/,r=>r.abort());}
async function database(sql:string,args:any[]=[]){const root=process.env.GEOGESTOR_E2E_ROOT!;if(!path.resolve(root).startsWith(path.resolve('scratch/commercial-e2e')+path.sep))throw Error('Banco isolado obrigatório');const req=createRequire(path.resolve('apps/api/package.json'));const db=req('@libsql/client').createClient({url:`file:${path.join(root,'geogestor.db')}`});try{return (await db.execute({sql,args})).rows;}finally{db.close();}}
async function openAux(page:Page,kind:'viagem'|'fiscal'){await visit(page,'/financeiro');await page.locator('#finance-primary-action').click();await page.getByRole('menuitem',{name:kind==='viagem'?/^Nova viagem/:/fiscal/i}).click();const dialog=page.getByRole('dialog').last();await expect(dialog).toHaveCSS('opacity','1');return dialog;}
async function date(page:Page,id:string){await page.locator('#'+id).click();await page.getByRole('gridcell',{name:'20 de outubro de 2026',exact:true}).click();}
async function shot(page:Page,name:string){await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}



import { expectUnclipped, expectCalendarCommands } from './support/calendar-assertions';
test.setTimeout(240000);
test('formulários reais no tema dark: 200% amplo e estreito, grade completa e valores preservados',async()=>{
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>k.toUpperCase()!=='ELECTRON_RUN_AS_NODE')),GEOGESTOR_E2E_OFFSCREEN:'1'};
 const app=await electron.launch({executablePath:process.env.GEOGESTOR_E2E_ELECTRON_PATH,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env});const records:any[]=[],failures:any[]=[];
 try{const page=await app.firstWindow(),win=await app.browserWindow(page);await prepare(page);await page.addInitScript(()=>localStorage.setItem('geogestor_theme','dark'));await page.emulateMedia({reducedMotion:'reduce'});page.on('dialog',dialog=>dialog.accept());
 const scenes=[
 {name:'Nova viagem',route:'/financeiro',aux:'viagem'},
 {name:'Documento fiscal',route:'/financeiro',aux:'fiscal'},
 {name:'Nova despesa',route:'/financeiro?tab=pagar',button:'Nova despesa'},
 {name:'Registrar recebimento',route:'/financeiro?tab=faturas&parcela='+ids.parcel,button:'Registrar recebimento'},
 {name:'Novo orçamento',route:'/orcamentos/novo'},
 {name:'Nova oportunidade',route:'/crm',button:'Nova oportunidade'},
 {name:'Novo lead',route:'/crm?view=leads',button:'Novo lead'},
 {name:'Novo projeto',route:'/projetos',button:'Novo projeto'},
 {name:'Nova demanda',route:'/ambiental',button:'Nova demanda'},
 {name:'Nova licença',route:'/ambiental?tab=licenciamento',button:'Nova licença'},
 {name:'Nova condicionante',route:'/ambiental/licencas/'+ids.license+'?tab=conditions',button:'Nova condicionante'},
 {name:'Andamento ambiental',route:'/ambiental/'+ids.environment,button:'Registrar andamento'},
 {name:'Documento ambiental',route:'/ambiental/'+ids.environment,button:'Gerar relatório'},
 {name:'Nova tarefa',route:'/tarefas',button:'Nova tarefa'},
 {name:'Novo ciclo',route:'/planejamento',button:'Criar primeiro planejamento'},
 {name:'Adicionar nota',route:'/clientes/'+ids.client,note:true},
 {name:'Histórico CRM do cliente',route:'/clientes',history:true},
 {name:'Filtros de tarefas',route:'/tarefas',filters:true},
 {name:'Filtros de projetos',route:'/projetos',filters:true},
 {name:'Filtros ambientais',route:'/ambiental',filters:true},
 {name:'Filtros de despesas',route:'/financeiro?tab=pagar',filters:true},
 {name:'Filtros de recebíveis',route:'/financeiro?tab=faturas',filters:true},
 {name:'Filtros de orçamento',route:'/orcamentos',filters:true}
 ];
 for(const width of [1280,640]){await win.evaluate((w,width)=>{w.webContents.setBackgroundThrottling(false);w.setContentSize(width,960);w.webContents.setZoomFactor(2);},width);
 for(const scene of scenes){try{await visit(page,scene.route);await page.waitForLoadState('networkidle');
 if(scene.aux){await page.locator('#finance-primary-action').click();await page.getByRole('menuitem',{name:scene.aux==='viagem'?/^Nova viagem/:/fiscal/i}).click();}
 if(scene.button)await page.getByRole('button',{name:scene.button,exact:true}).first().click();
 if(scene.note)await page.locator('section').filter({has:page.getByRole('heading',{name:/^Jornada do cliente/})}).last().getByRole('button',{name:'Adicionar',exact:true}).click();
 if(scene.history){await page.getByRole('button',{name:'Ações de EXEMPLO FICTÍCIO — Cliente da auditoria',exact:true}).click();await page.getByRole('menuitem',{name:'Editar',exact:true}).click();await page.getByRole('tab',{name:'Histórico CRM',exact:true}).click();}
 if(scene.filters&&await page.getByRole('button',{name:'Filtros',exact:true}).count())await page.getByRole('button',{name:'Filtros',exact:true}).click();
 const modal=page.getByRole('dialog').last();const opensModal=Boolean(scene.aux||scene.button||scene.note||scene.history);if(opensModal){await expect(modal).toBeVisible();await expect(modal).toHaveCSS('opacity','1');}
 const container=opensModal?modal:page.locator('main');const triggers=container.locator('button.geo-date-trigger:visible:enabled');await expect(triggers.first()).toBeVisible();const count=await triggers.count();expect(count,scene.name+' precisa exercitar calendários reais').toBeGreaterThan(0);
 for(let index=0;index<count;index++){const trigger=triggers.nth(index);const id=await trigger.getAttribute('id');const before=await trigger.locator('..').locator('input[type=hidden]').inputValue();await trigger.scrollIntoViewIfNeeded();await trigger.click();const popup=page.locator('.geo-popover-surface[role=dialog]:visible');await expect(popup).toHaveCount(1);await expectCalendarCommands(popup);const grid=popup.getByRole('grid');await expect(grid.getByRole('gridcell')).toHaveCount(42);await grid.hover();await page.mouse.wheel(0,1000);await expectUnclipped(grid.getByRole('gridcell').last());await expectCalendarCommands(popup);const geometry=await popup.evaluate(el=>{const r=el.getBoundingClientRect(),grid=el.querySelector('[role=grid]')!;return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,viewport:{width:innerWidth,height:innerHeight},grid:{height:grid.clientHeight,scrollHeight:grid.scrollHeight,scrollTop:grid.scrollTop}};});expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.viewport.width);if(index===0&&['Nova viagem','Nova despesa','Novo orçamento','Nova licença','Adicionar nota','Novo ciclo'].includes(scene.name))await page.screenshot({path:path.join(out,width+'-'+scene.name+'.png'),animations:'disabled'});await page.keyboard.press('Escape');await expect(popup).toBeHidden();await expect(trigger).toBeFocused();await expect(trigger.locator('..').locator('input[type=hidden]')).toHaveValue(before);records.push({scene:scene.name,theme:'dark',windowWidth:width,factor:2,id,index,value:before,...geometry});}
 console.log('CALENDÁRIO',scene.name,'dark',width,count);
 }catch(error){await page.screenshot({path:path.join(out,'falha-'+width+'-'+scene.name+'.png'),animations:'disabled'}).catch(()=>{});failures.push({scene:scene.name,width,error:String(error)});console.log('FALHA',scene.name,String(error).slice(0,200));}await fs.writeFile(path.join(out,'resultados.json'),JSON.stringify({records,failures},null,2));}
 }
 expect(failures,JSON.stringify(failures)).toEqual([]);expect(records.length).toBeGreaterThan(50);expect(await win.evaluate(w=>w.webContents.getZoomFactor())).toBe(2);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
});
