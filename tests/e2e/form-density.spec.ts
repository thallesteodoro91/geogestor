import {test,expect,_electron as electron,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {budgetGroup} from './support/budget-editor-groups';

test.setTimeout(240_000);
test.use({actionTimeout:12_000});
const output=path.resolve('docs/auditorias/2026-10-17-formularios-compactos/evidencias');
const origin=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const api=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const requireApi=createRequire(path.resolve('apps/api/package.json'));
let budget:any;
const fake='EXEMPLO FICTÍCIO — Proporções dos formulários';

test.beforeAll(async({request})=>{
  const root=process.env.GEOGESTOR_E2E_ROOT;
  if(!root||!/^run-/.test(path.basename(root)))throw Error('Somente banco fictício isolado');
  await fs.mkdir(output,{recursive:true});
  const {createClient}=requireApi('@libsql/client');const db=createClient({url:`file:${path.join(root,'geogestor.db')}`});
  const clientId=crypto.randomUUID(),approved=crypto.randomUUID();
  await db.batch([
    {sql:"insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')",args:[clientId,fake]},
    {sql:"insert into orcamentos (id,cliente_id,descricao,status,valor_total) values (?,?,?,'aprovado',123457)",args:[approved,clientId,fake+' — Parcela de teste']},
    {sql:"insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,123457,0,'2026-12-30','Pendente')",args:[crypto.randomUUID(),approved]}
  ],'write');db.close();
  const auth=await request.post(api+'/api/auth/unlock',{data:{password:'GeoGestor-E2E-2026'}});
  const headers={'x-local-session':(await auth.json()).token};
  async function post(route:string,data:any){const r=await request.post(api+route,{headers,data});expect(r.status(),await r.text()).toBe(201);return r.json();}
  budget=await post('/api/orcamentos',{
    clientId,description:fake,serviceType:'Levantamento cadastral',
    items:[{description:fake,unit:'serviço',quantity:'1',unitPriceCents:123457,unitCostCents:0,discount:{type:'fixo',value:'0'},addition:{type:'fixo',value:'0'},taxable:true,component:'servico',optional:false}],
    costs:[],taxes:[{name:fake,acronym:'FIC',ratePercent:'1.25',calculationBase:'servicos',includedInPrice:true,cumulative:false,manualAdjustmentCents:0}],
    globalDiscount:{type:'fixo',value:'0'},globalAddition:{type:'fixo',value:'0'},payment:{type:'avista',installments:[{percentage:'100',daysAfterApproval:0,label:'Pagamento'}]}
  });
  const cycle=await post('/api/planejamento/ciclos',{nome:fake,visao:'EXEMPLO FICTÍCIO — Validar proporções sem dados operacionais',dataInicio:'2026-01-01',dataFim:'2026-12-31',status:'ativo'});
  const pillar=await post('/api/planejamento/pilares',{cicloId:cycle.id,nome:fake,ordem:1});
  await post('/api/planejamento/objetivos',{cicloId:cycle.id,pilarId:pillar.id,titulo:fake,responsavel:'EXEMPLO FICTÍCIO',dataLimite:'2026-12-20',status:'em_andamento',prioridade:'alta'});
});

async function visit(page:Page,route:string){
  await page.goto(origin+route);
  const unlock=page.getByRole('heading',{name:'Desbloquear GeoGestor'});
  await expect(page.locator('#main-content').or(unlock)).toBeVisible();
  if(await unlock.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}
}
async function theme(page:Page,value:string){await page.evaluate(value=>{localStorage.setItem('geogestor_theme',value);document.documentElement.classList.toggle('dark',value==='dark');},value);}

type Capture=(name:string)=>Promise<void>;
async function checkForms(page:Page,suffix:string,capture:Capture){
  const measurements:any[]=[];
  async function record(form:string,selector:string,limits:Record<string,number>={}){
    const controls=page.locator(selector);await expect(controls.first()).toBeVisible();
    const values=await controls.evaluateAll(elements=>elements.map(el=>{
      const r=el.getBoundingClientRect(),i=el as HTMLInputElement,w=el.closest('.geo-numeric-input');
      return{id:el.id||i.name,width:r.width,height:r.height,value:i.value,wrapper:w?.getBoundingClientRect().width};
    }));
    for(const v of values)if(limits[v.id])expect(v.wrapper||v.width,`${form}: ${v.id}`).toBeLessThanOrEqual(limits[v.id]+0.05);
    for(const control of await controls.all()){
      await control.scrollIntoViewIfNeeded();
      expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),form+' control clipped').toBe(true);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(overflow,form+' horizontal overflow').toBeLessThanOrEqual(1);
    await controls.first().scrollIntoViewIfNeeded();
    await capture(`${form}-${suffix}.png`);measurements.push({form,values,overflow});
  }
  async function numeric(id:string,value:string){
    const input=page.locator('#'+id),original=await input.inputValue();
    await input.fill(value);await expect(input).toHaveValue(value);await expect(input).toBeFocused();
    const plus=page.locator(`button[aria-controls="${id}"]`).last(),minus=page.locator(`button[aria-controls="${id}"]`).first();
    await input.press('Tab');await expect(plus).toBeFocused();await page.keyboard.press('Enter');
    await expect(input).not.toHaveValue(value);await minus.click();await expect(input).toHaveValue(value);
    for(const b of [plus,minus]){const r=await b.boundingBox();expect(r!.width).toBeCloseTo(44,2);expect(r!.height).toBeCloseTo(44,2);}
    await input.fill(original);
  }
  await visit(page,'/despesas');await page.getByRole('button',{name:'Nova despesa',exact:true}).click();
  await numeric('despesa-valor','1234567.89');
  await record('nova-despesa','#despesa-valor',{'despesa-valor':288});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('#despesa-valor')).toBeHidden();

  await visit(page,'/crm');await page.getByRole('button',{name:'Nova oportunidade',exact:true}).click();
  await numeric('crm-probability','25');
  await page.locator('#crm-probability').fill('100');
  await expect(page.locator('button[aria-controls="crm-probability"]').last()).toBeDisabled();
  const value=page.locator('#crm-value');await value.fill('1234567,89');await value.blur();await expect(value).toHaveValue('1.234.567,89');
  const suffixRect=await page.locator('#crm-probability').evaluate(el=>{
    const wrapper=el.closest('.geo-numeric-input')!,unit=wrapper.nextElementSibling!;return {end:wrapper.getBoundingClientRect().right,start:unit.getBoundingClientRect().left};
  });expect(suffixRect.start).toBeGreaterThanOrEqual(suffixRect.end);
  await record('nova-oportunidade','#crm-value,#crm-probability',{'crm-value':288,'crm-probability':208});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Descartar alterações',exact:true}).click();await expect(page.locator('#crm-probability')).toBeHidden();

  await visit(page,'/clientes');await page.getByRole('button',{name:'Novo cliente',exact:true}).first().click();
  for(const address of await page.getByRole('button',{name:/^Endereço/}).all())if(await address.getAttribute('aria-expanded')==='false'){await address.click();break;}
  await page.locator('#client-numero').fill('120A');await expect(page.locator('#client-numero')).toHaveValue('120A');
  await page.locator('#client-uf').fill('sc');await expect(page.locator('#client-uf')).toHaveValue('SC');
  await page.locator('label[for="client-uf"]').click();await expect(page.locator('#client-uf')).toBeFocused();
  await record('novo-cliente-endereco','#client-cep,#client-numero,#client-uf',{'client-cep':160,'client-numero':128,'client-uf':80});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar editando',exact:true}).click();
  await expect(page.locator('#client-numero')).toHaveValue('120A');await expect(page.locator('#client-uf')).toHaveValue('SC');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();
  await expect(page.locator('#client-uf')).toBeHidden();

  await visit(page,'/configuracoes?secao=backups');await numeric('backup-retention','12');
  await record('configuracao-backups','#backup-debounce-minutes,#backup-retention,#backup-storage-gb,#backup-restore-test-days',{'backup-debounce-minutes':224,'backup-retention':224,'backup-storage-gb':224,'backup-restore-test-days':224});
  const discardPolicy=page.locator('section[aria-labelledby="backup-policy-title"]').getByRole('button',{name:'Descartar alterações',exact:true});
  await discardPolicy.click();await expect(discardPolicy).toBeDisabled();
  // Leave Settings through the desktop's regular SPA navigation before opening the next form.
  const menu=page.getByRole('button',{name:'Abrir menu de navegação',exact:true});
  if(await menu.isVisible())await menu.click();
  await page.getByRole('link',{name:'Comercial',exact:true}).first().click();await expect(page.locator('#backup-retention')).toBeHidden();

  await visit(page,`/orcamentos/${budget.id}/editar`);await expect(page.locator('#budget-description')).toBeVisible();await budgetGroup(page,'fees');await page.getByRole('button',{name:/^Impostos/}).click();
  await expect(page.locator('#budget-tax-rate-0')).toHaveValue('1.25');
  const remove=page.getByRole('button',{name:'Remover imposto 1',exact:true}),rect=await remove.boundingBox();expect(rect!.width).toBeCloseTo(44,2);expect(rect!.height).toBeCloseTo(44,2);
  await record('orcamento-impostos','#budget-tax-name-0,#budget-tax-rate-0,button[aria-label="Remover imposto 1"]',{'budget-tax-rate-0':144});
  await remove.focus();await page.keyboard.press('Enter');await expect(page.locator('#budget-tax-rate-0')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^Impostos/})).toContainText('0 impostos');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();
  await expect(page.locator('#budget-description')).toBeHidden();

  await visit(page,'/planejamento');await page.getByRole('tab',{name:'Objetivos e metas'}).click();
  await page.getByRole('button',{name:/Novo pilar|Criar primeiro pilar/}).first().click();await numeric('pillar-order','12');
  await record('planejamento-pilar','#pillar-order',{'pillar-order':208});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Objetivo',exact:true}).click();await numeric('objective-order','12');
  await record('planejamento-objetivo','#objective-order',{'objective-order':208});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('tab',{name:'Iniciativas'}).click();await page.getByRole('button',{name:/Nova iniciativa|Criar primeira iniciativa/}).first().click();
  await numeric('initiative-progress','25');await page.getByText('Orçamento e dependências (opcional)',{exact:true}).click();await numeric('initiative-budget','1234567.89');
  await record('planejamento-iniciativa','#initiative-progress,#initiative-budget',{'initiative-progress':208,'initiative-budget':288});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('#initiative-progress')).toBeHidden();

  await visit(page,'/financeiro');await page.locator('#finance-primary-action').click();
  await page.getByRole('menuitem',{name:/^Nova viagem/}).click();
  await page.getByLabel('Adiantamento (R$) — opcional',{exact:true}).fill('1234567,89');await page.getByLabel('Quilometragem — opcional',{exact:true}).fill('1234,56');
  await record('nova-viagem','[role="dialog"] input[inputmode="decimal"]');
  for(const el of await page.locator('[role="dialog"] input[inputmode="decimal"]').all())expect((await el.boundingBox())!.width).toBeLessThanOrEqual(256.05);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Descartar alterações',exact:true}).click();await expect(page.getByRole('dialog',{name:'Nova viagem',exact:true})).toBeHidden();

  await visit(page,'/financeiro?tab=faturas');await page.locator('#finance-primary-action').click();
  await page.getByRole('menuitem',{name:/^Registrar recebimento/}).click();
  await page.getByRole('textbox',{name:'Buscar contas a receber'}).fill(fake);
  await page.getByRole('group',{name:'Conta a receber de '+fake}).filter({hasText:fake+' — Parcela de teste'}).getByRole('button',{name:'Receber',exact:true}).click();
  await page.locator('#receipt-principal').fill('123,45');await expect(page.locator('#receipt-principal')).toHaveValue('123,45');
  // A coluna única do modal AURA pode ocupar toda a largura disponível até 360 px.
  const receiptFieldWidth = 360;
  await record('registrar-recebimento','#receipt-principal,input[name="juros"],input[name="multa"],input[name="desconto"],input[name="taxas"]',{'receipt-principal':receiptFieldWidth,'juros':receiptFieldWidth,'multa':receiptFieldWidth,'desconto':receiptFieldWidth,'taxas':receiptFieldWidth});
  await page.getByRole('dialog',{name:'Registrar recebimento',exact:true}).getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar editando',exact:true}).click();await expect(page.locator('#receipt-principal')).toHaveValue('123,45');
  await page.getByRole('dialog',{name:'Registrar recebimento',exact:true}).getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();await expect(page.locator('#receipt-principal')).toBeHidden();
  await fs.writeFile(path.join(output,`medidas-${suffix}.json`),JSON.stringify(measurements,null,2));
}

test('proporções, valores, teclado e exclusão nos dois temas em telas amplas e estreitas',async({page})=>{
  await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};},Number(process.env.GEOGESTOR_E2E_API_PORT));
  page.on('dialog',dialog=>dialog.accept());await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [1600,360])for(const value of ['light','dark']){
    console.log(`Formulários ${width} ${value}`);await page.setViewportSize({width,height:1000});await visit(page,'/');await theme(page,value);
    await checkForms(page,`${width}-${value}`,async name=>{await page.screenshot({path:path.join(output,name)});});
  }
});

test('proporções com zoom real de 200% no Electron, nos dois temas',async()=>{
  const requireRoot=createRequire(path.resolve('package.json'));let executablePath:string;
  try{executablePath=requireRoot('electron');}catch{executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');}
  const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>k.toUpperCase()!=='ELECTRON_RUN_AS_NODE')),GEOGESTOR_E2E_OFFSCREEN:'1'};
  const app=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30_000});
  try{
    const page=await app.firstWindow(),win=await app.browserWindow(page);page.setDefaultTimeout(12_000);
    // The native harness also handles beforeunload; Chromium may report it after dismissal.
    page.on('dialog',d=>d.accept().catch(error=>{if(!String(error).includes('No dialog is showing'))throw error;}));
    await win.evaluate(w=>{w.webContents.setBackgroundThrottling(false);w.setContentSize(1000,800);w.webContents.setZoomFactor(2);});
    await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(500);
    for(const value of ['light','dark']){
      console.log(`Formulários zoom real 200% ${value}`);await visit(page,'/');await theme(page,value);
      await checkForms(page,`zoom-200-${value}`,async name=>{
        await win.evaluate(async w=>{await w.capturePage(undefined,{stayHidden:true,stayAwake:true});});
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const png=await win.evaluate(async w=>(await w.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
        await fs.writeFile(path.join(output,name),Buffer.from(png,'base64'));
      });
      expect(await win.evaluate(w=>w.webContents.getZoomFactor())).toBe(2);
    }
  }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
});
