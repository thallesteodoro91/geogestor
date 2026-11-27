import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {budgetGroup} from './support/budget-editor-groups';

test.setTimeout(180_000);
const output=path.resolve('docs/auditorias/2026-10-17-pagamento-compacto/evidencias/auditoria');
const origin=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const api=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
test('auditoria renderizada de proporções em outros formulários, sem salvar alterações',async({page,request})=>{
  const root=process.env.GEOGESTOR_E2E_ROOT;
  if(!root||!/^run-/.test(path.basename(root)))throw Error('Auditoria exige banco fictício isolado');
  await fs.mkdir(output,{recursive:true});
  await page.setViewportSize({width:1600,height:1000}); await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};},Number(process.env.GEOGESTOR_E2E_API_PORT));
  async function visit(route:string){
    await page.goto(origin+route);
    const unlock=page.getByRole('heading',{name:'Desbloquear GeoGestor'});
    await expect(page.locator('#main-content').or(unlock)).toBeVisible();
    if(await unlock.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}
  }
  const results:any[]=[];
  async function record(form:string,selector:string){
    const fields=page.locator(selector); await expect(fields.first()).toBeVisible();
    const controls=await fields.evaluateAll(elements=>elements.map(el=>{
      const r=el.getBoundingClientRect(),input=el as HTMLInputElement;
      const wrapper=el.closest('.geo-numeric-input');
      return{id:el.id,name:input.name,label:el.getAttribute('aria-label'),width:r.width,height:r.height,min:input.min,max:input.max,wrapperWidth:wrapper?.getBoundingClientRect().width};
    }));
    results.push({form,controls,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)});
    await fields.first().scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,form+'.png')});
  }
  await visit('/despesas');await page.getByRole('button',{name:'Nova despesa',exact:true}).click();
  await record('nova-despesa','#despesa-valor');
  await visit('/cadastros');await page.getByRole('button',{name:'Novo tipo de serviço',exact:true}).click();
  await record('tipo-servico','#cadastro-serv-valor');
  await visit('/propriedades');await page.getByRole('button',{name:'Novo cadastro de propriedade',exact:true}).click();
  await record('nova-propriedade','#property-area-ha,#property-latitude,#property-longitude');
  await visit('/crm');await page.getByRole('button',{name:'Nova oportunidade',exact:true}).click();
  await record('nova-oportunidade','#crm-value,#crm-probability');
  await visit('/clientes');await page.getByRole('button',{name:'Novo cliente',exact:true}).first().click();
  for(const address of await page.getByRole('button',{name:/^Endereço/}).all()) {
    if(await address.getAttribute('aria-expanded')==='false'){await address.click();break;}
  }
  await record('novo-cliente-endereco','#client-cep,#client-numero,#client-uf');
  await visit('/configuracoes?secao=alertas');
  await record('configuracao-alertas','input[name^="alert-days-"],input[name^="alert-interval-"]');
  await visit('/configuracoes?secao=backups');
  await record('configuracao-backups','#backup-debounce-minutes,#backup-retention,#backup-restore-test-days');

  const requireApi=createRequire(path.resolve('apps/api/package.json'));
  const {createClient}=requireApi('@libsql/client');const db=createClient({url:`file:${path.join(root,'geogestor.db')}`});
  const clientId=crypto.randomUUID();await db.execute({sql:"insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')",args:[clientId,'EXEMPLO FICTÍCIO — Auditoria visual']});db.close();
  const unlock=await request.post(api+'/api/auth/unlock',{data:{password:'GeoGestor-E2E-2026'}});
  const response=await request.post(api+'/api/orcamentos',{headers:{'x-local-session':(await unlock.json()).token},data:{
    clientId,description:'EXEMPLO FICTÍCIO — Auditoria de impostos',serviceType:'Levantamento cadastral',
    items:[{description:'EXEMPLO FICTÍCIO — Serviço',unit:'serviço',quantity:'1',unitPriceCents:10000,unitCostCents:0,discount:{type:'fixo',value:'0'},addition:{type:'fixo',value:'0'},taxable:true,component:'servico',optional:false}],
    costs:[],taxes:[{name:'EXEMPLO FICTÍCIO — Tributo',acronym:'FIC',ratePercent:'1',calculationBase:'servicos',includedInPrice:true,cumulative:false,manualAdjustmentCents:0}],
    globalDiscount:{type:'fixo',value:'0'},globalAddition:{type:'fixo',value:'0'},payment:{type:'avista',installments:[{percentage:'100',daysAfterApproval:0,label:'Pagamento'}]}
  }});
  expect(response.status(),await response.text()).toBe(201);const budget=await response.json();
  await visit(`/orcamentos/${budget.id}/editar`);await budgetGroup(page,'fees');await page.getByRole('button',{name:/^Impostos/}).click();
  await record('orcamento-impostos','#budget-tax-rate-0,button[aria-label="Remover imposto 1"]');
  await fs.writeFile(path.join(output,'medidas.json'),JSON.stringify(results,null,2));
});
