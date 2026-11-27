import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import AxeBuilder from '@axe-core/playwright';
test.setTimeout(900_000);test.use({actionTimeout:6000});
const out=path.resolve('docs/auditorias/2026-10-18-padronizacao-implementacao/renderizado/light-390');
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
type Scene={menu:string;name:string;route:string;click?:string;tab?:string;step?:'viagem'|'fiscal'|'recebimento'|'nota'|'categoria';heading?:string;wideOnly?:boolean};
const scenes:Scene[]=[
 {menu:'Visão Geral',name:'Painel e indicadores',route:'/'},
 {menu:'Comercial',name:'Clientes',route:'/clientes'},
 {menu:'Comercial',name:'Novo cliente',route:'/clientes',click:'Novo cliente'},
 {menu:'Comercial',name:'Funil de oportunidades',route:'/crm'},
 {menu:'Comercial',name:'Nova oportunidade',route:'/crm',click:'Nova oportunidade'},
 {menu:'Comercial',name:'Leads',route:'/crm?view=leads'},
 {menu:'Comercial',name:'Novo lead',route:'/crm?view=leads',click:'Novo lead'},
 {menu:'Comercial',name:'Orçamentos',route:'/orcamentos'},
 {menu:'Comercial',name:'Novo orçamento',route:'/orcamentos/novo'},
 ...['visao-geral','propriedades','servicos','ambiental','orcamentos','financeiro','arquivos'].map(tab=>({menu:'Comercial',name:'Central do cliente — '+tab,route:`/clientes/${ids.client}?aba=${tab}`,wideOnly:tab!=='visao-geral'})),
 {menu:'Comercial',name:'Adicionar nota',route:`/clientes/${ids.client}`,step:'nota'},
 {menu:'Comercial',name:'Criar categoria da nota',route:`/clientes/${ids.client}`,step:'categoria'},
 {menu:'Projetos',name:'Projetos',route:'/projetos'},
 {menu:'Projetos',name:'Novo projeto',route:'/projetos',click:'Novo projeto'},
 ...['tarefas','arquivos','financeiro'].map(tab=>({menu:'Projetos',name:'Detalhe do projeto — '+tab,route:`/projetos/${ids.project}?aba=${tab}`,wideOnly:true})),
 {menu:'Ambiental',name:'Demandas ambientais',route:'/ambiental'},
 {menu:'Ambiental',name:'Nova demanda',route:'/ambiental',click:'Nova demanda'},
 {menu:'Ambiental',name:'Detalhe ambiental',route:`/ambiental/${ids.environment}`},
 {menu:'Ambiental',name:'Licenciamento',route:'/ambiental?tab=licenciamento'},
 {menu:'Ambiental',name:'Nova licença',route:'/ambiental?tab=licenciamento',click:'Nova licença'},
 {menu:'Ambiental',name:'Detalhe da licença',route:`/ambiental/licencas/${ids.license}`},
 {menu:'Ambiental',name:'Nova condicionante',route:`/ambiental/licencas/${ids.license}?tab=conditions`,click:'Nova condicionante'},
 {menu:'Ambiental',name:'Calculadora CAR',route:'/ambiental?tab=car'},
 ...['visao','faturas','pagar','auxiliares'].map(tab=>({menu:'Financeiro',name:'Financeiro — '+tab,route:'/financeiro?tab='+tab})),
 {menu:'Financeiro',name:'Nova despesa',route:'/financeiro?tab=pagar',click:'Nova despesa'},
 {menu:'Financeiro',name:'Nova viagem',route:'/financeiro',step:'viagem'},
 {menu:'Financeiro',name:'Documento fiscal',route:'/financeiro',step:'fiscal'},
 {menu:'Financeiro',name:'Registrar recebimento',route:`/financeiro?tab=faturas&parcela=${ids.parcel}`,step:'recebimento'},
 {menu:'Agenda',name:'Calendário',route:'/calendario?mes=2026-10&data=2026-10-18'},
 {menu:'Agenda',name:'Agendar compromisso',route:'/calendario?mes=2026-10&data=2026-10-18',click:'Agendar compromisso'},
 {menu:'Agenda',name:'Tarefas',route:'/tarefas'},
 {menu:'Agenda',name:'Nova tarefa',route:'/tarefas',click:'Nova tarefa'},
 {menu:'Topografia',name:'Conversor GMS e decimal',route:'/topografia'},
 {menu:'Topografia',name:'Distância e azimute',route:'/topografia',tab:'Distância e azimute'},
 {menu:'Topografia',name:'Área e perímetro',route:'/topografia',tab:'Área e perímetro'},
 ...['financeiro','projetos','executivo'].map(tipo=>({menu:'Relatórios',name:'Relatório '+tipo,route:'/relatorios?tipo='+tipo})),
 {menu:'Planejamento',name:'Visão estratégica',route:'/planejamento'},
 {menu:'Planejamento',name:'Novo ciclo',route:'/planejamento',click:'Criar primeiro planejamento'},
 {menu:'Cadastros',name:'Tipos de serviço',route:'/cadastros'},
 {menu:'Cadastros',name:'Novo tipo de serviço',route:'/cadastros',click:'Novo tipo de serviço'},
 {menu:'Cadastros',name:'Categorias de despesa',route:'/cadastros?tab=despesas'},
 {menu:'Cadastros',name:'Propriedades',route:'/propriedades'},
 {menu:'Cadastros',name:'Nova propriedade',route:'/propriedades',click:'Novo cadastro de propriedade'},
 ...['empresa','arquivos','armazenamento','seguranca','backups','alertas','modelos','integracoes','aparencia','manutencao'].map(secao=>({menu:'Configurações',name:'Configurações — '+secao,route:'/configuracoes?secao='+secao,wideOnly:secao!=='empresa'&&secao!=='backups'})),
 {menu:'Configurações',name:'Importação de dados',route:'/importacao'},
 {menu:'Configurações',name:'Esquemas de importação',route:'/importacao/esquemas'},
 {menu:'Configurações',name:'Qualidade dos dados',route:'/qualidade-dados'},
 {menu:'Configurações',name:'Logs de auditoria',route:'/audit-logs'},
 {menu:'Configurações',name:'Pós atualização',route:'/pos-atualizacao',wideOnly:true},
 {menu:'Ajuda',name:'Central de ajuda',route:'/ajuda'}
];
async function visit(page:Page,route:string){await page.goto(origin+route);const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});await expect(page.locator('#main-content').or(locked)).toBeVisible();if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();await expect(page.locator('[data-route-pathname]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
test('raio X renderizado de menus, abas, detalhes e formulários em armazenamento fictício',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'}); await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};},Number(process.env.GEOGESTOR_E2E_API_PORT));await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/,r=>r.abort());page.on('dialog',d=>d.accept());
 const errors:string[]=[],requests:any[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(api))requests.push({url:r.url().replace(api,''),status:r.status()});});const results:any[]=[];
 for(const viewport of [{width:390,height:844,theme:'light'}]){
  await page.setViewportSize(viewport);await page.addInitScript(theme=>localStorage.setItem('geogestor_theme',theme),viewport.theme);
  for(const [index,scene]of scenes.entries()){const name=`${String(index+1).padStart(2,'0')}-${viewport.width}-${viewport.theme}`,row:any={...scene,width:viewport.width,theme:viewport.theme,screenshot:name+'.png',errors:[],network:[]};const ne=errors.length,nr=requests.length;
   try{await visit(page,scene.route);await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),viewport.theme);
    if(scene.tab)await page.getByRole('tab',{name:scene.tab,exact:true}).click();
    if(scene.step==='nota'||scene.step==='categoria'){await page.locator('section').filter({has:page.getByRole('heading',{name:/^Jornada do cliente/})}).last().getByRole('button',{name:'Adicionar',exact:true}).click();if(scene.step==='categoria')await page.getByRole('button',{name:'Criar categoria',exact:true}).click();}
    if(scene.step==='viagem'||scene.step==='fiscal'){await page.locator('#finance-primary-action').click();await page.getByRole('menuitem',{name:scene.step==='viagem'?/^Nova viagem/:/fiscal/i}).click();}
    if(scene.step==='recebimento')await page.getByRole('button',{name:'Registrar recebimento',exact:true}).click();
    if(scene.click)await page.getByRole('button',{name:scene.click,exact:true}).first().click();
    const dialog=page.getByRole('dialog').last();if(await dialog.isVisible())await expect(dialog).toHaveCSS('opacity','1');
    await page.waitForLoadState('networkidle');
    await page.mouse.move(0,0);await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
    row.dom=await page.evaluate(()=>{const visible=(e:Element)=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';return{title:document.title,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(e=>e.textContent?.trim()),actions:[...document.querySelectorAll('button,a,[role="tab"]')].filter(visible).map(e=>({tag:e.tagName,role:e.getAttribute('role'),name:e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent?.trim().replace(/\s+/g,' '),disabled:e.matches(':disabled,[aria-disabled="true"]'),href:e.getAttribute('href')})),fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(e=>({id:e.id,type:e.getAttribute('type'),name:e.getAttribute('name'),label:e.getAttribute('aria-label')||[...(e as HTMLInputElement).labels||[]].map(l=>l.textContent?.trim()).join(' '),required:e.hasAttribute('required')})),overflow:document.documentElement.scrollWidth-innerWidth,focused:(document.activeElement as HTMLElement)?.id,dialog:document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')};});
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();row.accessibility=axe.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}));row.status='renderizado';
   }catch(e){row.status='não concluído';row.failure=String(e);await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'}).catch(()=>{});}
   row.errors=errors.slice(ne);row.network=requests.slice(nr);results.push(row);await fs.writeFile(path.join(out,'cenas.json'),JSON.stringify(results,null,2));console.log(`Auditoria ${results.length}: ${scene.menu} > ${scene.name} ${viewport.width}: ${row.status}, axe=${row.accessibility?.length??'n/a'}`);
  }
 }
 expect(results.filter(r=>r.status!=='renderizado'),JSON.stringify(results.filter(r=>r.status!=='renderizado'))).toHaveLength(0);expect(results.length).toBeGreaterThan(60);
});
