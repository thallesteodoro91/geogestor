import { selectCalendarDate } from './support/calendar-assertions';
import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import AxeBuilder from '@axe-core/playwright';
test.setTimeout(900_000);test.use({actionTimeout:6000});
const out=path.resolve('docs/auditorias/2026-10-18-raio-x-geogestor/complementos');
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
async function start(page:Page){await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};localStorage.setItem('geogestor_theme','dark');},Number(process.env.GEOGESTOR_E2E_API_PORT));await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/,r=>r.abort());}
async function record(page:Page,name:string,data:any){await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(data,null,2));}
async function aux(page:Page,kind:'viagem'|'fiscal'){await visit(page,'/financeiro');await page.locator('#finance-primary-action').click();await page.getByRole('menuitem',{name:kind==='viagem'?/^Nova viagem/:/fiscal/i}).click();}
test('completa formulários condicionante, tarefa e recebimento nos dois temas',async({page})=>{
 await start(page);const collected=[];
 for(const theme of ['dark','light'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.addInitScript(t=>localStorage.setItem('geogestor_theme',t),theme);
  for(const name of ['condicionante','tarefa','recebimento']){
   if(name==='condicionante'){await visit(page,'/ambiental/licencas/'+ids.license+'?tab=conditions');await page.getByRole('button',{name:'Nova condicionante',exact:true}).click();}
   if(name==='tarefa'){await visit(page,'/tarefas');await page.getByRole('button',{name:'Nova tarefa',exact:true}).first().click();}
   if(name==='recebimento'){await visit(page,'/financeiro?tab=faturas&parcela='+ids.parcel);await page.getByRole('button',{name:'Registrar recebimento',exact:true}).click();}
   const dialog=page.getByRole('dialog').last();await expect(dialog).toBeVisible();await expect(dialog).toHaveCSS('opacity','1');const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();const data={name,theme,width,violations:axe.violations,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)};await record(page,name+'-'+theme+'-'+width,data);collected.push(data);
  }
 }
 await fs.writeFile(path.join(out,'formularios.json'),JSON.stringify(collected,null,2));
});
test('valida descarte de oportunidade e falha no cadastro de viagem sem gravar dados financeiros', async ({ page }) => {
  await start(page);
  await visit(page, '/clientes');
  await page.getByRole('link', { name: 'CRM e Funil', exact: true }).click();
  const newOpportunity = page.getByRole('button', { name: 'Nova oportunidade', exact: true });
  await newOpportunity.click();
  const opportunity = page.getByRole('dialog', { name: 'Nova oportunidade', exact: true });
  const title = page.locator('#crm-title');
  const draft = 'EXEMPLO FICTÍCIO — Rascunho para auditar descarte';
  await title.fill(draft);
  const cancelOpportunity = opportunity.getByRole('button', { name: 'Cancelar', exact: true });
  await cancelOpportunity.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(title).toHaveValue(draft);
  await cancelOpportunity.click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(opportunity).toBeHidden();
  await newOpportunity.click();
  await expect(title).toHaveValue('');
  await record(page, 'crm-descarte', { confirmationShown: true, draftPreservedUntilDiscard: true });

  await aux(page, 'viagem');
  const dialog = page.getByRole('dialog', { name: 'Nova viagem', exact: true });
  const destination = dialog.locator('#travel-destination');
  await dialog.locator('#travel-purpose').fill('EXEMPLO FICTÍCIO — Levantamento');
  await destination.fill('Cidade fictícia');
  let post = 0;
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/financeiro/viagens', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    post++;
    await pending;
    await route.fulfill({ status: 503, json: { error: 'EXEMPLO FICTÍCIO — serviço temporariamente indisponível' } });
  });
  const save = dialog.getByRole('button', { name: 'Salvar viagem', exact: true });
  await save.click();
  await expect(dialog.getByText('Selecione a data de início.', { exact: true })).toBeVisible();
  expect(post).toBe(0);
  await page.locator('#travel-start-date').click();
  await selectCalendarDate(page.getByRole('dialog', { name: 'Selecionar data', exact: true }), '2026-10-20');
  await save.click();
  try {
    await expect.poll(() => post).toBe(1);
    await expect(destination).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Fechar modal', exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(dialog.getByRole('alert')).toContainText('preservados');
  await expect(destination).toHaveValue('Cidade fictícia');
  await record(page, 'viagem-falha', { post, fieldsPreserved: await destination.inputValue() });
});

test('valida falha no carregamento e no encerramento de viagens', async ({ page }) => {
  await start(page);
  const travels = '**/api/financeiro/viagens';
  await page.route(travels, route => route.fulfill({ status: 503, json: { error: 'EXEMPLO FICTÍCIO — falha simulada' } }));
  await visit(page, '/financeiro?tab=auxiliares');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar as viagens.', { timeout: 15000 });
  await expect(page.getByText('Nenhuma viagem registrada', { exact: true })).toBeHidden();
  await record(page, 'viagens-lista-falha', { alerts: await page.getByRole('alert').allTextContents() });
  await page.unroute(travels);

  const travel = {
    id: '8a8a8a8a-8888-4888-8888-888888888899',
    finalidade: 'EXEMPLO FICTÍCIO — Prestação de contas',
    destino: 'Cidade fictícia',
    dataInicio: '2026-10-18',
    adiantamento: 0, quilometragem: 0, valorReembolsavel: 0, totalGasto: 0,
    saldoPrestacao: 0, despesasQuantidade: 0, status: 'aberta'
  };
  let count = 0;
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(travels, route => route.fulfill({ json: [travel] }));
  await page.route(travels + '/' + travel.id, async route => {
    count++;
    await pending;
    await route.fulfill({ status: 503, json: { error: 'EXEMPLO FICTÍCIO — falha simulada' } });
  });
  await visit(page, '/financeiro?tab=auxiliares');
  const card = page.locator('article').filter({ hasText: travel.finalidade });
  const close = card.getByRole('button', { name: 'Encerrar prestação', exact: true });
  await close.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  try {
    await expect.poll(() => count).toBe(1);
    await expect(card.getByRole('button', { name: 'Encerrando prestação…', exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(close).toBeEnabled();
  await expect(card.getByRole('alert')).toContainText('Tente novamente');
  await record(page, 'viagens-encerrar-falha', { count, alerts: await card.getByRole('alert').allTextContents() });
});
