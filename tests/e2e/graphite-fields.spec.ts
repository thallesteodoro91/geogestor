import {test,expect,_electron as electron,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import AxeBuilder from '@axe-core/playwright';
import {budgetGroup} from './support/budget-editor-groups';

test.setTimeout(240_000);
test.use({actionTimeout:12_000});
const output=path.resolve('docs/auditorias/2026-10-18-campos-grafite/evidencias');
const origin=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const api=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const before=process.env.GEOGESTOR_GRAPHITE_BASELINE==='1';
const phase=before?'antes':'depois';
const client='7b7b7b7b-7777-4777-8777-777777777771',project='7b7b7b7b-7777-4777-8777-777777777772';
const fields='.geo-field, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="range"]):not([type="color"]):not(.sr-only), textarea, select:not(.sr-only)';

test.beforeAll(async()=>{
 const root=process.env.GEOGESTOR_E2E_ROOT;
 if(!root||!/^run-/.test(path.basename(root))||!path.resolve(root).startsWith(path.resolve('scratch/commercial-e2e')+path.sep))throw Error('Somente armazenamento fictício gerenciado');
 await fs.mkdir(output,{recursive:true});
 const requireApi=createRequire(path.resolve('apps/api/package.json'));
 const db=requireApi('@libsql/client').createClient({url:`file:${path.join(root,'geogestor.db')}`});
 try{await db.batch([
 {sql:"insert or ignore into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')",args:[client,'EXEMPLO FICTÍCIO — Cliente das cores']},
 {sql:"insert or ignore into projetos (id,cliente_id,nome,tipo,status) values (?,?,?,'Topografia','Em Andamento')",args:[project,client,'EXEMPLO FICTÍCIO — Projeto das cores']}
 ],'write');}finally{db.close();}
});
async function prepare(page:Page){
 await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};},Number(process.env.GEOGESTOR_E2E_API_PORT));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/,route=>route.abort());
 page.on('dialog',d=>d.accept().catch(()=>{}));await page.emulateMedia({reducedMotion:'reduce'});
}
async function visit(page:Page,route:string){
 await page.goto(origin+route);const unlock=page.getByRole('heading',{name:'Desbloquear GeoGestor'});
 await expect(page.locator('#main-content').or(unlock)).toBeVisible();
 if(await unlock.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}
 await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();
}
async function theme(page:Page,value:string){await page.evaluate(v=>{localStorage.setItem('geogestor_theme',v);document.documentElement.classList.toggle('dark',v==='dark');},value);}
async function audit(page:Page,name:string,mode:string,width:number,capture=true){
 await expect(page.locator(fields).filter({visible:true}).first()).toBeVisible();
 const dialog=page.getByRole('dialog').last();if(await dialog.isVisible())await expect.poll(()=>dialog.evaluate(el=>Math.abs(el.getBoundingClientRect().width-(el as HTMLElement).offsetWidth))).toBeLessThan(.01);
 await page.evaluate(()=>document.fonts.ready);
 await page.mouse.move(0,0);await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
 let controls:any[]=[];
 await expect.poll(async()=>{controls=await page.locator(fields).evaluateAll(els=>els.filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map((el,index)=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{index,id:el.id,name:el.getAttribute('name'),tag:el.tagName,disabled:el.matches(':disabled,[aria-disabled="true"]'),background:s.backgroundColor,color:s.color,border:s.borderColor,width:r.width,height:r.height,placeholder:el.matches('input,textarea')?getComputedStyle(el,'::placeholder').color:null};}));return controls.length;}, {message:name}).toBeGreaterThan(0);
 if(!before&&mode==='dark')for(const c of controls){expect(c.background,`${name} ${c.id||c.name||c.index}`).toBe(c.disabled?'rgb(42, 48, 58)':'rgb(34, 38, 46)');expect(c.color,`${name} text ${c.id}`).toBe('rgb(255, 255, 255)');if(c.placeholder)expect(c.placeholder).toBe('rgb(255, 255, 255)');}
 if(!before&&mode==='dark'){
  const valueColors=await page.locator('button.geo-field > span:not([aria-hidden="true"]),button.geo-field-surface > span:not([aria-hidden="true"])').evaluateAll(els=>els.filter(el=>el.getClientRects().length).map(el=>getComputedStyle(el).color));
  for(const color of valueColors)expect(color,name+' selected value').toBe('rgb(255, 255, 255)');
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);expect(overflow,name).toBeLessThanOrEqual(1);
 if(capture)await page.screenshot({path:path.join(output,`${phase}-${name}-${width}-${mode}.png`),animations:'disabled'});
 return{name,mode,width,controls,overflow};
}

test('campos globais: dois temas, largura ampla e estreita, geometria e áreas protegidas',async({page})=>{
 await prepare(page);const results:any[]=[];
 for(const width of [1440,390])for(const mode of ['light','dark']){
  console.log(`Campos ${phase} ${width} ${mode}`);await page.setViewportSize({width,height:1000});await visit(page,'/clientes');await theme(page,mode);
  if(width===1440)await page.locator('aside').first().screenshot({path:path.join(output,`${phase}-menu-${mode}.png`),animations:'disabled'});
  results.push(await audit(page,'clientes-lista',mode,width));
  await page.getByRole('button',{name:'Novo cliente',exact:true}).first().click();
  results.push(await audit(page,'novo-cliente',mode,width));
  await visit(page,'/despesas');await page.getByRole('button',{name:'Nova despesa',exact:true}).click();
  results.push(await audit(page,'nova-despesa',mode,width));
  await visit(page,'/calendario?mes=2026-10&data=2026-10-17');
  results.push(await audit(page,'agenda-lista',mode,width));await page.getByRole('button',{name:'Agendar compromisso',exact:true}).click();
  results.push(await audit(page,'agendar-compromisso',mode,width));
  await visit(page,`/clientes/${client}?tab=visao-geral`);await page.locator('section').filter({has:page.getByRole('heading',{name:/^Jornada do cliente/})}).last().getByRole('button',{name:'Adicionar',exact:true}).click();
  results.push(await audit(page,'adicionar-nota',mode,width));
  await visit(page,'/orcamentos/novo');await expect(page.locator('#budget-description')).toBeVisible();
  results.push(await audit(page,'novo-orcamento',mode,width));await budgetGroup(page,'payment');
  results.push(await audit(page,'orcamento-pagamento',mode,width));
  await visit(page,'/propriedades');await page.getByRole('button',{name:'Novo cadastro de propriedade',exact:true}).click();
  results.push(await audit(page,'nova-propriedade',mode,width));
  await visit(page,'/projetos');await page.getByRole('button',{name:'Novo projeto',exact:true}).first().click();
  results.push(await audit(page,'novo-projeto',mode,width));
  await visit(page,'/tarefas');await page.getByRole('button',{name:'Nova tarefa',exact:true}).click();
  results.push(await audit(page,'nova-tarefa',mode,width));
  await visit(page,'/crm');await page.getByRole('button',{name:'Nova oportunidade',exact:true}).click();
  results.push(await audit(page,'nova-oportunidade',mode,width));
  await visit(page,'/ambiental?tab=licenciamento');await page.getByRole('button',{name:'Nova licença',exact:true}).click();
  results.push(await audit(page,'nova-licenca',mode,width));
  await visit(page,'/configuracoes?secao=backups');await expect(page.locator('#backup-retention')).toBeVisible();
  results.push(await audit(page,'configuracoes',mode,width));
 }
 await fs.writeFile(path.join(output,`${phase}-campos.json`),JSON.stringify(results,null,2));
 if(!before){
  const baseline=JSON.parse(await fs.readFile(path.join(output,'antes-campos.json'),'utf8'));
  for(const [i,current] of results.entries()){
   const previous=baseline[i];expect(current.name).toBe(previous.name);expect(current.controls.length,current.name).toBe(previous.controls.length);
   for(const [j,c] of current.controls.entries()){
    const p=previous.controls[j];expect(c.width,`${current.name} width`).toBeCloseTo(p.width,1);expect(c.height,`${current.name} height`).toBeCloseTo(p.height,1);
    if(current.mode==='light')for(const key of ['background','color','border','placeholder'])expect(c[key],`${current.name} light ${key}`).toBe(p[key]);
   }
  }
  for(const mode of ['light','dark'])expect(Buffer.compare(await fs.readFile(path.join(output,`antes-menu-${mode}.png`)),await fs.readFile(path.join(output,`depois-menu-${mode}.png`)))).toBe(0);
 }
});

test('referência móvel de Clientes após autenticação da fixture',async({page})=>{
 test.skip(!before);await prepare(page);await page.setViewportSize({width:390,height:1000});
 const file=path.join(output,'antes-campos.json'),baseline=JSON.parse(await fs.readFile(file,'utf8'));
 for(const mode of ['light','dark']){await visit(page,'/clientes');await theme(page,mode);await expect(page.locator('#client-search')).toBeVisible();const entry=await audit(page,'clientes-lista',mode,390);const index=baseline.findIndex((r:any)=>r.name==='clientes-lista'&&r.mode===mode&&r.width===390);expect(index).toBeGreaterThan(-1);baseline[index]=entry;}
 await fs.writeFile(file,JSON.stringify(baseline,null,2));
});

test('referências da Agenda após autenticação da fixture',async({page})=>{
 test.skip(!before);await prepare(page);const file=path.join(output,'antes-campos.json'),baseline=JSON.parse(await fs.readFile(file,'utf8'));
 for(const width of [1440,390])for(const mode of ['light','dark']){await page.setViewportSize({width,height:1000});await visit(page,'/calendario?mes=2026-10&data=2026-10-17');await theme(page,mode);await expect(page.locator('#calendar-search')).toBeVisible();const entry=await audit(page,'agenda-lista',mode,width);const index=baseline.findIndex((r:any)=>r.name==='agenda-lista'&&r.mode===mode&&r.width===width);expect(index).toBeGreaterThan(-1);baseline[index]=entry;}
 expect(baseline.some((r:any)=>r.controls.some((c:any)=>c.id==='local-password'))).toBe(false);await fs.writeFile(file,JSON.stringify(baseline,null,2));
});

test('foco, seletores, validação, falha e valores monetários preservados',async({page})=>{
 test.skip(before);await prepare(page);await page.setViewportSize({width:1440,height:1000});
 await visit(page,'/calendario?mes=2026-10&data=2026-10-17');await theme(page,'dark');await page.getByRole('button',{name:'Agendar compromisso',exact:true}).click();
 const title=page.locator('#calendar-title');await expect(title).toBeFocused();
 expect(await title.evaluate(el=>getComputedStyle(el).borderColor)).toBe('rgb(146, 148, 255)');
 await page.getByRole('dialog',{name:/Agendar compromisso/}).getByRole('button',{name:'Agendar compromisso',exact:true}).click();await expect(title).toBeFocused();await expect(title).toHaveAttribute('aria-invalid','true');
 expect(await title.evaluate(el=>getComputedStyle(el).borderColor)).not.toBe('rgb(146, 148, 255)');
 await title.fill('EXEMPLO FICTÍCIO — Contraste branco');await page.locator('#calendar-description').fill('EXEMPLO FICTÍCIO — Preservar o preenchimento');
 await page.locator('#calendar-type').click();await page.getByRole('option',{name:'Reunião',exact:true}).click();
 const date=page.locator('#calendar-date');await date.click();await expect(page.getByRole('dialog',{name:'Selecionar data do compromisso'})).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:path.join(output,'foco-e-seletores.png')});
 let failure='http';await page.route('**/api/compromissos',async r=>{if(r.request().method()!=='POST')return r.continue();if(failure==='http')return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'EXEMPLO FICTÍCIO — Falha temporária'})});return r.abort('failed');});
 for(failure of ['http','communication']){
  await page.getByRole('dialog',{name:/Agendar compromisso/}).getByRole('button',{name:'Agendar compromisso',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:/tente novamente/i})).toBeVisible();await expect(title).toHaveValue('EXEMPLO FICTÍCIO — Contraste branco');
  await expect(page.locator('#calendar-description')).toHaveValue('EXEMPLO FICTÍCIO — Preservar o preenchimento');
 }
 await page.screenshot({path:path.join(output,'falha-campos-preservados.png')});
 await visit(page,'/despesas');await page.getByRole('button',{name:'Nova despesa',exact:true}).click();await page.locator('#despesa-valor').fill('1234.56');await expect(page.locator('#despesa-valor')).toHaveValue('1234.56');
 const axe=await new AxeBuilder({page}).include('.geo-expense-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 await fs.writeFile(path.join(output,'acessibilidade.json'),JSON.stringify(axe.violations,null,2));expect(axe.violations).toEqual([]);
 await visit(page,'/relatorios');await expect(page.getByRole('button',{name:/Selecionar período de análise/})).toBeVisible();
 expect(await page.getByRole('button',{name:/Selecionar período de análise/}).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(34, 38, 46)');
});

test('zoom real de 200% no desktop isolado',async()=>{
 test.skip(before);const requireRoot=createRequire(path.resolve('package.json'));
 let executablePath:string;try{executablePath=requireRoot('electron');}catch{executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');}
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>k.toUpperCase()!=='ELECTRON_RUN_AS_NODE')),GEOGESTOR_E2E_OFFSCREEN:'1'};
 const app=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30_000});
 try{const page=await app.firstWindow(),win=await app.browserWindow(page);await prepare(page);
  await win.evaluate(w=>{w.webContents.setBackgroundThrottling(false);w.setContentSize(1000,800);w.webContents.setZoomFactor(2);});await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(500);
  for(const mode of ['light','dark']){
   await visit(page,'/calendario?mes=2026-10&data=2026-10-17');await theme(page,mode);await page.getByRole('button',{name:'Agendar compromisso',exact:true}).click();
   await page.locator('#calendar-description').fill('EXEMPLO FICTÍCIO — Formulário no zoom real de 200%');
   await audit(page,'zoom-compromisso',mode,500,false);
   const dialog=page.getByRole('dialog',{name:/Agendar compromisso/}),r=(await dialog.boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(501);
   const action=(await dialog.getByRole('button',{name:'Agendar compromisso',exact:true}).boundingBox())!;expect(action.y+action.height).toBeLessThanOrEqual(400);
   await win.evaluate(async w=>{await w.capturePage(undefined,{stayHidden:true,stayAwake:true});});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const png=await win.evaluate(async w=>(await w.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
   await fs.writeFile(path.join(output,`zoom-200-${mode}.png`),Buffer.from(png,'base64'));expect(await win.evaluate(w=>w.webContents.getZoomFactor())).toBe(2);
   await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Descartar compromisso',exact:true}).click();await expect(dialog).toBeHidden();
  }
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
});

test('cores forçadas respeitam a preferência de acessibilidade do sistema',async({page})=>{
 test.skip(before);await prepare(page);await visit(page,'/despesas');await theme(page,'dark');await page.getByRole('button',{name:'Nova despesa',exact:true}).click();
 await page.emulateMedia({forcedColors:'active'});const input=page.locator('#despesa-valor');
 const colors=await input.evaluate(el=>{const s=getComputedStyle(el);return{text:s.color,fill:s.webkitTextFillColor,background:s.backgroundColor,adjust:s.forcedColorAdjust};});
 expect(colors.adjust).toBe('auto');expect(colors.fill).toBe(colors.text);expect(colors.text).not.toBe(colors.background);
 await fs.writeFile(path.join(output,'cores-forcadas.json'),JSON.stringify(colors,null,2));
});
